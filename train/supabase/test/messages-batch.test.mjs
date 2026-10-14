/**
 * THE BATCH THREAD READ, UNDER ROW-LEVEL SECURITY.
 *
 * The coach's messages screen used to call listMessages per athlete — two
 * round trips each, eighty-one queries to draw forty conversations. The batch
 * replaces that with the two queries this file executes directly:
 *
 *   select id, athlete_id from message_threads where athlete_id in (…)
 *   select *              from messages        where thread_id  in (…) order by created_at
 *
 * Running them as a signed-in coach is the point. An `in (…)` list is caller
 * input, and the whole safety of the change rests on RLS still deciding what
 * comes back when that list contains an athlete the coach does not coach —
 * which is exactly how a batch optimisation turns into a data leak.
 */
import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

let t, coachA, coachB, mine = {}, theirs;
const ago = (h) => new Date(Date.now() - h * 3600_000).toISOString();

const thread = (athlete, coach) => t.asService(
  `insert into message_threads (athlete_id, coach_id) values ($1,$2)
   on conflict (athlete_id, coach_id) do update set updated_at = now() returning id`,
  [athlete, coach]);

const say = async (athlete, coach, from, body, at) => {
  const { rows: [th] } = await thread(athlete, coach);
  const to = from === athlete ? coach : athlete;
  await t.asService(
    `insert into messages (thread_id, sender_id, recipient_id, body, created_at)
     values ($1,$2,$3,$4,$5)`, [th.id, from, to, body, at]);
};

/** Exactly the two queries the Supabase adapter issues, as that coach. */
const batch = async (coach, athleteIds) => {
  const { rows: threads } = await t.asUser(coach,
    `select id, athlete_id from message_threads where athlete_id = any($1::uuid[])`, [athleteIds]);
  if (!threads.length) return new Map();
  const { rows: msgs } = await t.asUser(coach,
    `select * from messages where thread_id = any($1::uuid[]) order by created_at`,
    [threads.map((r) => r.id)]);
  const athleteOf = new Map(threads.map((r) => [r.id, r.athlete_id]));
  const out = new Map();
  for (const m of msgs) {
    const a = athleteOf.get(m.thread_id);
    if (!a) continue;
    (out.get(a) ?? out.set(a, []).get(a)).push(m);
  }
  return out;
};

/** The per-athlete read it replaces, same caller. */
const single = async (coach, athlete) => {
  const { rows: [th] } = await t.asUser(coach,
    `select id from message_threads where athlete_id = $1 limit 1`, [athlete]);
  if (!th) return [];
  const { rows } = await t.asUser(coach,
    `select * from messages where thread_id = $1 order by created_at`, [th.id]);
  return rows;
};

before(async () => {
  t = await createTestDatabase();
  coachA = await t.signUp('mb.a@im.ie'); coachB = await t.signUp('mb.b@im.ie');
  await t.setRole(coachA, 'coach'); await t.setRole(coachB, 'coach');

  for (const key of ['quiet', 'chatty', 'answered']) {
    const id = await t.signUp(`mb.${key}@im.ie`);
    await t.asService(
      `insert into coach_athlete_links (coach_id,athlete_id,status) values ($1,$2,'active')`,
      [coachA, id]);
    mine[key] = id;
  }
  theirs = await t.signUp('mb.theirs@im.ie');
  await t.asService(
    `insert into coach_athlete_links (coach_id,athlete_id,status) values ($1,$2,'active')`,
    [coachB, theirs]);

  await say(mine.chatty, coachA, mine.chatty, 'Quick one', ago(8));
  await say(mine.chatty, coachA, mine.chatty, 'Actually two things', ago(7));
  await say(mine.chatty, coachA, mine.chatty, 'Sorry, three', ago(6));
  await say(mine.answered, coachA, mine.answered, 'Should I race Sunday?', ago(30));
  await say(mine.answered, coachA, coachA, 'Yes — treat it as a tempo.', ago(26));
  await say(theirs, coachB, theirs, 'This belongs to the other coach.', ago(5));
});

after(async () => { await t?.close(); });

describe('reading every thread at once', () => {
  it('returns the same messages, in the same order, as reading them one by one', async () => {
    const ids = Object.values(mine);
    const got = await batch(coachA, ids);
    for (const id of ids) {
      assert.deepEqual(
        (got.get(id) ?? []).map((m) => m.body),
        (await single(coachA, id)).map((m) => m.body),
        'the batch disagrees with the per-athlete read');
    }
  });

  it('keeps each thread chronological', async () => {
    const got = await batch(coachA, [mine.chatty]);
    assert.deepEqual(got.get(mine.chatty).map((m) => m.body),
      ['Quick one', 'Actually two things', 'Sorry, three']);
  });

  it('omits an athlete who has never written rather than inventing a thread', async () => {
    const got = await batch(coachA, [mine.quiet]);
    assert.equal(got.get(mine.quiet), undefined);
  });

  it('REFUSES another coach\'s athlete, even when asked for by id', async () => {
    // The attack the `in (…)` list invites: name somebody else's athlete and
    // see whether the widened query hands them over.
    const got = await batch(coachA, [mine.chatty, theirs]);
    assert.equal(got.get(theirs), undefined, 'leaked another coach\'s conversation');
    assert.ok(got.get(mine.chatty)?.length, 'and lost its own in the process');
  });

  it('gives an athlete only their own thread, never the whole roster', async () => {
    const got = await batch(mine.chatty, [mine.chatty, mine.answered, theirs]);
    assert.equal(got.get(mine.answered), undefined);
    assert.equal(got.get(theirs), undefined);
  });

  it('hands an outsider nothing at all', async () => {
    const outsider = await t.signUp('mb.outsider@im.ie');
    const got = await batch(outsider, Object.values(mine));
    assert.equal(got.size, 0);
  });
});
