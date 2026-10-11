import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/**
 * BATCH OPERATIONS, AGAINST REAL POSTGRES.
 *
 * The claim this slice makes is that acting on many athletes is exactly as
 * safe as acting on one, because it *is* acting on one, repeatedly. The way
 * that claim fails is a batch that authorises once and then loops — so the
 * assertions here are mostly attempts to smuggle an athlete into a list.
 */

let t, coachA, coachB, athleteA1, athleteA2, athleteB1, outsider;

before(async () => {
  t = await createTestDatabase();

  coachA = await t.signUp('coach.a@ironmiles.ie', 'Coach A');
  coachB = await t.signUp('coach.b@ironmiles.ie', 'Coach B');
  await t.setRole(coachA, 'coach');
  await t.setRole(coachB, 'coach');

  athleteA1 = await t.signUp('a1@ironmiles.ie', 'Athlete A1');
  athleteA2 = await t.signUp('a2@ironmiles.ie', 'Athlete A2');
  athleteB1 = await t.signUp('b1@ironmiles.ie', 'Athlete B1');
  outsider  = await t.signUp('outsider@ironmiles.ie', 'Outsider');

  await t.asService(
    `insert into coach_athlete_links (coach_id, athlete_id, status) values
       ($1,$2,'active'), ($1,$3,'active'), ($4,$5,'active')`,
    [coachA, athleteA1, athleteA2, coachB, athleteB1]);
});

after(() => t.close());

const openBatch = (user, action = 'scale_volume') => t.asUser(user,
  `select im_open_batch($1, '{"factor":0.9}'::jsonb, 2) as id`, [action]);

describe('opening a batch', () => {
  it('belongs to whoever asked, never to an id they supply', async () => {
    const { rows } = await openBatch(coachA);
    const owner = await t.asService(
      `select coach_id from coach_batches where id = $1`, [rows[0].id]);
    assert.equal(owner.rows[0].coach_id, coachA);
  });

  it('refuses an athlete', async () => {
    const message = await t.expectRefused(athleteA1,
      `select im_open_batch('scale_volume')`);
    assert.match(message ?? '', /Only a coach/i);
  });

  it('refuses someone with no role at all', async () => {
    assert.ok(await t.expectRefused(outsider, `select im_open_batch('scale_volume')`));
  });
});

describe('a poisoned list', () => {
  it('refuses the athlete who is not on the roster, one at a time', async () => {
    // the whole design: coaching athleteA1 does not vouch for athleteB1
    const { rows } = await openBatch(coachA);
    const batch = rows[0].id;

    await t.asUser(coachA,
      `select im_record_batch_item($1,$2,'applied','done')`, [batch, athleteA1]);

    const message = await t.expectRefused(coachA,
      `select im_record_batch_item($1,$2,'applied','smuggled')`, [batch, athleteB1]);
    assert.match(message ?? '', /not on your roster/i);

    const items = await t.asService(
      `select athlete_id from coach_batch_items where batch_id = $1`, [batch]);
    assert.deepEqual(items.rows.map((r) => r.athlete_id), [athleteA1],
      'the authorised athlete still succeeded; the smuggled one left no trace of success');
  });

  it('still records that an unauthorised athlete was attempted', async () => {
    // a poisoned id must be reported, not silently dropped from the record
    const { rows } = await openBatch(coachA);
    const batch = rows[0].id;

    await t.asUser(coachA,
      `select im_record_batch_item($1,$2,'unauthorised','Not on your roster.')`,
      [batch, athleteB1]);

    const items = await t.asService(
      `select athlete_id, outcome from coach_batch_items where batch_id = $1`, [batch]);
    assert.equal(items.rows[0].outcome, 'unauthorised');
    assert.equal(items.rows[0].athlete_id, athleteB1);
  });

  it('refuses a coach writing into another coach\'s batch', async () => {
    const { rows } = await openBatch(coachA);
    const message = await t.expectRefused(coachB,
      `select im_record_batch_item($1,$2,'applied','theirs')`, [rows[0].id, athleteB1]);
    assert.match(message ?? '', /not your batch/i);
  });

  it('refuses an athlete writing their own outcome', async () => {
    const { rows } = await openBatch(coachA);
    assert.ok(await t.expectRefused(athleteA1,
      `select im_record_batch_item($1,$2,'applied','I did it')`, [rows[0].id, athleteA1]));
  });

  it('refuses a record against a batch that does not exist', async () => {
    const message = await t.expectRefused(coachA,
      `select im_record_batch_item('00000000-0000-0000-0000-000000000001'::uuid,$1,'applied')`,
      [athleteA1]);
    assert.match(message ?? '', /No such batch/i);
  });

  it('refuses a direct insert, bypassing the function', async () => {
    const { rows } = await openBatch(coachA);
    assert.ok(await t.expectRefused(coachA,
      `insert into coach_batch_items (batch_id, athlete_id, outcome)
       values ($1,$2,'applied')`, [rows[0].id, athleteB1]));
  });

  it('refuses a hand-written batch header', async () => {
    assert.ok(await t.expectRefused(coachA,
      `insert into coach_batches (coach_id, action) values ($1,'scale_volume')`, [coachA]));
  });
});

describe('one athlete failing never hides the others', () => {
  it('records every outcome side by side', async () => {
    const { rows } = await openBatch(coachA);
    const batch = rows[0].id;

    await t.asUser(coachA, `select im_record_batch_item($1,$2,'applied','2 sessions changed')`, [batch, athleteA1]);
    await t.asUser(coachA, `select im_record_batch_item($1,$2,'blocked','Their week is already complete.')`, [batch, athleteA2]);
    await t.asUser(coachA, `select im_record_batch_item($1,$2,'unauthorised','Not on your roster.')`, [batch, athleteB1]);

    const items = await t.asUser(coachA,
      `select outcome, detail from coach_batch_items where batch_id = $1 order by outcome`, [batch]);
    assert.deepEqual(items.rows.map((r) => r.outcome).sort(),
      ['applied', 'blocked', 'unauthorised']);
    assert.match(items.rows.find((r) => r.outcome === 'blocked').detail, /already complete/);
  });

  it('reports the same athlete once when a batch is retried', async () => {
    const { rows } = await openBatch(coachA);
    const batch = rows[0].id;

    await t.asUser(coachA, `select im_record_batch_item($1,$2,'failed','timed out')`, [batch, athleteA1]);
    await t.asUser(coachA, `select im_record_batch_item($1,$2,'applied','worked second time')`, [batch, athleteA1]);

    const items = await t.asService(
      `select outcome, detail from coach_batch_items where batch_id = $1`, [batch]);
    assert.equal(items.rows.length, 1, 'one row per athlete per batch');
    assert.equal(items.rows[0].outcome, 'applied', 'the latest outcome wins');
  });
});

describe('who can read a batch back', () => {
  let batch;
  before(async () => {
    const { rows } = await openBatch(coachA, 'shift_sessions');
    batch = rows[0].id;
    await t.asUser(coachA, `select im_record_batch_item($1,$2,'applied','3 sessions moved')`, [batch, athleteA1]);
  });

  it('shows a coach their own batches', async () => {
    const { rows } = await t.asUser(coachA,
      `select count(*)::int n from coach_batches where id = $1`, [batch]);
    assert.equal(rows[0].n, 1);
  });

  it('shows another coach nothing of them', async () => {
    const { rows } = await t.asUser(coachB,
      `select count(*)::int n from coach_batches where id = $1`, [batch]);
    assert.equal(rows[0].n, 0);
  });

  it('lets an athlete see that their own change was part of a batch', async () => {
    // they are entitled to know a change was squad-wide rather than aimed at them
    const { rows } = await t.asUser(athleteA1,
      `select count(*)::int n from coach_batch_items where batch_id = $1`, [batch]);
    assert.equal(rows[0].n, 1);
  });

  it('shows an athlete nothing about anyone else in the batch', async () => {
    await t.asUser(coachA, `select im_record_batch_item($1,$2,'applied','also moved')`, [batch, athleteA2]);
    const { rows } = await t.asUser(athleteA1,
      `select athlete_id from coach_batch_items where batch_id = $1`, [batch]);
    assert.deepEqual(rows.map((r) => r.athlete_id), [athleteA1],
      'a batch is not a roster listing for the athletes in it');
  });

  it('shows an outsider nothing at all', async () => {
    const { rows } = await t.asUser(outsider, `select count(*)::int n from coach_batch_items`);
    assert.equal(rows[0].n, 0);
  });

  it('answers "why did this athlete change on that day"', async () => {
    const { rows } = await t.asUser(coachA,
      `select action, outcome, athlete_count from im_batch_history($1, 10)`, [athleteA1]);
    assert.ok(rows.length > 0);
    assert.equal(rows[0].action, 'shift_sessions');
    assert.equal(rows[0].outcome, 'applied');
    assert.equal(rows[0].athlete_count, 2, 'and that it was two athletes, not one');
  });

  it('lets the athlete ask the same question about themselves', async () => {
    const { rows } = await t.asUser(athleteA1,
      `select count(*)::int n from im_batch_history($1, 10)`, [athleteA1]);
    assert.ok(rows[0].n > 0);
  });

  it('refuses one athlete asking about another', async () => {
    const { rows } = await t.asUser(athleteA1,
      `select count(*)::int n from im_batch_history($1, 10)`, [athleteA2]);
    assert.equal(rows[0].n, 0);
  });
});

describe('the per-athlete history is untouched', () => {
  it('adds no new history table — session_revisions is still the record', async () => {
    // the batch record answers "why several at once", never "what changed"
    const { rows } = await t.asService(
      `select count(*)::int n from information_schema.columns
        where table_name = 'session_revisions' and column_name like '%batch%'`);
    assert.equal(rows[0].n, 0,
      'no batch column was bolted onto the prescription history');
  });

  it('adds no privileged uuid[] function that bypasses the single-athlete guards', async () => {
    const { rows } = await t.asService(
      `select p.proname from pg_proc p
         join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname like 'im_batch%'
          and pg_get_function_identity_arguments(p.oid) like '%uuid[]%'`);
    assert.deepEqual(rows, [],
      'a batch is the existing single-athlete functions called repeatedly');
  });
});
