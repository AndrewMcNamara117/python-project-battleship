/**
 * Watch sync end to end, against a provider that speaks the simulator
 * protocol (src/lib/sync/simulator.ts) on a local port.
 *
 * Start the app with the simulator standing in for Garmin:
 *   SYNC_SECRET=$(openssl rand -hex 24) SYNC_SIMULATOR_URL=http://127.0.0.1:4600 \
 *   SYNC_SIMULATOR_SECRET=push-secret npx next start -p 3000
 * then: BASE_URL=http://localhost:3000 npm run test:sync
 *
 * Everything but the provider is real: the OAuth redirect dance in a
 * browser, sealed token storage, the signed push, the file fetch with the
 * bearer token, and the import.
 */
import { createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { syntheticRun, toFit } from '../src/lib/activity/fixtures.ts';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const CHROMIUM = process.env.CHROMIUM_PATH ?? undefined;
const PUSH_SECRET = process.env.SYNC_SIMULATOR_SECRET ?? 'push-secret';
const PORT = 4600;

let pass = 0, fail = 0;
const step = (n, name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   ${n}. ${name}`); }
  else { fail++; console.log(`  FAIL ${n}. ${name}${detail ? ' — ' + detail : ''}`); }
};

/* ---------- the provider ---------- */
const later = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
const FILES = { 'run-1': toFit(syntheticRun({ start: `${later(500)}T07:00:00Z`, distanceKm: 7, paceSecPerKm: 300, intervalS: 2 })) };
const seen = { tokenCalls: 0, fileAuth: [] };
const provider = createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/authorize') {
    const back = new URL(url.searchParams.get('redirect_uri'));
    back.searchParams.set('code', 'code-123');
    back.searchParams.set('state', url.searchParams.get('state'));
    res.writeHead(302, { location: back.toString() }).end();
    return;
  }
  if (url.pathname === '/token' && req.method === 'POST') {
    seen.tokenCalls++;
    let body = '';
    for await (const c of req) body += c;
    const p = JSON.parse(body);
    if (p.code !== 'code-123' && !p.refresh_token) return res.writeHead(400).end();
    res.writeHead(200, { 'content-type': 'application/json' }).end(
      JSON.stringify({ access_token: 'sim-access', refresh_token: 'sim-refresh', expires_at: null, user_id: 'sim-user-1' }),
    );
    return;
  }
  if (url.pathname.startsWith('/files/')) {
    seen.fileAuth.push(req.headers.authorization);
    if (req.headers.authorization !== 'Bearer sim-access') return res.writeHead(401).end();
    const f = FILES[decodeURIComponent(url.pathname.slice(7))];
    if (!f) return res.writeHead(404).end();
    res.writeHead(200, { 'content-type': 'application/octet-stream', 'content-length': f.length }).end(Buffer.from(f));
    return;
  }
  res.writeHead(404).end();
});
await new Promise((r) => provider.listen(PORT, '127.0.0.1', r));

const push = async (body, sign = true) => {
  const raw = JSON.stringify(body);
  const sig = sign ? createHmac('sha256', PUSH_SECRET).update(raw).digest('hex') : 'deadbeef';
  const res = await fetch(`${BASE}/api/sync/garmin/push`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-sync-signature': sig }, body: raw });
  return { status: res.status, body: await res.json().catch(() => ({})) };
};

/* ---------- the athlete ---------- */
const browser = await chromium.launch({ ...(CHROMIUM ? { executablePath: CHROMIUM } : {}), args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
await ctx.addCookies([{ name: 'im_demo_session', value: 'athlete', domain: 'localhost', path: '/' }]);
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

console.log('\nWatch sync\n');

const before = await push({ user_id: 'sim-user-1', activities: [{ id: 'act-1', ref: 'run-1' }] });
step(1, 'a push for an account nobody has connected does nothing', before.status === 200 && before.body.imported === 0, JSON.stringify(before.body));

await page.goto(`${BASE}/app/profile`, { waitUntil: 'networkidle' });
step(2, 'profile offers to connect the (simulated) watch', Boolean(await page.$('a[href="/api/sync/garmin/connect"]')));
step(3, 'COROS says honestly that it is waiting on approval', /Awaiting COROS API partner approval/.test((await page.textContent('main')) ?? ''));

await page.click('a[href="/api/sync/garmin/connect"]');
await page.waitForURL(/\/app\/profile\?sync=/, { timeout: 20000 });
step(4, 'the OAuth round trip comes back connected', /connected:garmin/.test(decodeURIComponent(page.url())), page.url());
step(5, 'and says so', /is connected/.test((await page.textContent('main')) ?? ''));

const forged = await push({ user_id: 'sim-user-1', activities: [{ id: 'act-1', ref: 'run-1' }] }, false);
step(6, 'an unsigned push is refused', forged.status === 401);

const first = await push({ user_id: 'sim-user-1', activities: [{ id: 'act-1', ref: 'run-1' }] });
step(7, 'a signed push imports the run', first.status === 200 && first.body.imported === 1, JSON.stringify(first.body));
step(8, 'the file was fetched with the athlete’s token', seen.fileAuth.at(-1) === 'Bearer sim-access');

const again = await push({ user_id: 'sim-user-1', activities: [{ id: 'act-1', ref: 'run-1' }] });
step(9, 'the same push again imports nothing', again.body.imported === 0 && again.body.duplicates === 1, JSON.stringify(again.body));

await page.goto(`${BASE}/app/activities`, { waitUntil: 'networkidle' });
const href = await page.$eval('a[href^="/app/activities/act-"]', (a) => a.getAttribute('href'));
await page.goto(`${BASE}${href}`, { waitUntil: 'networkidle' });
step(10, 'it is in the athlete’s activities, marked as from the watch', /via garmin/i.test((await page.textContent('main')) ?? ''));

await page.goto(`${BASE}/app/profile`, { waitUntil: 'networkidle' });
await page.click('button:has-text("Disconnect")');
await page.waitForSelector('text=disconnected', { timeout: 10000 }).catch(() => {});
FILES['run-2'] = FILES['run-1'];
const afterOff = await push({ user_id: 'sim-user-1', activities: [{ id: 'act-2', ref: 'run-2' }] });
step(11, 'after disconnecting, pushes import nothing', afterOff.body.imported === 0, JSON.stringify(afterOff.body));
step(12, 'no page errors', errors.length === 0, errors.join(' | '));

await browser.close();
provider.close();
console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
