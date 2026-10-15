import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/**
 * The club feed under the real policies.
 *
 * Sharing a run with the club is consent to show the run — not the heart
 * rate behind it, not the plan it was matched to, and not the profile of the
 * person who ran it. Each of those limits is executed here.
 */

let t;
let coach, runner, friend, stranger;
let shared, unshared;

const activity = async (athleteId, visibility, fp) => {
  const { rows } = await t.asService(
    `insert into activities (athlete_id, format, fingerprint, name, sport, started_at, local_date,
                             distance_m, moving_s, elapsed_s, avg_hr, max_hr, hr_histogram, visibility, route)
     values ($1, 'fit', $2, 'Canal loop', 'run', now(), current_date, 10000, 3000, 3100, 152, 178,
             '[[150, 3000]]'::jsonb, $3, 'abc')
     returning id`,
    [athleteId, fp.repeat(64), visibility],
  );
  return rows[0].id;
};

before(async () => {
  t = await createTestDatabase();
  coach = await t.signUp('coach@ironmiles.ie', 'A Coach');
  runner = await t.signUp('runner@example.com', 'Ciara N.');
  friend = await t.signUp('friend@example.com', 'Dara O.');
  stranger = await t.signUp('stranger@example.com', 'Sinead M.');
  await t.setRole(coach, 'coach');
  await t.asService(`insert into coach_athlete_links (coach_id, athlete_id, status) values ($1, $2, 'active')`, [coach, runner]);
  await t.asService(`update profiles set injury_notes = 'Left Achilles', date_of_birth = '1992-03-04' where id = $1`, [runner]);
  shared = await activity(runner, 'club', 'a');
  unshared = await activity(runner, 'coach', 'b');
});

after(async () => t?.close());

describe('the feed shows the run and not the person', () => {
  it('a member sees a shared activity', async () => {
    const { rows } = await t.asUser(friend, 'select * from im_club_feed()');
    assert.deepEqual(rows.map((r) => r.id), [shared]);
    assert.equal(rows[0].athlete_name, 'Ciara N.');
    assert.equal(rows[0].distance_m, 10000);
  });

  it('never heart rate, never the plan, never the profile', async () => {
    const { rows } = await t.asUser(friend, 'select * from im_club_feed()');
    const cols = Object.keys(rows[0]);
    for (const leak of ['avg_hr', 'max_hr', 'hr_histogram', 'series', 'splits', 'scheduled_workout_id', 'email', 'injury_notes', 'date_of_birth']) {
      assert.ok(!cols.includes(leak), `${leak} must not be in the feed`);
    }
  });

  it('a shared activity is still not readable as a row', async () => {
    const { rows } = await t.asUser(friend, 'select avg_hr from activities where id = $1', [shared]);
    assert.equal(rows.length, 0);
  });

  it('nor is the runner’s profile', async () => {
    const { rows } = await t.asUser(friend, 'select injury_notes from profiles where id = $1', [runner]);
    assert.equal(rows.length, 0);
  });

  it('a single item: a member gets a shared one, not an unshared one', async () => {
    assert.equal((await t.asUser(friend, 'select id from im_feed_item($1)', [shared])).rows.length, 1);
    assert.equal((await t.asUser(friend, 'select id from im_feed_item($1)', [unshared])).rows.length, 0);
    assert.equal((await t.asUser(runner, 'select id from im_feed_item($1)', [unshared])).rows.length, 1, 'your own, shared or not');
    assert.equal((await t.asUser(coach, 'select id from im_feed_item($1)', [unshared])).rows.length, 1, 'your athlete’s');
  });

  it('an unshared activity is not in the feed', async () => {
    const { rows } = await t.asUser(friend, 'select id from im_club_feed() where id = $1', [unshared]);
    assert.equal(rows.length, 0);
  });

  it('the coach still reads everything, shared or not', async () => {
    const { rows } = await t.asUser(coach, 'select avg_hr from activities where athlete_id = $1', [runner]);
    assert.equal(rows.length, 2);
  });
});

describe('kudos', () => {
  it('a member gives kudos on a shared run', async () => {
    await t.asUser(friend, 'insert into activity_kudos (activity_id, athlete_id) values ($1, $2)', [shared, friend]);
    const { rows } = await t.asUser(friend, 'select kudos_count, viewer_kudos from im_club_feed()');
    assert.equal(rows[0].kudos_count, 1);
    assert.equal(rows[0].viewer_kudos, true);
  });

  it('twice is still once', async () => {
    const dup = await t.expectRefused(friend, 'insert into activity_kudos (activity_id, athlete_id) values ($1, $2)', [shared, friend]);
    assert.ok(dup);
  });

  it('not on an unshared run', async () => {
    const refused = await t.expectRefused(stranger, 'insert into activity_kudos (activity_id, athlete_id) values ($1, $2)', [unshared, stranger]);
    assert.ok(refused);
  });

  it('not on your own run', async () => {
    const refused = await t.expectRefused(runner, 'insert into activity_kudos (activity_id, athlete_id) values ($1, $2)', [shared, runner]);
    assert.ok(refused);
  });

  it('not in somebody else’s name', async () => {
    const refused = await t.expectRefused(stranger, 'insert into activity_kudos (activity_id, athlete_id) values ($1, $2)', [shared, friend]);
    assert.ok(refused);
  });

  it('taken back by the giver only', async () => {
    await t.asUser(stranger, 'delete from activity_kudos where activity_id = $1', [shared]);
    const still = await t.asService('select count(*)::int as n from activity_kudos where activity_id = $1', [shared]);
    assert.equal(still.rows[0].n, 1);
    await t.asUser(friend, 'delete from activity_kudos where activity_id = $1 and athlete_id = $2', [shared, friend]);
    const gone = await t.asService('select count(*)::int as n from activity_kudos where activity_id = $1', [shared]);
    assert.equal(gone.rows[0].n, 0);
  });
});

describe('comments', () => {
  it('a member comments on a shared run, and everyone who can see it reads it with a name', async () => {
    await t.asUser(friend, `insert into activity_comments (activity_id, author_id, body) values ($1, $2, 'Flying!')`, [shared, friend]);
    for (const viewer of [stranger, runner, coach]) {
      const { rows } = await t.asUser(viewer, `select * from im_activity_social($1) where kind = 'comment'`, [shared]);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].person_name, 'Dara O.');
      assert.equal(rows[0].body, 'Flying!');
    }
  });

  it('a member cannot comment on an unshared run, or read one', async () => {
    const refused = await t.expectRefused(stranger, `insert into activity_comments (activity_id, author_id, body) values ($1, $2, 'hi')`, [unshared, stranger]);
    assert.ok(refused);
    const { rows } = await t.asUser(stranger, 'select * from im_activity_social($1)', [unshared]);
    assert.equal(rows.length, 0);
  });

  it('the coach may comment on their athlete’s unshared run', async () => {
    await t.asUser(coach, `insert into activity_comments (activity_id, author_id, body) values ($1, $2, 'Good control.')`, [unshared, coach]);
    const { rows } = await t.asUser(runner, `select * from im_activity_social($1) where kind = 'comment'`, [unshared]);
    assert.equal(rows[0].body, 'Good control.');
  });

  it('an empty or overlong comment is refused', async () => {
    for (const body of ['   ', 'x'.repeat(501)]) {
      const refused = await t.expectRefused(friend, 'insert into activity_comments (activity_id, author_id, body) values ($1, $2, $3)', [shared, friend, body]);
      assert.ok(refused, `refused: ${body.length} chars`);
    }
  });

  it('a stranger cannot delete a comment; the runner can, on their own run', async () => {
    await t.asUser(stranger, 'delete from activity_comments where activity_id = $1', [shared]);
    let n = await t.asService('select count(*)::int as n from activity_comments where activity_id = $1', [shared]);
    assert.equal(n.rows[0].n, 1);
    await t.asUser(runner, 'delete from activity_comments where activity_id = $1', [shared]);
    n = await t.asService('select count(*)::int as n from activity_comments where activity_id = $1', [shared]);
    assert.equal(n.rows[0].n, 0);
  });

  it('un-sharing hides the conversation from the club', async () => {
    await t.asUser(friend, `insert into activity_comments (activity_id, author_id, body) values ($1, $2, 'Again!')`, [shared, friend]);
    await t.asUser(runner, `update activities set visibility = 'coach' where id = $1`, [shared]);
    const { rows } = await t.asUser(stranger, 'select * from im_activity_social($1)', [shared]);
    assert.equal(rows.length, 0);
    await t.asUser(runner, `update activities set visibility = 'club' where id = $1`, [shared]);
  });

  it('the GDPR export includes comments and kudos you gave', async () => {
    const { rows } = await t.asUser(friend, 'select im_export_athlete_data($1) as d', [friend]);
    assert.ok(rows[0].d.activity_comments.length >= 1);
    assert.ok(Array.isArray(rows[0].d.activity_kudos));
  });
});

describe('signed out', () => {
  it('sees no feed', async () => {
    await t.db.exec('set role authenticated;');
    await t.db.query(`select set_config('request.jwt.claim.sub', '', false)`);
    await t.db.query(`select set_config('request.jwt.claims', '{"role":"anon"}', false)`);
    const { rows } = await t.db.query('select * from im_club_feed()');
    await t.db.exec('reset role;');
    assert.equal(rows.length, 0);
  });
});

describe('the feed cannot be pinned', () => {
  it('a shared run dated years ahead does not sit at the top of the feed', async () => {
    const { rows } = await t.asService(`select id from activities where id = $1`, [shared]);
    const future = await activity(runner, 'club', 'f');
    await t.asService(`update activities set started_at = now() + interval '3 years', local_date = current_date + 1095 where id = $1`, [future]);
    const feed = (await t.asUser(friend, 'select id from im_club_feed()')).rows.map((r) => r.id);
    assert.ok(!feed.includes(future));
    assert.ok(feed.includes(rows[0].id));
    await t.asService('delete from activities where id = $1', [future]);
  });
});
