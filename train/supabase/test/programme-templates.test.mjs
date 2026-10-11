import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/**
 * Programme templates.
 *
 * The guarantee is the one from Slice 3, one level up: assignment copies a
 * whole programme into the athlete domain, and nothing afterwards connects
 * the two. The other half is the product rule — the system warns about
 * coaching conflicts and never resolves one on its own.
 */

let t, coachA, coachB, athlete, strangerAthlete, MON, GENERAL, MARATHON;

const nextMonday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 7);
  return d.toISOString().slice(0, 10);
};

before(async () => {
  t = await createTestDatabase();
  coachA = await t.signUp('a@im.ie'); coachB = await t.signUp('b@im.ie');
  athlete = await t.signUp('ath@im.ie'); strangerAthlete = await t.signUp('other@im.ie');
  await t.setRole(coachA, 'coach'); await t.setRole(coachB, 'coach');
  await t.asService(`insert into coach_athlete_links (coach_id,athlete_id,status) values ($1,$2,'active')`, [coachA, athlete]);
  await t.asService(`insert into coach_athlete_links (coach_id,athlete_id,status) values ($1,$2,'active')`, [coachB, strangerAthlete]);
  MON = nextMonday();

  ({ rows: [GENERAL] } = await t.asService(`select id, name from program_templates where name='General Endurance'`));
  ({ rows: [MARATHON] } = await t.asService(`select id, name from program_templates where name like 'Marathon%'`));
});
after(async () => t?.close());

describe('the shipped programmes', () => {
  it('have real structure, not just a week count', async () => {
    const { rows } = await t.asService(`
      select t.name, t.weeks,
        (select count(*) from program_template_blocks b where b.program_template_id=t.id)::int blocks,
        (select count(*) from program_template_weeks w where w.program_template_id=t.id)::int weeks_rows,
        (select count(*) from program_template_slots s where s.program_template_id=t.id)::int slots
      from program_templates t`);
    assert.equal(rows.length, 7);
    for (const r of rows) {
      assert.ok(r.blocks > 0, `${r.name} should have blocks`);
      assert.equal(r.weeks_rows, r.weeks, `${r.name}: nominal weeks must match its structure`);
      assert.ok(r.slots > 0, `${r.name} should prescribe something`);
    }
  });

  it('state the training frequency they were written for', async () => {
    const { rows } = await t.asService(
      `select name, min_days_per_week lo, max_days_per_week hi from program_templates order by max_days_per_week, name`);
    assert.ok(rows.every((r) => r.lo >= 1 && r.hi <= 7 && r.lo <= r.hi));
    assert.equal(rows[0].name, 'General Endurance', 'the beginner programme is the least demanding');
    assert.ok(rows[0].hi <= 4, 'and it is not a five-day-a-week programme');
  });

  it('declare a frequency their own structure honours', async () => {
    const { rows } = await t.asService(
      `select id, name, min_days_per_week lo, max_days_per_week hi from program_templates`);
    for (const r of rows) {
      const { rows: [actual] } = await t.asUser(coachA,
        `select min(training_days)::int lo, max(training_days)::int hi from im_template_week_volume($1)`, [r.id]);
      assert.ok(actual.hi <= r.hi,
        `${r.name} says at most ${r.hi} days a week but trains ${actual.hi}`);
      assert.ok(actual.lo >= r.lo,
        `${r.name} says at least ${r.lo} days a week but trains ${actual.lo}`);
    }
  });

  it('give every week at least one day off', async () => {
    const { rows } = await t.asService(`select id, name from program_templates`);
    for (const r of rows) {
      const { rows: weeks } = await t.asUser(coachA,
        `select max(training_days)::int busiest from im_template_week_volume($1)`, [r.id]);
      assert.ok(weeks[0].busiest <= 6,
        `${r.name} trains all seven days — no programme should leave an athlete no day off`);
    }
  });

  it('do not fill every day of the week', async () => {
    const { rows } = await t.asUser(coachA,
      `select max(training_days)::int busiest from im_template_week_volume($1)`, [GENERAL.id]);
    assert.ok(rows[0].busiest <= 4, `a 3-4 day programme trained ${rows[0].busiest} days`);
  });

  it('state rest days explicitly where a coach means them', async () => {
    const { rows } = await t.asService(
      `select count(*)::int n from program_template_slots where program_template_id=$1 and is_rest`, [GENERAL.id]);
    assert.ok(rows[0].n > 0, 'a beginner programme should name its rest days');
  });

  it('step back every fourth week', async () => {
    const { rows } = await t.asUser(coachA,
      `select template_week_no, prescribed_km, is_recovery_week from im_template_week_volume($1) order by template_week_no`,
      [GENERAL.id]);
    const recovery = rows.filter((r) => r.is_recovery_week);
    assert.ok(recovery.length >= 2, 'there should be step-back weeks');
    for (const r of recovery) {
      const before = rows.find((x) => x.template_week_no === r.template_week_no - 1);
      assert.ok(Number(r.prescribed_km) < Number(before.prescribed_km),
        `week ${r.template_week_no} is a step-back and should be lighter than week ${before.template_week_no}`);
    }
  });
});

describe('access', () => {
  it('lets any coach read shipped programmes', async () => {
    const { rows } = await t.asUser(coachB, `select id from program_templates where id=$1`, [GENERAL.id]);
    assert.equal(rows.length, 1);
  });

  it('hides one coach\'s private programme from another', async () => {
    const { rows: [mine] } = await t.asUser(coachA,
      `insert into program_templates (owner_id,visibility,name,goal_type,weeks)
       values ($1,'private','Mine','10k',4) returning id`, [coachA]);
    const seen = await t.asUser(coachB, `select id from program_templates where id=$1`, [mine.id]);
    assert.equal(seen.rows.length, 0);

    // and its structure travels with it
    const { rows: [block] } = await t.asUser(coachA,
      `insert into program_template_blocks (program_template_id,block_index,name)
       values ($1,0,'Base') returning id`, [mine.id]);
    const blockSeen = await t.asUser(coachB, `select id from program_template_blocks where id=$1`, [block.id]);
    assert.equal(blockSeen.rows.length, 0, 'blocks inherit the template\'s visibility');
  });

  it('hides programmes from athletes entirely', async () => {
    const { rows } = await t.asUser(athlete, `select count(*)::int n from program_templates`);
    assert.equal(rows[0].n, 0);
    const b = await t.asUser(athlete, `select count(*)::int n from program_template_blocks`);
    assert.equal(b.rows[0].n, 0);
  });

  it('refuses to let a coach edit shipped content', async () => {
    const before = await t.asService(`select name from program_templates where id=$1`, [GENERAL.id]);
    await t.asUser(coachA, `update program_templates set name='mine' where id=$1`, [GENERAL.id]);
    const after = await t.asService(`select name from program_templates where id=$1`, [GENERAL.id]);
    assert.equal(after.rows[0].name, before.rows[0].name);
  });
});

describe('duplication', () => {
  it('copies the whole structure into a programme the coach owns', async () => {
    const { rows } = await t.asUser(coachA,
      `select im_duplicate_program_template($1,'Marathon — High Volume') id`, [MARATHON.id]);
    const copy = rows[0].id;

    const { rows: [c] } = await t.asService(`
      select t.name, t.visibility, t.owner_id, t.weeks,
        (select count(*) from program_template_blocks b where b.program_template_id=t.id)::int blocks,
        (select count(*) from program_template_weeks w where w.program_template_id=t.id)::int weeks_rows,
        (select count(*) from program_template_slots s where s.program_template_id=t.id)::int slots
      from program_templates t where t.id=$1`, [copy]);

    assert.equal(c.name, 'Marathon — High Volume');
    assert.equal(c.visibility, 'private');
    assert.equal(c.owner_id, coachA);

    const { rows: [src] } = await t.asService(`
      select (select count(*) from program_template_blocks b where b.program_template_id=t.id)::int blocks,
             (select count(*) from program_template_slots s where s.program_template_id=t.id)::int slots
      from program_templates t where t.id=$1`, [MARATHON.id]);
    assert.equal(c.blocks, src.blocks);
    assert.equal(c.slots, src.slots);
  });

  it('leaves the original untouched when the copy is edited', async () => {
    const { rows } = await t.asUser(coachA, `select im_duplicate_program_template($1) id`, [GENERAL.id]);
    await t.asUser(coachA, `update program_templates set name='Rewritten', weeks=99 where id=$1`, [rows[0].id]);
    const { rows: [orig] } = await t.asService(`select name from program_templates where id=$1`, [GENERAL.id]);
    assert.equal(orig.name, 'General Endurance');
  });

  it('refuses to duplicate a programme the coach cannot read', async () => {
    const { rows: [mine] } = await t.asUser(coachA,
      `insert into program_templates (owner_id,visibility,name,goal_type,weeks)
       values ($1,'private','Hidden','5k',4) returning id`, [coachA]);
    const refused = await t.expectRefused(coachB, `select im_duplicate_program_template($1)`, [mine.id]);
    assert.ok(refused);
  });
});

describe('conflicts — what warns and what blocks', () => {
  before(async () => {
    // a three-day athlete with no gym
    await t.asService(
      `update profiles set available_training_days='{2,4,6}', preferred_training_days='{2,4}',
        gym_access='none' where id=$1`, [athlete]);
  });

  const conflicts = async (template, ath = athlete, start = MON) =>
    (await t.asUser(coachA, `select * from im_template_conflicts($1,$2,$3::date)`, [template, ath, start])).rows;

  it('warns when the programme trains on days the athlete has not offered', async () => {
    const rows = await conflicts(GENERAL.id);
    const availability = rows.find((r) => r.kind === 'availability');
    assert.ok(availability, 'an availability conflict should be reported');
    assert.equal(availability.severity, 'warn', 'availability is never a blocker');
    assert.match(availability.detail, /Wednesday|Sunday/);
  });

  it('warns about preferred days separately from availability', async () => {
    const rows = await conflicts(GENERAL.id);
    assert.ok(rows.some((r) => r.kind === 'preferred_days' && r.severity === 'warn'));
  });

  it('warns when the programme asks for more days than the athlete has', async () => {
    const rows = await conflicts(MARATHON.id);
    const frequency = rows.find((r) => r.kind === 'frequency');
    assert.ok(frequency, 'a 5-6 day programme against a 3-day athlete should warn');
    assert.equal(frequency.severity, 'warn');
  });

  it('warns about gym access where the programme needs equipment', async () => {
    const rows = await conflicts(GENERAL.id);
    const gym = rows.find((r) => r.kind === 'gym');
    assert.ok(gym);
    assert.equal(gym.severity, 'warn');
  });

  it('blocks an athlete who is not on the coach\'s roster', async () => {
    const rows = await conflicts(GENERAL.id, strangerAthlete);
    assert.ok(rows.some((r) => r.severity === 'block' && r.kind === 'authorisation'));
  });

  it('blocks a start date that is not a Monday', async () => {
    const tuesday = new Date(MON);
    tuesday.setUTCDate(tuesday.getUTCDate() + 1);
    const rows = await conflicts(GENERAL.id, athlete, tuesday.toISOString().slice(0, 10));
    assert.ok(rows.some((r) => r.severity === 'block' && r.kind === 'start_date'));
  });

  it('blocks a programme with no weeks', async () => {
    const { rows: [empty] } = await t.asUser(coachA,
      `insert into program_templates (owner_id,visibility,name,goal_type,weeks)
       values ($1,'private','Empty','5k',4) returning id`, [coachA]);
    const rows = await conflicts(empty.id);
    assert.ok(rows.some((r) => r.severity === 'block' && r.kind === 'structure'));
  });

  it('blocks an archived programme', async () => {
    const { rows: [copy] } = await t.asUser(coachA, `select im_duplicate_program_template($1) id`, [GENERAL.id]);
    await t.asUser(coachA, `update program_templates set archived_at=now() where id=$1`, [copy.id]);
    const rows = await conflicts(copy.id);
    assert.ok(rows.some((r) => r.severity === 'block' && r.kind === 'archived'));
  });

  it('warns that an existing programme will be archived', async () => {
    await t.asService(
      `insert into programs (athlete_id,coach_id,name,start_date,end_date,status)
       values ($1,$2,'Existing',$3::date,$3::date+83,'active')`, [athlete, coachA, MON]);
    const rows = await conflicts(GENERAL.id);
    const active = rows.find((r) => r.kind === 'active_programme');
    assert.ok(active);
    assert.equal(active.severity, 'warn');
    assert.match(active.detail, /Existing/);
    await t.asService(`delete from programs where athlete_id=$1 and name='Existing'`, [athlete]);
  });
});

describe('assignment', () => {
  let programId;

  it('assigns despite warnings — the coach decides', async () => {
    const { rows } = await t.asUser(coachA,
      `select im_instantiate_program_template($1,$2,$3::date) id`, [GENERAL.id, athlete, MON]);
    programId = rows[0].id;
    assert.ok(programId, 'availability warnings must not block assignment');
  });

  it('copies the whole structure', async () => {
    const { rows: [n] } = await t.asService(`
      select (select count(*) from program_blocks where program_id=$1)::int blocks,
             (select count(*) from program_weeks where program_id=$1)::int weeks,
             (select count(*) from scheduled_workouts where program_id=$1)::int sessions,
             (select count(*) from session_components c
                join scheduled_workouts s on s.id=c.scheduled_workout_id
               where s.program_id=$1)::int components`, [programId]);
    assert.equal(n.blocks, 2);
    assert.equal(n.weeks, 12);
    assert.ok(n.sessions > 0);
    assert.ok(n.components > 0, 'sessions arrive with their structure');
  });

  it('does not rewrite the programme to fit the athlete', async () => {
    // the athlete is available {2,4,6}; the programme trains Wed and Sun too
    const { rows } = await t.asService(
      `select distinct extract(isodow from date)::int d from scheduled_workouts
        where program_id=$1 and type <> 'rest' order by d`, [programId]);
    const days = rows.map((r) => r.d);
    assert.ok(days.includes(3) || days.includes(7),
      'the sessions the athlete was not available for must still be there');
  });

  it('starts every week on a Monday and runs the full duration', async () => {
    const { rows } = await t.asService(
      `select start_date, program_week_no from program_weeks where program_id=$1 order by program_week_no`, [programId]);
    assert.equal(rows.length, 12);
    for (const w of rows) {
      assert.equal(new Date(w.start_date).getUTCDay(), 1, `week ${w.program_week_no} must start on a Monday`);
    }
    const { rows: [p] } = await t.asService(`select start_date, end_date from programs where id=$1`, [programId]);
    const days = (new Date(p.end_date) - new Date(p.start_date)) / 86400000;
    assert.equal(days, 12 * 7 - 1);
  });

  it('carries the coach\'s intended volume onto the live week', async () => {
    const { rows } = await t.asService(
      `select target_volume_km from program_weeks where program_id=$1 and program_week_no=1`, [programId]);
    assert.ok(rows[0].target_volume_km != null, 'intent survives assignment');
  });

  it('computes prescribed volume canonically, with im_week_volume', async () => {
    const { rows: [week] } = await t.asService(
      `select id, target_volume_km from program_weeks where program_id=$1 and program_week_no=1`, [programId]);
    const { rows } = await t.asUser(coachA, `select * from im_week_volume($1)`, [week.id]);
    assert.ok(Number(rows[0].prescribed_km) > 0);
    assert.equal(Number(rows[0].target_km), Number(week.target_volume_km));
  });

  it('prescribes rest days without pretending they are training', async () => {
    const { rows } = await t.asService(
      `select count(*)::int n from scheduled_workouts where program_id=$1 and type='rest'`, [programId]);
    assert.ok(rows[0].n > 0, 'rest days are prescribed explicitly');

    const { rows: [any] } = await t.asService(
      `select distance_km, duration_minutes from scheduled_workouts
        where program_id=$1 and type='rest' limit 1`, [programId]);
    assert.equal(any.distance_km, null);
    assert.equal(any.duration_minutes, null);
  });

  it('records where every session came from', async () => {
    const { rows } = await t.asService(
      `select count(*)::int total,
              count(*) filter (where source_workout_template_id is not null
                            or source_strength_template_id is not null)::int sourced
         from scheduled_workouts where program_id=$1 and type <> 'rest'`, [programId]);
    assert.equal(rows[0].sourced, rows[0].total, 'every prescribed session records its origin');
  });

  it('records which template the programme itself came from', async () => {
    const { rows } = await t.asService(`select template_id from programs where id=$1`, [programId]);
    assert.equal(rows[0].template_id, GENERAL.id);
  });

  it('archives the previous programme rather than deleting it', async () => {
    const { rows: [second] } = await t.asUser(coachA,
      `select im_instantiate_program_template($1,$2,$3::date) id`, [MARATHON.id, athlete, MON]);
    const { rows } = await t.asService(
      `select status from programs where id=$1`, [programId]);
    assert.equal(rows[0].status, 'archived');
    const { rows: active } = await t.asService(
      `select count(*)::int n from programs where athlete_id=$1 and status='active'`, [athlete]);
    assert.equal(active[0].n, 1, 'exactly one active programme');
    programId = second.id;
  });

  it('refuses to assign to an athlete the coach does not have', async () => {
    const refused = await t.expectRefused(coachB,
      `select im_instantiate_program_template($1,$2,$3::date)`, [GENERAL.id, athlete, MON]);
    assert.ok(refused);
    assert.match(refused, /roster/i);
  });

  it('refuses a start date that is not a Monday, in the coach\'s own words', async () => {
    const tuesday = new Date(MON);
    tuesday.setUTCDate(tuesday.getUTCDate() + 1);
    const refused = await t.expectRefused(coachA,
      `select im_instantiate_program_template($1,$2,$3::date)`,
      [GENERAL.id, athlete, tuesday.toISOString().slice(0, 10)]);
    assert.match(refused, /Monday/);
  });
});

describe('reassignment never destroys what happened', () => {
  let completedId, completedDate, programId;

  before(async () => {
    // give the athlete a programme, then have them complete a session in it
    const { rows: [p] } = await t.asUser(coachA,
      `select im_instantiate_program_template($1,$2,$3::date) id`, [GENERAL.id, athlete, MON]);
    programId = p.id;

    const { rows: [session] } = await t.asService(
      `select id, date from scheduled_workouts
        where program_id=$1 and type <> 'rest' order by date limit 1`, [programId]);
    completedId = session.id;
    completedDate = session.date.toISOString().slice(0, 10);
    await t.asService(`update scheduled_workouts set status='completed' where id=$1`, [completedId]);
  });

  it('warns the coach what will be replaced and what will be kept', async () => {
    const { rows } = await t.asUser(coachA,
      `select * from im_template_conflicts($1,$2,$3::date)`, [MARATHON.id, athlete, MON]);
    const replacing = rows.find((r) => r.kind === 'replacing');
    const kept = rows.find((r) => r.kind === 'history_kept');
    assert.ok(replacing, 'the coach is told how many sessions go');
    assert.ok(kept, 'and how many stay because they already happened');
    assert.equal(replacing.severity, 'warn');
    assert.equal(kept.severity, 'warn');
  });

  it('keeps the completed session exactly where it was', async () => {
    await t.asUser(coachA, `select im_instantiate_program_template($1,$2,$3::date)`, [MARATHON.id, athlete, MON]);
    const { rows } = await t.asService(
      `select id, status, program_id from scheduled_workouts where id=$1`, [completedId]);
    assert.equal(rows.length, 1, 'completed training is never deleted by a reassignment');
    assert.equal(rows[0].status, 'completed');
    assert.equal(rows[0].program_id, programId, 'and it still belongs to the programme it was run under');
  });

  it('works around it rather than overwriting the slot', async () => {
    const { rows } = await t.asService(
      `select count(*)::int n from scheduled_workouts
        where athlete_id=$1 and date=$2::date and slot=(select slot from scheduled_workouts where id=$3)`,
      [athlete, completedDate, completedId]);
    assert.equal(rows[0].n, 1, 'one session per slot, and it is the one that actually happened');
  });

  it('keeps the prescription history of the sessions it did replace', async () => {
    const { rows } = await t.asService(
      `select count(*)::int n from session_revisions where athlete_id=$1`, [athlete]);
    assert.ok(rows[0].n > 0, 'replaced prescriptions leave a record behind them');
  });
});

describe('independence — the guarantee', () => {
  let programId, templateId, weekId;

  before(async () => {
    ({ rows: [{ id: templateId }] } = await t.asUser(coachA,
      `select im_duplicate_program_template($1,'Independence Test') id`, [GENERAL.id]));
    ({ rows: [{ id: programId }] } = await t.asUser(coachA,
      `select im_instantiate_program_template($1,$2,$3::date) id`, [templateId, athlete, MON]));
    ({ rows: [{ id: weekId }] } = await t.asService(
      `select id from program_weeks where program_id=$1 and program_week_no=1`, [programId]));
  });

  it('editing the template does not change the athlete\'s programme', async () => {
    const before = await t.asService(
      `select name, (select count(*)::int from scheduled_workouts where program_id=$1) sessions
         from programs where id=$1`, [programId]);

    await t.asUser(coachA, `update program_templates set name='Rewritten Entirely' where id=$1`, [templateId]);
    await t.asUser(coachA, `update program_template_weeks set target_volume_km=999 where program_template_id=$1`, [templateId]);
    await t.asUser(coachA, `delete from program_template_slots where program_template_id=$1`, [templateId]);

    const after = await t.asService(
      `select name, (select count(*)::int from scheduled_workouts where program_id=$1) sessions
         from programs where id=$1`, [programId]);
    assert.equal(after.rows[0].name, before.rows[0].name, 'the programme keeps its name');
    assert.equal(after.rows[0].sessions, before.rows[0].sessions, 'and every session it was given');

    const { rows } = await t.asService(
      `select target_volume_km from program_weeks where id=$1`, [weekId]);
    assert.notEqual(Number(rows[0].target_volume_km), 999, 'the coach\'s intent at assignment time stands');
  });

  it('deleting the template entirely leaves the athlete\'s programme intact', async () => {
    await t.asUser(coachA, `delete from program_templates where id=$1`, [templateId]);
    const { rows } = await t.asService(
      `select count(*)::int n from scheduled_workouts where program_id=$1`, [programId]);
    assert.ok(rows[0].n > 0, 'an athlete\'s training does not vanish with the template it came from');
  });
});
