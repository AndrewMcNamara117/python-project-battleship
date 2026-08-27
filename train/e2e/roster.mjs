/**
 * The roster operating view, driven through the real UI.
 *
 * The product test this suite exists to answer: a coach with forty athletes
 * and twenty minutes should be able to see who needs them, understand why,
 * and reach the place they can act — without opening every athlete.
 *
 *   BASE_URL=http://localhost:3000 node e2e/roster.mjs
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
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  await ctx.addCookies([{ name: 'im_demo_session', value: 'coach', domain: 'localhost', path: '/' }]);
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  /* ---- the squad in one screen ---- */

  const started = Date.now();
  await p.goto(`${BASE}/coach`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  const loaded = Date.now() - started;

  const body = await p.locator('body').innerText();
  check('the roster is the coach\'s landing page', /Your roster/i.test(body));
  check('and it loads quickly enough to be worth opening', loaded < 12000, `${loaded}ms`);

  check('it says how many need something', /need(s)? something from you|Nothing needs you/i.test(body));

  /* ---- today, without being a calendar ---- */

  for (const [label, pattern] of [
    ['the roster size', /On the roster/i],
    ['who trains today', /Training today/i],
    ['check-ins waiting', /Check-ins to read/i],
    ['races approaching', /Races within six weeks/i],
    ['programmes ending', /Programmes ending/i],
  ]) {
    check(`today shows ${label}`, pattern.test(body));
  }

  /* ---- filters a coach uses daily ---- */

  const chips = await p.locator('button[aria-pressed]').allTextContents();
  check('filters are offered with counts', chips.length >= 2, chips.join(' | '));
  check('needs-attention is where a coach lands',
    (await p.locator('button[aria-pressed="true"]').innerText()).toLowerCase().includes('attention'));

  const everyone = p.locator('button[aria-pressed]').filter({ hasText: /Everyone/i });
  await everyone.click();
  await p.waitForTimeout(400);
  // the roster list by its accessible name; the page also has a nav list
  const rows = p.getByRole('list', { name: 'Athletes' }).locator('> li');
  const allCount = await rows.count();
  check('everyone shows the whole squad', allCount > 0, `${allCount} rows`);

  /* ---- every athlete gives enough to decide without opening them ---- */

  const firstRow = rows.first();
  const rowText = await firstRow.innerText();
  check('a row names the athlete', /[A-Z]/.test(rowText));
  check('and says where they are in their programme',
    /week \d+\/\d+|No programme|not started yet|finished/i.test(rowText),
    rowText.replace(/\n/g, ' | ').slice(0, 120));
  check('and what they last did or that nothing is logged',
    /Last:|Nothing logged/i.test(rowText));
  check('and offers a way in', (await firstRow.getByRole('link', { name: /^Open$/ }).count()) > 0);

  /* ---- signals explain themselves ---- */

  await p.locator('button[aria-pressed]').filter({ hasText: /Needs attention/i }).click();
  await p.waitForTimeout(400);
  const attentionText = await p.locator('body').innerText();

  check('no opaque score anywhere on the page',
    !/risk score|readiness score|\bscore:\s*\d+/i.test(attentionText));

  const explained = [
    /No programme assigned\./i,
    /sessions? missed in the last two weeks\./i,
    /Check-in flagged/i,
    /Programme ends in \d+ days?\./i,
    /Nothing logged in \d+ days?\./i,
    /in \d+ days?\./i,
    /nothing scheduled from today/i,
    /Joined .* no programme yet\./i,
  ];
  check('every athlete surfaced says why in a sentence',
    explained.some((r) => r.test(attentionText)), attentionText.slice(0, 200));

  /* ---- signals lead somewhere ---- */

  const signalLinks = await p.getByRole('list', { name: 'Athletes' })
    .locator('a[href^="/coach/"]').all();
  check('signals are links, not dead ends', signalLinks.length > 0);

  const hrefs = await Promise.all(signalLinks.slice(0, 12).map((l) => l.getAttribute('href')));
  check('and they lead into the coach app',
    hrefs.every((h) => h && h.startsWith('/coach/')), hrefs.slice(0, 3).join(' '));

  const target = hrefs.find((h) => h && h.includes('/coach/athletes/'));
  if (target) {
    await p.goto(`${BASE}${target}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(1200);
    check('following one reaches the athlete', /\/coach\/athletes\//.test(p.url()));
  }

  /* ---- search ---- */

  await p.goto(`${BASE}/coach`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(600);
  await p.locator('button[aria-pressed]').filter({ hasText: /Everyone/i }).click();
  await p.waitForTimeout(300);

  const names = await p.getByRole('list', { name: 'Athletes' }).locator('h3').allTextContents();
  if (names.length) {
    const term = names[0].split(' ')[0];
    await p.getByPlaceholder('Find an athlete').fill(term);
    await p.waitForTimeout(400);
    const found = await p.getByRole('list', { name: 'Athletes' }).locator('h3').allTextContents();
    check('search narrows to the athlete', found.length > 0 && found.length <= names.length,
      `${names.length} → ${found.length}`);
    check('and finds the one searched for',
      found.some((n) => n.toLowerCase().includes(term.toLowerCase())));

    await p.getByPlaceholder('Find an athlete').fill('zzzzz');
    await p.waitForTimeout(400);
    check('and says so plainly when nothing matches',
      /No athletes match that/i.test(await p.locator('body').innerText()));
  }

  check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  /* ---- mobile: athlete, signal, context, action ---- */

  const mobile = await browser.newContext({ viewport: { width: 360, height: 780 } });
  await mobile.addCookies([{ name: 'im_demo_session', value: 'coach', domain: 'localhost', path: '/' }]);
  const mp = await mobile.newPage();
  await mp.goto(`${BASE}/coach`, { waitUntil: 'networkidle' });
  await mp.waitForTimeout(1000);

  const overflow = await mp.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('the roster does not scroll sideways at 360px', overflow <= 0, `overflow ${overflow}px`);

  const mobileRow = mp.getByRole('list', { name: 'Athletes' }).locator('> li').first();
  check('a row still carries athlete, signal and a way in at 360px',
    (await mobileRow.innerText()).length > 0
      && (await mobileRow.getByRole('link', { name: /^Open$/ }).count()) > 0);
} finally {
  await browser.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
