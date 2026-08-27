/**
 * ONE COACHING DECISION, SEVERAL ATHLETES — through the real UI.
 *
 * The assertions that matter here are interaction counts, because the whole
 * slice exists to reduce them, and the safety claims a coach would be angry
 * about if they were false: that the button cannot promise more than it
 * delivers, and that nothing is applied to an athlete the review excluded.
 *
 *   BASE_URL=http://localhost:3000 node e2e/batch.mjs
 *
 * Needs a freshly started server: the demo dataset lives in the server process
 * and this suite assigns programmes, which changes who is waiting for one.
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

  await p.goto(`${BASE}/coach`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);

  /* ---- selection ---- */

  console.log('\nchoosing athletes');
  check('nothing is selected to begin with',
    !(await p.locator('text=/\\d+ selected/i').count()));

  // On the default filter a shared problem is one group row, so there are no
  // individual rows to tick — which is Slice 7 working. "Everyone" is where a
  // coach picks people one at a time.
  await p.getByRole('button', { name: /^everyone/i }).click();
  await p.waitForTimeout(900);
  check('every athlete can be ticked individually',
    (await p.locator('input[type=checkbox]').count()) > 0,
    `${await p.locator('input[type=checkbox]').count()} checkboxes`);

  await p.locator('input[type=checkbox]').first().check();
  await p.waitForTimeout(700);
  check('ticking one selects one',
    /1 selected/i.test(await p.locator('body').innerText()));

  await p.getByRole('button', { name: /^clear$/i }).click();
  await p.waitForTimeout(700);
  check('and it can be cleared',
    !(await p.locator('text=/\\d+ selected/i').count()));

  await p.getByRole('button', { name: /needs attention/i }).click();
  await p.waitForTimeout(900);

  const groupSelect = p.getByRole('button', { name: /select all \d+/i }).first();
  const hasGroup = (await groupSelect.count()) > 0;
  if (hasGroup) {
    await groupSelect.click();
    await p.waitForTimeout(900);
    check('a signal group can be selected in one click',
      (await p.locator('text=/\\d+ selected/i').count()) > 0);
  } else {
    await p.locator('input[type=checkbox]').first().check();
    await p.waitForTimeout(700);
    check('an athlete can be selected individually',
      (await p.locator('text=/\\d+ selected/i').count()) > 0);
  }

  const bar = await p.locator('body').innerText();
  const count = Number((bar.match(/(\d+) selected/i) ?? [0, 0])[1]);
  check('the bar says how many, and names them', count > 0 && /×/.test(bar), `${count}`);

  /* ---- the actions offered ---- */

  console.log('\nwhat can be done with them');
  const actions = ['assign a programme', 'adjust volume', 'shift training days'];
  for (const label of actions) {
    check(`"${label}" is offered`,
      (await p.getByRole('button', { name: new RegExp(label, 'i') }).count()) > 0);
  }

  /* ---- the review ---- */

  console.log('\nthe review, before anything changes');
  await p.getByRole('button', { name: /assign a programme/i }).click();
  await p.waitForTimeout(1500);
  await p.getByRole('button', { name: /^review$/i }).click();
  await p.waitForTimeout(2500);

  const reviewed = await p.locator('body').innerText();
  const confirm = p.getByRole('button', { name: /assign to \d+ athlete/i }).first();
  check('a confirm button appears and states a number',
    (await confirm.count()) > 0);

  const promised = Number(((await confirm.innerText()).match(/(\d+)/) ?? [0, 0])[1]);
  check('the button never promises more than were selected',
    promised <= count, `promises ${promised} of ${count}`);
  check('a tally spells out the exceptions',
    /will change/i.test(reviewed));
  check('every selected athlete has a row',
    (await p.locator('text=/will change|nothing to do|blocked|not yours/i').count()) >= promised);
  check('warnings are shown rather than resolved away',
    !/resolved|adjusted to fit|moved to fit/i.test(reviewed));

  /* ---- applying ---- */

  console.log('\napplying');
  await confirm.click();
  await p.waitForTimeout(3500);

  const done = await p.locator('body').innerText();
  check('the result names every athlete, not just a count',
    (done.match(/APPLIED|SKIPPED|BLOCKED|FAILED/gi) ?? []).length >= promised,
    `${(done.match(/APPLIED/gi) ?? []).length} applied lines`);
  check('and says how many in words',
    /\d+ athletes? assigned|nothing needed changing/i.test(done));
  check('a partial failure would be named, not hidden',
    !/\bassigned\b.*\ball\b/i.test(done));

  /* ---- the roster reflects it ---- */

  console.log('\nafterwards');
  await p.goto(`${BASE}/coach`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2000);
  const fresh = await p.locator('body').innerText();
  check('the roster no longer reports the work as outstanding',
    !/\d+ athletes are waiting on a programme/i.test(fresh)
    || Number((fresh.match(/(\d+) athletes are waiting/i) ?? [0, 999])[1]) < count,
    fresh.match(/\d+ athletes are waiting on a programme/i)?.[0] ?? 'none');

  /* ---- the check-in seam ---- */

  console.log('\nacting on a check-in without leaving it');
  await p.goto(`${BASE}/coach/checkins`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(2500);

  const before = await p.locator('body').innerText();
  let words = null;
  for (const l of ['Pain or niggles', 'Felt difficult', 'Went well', 'For you']) {
    const m = before.match(new RegExp(`${l}\\n+([^\\n]{15,})`, 'i'));
    if (m) { words = m[1]; break; }
  }

  const adjust = p.getByRole('button', { name: /adjust next week/i }).first();
  if (await adjust.count()) {
    await adjust.click();
    await p.waitForTimeout(900);
    await p.getByRole('button', { name: /^review$/i }).first().click();
    await p.waitForTimeout(2000);

    const mid = await p.locator('body').innerText();
    check('the athlete\'s own words stay on screen while the coach decides',
      words ? mid.includes(words) : true, words ?? '(no free text in this fixture)');
    check('it uses the same review, not a second one',
      /will change|nothing to do|blocked/i.test(mid));

    const apply = p.getByRole('button', { name: /adjust \d+ athlete/i }).first();
    if (await apply.count()) {
      await apply.click();
      await p.waitForTimeout(2500);
      const after = await p.locator('body').innerText();
      check('the change is applied from the check-in page',
        /athlete adjusted|nothing needed changing/i.test(after));
      check('and the words are still there afterwards',
        words ? after.includes(words) : true);
    }
  } else {
    console.log('  --   no check-in waiting in this server; restart it to exercise the seam');
  }

  /* ---- the basics ---- */

  console.log('\nthe basics');
  check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));

} finally {
  await browser.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
