/**
 * Access control and failure states.
 *
 * Complements the RLS suite: that proves the database refuses the wrong reads,
 * this proves the application refuses the wrong requests and behaves sanely
 * when something goes wrong or is simply not configured.
 *
 *   BASE_URL=http://localhost:3000 node e2e/guards.mjs
 */

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';

let pass = 0;
let fail = 0;
const check = (name, ok, detail = '') => {
  if (ok) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${detail ? ' — ' + detail : ''}`);
  }
};

const req = async (path, { cookie, method = 'GET', body, headers = {} } = {}) => {
  const res = await fetch(BASE + path, {
    method,
    redirect: 'manual',
    headers: {
      ...(cookie ? { cookie: `im_demo_session=${cookie}` } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text().catch(() => '');
  return { status: res.status, location: res.headers.get('location') ?? '', text };
};

const PROTECTED_ATHLETE = [
  '/app',
  '/app/today',
  '/app/calendar',
  '/app/training',
  '/app/strength',
  '/app/progress',
  '/app/check-in',
  '/app/leaderboard',
  '/app/community',
  '/app/coach',
  '/app/forge',
  '/app/profile',
  '/app/profile/billing',
];

const PROTECTED_COACH = [
  '/coach',
  '/coach/athletes',
  '/coach/applications',
  '/coach/checkins',
  '/coach/messages',
  '/coach/programs',
  '/coach/workouts',
  '/coach/strength',
  '/coach/races',
  '/coach/analytics',
];

console.log('\nSIGNED OUT');
for (const path of [...PROTECTED_ATHLETE, ...PROTECTED_COACH, '/onboarding']) {
  const r = await req(path);
  check(`${path} redirects to login`, r.status === 307 && r.location.includes('/login'), `got ${r.status} ${r.location}`);
}

console.log('\nROLE SEPARATION');
for (const path of PROTECTED_COACH) {
  const r = await req(path, { cookie: 'athlete' });
  check(`athlete is kept out of ${path}`, r.status === 307 && r.location.endsWith('/app'), `got ${r.status} ${r.location}`);
}
{
  const r = await req('/app', { cookie: 'coach' });
  check('coach is redirected out of the athlete hub', r.status === 307 && r.location.endsWith('/coach'), `got ${r.status}`);
}
{
  const r = await req('/coach/athletes/demo-athlete-andrew', { cookie: 'athlete' });
  check('athlete cannot open a coach athlete page', r.status === 307, `got ${r.status}`);
}
{
  const r = await req('/coach/athletes/somebody-elses-athlete', { cookie: 'coach' });
  check('coach gets a real 404 for an athlete not on their roster', r.status === 404, `got ${r.status}`);
}

console.log('\nAPI GUARDS');
{
  const r = await req('/api/cron/morning-reminder');
  check('cron refuses without the secret', r.status === 401, `got ${r.status}`);
}
{
  const r = await req('/api/cron/morning-reminder', { headers: { authorization: 'Bearer wrong' } });
  check('cron refuses a wrong secret', r.status === 401, `got ${r.status}`);
}
{
  const r = await req('/api/cron/not-a-real-job', { headers: { authorization: 'Bearer wrong' } });
  check('cron does not leak the job list to an unauthorised caller', r.status === 401, `got ${r.status}`);
}
{
  const r = await req('/api/stripe/webhook', { method: 'POST', body: { type: 'checkout.session.completed' } });
  check('stripe webhook rejects an unsigned body', r.status >= 400, `got ${r.status}`);
}
{
  const r = await req('/api/stripe/checkout', { method: 'POST', body: { packageCode: 'event_ready' } });
  check('checkout refuses an unauthenticated caller', r.status === 401, `got ${r.status}`);
}
{
  const r = await req('/api/stripe/portal', { method: 'POST', cookie: 'athlete' });
  check('portal fails cleanly when billing is unconfigured', r.status === 503, `got ${r.status}`);
}
{
  const r = await req('/api/stripe/checkout', { method: 'POST', cookie: 'athlete', body: { packageCode: 'nonexistent' } });
  check('checkout rejects an unknown package rather than guessing', r.status >= 400, `got ${r.status}`);
}

console.log('\nFAILURE STATES ARE HANDLED, NOT CRASHED');
{
  const r = await req('/nope-not-a-page');
  check('unknown page returns 404 with the branded page', r.status === 404 && /Wrong turn/i.test(r.text), `got ${r.status}`);
}
{
  // A body-less POST with a JSON content-type. The route may answer 503 first
  // when billing is unconfigured — that precedence is correct, the caller can
  // do nothing about an unconfigured service. What must never happen is an
  // unhandled parse throwing a 500.
  const r = await req('/api/stripe/checkout', {
    method: 'POST',
    cookie: 'athlete',
    headers: { 'content-type': 'application/json' },
  });
  check('a malformed body never becomes a 500', r.status !== 500, `got ${r.status}`);
}
{
  const r = await req('/app/profile/billing', { cookie: 'athlete' });
  check('billing states plainly that it is unconfigured', /not configured/i.test(r.text), 'expected an explicit notice');
}
{
  const r = await req('/app/profile', { cookie: 'athlete' });
  check('integrations are labelled rather than looking connectable', /coming soon/i.test(r.text));
}
{
  const r = await req('/coach/applications', { cookie: 'coach' });
  check('demo-mode limits are stated on the intake queue', /demo mode/i.test(r.text));
}
{
  const r = await req('/app/leaderboard', { cookie: 'athlete' });
  check('points that need a coach are marked', /coach records/i.test(r.text));
}

console.log('\nSECURITY HEADERS');
{
  const res = await fetch(BASE + '/', { redirect: 'manual' });
  check('X-Frame-Options DENY', res.headers.get('x-frame-options') === 'DENY');
  check('X-Content-Type-Options nosniff', res.headers.get('x-content-type-options') === 'nosniff');
  check('Referrer-Policy set', (res.headers.get('referrer-policy') ?? '').includes('strict-origin'));
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
