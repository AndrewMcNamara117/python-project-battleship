import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

let t, coach, otherCoach, athlete, otherAthlete, program, block, week1, session;
const MON = (offset = 0) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + offset * 7);
  return d.toISOString().slice(0, 10);
};

before(async () => {
  t = await createTestDatabase();
  coach = await t.signUp('coach@im.ie'); otherCoach = await t.signUp('other@im.ie');
  athlete = await t.signUp('ath@im.ie'); otherAthlete = await t.signUp('ath2@im.ie');
  await t.setRole(coach, 'coach'); await t.setRole(otherCoach, 'coach');
  for (const a of [athlete, otherAthlete])
    await t.asService(`insert into coach_athlete_links (coach_id,athlete_id,status) values ($1,$2,'active')`, [coach, a]);

  ({ rows: [{ id: program }] } = await t.asService(
    `insert into programs (athlete_id,coach_id,name,start_date,end_date,status)
     values ($1,$2,'Ultra Block',$3,$3::date+83,'active') returning id`, [athlete, coach, MON()]));
  ({ rows: [{ id: block }] } = await t.asService(
    `insert into program_blocks (program_id,athlete_id,block_index,name,phase)
     values ($1,$2,0,'Base','base') returning id`, [program, athlete]));
  ({ rows: [{ id: week1 }] } = await t.asService(
    `insert into program_weeks (block_id,program_id,athlete_id,week_index,program_week_no,start_date,target_volume_km)
     values ($1,$2,$3,0,1,$4,55) returning id`, [block, program, athlete, MON()]));
  ({ rows: [{ id: session }] } = await t.asService(
    `insert into scheduled_workouts (program_id,program_week_id,athlete_id,date,name,type,distance_km,duration_minutes)
     values ($1,$2,$3,$4,'Threshold 6 x 5','threshold',13,65) returning id`, [program, week1, athlete, MON()]));
  await t.asService(
    `insert into session_components (scheduled_workout_id,athlete_id,position,kind,label,duration_seconds,repeats,recovery_seconds)
     values ($1,$2,0,'warm_up','15 min easy',900,null,null),
            ($1,$2,1,'interval','5 min at threshold',300,6,90),
            ($1,$2,2,'cool_down','12 min easy',720,null,null)`, [session, athlete]);
});
after(async () => t?.close());

describe('hierarchy', () => {
  it('a session belongs to a week, a week to a block, a block to a programme', async () => {
    const { rows } = await t.asService(
      `select b.name block, w.program_week_no wk, s.name sess
         from scheduled_workouts s
         join program_weeks w on w.id = s.program_week_id
         join program_blocks b on b.id = w.block_id
        where s.id = $1`, [session]);
    assert.equal(rows[0].block, 'Base');
    assert.equal(rows[0].wk, 1);
  });

  it('a week must start on a Monday', async () => {
    const refused = await t.expectRefused(coach,
      `insert into program_weeks (block_id,program_id,athlete_id,week_index,program_week_no,start_date)
       values ($1,$2,$3,9,9,$4)`, [block, program, athlete, '2026-08-26']);
    assert.ok(refused, 'a Wednesday should be refused');
  });

  it('components carry endurance and strength in one table', async () => {
    const { rows: [{ id: strengthSession }] } = await t.asService(
      `insert into scheduled_workouts (program_id,program_week_id,athlete_id,date,slot,name,type)
       values ($1,$2,$3,$4,1,'Foundation A','strength') returning id`, [program, week1, athlete, MON()]);
    await t.asService(
      `insert into session_components (scheduled_workout_id,athlete_id,position,kind,label,sets,reps,load_prescription,rest_seconds,rpe_target)
       values ($1,$2,0,'exercise','Trap-Bar Deadlift',4,'6','2 in reserve',150,7)`, [strengthSession, athlete]);
    const { rows } = await t.asService(
      `select kind, sets, reps from session_components where scheduled_workout_id = $1`, [strengthSession]);
    assert.equal(rows[0].kind, 'exercise');
    assert.equal(rows[0].sets, 4);
  });

  it('an exercise component must name something', async () => {
    const refused = await t.expectRefused(coach,
      `insert into session_components (scheduled_workout_id,athlete_id,position,kind,sets,reps)
       values ($1,$2,90,'exercise',3,'8')`, [session, athlete]);
    assert.ok(refused, 'an unnamed exercise should be refused');
  });
});

describe('prescription audit trail', () => {
  it('records the original prescription on creation', async () => {
    const { rows } = await t.asService(`select im_original_prescription($1) o`, [session]);
    assert.equal(rows[0].o.name, 'Threshold 6 x 5');
    assert.equal(Number(rows[0].o.distance_km), 13);
  });

  it('survives an edit, and keeps the original', async () => {
    await t.asService(`update scheduled_workouts set name='Threshold 5 x 6', distance_km=14 where id=$1`, [session]);
    const { rows } = await t.asService(`select im_original_prescription($1) o`, [session]);
    assert.equal(rows[0].o.name, 'Threshold 6 x 5', 'the original must not change');
    const { rows: now } = await t.asService(`select name from scheduled_workouts where id=$1`, [session]);
    assert.equal(now[0].name, 'Threshold 5 x 6');
  });

  it('labels what kind of change each revision was', async () => {
    await t.asService(`update scheduled_workouts set date = date + 1 where id=$1`, [session]);
    await t.asService(`update scheduled_workouts set status='completed' where id=$1`, [session]);
    const { rows } = await t.asService(
      `select kind from session_revisions where scheduled_workout_id=$1 order by revision`, [session]);
    const kinds = rows.map((r) => r.kind);
    assert.deepEqual(kinds.slice(0, 2), ['created', 'edited']);
    assert.ok(kinds.includes('moved'));
    assert.ok(kinds.includes('status_changed'));
  });

  it('does not count an athlete completing a session as a prescription change', async () => {
    const { rows } = await t.asService(`select prescription_revision from scheduled_workouts where id=$1`, [session]);
    // created(1) + edited + moved = 3; the completion must not advance it
    assert.equal(rows[0].prescription_revision, 3);
  });

  it('folds a multi-statement save into one revision', async () => {
    const { rows: [{ id: s2 }] } = await t.asService(
      `insert into scheduled_workouts (program_id,program_week_id,athlete_id,date,slot,name,type)
       values ($1,$2,$3,$4,5,'Hills','hills') returning id`, [program, week1, athlete, MON()]);
    const before = (await t.asService(`select count(*)::int n from session_revisions where scheduled_workout_id=$1`, [s2])).rows[0].n;
    await t.db.exec('begin');
    await t.db.query(`update scheduled_workouts set name='Hill Repeats' where id=$1`, [s2]);
    await t.db.query(`insert into session_components (scheduled_workout_id,athlete_id,position,kind,label,repeats,duration_seconds)
                      values ($1,$2,0,'interval','60s uphill',8,60)`, [s2, athlete]);
    await t.db.exec('commit');
    const after = (await t.asService(`select count(*)::int n from session_revisions where scheduled_workout_id=$1`, [s2])).rows[0].n;
    assert.equal(after - before, 1, 'one logical save should produce one revision');
  });

  it('outlives the session it describes', async () => {
    const { rows: [{ id: doomed }] } = await t.asService(
      `insert into scheduled_workouts (program_id,program_week_id,athlete_id,date,slot,name,type)
       values ($1,$2,$3,$4,6,'Doomed','easy_run') returning id`, [program, week1, athlete, MON()]);
    await t.asService(`delete from scheduled_workouts where id=$1`, [doomed]);
    const { rows } = await t.asService(
      `select kind, session->>'name' nm from session_revisions where scheduled_workout_id=$1 order by revision`, [doomed]);
    assert.ok(rows.length >= 2, 'history should remain after deletion');
    assert.equal(rows[rows.length - 1].kind, 'deleted');
    assert.equal(rows[0].nm, 'Doomed', 'the prescription is still readable');
  });

  it('cannot be written or erased by a client', async () => {
    const insert = await t.expectRefused(coach,
      `insert into session_revisions (scheduled_workout_id,athlete_id,revision,kind,session,xact_id)
       values ($1,$2,99,'created','{}'::jsonb,1)`, [session, athlete]);
    assert.ok(insert, 'clients must not write history');

    await t.asUser(coach, `delete from session_revisions where scheduled_workout_id=$1`, [session]);
    const { rows } = await t.asService(`select count(*)::int n from session_revisions where scheduled_workout_id=$1`, [session]);
    assert.ok(rows[0].n > 0, 'history must not be deletable');
  });
});

describe('duplication', () => {
  it('duplicates a week, resetting status and preserving weekday offsets', async () => {
    const target = MON(1);
    const { rows } = await t.asUser(coach, `select im_duplicate_week($1,$2::date) id`, [week1, target]);
    const newWeek = rows[0].id;

    const { rows: copied } = await t.asService(
      `select name, status, date, slot from scheduled_workouts where program_week_id=$1 order by slot`, [newWeek]);
    assert.ok(copied.length >= 3, 'sessions should be copied');
    assert.ok(copied.every((c) => c.status === 'scheduled'), 'a copy is a plan again');

    const { rows: comps } = await t.asService(
      `select count(*)::int n from session_components c
        join scheduled_workouts s on s.id = c.scheduled_workout_id
       where s.program_week_id = $1`, [newWeek]);
    assert.ok(comps[0].n >= 3, 'components should be copied too');
  });

  it('duplicates a whole block in one call', async () => {
    const { rows } = await t.asUser(coach, `select im_duplicate_block($1,$2::date,'Build') id`, [block, MON(4)]);
    const newBlock = rows[0].id;
    const { rows: weeks } = await t.asService(
      `select count(*)::int n from program_weeks where block_id=$1`, [newBlock]);
    assert.ok(weeks[0].n >= 2, 'every week in the block should be copied');
    const { rows: name } = await t.asService(`select name from program_blocks where id=$1`, [newBlock]);
    assert.equal(name[0].name, 'Build');
  });

  it('assigns a whole programme to another athlete', async () => {
    const { rows } = await t.asUser(coach,
      `select im_assign_program($1,$2,$3::date,'Ultra Block — Ciara') id`, [program, otherAthlete, MON(1)]);
    const newProgram = rows[0].id;

    const { rows: owner } = await t.asService(`select athlete_id, status from programs where id=$1`, [newProgram]);
    assert.equal(owner[0].athlete_id, otherAthlete);
    assert.equal(owner[0].status, 'active');

    const { rows: sessions } = await t.asService(
      `select count(*)::int n from scheduled_workouts where program_id=$1`, [newProgram]);
    assert.ok(sessions[0].n > 0, 'sessions should come across');

    const { rows: leak } = await t.asService(
      `select count(*)::int n from scheduled_workouts where program_id=$1 and athlete_id <> $2`,
      [newProgram, otherAthlete]);
    assert.equal(leak[0].n, 0, 'no session may belong to the wrong athlete');
  });

  it('refuses to duplicate for an athlete the caller does not coach', async () => {
    const refused = await t.expectRefused(otherCoach, `select im_duplicate_week($1,$2::date)`, [week1, MON(6)]);
    assert.ok(refused, 'an unrelated coach must be refused');
  });

  it('refuses to assign a programme to an athlete the caller does not coach', async () => {
    const stranger = await t.signUp('stranger@im.ie');
    const refused = await t.expectRefused(coach, `select im_assign_program($1,$2,$3::date)`, [program, stranger, MON(2)]);
    assert.ok(refused, 'assigning to a stranger must be refused');
  });

  it('refuses a week that does not start on a Monday', async () => {
    const refused = await t.expectRefused(coach, `select im_duplicate_week($1,$2::date)`, [week1, '2026-08-26']);
    assert.ok(refused);
  });
});

describe('programme access control', () => {
  it('an athlete reads their own blocks and weeks', async () => {
    const { rows } = await t.asUser(athlete, `select id from program_weeks where program_id=$1`, [program]);
    assert.ok(rows.length > 0);
  });

  it('an athlete cannot read another athlete’s programme', async () => {
    const { rows } = await t.asUser(otherAthlete, `select id from program_blocks where athlete_id=$1`, [athlete]);
    assert.equal(rows.length, 0);
  });

  it('an athlete cannot write a block, week or component', async () => {
    for (const [table, sql, params] of [
      ['block', `insert into program_blocks (program_id,athlete_id,block_index,name) values ($1,$2,50,'mine')`, [program, athlete]],
      ['week', `insert into program_weeks (block_id,program_id,athlete_id,week_index,program_week_no,start_date) values ($1,$2,$3,50,50,$4)`, [block, program, athlete, MON(9)]],
      ['component', `insert into session_components (scheduled_workout_id,athlete_id,position,kind,label) values ($1,$2,80,'note','mine')`, [session, athlete]],
    ]) {
      const refused = await t.expectRefused(athlete, sql, params);
      assert.ok(refused, `an athlete must not write a ${table}`);
    }
  });

  it('an unrelated coach sees nothing of the programme', async () => {
    const { rows } = await t.asUser(otherCoach, `select id from program_weeks where program_id=$1`, [program]);
    assert.equal(rows.length, 0);
  });

  it('both sides can read the prescription history, neither can change it', async () => {
    const a = await t.asUser(athlete, `select count(*)::int n from session_revisions where scheduled_workout_id=$1`, [session]);
    const c = await t.asUser(coach, `select count(*)::int n from session_revisions where scheduled_workout_id=$1`, [session]);
    assert.ok(a.rows[0].n > 0 && c.rows[0].n > 0);
    const o = await t.asUser(otherCoach, `select count(*)::int n from session_revisions where scheduled_workout_id=$1`, [session]);
    assert.equal(o.rows[0].n, 0, 'an unrelated coach sees no history');
  });
});
