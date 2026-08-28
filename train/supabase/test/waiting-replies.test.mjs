import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';
import { rosterFromRows } from '../../src/lib/data/roster-row.ts';
import { applyFilter, concernsFor, rosterWorkload } from '../../src/lib/domain/roster.ts';

/**
 * WHO IS WAITING ON WHOM.
 *
 * The roster's only communication signal counted messages with a null
 * `read_at`. Nothing on the coach's side has ever written `read_at`, so it
 * counted every message the athlete had ever sent and never cleared — not
 * even when the coach answered. Waiting is now derived from the conversation
 * itself, in SQL, inside the one roster query.
 *
 * These tests are against real Postgres because that derivation is the whole
 * slice: if it disagrees with the TypeScript the demo adapter runs, or leaks
 * a row across coaches, everything above it is wrong.
 */

let t, coachA, coachB, ath = {}, theirs;
const iso = (d) => d.toISOString().slice(0, 10);
const today = iso(new Date());
const ago = (hours) => new Date(Date.now() - hours * 3600_000).toISOString();

const thread = (athlete, coach) => t.asService(
  `insert into message_threads (athlete_id, coach_id) values ($1,$2)
   on conflict (athlete_id, coach_id) do update set updated_at = now()
   returning id`, [athlete, coach]);

const say = async (athlete, coach, from, body, at, kind = 'human') => {
  const { rows: [th] } = await thread(athlete, coach);
  const to = from === athlete ? coach : athlete;
  return t.asService(
    `insert into messages (thread_id, sender_id, recipient_id, body, author_kind, created_at)
     values ($1,$2,$3,$4,$5::im_author_kind,$6) returning id`,
    [th.id, from, to, body, kind, at]);
};

const rosterFor = async (coach) => {
  const { rows } = await t.asUser(coach, `select * from im_coach_roster()`);
  return rosterFromRows(rows, today);
};
const one = async (coach, athlete) =>
  (await rosterFor(coach)).find((e) => e.athleteId === athlete);

before(async () => {
  t = await createTestDatabase();
  coachA = await t.signUp('wr.a@im.ie'); coachB = await t.signUp('wr.b@im.ie');
  await t.setRole(coachA, 'coach'); await t.setRole(coachB, 'coach');

  for (const key of ['quiet', 'fresh', 'old', 'answered', 'read', 'chatty', 'sore']) {
    const id = await t.signUp(`wr.${key}@im.ie`);
    await t.asService(`update profiles set full_name=$2 where id=$1`, [id, key]);
    await t.asService(
      `insert into coach_athlete_links (coach_id,athlete_id,status) values ($1,$2,'active')`,
      [coachA, id]);
    ath[key] = id;
  }
  theirs = await t.signUp('wr.theirs@im.ie');
  await t.asService(`update profiles set full_name='Not Yours' where id=$1`, [theirs]);
  await t.asService(
    `insert into coach_athlete_links (coach_id,athlete_id,status) values ($1,$2,'active')`,
    [coachB, theirs]);

  // quiet   — never wrote
  // fresh   — wrote 2h ago
  await say(ath.fresh, coachA, ath.fresh, 'Can I move Thursday to Friday?', ago(2));
  // old     — wrote 3 days ago
  await say(ath.old, coachA, ath.old, 'Still getting the calf pain on hills.', ago(72));
  // answered — wrote, and the coach replied after
  await say(ath.answered, coachA, ath.answered, 'Should I race Sunday?', ago(30));
  await say(ath.answered, coachA, coachA, 'Yes — treat it as a tempo.', ago(26));
  // read    — wrote, coach read it, coach did NOT reply
  await say(ath.read, coachA, ath.read, 'My shoes are worn through.', ago(20));
  await t.asService(`update messages set read_at = now() where sender_id = $1`, [ath.read]);
  // chatty  — three messages in a row, unanswered, oldest 8h ago
  await say(ath.chatty, coachA, ath.chatty, 'Quick one', ago(8));
  await say(ath.chatty, coachA, ath.chatty, 'Actually two things', ago(7));
  await say(ath.chatty, coachA, ath.chatty, 'Sorry, three', ago(6));
  // sore    — waiting AND a flagged check-in
  await say(ath.sore, coachA, ath.sore, 'Achilles is worse today.', ago(5));
  await t.asService(
    `insert into checkins (athlete_id, week_start, fatigue, sleep, soreness, stress,
                           motivation, confidence, training_difficulty,
                           pain_or_niggles, attention_level, attention_reasons)
     values ($1,$2,9,3,9,4,7,7,6,'Achilles.','attention','{"Soreness reported at 8 or above"}')`,
    [ath.sore, today]);
  // another coach's athlete is waiting too, loudly
  await say(theirs, coachB, theirs, 'Anyone there?', ago(48));
});

after(() => t.close());

describe('the derivation matches the definition', () => {
  it('raises nothing for an athlete who never wrote', async () => {
    assert.equal((await one(coachA, ath.quiet)).conversation, null);
  });

  it('raises it for an athlete who spoke last', async () => {
    const e = await one(coachA, ath.fresh);
    assert.ok(e.conversation, 'fresh is waiting');
    assert.equal(e.conversation.unanswered, 1);
    assert.match(e.conversation.latest, /move Thursday/);
  });

  it('clears it once the coach has answered', async () => {
    assert.equal((await one(coachA, ath.answered)).conversation, null,
      'the coach replied after they wrote; nobody is waiting');
  });

  it('keeps it when the coach has READ but not replied', async () => {
    // Slice 10's rule, applied to the other channel: reading is not answering
    const e = await one(coachA, ath.read);
    assert.ok(e.conversation, 'read is not replied');
    assert.equal(e.unreadFromAthlete, 0, 'and the message really is marked read');
  });

  it('treats a run of messages as one conversation, dated from the first', async () => {
    const e = await one(coachA, ath.chatty);
    assert.equal(e.conversation.unanswered, 3, 'three messages');
    const hours = (Date.now() - Date.parse(e.conversation.waitingSince)) / 3600_000;
    assert.ok(hours > 7.5 && hours < 8.5, `waiting ~8h, got ${hours.toFixed(1)}`);
    assert.equal(e.signals.filter((s) => s.kind === 'awaiting_reply').length, 1,
      'one workload item, not three');
  });

  it('ignores a FORGE message on both sides', async () => {
    // an automated note is not the coach answering, and FORGE never writes as
    // the athlete
    await say(ath.fresh, coachA, coachA, 'FORGE: nudge', ago(1), 'forge');
    const e = await one(coachA, ath.fresh);
    assert.ok(e.conversation, 'a FORGE message did not answer them');
    assert.equal(e.conversation.unanswered, 1, 'and did not count as them asking again');
  });
});

describe('a waiting reply is a concern like any other', () => {
  it('appears in the band and the filter, truthfully', async () => {
    const roster = await rosterFor(coachA);
    const waiting = applyFilter(roster, 'waiting');
    assert.ok(waiting.length >= 3, `${waiting.length} waiting`);

    const row = rosterWorkload(roster, { threshold: 1 }).find((r) => r.kind === 'waiting');
    assert.equal(row.count, waiting.length, 'the band and the filter agree');
    assert.ok(!row.athleteIds.includes(ath.answered));
    assert.ok(!row.athleteIds.includes(ath.quiet));
  });

  it('an athlete waiting AND flagged is counted in both', async () => {
    const e = await one(coachA, ath.sore);
    const concerns = concernsFor(e);
    assert.ok(concerns.includes('waiting'));
    assert.ok(concerns.includes('pain'));
    assert.equal(e.topSignal.kind, 'soreness_reported',
      'their body still leads; the wait is right underneath');
  });
});

describe('another coach cannot be waited on by proxy', () => {
  it('never puts their athlete in this coach\'s waiting list', async () => {
    const roster = await rosterFor(coachA);
    assert.ok(!roster.some((e) => e.athleteId === theirs));
    for (const row of rosterWorkload(roster, { threshold: 1 })) {
      assert.ok(!row.athleteIds.includes(theirs), `${row.kind} leaked an athlete`);
    }
  });

  it('gives coach A nothing when they ask for coach B\'s roster by id', async () => {
    const { rows } = await t.asUser(coachA, `select * from im_coach_roster($1)`, [coachB]);
    assert.ok(!rows.some((r) => r.athlete_id === theirs),
      'the link table is the authority, never the argument');
    assert.ok(rows.every((r) => r.waiting_latest === null
      || !/Anyone there/.test(r.waiting_latest)), 'and their words do not leak either');
  });

  it('shows each coach only their own waiting count', async () => {
    const a = rosterWorkload(await rosterFor(coachA), { threshold: 1 })
      .find((r) => r.kind === 'waiting');
    const b = rosterWorkload(await rosterFor(coachB), { threshold: 1 })
      .find((r) => r.kind === 'waiting');
    assert.ok(a.count >= 3);
    assert.equal(b?.count ?? 0, 1, 'coach B has exactly their own one');
  });

  it('refuses a message written into another coach\'s thread', async () => {
    const { rows: [th] } = await thread(theirs, coachB);
    assert.ok(await t.expectRefused(coachA,
      `insert into messages (thread_id, sender_id, recipient_id, body)
       values ($1,$2,$3,'I am not your coach')`, [th.id, coachA, theirs]),
      'coach A is not in that thread');
  });

  it('refuses a message sent as somebody else', async () => {
    const { rows: [th] } = await thread(ath.fresh, coachA);
    assert.ok(await t.expectRefused(coachA,
      `insert into messages (thread_id, sender_id, recipient_id, body)
       values ($1,$2,$3,'words the athlete never wrote')`, [th.id, ath.fresh, coachA]),
      'you may only send as yourself');
  });

  it('hides another coach\'s thread entirely', async () => {
    const { rows } = await t.asUser(coachA,
      `select m.body from messages m
         join message_threads th on th.id = m.thread_id
        where th.athlete_id = $1`, [theirs]);
    assert.equal(rows.length, 0, 'not one row of it');
  });
});
