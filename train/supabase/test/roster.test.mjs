import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/**
 * The roster query.
 *
 * Two things it must never get wrong: showing a coach an athlete who is not
 * theirs, and reporting an athlete as non-compliant because their coach moved
 * a session. Everything else is arithmetic.
 */

let t, coachA, coachB, athlete, otherAthlete, MON, GENERAL;

const iso = (d) => d.toISOString().slice(0, 10);
const today = iso(new Date());
const plus = (date, days) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};
const thisMonday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return iso(d);
};

const link = async (coach, ath) =>
  t.asService(`insert into coach_athlete_links (coach_id,athlete_id,status) values ($1,$2,'active')`, [coach, ath]);

before(async () => {
  t = await createTestDatabase();
  coachA = await t.signUp('a@im.ie'); coachB = await t.signUp('b@im.ie');
  athlete = await t.signUp('ath@im.ie'); otherAthlete = await t.signUp('other@im.ie');
  await t.setRole(coachA, 'coach'); await t.setRole(coachB, 'coach');
  await t.asService(`update profiles set full_name='Andrew' where id=$1`, [athlete]);
  await t.asService(`update profiles set full_name='Not Yours' where id=$1`, [otherAthlete]);
  await link(coachA, athlete);
  await link(coachB, otherAthlete);
  MON = thisMonday();
  ({ rows: [GENERAL] } = await t.asService(`select id from program_templates where name='General Endurance'`));
});
after(async () => t?.close());

const roster = async (user) => (await t.asUser(user, `select * from im_coach_roster()`)).rows;
const rowFor = async (user, id) => (await roster(user)).find((r) => r.athlete_id === id);

describe('who a coach can see', () => {
  it('shows only their own athletes', async () => {
    const rows = await roster(coachA);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].full_name, 'Andrew');
  });

  it('never shows another coach\'s athlete, even when asked for by id', async () => {
    const rows = (await t.asUser(coachA, `select * from im_coach_roster($1)`, [coachB])).rows;
    assert.equal(rows.length, 1);
    assert.equal(rows[0].full_name, 'Andrew',
      'passing another coach id returns your own roster, not theirs');
    assert.ok(!rows.some((r) => r.athlete_id === otherAthlete));
  });

  it('gives an athlete nothing', async () => {
    const rows = await roster(athlete);
    assert.equal(rows.length, 0);
  });

  it('gives a coach with nobody an empty roster rather than an error', async () => {
    const lonely = await t.signUp('lonely@im.ie');
    await t.setRole(lonely, 'coach');
    assert.deepEqual(await roster(lonely), []);
  });

  it('drops an athlete whose link is no longer active', async () => {
    const paused = await t.signUp('paused@im.ie');
    await t.asService(
      `insert into coach_athlete_links (coach_id,athlete_id,status) values ($1,$2,'ended')`, [coachA, paused]);
    const rows = await roster(coachA);
    assert.ok(!rows.some((r) => r.athlete_id === paused));
  });
});

describe('an athlete with no programme', () => {
  it('appears, with the gaps stated as nulls rather than zeroes', async () => {
    const row = await rowFor(coachA, athlete);
    assert.ok(row);
    assert.equal(row.programme_id, null);
    assert.equal(row.week_no, null);
    assert.equal(row.future_sessions, 0);
    assert.equal(row.planned_four_weeks, 0);
  });
});

describe('an athlete on a programme', () => {
  before(async () => {
    await t.asUser(coachA, `select im_instantiate_program_template($1,$2,$3::date)`, [GENERAL.id, athlete, MON]);
  });

  it('reports where they are in it', async () => {
    const row = await rowFor(coachA, athlete);
    assert.ok(row.programme_id);
    assert.equal(row.programme_name, 'General Endurance');
    assert.equal(row.week_no, 1, 'the week containing today');
    assert.equal(row.total_weeks, 12);
    assert.ok(row.block_name);
    assert.ok(row.programme_end_date);
  });

  it('reports what is next and how much is ahead', async () => {
    const row = await rowFor(coachA, athlete);
    assert.ok(row.future_sessions > 0);
    assert.ok(row.next_session_date);
    assert.ok(row.next_session_name);
    assert.ok(iso(row.next_session_date) >= today);
  });

  it('counts the current prescription, not rest days', async () => {
    const row = await rowFor(coachA, athlete);
    const { rows: [check] } = await t.asService(`
      select count(*) filter (where type = 'rest')::int rest
        from scheduled_workouts
       where athlete_id=$1 and date >= $2::date - 27 and date <= $2::date`, [athlete, today]);
    assert.ok(check.rest >= 0);
    const { rows: [all] } = await t.asService(`
      select count(*)::int n from scheduled_workouts
       where athlete_id=$1 and date >= $2::date - 27 and date <= $2::date`, [athlete, today]);
    assert.equal(row.planned_four_weeks, all.n - check.rest,
      'rest days are not training an athlete can fail to do');
  });

  it('counts what they completed', async () => {
    const { rows: sessions } = await t.asService(
      `select id from scheduled_workouts where athlete_id=$1 and type<>'rest' and date <= $2::date limit 2`,
      [athlete, today]);
    for (const s of sessions) {
      await t.asService(`update scheduled_workouts set status='completed' where id=$1`, [s.id]);
    }
    const row = await rowFor(coachA, athlete);
    assert.equal(row.completed_four_weeks, sessions.length);
    assert.ok(row.last_completed_date);
    assert.ok(row.last_completed_name);
  });
});

describe('adherence follows the current prescription', () => {
  let solo;

  before(async () => {
    solo = await t.signUp('solo@im.ie');
    await t.asService(`update profiles set full_name='Solo' where id=$1`, [solo]);
    await link(coachA, solo);
    await t.asUser(coachA, `select im_instantiate_program_template($1,$2,$3::date)`, [GENERAL.id, solo, MON]);
  });

  it('does not punish an athlete because their coach moved a session', async () => {
    const before = await rowFor(coachA, solo);

    // the coach moves a past session out of the window, through the real
    // adaptation path — which is also what puts it on the audit trail
    const { rows: [session] } = await t.asService(
      `select id, date from scheduled_workouts
        where athlete_id=$1 and type<>'rest' and date <= $2::date order by date limit 1`, [solo, today]);
    assert.ok(session, 'the athlete has training behind them');
    await t.asUser(coachA,
      `select im_move_session($1,$2::date,9::smallint)`, [session.id, plus(today, 20)]);

    const after = await rowFor(coachA, solo);
    assert.equal(after.planned_four_weeks, before.planned_four_weeks - 1,
      'the moved session leaves the window with the coach who moved it');
    assert.equal(after.completed_four_weeks, before.completed_four_weeks,
      'and the athlete keeps credit for everything they actually did');
  });

  it('counts a coach\'s recent changes, so an adaptation is not a surprise', async () => {
    const row = await rowFor(coachA, solo);
    assert.ok(row.recent_adaptations > 0, 'the move this coach just made is on the record');
  });
});

describe('what the athlete reported', () => {
  it('carries the latest check-in, unflattened', async () => {
    await t.asService(`
      insert into checkins (athlete_id, week_start, fatigue, sleep, soreness, stress, motivation,
                            confidence, training_difficulty, attention_level, attention_reasons,
                            pain_or_niggles, submitted_at)
      values ($1,$2::date,8,4,7,5,6,5,7,'attention','{"fatigue up","soreness reported"}',
              'Left calf tight after the long run', now())`, [athlete, MON]);

    const row = await rowFor(coachA, athlete);
    assert.equal(row.checkin_attention, 'attention');
    assert.equal(row.checkin_fatigue, 8);
    assert.equal(row.checkin_soreness, 7);
    assert.deepEqual(row.checkin_reasons, ['fatigue up', 'soreness reported']);
    assert.match(row.checkin_pain, /calf/);
    // Slice 10 split one column into two: nobody has read it, and nobody has
    // answered it. Both are asserted rather than the single merged value.
    assert.equal(row.checkin_acknowledged_at, null, 'unread');
    assert.equal(row.checkin_responded_at, null, 'and unanswered');
    assert.ok(row.checkin_id, 'and the roster carries which check-in it is');
  });

  it('takes the most recent one when there are several', async () => {
    await t.asService(`
      insert into checkins (athlete_id, week_start, fatigue, sleep, soreness, stress, motivation,
                            confidence, training_difficulty, attention_level, submitted_at)
      values ($1,$2::date,3,8,2,3,8,8,4,'none', now())`, [athlete, plus(MON, 7)]);
    const row = await rowFor(coachA, athlete);
    assert.equal(iso(row.checkin_week_start), plus(MON, 7));
    assert.equal(row.checkin_attention, 'none');
  });
});

describe('missed training', () => {
  it('counts missed sessions and names a missed key one', async () => {
    // a key session in the fortnight behind them; the seeded week may not have
    // one yet depending on which day the test runs, so put one there
    const { rows: [key] } = await t.asService(`
      insert into scheduled_workouts (athlete_id, date, slot, status, name, type, basis, intensity, distance_km)
      values ($1, $2::date, 7, 'missed', 'Long Run 22K', 'long_run', 'distance', 'easy', 22)
      returning id, name`, [athlete, plus(today, -3)]);

    const row = await rowFor(coachA, athlete);
    assert.ok(row.missed_fourteen_days >= 1);
    assert.equal(row.missed_key_name, key.name);
    assert.ok(row.missed_key_date);
  });
});

describe('races', () => {
  it('carries the next upcoming race and nothing behind them', async () => {
    const { rows: [race] } = await t.asService(
      `insert into races (name, date, event_type) values ('Dublin Marathon',$1::date,'marathon') returning id`,
      [plus(today, 30)]);
    const { rows: [past] } = await t.asService(
      `insert into races (name, date, event_type) values ('Last Year',$1::date,'marathon') returning id`,
      [plus(today, -300)]);
    await t.asService(
      `insert into goals (athlete_id, race_id, event_type, target_date, outcome, is_primary)
       values ($1,$2,'marathon',$3::date,'time',true)`, [athlete, race.id, plus(today, 30)]);
    await t.asService(
      `insert into goals (athlete_id, race_id, event_type, target_date, outcome, is_primary)
       values ($1,$2,'marathon',$3::date,'time',false)`, [athlete, past.id, plus(today, -300)]);

    const row = await rowFor(coachA, athlete);
    assert.equal(row.race_name, 'Dublin Marathon');
    assert.equal(iso(row.race_date), plus(today, 30));
  });
});

describe('unread messages', () => {
  it('counts only what the athlete sent this coach and they have not read', async () => {
    const { rows: [thread] } = await t.asService(
      `insert into message_threads (athlete_id, coach_id) values ($1,$2) returning id`, [athlete, coachA]);
    await t.asService(
      `insert into messages (thread_id, sender_id, recipient_id, body, author_kind)
       values ($1,$2,$3,'Calf is still sore','human')`, [thread.id, athlete, coachA]);
    await t.asService(
      `insert into messages (thread_id, sender_id, recipient_id, body, author_kind, read_at)
       values ($1,$2,$3,'Already read this','human', now())`, [thread.id, athlete, coachA]);
    await t.asService(
      `insert into messages (thread_id, sender_id, recipient_id, body, author_kind)
       values ($1,$2,$3,'My own message','human')`, [thread.id, coachA, athlete]);

    const row = await rowFor(coachA, athlete);
    assert.equal(row.unread_from_athlete, 1);
  });
});

describe('a realistic roster', () => {
  let bigCoach;

  before(async () => {
    bigCoach = await t.signUp('big@im.ie');
    await t.setRole(bigCoach, 'coach');
    for (let i = 0; i < 50; i++) {
      const a = await t.signUp(`athlete${i}@im.ie`);
      await t.asService(`update profiles set full_name=$2 where id=$1`,
        [a, `Athlete ${String(i).padStart(2, '0')}`]);
      await link(bigCoach, a);
      // half of them on a programme, so the query does real work
      if (i % 2 === 0) {
        await t.asUser(bigCoach, `select im_instantiate_program_template($1,$2,$3::date)`, [GENERAL.id, a, MON]);
      }
    }
  });

  it('returns fifty athletes in one query', async () => {
    const started = Date.now();
    const rows = await roster(bigCoach);
    const elapsed = Date.now() - started;

    assert.equal(rows.length, 50);
    assert.ok(rows.filter((r) => r.programme_id).length === 25);
    assert.ok(elapsed < 5000, `fifty athletes took ${elapsed}ms`);
  });

  it('comes back alphabetically, so the order never wobbles', async () => {
    const names = (await roster(bigCoach)).map((r) => r.full_name);
    assert.deepEqual(names, [...names].sort());
  });

  it('still shows the other coach nothing of it', async () => {
    const rows = await roster(coachA);
    assert.ok(!rows.some((r) => r.full_name.startsWith('Athlete ')));
  });
});
