/**
 * WAITING FOR A REPLY, DRIVEN THROUGH THE REAL UI.
 *
 * The question: an athlete writes to their coach. Does the coach find out
 * without going looking, can they answer without leaving the roster, and does
 * answering settle that and only that?
 *
 *   BASE_URL=http://localhost:3000 node e2e/waiting.mjs
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
  const coachCtx = await browser.newContext({ viewport: { width: 1440, height: 1200 } });
  await coachCtx.addCookies([{ name: 'im_demo_session', value: 'coach', domain: 'localhost', path: '/' }]);
  const p = await coachCtx.newPage();
  const errors = [];
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const athleteCtx = await browser.newContext({ viewport: { width: 1200, height: 900 } });
  await athleteCtx.addCookies([{ name: 'im_demo_session', value: 'athlete', domain: 'localhost', path: '/' }]);
  const a = await athleteCtx.newPage();

  const rosterBody = async (q = '') => {
    await p.goto(`${BASE}/coach${q}`, { waitUntil: 'networkidle' });
    await p.waitForTimeout(500);
    return p.locator('body').innerText();
  };
  const rows = () => p.getByRole('list', { name: 'Athletes' }).locator('> li');
  const andrew = () => rows().filter({ hasText: /ANDREW/i }).first();

  /* ---- an athlete writes ---- */

  console.log('\nthe athlete writes to their coach');
  await a.goto(`${BASE}/app/coach`, { waitUntil: 'networkidle' });
  await a.waitForTimeout(500);
  const words = `Calf is tight after Sunday — intervals still on? ${Date.now()}`;
  const box = a.locator('textarea').first();
  check('the athlete has somewhere to write', await box.count() > 0);
  await box.fill(words);
  await a.getByRole('button', { name: /send/i }).first().click();
  await a.waitForTimeout(2000);

  /* ---- the coach finds out without going looking ---- */

  console.log('\nthe coach opens the roster');
  let body = await rosterBody();
  // A concern becomes a band row once several athletes share it (Slice 11's
  // threshold). On a small squad one person waiting is correctly just a row.
  const bandRow = /(\d+) athletes? waiting for a reply/i.exec(body);
  const allWaiting = (body.match(/Waiting for a reply/gi) ?? []).length;
  if (allWaiting >= 3) {
    check('the week\'s waiting replies are stated on arrival', Boolean(bandRow),
      `${allWaiting} waiting, no band row`);
  } else {
    check('one athlete waiting is a row, not a squad-wide concern',
      !bandRow, 'a concern two people share should not be stated as workload');
  }
  check('and the athlete is named on the roster, not on another page',
    /Waiting for a reply/i.test(await andrew().innerText()));

  const card = await andrew().innerText();
  check('with how long they have waited', /Waiting for a reply · \d+[mhd]/.test(card),
    card.split('\n').find((l) => /Waiting/.test(l)));
  check('and a way to answer them without leaving',
    await andrew().getByRole('button', { name: /^Reply/i }).count() > 0);

  /* ---- age is information, not a severity ---- */

  const ages = [...body.matchAll(/Waiting for a reply · (\d+)([mhd])/g)];
  check('waiting time is shown in a coach\'s units', ages.length > 0,
    ages.map((m) => m[1] + m[2]).join(', '));

  /* ---- the concern behaves like every other concern ---- */

  if (bandRow) {
    const row = p.locator('li').filter({ hasText: /athletes? waiting for a reply/i });
    await row.locator('button[aria-pressed]').click();
    await p.waitForTimeout(400);
    const shown = await rows().count();
    check('the count is the count of the list it opens', shown === Number(bandRow[1]),
      `${bandRow[1]} claimed, ${shown} shown`);
    check('and every athlete in it is actually waiting',
      (await rows().allInnerTexts()).every((t) => /Waiting for a reply/i.test(t)));
  }

  /* ---- looking at it is not answering it ---- */

  console.log('\nreading is not replying');
  // Nothing on the coach's side writes read_at, so "read" cannot be staged
  // through the browser; what the browser can prove is the half that used to
  // be wrong — that looking at the roster, repeatedly, settles nothing.
  await rosterBody();
  await rosterBody();
  check('opening the roster twice settles nothing',
    /Waiting for a reply/i.test(await andrew().innerText()),
    'the wait disappeared without anybody answering it');

  /* ---- on a phone, while somebody is still waiting ---- */

  console.log('\non a phone');
  await p.setViewportSize({ width: 390, height: 844 });
  await rosterBody();
  const overflow = await p.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  check('no horizontal overflow at 390px', overflow <= 1, `${overflow}px`);
  check('the wait is still readable at 390px',
    /Waiting for a reply · \d+[mhd]/.test(await andrew().innerText()));
  const mobileReply = andrew().getByRole('button', { name: /^Reply/i });
  check('and the reply action is still reachable', await mobileReply.count() > 0);
  await mobileReply.click();
  await p.waitForTimeout(450);
  const w = await andrew().locator('textarea').evaluate(
    (t) => Math.round(t.getBoundingClientRect().width)).catch(() => 0);
  check('and a reply can still be written', w > 200, `${w}px wide`);
  await andrew().getByRole('button', { name: /show less/i }).click().catch(() => {});
  await p.waitForTimeout(300);
  await p.setViewportSize({ width: 1440, height: 1200 });

  /* ---- answering, without leaving the roster ---- */

  console.log('\nanswering from the roster');
  body = await rosterBody();
  const before = {
    waiting: Number((/(\d+) athletes? waiting for a reply/i.exec(body) ?? [0, 0])[1]),
    pain: Number((/(\d+) athletes? reported pain/i.exec(body) ?? [0, 0])[1]),
    checkins: Number((/(\d+) check-ins? to answer/i.exec(body) ?? [0, 0])[1]),
    flagged: (body.match(/Check-in flagged/gi) ?? []).length,
  };

  // Slice 13 moved the box into the row's disclosure. Reply opens the row and
  // puts the cursor in the box — the same one click as clicking into a box
  // that was already sitting open, and 186px per card cheaper on a phone.
  const replyBtn = andrew().getByRole('button', { name: /^Reply/i });
  check('the reply action is on the roster, not a page away', await replyBtn.count() > 0);
  await replyBtn.click();
  await p.waitForTimeout(500);

  const reply = andrew().locator('textarea');
  check('and one click opens it with the cursor already in it',
    await reply.count() > 0 && await reply.evaluate((el) => document.activeElement === el));
  check('with the athlete\'s own words above it',
    (await andrew().innerText()).includes(words.slice(0, 30)));

  await reply.fill('Skip the intervals. Easy 40 minutes, and we look at the calf Thursday.');
  await andrew().getByRole('button', { name: /send reply/i }).click();
  await p.waitForTimeout(2500);

  body = await rosterBody();
  const after = {
    waiting: Number((/(\d+) athletes? waiting for a reply/i.exec(body) ?? [0, 0])[1]),
    pain: Number((/(\d+) athletes? reported pain/i.exec(body) ?? [0, 0])[1]),
    checkins: Number((/(\d+) check-ins? to answer/i.exec(body) ?? [0, 0])[1]),
    flagged: (body.match(/Check-in flagged/gi) ?? []).length,
  };

  check('answering settles that athlete\'s wait',
    after.waiting === Math.max(0, before.waiting - 1),
    `${before.waiting} -> ${after.waiting}`);
  check('and leaves reported pain exactly where it was',
    after.pain === before.pain, `${before.pain} -> ${after.pain}`);
  check('and leaves the check-in queue alone',
    after.checkins === before.checkins, `${before.checkins} -> ${after.checkins}`);
  check('and does not settle anybody\'s flagged check-in',
    after.flagged === before.flagged, `${before.flagged} -> ${after.flagged}`);
  check('the athlete is no longer listed as waiting',
    !/Waiting for a reply/i.test(await andrew().innerText().catch(() => '')));

  /* ---- the athlete gets the answer ---- */

  console.log('\nwhat the athlete sees');
  await a.goto(`${BASE}/app/coach`, { waitUntil: 'networkidle' });
  await a.waitForTimeout(600);
  const seen = await a.locator('body').innerText();
  check('the coach\'s reply reaches the athlete', /Skip the intervals/.test(seen));
  check('and is not attributed to FORGE',
    !/FORGE[\s\S]{0,60}Skip the intervals/.test(seen));

  check('no console errors', errors.length === 0, errors.slice(0, 2).join(' | '));
} finally {
  await browser.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
