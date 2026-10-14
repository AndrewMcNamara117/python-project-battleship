/**
 * Activities, end to end in a browser, against a demo-mode server.
 *
 *   npm run build && npx next start -p 3000 &
 *   BASE_URL=http://localhost:3000 npm run test:activities
 *
 * Writes real FIT and GPX files to a temp directory and uploads them through
 * the page, as an athlete would. Needs a freshly started server: an import
 * completes today's session, and demo state lives in the server process.
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright-core';
import { syntheticRun, toFit, toGpx } from '../src/lib/activity/fixtures.ts';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const CHROMIUM = process.env.CHROMIUM_PATH ?? undefined;

let pass = 0, fail = 0;
const step = (n, name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   ${n}. ${name}`); }
  else { fail++; console.log(`  FAIL ${n}. ${name}${detail ? ' — ' + detail : ''}`); }
};

const dir = mkdtempSync(join(tmpdir(), 'im-activities-'));
const today = new Date().toISOString().slice(0, 10);
const run = syntheticRun({ start: `${today}T06:30:00Z`, distanceKm: 9, paceSecPerKm: 320, intervalS: 1 });
const fit = join(dir, 'morning.fit');
const gpx = join(dir, 'morning.gpx');
const junk = join(dir, 'notes.gpx');
writeFileSync(fit, toFit(run));
writeFileSync(gpx, toGpx(run));
writeFileSync(junk, 'this is not a gpx file');
// a run round the demo's canal loop, a year out so it matches no session
const canal = join(dir, 'canal.fit');
const later = new Date(Date.now() + 365 * 86400000).toISOString().slice(0, 10);
writeFileSync(canal, toFit(syntheticRun({ start: `${later}T07:00:00Z`, distanceKm: 10, paceSecPerKm: 290, intervalS: 1, centre: [52.6593, -8.6105] })));

const browser = await chromium.launch({
  ...(CHROMIUM ? { executablePath: CHROMIUM } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});
const ctx = async (role, viewport = { width: 1440, height: 1000 }) => {
  const c = await browser.newContext({ viewport });
  await c.addCookies([{ name: 'im_demo_session', value: role, domain: 'localhost', path: '/' }]);
  return c;
};
const errors = [];
const watch = (p) => {
  p.on('pageerror', (e) => errors.push(String(e)));
  p.on('console', (m) => m.type() === 'error' && errors.push(`${m.text()} [${m.location()?.url ?? p.url()}]`));
};

console.log('\nActivities\n');

const athlete = await ctx('athlete');
const page = await athlete.newPage();
watch(page);

await page.goto(`${BASE}/app/activities`, { waitUntil: 'networkidle' });
step(1, 'the activities page renders for an athlete', (await page.title()).includes('Activities'));
step(2, 'the demo athlete already has imported runs', (await page.$$('a[href^="/app/activities/act-"]')).length >= 3);

await page.setInputFiles('input[type=file]', [fit, gpx, junk]);
await page.waitForFunction(
  () => {
    const rows = [...document.querySelectorAll('[aria-live] li')];
    return rows.length === 3 && !rows.some((r) => /Reading…|Waiting/.test(r.textContent ?? ''));
  },
  null,
  { timeout: 60000 },
);
const rows = await page.$$eval('[aria-live] li', (lis) => lis.map((l) => l.textContent ?? ''));
const row = (name) => rows.find((r) => r.startsWith(name)) ?? '';
// a fresh server logs today's session from the file; after e2e/loop.mjs has
// hand-logged it, the file enriches that log instead. Both are correct.
const enriched = /Added to/.test(row('morning.fit'));
step(3, 'a FIT file lands on today’s session', /Logged against|Added to/.test(row('morning.fit')), row('morning.fit'));
step(4, 'the same run as GPX is recognised as a duplicate', /Already imported/.test(row('morning.gpx')), row('morning.gpx'));
step(5, 'a file that is not an activity is refused, with a reason', /not an activity file/.test(row('notes.gpx')), row('notes.gpx'));

const href = await page.$eval('[aria-live] li a', (a) => a.getAttribute('href'));
await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
const body = await page.textContent('main');
step(6, 'the activity shows planned against done', /Planned against done/i.test(body ?? ''));
step(7, 'the activity shows 9 one-km splits', (await page.$$('table:has(th:text("Km")) tbody tr')).length === 9);
step(8, 'the route says what it hides', /First and last 200 m hidden/.test(body ?? ''));
step(9, 'the route has an accessible name', Boolean(await page.$('figure svg[role="img"][aria-label^="Route of"]')));

await page.goto(`${BASE}/app/today`, { waitUntil: 'networkidle' });
step(10, 'today’s session reads as completed', /Completed/.test((await page.textContent('main')) ?? ''));

// a coach sees the activity on the athlete's page, read-only
const coach = await ctx('coach');
const cp = await coach.newPage();
watch(cp);
const coachHref = href.replace('/app/activities/', '/coach/athletes/demo-athlete-andrew/activities/');
await cp.goto(`${BASE}${coachHref}`, { waitUntil: 'networkidle' });
const coachBody = (await cp.textContent('main')) ?? '';
step(11, 'the coach sees the athlete’s activity', /Planned against done/i.test(coachBody));
step(12, 'the coach gets no delete or rename', !/Delete activity|Rename/.test(coachBody));

// another athlete's activity id is a 404, not a leak
const before = errors.length;
const res = await page.goto(`${BASE}/app/activities/act-does-not-exist`);
step(13, 'an unknown activity is a 404', res?.status() === 404, `got ${res?.status()}`);
// the browser logs the 404 this step asked for; that one is not a fault
errors.splice(before);

// delete puts the session back on the plan
await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
await page.click('button:has-text("Delete activity")');
await page.click('button:has-text("Delete"):not(:has-text("activity"))');
await page.waitForURL(`${BASE}/app/activities`, { timeout: 15000 });
await page.goto(`${BASE}/app/today`, { waitUntil: 'networkidle' });
const todayText = (await page.textContent('main')) ?? '';
step(
  14,
  enriched ? 'deleting an enriching import keeps the typed log' : 'deleting the import un-logs the session',
  enriched ? /Update log/.test(todayText) : /Mark complete/.test(todayText),
);

// phone width: nothing scrolls sideways
const phone = await ctx('athlete', { width: 390, height: 844 });
const pp = await phone.newPage();
watch(pp);
await pp.goto(`${BASE}/app/activities`, { waitUntil: 'networkidle' });
step(15, 'no horizontal scroll at phone width', (await pp.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 0);

// the club feed: a club-mate's run, kudos, a comment
await page.goto(`${BASE}/app/club`, { waitUntil: 'networkidle' });
step(16, 'the club feed lists shared runs', (await page.$$('article')).length >= 5);
const feedText = (await page.textContent('main')) ?? '';
step(17, 'the feed shows no heart rate', !/bpm/i.test(feedText));
const kudos = page.locator('article button[aria-pressed="false"]').first();
const countBefore = Number((await kudos.getAttribute('aria-label'))?.match(/\((\d+)\)/)?.[1]);
await kudos.click();
await page.waitForTimeout(1200);
await page.goto(`${BASE}/app/club`, { waitUntil: 'networkidle' });
const counts = await page.$$eval('article button[aria-pressed="true"]', (bs) => bs.map((b) => b.getAttribute('aria-label')));
step(18, 'kudos sticks after a reload', counts.some((l) => l?.includes(`(${countBefore + 1})`)), JSON.stringify(counts));
const runHref = await page.$eval('article a[href^="/app/club/"]', (a) => a.getAttribute('href'));
await page.goto(`${BASE}${runHref}`, { waitUntil: 'networkidle' });
const note = `Great running ${Date.now().toString().slice(-4)}`;
await page.fill('textarea', note);
await page.click('button:has-text("Post")');
await page.waitForFunction((t) => document.querySelector('main')?.textContent?.includes(t), note, { timeout: 10000 }).catch(() => {});
await page.reload({ waitUntil: 'networkidle' });
step(19, 'a comment posts and stays', ((await page.textContent('main')) ?? '').includes(note));
step(20, 'your own run in the feed links to your own page', Boolean(await page.goto(`${BASE}/app/club`).then(() => page.$('article a[href^="/app/activities/"]'))));

// segments
await page.goto(`${BASE}/app/segments`, { waitUntil: 'networkidle' });
step(21, 'the club’s segments are listed', (await page.$$('a[href^="/app/segments/"]')).length >= 3);
await page.goto(`${BASE}/app/activities`, { waitUntil: 'networkidle' });
await page.setInputFiles('input[type=file]', [canal]);
await page.waitForFunction(
  () => [...document.querySelectorAll('[aria-live] li')].some((r) => /canal\.fit/.test(r.textContent ?? '') && !/Reading…|Waiting/.test(r.textContent ?? '')),
  null,
  { timeout: 60000 },
);
const canalRow = await page.$eval('[aria-live] li', (l) => l.textContent ?? '');
step(22, 'an import over the canal is timed on its segment', /Canal bank drag \d+:\d\d/.test(canalRow), canalRow);
await page.goto(`${BASE}/app/segments/seg-canal-drag`, { waitUntil: 'networkidle' });
step(23, 'the segment page shows the athlete’s effort', /Best \d+:\d\d/.test((await page.textContent('main')) ?? ''));

// a coach draws a new segment from one of the athlete's routes
const firstActivity = await page.goto(`${BASE}/app/activities`, { waitUntil: 'networkidle' }).then(() =>
  page.$eval('a[href^="/app/activities/act-"]', (a) => a.getAttribute('href')),
);
await cp.goto(`${BASE}${firstActivity.replace('/app/activities/', '/coach/athletes/demo-athlete-andrew/activities/')}`, { waitUntil: 'networkidle' });
const segName = `QA stretch ${Date.now().toString().slice(-4)}`;
await cp.fill('input[placeholder="e.g. Canal bank drag"]', segName);
await cp.click('button:has-text("Draw segment")');
await cp.waitForFunction(() => /drawn\./.test(document.querySelector('[role=status]')?.textContent ?? ''), null, { timeout: 15000 }).catch(() => {});
await page.goto(`${BASE}/app/segments`, { waitUntil: 'networkidle' });
step(24, 'a coach-drawn segment appears for athletes', ((await page.textContent('main')) ?? '').includes(segName));

step(25, 'no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));

await browser.close();
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
