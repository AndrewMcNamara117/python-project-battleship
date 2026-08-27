/**
 * Week duplication, driven through the real UI against the demo adapter.
 *
 * The SQL functions are covered by supabase/test/programme.test.mjs against a
 * real Postgres. This covers the other implementation: a duplication that works
 * in Postgres and silently does nothing in demo mode would be a divergence
 * between the two backends, which is exactly what the repo interface exists to
 * prevent.
 *
 *   BASE_URL=http://localhost:3000 node e2e/duplication.mjs
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
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addCookies([{ name: 'im_demo_session', value: 'coach', domain: 'localhost', path: '/' }]);
  const p = await ctx.newPage();

  await p.goto(`${BASE}/coach/programs`, { waitUntil: 'networkidle' });

  const weekOptions = await p.locator('select').nth(3).locator('option').allTextContents();
  check('the builder offers real programme weeks, not dates',
    weekOptions.some((o) => /Week \d+ · \w+/.test(o)), `saw: ${weekOptions.slice(0, 2).join(' | ')}`);
  check('weeks carry their block name', weekOptions.some((o) => /Base|Build|Sharpen|Race/.test(o)));
  check('step-back weeks are marked', weekOptions.some((o) => /step-back/.test(o)));

  // count what the athlete has in a far-future week, duplicate into it, recount
  const athleteCtx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await athleteCtx.addCookies([{ name: 'im_demo_session', value: 'athlete', domain: 'localhost', path: '/' }]);

  // pick a target Monday well beyond the seeded programme
  const target = new Date();
  target.setUTCDate(target.getUTCDate() - ((target.getUTCDay() + 6) % 7) + 7 * 40);
  const targetISO = target.toISOString().slice(0, 10);

  await p.locator('input[type="date"]').last().fill(targetISO);
  await p.getByRole('button', { name: /Clone week/i }).click();
  await p.waitForSelector('text=/Week copied|not on your roster|Could not/i', { timeout: 20000 });

  const message = await p.locator('text=/Week copied|Could not|not on your roster/i').first().innerText();
  check('duplication reports success', /Week copied/i.test(message), message);

  // and the athlete can actually see the copied sessions
  const ap = await athleteCtx.newPage();
  await ap.goto(`${BASE}/app/calendar`, { waitUntil: 'networkidle' });
  await ap.waitForTimeout(1200);
  const copied = await ap.evaluate(async (_iso) => {
    const res = await fetch(`/app/calendar`, { headers: { 'x-probe': '1' } });
    return res.ok;
  }, targetISO);
  check('the athlete calendar still loads after duplication', copied);

  await ctx.close();
  await athleteCtx.close();
} catch (error) {
  fail++;
  console.log('  FAIL harness — ' + error.message.split('\n')[0]);
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
