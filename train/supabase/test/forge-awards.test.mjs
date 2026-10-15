import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/**
 * Forge points against the real database (migration 0024). Before it,
 * nothing on this path awarded anything, and a full week made the log throw.
 */

let t;
let athlete, other;
const WEEK = '2026-10-05'; // a Monday

const session = async (who, date, name, type = 'easy_run') => {
  const { rows } = await t.asService(
    `insert into scheduled_workouts (athlete_id, date, name, type, status) values ($1, $2, $3, $4, 'scheduled') returning id`,
    [who, date, name, type],
  );
  return rows[0].id;
};
const log = (who, sid, date) =>
  t.asUser(who, `insert into completed_workouts (athlete_id, scheduled_workout_id, date, type, source) values ($1, $2, $3, 'easy_run', 'manual') returning id`, [who, sid, date]);
const markDone = (who, sid) => t.asUser(who, `update scheduled_workouts set status = 'completed' where id = $1`, [sid]);
const ledger = async (who) =>
  (await t.asService('select kind, points, label from forge_score_events where athlete_id = $1 order by created_at', [who])).rows;

let s1, s2, club;

before(async () => {
  t = await createTestDatabase();
  athlete = await t.signUp('athlete@example.com', 'An Athlete');
  other = await t.signUp('other@example.com', 'Other');
  s1 = await session(athlete, WEEK, 'Easy 8K');
  club = await session(athlete, '2026-10-11', 'Saturday Iron Miles club run');
  s2 = await session(athlete, '2026-10-08', 'Tempo', 'tempo');
  await session(athlete, '2026-10-09', 'Rest', 'rest');
});

after(async () => t?.close());

describe('forge points from the database', () => {
  it('a logged run earns 10, once', async () => {
    await log(athlete, s1, WEEK);
    await markDone(athlete, s1);
    await t.asUser(athlete, `update completed_workouts set scheduled_workout_id = $1 where scheduled_workout_id = $1`, [s1]);
    const rows = (await ledger(athlete)).filter((r) => r.kind === 'run_completed');
    assert.deepEqual(rows.map((r) => [r.points, r.label]), [[10, 'Easy 8K']]);
  });

  it('a club run is community attendance', async () => {
    await log(athlete, club, '2026-10-11');
    await markDone(athlete, club);
    assert.ok((await ledger(athlete)).some((r) => r.kind === 'community_run' && r.points === 10));
  });

  it('no week bonus while a session is still open', async () => {
    assert.ok(!(await ledger(athlete)).some((r) => r.kind === 'full_week_adherence'));
  });

  it('the last session of the week earns the 20-point bonus, once, and rest days do not count against it', async () => {
    await log(athlete, s2, '2026-10-08');
    await markDone(athlete, s2);
    const bonus = (await ledger(athlete)).filter((r) => r.kind === 'full_week_adherence');
    assert.equal(bonus.length, 1);
    assert.equal(bonus[0].points, 20);
  });

  it('a prescribed strength session earns 8 when completed, once — an unplanned one earns nothing', async () => {
    const { rows: tpl } = await t.asService(`select id from strength_templates limit 1`);
    assert.ok(tpl.length, 'the seeded library supplies a strength template');
    const planned = await session(athlete, '2026-10-06', 'Strength A', 'strength');
    const { rows } = await t.asUser(
      athlete,
      `insert into strength_sessions (athlete_id, template_id, scheduled_workout_id, date, status) values ($1, $2, $3, '2026-10-06', 'scheduled') returning id`,
      [athlete, tpl[0].id, planned],
    );
    assert.ok(!(await ledger(athlete)).some((r) => r.kind === 'strength_completed'));
    await t.asUser(athlete, `update strength_sessions set status = 'completed' where id = $1`, [rows[0].id]);
    await t.asUser(athlete, `update strength_sessions set status = 'scheduled' where id = $1`, [rows[0].id]);
    await t.asUser(athlete, `update strength_sessions set status = 'completed' where id = $1`, [rows[0].id]);
    assert.equal((await ledger(athlete)).filter((r) => r.kind === 'strength_completed').length, 1);

    await t.asUser(athlete, `insert into strength_sessions (athlete_id, template_id, date, status) values ($1, $2, '2026-10-07', 'completed')`, [athlete, tpl[0].id]);
    assert.equal((await ledger(athlete)).filter((r) => r.kind === 'strength_completed').length, 1, 'unplanned: nothing');
  });

  it('a check-in earns 5', async () => {
    await t.asUser(
      athlete,
      `insert into checkins (athlete_id, week_start, fatigue, sleep, soreness, stress, motivation, confidence, training_difficulty)
       values ($1, $2, 5,7,4,3,8,7,6)`,
      [athlete, WEEK],
    );
    assert.ok((await ledger(athlete)).some((r) => r.kind === 'checkin_completed' && r.points === 5));
  });
});

describe('nobody awards themselves', () => {
  it('re-creating strength rows for the same planned session earns nothing more', async () => {
    const { rows: tpl } = await t.asService(`select id from strength_templates limit 1`);
    const planned = await session(athlete, '2026-10-20', 'Strength B', 'strength');
    for (let i = 0; i < 5; i++) {
      const { rows } = await t.asUser(
        athlete,
        `insert into strength_sessions (athlete_id, template_id, scheduled_workout_id, date, status) values ($1, $2, $3, '2026-10-20', 'completed') returning id`,
        [athlete, tpl[0].id, planned],
      );
      await t.asUser(athlete, 'delete from strength_sessions where id = $1', [rows[0].id]);
    }
    const awards = (await ledger(athlete)).filter((r) => r.kind === 'strength_completed' && r.label === 'Strength session');
    assert.equal(awards.length, 2, 'one per planned session: Strength A and Strength B');
  });

  it('deleting and resubmitting a check-in earns nothing more', async () => {
    for (let i = 0; i < 3; i++) {
      await t.asUser(athlete, 'delete from checkins where athlete_id = $1 and week_start = $2', [athlete, '2026-10-19']);
      await t.asUser(
        athlete,
        `insert into checkins (athlete_id, week_start, fatigue, sleep, soreness, stress, motivation, confidence, training_difficulty) values ($1, '2026-10-19', 5,7,4,3,8,7,6)`,
        [athlete],
      );
    }
    const week = (await t.asService(`select count(*)::int as n from forge_score_events where athlete_id = $1 and kind = 'checkin_completed' and date = '2026-10-19'`, [athlete])).rows[0].n;
    assert.equal(week, 1);
  });

  it('an athlete cannot move a session out of its week, so cannot farm the week bonus', async () => {
    const s = await session(athlete, '2026-11-02', 'Easy');
    const refused = await t.expectRefused(athlete, `update scheduled_workouts set date = '2026-11-09' where id = $1`, [s]);
    assert.match(refused ?? '', /within their own week/);
    await t.asUser(athlete, `update scheduled_workouts set date = '2026-11-04' where id = $1`, [s]);
    assert.equal((await t.asService('select date::text as d from scheduled_workouts where id = $1', [s])).rows[0].d, '2026-11-04', 'within the week is fine');
  });

  it('nor rewrite the prescription — renaming a session "club run" is refused', async () => {
    const s = await session(athlete, '2026-11-03', 'Easy');
    const refused = await t.expectRefused(athlete, `update scheduled_workouts set name = 'Iron Miles club run' where id = $1`, [s]);
    assert.match(refused ?? '', /coach/);
  });

  it('their coach still edits the plan freely', async () => {
    const coach = await t.signUp('coach.forge@ironmiles.ie', 'Coach');
    await t.setRole(coach, 'coach');
    await t.asService(`insert into coach_athlete_links (coach_id, athlete_id, status) values ($1, $2, 'active')`, [coach, athlete]);
    const s = await session(athlete, '2026-11-05', 'Easy');
    await t.asUser(coach, `update scheduled_workouts set name = 'Tempo', date = '2026-11-12' where id = $1`, [s]);
    assert.equal((await t.asService('select name from scheduled_workouts where id = $1', [s])).rows[0].name, 'Tempo');
  });

  it('an athlete cannot write the ledger', async () => {
    const refused = await t.expectRefused(
      athlete,
      `insert into forge_score_events (athlete_id, kind, points, date, label) values ($1, 'milestone', 1000, current_date, 'me')`,
      [athlete],
    );
    assert.ok(refused);
  });

  it('nor run an award function directly', async () => {
    for (const fn of ['im_forge_on_log', 'im_forge_on_strength', 'im_forge_on_checkin', 'im_forge_on_session_complete']) {
      const refused = await t.expectRefused(athlete, `select ${fn}()`);
      assert.match(refused ?? '', /trigger/, `${fn} must only run as a trigger`);
    }
  });

  it('logging against somebody else’s session earns nothing', async () => {
    const theirs = await session(other, WEEK, 'Easy');
    await log(athlete, theirs, WEEK).catch(() => {});
    assert.equal((await ledger(athlete)).filter((r) => r.label === 'Easy').length, 0);
    assert.equal((await ledger(other)).length, 0);
  });
});
