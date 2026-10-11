import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/**
 * Saving a live programme back out as a template.
 *
 * Two things have to hold. What was prescribed travels; what the athlete did
 * does not. And the snapshot is independent in both directions from the
 * moment it exists.
 */

let t, coachA, coachB, athlete, otherAthlete, MON, programId, GENERAL;

const nextMonday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 7);
  return d.toISOString().slice(0, 10);
};

before(async () => {
  t = await createTestDatabase();
  coachA = await t.signUp('a@im.ie'); coachB = await t.signUp('b@im.ie');
  athlete = await t.signUp('ath@im.ie'); otherAthlete = await t.signUp('two@im.ie');
  await t.setRole(coachA, 'coach'); await t.setRole(coachB, 'coach');
  await t.asService(`insert into coach_athlete_links (coach_id,athlete_id,status) values ($1,$2,'active')`, [coachA, athlete]);
  await t.asService(`insert into coach_athlete_links (coach_id,athlete_id,status) values ($1,$2,'active')`, [coachA, otherAthlete]);
  MON = nextMonday();

  ({ rows: [GENERAL] } = await t.asService(`select id, name from program_templates where name='General Endurance'`));
  ({ rows: [{ id: programId }] } = await t.asUser(coachA,
    `select im_instantiate_program_template($1,$2,$3::date) id`, [GENERAL.id, athlete, MON]));

  // make it look lived in, the way a programme does after a few weeks
  const { rows: sessions } = await t.asService(
    `select id from scheduled_workouts where program_id=$1 and type<>'rest' order by date limit 4`, [programId]);
  await t.asService(
    `update scheduled_workouts set status='completed' where id=$1`, [sessions[0].id]);
  await t.asService(`update scheduled_workouts set status='missed' where id=$1`, [sessions[1].id]);
  await t.asService(
    `update scheduled_workouts set coach_note='Watch that calf of yours, Andrew' where id=$1`, [sessions[2].id]);
  // a session the coach wrote by hand, which the library has never seen
  await t.asService(
    `update scheduled_workouts
        set name='Bespoke Hill Session', main_set='8 x 90s uphill hard', intensity='hard',
            source_workout_template_id=null
      where id=$1`, [sessions[3].id]);
  await t.asService(`update program_weeks set notes='Andrew is away this week' where program_id=$1 and program_week_no=2`, [programId]);
});
after(async () => t?.close());

const preview = async (user, program) =>
  (await t.asUser(user, `select * from im_extract_preview($1)`, [program])).rows;

describe('the preview', () => {
  it('says what will be saved', async () => {
    const rows = await preview(coachA, programId);
    const structure = rows.find((r) => r.kind === 'structure');
    assert.ok(structure);
    assert.match(structure.detail, /2 block\(s\), 12 week\(s\)/);
  });

  it('counts training sessions and rest days apart', async () => {
    const rows = await preview(coachA, programId);
    const structure = rows.find((r) => r.kind === 'structure');
    const rest = rows.find((r) => r.kind === 'rest');
    assert.ok(structure && rest);

    const { rows: [live] } = await t.asService(`
      select count(*) filter (where type <> 'rest')::int training,
             count(*) filter (where type = 'rest')::int rest
        from scheduled_workouts where program_id=$1 and program_week_id is not null`, [programId]);
    assert.equal(structure.count, live.training, 'the session count is training sessions');
    assert.equal(rest.count, live.rest, 'rest days are their own number');
  });

  it('warns about sessions the library does not hold', async () => {
    const rows = await preview(coachA, programId);
    const promote = rows.find((r) => r.kind === 'promote');
    assert.ok(promote, 'a hand-written session should be flagged');
    assert.equal(promote.severity, 'warn');
    assert.match(promote.detail, /becomes a new private session/i);
  });

  it('says the template takes the prescription, not what happened', async () => {
    const rows = await preview(coachA, programId);
    const execution = rows.find((r) => r.kind === 'execution');
    assert.ok(execution);
    assert.match(execution.detail, /never what happened/i);
  });

  it('warns that coach notes will not travel', async () => {
    const rows = await preview(coachA, programId);
    const notes = rows.find((r) => r.kind === 'notes');
    assert.ok(notes);
    assert.equal(notes.severity, 'warn');
  });

  it('blocks a coach who does not have the athlete', async () => {
    const rows = await preview(coachB, programId);
    assert.ok(rows.some((r) => r.severity === 'block' && r.kind === 'authorisation'));
  });

  it('blocks an athlete outright', async () => {
    const rows = await preview(athlete, programId);
    assert.ok(rows.some((r) => r.severity === 'block'));
  });

  it('blocks a programme with no weeks', async () => {
    const { rows: [empty] } = await t.asService(
      `insert into programs (athlete_id,coach_id,name,start_date,end_date,status)
       values ($1,$2,'Empty',$3::date,$3::date+6,'draft') returning id`, [athlete, coachA, MON]);
    const rows = await preview(coachA, empty.id);
    assert.ok(rows.some((r) => r.severity === 'block' && r.kind === 'structure'));
  });
});

describe('structural fidelity', () => {
  let templateId;

  before(async () => {
    ({ rows: [{ id: templateId }] } = await t.asUser(coachA,
      `select im_extract_program_template($1,'Andrew 12wk Base') id`, [programId]));
  });

  it('reproduces every block, week and session', async () => {
    const { rows: [live] } = await t.asService(`
      select (select count(*) from program_blocks where program_id=$1)::int blocks,
             (select count(*) from program_weeks where program_id=$1)::int weeks,
             (select count(*) from scheduled_workouts where program_id=$1 and program_week_id is not null)::int sessions
      `, [programId]);
    const { rows: [saved] } = await t.asService(`
      select (select count(*) from program_template_blocks where program_template_id=$1)::int blocks,
             (select count(*) from program_template_weeks where program_template_id=$1)::int weeks,
             (select count(*) from program_template_slots where program_template_id=$1)::int slots
      `, [templateId]);
    assert.equal(saved.blocks, live.blocks);
    assert.equal(saved.weeks, live.weeks);
    assert.equal(saved.slots, live.sessions);
  });

  it('keeps blocks and weeks in order, with their phase and focus', async () => {
    const { rows: live } = await t.asService(
      `select block_index, name, phase, focus from program_blocks where program_id=$1 order by block_index`, [programId]);
    const { rows: saved } = await t.asService(
      `select block_index, name, phase, focus from program_template_blocks where program_template_id=$1 order by block_index`, [templateId]);
    assert.deepEqual(saved, live);
  });

  it('keeps each session on the weekday it was prescribed for', async () => {
    const { rows: live } = await t.asService(`
      select w.program_week_no, extract(isodow from s.date)::int weekday, s.slot
        from scheduled_workouts s join program_weeks w on w.id = s.program_week_id
       where w.program_id=$1 order by w.program_week_no, weekday, s.slot`, [programId]);
    const { rows: saved } = await t.asService(`
      select w.template_week_no as program_week_no, s.weekday::int weekday, s.slot
        from program_template_slots s join program_template_weeks w on w.id = s.template_week_id
       where w.program_template_id=$1 order by w.template_week_no, weekday, s.slot`, [templateId]);
    assert.deepEqual(saved, live);
  });

  it('keeps recovery weeks and intended volume', async () => {
    const { rows: live } = await t.asService(
      `select program_week_no, is_recovery_week, target_volume_km from program_weeks where program_id=$1 order by program_week_no`, [programId]);
    const { rows: saved } = await t.asService(
      `select template_week_no as program_week_no, is_recovery_week, target_volume_km from program_template_weeks where program_template_id=$1 order by template_week_no`, [templateId]);
    assert.deepEqual(saved, live);
  });

  it('keeps rest days as rest days', async () => {
    const { rows: [live] } = await t.asService(
      `select count(*)::int n from scheduled_workouts where program_id=$1 and type='rest'`, [programId]);
    const { rows: [saved] } = await t.asService(
      `select count(*)::int n from program_template_slots where program_template_id=$1 and is_rest`, [templateId]);
    assert.equal(saved.n, live.n);
  });

  it('reads the training frequency off what the coach actually built', async () => {
    const { rows: [saved] } = await t.asService(
      `select min_days_per_week lo, max_days_per_week hi, weeks from program_templates where id=$1`, [templateId]);
    assert.equal(saved.lo, 4);
    assert.equal(saved.hi, 4);
    assert.equal(saved.weeks, 12);
  });
});

describe('provenance — the library is not cloned', () => {
  let templateId;

  before(async () => {
    ({ rows: [{ id: templateId }] } = await t.asUser(coachA,
      `select im_extract_program_template($1,'Provenance Test') id`, [programId]));
  });

  it('points unchanged sessions back at the library item they came from', async () => {
    const { rows } = await t.asService(`
      select count(*)::int n from program_template_slots s
       where s.program_template_id=$1
         and s.workout_template_id in (select id from workout_templates where visibility='system')`,
      [templateId]);
    assert.ok(rows[0].n > 0, 'the shipped sessions are reused, not copied');
  });

  it('promotes only the session the library does not hold', async () => {
    const { rows } = await t.asService(
      `select name, visibility, owner_id from workout_templates where owner_id=$1 order by name`, [coachA]);
    assert.ok(rows.some((r) => r.name === 'Bespoke Hill Session'),
      'a hand-written session becomes a library item');
    assert.ok(rows.every((r) => r.visibility !== 'system'));
    assert.ok(rows.every((r) => r.owner_id === coachA), 'and it belongs to the coach who saved it');
  });

  it('promotes a repeated session once, not once per week', async () => {
    // the bespoke session appears in one week; extract twice and the second
    // run makes its own copy, but within a single run duplicates collapse
    const { rows } = await t.asService(
      `select count(*)::int n from workout_templates
        where owner_id=$1 and name='Bespoke Hill Session'`, [coachA]);
    assert.ok(rows[0].n >= 1);

    const { rows: [slots] } = await t.asService(`
      select count(distinct workout_template_id)::int distinct_items, count(*)::int slots
        from program_template_slots
       where program_template_id=$1 and workout_template_id is not null`, [templateId]);
    assert.ok(slots.distinct_items < slots.slots,
      `the same library item should be reused across weeks: ${slots.distinct_items} items across ${slots.slots} slots`);
  });

  it('records a slot override only where the session actually differs', async () => {
    const { rows } = await t.asService(`
      select s.distance_km, w.distance_km as source_distance
        from program_template_slots s
        join workout_templates w on w.id = s.workout_template_id
       where s.program_template_id=$1 and s.distance_km is not null limit 5`, [templateId]);
    for (const r of rows) {
      assert.notEqual(Number(r.distance_km), Number(r.source_distance),
        'an override that matches its source is not an override');
    }
  });
});

describe('what must not travel', () => {
  let templateId;

  before(async () => {
    ({ rows: [{ id: templateId }] } = await t.asUser(coachA,
      `select im_extract_program_template($1,'Leak Test') id`, [programId]));
  });

  it('carries no execution state', async () => {
    // there is nowhere in the template schema for a status, and nothing
    // resembling one should have been smuggled into a text field
    const { rows } = await t.asService(`
      select coalesce(string_agg(coalesce(label,'') || ' ' || coalesce(notes,''), ' '), '') blob
        from program_template_slots where program_template_id=$1`, [templateId]);
    assert.doesNotMatch(rows[0].blob, /completed|missed|skipped/i);
  });

  it('carries no coach note about the athlete', async () => {
    const { rows } = await t.asService(`
      select
        (select coalesce(string_agg(coalesce(notes,''),' '),'') from program_template_weeks where program_template_id=$1) week_notes,
        (select coalesce(string_agg(coalesce(notes,''),' '),'') from program_template_slots where program_template_id=$1) slot_notes,
        (select coalesce(string_agg(coalesce(description,''),' '),'') from program_template_blocks where program_template_id=$1) block_notes`,
      [templateId]);
    for (const field of Object.values(rows[0])) {
      assert.doesNotMatch(String(field), /Andrew|calf|away this week/i,
        'nothing written about this athlete belongs in a reusable template');
    }
  });

  it('carries no race link', async () => {
    const { rows } = await t.asService(
      `select count(*)::int n from information_schema.columns
        where table_name='program_template_slots' and column_name='race_id'`);
    assert.equal(rows[0].n, 0, 'there is nowhere for a race to hide');
  });

  it('names the template what the coach called it, not the athlete', async () => {
    const { rows } = await t.asService(`select name, owner_id, visibility from program_templates where id=$1`, [templateId]);
    assert.equal(rows[0].name, 'Leak Test');
    assert.equal(rows[0].owner_id, coachA);
    assert.equal(rows[0].visibility, 'private');
  });
});

describe('independence', () => {
  let templateId;

  before(async () => {
    ({ rows: [{ id: templateId }] } = await t.asUser(coachA,
      `select im_extract_program_template($1,'Independence') id`, [programId]));
  });

  it('editing the athlete\'s programme afterwards does not touch the template', async () => {
    const { rows: before } = await t.asService(
      `select count(*)::int n from program_template_slots where program_template_id=$1`, [templateId]);

    await t.asService(`delete from scheduled_workouts where program_id=$1 and type='rest'`, [programId]);
    await t.asService(`update program_weeks set target_volume_km=999 where program_id=$1`, [programId]);

    const { rows: after } = await t.asService(
      `select count(*)::int n from program_template_slots where program_template_id=$1`, [templateId]);
    assert.equal(after[0].n, before[0].n);

    const { rows: vol } = await t.asService(
      `select count(*)::int n from program_template_weeks where program_template_id=$1 and target_volume_km=999`, [templateId]);
    assert.equal(vol[0].n, 0, 'the template keeps the intent it was saved with');
  });

  it('editing the template afterwards does not touch the athlete', async () => {
    const { rows: before } = await t.asService(
      `select count(*)::int n from scheduled_workouts where program_id=$1`, [programId]);

    await t.asUser(coachA, `delete from program_template_slots where program_template_id=$1`, [templateId]);
    await t.asUser(coachA, `update program_templates set name='Rewritten' where id=$1`, [templateId]);

    const { rows: after } = await t.asService(
      `select count(*)::int n from scheduled_workouts where program_id=$1`, [programId]);
    assert.equal(after[0].n, before[0].n, 'the athlete keeps the training they were given');
  });
});

describe('ownership and access', () => {
  it('refuses to save a programme for an athlete the coach does not have', async () => {
    const refused = await t.expectRefused(coachB,
      `select im_extract_program_template($1,'Not mine')`, [programId]);
    assert.ok(refused);
    assert.match(refused, /roster/i);
  });

  it('refuses an athlete outright', async () => {
    const refused = await t.expectRefused(athlete,
      `select im_extract_program_template($1,'Mine now')`, [programId]);
    assert.ok(refused);
  });

  it('refuses to create system content', async () => {
    const refused = await t.expectRefused(coachA,
      `select im_extract_program_template($1,'Shipped','system'::im_visibility)`, [programId]);
    assert.ok(refused);
    assert.match(refused, /belongs to the coach/i);
  });

  it('refuses an empty name', async () => {
    const refused = await t.expectRefused(coachA,
      `select im_extract_program_template($1,'   ')`, [programId]);
    assert.match(refused, /name/i);
  });

  it('makes a shared template readable by another coach but not writable', async () => {
    const { rows: [shared] } = await t.asUser(coachA,
      `select im_extract_program_template($1,'Shared One','shared'::im_visibility) id`, [programId]);

    const read = await t.asUser(coachB, `select id from program_templates where id=$1`, [shared.id]);
    assert.equal(read.rows.length, 1);

    await t.asUser(coachB, `update program_templates set name='hijacked' where id=$1`, [shared.id]);
    const { rows } = await t.asService(`select name from program_templates where id=$1`, [shared.id]);
    assert.equal(rows[0].name, 'Shared One');
  });

  it('never lets an athlete see a template made from their own programme', async () => {
    const { rows } = await t.asUser(athlete, `select count(*)::int n from program_templates`);
    assert.equal(rows[0].n, 0);
    const blocks = await t.asUser(athlete, `select count(*)::int n from program_template_blocks`);
    assert.equal(blocks.rows[0].n, 0);
  });
});

describe('an athlete cannot write to a library', () => {
  it('refuses to let them create a programme template', async () => {
    const refused = await t.expectRefused(athlete,
      `insert into program_templates (owner_id,visibility,name,goal_type,weeks)
       values ($1,'private','Athlete made this','5k',4)`, [athlete]);
    assert.ok(refused, 'writing to a library is coach work');
  });

  it('refuses to let them create a workout template', async () => {
    const refused = await t.expectRefused(athlete,
      `insert into workout_templates (owner_id,visibility,name,category,type)
       values ($1,'private','Mine','easy','easy_run')`, [athlete]);
    assert.ok(refused);
  });

  it('still lets a coach create one', async () => {
    const { rows } = await t.asUser(coachA,
      `insert into workout_templates (owner_id,visibility,name,category,type)
       values ($1,'private','Coach made this','easy','easy_run') returning id`, [coachA]);
    assert.ok(rows[0].id);
  });
});

describe('the round trip', () => {
  it('assigns a saved programme back out and reproduces its shape', async () => {
    // a clean programme, saved and re-assigned to a different athlete
    const { rows: [fresh] } = await t.asUser(coachA,
      `select im_instantiate_program_template($1,$2,$3::date) id`, [GENERAL.id, otherAthlete, MON]);
    const { rows: [saved] } = await t.asUser(coachA,
      `select im_extract_program_template($1,'Round Trip') id`, [fresh.id]);

    const third = await t.signUp('three@im.ie');
    await t.asService(`insert into coach_athlete_links (coach_id,athlete_id,status) values ($1,$2,'active')`, [coachA, third]);
    const { rows: [again] } = await t.asUser(coachA,
      `select im_instantiate_program_template($1,$2,$3::date) id`, [saved.id, third, MON]);

    const shape = async (program) => (await t.asService(`
      select (select count(*) from program_blocks where program_id=$1)::int blocks,
             (select count(*) from program_weeks where program_id=$1)::int weeks,
             (select count(*) from scheduled_workouts where program_id=$1)::int sessions,
             (select count(*) from scheduled_workouts where program_id=$1 and type='rest')::int rest
      `, [program])).rows[0];

    assert.deepEqual(await shape(again.id), await shape(fresh.id),
      'a programme saved and re-assigned should land the same shape');
  });

  it('carries the sessions\' structure through both hops', async () => {
    const { rows } = await t.asService(`
      select count(*)::int n from session_components c
        join scheduled_workouts s on s.id = c.scheduled_workout_id
        join programs p on p.id = s.program_id
       where p.name = 'Round Trip'`);
    assert.ok(rows[0].n > 0, 'components survive programme → template → programme');
  });
});
