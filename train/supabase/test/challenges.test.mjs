import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/** Club challenges under the real policies (migration 0027). */

let t;
let coach, runner, friend, stranger;
let sessions, distance, closed;

const challenge = async (name, metric, target, from, to) =>
  (
    await t.asUser(
      coach,
      `insert into challenges (name, metric, target, starts_on, ends_on, created_by) values ($1, $2, $3, $4, $5, $6) returning id`,
      [name, metric, target, from, to, coach],
    )
  ).rows[0].id;

const doneSession = async (who, date, type = 'easy_run') => {
  const { rows } = await t.asService(
    `insert into scheduled_workouts (athlete_id, date, name, type, status) values ($1, $2, 'Run', $3, 'completed') returning id`,
    [who, date, type],
  );
  await t.asService(
    `insert into completed_workouts (athlete_id, scheduled_workout_id, date, type, actual_distance_km, source) values ($1, $2, $3, 'easy_run', 8.5, 'manual')`,
    [who, rows[0].id, date],
  );
};

before(async () => {
  t = await createTestDatabase();
  coach = await t.signUp('coach@ironmiles.ie', 'A Coach');
  runner = await t.signUp('runner@example.com', 'Ciara N.');
  friend = await t.signUp('friend@example.com', 'Dara O.');
  stranger = await t.signUp('stranger@example.com', 'Eoin C.');
  await t.setRole(coach, 'coach');
  await t.asService(`insert into coach_athlete_links (coach_id, athlete_id, status) values ($1, $2, 'active')`, [coach, runner]);

  const year = new Date().getUTCFullYear();
  sessions = await challenge('Three as written', 'sessions', 3, `${year}-01-01`, `${year}-12-31`);
  distance = await challenge('Twenty k', 'distance_km', 20, `${year}-01-01`, `${year}-12-31`);
  closed = await challenge('Last year', 'sessions', 1, `${year - 2}-01-01`, `${year - 2}-01-31`);

  for (const d of ['-01-05', '-01-06', '-01-07']) await doneSession(runner, `${year}${d}`);
  await doneSession(runner, `${year}-01-08`, 'rest'); // a rest day is not a session
  await doneSession(friend, `${year}-01-05`);
});

after(async () => t?.close());

describe('setting challenges', () => {
  it('only staff set them', async () => {
    assert.match(
      (await t.expectRefused(runner, `insert into challenges (name, metric, target, starts_on, ends_on, created_by) values ('Mine', 'sessions', 1, current_date, current_date, $1)`, [runner])) ?? '',
      /row-level security/,
    );
  });

  it('a window must end after it starts, and within a year', async () => {
    // created_by set, so the policy passes and only the window can refuse
    const insert = `insert into challenges (name, metric, target, starts_on, ends_on, created_by) values ($1, 'sessions', 1, $2, $3, $4)`;
    for (const [name, from, to] of [['Back', '2026-02-01', '2026-01-01'], ['Long', '2026-01-01', '2028-01-01']]) {
      assert.match((await t.expectRefused(coach, insert, [name, from, to, coach])) ?? '', /check constraint/, name);
    }
    await t.asUser(coach, insert, ['A month', '2026-01-01', '2026-01-31', coach]);
  });
});

describe('joining', () => {
  it('an athlete joins for themselves, not for anyone else', async () => {
    await t.asUser(runner, 'insert into challenge_participants (challenge_id, athlete_id) values ($1, $2)', [sessions, runner]);
    await t.asUser(friend, 'insert into challenge_participants (challenge_id, athlete_id) values ($1, $2)', [sessions, friend]);
    await t.asUser(runner, 'insert into challenge_participants (challenge_id, athlete_id) values ($1, $2)', [distance, runner]);
    assert.ok(await t.expectRefused(stranger, 'insert into challenge_participants (challenge_id, athlete_id) values ($1, $2)', [sessions, friend]));
  });

  it('not once it has closed', async () => {
    assert.ok(await t.expectRefused(stranger, 'insert into challenge_participants (challenge_id, athlete_id) values ($1, $2)', [closed, stranger]));
  });
});

describe('nobody reads anyone else’s numbers by editing a challenge', () => {
  it('another coach cannot edit a challenge they did not set', async () => {
    const other = await t.signUp('other.coach@ironmiles.ie', 'Other Coach');
    await t.setRole(other, 'coach');
    await t.asUser(other, `update challenges set target = 1 where id = $1`, [sessions]);
    assert.equal(Number((await t.asService('select target from challenges where id = $1', [sessions])).rows[0].target), 3);
    assert.ok(await t.expectRefused(other, `insert into challenges (name, metric, target, starts_on, ends_on, created_by) values ('As you', 'sessions', 1, current_date, current_date, $1)`, [coach]),
      'nor set one in someone else’s name');
  });

  it('once people have joined, even its creator cannot change what it measures', async () => {
    for (const change of [`target = 1`, `metric = 'distance_km'`, `starts_on = starts_on - 1`, `ends_on = ends_on - 1`]) {
      const refused = await t.expectRefused(coach, `update challenges set ${change} where id = $1`, [sessions]);
      assert.match(refused ?? '', /fixed/, change);
    }
  });

  it('but can still retire or rename it', async () => {
    await t.asUser(coach, `update challenges set name = 'Three, as written', archived = false where id = $1`, [sessions]);
    assert.equal((await t.asService('select name from challenges where id = $1', [sessions])).rows[0].name, 'Three, as written');
  });

  it('a challenge nobody has joined can still be corrected', async () => {
    const fresh = await challenge('Draft', 'sessions', 5, `${new Date().getUTCFullYear()}-01-01`, `${new Date().getUTCFullYear()}-12-31`);
    await t.asUser(coach, `update challenges set target = 6 where id = $1`, [fresh]);
    assert.equal(Number((await t.asService('select target from challenges where id = $1', [fresh])).rows[0].target), 6);
  });
});

describe('progress and privacy', () => {
  it('counts prescribed sessions completed, not rest days', async () => {
    const { rows } = await t.asUser(runner, 'select im_challenge_progress($1, $2) as p', [sessions, runner]);
    assert.equal(Number(rows[0].p), 3);
  });

  it('sums kilometres logged — on any day, a rest day included: the distance happened', async () => {
    const { rows } = await t.asUser(runner, 'select im_challenge_progress($1, $2) as p', [distance, runner]);
    assert.equal(Number(rows[0].p), 34); // four logs of 8.5 km
  });

  it('the coach can read their athlete’s progress; another member cannot read anyone’s', async () => {
    assert.equal(Number((await t.asUser(coach, 'select im_challenge_progress($1, $2) as p', [sessions, runner])).rows[0].p), 3);
    assert.equal((await t.asUser(stranger, 'select im_challenge_progress($1, $2) as p', [distance, runner])).rows[0].p, null);
  });

  it('the club sees who joined and who finished — never the numbers', async () => {
    const { rows } = await t.asUser(stranger, 'select * from im_challenge_summary($1)', [sessions]);
    assert.equal(rows[0].participants, 2);
    assert.deepEqual(rows[0].finishers, ['Ciara N.']);
    assert.equal(rows[0].viewer_joined, false);
    assert.equal(rows[0].viewer_progress, null, 'a non-participant has no progress, and sees nobody’s');
  });

  it('a participant sees their own number, which agrees with im_challenge_progress', async () => {
    const summary = (await t.asUser(friend, 'select * from im_challenge_summary($1)', [sessions])).rows[0];
    const direct = (await t.asUser(friend, 'select im_challenge_progress($1, $2) as p', [sessions, friend])).rows[0].p;
    assert.equal(summary.viewer_joined, true);
    assert.equal(Number(summary.viewer_progress), Number(direct));
    assert.equal(Number(direct), 1);
  });

  it('leaving takes you out of the count', async () => {
    await t.asUser(friend, 'delete from challenge_participants where challenge_id = $1 and athlete_id = $2', [sessions, friend]);
    assert.equal((await t.asUser(stranger, 'select participants from im_challenge_summary($1)', [sessions])).rows[0].participants, 1);
  });

  it('nobody signed out sees a summary', async () => {
    await t.db.exec('set role authenticated;');
    await t.db.query(`select set_config('request.jwt.claim.sub', '', false)`);
    await t.db.query(`select set_config('request.jwt.claims', '{"role":"anon"}', false)`);
    const { rows } = await t.db.query('select * from im_challenge_summary($1)', [sessions]);
    await t.db.exec('reset role;');
    assert.equal(rows.length, 0);
  });
});
