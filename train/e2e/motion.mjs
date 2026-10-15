/**
 * Motion never hides information.
 *
 * With prefers-reduced-motion on, every page must render its content shown —
 * nothing left at opacity 0 waiting for an animation. The server cannot know
 * the preference, so anything it renders in a hidden starting state has to be
 * settled by CSS; this walks the app as each role and finds any text that was
 * not.
 *
 *   BASE_URL=http://localhost:3000 node e2e/motion.mjs
 */
import { chromium } from 'playwright-core';

const BASE = process.env.BASE_URL ?? 'http://localhost:3000';
const CHROMIUM = process.env.CHROMIUM_PATH;

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

const PAGES = {
  public: ['/', '/coaching', '/pricing'],
  athlete: ['/app', '/app/today', '/app/progress', '/app/activities', '/app/club', '/app/segments', '/app/challenges', '/app/notifications', '/app/forge', '/app/leaderboard', '/app/profile'],
  coach: ['/coach', '/coach/athletes', '/coach/athletes/demo-athlete-andrew', '/coach/races', '/coach/messages', '/coach/applications', '/coach/analytics', '/coach/challenges', '/coach/segments'],
};

const browser = await chromium.launch({ ...(CHROMIUM ? { executablePath: CHROMIUM } : {}) });
for (const [role, paths] of Object.entries(PAGES)) {
  console.log(`\n${role.toUpperCase()}, reduced motion`);
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
  if (role !== 'public') await ctx.addCookies([{ name: 'im_demo_session', value: role, url: BASE }]);
  const page = await ctx.newPage();
  for (const path of paths) {
    await page.goto(BASE + path, { waitUntil: 'networkidle' });
    await page.waitForTimeout(400);
    // text whose own box, or any ancestor's, is fully transparent
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll('body *')]
        .filter((e) => e.children.length === 0 && e.textContent.trim() && e.getClientRects().length)
        .filter((e) => {
          for (let x = e; x; x = x.parentElement) if (getComputedStyle(x).opacity === '0') return true;
          return false;
        })
        .map((e) => e.textContent.trim().slice(0, 40)),
    );
    check(`${path} shows all its text`, hidden.length === 0, `${hidden.length} hidden, e.g. ${JSON.stringify(hidden.slice(0, 3))}`);
  }
  await ctx.close();
}
await browser.close();

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
