import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/**
 * Forge points against the real database (migration 0024). Before it,
 * nothing on this path awarded anything, and a full week made the log throw.
 */

let t;
let athlete, other;
// Dates relative to today: the triggers refuse to award a day that has not
// come yet, so a fixed calendar would turn these red as the weeks pass.
const iso = (d) => d.toISOString().slice(0, 10);
const monday = (weeksAgo) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) - 7 * weeksAgo);
  return iso(d);
};
const plus = (date, days) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};
const WEEK = monday(2);
const LAST = monday(1);
const OLD = monday(4);
const NEXT = monday(-2);

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

const checkin = (who, weekStart) =>
  t.asUser(
    who,
    `insert into checkins (athlete_id, week_start, fatigue, sleep, soreness, stress, motivation, confidence, training_difficulty) values ($1, $2, 5,7,4,3,8,7,6)`,
    [who, weekStart],
  );
const awardsOf = async (who, kind) => (await ledger(who)).filter((r) => r.kind === kind).length;

let s1, s2, club;

before(async () => {
  t = await createTestDatabase();
  athlete = await t.signUp('athlete@example.com', 'An Athlete');
  other = await t.signUp('other@example.com', 'Other');
  s1 = await session(athlete, WEEK, 'Easy 8K');
  club = await session(athlete, plus(WEEK, 6), 'Saturday Iron Miles club run');
  s2 = await session(athlete, plus(WEEK, 3), 'Tempo', 'tempo');
  await session(athlete, plus(WEEK, 4), 'Rest', 'rest');
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
    await log(athlete, club, plus(WEEK, 6));
    await markDone(athlete, club);
    assert.ok((await ledger(athlete)).some((r) => r.kind === 'community_run' && r.points === 10));
  });

  it('no week bonus while a session is still open', async () => {
    assert.ok(!(await ledger(athlete)).some((r) => r.kind === 'full_week_adherence'));
  });

  it('the last session of the week earns the 20-point bonus, once, and rest days do not count against it', async () => {
    await log(athlete, s2, plus(WEEK, 3));
    await markDone(athlete, s2);
    const bonus = (await ledger(athlete)).filter((r) => r.kind === 'full_week_adherence');
    assert.equal(bonus.length, 1);
    assert.equal(bonus[0].points, 20);
  });

  it('a prescribed strength session earns 8 when completed, once — an unplanned one earns nothing', async () => {
    const { rows: tpl } = await t.asService(`select id from strength_templates limit 1`);
    assert.ok(tpl.length, 'the seeded library supplies a strength template');
    const planned = await session(athlete, plus(WEEK, 1), 'Strength A', 'strength');
    const { rows } = await t.asUser(
      athlete,
      `insert into strength_sessions (athlete_id, template_id, scheduled_workout_id, date, status) values ($1, $2, $3, $4, 'scheduled') returning id`,
      [athlete, tpl[0].id, planned, plus(WEEK, 1)],
    );
    assert.ok(!(await ledger(athlete)).some((r) => r.kind === 'strength_completed'));
    await t.asUser(athlete, `update strength_sessions set status = 'completed' where id = $1`, [rows[0].id]);
    await t.asUser(athlete, `update strength_sessions set status = 'scheduled' where id = $1`, [rows[0].id]);
    await t.asUser(athlete, `update strength_sessions set status = 'completed' where id = $1`, [rows[0].id]);
    assert.equal((await ledger(athlete)).filter((r) => r.kind === 'strength_completed').length, 1);

    await t.asUser(athlete, `insert into strength_sessions (athlete_id, template_id, date, status) values ($1, $2, $3, 'completed')`, [athlete, tpl[0].id, plus(WEEK, 2)]);
    assert.equal((await ledger(athlete)).filter((r) => r.kind === 'strength_completed').length, 1, 'unplanned: nothing');
  });

  it('a check-in earns 5', async () => {
    await checkin(athlete, WEEK);
    assert.ok((await ledger(athlete)).some((r) => r.kind === 'checkin_completed' && r.points === 5));
  });
});

describe('nobody awards themselves', () => {
  it('re-creating strength rows for the same planned session earns nothing more', async () => {
    const { rows: tpl } = await t.asService(`select id from strength_templates limit 1`);
    const planned = await session(athlete, plus(LAST, 1), 'Strength B', 'strength');
    for (let i = 0; i < 5; i++) {
      const { rows } = await t.asUser(
        athlete,
        `insert into strength_sessions (athlete_id, template_id, scheduled_workout_id, date, status) values ($1, $2, $3, $4, 'completed') returning id`,
        [athlete, tpl[0].id, planned, plus(LAST, 1)],
      );
      await t.asUser(athlete, 'delete from strength_sessions where id = $1', [rows[0].id]);
    }
    const awards = (await ledger(athlete)).filter((r) => r.kind === 'strength_completed' && r.label === 'Strength session');
    assert.equal(awards.length, 2, 'one per planned session: Strength A and Strength B');
  });

  it('deleting and resubmitting a check-in earns nothing more', async () => {
    for (let i = 0; i < 3; i++) {
      await t.asUser(athlete, 'delete from checkins where athlete_id = $1 and week_start = $2', [athlete, LAST]);
      await checkin(athlete, LAST);
    }
    const week = (await t.asService(`select count(*)::int as n from forge_score_events where athlete_id = $1 and kind = 'checkin_completed' and date = $2`, [athlete, LAST])).rows[0].n;
    assert.equal(week, 1);
  });

  it('an athlete cannot move a session out of its week, so cannot farm the week bonus', async () => {
    const s = await session(athlete, OLD, 'Easy');
    const refused = await t.expectRefused(athlete, `update scheduled_workouts set date = $2 where id = $1`, [s, plus(OLD, 7)]);
    assert.match(refused ?? '', /within their own week/);
    await t.asUser(athlete, `update scheduled_workouts set date = $2 where id = $1`, [s, plus(OLD, 2)]);
    assert.equal((await t.asService('select date::text as d from scheduled_workouts where id = $1', [s])).rows[0].d, plus(OLD, 2), 'within the week is fine');
  });

  it('nor rewrite the prescription — renaming a session "club run" is refused', async () => {
    const s = await session(athlete, plus(OLD, 1), 'Easy');
    const refused = await t.expectRefused(athlete, `update scheduled_workouts set name = 'Iron Miles club run' where id = $1`, [s]);
    assert.match(refused ?? '', /coach/);
  });

  it('their coach still edits the plan freely', async () => {
    const coach = await t.signUp('coach.forge@ironmiles.ie', 'Coach');
    await t.setRole(coach, 'coach');
    await t.asService(`insert into coach_athlete_links (coach_id, athlete_id, status) values ($1, $2, 'active')`, [coach, athlete]);
    const s = await session(athlete, plus(OLD, 3), 'Easy');
    await t.asUser(coach, `update scheduled_workouts set name = 'Tempo', date = $2 where id = $1`, [s, plus(OLD, 10)]);
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

describe('points for what happened, not for what a client says happened', () => {
  it('a check-in dated any other day of a credited week earns nothing more', async () => {
    const before = await awardsOf(athlete, 'checkin_completed');
    for (const d of [1, 2, 6]) await checkin(athlete, plus(WEEK, d)).catch(() => {});
    assert.equal(await awardsOf(athlete, 'checkin_completed'), before);
  });

  it('a check-in for a week that has not come earns nothing', async () => {
    const before = await awardsOf(athlete, 'checkin_completed');
    await checkin(athlete, NEXT).catch(() => {});
    assert.equal(await awardsOf(athlete, 'checkin_completed'), before);
  });

  it('a strength session against a run on the plan earns nothing', async () => {
    const { rows: tpl } = await t.asService(`select id from strength_templates limit 1`);
    const before = await awardsOf(athlete, 'strength_completed');
    const run = await session(athlete, plus(OLD, 4), 'Easy 6K');
    await t.asUser(
      athlete,
      `insert into strength_sessions (athlete_id, template_id, scheduled_workout_id, date, status) values ($1, $2, $3, $4, 'completed')`,
      [athlete, tpl[0].id, run, plus(OLD, 4)],
    );
    assert.equal(await awardsOf(athlete, 'strength_completed'), before);
  });

  it('nor one done ahead of its day', async () => {
    const { rows: tpl } = await t.asService(`select id from strength_templates limit 1`);
    const before = await awardsOf(athlete, 'strength_completed');
    const later = await session(athlete, plus(NEXT, 1), 'Strength C', 'strength');
    await t.asUser(
      athlete,
      `insert into strength_sessions (athlete_id, template_id, scheduled_workout_id, date, status) values ($1, $2, $3, $4, 'completed')`,
      [athlete, tpl[0].id, later, plus(NEXT, 1)],
    );
    assert.equal(await awardsOf(athlete, 'strength_completed'), before);
  });

  it('a run logged against a session weeks away earns nothing', async () => {
    const before = await awardsOf(athlete, 'run_completed');
    const later = await session(athlete, plus(NEXT, 2), 'Long run');
    await log(athlete, later, plus(NEXT, 2));
    assert.equal(await awardsOf(athlete, 'run_completed'), before);
  });

  it('an athlete cannot mark a session completed without logging it, nor before its day', async () => {
    const unlogged = await session(athlete, plus(OLD, 5), 'Easy');
    assert.match((await t.expectRefused(athlete, `update scheduled_workouts set status = 'completed' where id = $1`, [unlogged])) ?? '', /Log the session/);
    const later = await session(athlete, plus(NEXT, 3), 'Easy');
    await log(athlete, later, plus(NEXT, 3));
    assert.match((await t.expectRefused(athlete, `update scheduled_workouts set status = 'completed' where id = $1`, [later])) ?? '', /before its day/);
  });

  it('but can still mark one skipped or missed, and back', async () => {
    const s = await session(athlete, plus(OLD, 6), 'Easy');
    for (const status of ['skipped', 'missed', 'scheduled']) {
      await t.asUser(athlete, `update scheduled_workouts set status = $2 where id = $1`, [s, status]);
    }
    assert.equal((await t.asService('select status from scheduled_workouts where id = $1', [s])).rows[0].status, 'scheduled');
  });

  it('every other column is the coach’s, including ones added later', async () => {
    const s = await session(athlete, plus(OLD, -1), 'Easy');
    for (const change of [`prescription_revision = 99`, `prescribed_by = athlete_id`, `coach_note = 'mine'`, `pace_min_sec_km = 200`]) {
      assert.ok(await t.expectRefused(athlete, `update scheduled_workouts set ${change}, status = 'skipped' where id = $1`, [s]), change);
    }
  });

  it('a coach deleting a race on someone else’s athlete’s plan is not refused by the guard', async () => {
    const stranger = await t.signUp('coach.stranger@ironmiles.ie', 'Stranger Coach');
    await t.setRole(stranger, 'coach');
    const { rows } = await t.asUser(stranger, `insert into races (name, date, event_type, created_by) values ('Limerick 10K', $1, '10k', $2) returning id`, [NEXT, stranger]);
    const s = await session(athlete, NEXT, 'Race');
    await t.asService(`update scheduled_workouts set race_id = $2 where id = $1`, [s, rows[0].id]);
    await t.asUser(stranger, `delete from races where id = $1`, [rows[0].id]);
    assert.equal((await t.asService('select race_id from scheduled_workouts where id = $1', [s])).rows[0].race_id, null);
  });
});

describe('a deleted log gives its points back', () => {
  it('the run’s points and its week’s bonus go, and logging again earns them once', async () => {
    const who = await t.signUp('unlog@example.com', 'Unlog');
    const wk = monday(3);
    const only = await session(who, plus(wk, 2), 'Easy 5K');
    const { rows } = await log(who, only, plus(wk, 2));
    await markDone(who, only);
    assert.deepEqual([await awardsOf(who, 'run_completed'), await awardsOf(who, 'full_week_adherence')], [1, 1]);

    await t.asUser(who, 'delete from completed_workouts where id = $1', [rows[0].id]);
    assert.deepEqual([await awardsOf(who, 'run_completed'), await awardsOf(who, 'full_week_adherence')], [0, 0]);

    await log(who, only, plus(wk, 2));
    assert.equal(await awardsOf(who, 'run_completed'), 1);
  });
});
