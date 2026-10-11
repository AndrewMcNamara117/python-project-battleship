import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/**
 * The adaptation loop.
 *
 * Three things held apart throughout: what was originally prescribed, what is
 * prescribed now, and what the athlete actually did. Adapting the future must
 * never rewrite the last of those.
 */

let t, coachA, coachB, athlete, MON, GENERAL;

const iso = (d) => d.toISOString().slice(0, 10);
const nextMonday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 7);
  return iso(d);
};
const plus = (date, days) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};

before(async () => {
  t = await createTestDatabase();
  coachA = await t.signUp('a@im.ie'); coachB = await t.signUp('b@im.ie');
  athlete = await t.signUp('ath@im.ie');
  await t.setRole(coachA, 'coach'); await t.setRole(coachB, 'coach');
  await t.asService(`update profiles set full_name='R. Doyle' where id=$1`, [coachA]);
  await t.asService(`insert into coach_athlete_links (coach_id,athlete_id,status) values ($1,$2,'active')`, [coachA, athlete]);
  MON = nextMonday();
  ({ rows: [GENERAL] } = await t.asService(`select id from program_templates where name='General Endurance'`));
});
after(async () => t?.close());

/** A fresh programme for each block of tests, so one cannot poison the next. */
let programId;
beforeEach(async () => {
  // inside out: the block guard from Slice 3 refuses to drop a block that
  // still holds weeks, which is exactly what it is there for
  await t.asService(`delete from scheduled_workouts where athlete_id=$1`, [athlete]);
  await t.asService(`delete from program_weeks where athlete_id=$1`, [athlete]);
  await t.asService(`delete from program_blocks where athlete_id=$1`, [athlete]);
  await t.asService(`delete from programs where athlete_id=$1`, [athlete]);
  ({ rows: [{ id: programId }] } = await t.asUser(coachA,
    `select im_instantiate_program_template($1,$2,$3::date) id`, [GENERAL.id, athlete, MON]));
});

const sessionsOn = async (date) =>
  (await t.asService(
    `select id, name, slot, status, date from scheduled_workouts where athlete_id=$1 and date=$2::date order by slot`,
    [athlete, date])).rows;

const firstTraining = async () =>
  (await t.asService(
    `select id, name, date, slot, distance_km, program_week_id from scheduled_workouts
      where program_id=$1 and type<>'rest' order by date limit 1`, [programId])).rows[0];

describe('moving a session', () => {
  it('moves it, and re-homes it in the week that now contains it', async () => {
    const s = await firstTraining();
    const target = plus(s.date, 9);   // into the following week

    await t.asUser(coachA, `select im_move_session($1,$2::date)`, [s.id, target]);

    const { rows } = await t.asService(
      `select date, program_week_id from scheduled_workouts where id=$1`, [s.id]);
    assert.equal(iso(rows[0].date), target);
    assert.notEqual(rows[0].program_week_id, s.program_week_id,
      'a session that crosses a week boundary belongs to the week it lands in');

    const { rows: week } = await t.asService(
      `select start_date from program_weeks where id=$1`, [rows[0].program_week_id]);
    const start = iso(week[0].start_date);
    assert.ok(target >= start && target < plus(start, 7), 'and that week actually contains it');
  });

  it('records the move without losing what was first prescribed', async () => {
    const s = await firstTraining();
    await t.asUser(coachA, `select im_move_session($1,$2::date)`, [s.id, plus(s.date, 2)]);

    const { rows } = await t.asUser(coachA, `select * from im_session_history($1)`, [s.id]);
    assert.ok(rows.length >= 2, 'the move is a revision');
    assert.equal(rows[0].revision, 1);
    assert.equal(iso(new Date(rows[0].session.date)), iso(s.date),
      'revision one still holds the original date');
    assert.equal(rows.at(-1).kind, 'moved');
    assert.equal(rows.at(-1).changed_by, coachA, 'and who moved it');
  });

  it('refuses to move onto an occupied slot', async () => {
    const s = await firstTraining();
    const { rows: other } = await t.asService(
      `select date, slot from scheduled_workouts where program_id=$1 and id<>$2 and slot=$3
        order by date limit 1`, [programId, s.id, s.slot]);
    const refused = await t.expectRefused(coachA,
      `select im_move_session($1,$2::date)`, [s.id, iso(other[0].date)]);
    assert.match(refused, /already a session in that slot/i);
  });

  it('refuses to move a completed session', async () => {
    const s = await firstTraining();
    await t.asService(`update scheduled_workouts set status='completed' where id=$1`, [s.id]);
    const refused = await t.expectRefused(coachA,
      `select im_move_session($1,$2::date)`, [s.id, plus(s.date, 1)]);
    assert.match(refused, /already completed/i);
  });

  it('refuses to move a session with a logged result', async () => {
    const s = await firstTraining();
    await t.asService(
      `insert into completed_workouts (scheduled_workout_id, athlete_id, date, type, actual_distance_km, source)
       values ($1,$2,$3::date,'easy_run',10,'manual')`, [s.id, athlete, s.date]);
    const refused = await t.expectRefused(coachA,
      `select im_move_session($1,$2::date)`, [s.id, plus(s.date, 1)]);
    assert.match(refused, /logged result/i);
  });

  it('refuses to move outside the programme', async () => {
    const s = await firstTraining();
    const refused = await t.expectRefused(coachA,
      `select im_move_session($1,$2::date)`, [s.id, plus(s.date, 400)]);
    assert.match(refused, /outside the programme/i);
  });

  it('refuses a coach who does not have the athlete', async () => {
    const s = await firstTraining();
    const refused = await t.expectRefused(coachB,
      `select im_move_session($1,$2::date)`, [s.id, plus(s.date, 1)]);
    assert.match(refused, /roster/i);
  });
});

describe('swapping two sessions', () => {
  it('exchanges their dates without a transient collision', async () => {
    const { rows: two } = await t.asService(
      `select id, date, slot, name from scheduled_workouts
        where program_id=$1 and type<>'rest' order by date limit 2`, [programId]);
    const [a, b] = two;

    await t.asUser(coachA, `select im_swap_sessions($1,$2)`, [a.id, b.id]);

    const { rows } = await t.asService(
      `select id, date from scheduled_workouts where id in ($1,$2)`, [a.id, b.id]);
    const byId = Object.fromEntries(rows.map((r) => [r.id, iso(r.date)]));
    assert.equal(byId[a.id], iso(b.date));
    assert.equal(byId[b.id], iso(a.date));
  });

  it('refuses to swap a completed session', async () => {
    const { rows: two } = await t.asService(
      `select id from scheduled_workouts where program_id=$1 and type<>'rest' order by date limit 2`, [programId]);
    await t.asService(`update scheduled_workouts set status='completed' where id=$1`, [two[0].id]);
    const refused = await t.expectRefused(coachA, `select im_swap_sessions($1,$2)`, [two[0].id, two[1].id]);
    assert.match(refused, /already completed/i);
  });
});

describe('shifting a range', () => {
  it('previews without changing anything', async () => {
    const before = await sessionsOn(MON);
    const { rows } = await t.asUser(coachA,
      `select * from im_shift_sessions($1,$2::date,$3::date,2,false)`, [athlete, MON, plus(MON, 6)]);
    assert.ok(rows.length > 0, 'the preview describes the week');
    assert.ok(rows.some((r) => r.action === 'move'));

    const after = await sessionsOn(MON);
    assert.deepEqual(after.map((s) => s.id), before.map((s) => s.id), 'preview writes nothing');
  });

  it('applies the same rows it previewed', async () => {
    const preview = (await t.asUser(coachA,
      `select * from im_shift_sessions($1,$2::date,$3::date,2,false)`, [athlete, MON, plus(MON, 6)])).rows;
    const applied = (await t.asUser(coachA,
      `select * from im_shift_sessions($1,$2::date,$3::date,2,true)`, [athlete, MON, plus(MON, 6)])).rows;

    assert.deepEqual(
      applied.map((r) => [r.session_id, r.action]),
      preview.map((r) => [r.session_id, r.action]),
      'what the coach confirmed is what ran');

    for (const row of applied.filter((r) => r.action === 'move')) {
      const { rows } = await t.asService(`select date from scheduled_workouts where id=$1`, [row.session_id]);
      assert.equal(iso(rows[0].date), iso(row.to_date));
    }
  });

  it('re-homes shifted sessions into the week they land in', async () => {
    await t.asUser(coachA,
      `select * from im_shift_sessions($1,$2::date,$3::date,7,true)`, [athlete, MON, plus(MON, 6)]);
    const { rows } = await t.asService(`
      select count(*)::int wrong
        from scheduled_workouts s join program_weeks w on w.id = s.program_week_id
       where s.program_id=$1 and (s.date < w.start_date or s.date >= w.start_date + 7)`, [programId]);
    assert.equal(rows[0].wrong, 0, 'no session ends up in a week that does not contain it');
  });

  it('never moves completed training, and says why', async () => {
    const s = await firstTraining();
    await t.asService(`update scheduled_workouts set status='completed' where id=$1`, [s.id]);

    const rows = (await t.asUser(coachA,
      `select * from im_shift_sessions($1,$2::date,$3::date,3,true)`, [athlete, MON, plus(MON, 6)])).rows;
    const blocked = rows.find((r) => r.session_id === s.id);
    assert.ok(blocked);
    assert.equal(blocked.action, 'blocked');
    assert.match(blocked.detail, /already completed/i);

    const { rows: after } = await t.asService(`select date from scheduled_workouts where id=$1`, [s.id]);
    assert.equal(iso(after[0].date), iso(s.date), 'and it did not move');
  });

  it('leaves the past where it is', async () => {
    // a session yesterday, inside the range
    const yesterday = plus(iso(new Date()), -1);
    await t.asService(
      `insert into scheduled_workouts (athlete_id, date, slot, status, name, type, basis, intensity)
       values ($1,$2::date,5,'scheduled','Yesterday','easy_run','distance','easy')`, [athlete, yesterday]);

    const rows = (await t.asUser(coachA,
      `select * from im_shift_sessions($1,$2::date,$3::date,1,true)`,
      [athlete, plus(yesterday, -2), plus(yesterday, 2)])).rows;
    const past = rows.find((r) => r.name === 'Yesterday');
    assert.ok(past);
    assert.equal(past.action, 'keep');
    assert.match(past.detail, /past/i);
  });

  it('refuses a zero shift and a backwards range', async () => {
    assert.ok(await t.expectRefused(coachA,
      `select * from im_shift_sessions($1,$2::date,$3::date,0,false)`, [athlete, MON, plus(MON, 6)]));
    assert.ok(await t.expectRefused(coachA,
      `select * from im_shift_sessions($1,$2::date,$3::date,1,false)`, [athlete, plus(MON, 6), MON]));
  });

  it('refuses a coach who does not have the athlete', async () => {
    const refused = await t.expectRefused(coachB,
      `select * from im_shift_sessions($1,$2::date,$3::date,1,false)`, [athlete, MON, plus(MON, 6)]);
    assert.match(refused, /roster/i);
  });
});

describe('adjusting volume', () => {
  it('previews the change per session', async () => {
    const rows = (await t.asUser(coachA,
      `select * from im_scale_volume($1,$2::date,$3::date,0.8,false)`, [athlete, MON, plus(MON, 6)])).rows;
    const scaled = rows.filter((r) => r.action === 'scale');
    assert.ok(scaled.length > 0);
    for (const r of scaled) {
      assert.ok(Number(r.to_km) < Number(r.from_km), 'pulling back reduces the distance');
    }
  });

  it('applies it', async () => {
    const before = (await t.asService(
      `select coalesce(sum(distance_km),0) km from scheduled_workouts
        where athlete_id=$1 and date between $2::date and $3::date`, [athlete, MON, plus(MON, 6)])).rows[0].km;

    await t.asUser(coachA, `select * from im_scale_volume($1,$2::date,$3::date,0.8,true)`,
      [athlete, MON, plus(MON, 6)]);

    const after = (await t.asService(
      `select coalesce(sum(distance_km),0) km from scheduled_workouts
        where athlete_id=$1 and date between $2::date and $3::date`, [athlete, MON, plus(MON, 6)])).rows[0].km;
    assert.ok(Number(after) < Number(before), `${before} → ${after}`);
  });

  it('reports rest days and time-based sessions as untouched rather than skipping them', async () => {
    const rows = (await t.asUser(coachA,
      `select * from im_scale_volume($1,$2::date,$3::date,0.8,false)`, [athlete, MON, plus(MON, 6)])).rows;
    const kept = rows.filter((r) => r.action === 'keep');
    assert.ok(kept.length > 0, 'a coach should see what will not change');
    assert.ok(kept.some((r) => /rest day/i.test(r.detail) || /by time/i.test(r.detail)));
  });

  it('never scales completed training', async () => {
    const s = await firstTraining();
    await t.asService(`update scheduled_workouts set status='completed' where id=$1`, [s.id]);
    const rows = (await t.asUser(coachA,
      `select * from im_scale_volume($1,$2::date,$3::date,0.5,true)`, [athlete, MON, plus(MON, 6)])).rows;
    assert.equal(rows.find((r) => r.session_id === s.id).action, 'blocked');

    const { rows: after } = await t.asService(`select distance_km from scheduled_workouts where id=$1`, [s.id]);
    assert.equal(Number(after[0].distance_km), Number(s.distance_km));
  });

  it('refuses an absurd adjustment', async () => {
    assert.ok(await t.expectRefused(coachA,
      `select * from im_scale_volume($1,$2::date,$3::date,5,false)`, [athlete, MON, plus(MON, 6)]));
    assert.ok(await t.expectRefused(coachA,
      `select * from im_scale_volume($1,$2::date,$3::date,0,false)`, [athlete, MON, plus(MON, 6)]));
  });
});

describe('the three states stay apart', () => {
  it('keeps the original prescription recoverable after several changes', async () => {
    const s = await firstTraining();
    const originalDate = iso(s.date);
    const originalName = s.name;

    // a free slot on each destination day, so the test exercises moving rather
    // than the occupied-slot refusal it would otherwise hit
    await t.asUser(coachA, `select im_move_session($1,$2::date,9::smallint)`, [s.id, plus(s.date, 1)]);
    await t.asUser(coachA, `update scheduled_workouts set name='Reworked', distance_km=99 where id=$1`, [s.id]);
    await t.asUser(coachA, `select im_move_session($1,$2::date,9::smallint)`, [s.id, plus(s.date, 3)]);

    const original = (await t.asUser(coachA, `select im_original_prescription($1) p`, [s.id])).rows[0].p;
    assert.equal(original.name, originalName, 'the first prescription survives every change');
    assert.equal(original.date, originalDate);

    const current = (await t.asService(
      `select name, date, distance_km from scheduled_workouts where id=$1`, [s.id])).rows[0];
    assert.equal(current.name, 'Reworked');
    assert.equal(iso(current.date), plus(originalDate, 3));
  });

  it('keeps what the athlete did separate from what is prescribed', async () => {
    const s = await firstTraining();
    await t.asService(
      `insert into completed_workouts (scheduled_workout_id, athlete_id, date, type, actual_distance_km, source)
       values ($1,$2,$3::date,'easy_run',8.4,'manual')`, [s.id, athlete, s.date]);
    await t.asService(`update scheduled_workouts set status='completed' where id=$1`, [s.id]);

    const { rows } = await t.asService(
      `select c.actual_distance_km logged, s.distance_km prescribed
         from completed_workouts c join scheduled_workouts s on s.id = c.scheduled_workout_id
        where c.scheduled_workout_id=$1`, [s.id]);
    assert.notEqual(Number(rows[0].logged), Number(rows[0].prescribed),
      'the logged result is its own number, not the prescription');
  });

  it('tells the coach who changed what, and when', async () => {
    const s = await firstTraining();
    await t.asUser(coachA, `update scheduled_workouts set distance_km=12 where id=$1`, [s.id]);

    const { rows } = await t.asUser(coachA, `select * from im_session_history($1)`, [s.id]);
    const last = rows.at(-1);
    assert.equal(last.kind, 'edited');
    assert.equal(last.changed_by, coachA);
    assert.ok(last.changed_by_name, 'and by name, not just an id');
    assert.ok(last.changed_at instanceof Date);
  });

  it('hides history from another coach', async () => {
    const s = await firstTraining();
    const { rows } = await t.asUser(coachB, `select * from im_session_history($1)`, [s.id]);
    assert.equal(rows.length, 0);
  });
});

describe('week context', () => {
  it('gives the coach the week, what is protected, and what has moved', async () => {
    const { rows: [week] } = await t.asService(
      `select id from program_weeks where program_id=$1 order by program_week_no limit 1`, [programId]);
    const s = await firstTraining();
    await t.asUser(coachA, `select im_move_session($1,$2::date)`, [s.id, plus(s.date, 1)]);
    const { rows: [other] } = await t.asService(
      `select id from scheduled_workouts where program_week_id=$1 and id<>$2 limit 1`, [week.id, s.id]);
    await t.asService(`update scheduled_workouts set status='completed' where id=$1`, [other.id]);

    const rows = (await t.asUser(coachA, `select * from im_week_adaptation_context($1)`, [week.id])).rows;
    assert.ok(rows.length > 0);

    const moved = rows.find((r) => r.session_id === s.id);
    assert.ok(moved.moved_from, 'a moved session says where it came from');
    assert.equal(iso(moved.moved_from), iso(s.date));

    const done = rows.find((r) => r.session_id === other.id);
    assert.ok(done.blocker, 'a completed session is marked protected');
    assert.ok(rows.every((r) => typeof r.revisions === 'number'));
  });
});

describe('template independence', () => {
  it('adapting a programme never touches the template it came from', async () => {
    const before = (await t.asService(`
      select (select count(*) from program_template_slots where program_template_id=$1)::int slots,
             (select count(*) from program_template_weeks where program_template_id=$1)::int weeks,
             (select name from program_templates where id=$1) name`, [GENERAL.id])).rows[0];

    await t.asUser(coachA, `select * from im_shift_sessions($1,$2::date,$3::date,3,true)`,
      [athlete, MON, plus(MON, 20)]);
    await t.asUser(coachA, `select * from im_scale_volume($1,$2::date,$3::date,0.7,true)`,
      [athlete, MON, plus(MON, 20)]);

    const after = (await t.asService(`
      select (select count(*) from program_template_slots where program_template_id=$1)::int slots,
             (select count(*) from program_template_weeks where program_template_id=$1)::int weeks,
             (select name from program_templates where id=$1) name`, [GENERAL.id])).rows[0];
    assert.deepEqual(after, before);
  });

  it('editing a workout template never reaches a prescribed session', async () => {
    const s = await firstTraining();
    const { rows: [src] } = await t.asService(
      `select source_workout_template_id id from scheduled_workouts where id=$1`, [s.id]);
    assert.ok(src.id, 'the session came from a library item');

    // a coach's own copy, so the edit is permitted
    const { rows: [copy] } = await t.asUser(coachA, `select im_duplicate_workout_template($1) id`, [src.id]);
    await t.asService(`update scheduled_workouts set source_workout_template_id=$1 where id=$2`, [copy.id, s.id]);
    await t.asUser(coachA, `update workout_templates set name='Changed', distance_km=42 where id=$1`, [copy.id]);

    const { rows } = await t.asService(`select name, distance_km from scheduled_workouts where id=$1`, [s.id]);
    assert.notEqual(rows[0].name, 'Changed');
    assert.notEqual(Number(rows[0].distance_km), 42);
  });
});
