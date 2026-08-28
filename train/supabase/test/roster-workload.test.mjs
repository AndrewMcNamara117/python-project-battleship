import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';
import {
  applyFilter, attentionRoster, concernsFor, filterCounts, parseFilter, rosterWorkload,
} from '../../src/lib/domain/roster.ts';
import { rosterFromRows } from '../../src/lib/data/roster-row.ts';
import { BATCH_ACTION_LABEL } from '../../src/lib/domain/batch.ts';

/**
 * THE WORKLOAD BAND, AGAINST A REAL DATABASE.
 *
 * The band is arithmetic over whatever `im_coach_roster()` returns, which is
 * the point: it has no query of its own, so it cannot reach past the row
 * security that function already enforces. These tests prove that claim
 * rather than asserting it — two coaches, overlapping problems, and every
 * count checked against the rows Postgres actually handed back.
 */

let t, coachA, coachB, aths = {}, bAthlete, MON;

const iso = (d) => d.toISOString().slice(0, 10);
const thisMonday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return iso(d);
};

before(async () => {
  t = await createTestDatabase();
  MON = thisMonday();
  coachA = await t.signUp('wa@im.ie'); coachB = await t.signUp('wb@im.ie');
  await t.setRole(coachA, 'coach'); await t.setRole(coachB, 'coach');

  // four of coach A's athletes, each carrying a different overlap
  for (const [key, name] of [['sarah', 'Sarah'], ['tom', 'Tom'], ['mia', 'Mia'], ['joe', 'Joe']]) {
    const id = await t.signUp(`${key}@im.ie`);
    await t.asService(`update profiles set full_name=$2 where id=$1`, [id, name]);
    await t.asService(
      `insert into coach_athlete_links (coach_id,athlete_id,status) values ($1,$2,'active')`,
      [coachA, id]);
    aths[key] = id;
  }

  bAthlete = await t.signUp('theirs@im.ie');
  await t.asService(`update profiles set full_name='Not Yours' where id=$1`, [bAthlete]);
  await t.asService(
    `insert into coach_athlete_links (coach_id,athlete_id,status) values ($1,$2,'active')`,
    [coachB, bAthlete]);

  // every one of coach B's athletes carries every concern, so any leak is loud
  const sore = (athlete, week) => t.asService(
    `insert into checkins (athlete_id, week_start, fatigue, sleep, soreness, stress,
                           motivation, confidence, training_difficulty,
                           pain_or_niggles, attention_level, attention_reasons)
     values ($1,$2,9,3,9,9,2,2,8,'Achilles.','attention','{"Soreness reported at 8 or above"}')`,
    [athlete, week]);

  await sore(bAthlete, MON);
  await sore(aths.sarah, MON);   // pain + check-in
  await sore(aths.tom, MON);
  await sore(aths.mia, MON);
});

after(async () => t?.close());

/** The coach's own roster, built by the same mapper the product uses. */
const entriesFor = async (coach) => {
  const rows = (await t.asUser(coach, `select * from im_coach_roster()`)).rows;
  return rosterFromRows(rows, iso(new Date()));
};

describe('a group cannot count an athlete the coach cannot see', () => {
  it('builds every row from this coach\'s athletes and nobody else\'s', async () => {
    const mine = await entriesFor(coachA);
    const ids = new Set(mine.map((e) => e.athleteId));

    assert.ok(!ids.has(bAthlete), 'the roster query already excludes them');
    for (const row of rosterWorkload(mine)) {
      for (const id of row.athleteIds) {
        assert.ok(ids.has(id), `${row.kind} counted an athlete off this roster`);
      }
      assert.ok(!row.athleteIds.includes(bAthlete),
        `${row.kind} must never reach coach B's athlete`);
    }
  });

  it('gives each coach a band about their own squad only', async () => {
    const a = rosterWorkload(await entriesFor(coachA));
    const b = rosterWorkload(await entriesFor(coachB));

    const total = (rows) => rows.reduce((n, r) => n + r.count, 0);
    assert.ok(total(a) > 0, 'coach A has work to do');
    // coach B has one athlete, so nothing reaches the threshold — and in
    // particular coach A's three sore athletes are not in his band
    for (const row of b) {
      assert.ok(!row.athleteIds.some((id) => Object.values(aths).includes(id)));
    }
  });

  it('cannot be widened by asking for a filter by name', async () => {
    const mine = await entriesFor(coachA);
    // every filter, including a hand-crafted one, over the same fetched rows
    for (const raw of ['pain', 'checkins', 'all', 'attention', 'no_training',
                       '../admin', 'everyone', "'; select 1 --", undefined]) {
      const filter = parseFilter(raw);
      const shown = applyFilter(mine, filter);
      assert.ok(shown.length <= mine.length,
        'a filter selects among rows already fetched; it never fetches more');
      assert.ok(!shown.some((e) => e.athleteId === bAthlete),
        `filter ${String(raw)} must not surface another coach's athlete`);
    }
    assert.equal(parseFilter('../admin'), 'attention',
      'an unrecognised filter falls back rather than being passed through');
  });
});

describe('the counts are true against real rows', () => {
  it('every row count equals the filter it opens', async () => {
    const mine = await entriesFor(coachA);
    const counts = filterCounts(mine);
    for (const row of rosterWorkload(mine, { threshold: 1 })) {
      assert.equal(row.count, counts[row.kind],
        `${row.kind}: the band says ${row.count}, the filter says ${counts[row.kind]}`);
      assert.equal(row.count, new Set(row.athleteIds).size,
        'an athlete is counted once per row, never twice');
    }
  });

  it('an athlete with two concerns is in both counts and listed once', async () => {
    const mine = await entriesFor(coachA);
    const sarah = mine.find((e) => e.fullName === 'Sarah');
    const concerns = concernsFor(sarah, { raisedOnly: true });
    assert.ok(concerns.length >= 2, `Sarah carries ${concerns.join(' + ')}`);

    const rows = rosterWorkload(mine, { threshold: 1 });
    for (const kind of concerns) {
      assert.ok(rows.find((r) => r.kind === kind)?.athleteIds.includes(sarah.athleteId),
        `Sarah is missing from ${kind}, which she genuinely belongs to`);
    }

    const listed = attentionRoster(mine).filter((e) => e.athleteId === sarah.athleteId);
    assert.equal(listed.length, 1, 'and appears in the list exactly once');
  });
});

describe('a group selection is still checked one athlete at a time', () => {
  it('refuses a foreign athlete smuggled into a group\'s ids', async () => {
    // The band hands the coach a list of ids. If that list were trusted, the
    // easiest attack on Iron Miles would be to edit it — so the ids go the
    // same route a hand-picked selection does, and are authorised per athlete.
    const mine = await entriesFor(coachA);
    const row = rosterWorkload(mine, { threshold: 1 })[0];
    const poisoned = [...row.athleteIds, bAthlete];

    const { rows: [{ id: batch }] } = await t.asUser(coachA,
      `select im_open_batch('acknowledge_checkin', '{}'::jsonb, $1) as id`, [poisoned.length]);

    for (const athlete of poisoned) {
      const mineNow = (await t.asUser(coachA,
        `select im_is_coach_of($1) as ok`, [athlete])).rows[0].ok;
      if (athlete === bAthlete) {
        assert.equal(mineNow, false, "coach A is not this athlete's coach");
        // and the honest record of that is what gets written, not an apply
        await t.asUser(coachA,
          `select im_record_batch_item($1,$2,'unauthorised','Not on your roster.')`,
          [batch, athlete]);
      } else {
        assert.equal(mineNow, true);
      }
    }

    const items = (await t.asService(
      `select athlete_id, outcome from coach_batch_items where batch_id = $1`, [batch])).rows;
    const theirs = items.find((i) => i.athlete_id === bAthlete);
    assert.equal(theirs.outcome, 'unauthorised',
      'the smuggled athlete is recorded as refused, never as applied');
  });

  it('does not let a batch write an apply for an athlete off the roster', async () => {
    const { rows: [{ id: batch }] } = await t.asUser(coachA,
      `select im_open_batch('acknowledge_checkin', '{}'::jsonb, 1) as id`);
    assert.ok(await t.expectRefused(coachA,
      `select im_record_batch_item($1,$2,'applied','smuggled')`, [batch, bAthlete]),
      'claiming success for another coach\'s athlete is refused by the database');
  });
});

describe('what TypeScript can ask for, Postgres can store', () => {
  it('every batch action exists in the enum', async () => {
    // This is the test that was missing. Slice 10 added a fourth action to
    // the union and wired a button to it; nothing checked that the database
    // had ever heard of it, so "mark these read" was green in every suite and
    // would have thrown on the first real coach who used it.
    const { rows } = await t.asService(
      `select enumlabel from pg_enum e
         join pg_type ty on ty.oid = e.enumtypid
        where ty.typname = 'im_batch_action'`);
    const inDatabase = new Set(rows.map((r) => r.enumlabel));

    for (const action of Object.keys(BATCH_ACTION_LABEL)) {
      assert.ok(inDatabase.has(action),
        `im_batch_action has no '${action}' — a batch of it would fail on write`);
    }
  });

  it('opens a real batch for every one of them', async () => {
    for (const action of Object.keys(BATCH_ACTION_LABEL)) {
      const { rows } = await t.asUser(coachA,
        `select im_open_batch($1::im_batch_action, '{}'::jsonb, 1) as id`, [action]);
      assert.ok(rows[0].id, `${action} could not open a batch`);
    }
  });
});
