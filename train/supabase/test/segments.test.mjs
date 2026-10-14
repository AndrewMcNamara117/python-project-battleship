import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/**
 * Segments under the real policies. The two claims: nobody but the server
 * writes a time, and the club sees a time only from a run shared with it.
 */

let t;
let coach, runner, rival, member;
let segment, sharedRun, privateRun, rivalRun;

const run = async (athleteId, visibility, fp) => {
  const { rows } = await t.asService(
    `insert into activities (athlete_id, format, fingerprint, name, sport, started_at, local_date,
                             distance_m, moving_s, elapsed_s, visibility)
     values ($1, 'fit', $2, 'Canal', 'run', now(), current_date, 10000, 3000, 3000, $3) returning id`,
    [athleteId, fp.repeat(64), visibility],
  );
  return rows[0].id;
};
const effort = (activityId, athleteId, s) =>
  t.asService(
    `insert into segment_efforts (segment_id, activity_id, athlete_id, started_at, elapsed_s) values ($1, $2, $3, now(), $4)`,
    [segment, activityId, athleteId, s],
  );

before(async () => {
  t = await createTestDatabase();
  coach = await t.signUp('coach@ironmiles.ie', 'A Coach');
  runner = await t.signUp('runner@example.com', 'Ciara N.');
  rival = await t.signUp('rival@example.com', 'Dara O.');
  member = await t.signUp('member@example.com', 'Eoin C.');
  await t.setRole(coach, 'coach');
  await t.asService(`insert into coach_athlete_links (coach_id, athlete_id, status) values ($1, $2, 'active')`, [coach, runner]);

  const s = await t.asUser(coach, `insert into segments (name, route, distance_m, created_by) values ('Canal drag', '_p~iF~ps|U', 2000, $1) returning id`, [coach]);
  segment = s.rows[0].id;
  sharedRun = await run(runner, 'club', 'a');
  privateRun = await run(runner, 'coach', 'b');
  rivalRun = await run(rival, 'club', 'c');
  await effort(sharedRun, runner, 620);
  await effort(privateRun, runner, 590);
  await effort(rivalRun, rival, 600);
});

after(async () => t?.close());

describe('segments', () => {
  it('every member sees the segments', async () => {
    const { rows } = await t.asUser(member, 'select name from segments');
    assert.deepEqual(rows.map((r) => r.name), ['Canal drag']);
  });

  it('only staff draw them', async () => {
    const refused = await t.expectRefused(member, `insert into segments (name, route, distance_m) values ('Mine', 'x', 500)`);
    assert.ok(refused);
  });

  it('a segment too short or unnamed is refused', async () => {
    assert.ok(await t.expectRefused(coach, `insert into segments (name, route, distance_m) values ('Tiny', 'x', 50)`));
    assert.ok(await t.expectRefused(coach, `insert into segments (name, route, distance_m) values (' ', 'x', 500)`));
  });
});

describe('efforts', () => {
  it('nobody posts a time, not even for their own run', async () => {
    const refused = await t.expectRefused(
      runner,
      `insert into segment_efforts (segment_id, activity_id, athlete_id, started_at, elapsed_s) values ($1, $2, $3, now(), 1)`,
      [segment, sharedRun, runner],
    );
    assert.ok(refused, 'a client insert must be refused');
  });

  it('nor edits one', async () => {
    await t.asUser(runner, 'update segment_efforts set elapsed_s = 1 where athlete_id = $1', [runner]);
    const { rows } = await t.asService('select min(elapsed_s)::int as best from segment_efforts where athlete_id = $1', [runner]);
    assert.equal(rows[0].best, 590);
  });

  it('the athlete reads all their own efforts, private runs included', async () => {
    const { rows } = await t.asUser(runner, 'select elapsed_s from segment_efforts order by elapsed_s');
    assert.deepEqual(rows.map((r) => r.elapsed_s), [590, 620]);
  });

  it('their coach does too; another member reads none directly', async () => {
    assert.equal((await t.asUser(coach, 'select id from segment_efforts')).rows.length, 2);
    assert.equal((await t.asUser(member, 'select id from segment_efforts')).rows.length, 0);
  });

  it('the club board ranks best efforts from shared runs only', async () => {
    const { rows } = await t.asUser(member, 'select athlete_name, elapsed_s from im_segment_leaders($1)', [segment]);
    // the runner's 590 came from a private run, so their shared 620 is what the club sees
    assert.deepEqual(rows.map((r) => [r.athlete_name, r.elapsed_s]), [['Dara O.', 600], ['Ciara N.', 620]]);
  });

  it('un-sharing a run takes its time off the board', async () => {
    await t.asUser(rival, `update activities set visibility = 'coach' where id = $1`, [rivalRun]);
    const { rows } = await t.asUser(member, 'select athlete_name from im_segment_leaders($1)', [segment]);
    assert.deepEqual(rows.map((r) => r.athlete_name), ['Ciara N.']);
    await t.asUser(rival, `update activities set visibility = 'club' where id = $1`, [rivalRun]);
  });

  it('deleting the activity deletes its efforts', async () => {
    const extra = await run(rival, 'club', 'd');
    await effort(extra, rival, 400);
    await t.asUser(rival, 'delete from activities where id = $1', [extra]);
    const { rows } = await t.asService('select count(*)::int as n from segment_efforts where activity_id = $1', [extra]);
    assert.equal(rows[0].n, 0);
  });

  it('the GDPR export includes your efforts', async () => {
    const { rows } = await t.asUser(runner, 'select im_export_athlete_data($1) as d', [runner]);
    assert.equal(rows[0].d.segment_efforts.length, 2);
  });
});
