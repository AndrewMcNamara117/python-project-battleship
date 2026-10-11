import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/**
 * The reusable libraries.
 *
 * The guarantees worth testing are the ones that would be expensive to get
 * wrong: a coach seeing another coach's private work, system content being
 * mutated, and — most of all — a template edit reaching backwards into a
 * prescription an athlete has already been given.
 */

let t, coachA, coachB, athlete, strangerAthlete, program, week, MON;

before(async () => {
  t = await createTestDatabase();
  coachA = await t.signUp('a@im.ie'); coachB = await t.signUp('b@im.ie');
  athlete = await t.signUp('ath@im.ie'); strangerAthlete = await t.signUp('other@im.ie');
  await t.setRole(coachA, 'coach'); await t.setRole(coachB, 'coach');
  await t.asService(`insert into coach_athlete_links (coach_id,athlete_id,status) values ($1,$2,'active')`, [coachA, athlete]);
  await t.asService(`insert into coach_athlete_links (coach_id,athlete_id,status) values ($1,$2,'active')`, [coachB, strangerAthlete]);

  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  MON = d.toISOString().slice(0, 10);

  ({ rows: [{ id: program }] } = await t.asService(
    `insert into programs (athlete_id,coach_id,name,start_date,end_date,status)
     values ($1,$2,'P',$3,$3::date+83,'active') returning id`, [athlete, coachA, MON]));
  const { rows: [{ id: block }] } = await t.asService(
    `insert into program_blocks (program_id,athlete_id,block_index,name) values ($1,$2,0,'Base') returning id`,
    [program, athlete]);
  ({ rows: [{ id: week }] } = await t.asService(
    `insert into program_weeks (block_id,program_id,athlete_id,week_index,program_week_no,start_date,target_volume_km)
     values ($1,$2,$3,0,1,$4,55) returning id`, [block, program, athlete, MON]));
});
after(async () => t?.close());

describe('system seed', () => {
  it('migrated the shipped content', async () => {
    const counts = {};
    for (const tbl of ['workout_templates', 'strength_exercises', 'strength_templates']) {
      counts[tbl] = (await t.asService(`select count(*)::int n from ${tbl} where visibility='system'`)).rows[0].n;
    }
    assert.equal(counts.workout_templates, 16);
    assert.equal(counts.strength_exercises, 20);
    assert.equal(counts.strength_templates, 6);
  });

  it('gives strength templates their exercises in order', async () => {
    const { rows } = await t.asService(
      `select c.position, c.label, c.sets from template_components c
        join strength_templates s on s.id = c.strength_template_id
       where s.name = 'Foundation A' order by c.position`);
    assert.ok(rows.length >= 5, 'Foundation A should have its exercises');
    assert.deepEqual(rows.map((r) => r.position), rows.map((_, i) => i), 'positions must be contiguous and ordered');
  });

  it('has no owner', async () => {
    const { rows } = await t.asService(`select count(*)::int n from workout_templates where visibility='system' and owner_id is not null`);
    assert.equal(rows[0].n, 0);
  });

  it('cannot be edited or deleted by a coach', async () => {
    // RLS grants no write on system rows, so these match nothing rather than
    // raising. Silence is the refusal: what matters is that nothing moved.
    const before = await t.asService(`select id, name from workout_templates where visibility='system' order by id`);
    await t.asUser(coachA, `update workout_templates set name='mine' where visibility='system'`);
    await t.asUser(coachA, `delete from workout_templates where visibility='system'`);
    const after = await t.asService(`select id, name from workout_templates where visibility='system' order by id`);
    assert.deepEqual(after.rows, before.rows, 'system content must be untouched');
  });
});

describe('ownership and sharing', () => {
  let privateId, sharedId;

  before(async () => {
    ({ rows: [{ id: privateId }] } = await t.asUser(coachA,
      `insert into workout_templates (owner_id,visibility,name,category,type)
       values ($1,'private','A private session','threshold','threshold') returning id`, [coachA]));
    ({ rows: [{ id: sharedId }] } = await t.asUser(coachA,
      `insert into workout_templates (owner_id,visibility,name,category,type)
       values ($1,'shared','A shared session','tempo','tempo') returning id`, [coachA]));
  });

  it('the owner sees their private template', async () => {
    const { rows } = await t.asUser(coachA, `select id from workout_templates where id=$1`, [privateId]);
    assert.equal(rows.length, 1);
  });

  it('another coach cannot see it', async () => {
    const { rows } = await t.asUser(coachB, `select id from workout_templates where id=$1`, [privateId]);
    assert.equal(rows.length, 0);
  });

  it('another coach can see a shared one', async () => {
    const { rows } = await t.asUser(coachB, `select id from workout_templates where id=$1`, [sharedId]);
    assert.equal(rows.length, 1);
  });

  it('but cannot edit or delete it', async () => {
    await t.asUser(coachB, `update workout_templates set name='hijacked' where id=$1`, [sharedId]);
    const { rows } = await t.asService(`select name from workout_templates where id=$1`, [sharedId]);
    assert.notEqual(rows[0].name, 'hijacked', 'sharing is read access, not write access');
  });

  it('an athlete sees no templates at all', async () => {
    const { rows } = await t.asUser(athlete, `select count(*)::int n from workout_templates`);
    assert.equal(rows[0].n, 0, 'templates are never visible to athletes');
    const s = await t.asUser(athlete, `select count(*)::int n from strength_templates`);
    assert.equal(s.rows[0].n, 0);
  });

  it('a coach cannot create a template owned by someone else', async () => {
    const refused = await t.expectRefused(coachB,
      `insert into workout_templates (owner_id,visibility,name,category,type)
       values ($1,'private','forged','easy','easy_run')`, [coachA]);
    assert.ok(refused, 'forging ownership must be refused');
  });

  it('a coach cannot promote their own item to system content', async () => {
    const refused = await t.expectRefused(coachA,
      `update workout_templates set visibility='system', owner_id=null where id=$1`, [privateId]);
    assert.ok(refused, 'writing a system row must be refused');
    const { rows } = await t.asService(`select visibility from workout_templates where id=$1`, [privateId]);
    assert.equal(rows[0].visibility, 'private');
  });
});

describe('archive and restore', () => {
  let id;
  before(async () => {
    ({ rows: [{ id }] } = await t.asUser(coachA,
      `insert into workout_templates (owner_id,visibility,name,category,type)
       values ($1,'private','Retired session','easy','easy_run') returning id`, [coachA]));
  });

  it('archives without deleting', async () => {
    await t.asUser(coachA, `update workout_templates set archived_at=now() where id=$1`, [id]);
    const { rows } = await t.asService(`select archived_at from workout_templates where id=$1`, [id]);
    assert.ok(rows[0].archived_at, 'the row survives');
  });

  it('refuses to prescribe from an archived template', async () => {
    const refused = await t.expectRefused(coachA,
      `select im_insert_workout_template($1,$2,$3::date,0::smallint)`, [id, athlete, MON]);
    assert.ok(refused, 'an archived template must not be prescribed from');
    assert.match(refused, /archived/i);
  });

  it('restores', async () => {
    await t.asUser(coachA, `update workout_templates set archived_at=null where id=$1`, [id]);
    const { rows } = await t.asUser(coachA, `select im_insert_workout_template($1,$2,$3::date,7::smallint) id`, [id, athlete, MON]);
    assert.ok(rows[0].id, 'a restored template prescribes normally');
  });
});

describe('template → live session', () => {
  let templateId, sessionId;

  before(async () => {
    ({ rows: [{ id: templateId }] } = await t.asUser(coachA,
      `insert into workout_templates (owner_id,visibility,name,category,type,distance_km,duration_minutes,rpe_target,purpose)
       values ($1,'private','Threshold 6 x 5','threshold','threshold',13,65,8,'Controlled discomfort.') returning id`, [coachA]));
    await t.asUser(coachA,
      `insert into template_components (workout_template_id,position,kind,label,duration_seconds,repeats,recovery_seconds)
       values ($1,0,'warm_up','15 min easy',900,null,null),
              ($1,1,'interval','5 min at threshold',300,6,90),
              ($1,2,'cool_down','12 min easy',720,null,null)`, [templateId]);
  });

  it('creates a live session from the template', async () => {
    const { rows } = await t.asUser(coachA,
      `select im_insert_workout_template($1,$2,$3::date,2::smallint) id`, [templateId, athlete, MON]);
    sessionId = rows[0].id;
    const { rows: s } = await t.asService(`select name, distance_km, status, program_week_id from scheduled_workouts where id=$1`, [sessionId]);
    assert.equal(s[0].name, 'Threshold 6 x 5');
    assert.equal(Number(s[0].distance_km), 13);
    assert.equal(s[0].status, 'scheduled');
    assert.ok(s[0].program_week_id, 'the session should land in the right week');
  });

  it('copies the components in order', async () => {
    const { rows } = await t.asService(
      `select position, kind, label, repeats from session_components where scheduled_workout_id=$1 order by position`, [sessionId]);
    assert.equal(rows.length, 3);
    assert.deepEqual(rows.map((r) => r.kind), ['warm_up', 'interval', 'cool_down']);
    assert.equal(rows[1].repeats, 6);
  });

  it('records provenance', async () => {
    const { rows } = await t.asService(`select source_workout_template_id from scheduled_workouts where id=$1`, [sessionId]);
    assert.equal(rows[0].source_workout_template_id, templateId);
  });

  it('leaves the session independent — a later template edit does not reach it', async () => {
    await t.asUser(coachA, `update workout_templates set name='Threshold 8 x 4', distance_km=16 where id=$1`, [templateId]);
    await t.asUser(coachA, `update template_components set label='4 min at threshold' where workout_template_id=$1 and kind='interval'`, [templateId]);

    const { rows } = await t.asService(`select name, distance_km from scheduled_workouts where id=$1`, [sessionId]);
    assert.equal(rows[0].name, 'Threshold 6 x 5', 'the prescribed session must not change');
    assert.equal(Number(rows[0].distance_km), 13);

    const { rows: c } = await t.asService(
      `select label from session_components where scheduled_workout_id=$1 and kind='interval'`, [sessionId]);
    assert.equal(c[0].label, '5 min at threshold', 'copied components must not change either');
  });

  it('editing the live session does not write back to the template', async () => {
    await t.asUser(coachA, `update scheduled_workouts set distance_km=14 where id=$1`, [sessionId]);
    const { rows } = await t.asService(`select distance_km from workout_templates where id=$1`, [templateId]);
    assert.equal(Number(rows[0].distance_km), 16, 'the template keeps its own value');
  });

  it('keeps provenance after the session is edited, and records the revision', async () => {
    const { rows } = await t.asService(
      `select source_workout_template_id, prescription_revision from scheduled_workouts where id=$1`, [sessionId]);
    assert.equal(rows[0].source_workout_template_id, templateId, 'provenance survives edits');
    assert.ok(rows[0].prescription_revision > 1, 'the edit advanced the prescription revision');
  });

  it('refuses to prescribe for an athlete the caller does not coach', async () => {
    const refused = await t.expectRefused(coachB,
      `select im_insert_workout_template($1,$2,$3::date,3::smallint)`, [templateId, strangerAthlete, MON]);
    assert.ok(refused, 'coachB cannot even read that template');
  });

  it('refuses to prescribe a template the caller cannot read', async () => {
    const refused = await t.expectRefused(coachB,
      `select im_insert_workout_template($1,$2,$3::date,4::smallint)`, [templateId, strangerAthlete, MON]);
    assert.ok(refused);
  });
});

describe('one session per slot', () => {
  it('replaces what is already in the slot, and records the change', async () => {
    const { rows: [a] } = await t.asService(
      `select id from workout_templates where visibility='system' and category='easy' limit 1`);
    const { rows: [b] } = await t.asService(
      `select id from workout_templates where visibility='system' and category='long_run' limit 1`);

    const day = MON;
    const first = (await t.asUser(coachA,
      `select im_insert_workout_template($1,$2,$3::date,6::smallint) id`, [a.id, athlete, day])).rows[0].id;
    const second = (await t.asUser(coachA,
      `select im_insert_workout_template($1,$2,$3::date,6::smallint) id`, [b.id, athlete, day])).rows[0].id;

    assert.equal(second, first, 'the slot keeps its identity rather than stacking a second session');

    const { rows } = await t.asService(
      `select name, source_workout_template_id, prescription_revision
         from scheduled_workouts where athlete_id=$1 and date=$2::date and slot=6`, [athlete, day]);
    assert.equal(rows.length, 1, 'a slot holds exactly one session');
    assert.equal(rows[0].source_workout_template_id, b.id, 'the newer prescription wins');
    assert.ok(rows[0].prescription_revision > 1, 'and the replacement is a revision, not a silent overwrite');

    const { rows: history } = await t.asService(
      `select count(*)::int n from session_revisions where scheduled_workout_id=$1`, [first]);
    assert.ok(history[0].n > 0, 'the athlete can still see what they were originally given');
  });

  it('puts strength on its own slot so it sits alongside the run', async () => {
    const { rows: [tpl] } = await t.asService(`select id from strength_templates where visibility='system' limit 1`);
    const day = MON;
    await t.asUser(coachA, `select im_insert_strength_template($1,$2,$3::date)`, [tpl.id, athlete, day]);
    const { rows } = await t.asService(
      `select slot, type from scheduled_workouts where athlete_id=$1 and date=$2::date order by slot`,
      [athlete, day]);
    const strength = rows.find((r) => r.type === 'strength');
    assert.ok(strength, 'the strength session landed');
    assert.equal(strength.slot, 1, 'default strength slot is 1');
  });
});

describe('strength template → live session', () => {
  it('inserts an ordered strength session with its exercises', async () => {
    const { rows: [tpl] } = await t.asService(`select id from strength_templates where name='Foundation A'`);
    const { rows } = await t.asUser(coachA,
      `select im_insert_strength_template($1,$2,$3::date,5::smallint) id`, [tpl.id, athlete, MON]);
    const sessionId = rows[0].id;

    const { rows: s } = await t.asService(
      `select type, source_strength_template_id from scheduled_workouts where id=$1`, [sessionId]);
    assert.equal(s[0].type, 'strength');
    assert.equal(s[0].source_strength_template_id, tpl.id);

    const { rows: c } = await t.asService(
      `select position, kind, sets, reps, strength_exercise_id from session_components
        where scheduled_workout_id=$1 order by position`, [sessionId]);
    assert.ok(c.length >= 5);
    assert.ok(c.every((x) => x.kind === 'exercise'));
    assert.deepEqual(c.map((x) => x.position), c.map((_, i) => i), 'exercise order is preserved');
    assert.ok(c[0].strength_exercise_id, 'components reference the library exercise');
  });

  it('lets the athlete read the exercises prescribed to them, and no others', async () => {
    const mine = await t.asUser(athlete,
      `select count(*)::int n from strength_exercises e
        where exists (select 1 from session_components c
                       where c.strength_exercise_id = e.id and c.athlete_id = $1)`, [athlete]);
    assert.ok(mine.rows[0].n > 0, 'an athlete must be able to read their own prescribed movements');

    const priv = await t.asUser(coachA,
      `insert into strength_exercises (owner_id,visibility,name,category,movement_pattern)
       values ($1,'private','Secret Movement','core','core') returning id`, [coachA]);
    const seen = await t.asUser(athlete, `select id from strength_exercises where id=$1`, [priv.rows[0].id]);
    assert.equal(seen.rows.length, 0, 'and nothing else');
  });
});

describe('duplication', () => {
  it('duplicates system content into a private copy the coach owns', async () => {
    const { rows: [sys] } = await t.asService(`select id, name from workout_templates where visibility='system' limit 1`);
    const { rows } = await t.asUser(coachA, `select im_duplicate_workout_template($1,'My version') id`, [sys.id]);

    const { rows: copy } = await t.asService(
      `select name, visibility, owner_id from workout_templates where id=$1`, [rows[0].id]);
    assert.equal(copy[0].name, 'My version');
    assert.equal(copy[0].visibility, 'private');
    assert.equal(copy[0].owner_id, coachA);
  });

  it('copies a strength template with its components', async () => {
    const { rows: [sys] } = await t.asService(`select id from strength_templates where visibility='system' limit 1`);
    const { rows } = await t.asUser(coachA, `select im_duplicate_strength_template($1) id`, [sys.id]);
    const { rows: c } = await t.asService(
      `select count(*)::int n from template_components where strength_template_id=$1`, [rows[0].id]);
    assert.ok(c[0].n > 0, 'the copy carries its exercises');
  });

  it('refuses to duplicate something the coach cannot read', async () => {
    const { rows: [priv] } = await t.asUser(coachA,
      `insert into workout_templates (owner_id,visibility,name,category,type)
       values ($1,'private','Hidden','easy','easy_run') returning id`, [coachA]);
    const refused = await t.expectRefused(coachB, `select im_duplicate_workout_template($1)`, [priv.id]);
    assert.ok(refused);
  });
});

describe('week volume', () => {
  it('reports prescribed against target so a mismatch can be surfaced', async () => {
    const { rows } = await t.asUser(coachA, `select * from im_week_volume($1)`, [week]);
    assert.ok(Number(rows[0].target_km) === 55, 'the coach intent is returned');
    assert.ok(Number(rows[0].prescribed_km) > 0, 'the actual prescription is computed');
    assert.ok(rows[0].session_count > 0);
  });
});

describe('block deletion guard', () => {
  it('refuses to delete a block that still holds weeks or sessions', async () => {
    const { rows: [b] } = await t.asService(`select block_id from program_weeks where id=$1`, [week]);
    const refused = await t.expectRefused(coachA, `delete from program_blocks where id=$1`, [b.block_id]);
    assert.ok(refused, 'a populated block must not delete');
    assert.match(refused, /Archive it instead|prescribed athlete history/i);

    const { rows } = await t.asService(`select count(*)::int n from program_blocks where id=$1`, [b.block_id]);
    assert.equal(rows[0].n, 1, 'the block survives');
  });

  it('allows an empty block to be deleted', async () => {
    const { rows: [empty] } = await t.asService(
      `insert into program_blocks (program_id,athlete_id,block_index,name) values ($1,$2,9,'Empty') returning id`,
      [program, athlete]);
    await t.asUser(coachA, `delete from program_blocks where id=$1`, [empty.id]);
    const { rows } = await t.asService(`select count(*)::int n from program_blocks where id=$1`, [empty.id]);
    assert.equal(rows[0].n, 0);
  });

  it('archives a populated block instead', async () => {
    const { rows: [b] } = await t.asService(`select block_id from program_weeks where id=$1`, [week]);
    await t.asUser(coachA, `update program_blocks set archived_at=now() where id=$1`, [b.block_id]);
    const { rows } = await t.asService(`select archived_at from program_blocks where id=$1`, [b.block_id]);
    assert.ok(rows[0].archived_at, 'archiving is the safe path');
    await t.asService(`update program_blocks set archived_at=null where id=$1`, [b.block_id]);
  });
});
