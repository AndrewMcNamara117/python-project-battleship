import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';
import { triageCheckIn } from '../../src/lib/domain/checkin-rules.ts';

/**
 * THE LEVEL IS NOT THE ATHLETE'S TO CHOOSE.
 *
 * Slice 10 left one column of `checkins` writable by the athlete it belongs
 * to: `attention_level`. Everything else a coach owns was closed by a trigger,
 * but the level was reported as a known limitation because the rules that
 * decide it read free text and last week's scores, and reimplementing them in
 * SQL would have made two definitions of triage that drift.
 *
 * 0018 does not reimplement them. It enforces a floor from the scores already
 * on the row. These tests prove both halves of that: that the floor holds
 * against a hand-crafted write, and — the part that keeps the duplication
 * honest — that the floor never claims more than the canonical rules do.
 */

let t, coachA, athleteA;

before(async () => {
  t = await createTestDatabase();
  coachA = await t.signUp('coach.floor@ironmiles.ie', 'Coach Floor');
  await t.setRole(coachA, 'coach');
  athleteA = await t.signUp('athlete.floor@ironmiles.ie', 'Athlete Floor');
  await t.asService(
    `insert into coach_athlete_links (coach_id, athlete_id, status) values ($1,$2,'active')`,
    [coachA, athleteA]);
});

after(() => t.close());

const insert = (as, week, scores, level) => as(
  `insert into checkins (athlete_id, week_start, fatigue, sleep, soreness, stress,
                         motivation, confidence, training_difficulty, attention_level)
   values ($1,$2,$3,$4,$5,$6,$7,$8,5,$9::im_attention)
   returning attention_level`,
  [athleteA, week, scores.fatigue, scores.sleep, scores.soreness,
   scores.stress, scores.motivation, scores.confidence, level]);

const floorIn = async (scores) => (await t.asService(
  `select im_checkin_score_floor($1::smallint,$2::smallint,$3::smallint,
                                 $4::smallint,$5::smallint,$6::smallint) as level`,
  [scores.soreness, scores.fatigue, scores.sleep,
   scores.motivation, scores.stress, scores.confidence])).rows[0].level;

const healthy = {
  fatigue: 4, sleep: 7, soreness: 3, stress: 4, motivation: 8, confidence: 8,
  trainingDifficulty: 5,
};

describe('an athlete cannot mark their own bad week as nothing to see', () => {
  it('raises a hand-crafted "none" back to what the scores say', async () => {
    // the exact write Slice 10 reported as still open: honest scores, a level
    // chosen by hand so the check-in never reaches the coach's flagged list
    const bad = { ...healthy, soreness: 9, fatigue: 9 };
    const r = await insert(
      (sql, p) => t.asUser(athleteA, sql, p), '2026-09-07', bad, 'none');
    assert.equal(r.rows[0].attention_level, 'attention',
      'two scores at the threshold is attention whatever the request claimed');
  });

  it('holds on a resubmit, not only on the first write', async () => {
    await t.asUser(athleteA,
      `update checkins set attention_level = 'none' where athlete_id = $1 and week_start = $2`,
      [athleteA, '2026-09-07']);
    const after = await t.asService(
      `select attention_level from checkins where athlete_id = $1 and week_start = $2`,
      [athleteA, '2026-09-07']);
    assert.equal(after.rows[0].attention_level, 'attention',
      'the resubmit path was the way round the guard, so it is guarded too');
  });

  it('still lets a genuinely quiet week be quiet', async () => {
    const r = await insert(
      (sql, p) => t.asUser(athleteA, sql, p), '2026-08-31', healthy, 'none');
    assert.equal(r.rows[0].attention_level, 'none',
      'a floor is not a ratchet: nothing is invented from good scores');
  });

  it('never lowers a level the rules raised for something it cannot see', async () => {
    // described pain with unremarkable scores: the canonical rules escalate,
    // the floor knows nothing about it, and must not undo it
    const r = await insert(
      (sql, p) => t.asService(sql, p), '2026-08-24', healthy, 'attention');
    assert.equal(r.rows[0].attention_level, 'attention',
      'the floor raises and never lowers');
  });
});

describe('the floor and the canonical rules do not drift', () => {
  // A deterministic sweep. With no free text, no history and nothing
  // prescribed, the canonical rules have only the scores to go on — so the
  // floor should agree with them exactly. If someone edits a threshold in
  // checkin-rules.ts and not in 0018, this is what fails.
  const values = [1, 2, 3, 4, 7, 8, 9, 10];
  const combos = [];
  let seed = 20260828;
  const next = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = 0; i < 400; i += 1) {
    combos.push({
      fatigue: values[Math.floor(next() * values.length)],
      sleep: values[Math.floor(next() * values.length)],
      soreness: values[Math.floor(next() * values.length)],
      stress: values[Math.floor(next() * values.length)],
      motivation: values[Math.floor(next() * values.length)],
      confidence: values[Math.floor(next() * values.length)],
      trainingDifficulty: 5,
    });
  }
  // and every single-score extreme, so no threshold escapes the sweep
  for (const key of ['fatigue', 'sleep', 'soreness', 'stress', 'motivation', 'confidence']) {
    for (const v of [1, 3, 4, 7, 8, 10]) combos.push({ ...healthy, [key]: v });
  }

  const RANK = { none: 0, watch: 1, attention: 2 };

  it('agrees exactly when the scores are all the rules have', async () => {
    for (const scores of combos) {
      const canonical = triageCheckIn({
        scores, freeText: [], sessionsCompleted: 0, sessionsPrescribed: 0, history: [],
      }).level;
      const floor = await floorIn(scores);
      assert.equal(floor, canonical,
        `floor ${floor} vs rules ${canonical} for ${JSON.stringify(scores)}`);
    }
  });

  it('never claims more than the rules once text and history are in play', async () => {
    for (const scores of combos.slice(0, 120)) {
      const canonical = triageCheckIn({
        scores,
        freeText: ['Sharp pain in my knee, getting worse'],
        sessionsCompleted: 0,
        sessionsPrescribed: 5,
        history: [{ scores }],
      }).level;
      const floor = await floorIn(scores);
      assert.ok(RANK[floor] <= RANK[canonical],
        `the floor must never exceed the canonical level (${floor} > ${canonical})`);
    }
  });
});
