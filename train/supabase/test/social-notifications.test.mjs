import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/** Kudos and comment notifications, written by migration 0026's triggers. */

let t;
let runner, friend, other, quiet;
let run, quietRun;

const activity = async (who, fp) =>
  (
    await t.asService(
      `insert into activities (athlete_id, format, fingerprint, name, sport, started_at, local_date, distance_m, moving_s, elapsed_s, visibility)
       values ($1, 'fit', $2, 'Canal loop', 'run', now(), current_date, 10000, 3000, 3000, 'club') returning id`,
      [who, fp.repeat(64)],
    )
  ).rows[0].id;
const inbox = async (who) =>
  (await t.asUser(who, `select kind, title, body, href, read_at from notifications where user_id = $1 order by created_at`, [who])).rows;

before(async () => {
  t = await createTestDatabase();
  runner = await t.signUp('runner@example.com', 'Ciara N.');
  friend = await t.signUp('friend@example.com', 'Dara O.');
  other = await t.signUp('other@example.com', 'Eoin C.');
  quiet = await t.signUp('quiet@example.com', 'Quiet One');
  await t.asService('update profiles set notify_social = false where id = $1', [quiet]);
  run = await activity(runner, 'a');
  quietRun = await activity(quiet, 'b');
});

after(async () => t?.close());

describe('kudos notifications', () => {
  it('the first kudos names who gave it', async () => {
    await t.asUser(friend, 'insert into activity_kudos (activity_id, athlete_id) values ($1, $2)', [run, friend]);
    const rows = await inbox(runner);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].title, 'Dara O. gave kudos');
    assert.equal(rows[0].href, `/app/activities/${run}`);
  });

  it('more kudos fold into the same notification, unread again', async () => {
    await t.asUser(runner, 'update notifications set read_at = now() where user_id = $1', [runner]);
    await t.asUser(other, 'insert into activity_kudos (activity_id, athlete_id) values ($1, $2)', [run, other]);
    const rows = await inbox(runner);
    assert.equal(rows.length, 1, 'still one notification');
    assert.equal(rows[0].title, '2 kudos on Canal loop');
    assert.equal(rows[0].body, 'Latest from Eoin C.', 'one full stop, the name’s own');
    assert.equal(rows[0].read_at, null);
  });

  it('taking kudos back and giving it again does not make it unread again', async () => {
    await t.asUser(runner, `update notifications set read_at = now() where user_id = $1`, [runner]);
    await t.asUser(other, 'delete from activity_kudos where activity_id = $1 and athlete_id = $2', [run, other]);
    await t.asUser(other, 'insert into activity_kudos (activity_id, athlete_id) values ($1, $2)', [run, other]);
    const kudos = (await inbox(runner)).filter((n) => n.kind === 'kudos');
    assert.equal(kudos.length, 1);
    assert.ok(kudos[0].read_at, 'still read');
  });

  it('nobody else is told', async () => {
    assert.equal((await inbox(friend)).length, 0);
    assert.equal((await inbox(other)).length, 0);
  });
});

describe('comment notifications', () => {
  it('each comment is its own notification, with an excerpt', async () => {
    await t.asUser(friend, `insert into activity_comments (activity_id, author_id, body) values ($1, $2, 'Flying!')`, [run, friend]);
    await t.asUser(other, `insert into activity_comments (activity_id, author_id, body) values ($1, $2, $3)`, [run, other, 'x'.repeat(300)]);
    const comments = (await inbox(runner)).filter((r) => r.kind === 'comment');
    assert.deepEqual(comments.map((c) => c.title), ['Dara O. commented on Canal loop', 'Eoin C. commented on Canal loop']);
    assert.equal(comments[0].body, 'Flying!');
    assert.equal(comments[1].body.length, 100, 'a long comment is cut to an excerpt');
    assert.ok(comments[1].href.endsWith('#comments'));
  });

  it('replying on your own run tells nobody', async () => {
    const before = (await inbox(runner)).length;
    await t.asUser(runner, `insert into activity_comments (activity_id, author_id, body) values ($1, $2, 'Thanks!')`, [run, runner]);
    assert.equal((await inbox(runner)).length, before);
  });
});

describe('opting out, and who can write', () => {
  it('an athlete who turned them off is not told', async () => {
    await t.asUser(friend, 'insert into activity_kudos (activity_id, athlete_id) values ($1, $2)', [quietRun, friend]);
    await t.asUser(friend, `insert into activity_comments (activity_id, author_id, body) values ($1, $2, 'hi')`, [quietRun, friend]);
    assert.equal((await inbox(quiet)).length, 0);
  });

  it('a member cannot plant a notification in someone else’s inbox', async () => {
    const refused = await t.expectRefused(friend, `insert into notifications (user_id, kind, title) values ($1, 'kudos', 'fake')`, [runner]);
    assert.ok(refused);
  });

  it('nor run the triggers by hand', async () => {
    for (const fn of ['im_notify_on_kudos', 'im_notify_on_comment']) {
      assert.match((await t.expectRefused(friend, `select ${fn}()`)) ?? '', /trigger/);
    }
  });

  it('a social notification is never queued for email', async () => {
    const { rows } = await t.asService(
      `select count(*)::int as n from notification_deliveries d join notifications n on n.id = d.notification_id where n.kind in ('kudos','comment')`,
    );
    assert.equal(rows[0].n, 0);
  });
});
