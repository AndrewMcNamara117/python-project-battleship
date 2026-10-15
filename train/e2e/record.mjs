/**
 * Recording a run in the browser, with simulated GPS.
 *
 *   BASE_URL=http://localhost:3000 npm run test:record
 *
 * Walks a real route at a real pace for just over a minute (the recorder
 * will not save less), then finishes and saves through the normal import.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const CHROMIUM = process.env.CHROMIUM_PATH ?? undefined;

let pass = 0, fail = 0;
const step = (n, name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   ${n}. ${name}`); }
  else { fail++; console.log(`  FAIL ${n}. ${name}${detail ? ' — ' + detail : ''}`); }
};

const browser = await chromium.launch({ ...(CHROMIUM ? { executablePath: CHROMIUM } : {}), args: ['--no-sandbox'] });
const origin = new URL(BASE).origin;
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  permissions: ['geolocation'],
  geolocation: { latitude: 52.6735, longitude: -8.5713, accuracy: 5 },
});
await ctx.grantPermissions(['geolocation'], { origin });
await ctx.addCookies([{ name: 'im_demo_session', value: 'athlete', domain: 'localhost', path: '/' }]);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

console.log('\nRecording\n');

const res = await page.goto(`${BASE}/app/record`, { waitUntil: 'networkidle' });
step(1, 'the policy allows this origin GPS, and nothing embedded', /geolocation=\(self\)/.test(res.headers()['permissions-policy'] ?? ''), res.headers()['permissions-policy']);

await page.click('button:has-text("Start")');
// 4 m a second due north — a steady jog — for 66 seconds
let lat = 52.6735;
for (let i = 0; i < 66; i++) {
  lat += 4 / 110540;
  await ctx.setGeolocation({ latitude: lat, longitude: -8.5713, accuracy: 5 });
  await page.waitForTimeout(1000);
}
const live = (await page.textContent('main')) ?? '';
step(2, 'it is recording, with distance building', /Recording/.test(live) && /0\.2\d|0\.1\d/.test(live), live.slice(0, 200));
step(3, 'the run is kept on the phone as it grows', Boolean(await page.evaluate(() => localStorage.getItem('im.recording.v1'))));

await page.click('button:has-text("Pause")');
await page.waitForTimeout(1500);
step(4, 'pause stops the clock', /Paused/.test((await page.textContent('main')) ?? ''));
await page.click('button:has-text("Finish")');
await page.click('button:has-text("Save")');
await page.waitForSelector('[role=status]', { timeout: 30000 });
const saved = (await page.textContent('[role=status]')) ?? '';
step(5, 'saving imports it like a watch file', /Imported|Logged against|Added to|Already imported/.test(saved), saved);
step(6, 'and clears it from the phone', !(await page.evaluate(() => localStorage.getItem('im.recording.v1'))));
const href = await page.$eval('a:has-text("Open the activity")', (a) => a.getAttribute('href')).catch(() => null);
if (href) await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
step(7, 'the activity exists', Boolean(href) && /TCX file/i.test((await page.textContent('main')) ?? ''));
step(8, 'no horizontal scroll on a phone', (await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);
step(9, 'no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
