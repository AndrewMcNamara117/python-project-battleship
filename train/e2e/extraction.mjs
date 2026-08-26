/**
 * Programme from an athlete, driven through the real UI.
 *
 *   template → assign → adapt → save back as a template → assign again
 *
 * The Postgres side is supabase/test/programme-extraction.test.mjs. This is
 * the coach's side of it: what they read before saving, and whether the thing
 * they get back is assignable.
 *
 *   BASE_URL=http://localhost:3000 node e2e/extraction.mjs
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

// deliberately carries no athlete name: the template must not either
const NAME = `Aerobic Base ${Date.now().toString().slice(-5)}`;

try {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
  await ctx.addCookies([{ name: 'im_demo_session', value: 'coach', domain: 'localhost', path: '/' }]);
  const p = await ctx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  /* ---- the action is on the athlete, where the programme lives ---- */

  await p.goto(`${BASE}/coach/athletes/demo-athlete-andrew`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(1200);
  check('the coach can save this athlete\'s programme as a template',
    (await p.getByRole('button', { name: /Save as template/i }).count()) > 0);

  await p.getByRole('button', { name: /Save as template/i }).click();
  await p.waitForTimeout(600);
  const form = await p.locator('body').innerText();

  for (const [label, pattern] of [
    ['the shape it will save', /Blocks[\s\S]*Weeks[\s\S]*Sessions/i],
    ['the days it trains', /Trains/i],
    ['that the snapshot is independent', /will not change it/i],
    ['editable metadata', /Discipline[\s\S]*Goal[\s\S]*Visibility/i],
  ]) {
    check(`the review shows ${label}`, pattern.test(form));
  }

  // the form describes what *would* happen; nothing has been written yet
  check('nothing is written by opening the form',
    (await p.locator('[role="status"]').count()) === 0);

  /* ---- the suggested name is not the athlete's ---- */

  const suggested = await p.getByLabel('Name', { exact: true }).inputValue().catch(async () =>
    await p.locator('input').filter({ hasNot: p.locator('[type="date"]') }).first().inputValue());
  check('the suggested name does not carry the athlete\'s name',
    !/andrew/i.test(suggested), suggested);

  /* ---- save ---- */

  const nameField = p.locator('input').first();
  await nameField.fill(NAME);
  await p.getByRole('button', { name: /Save to my programmes/i }).click();
  const status = p.locator('[role="status"]');
  await status.first().waitFor({ timeout: 25000 });
  const outcome = await status.first().innerText();
  check('saving reports success', /Saved/i.test(outcome), outcome);
  check('and names the template it made', outcome.includes(NAME), outcome);

  /* ---- it is in the programme builder ---- */

  await p.goto(`${BASE}/coach/programs?q=${encodeURIComponent(NAME.split(' ')[0])}`, { waitUntil: 'networkidle' });
  await p.waitForTimeout(800);
  check('the saved programme appears in the builder',
    (await p.getByText(NAME, { exact: false }).count()) > 0);

  const card = p.locator('.im-panel').filter({ hasText: NAME }).first();
  const cardText = await card.innerText();
  check('it belongs to the coach who saved it', /Yours/i.test(cardText), cardText.slice(0, 120));
  check('the saved template carries no athlete name', !/andrew/i.test(cardText),
    cardText.replace(/\n/g, ' | ').slice(0, 140));

  /* ---- it is editable, and has real structure ---- */

  await card.getByRole('button', { name: /^Edit$/ }).click();
  await p.waitForTimeout(2000);
  const builder = await p.locator('body').innerText();
  check('the saved programme opens in the builder', /BLOCK 1/i.test(builder));
  check('with its weeks', /WEEK 1/i.test(builder));
  check('and its step-back weeks', /STEP-BACK/i.test(builder));
  check('and is editable', (await p.getByRole('button', { name: /^Add block$/ }).count()) > 0);

  /* ---- and can be assigned straight back out ---- */

  await p.goto(`${BASE}/coach/programs?q=${encodeURIComponent(NAME.split(' ')[0])}`, { waitUntil: 'networkidle' });
  const assignCard = p.locator('.im-panel').filter({ hasText: NAME }).first();
  await assignCard.getByRole('button', { name: /Assign to athlete/i }).click();
  await p.waitForTimeout(400);
  await assignCard.locator('input[type="date"]').fill(nextMonday());
  await assignCard.getByRole('link', { name: /^Review$/ }).click();
  await p.waitForTimeout(2500);
  check('a saved programme can be assigned', /Before you assign/i.test(await p.locator('body').innerText()));

  /* ---- replacing prescribed training needs a deliberate confirmation ---- */

  const review = await p.locator('body').innerText();
  const replacing = /will be replaced by this programme/i.test(review);
  check('replacement is called out on its own', replacing, 'expected a replacement warning');

  if (replacing) {
    check('it says so under its own heading', /This replaces prescribed training/i.test(review));
    check('and promises completed training is kept', /Completed training is never removed/i.test(review));

    const button = p.getByRole('button', { name: /Replace and assign/i });
    check('the button names what it does', (await button.count()) > 0);
    check('and is disabled until the coach confirms', !(await button.isEnabled()));

    await p.getByText(/Replace .* scheduled sessions from/i).click();
    await p.waitForTimeout(300);
    check('confirming enables it', await button.isEnabled());

    await button.click();
    const s2 = p.locator('[role="status"]');
    await s2.first().waitFor({ timeout: 25000 });
    check('and it assigns', /Assigned/i.test(await s2.first().innerText()));
  }

  check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));

  /* ---- mobile ---- */

  const mobile = await browser.newContext({ viewport: { width: 360, height: 780 } });
  await mobile.addCookies([{ name: 'im_demo_session', value: 'coach', domain: 'localhost', path: '/' }]);
  const mp = await mobile.newPage();
  await mp.goto(`${BASE}/coach/athletes/demo-athlete-andrew`, { waitUntil: 'networkidle' });
  await mp.waitForTimeout(1000);
  await mp.getByRole('button', { name: /Save as template/i }).click();
  await mp.waitForTimeout(600);
  const overflow = await mp.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('the save form does not scroll sideways at 360px', overflow <= 0, `overflow ${overflow}px`);
} finally {
  await browser.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
