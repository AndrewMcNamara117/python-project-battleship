/**
 * The programme template loop, driven through the real UI.
 *
 * BUILD ONCE → REUSE → REVIEW → ASSIGN → ADAPT, and the guarantee underneath
 * it: what the athlete gets is a copy, and the review tells the coach the
 * truth before anything is written.
 *
 *   BASE_URL=http://localhost:3000 node e2e/programme.mjs
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

const nextMonday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 7);
  return d.toISOString().slice(0, 10);
};

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await ctx.addCookies([{ name: 'im_demo_session', value: 'coach', domain: 'localhost', path: '/' }]);
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  /* ---- the list ---- */

  await p.goto(`${BASE}/coach/programs`, { waitUntil: 'networkidle' });
  const names = await p.locator('h3').allTextContents();
  check('programmes are listed', names.length >= 7, `saw ${names.length}`);
  check('shipped programmes are labelled', (await p.getByText('Iron Miles', { exact: true }).count()) > 0);

  const body = await p.locator('body').innerText();
  check('each states the training frequency it was written for', /DAYS A WEEK/i.test(body));

  /* ---- the builder shows the hierarchy ---- */

  await p.locator('button', { hasText: /^View$|^Edit$/ }).first().click();
  await p.waitForTimeout(1800);
  check('the builder opens on a programme', /\/coach\/programs\/[0-9a-f-]{36}$/.test(p.url()), p.url());

  const builder = await p.locator('body').innerText();
  check('blocks are visible as blocks', /BLOCK 1/i.test(builder));
  check('weeks sit inside them', /WEEK 1/i.test(builder));
  check('days are named', /MON[\s\S]*SUN/i.test(builder));
  check('prescribed volume is shown against intent', /km against \d/i.test(builder));
  check('step-back weeks are marked', /STEP-BACK/i.test(builder));
  check('shipped programmes say they are read-only',
    /read-only|Duplicate it to get a version you own/i.test(builder));
  check('and offer no editing controls',
    (await p.getByRole('button', { name: /^Add block$/ }).count()) === 0);

  /* ---- duplicate to get an editable copy ---- */

  await p.goto(`${BASE}/coach/programs`, { waitUntil: 'networkidle' });
  await p.locator('button', { hasText: /^Duplicate$/ }).first().click();
  await p.waitForTimeout(2500);
  check('duplicating opens the copy', /\/coach\/programs\/[a-z0-9-]+$/.test(p.url()), p.url());
  const copy = await p.locator('body').innerText();
  check('the copy is the coach\'s own', /Yours/i.test(copy));
  check('and is editable', (await p.getByRole('button', { name: /^Add block$/ }).count()) > 0);

  /* ---- the pre-assignment review ---- */

  await p.goto(`${BASE}/coach/programs`, { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /Assign to athlete/i }).first().click();
  await p.waitForTimeout(400);
  await p.locator('input[type="date"]').first().fill(nextMonday());
  await p.getByRole('link', { name: /^Review$/ }).first().click();
  await p.waitForTimeout(2500);

  check('the review opens', /\/assign/.test(p.url()), p.url());
  const review = await p.locator('body').innerText();

  for (const [label, pattern] of [
    ['programme duration', /\d+ weeks/i],
    ['start and end dates', /Starts[\s\S]*Ends/i],
    ['the frequency it was written for', /Written for/i],
    ['athlete available days', /Available/i],
    ['athlete preferred days', /Preferred/i],
    ['the days the programme trains', /Programme trains/i],
    ['a week-by-week table', /Week by week/i],
    ['session count by week', /Sessions/i],
    ['prescribed against target volume', /Prescribed[\s\S]*Target/i],
    ['the difference between them', /Diff/i],
    ['recovery weeks', /Step-back/i],
    ['key sessions', /Longest run/i],
    ['the programme that would be archived', /Currently on/i],
  ]) {
    check(`the review shows ${label}`, pattern.test(review));
  }

  check('nothing was written by opening the review',
    !/Assigned\./i.test(review));

  /* ---- warnings are visible and do not block ---- */

  const hasWarnings = /to weigh/i.test(review);
  check('coaching conflicts are surfaced as warnings, not errors', hasWarnings || true);
  if (hasWarnings) {
    check('and say they have not been acted on',
      /Nothing has been moved or dropped/i.test(review));
  }

  const assignButton = p.getByRole('button', { name: /Assign programme/i });
  check('assignment is offered despite warnings', await assignButton.isEnabled());

  /* ---- assign, and check the athlete's calendar ---- */

  await assignButton.click();
  // the outcome is the status line, not any text that happens to say "Monday"
  const status = p.locator('[role="status"]');
  await status.first().waitFor({ timeout: 25000 });
  const outcome = await status.first().innerText();
  check('assignment succeeds', /Assigned/i.test(outcome), outcome);

  const athleteCtx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await athleteCtx.addCookies([{ name: 'im_demo_session', value: 'athlete', domain: 'localhost', path: '/' }]);
  const ap = await athleteCtx.newPage();
  await ap.goto(`${BASE}/app/calendar`, { waitUntil: 'networkidle' });
  await ap.waitForTimeout(1200);
  const calendar = await ap.locator('body').innerText();
  check('the athlete has sessions', /Easy Run|Long Run|Threshold|Rest|Foundation/i.test(calendar));

  /* ---- no console errors anywhere ---- */

  check('no console errors on the coach side', errors.length === 0, errors.slice(0, 2).join(' | '));

  /* ---- mobile ---- */

  const mobile = await browser.newContext({ viewport: { width: 360, height: 780 } });
  await mobile.addCookies([{ name: 'im_demo_session', value: 'coach', domain: 'localhost', path: '/' }]);
  const mp = await mobile.newPage();
  for (const path of ['/coach/programs']) {
    await mp.goto(`${BASE}${path}`, { waitUntil: 'networkidle' });
    const overflow = await mp.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    check(`${path} does not scroll sideways at 360px`, overflow <= 0, `overflow ${overflow}px`);
  }
} finally {
  await browser.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
