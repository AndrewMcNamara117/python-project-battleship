/**
 * EXTERNAL EMAIL, END TO END.
 *
 * The one hop this cannot cover is the last one: this sandbox's network policy
 * refuses CONNECT to every transactional email provider, so no message can
 * actually cross the internet from here. Everything up to that point is real —
 * the real cron routes, the real jobs, the real repository, the real Resend
 * adapter making a real HTTP request with real headers — against a local
 * server that speaks Resend's protocol and keeps what it is sent.
 *
 * Start the app with:
 *   RESEND_API_KEY=test-key RESEND_ENDPOINT=http://127.0.0.1:4599/emails \
 *   CRON_SECRET=... npm run dev
 *
 * then: node e2e/email.mjs
 */
import { createServer } from 'node:http';
import { createHmac } from 'node:crypto';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const SECRET = process.env.CRON_SECRET ?? '';
const PORT = Number(process.env.FAKE_RESEND_PORT ?? 4599);

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};

/* ---- a server that behaves like Resend ---- */

const inbox = [];
let behaviour = { status: 200, body: () => JSON.stringify({ id: `msg_${inbox.length + 1}` }) };

const fake = createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => { raw += c; });
  req.on('end', () => {
    const message = raw ? JSON.parse(raw) : {};
    inbox.push({
      ...message,
      _auth: req.headers.authorization,
      _idempotency: req.headers['idempotency-key'],
    });
    res.writeHead(behaviour.status, { 'content-type': 'application/json' });
    res.end(behaviour.body());
  });
});
await new Promise((r) => fake.listen(PORT, '127.0.0.1', r));

const cron = (job) => fetch(`${BASE}/api/cron/${job}`, {
  headers: { authorization: `Bearer ${SECRET}` },
}).then((r) => r.json());

try {
  if (!SECRET) {
    console.log('CRON_SECRET is not set; nothing here can run.');
    process.exit(1);
  }

  /* ---- the pipeline ---- */

  console.log('\nthe pipeline, with a provider attached');

  // Drive both jobs. The digest is once per coach per local day and alerts are
  // deduped per check-in, so in a server that has already run them this suite
  // finds nothing left to send — which is the dedupe working, not a failure.
  const alerts = await cron('coach-alerts');
  const digest = await cron('coach-digest');
  const queued = alerts.created + alerts.held + digest.created + digest.held;

  const delivery = await cron('notification-delivery');
  check('the jobs ran', typeof delivery.processed === 'number');

  const email = inbox.find((m) => !String(m.subject ?? '').startsWith('[TEST]'));

  if (!queued && !email) {
    console.log('  --   nothing new to send in this server;'
      + ' restart it and run this suite alone to exercise the pipeline leg');
  } else {
    check('a real HTTP request reached the provider', Boolean(email),
      `${inbox.length} messages captured, ${queued} queued`);
  }

  if (email) {
    check('it authenticated with the API key', email._auth === 'Bearer test-key');
    check('it carried an idempotency key', /^im-delivery-/.test(email._idempotency ?? ''));
    check('reply-to is the Iron Miles mailbox',
      email.reply_to === 'ironmilesclub@outlook.com', email.reply_to);
    check('it has both an HTML and a text part',
      typeof email.html === 'string' && typeof email.text === 'string');
    check('the subject says what needs doing without naming a condition',
      /Iron Miles/.test(email.subject)
      && !/pain|sore|achilles|injur/i.test(email.subject), email.subject);

    /* ---- the privacy boundary, on the actual bytes that would go out ---- */

    console.log('\nwhat actually left the building');
    const both = `${email.html}\n${email.text}`;
    check('no athlete\'s written words', !/Reported:/.test(both));
    check('no body part', !/\b(achilles|calf|knee|hamstring|shin)\b/i.test(both));
    check('no soreness score', !/\b\d\s*\/\s*10\b/.test(both));
    check('no readiness or risk score', !/readiness|risk score/i.test(both));
    check('links are absolute, because a mail client has no origin',
      (email.text.match(/https?:\/\/\S+/g) ?? []).length > 0);
  }

  /* ---- what the delivery record now says ---- */

  console.log('\nthe delivery record');
  const state = await cron('notification-delivery');
  check('nothing is sent twice on a second run', state.processed === 0,
    JSON.stringify(state));

  let recordedId = null;
  if (email) {
    check('the first run reported sent, not delivered',
      delivery.items.some((i) => i.kind === 'email' && i.outcome === 'sent'),
      JSON.stringify(delivery.items));

    recordedId = (delivery.items.find((i) => i.kind === 'email')?.detail ?? '')
      .match(/id (\S+?)\)/)?.[1] ?? null;
    check('and it recorded the provider\'s message id', Boolean(recordedId),
      JSON.stringify(delivery.items.map((i) => i.detail)));
  }

  /* ---- failure paths, through the real worker ---- */

  console.log('\nwhen the provider misbehaves');

  behaviour = { status: 503, body: () => '{"message":"upstream unavailable"}' };
  await cron('coach-alerts');
  const failing = await cron('notification-delivery');
  const retrying = failing.items.filter((i) => i.outcome === 'retrying');
  check('a server error is retried, not given up on',
    retrying.length > 0 || failing.processed === 0,
    JSON.stringify(failing.items));
  if (retrying.length) {
    check('and the record says when it will try again',
      /trying again in/.test(retrying[0].detail ?? ''), retrying[0].detail);
    check('nothing claims delivery',
      !failing.items.some((i) => i.outcome === 'delivered' && i.kind === 'email'));
  }

  /* ---- the test-send flow ---- */

  console.log('\nthe test send');
  const before = inbox.length;
  const testRes = await fetch(`${BASE}/api/admin/email-test?which=both`, {
    method: 'POST', headers: { authorization: `Bearer ${SECRET}` },
  });
  const test = await testRes.json();

  check('it needs the secret',
    (await fetch(`${BASE}/api/admin/email-test`, { method: 'POST' })).status === 401);
  check('it reports the provider and the sender', Boolean(test.provider && test.from));
  check('it says whether the sender is verified', typeof test.senderVerified === 'boolean');
  check('it surfaces the setup still outstanding', 'setupRequired' in test);

  const sent = inbox.slice(before);
  check('it sent to the Iron Miles mailbox and nowhere else',
    sent.length > 0 && sent.every((m) => m.to.length === 1
      && m.to[0] === 'ironmilesclub@outlook.com'),
    JSON.stringify(sent.map((m) => m.to)));
  check('every test message is marked as one',
    sent.every((m) => m.subject.startsWith('[TEST]')));
  check('and carries no real athlete\'s name',
    sent.every((m) => /Sample|Second|Third/.test(m.text)));

  /* ---- webhooks ---- */

  console.log('\ndelivery receipts');
  const unsigned = await fetch(`${BASE}/api/webhooks/resend`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ type: 'email.delivered', data: { email_id: 'msg_1' } }),
  });
  check('an unsigned webhook is refused', unsigned.status === 401 || unsigned.status === 503,
    `status ${unsigned.status}`);

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (secret) {
    const post = async (type, emailId) => {
      const body = JSON.stringify({ type, data: { email_id: emailId } });
      const id = `svix_${Date.now()}`;
      const ts = String(Math.floor(Date.now() / 1000));
      const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
      const sig = createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64');
      const res = await fetch(`${BASE}/api/webhooks/resend`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'svix-id': id, 'svix-timestamp': ts, 'svix-signature': `v1,${sig}`,
        },
        body,
      });
      return { status: res.status, json: await res.json() };
    };

    const tampered = await fetch(`${BASE}/api/webhooks/resend`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'svix-id': 'x', 'svix-timestamp': String(Math.floor(Date.now() / 1000)),
        'svix-signature': 'v1,AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
      },
      body: JSON.stringify({ type: 'email.delivered', data: { email_id: 'msg_1' } }),
    });
    check('a wrongly signed webhook is refused', tampered.status === 401,
      `status ${tampered.status}`);

    if (recordedId) {
      const delivered = await post('email.delivered', recordedId);
      check('a correctly signed receipt is accepted', delivered.status === 200,
        JSON.stringify(delivered.json));
      check('and it promotes the delivery from sent to delivered',
        delivered.json.changed === true, JSON.stringify(delivered.json));

      const duplicate = await post('email.delivered', recordedId);
      check('a duplicate receipt changes nothing', duplicate.json.changed === false);
    }

    const unknown = await post('email.delivered', 'never-sent-this');
    check('a receipt for a message we never sent is acknowledged, not retried for ever',
      unknown.status === 200 && unknown.json.changed === false);

    const ignored = await post('email.sent', recordedId ?? 'never-sent-this');
    check('email.sent is ignored: the worker already recorded that',
      ignored.json.ignored === true, JSON.stringify(ignored.json));
  } else {
    console.log('  --   RESEND_WEBHOOK_SECRET not set; skipping the signed-receipt leg');
  }

} finally {
  fake.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
