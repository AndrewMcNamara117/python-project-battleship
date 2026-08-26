/**
 * The library loop, driven through the real UI against the demo adapter.
 *
 * CREATE ONCE → SAVE → REUSE → ADAPT → PRESCRIBE. The SQL side is covered by
 * supabase/test/libraries.test.mjs; this proves the screens a coach actually
 * touches do the same thing, and that what lands on the athlete's calendar is
 * a copy rather than a live link.
 *
 *   BASE_URL=http://localhost:3000 node e2e/library.mjs
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

const NAME = `Threshold Test ${Date.now().toString().slice(-5)}`;

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addCookies([{ name: 'im_demo_session', value: 'coach', domain: 'localhost', path: '/' }]);
  const p = await ctx.newPage();

  /* ---- the library renders from the database, not from constants ---- */

  await p.goto(`${BASE}/coach/workouts`, { waitUntil: 'networkidle' });
  const cards = await p.locator('h3').allTextContents();
  check('the workout library lists sessions', cards.length >= 10, `saw ${cards.length}`);
  check('shipped content is labelled', (await p.getByText('Iron Miles', { exact: true }).count()) > 0);

  /* ---- search narrows through the URL ---- */

  await p.locator('#library-search').fill('threshold');
  await p.waitForTimeout(900);
  check('search puts the term in the URL', p.url().includes('q=threshold'), p.url());
  const narrowed = await p.locator('h3').allTextContents();
  check('search narrows the list', narrowed.length > 0 && narrowed.length < cards.length,
    `${cards.length} → ${narrowed.length}`);

  /* ---- CREATE ---- */

  await p.goto(`${BASE}/coach/workouts`, { waitUntil: 'networkidle' });
  await p.getByRole('button', { name: /New session/i }).click();
  await p.waitForSelector('text=/New session/');
  // by label: the filter bar's search box is also an input on this page
  await p.getByLabel('Name', { exact: true }).fill(NAME);
  await p.getByLabel('Distance (km)').fill('12');
  await p.getByRole('button', { name: /Save to library/i }).click();
  await p.waitForTimeout(1500);

  await p.goto(`${BASE}/coach/workouts`, { waitUntil: 'networkidle' });
  check('a new session is saved to the library',
    (await p.getByText(NAME, { exact: true }).count()) > 0);
  const mine = await p.locator(`text=${NAME}`).first()
    .locator('xpath=ancestor::*[contains(@class,"im-panel")][1]').innerText();
  check('and it belongs to the coach who wrote it', /Yours/i.test(mine), mine.slice(0, 120));

  /* ---- system content offers no edit control ---- */

  const systemCard = p.locator('.im-panel').filter({ hasText: 'Iron Miles' }).first();
  const systemButtons = await systemCard.getByRole('button').allTextContents();
  check('shipped sessions offer duplicate but not edit',
    systemButtons.some((b) => /Duplicate/i.test(b)) && !systemButtons.some((b) => /^Edit$/i.test(b)),
    systemButtons.join(', '));

  /* ---- PRESCRIBE, and prove it is a copy ---- */

  const target = new Date();
  target.setUTCDate(target.getUTCDate() + 21);
  const targetISO = target.toISOString().slice(0, 10);

  const myCard = p.locator('.im-panel').filter({ hasText: NAME }).first();
  await myCard.getByRole('button', { name: /Add to athlete/i }).click();
  await myCard.locator('input[type="date"]').fill(targetISO);
  await myCard.getByRole('button', { name: /Prescribe/i }).click();
  await p.waitForSelector(`text=/${targetISO}|not on your roster|did not save/i`, { timeout: 20000 });
  const outcome = await p.locator(`text=/Added to|Replaced|not on your roster|did not save/i`).first().innerText();
  check('prescribing reports what happened', /Added to|Replaced/i.test(outcome), outcome);
  check('and says so when it replaced an existing session',
    !/Replaced/i.test(outcome) || outcome.includes(targetISO), outcome);

  const athleteCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await athleteCtx.addCookies([{ name: 'im_demo_session', value: 'athlete', domain: 'localhost', path: '/' }]);
  const ap = await athleteCtx.newPage();
  const seenByAthlete = async () => {
    // the calendar paints one month at a time; page forward until the target
    // month is on screen rather than assuming it starts there
    await ap.goto(`${BASE}/app/calendar`, { waitUntil: 'networkidle' });
    await ap.waitForTimeout(800);
    for (let i = 0; i < 4; i++) {
      if ((await ap.getByText(NAME, { exact: false }).count()) > 0) return true;
      const next = ap.getByRole('button', { name: /Next period|›|→/i }).first();
      if (!(await next.count())) break;
      await next.click();
      await ap.waitForTimeout(500);
    }
    return (await ap.getByText(NAME, { exact: false }).count()) > 0;
  };
  check('the athlete sees the prescribed session', await seenByAthlete());

  /* ---- ADAPT the template; the prescription must not move ---- */

  await p.goto(`${BASE}/coach/workouts?q=${encodeURIComponent(NAME.split(' ')[0])}`, { waitUntil: 'networkidle' });
  const editCard = p.locator('.im-panel').filter({ hasText: NAME }).first();
  await editCard.getByRole('button', { name: /^Edit$/i }).click();
  await p.waitForSelector('text=/Edit session/');
  await p.getByLabel('Name', { exact: true }).fill(`${NAME} REWRITTEN`);
  await p.getByRole('button', { name: /Save changes/i }).click();
  await p.waitForTimeout(1500);

  const stillThere = await seenByAthlete();
  check('editing the template does not rename the athlete\'s session',
    (await ap.getByText(`${NAME} REWRITTEN`, { exact: false }).count()) === 0);
  check('the athlete still sees what they were given', stillThere);

  /* ---- ARCHIVE keeps the prescription ---- */

  await p.goto(`${BASE}/coach/workouts?q=${encodeURIComponent(NAME.split(' ')[0])}`, { waitUntil: 'networkidle' });
  const archiveCard = p.locator('.im-panel').filter({ hasText: NAME }).first();
  await archiveCard.getByRole('button', { name: /Archive/i }).click();
  await p.waitForTimeout(1500);

  await p.goto(`${BASE}/coach/workouts?q=${encodeURIComponent(NAME.split(' ')[0])}`, { waitUntil: 'networkidle' });
  check('an archived session leaves the picker',
    (await p.getByText(`${NAME} REWRITTEN`, { exact: false }).count()) === 0);
  await p.goto(`${BASE}/coach/workouts?q=${encodeURIComponent(NAME.split(' ')[0])}&archived=1`, { waitUntil: 'networkidle' });
  check('but is still there when asked for',
    (await p.getByText(`${NAME} REWRITTEN`, { exact: false }).count()) > 0);

  check('and archiving does not remove the athlete\'s prescribed session', await seenByAthlete());

  /* ---- the S&C library, and what an athlete may not see ---- */

  await p.goto(`${BASE}/coach/strength`, { waitUntil: 'networkidle' });
  check('the strength library lists sessions and movements',
    (await p.getByRole('heading', { name: 'Sessions' }).count()) > 0 &&
    (await p.getByRole('heading', { name: 'Movements' }).count()) > 0);
  check('strength sessions list their exercises in order',
    (await p.locator('ol li').count()) > 0);

  await ap.goto(`${BASE}/app/strength`, { waitUntil: 'networkidle' });
  const athleteText = await ap.locator('body').innerText();
  check('the athlete page no longer shows a template catalogue',
    !/Available templates|Your coach assigns these/i.test(athleteText));

  /* ---- mobile ---- */

  const mobile = await browser.newContext({ viewport: { width: 360, height: 780 } });
  await mobile.addCookies([{ name: 'im_demo_session', value: 'coach', domain: 'localhost', path: '/' }]);
  const mp = await mobile.newPage();
  for (const path of ['/coach/workouts', '/coach/strength']) {
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
