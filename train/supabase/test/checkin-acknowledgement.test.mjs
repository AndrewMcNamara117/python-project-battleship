import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/**
 * READ, REPLIED, AND STILL A CONCERN.
 *
 * Three facts about one check-in that a product is tempted to collapse into
 * one boolean. The tests that matter here are the ones that prove they stay
 * apart: that reading is not answering, that answering is also reading, and
 * that neither of them makes a reported injury stop being reported.
 */

let t, coachA, coachB, athleteA, athleteB, outsider;

const submit = (athlete, week, attention = 'none', pain = '') => t.asService(
  `insert into checkins (athlete_id, week_start, fatigue, sleep, soreness, stress,
                         motivation, confidence, training_difficulty,
                         pain_or_niggles, attention_level)
   values ($1,$2,5,7,$5,4,7,7,5,$4,$3::im_attention) returning id`,
  [athlete, week, attention, pain, attention === 'attention' ? 9 : 3]);

before(async () => {
  t = await createTestDatabase();
  coachA = await t.signUp('coach.a@ironmiles.ie', 'Coach A');
  coachB = await t.signUp('coach.b@ironmiles.ie', 'Coach B');
  await t.setRole(coachA, 'coach');
  await t.setRole(coachB, 'coach');
  athleteA = await t.signUp('a1@ironmiles.ie', 'Athlete A');
  athleteB = await t.signUp('b1@ironmiles.ie', 'Athlete B');
  outsider = await t.signUp('outsider@ironmiles.ie', 'Outsider');
  await t.asService(
    `insert into coach_athlete_links (coach_id, athlete_id, status) values ($1,$2,'active'), ($3,$4,'active')`,
    [coachA, athleteA, coachB, athleteB]);
});

after(() => t.close());

const state = async (id) => (await t.asService(
  `select acknowledged_at, acknowledged_by, responded_at, coach_response
     from checkins where id = $1`, [id])).rows[0];

describe('the three states', () => {
  it('starts unread: nothing acknowledged, nothing answered', async () => {
    const { rows } = await submit(athleteA, '2026-08-03');
    const s = await state(rows[0].id);
    assert.equal(s.acknowledged_at, null);
    assert.equal(s.responded_at, null);
  });

  it('marking read records who and when, and no reply', async () => {
    const { rows } = await submit(athleteA, '2026-08-10');
    const changed = await t.asUser(coachA, `select im_acknowledge_checkin($1) as c`, [rows[0].id]);
    assert.equal(changed.rows[0].c, true);

    const s = await state(rows[0].id);
    assert.ok(s.acknowledged_at, 'read');
    assert.equal(s.acknowledged_by, coachA, 'and by whom');
    assert.equal(s.responded_at, null, 'but nothing was said');
    assert.equal(s.coach_response, null);
  });

  it('is idempotent, and keeps the moment the coach actually looked', async () => {
    const { rows } = await submit(athleteA, '2026-08-17');
    await t.asUser(coachA, `select im_acknowledge_checkin($1)`, [rows[0].id]);
    const first = (await state(rows[0].id)).acknowledged_at;

    const again = await t.asUser(coachA, `select im_acknowledge_checkin($1) as c`, [rows[0].id]);
    assert.equal(again.rows[0].c, false, 'nothing new to record');
    assert.deepEqual((await state(rows[0].id)).acknowledged_at, first,
      'a retried batch does not rewrite when the coach read it');
  });

  it('replying to an unread check-in reads it as well', async () => {
    const { rows } = await submit(athleteA, '2026-08-24');
    await t.asUser(coachA,
      `select im_respond_to_checkin($1, 'Good week. Hold the volume.')`, [rows[0].id]);

    const s = await state(rows[0].id);
    assert.ok(s.acknowledged_at, 'you cannot answer what you have not read');
    assert.ok(s.responded_at, 'and it is on the record as an answer');
    assert.equal(s.coach_response, 'Good week. Hold the volume.');
  });

  it('replying to an already-read check-in keeps the original read time', async () => {
    const { rows } = await submit(athleteA, '2026-08-31');
    await t.asUser(coachA, `select im_acknowledge_checkin($1)`, [rows[0].id]);
    const read = (await state(rows[0].id)).acknowledged_at;

    await t.asUser(coachA, `select im_respond_to_checkin($1, 'Following up on this.')`, [rows[0].id]);
    const s = await state(rows[0].id);
    assert.deepEqual(s.acknowledged_at, read, 'read then, answered later');
    assert.ok(s.responded_at > s.acknowledged_at, 'and the gap is visible');
  });

  it('refuses an empty reply, as it always did', async () => {
    const { rows } = await submit(athleteA, '2026-09-07');
    const message = await t.expectRefused(coachA,
      `select im_respond_to_checkin($1, '  ')`, [rows[0].id]);
    assert.match(message ?? '', /Write a response first/);
    assert.equal((await state(rows[0].id)).acknowledged_at, null,
      'a refused reply does not sneak in a read');
  });
});

describe('read is not resolved', () => {
  it('a flagged check-in stays unanswered after it is read', async () => {
    // the whole point: reading "my Achilles is sore" has not helped the Achilles
    const { rows } = await submit(athleteA, '2026-09-14', 'attention', 'Left Achilles sore on hills.');
    await t.asUser(coachA, `select im_acknowledge_checkin($1)`, [rows[0].id]);

    const s = await state(rows[0].id);
    assert.ok(s.acknowledged_at);
    assert.equal(s.responded_at, null,
      'the roster reads responded_at for the flagged signal, so it stays up');
  });

  it('keeps the athlete\'s words whatever the coach clicked', async () => {
    const { rows } = await t.asService(
      `select id, pain_or_niggles from checkins where week_start = '2026-09-14' and athlete_id = $1`,
      [athleteA]);
    assert.match(rows[0].pain_or_niggles, /Achilles/,
      'acknowledgement never edits what was reported');
  });
});

describe('who may mark a check-in read', () => {
  let theirs;
  before(async () => {
    const { rows } = await submit(athleteB, '2026-09-14');
    theirs = rows[0].id;
  });

  it('refuses a coach acknowledging another coach\'s athlete', async () => {
    const message = await t.expectRefused(coachA,
      `select im_acknowledge_checkin($1)`, [theirs]);
    assert.match(message ?? '', /not on your roster/i);
    assert.equal((await state(theirs)).acknowledged_at, null);
  });

  it('refuses that coach replying to it either', async () => {
    assert.ok(await t.expectRefused(coachA,
      `select im_respond_to_checkin($1, 'Not mine to answer')`, [theirs]));
  });

  it('refuses the athlete marking their own check-in read', async () => {
    // "my coach has seen this" is not a claim the athlete gets to make
    const { rows } = await submit(athleteA, '2026-09-21');
    assert.ok(await t.expectRefused(athleteA, `select im_acknowledge_checkin($1)`, [rows[0].id]));
  });

  it('refuses an outsider entirely', async () => {
    assert.ok(await t.expectRefused(outsider, `select im_acknowledge_checkin($1)`, [theirs]));
  });

  it('refuses a check-in that does not exist', async () => {
    const message = await t.expectRefused(coachA,
      `select im_acknowledge_checkin('00000000-0000-0000-0000-000000000009'::uuid)`);
    assert.match(message ?? '', /No such check-in/);
  });

  it('a coach hand-writing onto someone else\'s row changes nothing', async () => {
    // RLS filters the row out rather than raising, which is why the state is
    // asserted directly: "no rows affected" and "refused" look the same
    await t.asUser(coachA, `update checkins set acknowledged_at = now() where id = $1`, [theirs]);
    assert.equal((await state(theirs)).acknowledged_at, null);
  });

  it('refuses an athlete writing the coach\'s columns on their own check-in', async () => {
    // an older hole this slice closed: `checkins_own_write` is `for all`, so an
    // athlete could write a coach_response their coach never said and mark it
    // reviewed, taking a flagged check-in out of the queue unseen
    const { rows } = await submit(athleteA, '2026-09-28');
    const message = await t.expectRefused(athleteA,
      `update checkins set coach_response = 'Coach said it is fine',
                           acknowledged_at = now(), responded_at = now()
        where id = $1`, [rows[0].id]);
    assert.match(message ?? '', /not yours to write/i);

    const s = await state(rows[0].id);
    assert.equal(s.acknowledged_at, null);
    assert.equal(s.coach_response, null);
  });

  it('still lets an athlete rewrite their own answers', async () => {
    // check-ins are upserted; resubmitting a week is legitimate
    const { rows } = await t.asService(
      `select id from checkins where athlete_id = $1 and week_start = '2026-09-28'`, [athleteA]);
    await t.asUser(athleteA,
      `update checkins set went_well = 'Actually the long run went well.' where id = $1`, [rows[0].id]);
    const { rows: after } = await t.asService(
      `select went_well from checkins where id = $1`, [rows[0].id]);
    assert.match(after[0].went_well, /long run went well/);
  });
});

describe('the roster carries both facts', () => {
  it('reports acknowledgement and response separately', async () => {
    const { rows } = await t.asUser(coachA,
      `select checkin_acknowledged_at, checkin_responded_at
         from im_coach_roster(null, current_date) where athlete_id = $1`, [athleteA]);
    assert.equal(rows.length, 1);
    assert.ok('checkin_acknowledged_at' in rows[0]);
    assert.ok('checkin_responded_at' in rows[0]);
  });

  it('still gives a coach only their own athletes', async () => {
    const { rows } = await t.asUser(coachA, `select athlete_id from im_coach_roster(null, current_date)`);
    assert.ok(!rows.some((r) => r.athlete_id === athleteB));
  });
});
