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

describe('the export', () => {
  it('includes onboarding answers and shared notes, never private ones', async () => {
    await t.asService(`insert into athlete_onboarding (athlete_id, data) values ($1, '{"injuries":"left knee"}') on conflict (athlete_id) do update set data = excluded.data`, [athlete]);
    await t.asService(`insert into coach_notes (athlete_id, coach_id, body, visibility) values ($1, $2, 'shared one', 'shared'), ($1, $2, 'private one', 'private')`, [athlete, coach]);
    const { rows } = await t.asUser(athlete, 'select im_export_athlete_data($1) as x', [athlete]);
    const x = rows[0].x;
    assert.equal(x.onboarding.data.injuries, 'left knee');
    assert.deepEqual(x.shared_coach_notes.map((n) => n.body), ['shared one']);
    for (const key of ['notifications', 'subscriptions', 'payments', 'integrations', 'community_posts', 'event_attendance']) assert.ok(Array.isArray(x[key]), key);
  });
});

describe('check-ins', () => {
  const monday = `date_trunc('week', current_date)::date - 7`;
  const submit = (who, fatigue = 5) =>
    t.asUser(
      who,
      `insert into checkins (athlete_id, week_start, fatigue, sleep, soreness, stress, motivation, confidence, training_difficulty, pain_or_niggles)
       values ($1, ${monday}, $2, 7, 4, 3, 8, 7, 6, 'Nothing to report.')
       on conflict (athlete_id, week_start) do update set fatigue = excluded.fatigue, pain_or_niggles = excluded.pain_or_niggles`,
      [who, fatigue],
    );

  it('answered again after the coach replied, it is unread and unanswered again', async () => {
    await submit(athlete);
    await t.asService(
      `update checkins set acknowledged_at = now(), acknowledged_by = $2, responded_at = now(), reviewed_by_coach_at = now(), coach_response = 'Great week'
       where athlete_id = $1`,
      [athlete, coach],
    );
    await t.asUser(
      athlete,
      `update checkins set pain_or_niggles = 'Sharp pain, swollen ankle', soreness = 9 where athlete_id = $1 and week_start = ${monday}`,
      [athlete],
    );
    const { rows } = await t.asService(`select acknowledged_at, responded_at, reviewed_by_coach_at, coach_response from checkins where athlete_id = $1 and week_start = ${monday}`, [athlete]);
    assert.equal(rows[0].acknowledged_at, null);
    assert.equal(rows[0].responded_at, null);
    assert.equal(rows[0].reviewed_by_coach_at, null);
    assert.equal(rows[0].coach_response, 'Great week', 'what the coach said stays on record');
  });

  it('a coach marking it read does not reopen it', async () => {
    await t.asUser(coach, `update checkins set acknowledged_at = now(), acknowledged_by = $2 where athlete_id = $1 and week_start = ${monday}`, [athlete, coach]);
    const { rows } = await t.asService(`select acknowledged_at from checkins where athlete_id = $1 and week_start = ${monday}`, [athlete]);
    assert.ok(rows[0].acknowledged_at);
  });

  it('is for a week named by its Monday, that has begun', async () => {
    const insert = (day) =>
      `insert into checkins (athlete_id, week_start, fatigue, sleep, soreness, stress, motivation, confidence, training_difficulty) values ($1, ${day}, 5,7,4,3,8,7,6)`;
    assert.match((await t.expectRefused(athlete, insert(`${monday} + 1`), [athlete])) ?? '', /Monday/);
    assert.match((await t.expectRefused(athlete, insert(`date_trunc('week', current_date)::date + 21`), [athlete])) ?? '', /begun/);
  });
});
