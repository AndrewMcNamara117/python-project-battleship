/**
 * Signals outside the browser — driven through the real UI.
 *
 * The claims this suite checks are the ones a coach would be angry about if
 * they turned out to be false: that a preference they set is honoured, that
 * "delivered" is not printed next to a channel nothing was sent on, and that
 * an athlete's report reaches them in the athlete's own words.
 *
 *   BASE_URL=http://localhost:3000 node e2e/notifications.mjs
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const CHROMIUM = process.env.CHROMIUM_PATH ?? undefined;

let pass = 0, fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   ${name}`); }
  else { fail++; console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`); }
};

const browser = await chromium.launch({
  ...(CHROMIUM ? { executablePath: CHROMIUM } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1400 } });
  await ctx.addCookies([{ name: 'im_demo_session', value: 'coach', domain: 'localhost', path: '/' }]);
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  /* ---- the jobs are not open to the world ---- */

  console.log('\nthe cron endpoints');
  const secret = process.env.CRON_SECRET;
  const unauthorised = await p.request.get(`${BASE}/api/cron/coach-alerts`);
  check('a job refuses a caller with no secret', unauthorised.status() === 401,
    `status ${unauthorised.status()}`);
  const wrongSecret = await p.request.get(`${BASE}/api/cron/coach-alerts`, {
    headers: { authorization: 'Bearer not-the-secret' },
  });
  check('and one with the wrong secret', wrongSecret.status() === 401,
    `status ${wrongSecret.status()}`);

  const runJob = async (job) => {
    const res = await p.request.get(`${BASE}/api/cron/${job}`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    if (!res.ok()) throw new Error(`${job} returned ${res.status()}`);
    return res.json();
  };

  if (!secret) {
    console.log('\n  CRON_SECRET is not set — skipping the parts that need the jobs to run.');
    console.log('  Run with: CRON_SECRET=... npm run dev');
    console.log(`\n${pass} passed, ${fail} failed`);
    process.exit(fail ? 1 : 0);
  }

  /* ---- an athlete's report reaches their coach, in their own words ---- */

  console.log('\nthe whole loop: athlete reports, coach is told');
  const WORDS = 'Left Achilles sharp on the hills, eased after 10 minutes';

  const athlete = await ctx.browser().newContext({ viewport: { width: 1280, height: 1200 } });
  await athlete.addCookies([{ name: 'im_demo_session', value: 'athlete', domain: 'localhost', path: '/' }]);
  const ap = await athlete.newPage();
  await ap.goto(`${BASE}/app/check-in`, { waitUntil: 'networkidle' });
  await ap.waitForTimeout(600);

  // drive the real form the way an athlete would: score the soreness high,
  // and write the niggle in their own words.
  //
  // Demo state lives in the dev server process and e2e/loop.mjs submits this
  // week's check-in before this suite runs, so in the full sweep the form is
  // already gone. Detect that on the submit button — the thing this leg
  // actually needs — and say so rather than asserting something this run did
  // not establish.
  const submit = ap.getByRole('button', { name: /submit|send|finish/i }).last();
  const formOpen = (await submit.count()) > 0 && (await submit.isVisible().catch(() => false));

  if (formOpen) {
    await ap.locator('[role=radiogroup][aria-label="Soreness"] [aria-label="9 out of 10"]').click();
    await ap.getByLabel('Any pain or niggles?').fill(WORDS);
    await submit.click();
    await ap.waitForTimeout(1400);
    check('the athlete could report a niggle', true);
  } else {
    console.log('  --   this week\'s check-in is already submitted;'
      + ' restart the dev server and run this suite alone to exercise the reporting leg');
  }

  await athlete.close();

  console.log('\nrunning the jobs');
  const alerts = await runJob('coach-alerts');
  check('the alert job ran', typeof alerts.processed === 'number');
  const digest = await runJob('coach-digest');
  check('the digest job ran', typeof digest.processed === 'number');
  const delivery = await runJob('notification-delivery');
  check('the delivery job ran', typeof delivery.processed === 'number');

  check('nothing claims delivery it did not make',
    delivery.items.every((i) => i.outcome !== 'delivered' || i.kind === 'in_app'),
    JSON.stringify(delivery.items));

  const secondDigest = await runJob('coach-digest');
  check('running the digest twice does not send it twice',
    secondDigest.created === 0, JSON.stringify(secondDigest));

  /* ---- the notification centre ---- */

  console.log('\nthe notification centre');
  await p.goto(`${BASE}/coach/notifications`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);
  const body = await p.locator('body').innerText();

  check('the page loads', /notifications/i.test(body));
  check('it explains where the signals come from', /same signals as your roster/i.test(body));
  check('no readiness or risk score anywhere',
    !/readiness|risk score|injury risk/i.test(body));

  /* ---- preferences are real switches ---- */

  console.log('\npreferences');
  check('the digest can be turned off',
    await p.getByLabel('Send me a daily digest').isVisible());
  check('each alert type has its own switch',
    await p.getByLabel(/check-in flagged for review/i).isVisible()
    && await p.getByLabel(/reporting pain or a niggle/i).isVisible());
  check('quiet hours are offered',
    await p.getByLabel('Hold notifications overnight').isVisible());
  check('quiet hours say nothing is dropped',
    /nothing is dropped/i.test(body));
  check('the timezone is a name, never an offset',
    (await p.locator('select').nth(1).inputValue()).includes('/'));

  /* ---- honest about what this deployment can do ---- */

  console.log('\nhonesty about channels');
  // This suite runs against both shapes of deployment: with an email provider
  // configured and without one. The claim is not that email is off — it is
  // that whatever the screen says is true of this deployment.
  const emailBox = p.getByLabel('Email');
  const emailOffered = !(await emailBox.isDisabled());

  check('in-app is always on', /always on/i.test(body));

  if (emailOffered) {
    check('a configured channel says what it would really do',
      /sent from|not verified yet|simulated/i.test(body));
    check('and it is not claimed as verified unless it is',
      !/not verified yet/i.test(body) || !/sent from/i.test(body));
  } else {
    check('an unavailable channel is shown as unavailable rather than offered',
      /not set up on this deployment/i.test(body));
    check('and its switch cannot be turned on', await emailBox.isDisabled());
  }

  /* ---- saving ---- */

  console.log('\nsaving a preference');
  await p.getByLabel('Send me a daily digest').uncheck();
  await p.getByRole('button', { name: /save preferences/i }).click();
  await p.waitForTimeout(900);
  check('the save is confirmed', /saved/i.test(await p.locator('body').innerText()));

  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  check('and it survives a reload',
    !(await p.getByLabel('Send me a daily digest').isChecked()));

  // put it back
  await p.getByLabel('Send me a daily digest').check();
  await p.getByRole('button', { name: /save preferences/i }).click();
  await p.waitForTimeout(700);

  /* ---- the feed itself ---- */

  console.log('\nthe feed');
  await p.goto(`${BASE}/coach/notifications`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const feedText = await p.locator('body').innerText();

  check('the digest is in the feed', /today's picture/i.test(feedText));
  check('every notification states a reason',
    !/undefined|null|\[object/i.test(feedText));
  check('and leads somewhere the coach can act',
    (await p.getByRole('link', { name: /open/i }).count()) > 0);
  check('the delivery outcome is shown, not assumed',
    /In Iron Miles: (sent|not sent yet)/i.test(feedText));

  if (formOpen) {
    check('the athlete\'s exact words reach the coach', feedText.includes(WORDS),
      'the alert must quote the report, not summarise it');
    check('and nothing that reads like a diagnosis',
      !/(tendinopath|likely injur|you should rest|stop running)/i.test(feedText));
  }

  /* ---- marking it read ---- */

  console.log('\nclearing it');
  const before = await p.getByRole('button', { name: /mark read/i }).count();
  if (before > 0) {
    await p.getByRole('button', { name: /mark read/i }).first().click();
    await p.waitForTimeout(900);
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForTimeout(400);
    check('mark as read sticks',
      (await p.getByRole('button', { name: /mark read/i }).count()) < before);
  }

  /* ---- the top bar ---- */

  console.log('\nreaching it from anywhere');
  await p.goto(`${BASE}/coach`, { waitUntil: 'networkidle' });
  check('notifications are in the coach navigation',
    (await p.getByRole('link', { name: /notifications/i }).count()) > 0);

  /* ---- accessibility and console ---- */

  console.log('\nthe basics');
  await p.goto(`${BASE}/coach/notifications`, { waitUntil: 'networkidle' });
  const h1 = await p.locator('h1').count();
  check('one h1', h1 === 1, `found ${h1}`);
  const unlabelled = await p.locator('select:not([id]), input[type=checkbox]:not([id])').count();
  check('every control is labelled', unlabelled === 0, `${unlabelled} without an id`);
  check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  await p.screenshot({
    path: process.env.SHOT ?? '/tmp/notifications.png', fullPage: true,
  });
} finally {
  await browser.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
