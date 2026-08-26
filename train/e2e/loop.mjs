/**
 * The coach ↔ athlete loop, end to end, through the real UI.
 *
 * Drives every step the product exists for: someone applies, a coach accepts,
 * the athlete appears, the coach prescribes and later edits, the athlete sees
 * the change and completes it, the data reaches the coach, the check-in routes
 * a concern to a human, and the Forge ledger moves. If this file passes, the
 * loop works; if it does not, the product does not do its job.
 *
 * Usage — against a running server, in demo mode:
 *   npm run build && npx next start -p 3000 &
 *   BASE_URL=http://localhost:3000 npm run test:e2e
 *
 * Demo mode is required: it is the only mode where a session can be assumed
 * without real credentials. The code paths under test are the same either way.
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const CHROMIUM = process.env.CHROMIUM_PATH ?? undefined;
const MARKER = `QA Threshold ${Date.now().toString().slice(-5)}`;
const NOTE = 'Hold the range even if the legs feel good.';
const APPLICANT = `qa.runner.${Date.now().toString().slice(-6)}@example.com`;

let pass = 0, fail = 0;
const step = (n, name, ok, detail = '') => {
  if (ok) { pass++; console.log(`  ok   ${n}. ${name}`); }
  else { fail++; console.log(`  FAIL ${n}. ${name}${detail ? ' — ' + detail : ''}`); }
};

const browser = await chromium.launch({
  ...(CHROMIUM ? { executablePath: CHROMIUM } : {}),
  args: ['--no-sandbox', '--disable-dev-shm-usage'],
});

const ctx = async (role) => {
  const c = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  if (role) await c.addCookies([{ name: 'im_demo_session', value: role, domain: 'localhost', path: '/' }]);
  return c;
};

// The stat tiles animate on scroll into view, so a value read straight after
// load is a frame of the animation, not the figure. Wait for it to settle and
// read the tile labelled "Forge Score" rather than whichever number is first.
async function readForgeScore(page) {
  await page.goto(`${BASE}/app/leaderboard`, { waitUntil: 'networkidle' });
  const tile = page.locator('div').filter({ hasText: /^Forge Score/ }).first();
  await tile.waitFor({ timeout: 10000 });
  await page.waitForTimeout(2500);
  const text = await tile.innerText();
  const match = text.replace(/,/g, '').match(/\d+/);
  return match ? Number(match[0]) : 0;
}

const todayLabel = new Date().toLocaleDateString('en-IE', { timeZone: 'UTC', day: 'numeric', month: 'short' });

try {
  /* ---------- 1. a stranger applies ---------- */
  {
    const c = await ctx(null);
    const p = await c.newPage();
    await p.goto(`${BASE}/apply`, { waitUntil: 'networkidle' });
    await p.fill('input[name="fullName"]', 'QA Applicant');
    await p.fill('input[name="email"]', APPLICANT);
    await p.fill('textarea[name="goal"]', 'I want to finish my first 50K ultra next spring without falling apart.');
    await p.fill('textarea[name="experience"]', 'Running four times a week for two years, one marathon done.');
    await p.fill('input[name="startWhen"]', 'As soon as there is a place');
    await p.check('input[name="consent"]');
    await p.click('button[type="submit"]');
    await p.waitForSelector('text=/first session done/i', { timeout: 15000 });
    step(1, 'athlete submits an application', true);
    await c.close();
  }

  /* ---------- 2. coach reviews and accepts ---------- */
  {
    const c = await ctx('coach');
    const p = await c.newPage();
    await p.goto(`${BASE}/coach/applications`, { waitUntil: 'networkidle' });
    const visible = await p.locator(`text=${APPLICANT}`).count();
    step(2, 'application reaches the coach queue', visible > 0);

    await p.getByRole('button', { name: 'Accept', exact: true }).first().click();
    await p.waitForSelector('text=/roster|register/i', { timeout: 15000 });
    step(3, 'coach accepts the application', true);
    await c.close();
  }

  /* ---------- 3. the athlete now exists and is on the roster ---------- */
  {
    const c = await ctx('coach');
    const p = await c.newPage();
    await p.goto(`${BASE}/coach/athletes`, { waitUntil: 'networkidle' });
    const onRoster = await p.locator('text=QA Applicant').count();
    step(4, 'accepted athlete appears on the roster', onRoster > 0);
    await c.close();
  }

  /* ---------- 4. coach edits today's prescribed session ---------- */
  {
    const c = await ctx('coach');
    const p = await c.newPage();
    await p.goto(`${BASE}/coach/athletes/demo-athlete-andrew`, { waitUntil: 'networkidle' });
    await p.waitForSelector('text=Prescribed sessions', { timeout: 15000 });

    const row = p.locator('li').filter({ hasText: todayLabel }).first();
    const editable = await row.getByRole('button', { name: 'Edit', exact: true }).count();
    if (!editable) {
      throw new Error(
        "today's session is already completed — this test needs a freshly started server, " +
          'because demo state lives in the server process and a previous run has already ' +
          'driven the loop. Restart the server and run again.',
      );
    }
    await row.getByRole('button', { name: 'Edit', exact: true }).click();
    await p.getByText('Session name').waitFor({ timeout: 10000 });

    const form = p.locator('li').filter({ hasText: 'Session name' }).first();
    await form.locator('input[type="text"], input:not([type])').first().fill(MARKER);
    await form.locator('select').first().selectOption('easy_run');
    await form.locator('textarea').last().fill(NOTE);
    await form.getByRole('button', { name: 'Save', exact: true }).click();

    await p.waitForSelector('text=/athlete sees it now/i', { timeout: 15000 });
    step(5, 'coach edits the prescription', true);
    await c.close();
  }

  /* ---------- 5. the athlete sees the change ---------- */
  {
    const c = await ctx('athlete');
    const p = await c.newPage();
    await p.goto(`${BASE}/app/today`, { waitUntil: 'networkidle' });
    const seesName = await p.locator(`text=${MARKER}`).count();
    const seesNote = await p.locator(`text=${NOTE}`).count();
    step(6, 'athlete sees the renamed session', seesName > 0);
    step(7, 'athlete sees the coach note', seesNote > 0);
    await c.close();
  }

  /* ---------- 6. athlete completes it with RPE and feedback ---------- */
  let forgeBefore = 0;
  {
    const c = await ctx('athlete');
    const p = await c.newPage();
    forgeBefore = await readForgeScore(p);

    await p.goto(`${BASE}/app/today`, { waitUntil: 'networkidle' });
    await p.fill('input[name="actualDistanceKm"]', '8.4');
    await p.fill('input[name="actualDurationMinutes"]', '48');
    await p.locator('button[aria-label="7 out of 10"]').first().click();
    await p.getByRole('button', { name: /Add heart rate/ }).click();
    await p.fill('input[name="averageHeartRate"]', '142');
    await p.fill('textarea[name="athleteNotes"]', 'Felt controlled the whole way. Calf quiet.');
    await p.getByRole('button', { name: /Mark complete|Update log/ }).first().click();
    await p.waitForSelector('text=/Logged\\.|Update log/i', { timeout: 15000 });
    step(8, 'athlete logs the session with RPE and notes', true);
    await c.close();
  }

  /* ---------- 7. the coach receives the data ---------- */
  {
    const c = await ctx('coach');
    const p = await c.newPage();
    await p.goto(`${BASE}/coach/athletes/demo-athlete-andrew`, { waitUntil: 'networkidle' });
    const body = await p.locator('body').innerText();
    step(9, 'coach sees the logged distance', body.includes('8.4'));
    step(10, 'coach sees the session marked completed', /completed/i.test(body));
    await c.close();
  }

  /* ---------- 8. weekly check-in, with something worth flagging ---------- */
  {
    const c = await ctx('athlete');
    const p = await c.newPage();
    await p.goto(`${BASE}/app/check-in`, { waitUntil: 'networkidle' });
    // soreness high two ways: the scale and the free text
    const scales = p.locator('[role="radiogroup"]');
    await scales.nth(2).locator('button[aria-label="9 out of 10"]').click(); // soreness
    await scales.nth(1).locator('button[aria-label="3 out of 10"]').click(); // sleep
    await p.fill('textarea[name="painOrNiggles"]', 'Left calf has been sore and it is worsening after runs.');
    await p.fill('textarea[name="wentWell"]', 'Got every session done.');
    await p.locator('button[type="submit"]').first().click();
    await p.waitForSelector('text=/Submitted|Please read this/i', { timeout: 15000 });

    const text = await p.locator('body').innerText();
    step(11, 'check-in submits', /Submitted|Please read this/i.test(text));
    step(12, 'worsening pain triggers stop-and-seek-care guidance',
      /doctor|physiotherapist/i.test(text), 'expected clinical referral language');
    await c.close();
  }

  /* ---------- 9. the coach is alerted ---------- */
  {
    const c = await ctx('coach');
    const p = await c.newPage();
    await p.goto(`${BASE}/coach/checkins`, { waitUntil: 'networkidle' });
    const body = await p.locator('body').innerText();
    step(13, 'check-in reaches the coach queue', /Andrew/i.test(body));
    step(14, 'it is flagged for attention', /attention/i.test(body));

    await p.goto(`${BASE}/coach`, { waitUntil: 'networkidle' });
    const overview = await p.locator('body').innerText();
    step(15, 'the coach overview surfaces the flag', /Attention|Needs you first/i.test(overview));
    await c.close();
  }

  /* ---------- 10. Forge Score moved ---------- */
  {
    const c = await ctx('athlete');
    const p = await c.newPage();
    const after = await readForgeScore(p);
    step(16, 'Forge Score increased after the session and check-in',
      after > forgeBefore, `before ${forgeBefore}, after ${after}`);
    await c.close();
  }

  /* ---------- 11. coach assigns a programme, athlete sees it ---------- */
  {
    const c = await ctx('coach');
    const p = await c.newPage();

    // assignment goes through the review now: pick the athlete and the date,
    // read what it would do, then commit
    await p.goto(`${BASE}/coach/programs`, { waitUntil: 'networkidle' });
    const card = p.locator('.im-panel').filter({ hasText: '10K — Build' }).first();
    await card.getByRole('button', { name: /Assign to athlete/i }).click();
    await p.waitForTimeout(400);
    await card.locator('select').first().selectOption({ label: 'Andrew' });
    await card.getByRole('link', { name: /^Review$/ }).click();
    await p.waitForTimeout(2500);

    step(17, 'the review opens before anything is written',
      /\/assign/.test(p.url()) && /Before you assign/i.test(await p.locator('body').innerText()));

    await p.getByRole('button', { name: /Assign programme/i }).click();
    const status = p.locator('[role="status"]');
    await status.first().waitFor({ timeout: 30000 });
    step(18, 'coach assigns a programme', /Assigned/i.test(await status.first().innerText()));
    await c.close();

    const c2 = await ctx('athlete');
    const p2 = await c2.newPage();
    await p2.goto(`${BASE}/app/training`, { waitUntil: 'networkidle' });
    const body = await p2.locator('body').innerText();
    step(19, 'athlete sees the assigned programme', /10K\s*—\s*BUILD/i.test(body),
      'endurance page should resolve the programme');
    step(20, 'programme is not reported as missing', !/No active programme/i.test(body));
    await c2.close();
  }
} catch (error) {
  fail++;
  console.log('  FAIL harness — ' + error.message.split('\n')[0]);
}

await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
