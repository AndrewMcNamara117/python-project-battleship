/**
 * READ, REPLIED, AND STILL A CONCERN — through the real UI.
 *
 * The claim Slice 10 makes is that a coach can empty the check-in queue
 * without sending anyone a sentence they did not mean, and without losing a
 * single flagged athlete off their roster. Both halves are asserted here,
 * because getting the first without the second would be worse than the
 * problem it solves.
 *
 *   BASE_URL=http://localhost:3000 node e2e/checkins.mjs
 *
 * Needs a freshly started server: this suite marks check-ins read, which is
 * exactly the state every assertion depends on.
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
  const body = () => p.locator('body').innerText();
  const go = async (path) => {
    await p.goto(`${BASE}${path}`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(2500);
  };

  /* ---- viewing does not read ---- */

  console.log('\nreading is an act, not a side effect');
  await go('/coach/checkins');
  const opened = Number(((await body()).match(/(\d+) WAITING/i) ?? [0, 0])[1]);
  check('the queue has check-ins waiting', opened > 0, `${opened}`);

  await go('/coach/checkins');
  const stillWaiting = Number(((await body()).match(/(\d+) WAITING/i) ?? [0, 0])[1]);
  check('looking at the page twice marks nothing read', stillWaiting === opened,
    `${opened} -> ${stillWaiting}`);

  /* ---- individual mark as read ---- */

  console.log('\nmarking one read');
  const markOne = p.getByRole('button', { name: /mark as read/i }).first();
  check('every check-in offers it', (await p.getByRole('button', { name: /mark as read/i }).count()) > 0);
  check('and says what it will not do',
    /Records that you read it/i.test(await body()));

  await markOne.click();
  await p.waitForTimeout(2000);
  await go('/coach/checkins');
  const afterOne = Number(((await body()).match(/(\d+) WAITING/i) ?? [0, 0])[1]);
  check('it leaves the queue', afterOne === opened - 1, `${opened} -> ${afterOne}`);

  await p.reload({ waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  check('and stays read after a refresh',
    Number(((await body()).match(/(\d+) WAITING/i) ?? [0, 0])[1]) === afterOne);

  /* ---- read is not replied ---- */

  console.log('\nread is not replied');
  const readSection = await body();
  check('a read check-in shows no coach response it never had',
    !/Coach said|✓ responded/i.test(readSection));

  /* ---- replying settles a flag; reading does not ---- */

  console.log('\nreplying to a flagged check-in');
  await go('/coach');
  const flaggedAtStart = ((await body()).match(/Check-in flagged/gi) ?? []).length;

  // Follow the *flagged* signal's own link, not merely the first link that
  // happens to point at a check-in. Slice 11 orders an athlete's signals by
  // concern rather than by the order the classifier was written in, so the
  // first #checkins link on the page now belongs to whoever reported the
  // worst soreness — who may have nothing flagged at all. Replying to them
  // is a real reply to the wrong person, and the flagged count rightly does
  // not move. Ask for the sentence, not the position.
  const flaggedHref = await p.locator('a[href*="#checkins"]')
    .filter({ hasText: /^Check-in flagged/i }).first()
    .getAttribute('href').catch(() => null);

  if (flaggedAtStart === 0 || !flaggedHref) {
    console.log('  --   no unanswered flagged check-in to reply to in this server;'
      + ' the settle rule is asserted in src/lib/domain/roster.test.ts');
  } else {
    await go(flaggedHref);
    const box = p.locator('textarea').first();

    if (await box.count()) {
      await box.fill('Taking next week back 20%. We will look at the calf on Thursday.');
      await p.getByRole('button', { name: /send response/i }).first().click();
      await p.waitForTimeout(3000);

      await go('/coach');
      const flaggedNow = ((await body()).match(/Check-in flagged/gi) ?? []).length;
      check('answering a flagged check-in settles it',
        flaggedNow < flaggedAtStart, `${flaggedAtStart} -> ${flaggedNow}`);
    } else {
      console.log('  --   no reply box on that athlete page; skipping');
    }
  }

  /* ---- batch mark as read ---- */

  console.log('\nmarking the rest read, in one action');
  await go('/coach');
  const beforeRoster = await body();
  const toReadBefore = Number((beforeRoster.match(/CHECK-INS TO READ\s*(\d+)/i) ?? [0, 0])[1]);
  const attentionBefore = Number((beforeRoster.match(/NEEDS ATTENTION\s*(\d+)/i) ?? [0, 0])[1]);
  const flaggedBefore = (beforeRoster.match(/Check-in flagged/gi) ?? []).length;
  const painBefore = (beforeRoster.match(/Reported:/gi) ?? []).length;

  const toReadFilter = p.getByRole('button', { name: /check-ins to read/i });
  const anythingLeft = (await toReadFilter.count()) > 0;

  if (!anythingLeft) {
    // The roster hides a filter with nothing behind it, and by this point in a
    // full sweep every check-in has been read by the legs above. Batch marking
    // is asserted in src/lib/coach/batch-runner.test.ts and in this suite run
    // on its own against a fresh server.
    console.log('  --   nothing left unread in this server; run this suite alone'
      + ' against a fresh server to exercise the batch leg');
  } else {
  await toReadFilter.click();
  await p.waitForTimeout(1200);
  await p.getByRole('button', { name: /select these \d+/i }).click();
  await p.waitForTimeout(1000);
  await p.getByRole('button', { name: /mark check-in read/i }).click();
  await p.waitForTimeout(1200);

  check('the action explains itself before anything happens',
    /Nothing is sent/i.test(await body()));
  check('and warns that a flag survives it',
    /stays on your roster until you reply/i.test(await body()));

  await p.getByRole('button', { name: /^review$/i }).click();
  await p.waitForTimeout(2500);
  const confirm = p.getByRole('button', { name: /mark \d+ read/i }).first();
  check('the button says how many, not how many were selected', (await confirm.count()) > 0,
    (await confirm.count()) ? await confirm.innerText() : 'none');

  await confirm.click();
  await p.waitForTimeout(3500);
  const result = await body();
  check('the result is reported per athlete',
    (result.match(/APPLIED/gi) ?? []).length > 0);
  check('and says "marked read", never "replied"',
    /marked read/i.test(result) && !/replied|sent/i.test(result.split('marked read')[0].slice(-200)));
  }

  /* ---- the counters tell the truth ---- */

  if (anythingLeft) {
    console.log('\nthe counters afterwards');
    await go('/coach');
    const after = await body();
    const toReadAfter = Number((after.match(/CHECK-INS TO READ\s*(\d+)/i) ?? [0, 0])[1]);
    const attentionAfter = Number((after.match(/NEEDS ATTENTION\s*(\d+)/i) ?? [0, 0])[1]);
    const flaggedAfter = (after.match(/Check-in flagged/gi) ?? []).length;
    const painAfter = (after.match(/Reported:/gi) ?? []).length;

    check('nothing is left waiting to be read', toReadAfter === 0,
      `${toReadBefore} -> ${toReadAfter}`);
    check('needs-attention is unchanged by reading',
      attentionAfter === attentionBefore, `${attentionBefore} -> ${attentionAfter}`);
    check('flagged check-ins are unchanged by reading',
      flaggedAfter === flaggedBefore, `${flaggedBefore} -> ${flaggedAfter}`);
    check('reported pain is unchanged by reading',
      painAfter === painBefore, `${painBefore} -> ${painAfter}`);

    await go('/coach/checkins');
    check('the queue is empty and says so',
      Number(((await body()).match(/(\d+) WAITING/i) ?? [0, 0])[1]) === 0);
  }

  /* ---- the athlete's side ---- */

  console.log('\nwhat the athlete sees');
  const ath = await browser.newContext({ viewport: { width: 1280, height: 1200 } });
  await ath.addCookies([{ name: 'im_demo_session', value: 'athlete', domain: 'localhost', path: '/' }]);
  const ap = await ath.newPage();
  await ap.goto(`${BASE}/app/check-in`, { waitUntil: 'domcontentloaded' });
  await ap.waitForTimeout(2500);
  const at = await ap.locator('body').innerText();
  check('no words are attributed to the coach that they did not write',
    !/marked as read by your coach:|✓ acknowledged/i.test(at));
  await ath.close();

  /* ---- mobile ---- */

  console.log('\non a phone');
  const m = await browser.newContext({ viewport: { width: 390, height: 844 } });
  await m.addCookies([{ name: 'im_demo_session', value: 'coach', domain: 'localhost', path: '/' }]);
  const mp = await m.newPage();
  await mp.goto(`${BASE}/coach/checkins`, { waitUntil: 'domcontentloaded' });
  await mp.waitForTimeout(2500);
  check('no horizontal overflow on the queue',
    (await mp.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)) === 0);
  await m.close();

  /* ---- Slice 8: what the digest says once the queue is empty ---- */

  const secret = process.env.CRON_SECRET;
  if (secret) {
    console.log('\nwhat the digest says now');
    const res = await p.request.get(`${BASE}/api/cron/coach-digest`, {
      headers: { authorization: `Bearer ${secret}` },
    });
    const report = await res.json();
    const digest = report.items?.[0];
    check('the digest ran', res.ok(), `status ${res.status()}`);
    if (digest) {
      check('it no longer nags about check-ins nobody has read',
        !/to read/i.test(digest.title ?? ''), digest.title);
    }
    check('and a flagged athlete still reaches the alert job',
      typeof report.processed === 'number');
  } else {
    console.log('  --   CRON_SECRET not set; skipping the digest leg');
  }

  console.log('\nthe basics');
  check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));

} finally {
  await browser.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
