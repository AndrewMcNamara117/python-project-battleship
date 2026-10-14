import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/**
 * Activities under the real policies.
 *
 * An imported activity is health data with a location attached, so the
 * claims are the same as for a training log and one more: a row may only
 * reference the athlete's own plan. Each of those is executed here against
 * the shipped migrations as a non-superuser.
 */

let t;
let coach, otherCoach, athlete, otherAthlete;
let mySession, theirSession, theirLog;

const FP = (c) => c.repeat(64);

const insertActivity = (who, athleteId, extra = {}) => {
  const row = {
    athlete_id: athleteId,
    format: 'fit',
    fingerprint: FP('a'),
    name: 'Morning run',
    sport: 'run',
    started_at: '2026-10-10T07:00:00Z',
    local_date: '2026-10-10',
    distance_m: 5000,
    moving_s: 1500,
    elapsed_s: 1520,
    ...extra,
  };
  const cols = Object.keys(row);
  const sql = `insert into activities (${cols.join(', ')}) values (${cols.map((_, i) => `$${i + 1}`).join(', ')}) returning id`;
  return who === 'service' ? t.asService(sql, Object.values(row)) : t.asUser(who, sql, Object.values(row));
};

before(async () => {
  t = await createTestDatabase();
  coach = await t.signUp('coach@ironmiles.ie', 'A Coach');
  otherCoach = await t.signUp('other.coach@ironmiles.ie', 'Other Coach');
  athlete = await t.signUp('athlete@example.com', 'An Athlete');
  otherAthlete = await t.signUp('other@example.com', 'Other Athlete');
  await t.setRole(coach, 'coach');
  await t.setRole(otherCoach, 'coach');
  await t.asService(`insert into coach_athlete_links (coach_id, athlete_id, status) values ($1, $2, 'active')`, [coach, athlete]);

  const s1 = await t.asService(
    `insert into scheduled_workouts (athlete_id, date, name, type, status) values ($1, '2026-10-10', 'Easy 5K', 'easy_run', 'scheduled') returning id`,
    [athlete],
  );
  mySession = s1.rows[0].id;
  const s2 = await t.asService(
    `insert into scheduled_workouts (athlete_id, date, name, type, status) values ($1, '2026-10-10', 'Easy 5K', 'easy_run', 'scheduled') returning id`,
    [otherAthlete],
  );
  theirSession = s2.rows[0].id;
  const l2 = await t.asService(
    `insert into completed_workouts (athlete_id, date, type, source) values ($1, '2026-10-10', 'easy_run', 'manual') returning id`,
    [otherAthlete],
  );
  theirLog = l2.rows[0].id;
});

after(async () => t?.close());

describe('activities: ownership', () => {
  it('an athlete imports an activity of their own', async () => {
    const { rows } = await insertActivity(athlete, athlete, { scheduled_workout_id: mySession });
    assert.equal(rows.length, 1);
  });

  it('an athlete cannot import as somebody else', async () => {
    const refused = await insertActivity(athlete, otherAthlete, { fingerprint: FP('b') }).then(() => null, (e) => e.message);
    assert.match(refused ?? '', /row-level security/);
  });

  it('the same file twice is refused as a duplicate', async () => {
    const dup = await insertActivity(athlete, athlete).then(() => null, (e) => e.message);
    assert.match(dup ?? '', /unique|duplicate/i);
  });

  it('an athlete cannot attach their file to somebody else’s session', async () => {
    const refused = await insertActivity(athlete, athlete, { fingerprint: FP('c'), scheduled_workout_id: theirSession }).then(
      () => null,
      (e) => e.message,
    );
    assert.match(refused ?? '', /own session/);
  });

  it('or to somebody else’s log', async () => {
    const refused = await insertActivity(athlete, athlete, { fingerprint: FP('d'), completed_workout_id: theirLog }).then(
      () => null,
      (e) => e.message,
    );
    assert.match(refused ?? '', /own log/);
  });

  it('the link check holds on update too', async () => {
    const refused = await t.expectRefused(
      athlete,
      `update activities set scheduled_workout_id = $1 where athlete_id = $2`,
      [theirSession, athlete],
    );
    assert.match(refused ?? '', /own session/);
  });
});

describe('activities: who reads them', () => {
  it('the athlete reads their own', async () => {
    const { rows } = await t.asUser(athlete, 'select id from activities where athlete_id = $1', [athlete]);
    assert.equal(rows.length, 1);
  });

  it('their coach reads them', async () => {
    const { rows } = await t.asUser(coach, 'select id from activities where athlete_id = $1', [athlete]);
    assert.equal(rows.length, 1);
  });

  it('another coach does not', async () => {
    const { rows } = await t.asUser(otherCoach, 'select id from activities');
    assert.equal(rows.length, 0);
  });

  it('another athlete does not', async () => {
    const { rows } = await t.asUser(otherAthlete, 'select id from activities');
    assert.equal(rows.length, 0);
  });

  it('the coach cannot rewrite what the watch recorded', async () => {
    await t.asUser(coach, `update activities set distance_m = 42195 where athlete_id = $1`, [athlete]);
    const { rows } = await t.asService('select distance_m from activities where athlete_id = $1', [athlete]);
    assert.equal(rows[0].distance_m, 5000);
  });

  it('nor delete it', async () => {
    await t.asUser(coach, `delete from activities where athlete_id = $1`, [athlete]);
    const { rows } = await t.asService('select count(*)::int as n from activities where athlete_id = $1', [athlete]);
    assert.equal(rows[0].n, 1);
  });
});

describe('activities: schema guarantees', () => {
  it('a log may now come from an upload', async () => {
    const { rows } = await t.asUser(
      athlete,
      `insert into completed_workouts (athlete_id, date, type, source) values ($1, '2026-10-10', 'easy_run', 'upload') returning source`,
      [athlete],
    );
    assert.equal(rows[0].source, 'upload');
  });

  it('privacy trim is one of the offered distances', async () => {
    const refused = await t.expectRefused(athlete, `update profiles set privacy_trim_m = 37 where id = $1`, [athlete]);
    assert.ok(refused);
    const { rows } = await t.asUser(athlete, `update profiles set privacy_trim_m = 500 where id = $1 returning privacy_trim_m`, [athlete]);
    assert.equal(rows[0].privacy_trim_m, 500);
  });

  it('new accounts hide the first and last 200 m by default', async () => {
    const { rows } = await t.asService('select privacy_trim_m, max_heart_rate from profiles where id = $1', [otherAthlete]);
    assert.equal(rows[0].privacy_trim_m, 200);
    assert.equal(rows[0].max_heart_rate, null);
  });

  it('the GDPR export includes activities', async () => {
    const { rows } = await t.asUser(athlete, 'select im_export_athlete_data($1) as data', [athlete]);
    assert.equal(rows[0].data.activities.length, 1);
    assert.ok(rows[0].data.profile && rows[0].data.messages, 'the existing keys are still there');
  });

  it('deleting the athlete deletes their activities', async () => {
    const victim = await t.signUp('leaving@example.com', 'Leaving');
    await insertActivity('service', victim, { fingerprint: FP('e') });
    await t.asService('delete from auth.users where id = $1', [victim]);
    const { rows } = await t.asService('select count(*)::int as n from activities where athlete_id = $1', [victim]);
    assert.equal(rows[0].n, 0);
  });

  it('deleting a session keeps the activity and clears the link', async () => {
    await t.asService('delete from scheduled_workouts where id = $1', [mySession]);
    const { rows } = await t.asService('select scheduled_workout_id from activities where athlete_id = $1', [athlete]);
    assert.equal(rows[0].scheduled_workout_id, null);
  });
});
