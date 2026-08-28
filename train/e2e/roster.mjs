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
    (await p.locator('button[aria-pressed="true"]').first().innerText()).toLowerCase().includes('attention'));

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
    /nothing scheduled from today/i,
    /Joined .* no programme yet\./i,
    // one problem several athletes share is stated once, in the band
    /\d+ athletes with nothing scheduled\./i,
    /\d+ programmes end within the month\./i,
    /\d+ athletes missing training\./i,
    /\d+ athletes reported pain or soreness\./i,
  ];
  check('everything surfaced says why in a sentence',
    explained.some((r) => r.test(attentionText)), attentionText.replace(/\n/g, ' | ').slice(0, 220));

  /* ---- the week's workload, stated without hiding anyone ---- */

  // Slice 11. The old model grouped an athlete only when a single signal was
  // their whole story and then removed them from the list, so at forty
  // athletes it produced almost no groups and a wall of rows. The band states
  // every concern up front; the list underneath still holds everyone.
  const band = p.locator('li').filter({ has: p.getByRole('button', { name: /^Select \d+$/ }) });
  const bandRows = await band.count();
  check('the week\'s workload is stated on arrival', bandRows > 0, `${bandRows} rows`);
  // How many concerns appear depends on the squad, and a quiet squad with one
  // shared problem is a correct answer, not a failure. What must always hold
  // is that a stated concern is one several athletes share.
  const bandCounts = [];
  for (let i = 0; i < bandRows; i++) {
    bandCounts.push(Number(((await band.nth(i).innerText()).match(/(\d+)/) ?? [0, 0])[1]));
  }
  check('and never states a concern only one or two athletes have',
    bandCounts.every((n) => n >= 3), bandCounts.join(', '));

  const listRows = () => p.getByRole('list', { name: 'Athletes' }).locator('> li').count();

  let truthful = 0, mismatched = [];
  for (let i = 0; i < bandRows; i++) {
    const row = band.nth(i);
    const text = await row.innerText();
    const claimed = Number((text.match(/(\d+)/) ?? [0, 0])[1]);

    // the promise: the number on the row is the number of athletes behind it
    await row.locator('button[aria-pressed]').click();
    await p.waitForTimeout(350);
    const shown = await listRows();
    if (shown === claimed) truthful++;
    else mismatched.push(`${text.split('\n')[0]} claims ${claimed}, shows ${shown}`);
    await row.locator('button[aria-pressed]').click();
    await p.waitForTimeout(300);
  }
  check('every count is the count of the list it opens', truthful === bandRows,
    mismatched.join(' · '));

  // An athlete in two concerns must be counted in both. The band states how
  // many of a row's athletes need the coach elsewhere too — so open each row
  // and count them on the page. This is the claim that would break if the
  // band ever went back to filing an athlete under a single problem.
  const CONCERN = /(Pain or soreness|Check-ins to read|Missed training|Programme ending|Nothing scheduled|Race approaching)/i;
  let overlapAgrees = 0, overlapChecked = 0, overlapDetail = [];

  for (let i = 0; i < bandRows; i++) {
    const row = band.nth(i);
    const rowText = await row.innerText();
    const claimed = Number((rowText.match(/(\d+) also elsewhere/) ?? [0, 0])[1]);

    await row.locator('button[aria-pressed]').click();
    await p.waitForTimeout(350);
    const texts = await p.getByRole('list', { name: 'Athletes' }).locator('> li').allInnerTexts();
    // an athlete needs the coach elsewhere when their row names more than one
    // concern — the marker, not the programme line, which also uses a middot
    const actual = texts.filter((t) => {
      const marker = t.split('\n')[1] ?? '';
      return CONCERN.test(marker) && / · /.test(marker);
    }).length;

    overlapChecked++;
    if (actual === claimed) overlapAgrees++;
    else overlapDetail.push(`${rowText.split('\n')[0]}: says ${claimed}, list shows ${actual}`);

    await row.locator('button[aria-pressed]').click();
    await p.waitForTimeout(300);
  }
  check('the overlap each row reports is the overlap in its own list',
    overlapAgrees === overlapChecked, overlapDetail.join(' · '));

  // the group's action is Slice 9's, not a new one
  const first = band.first();
  await first.getByRole('button', { name: /^Select \d+$/ }).click();
  await p.waitForTimeout(400);
  const barText = await p.locator('body').innerText();
  check('selecting a concern fills the existing batch bar', /\d+ selected/i.test(barText));
  const claimed = Number(((await first.innerText()).match(/(\d+)/) ?? [0, 0])[1]);
  const selected = Number((barText.match(/(\d+) selected/i) ?? [0, 0])[1]);
  check('and selects exactly the athletes it counted', selected === claimed,
    `${selected} vs ${claimed}`);
  await p.getByRole('button', { name: /^Clear$/i }).first().click();
  await p.waitForTimeout(300);

  /* ---- one athlete, one row, and the rest one keystroke away ---- */

  console.log('\nprogressive disclosure');
  await p.locator('button[aria-pressed]').filter({ hasText: /Needs attention/i }).first().click();
  await p.waitForTimeout(400);

  const cards = p.getByRole('list', { name: 'Athletes' }).locator('> li');
  const withMore = cards.filter({ has: p.getByRole('button', { name: /\d+ more/i }) });
  const busy = await withMore.count();

  if (busy === 0) {
    check('nobody here has more to say than fits on their row', true,
      'a quiet squad is a correct answer');
  } else {
    // Pin to the panel id: the button's label changes when it opens, so a
    // locator matching "N more" silently starts resolving to a DIFFERENT
    // card and measures the wrong one.
    const card = withMore.first();
    const firstPanel = await card.getByRole('button', { name: /\d+ more/i })
      .getAttribute('aria-controls');
    const toggle = p.locator(`button[aria-controls="${firstPanel}"]`);
    const row = p.getByRole('list', { name: 'Athletes' }).locator('> li')
      .filter({ has: p.locator(`#${firstPanel}`) });

    check('a busy athlete says how much more there is',
      /\d+ more/.test(await toggle.innerText()), await toggle.innerText());
    check('and the control is a real button with its state',
      await toggle.getAttribute('aria-expanded') === 'false');
    check('that names the panel it opens', Boolean(firstPanel), String(firstPanel));

    const before = (await row.innerText()).split('\n').filter(Boolean).length;
    await toggle.click();
    await p.waitForTimeout(350);
    const after = (await row.innerText()).split('\n').filter(Boolean).length;

    check('opening it adds the rest of their story', after > before, `${before} -> ${after} lines`);
    check('and says so', await toggle.getAttribute('aria-expanded') === 'true');
    check('the panel is no longer hidden',
      (await p.locator(`#${firstPanel}`).getAttribute('hidden')) === null);

    // Nothing is lost by opening: every line that was there is still there.
    check('opening never removes a line that was already showing',
      after >= before, `${before} -> ${after}`);

    await toggle.click();
    await p.waitForTimeout(300);
    check('and it closes again', await toggle.getAttribute('aria-expanded') === 'false');
  }

  // The facts a canonical signal replaced are still there, word for word —
  // asserted on an athlete who actually HAS a consolidated concern. Not every
  // squad has one, and an athlete at 96% adherence correctly has none.
  const adherenceCard = cards.filter({
    hasText: /Nothing logged (yet, with sessions prescribed|in \d+ days)\.|\d+ sessions missed in the last two weeks\./,
  }).first();
  if (await adherenceCard.count()) {
    const openBtn = adherenceCard.getByRole('button', { name: /\d+ more/i });
    if (await openBtn.count()) {
      const id = await openBtn.getAttribute('aria-controls');
      await p.locator(`button[aria-controls="${id}"]`).click();
      await p.waitForTimeout(350);
      const full = await p.getByRole('list', { name: 'Athletes' }).locator('> li')
        .filter({ has: p.locator(`#${id}`) }).innerText();
      const facts = [
        /Nothing logged (yet, with sessions prescribed|in \d+ days)\./,
        /\d+ sessions missed in the last two weeks\./,
        /Missed [^\n]+\./,
      ].filter((re) => re.test(full)).length;
      check('the facts behind a consolidated concern survive it, word for word',
        facts >= 2, `only ${facts} of the three sentences found`);
      await p.locator(`button[aria-controls="${id}"]`).click();
      await p.waitForTimeout(250);
    } else {
      check('an athlete whose whole story fits needs no disclosure', true);
    }
  } else {
    check('no athlete here is missing training, so nothing was consolidated', true);
  }

  // nothing is said twice on a collapsed row
  const collapsed = await cards.allInnerTexts();
  const repeats = collapsed.filter((t) => {
    const lines = t.split('\n').map((l) => l.trim()).filter(Boolean);
    return new Set(lines).size !== lines.length;
  });
  check('no collapsed row says the same line twice', repeats.length === 0,
    `${repeats.length} rows repeat themselves`);

  /* ---- signals lead somewhere ---- */

  const signalLinks = await p.locator('main a[href^="/coach/"]').all();
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

  // the default view groups a shared problem into one line; the individual
  // rows are what this check is about
  await mp.locator('button[aria-pressed]').filter({ hasText: /Everyone/i }).click();
  await mp.waitForTimeout(500);

  const mobileRow = mp.getByRole('list', { name: 'Athletes' }).locator('> li').first();
  check('a row still carries athlete, signal and a way in at 360px',
    (await mobileRow.innerText()).length > 0
      && (await mobileRow.getByRole('link', { name: /^Open$/ }).count()) > 0);

  const mobileOverflowAfter = await mp.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('and the full roster does not scroll sideways either', mobileOverflowAfter <= 0,
    `overflow ${mobileOverflowAfter}px`);
} finally {
  await browser.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
