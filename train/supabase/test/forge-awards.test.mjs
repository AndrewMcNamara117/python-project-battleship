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

  it('a strength session earns 8 when completed, not when saved in progress, and only once', async () => {
    const { rows: tpl } = await t.asService(`select id from strength_templates limit 1`);
    assert.ok(tpl.length, 'the seeded library supplies a strength template');
    const { rows } = await t.asUser(
      athlete,
      `insert into strength_sessions (athlete_id, template_id, date, status) values ($1, $2, '2026-10-06', 'scheduled') returning id`,
      [athlete, tpl[0].id],
    );
    assert.ok(!(await ledger(athlete)).some((r) => r.kind === 'strength_completed'));
    await t.asUser(athlete, `update strength_sessions set status = 'completed' where id = $1`, [rows[0].id]);
    await t.asUser(athlete, `update strength_sessions set status = 'scheduled' where id = $1`, [rows[0].id]);
    await t.asUser(athlete, `update strength_sessions set status = 'completed' where id = $1`, [rows[0].id]);
    assert.equal((await ledger(athlete)).filter((r) => r.kind === 'strength_completed').length, 1);
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
