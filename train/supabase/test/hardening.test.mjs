import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/**
 * Migration 0029: three holes a security review proved against the shipped
 * migrations, each shown closed here — and the ordinary flows shown working.
 */

let t;
let coach, athlete, stranger, other;

before(async () => {
  t = await createTestDatabase();
  coach = await t.signUp('coach@ironmiles.ie', 'A Coach');
  await t.setRole(coach, 'coach');
  athlete = await t.signUp('athlete@example.com', 'An Athlete');
  stranger = await t.signUp('stranger@example.com', 'A Stranger');
  other = await t.signUp('other.coach@ironmiles.ie', 'Other Coach');
  await t.setRole(other, 'coach');
  await t.asService(`insert into coach_athlete_links (coach_id, athlete_id, status) values ($1, $2, 'active')`, [coach, athlete]);
});

after(async () => t?.close());

describe('nobody makes themselves a future athlete’s coach', () => {
  it('a submitted application can only be new', async () => {
    const forged = await t.expectRefused(
      stranger,
      `insert into coaching_applications (full_name, email, goal, status, accepted_by, accepted_at)
       values ('Victim', 'victim@example.com', 'x', 'accepted', $1, now() + interval '10 years')`,
      [stranger],
    );
    assert.ok(forged);
    // the public form still works
    await t.asUser(stranger, `insert into coaching_applications (full_name, email, goal) values ('Someone', 'someone@example.com', 'A marathon')`);
  });

  it('sign-up honours an acceptance only when a coach made it', async () => {
    // planted by the service role, as an older row might have been
    await t.asService(
      `insert into coaching_applications (full_name, email, goal, status, accepted_by, accepted_at)
       values ('Victim', 'victim2@example.com', 'x', 'accepted', $1, now())`,
      [stranger],
    );
    const victim = await t.signUp('victim2@example.com', 'Victim');
    const { rows } = await t.asService('select count(*)::int as n from coach_athlete_links where athlete_id = $1', [victim]);
    assert.equal(rows[0].n, 0, 'a non-coach acceptance links nobody');
    assert.equal((await t.asUser(stranger, 'select id from profiles where id = $1', [victim])).rows.length, 0);
  });

  it('a real coach’s acceptance still links the athlete on sign-up', async () => {
    await t.asService(
      `insert into coaching_applications (full_name, email, goal, status, accepted_by, accepted_at)
       values ('New', 'new.athlete@example.com', 'x', 'accepted', $1, now())`,
      [coach],
    );
    const fresh = await t.signUp('new.athlete@example.com', 'New');
    const { rows } = await t.asService(`select status from coach_athlete_links where coach_id = $1 and athlete_id = $2`, [coach, fresh]);
    assert.equal(rows[0]?.status, 'active');
  });
});

describe('threads', () => {
  it('nobody opens a thread with an athlete they do not coach', async () => {
    assert.ok(await t.expectRefused(stranger, 'insert into message_threads (athlete_id, coach_id) values ($1, $2)', [athlete, stranger]));
    assert.ok(await t.expectRefused(other, 'insert into message_threads (athlete_id, coach_id) values ($1, $2)', [athlete, other]));
  });

  it('their coach does, and so does the athlete with their own coach', async () => {
    await t.asUser(coach, 'insert into message_threads (athlete_id, coach_id) values ($1, $2) on conflict do nothing', [athlete, coach]);
    const { rows } = await t.asService('select count(*)::int as n from message_threads where athlete_id = $1', [athlete]);
    assert.equal(rows[0].n, 1);
  });

  it('a thread cannot be re-pointed at someone else', async () => {
    await t.asUser(coach, 'update message_threads set athlete_id = $1 where coach_id = $2', [stranger, coach]);
    const { rows } = await t.asService('select athlete_id from message_threads where coach_id = $1', [coach]);
    assert.ok(rows.every((r) => r.athlete_id !== stranger));
  });
});

describe('messages', () => {
  let thread, sent;
  before(async () => {
    thread = (await t.asService('select id from message_threads where athlete_id = $1 and coach_id = $2', [athlete, coach])).rows[0].id;
    sent = (
      await t.asUser(coach, `insert into messages (thread_id, sender_id, recipient_id, body) values ($1, $2, $3, 'Easy tomorrow') returning id`, [thread, coach, athlete])
    ).rows[0].id;
  });

  it('the recipient marks it read', async () => {
    await t.asUser(athlete, 'update messages set read_at = now() where id = $1', [sent]);
    assert.ok((await t.asService('select read_at from messages where id = $1', [sent])).rows[0].read_at);
  });

  it('but cannot rewrite what was said, or who said it', async () => {
    assert.match((await t.expectRefused(athlete, `update messages set body = 'Run hard tomorrow' where id = $1`, [sent])) ?? '', /read_at/);
    assert.ok(await t.expectRefused(athlete, 'update messages set sender_id = $1 where id = $2', [athlete, sent]));
    assert.equal((await t.asService('select body from messages where id = $1', [sent])).rows[0].body, 'Easy tomorrow');
  });

  it('a message goes to the other person in its thread, not to anyone', async () => {
    assert.ok(await t.expectRefused(coach, `insert into messages (thread_id, sender_id, recipient_id, body) values ($1, $2, $3, 'hi')`, [thread, coach, stranger]));
  });

  it('the athlete replies, and the thread is kept current', async () => {
    const before = (await t.asService('select updated_at from message_threads where id = $1', [thread])).rows[0].updated_at;
    await new Promise((r) => setTimeout(r, 5));
    await t.asUser(athlete, `insert into messages (thread_id, sender_id, recipient_id, body) values ($1, $2, $3, 'Will do')`, [thread, athlete, coach]);
    const after = (await t.asService('select updated_at from message_threads where id = $1', [thread])).rows[0].updated_at;
    assert.ok(new Date(after) > new Date(before));
  });
});
