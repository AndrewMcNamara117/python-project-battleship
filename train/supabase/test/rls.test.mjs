import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/**
 * Row-level security, executed.
 *
 * Every assertion here runs the shipped policies against a real Postgres as a
 * non-superuser role, so a policy that only looks correct fails this file.
 * The product treats training and wellbeing data as sensitive; this is where
 * that claim is either true or it is not.
 */

let t;
let coach, otherCoach, athlete, otherAthlete, admin;

before(async () => {
  t = await createTestDatabase();

  coach = await t.signUp('coach@ironmiles.ie', 'A Coach');
  otherCoach = await t.signUp('other.coach@ironmiles.ie', 'Other Coach');
  athlete = await t.signUp('athlete@example.com', 'An Athlete');
  otherAthlete = await t.signUp('other.athlete@example.com', 'Other Athlete');
  admin = await t.signUp('admin@ironmiles.ie', 'Admin');

  await t.setRole(coach, 'coach');
  await t.setRole(otherCoach, 'coach');
  await t.setRole(admin, 'admin');

  // only `athlete` is coached by `coach`
  await t.asService(
    `insert into coach_athlete_links (coach_id, athlete_id, status) values ($1, $2, 'active')`,
    [coach, athlete],
  );

  // a session and a log for each athlete
  for (const id of [athlete, otherAthlete]) {
    await t.asService(
      `insert into scheduled_workouts (athlete_id, date, name, type, status)
       values ($1, current_date, 'Easy 8K', 'easy_run', 'scheduled')`,
      [id],
    );
    await t.asService(
      `insert into checkins (athlete_id, week_start, fatigue, sleep, soreness, stress,
                             motivation, confidence, training_difficulty, pain_or_niggles)
       values ($1, date_trunc('week', current_date)::date, 5,7,4,3,8,7,6, 'left calf tight')`,
      [id],
    );
  }
});

after(async () => t?.close());

/* ---------------- identity ---------------- */

describe('sign-up', () => {
  it('creates a profile row for every auth user', async () => {
    const { rows } = await t.asService('select count(*)::int as n from profiles');
    assert.equal(rows[0].n, 5);
  });

  it('defaults new accounts to athlete, not coach', async () => {
    const id = await t.signUp('fresh@example.com', 'Fresh');
    const { rows } = await t.asService('select role from profiles where id = $1', [id]);
    assert.equal(rows[0].role, 'athlete');
  });

  it('defaults leaderboard visibility to off', async () => {
    const { rows } = await t.asService('select leaderboard_opt_in from profiles where id = $1', [athlete]);
    assert.equal(rows[0].leaderboard_opt_in, false);
  });
});

describe('profiles', () => {
  it('an athlete can read their own profile', async () => {
    const { rows } = await t.asUser(athlete, 'select id from profiles where id = $1', [athlete]);
    assert.equal(rows.length, 1);
  });

  it('an athlete cannot read an unrelated athlete who has not opted in', async () => {
    const { rows } = await t.asUser(athlete, 'select id from profiles where id = $1', [otherAthlete]);
    assert.equal(rows.length, 0);
  });

  it('a coach can read a linked athlete', async () => {
    const { rows } = await t.asUser(coach, 'select id from profiles where id = $1', [athlete]);
    assert.equal(rows.length, 1);
  });

  it('a coach cannot read an athlete they do not coach', async () => {
    const { rows } = await t.asUser(otherCoach, 'select id from profiles where id = $1', [athlete]);
    assert.equal(rows.length, 0);
  });

  it('an athlete cannot promote themselves to coach', async () => {
    const denied = await t.expectRefused(athlete, `update profiles set role = 'coach' where id = $1`, [athlete]);
    assert.ok(denied, 'expected the role change to be refused');
    const { rows } = await t.asService('select role from profiles where id = $1', [athlete]);
    assert.equal(rows[0].role, 'athlete');
  });

  it('an athlete cannot edit another athlete', async () => {
    await t.asUser(athlete, `update profiles set full_name = 'Hacked' where id = $1`, [otherAthlete]);
    const { rows } = await t.asService('select full_name from profiles where id = $1', [otherAthlete]);
    assert.notEqual(rows[0].full_name, 'Hacked');
  });
});

/* ---------------- training data ---------------- */

describe('training data', () => {
  it('an athlete sees only their own scheduled sessions', async () => {
    const { rows } = await t.asUser(athlete, 'select athlete_id from scheduled_workouts');
    assert.ok(rows.length > 0);
    assert.ok(rows.every((r) => r.athlete_id === athlete));
  });

  it('an athlete cannot read another athlete’s sessions even by id', async () => {
    const { rows } = await t.asUser(athlete, 'select id from scheduled_workouts where athlete_id = $1', [
      otherAthlete,
    ]);
    assert.equal(rows.length, 0);
  });

  it('an athlete cannot complete another athlete’s session', async () => {
    await t.asUser(athlete, `update scheduled_workouts set status = 'completed' where athlete_id = $1`, [
      otherAthlete,
    ]);
    const { rows } = await t.asService(
      `select status from scheduled_workouts where athlete_id = $1`,
      [otherAthlete],
    );
    assert.ok(rows.every((r) => r.status !== 'completed'));
  });

  it('an athlete cannot log a workout against another athlete', async () => {
    const denied = await t.expectRefused(
      athlete,
      `insert into completed_workouts (athlete_id, date, type) values ($1, current_date, 'easy_run')`,
      [otherAthlete],
    );
    assert.ok(denied, 'expected the cross-athlete insert to be refused');
  });

  it('a coach sees a linked athlete’s sessions', async () => {
    const { rows } = await t.asUser(coach, 'select id from scheduled_workouts where athlete_id = $1', [athlete]);
    assert.equal(rows.length, 1);
  });

  it('a coach cannot see an unlinked athlete’s sessions', async () => {
    const { rows } = await t.asUser(otherCoach, 'select id from scheduled_workouts where athlete_id = $1', [
      athlete,
    ]);
    assert.equal(rows.length, 0);
  });

  it('a coach can prescribe for a linked athlete', async () => {
    const { rows } = await t.asUser(
      coach,
      `insert into scheduled_workouts (athlete_id, date, slot, name, type)
       values ($1, current_date + 1, 0, 'Threshold', 'threshold') returning id`,
      [athlete],
    );
    assert.equal(rows.length, 1);
  });

  it('a coach cannot prescribe for an athlete they do not coach', async () => {
    const denied = await t.expectRefused(
      otherCoach,
      `insert into scheduled_workouts (athlete_id, date, slot, name, type)
       values ($1, current_date + 2, 0, 'Intrusion', 'easy_run')`,
      [athlete],
    );
    assert.ok(denied, 'expected the prescription to be refused');
  });
});

/* ---------------- wellbeing ---------------- */

describe('check-ins', () => {
  it('an athlete cannot read another athlete’s check-in', async () => {
    const { rows } = await t.asUser(athlete, 'select id from checkins where athlete_id = $1', [otherAthlete]);
    assert.equal(rows.length, 0);
  });

  it('a linked coach can read the check-in, including free text', async () => {
    const { rows } = await t.asUser(coach, 'select pain_or_niggles from checkins where athlete_id = $1', [
      athlete,
    ]);
    assert.equal(rows.length, 1);
    assert.match(rows[0].pain_or_niggles, /calf/);
  });

  it('an unlinked coach cannot read it', async () => {
    const { rows } = await t.asUser(otherCoach, 'select id from checkins where athlete_id = $1', [athlete]);
    assert.equal(rows.length, 0);
  });
});

describe('coach notes', () => {
  before(async () => {
    await t.asService(
      `insert into coach_notes (athlete_id, coach_id, body, visibility)
       values ($1, $2, 'private working note', 'private'),
              ($1, $2, 'shared with athlete', 'shared')`,
      [athlete, coach],
    );
  });

  it('the athlete sees shared notes only', async () => {
    const { rows } = await t.asUser(athlete, 'select body, visibility from coach_notes');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].visibility, 'shared');
  });

  it('the private note is invisible to the athlete even when asked for directly', async () => {
    const { rows } = await t.asUser(athlete, `select body from coach_notes where visibility = 'private'`);
    assert.equal(rows.length, 0);
  });

  it('the coach sees both', async () => {
    const { rows } = await t.asUser(coach, 'select body from coach_notes where athlete_id = $1', [athlete]);
    assert.equal(rows.length, 2);
  });
});

/* ---------------- server-owned tables ---------------- */

describe('server-owned data', () => {
  it('an athlete cannot award themselves Forge points', async () => {
    const denied = await t.expectRefused(
      athlete,
      `insert into forge_score_events (athlete_id, kind, points, date, label)
       values ($1, 'run_completed', 9999, current_date, 'cheat')`,
      [athlete],
    );
    assert.ok(denied, 'expected the ledger insert to be refused');
  });

  it('an athlete cannot grant themselves a subscription', async () => {
    const denied = await t.expectRefused(
      athlete,
      `insert into subscriptions (athlete_id, status) values ($1, 'active')`,
      [athlete],
    );
    assert.ok(denied, 'expected the subscription insert to be refused');
  });

  it('an athlete cannot send a message as somebody else', async () => {
    await t.asService(
      `insert into message_threads (athlete_id, coach_id) values ($1, $2)
       on conflict do nothing`,
      [athlete, coach],
    );
    const { rows: thread } = await t.asService(
      'select id from message_threads where athlete_id = $1',
      [athlete],
    );
    const denied = await t.expectRefused(
      athlete,
      `insert into messages (thread_id, sender_id, recipient_id, body, author_kind)
       values ($1, $2, $3, 'spoofed', 'human')`,
      [thread[0].id, coach, athlete],
    );
    assert.ok(denied, 'expected the spoofed sender to be refused');
  });

  it('an athlete cannot post as FORGE', async () => {
    const { rows: thread } = await t.asService(
      'select id from message_threads where athlete_id = $1',
      [athlete],
    );
    const denied = await t.expectRefused(
      athlete,
      `insert into messages (thread_id, sender_id, recipient_id, body, author_kind)
       values ($1, $2, $3, 'not really forge', 'forge')`,
      [thread[0].id, athlete, coach],
    );
    assert.ok(denied, 'expected the FORGE impersonation to be refused');
  });
});

/* ---------------- leaderboard consent ---------------- */

describe('leaderboard is opt-in', () => {
  it('an opted-out athlete is invisible to other athletes', async () => {
    const { rows } = await t.asUser(otherAthlete, 'select id from profiles where id = $1', [athlete]);
    assert.equal(rows.length, 0);
  });

  it('opting in exposes the profile, and nothing else', async () => {
    await t.asService('update profiles set leaderboard_opt_in = true where id = $1', [athlete]);

    const visible = await t.asUser(otherAthlete, 'select id from profiles where id = $1', [athlete]);
    assert.equal(visible.rows.length, 1, 'opted-in profile should be visible');

    // consent to appear on a leaderboard is not consent to share training data
    const sessions = await t.asUser(otherAthlete, 'select id from scheduled_workouts where athlete_id = $1', [
      athlete,
    ]);
    assert.equal(sessions.rows.length, 0, 'training data must stay private');

    const checkins = await t.asUser(otherAthlete, 'select id from checkins where athlete_id = $1', [athlete]);
    assert.equal(checkins.rows.length, 0, 'check-ins must stay private');

    await t.asService('update profiles set leaderboard_opt_in = false where id = $1', [athlete]);
  });
});

/* ---------------- intake ---------------- */

describe('intake', () => {
  it('a coach accepting an application links the athlete on sign-up', async () => {
    await t.asService(
      `insert into coaching_applications (full_name, email, goal, experience, start_when)
       values ('New Runner', 'newrunner@example.com', 'First ultra', 'Two years running', 'Now')`,
    );

    const { rows: app } = await t.asUser(
      coach,
      `select * from im_decide_application(
         (select id from coaching_applications where email = 'newrunner@example.com'),
         'accepted', 'good fit')`,
    );
    assert.equal(app[0].status, 'accepted');

    const newAthlete = await t.signUp('newrunner@example.com', '');

    const { rows: link } = await t.asService(
      'select coach_id, status from coach_athlete_links where athlete_id = $1',
      [newAthlete],
    );
    assert.equal(link.length, 1, 'sign-up should create the coach link');
    assert.equal(link[0].coach_id, coach);
    assert.equal(link[0].status, 'active');

    const { rows: thread } = await t.asService(
      'select id from message_threads where athlete_id = $1',
      [newAthlete],
    );
    assert.equal(thread.length, 1, 'a message thread should exist immediately');

    const { rows: name } = await t.asService('select full_name from profiles where id = $1', [newAthlete]);
    assert.equal(name[0].full_name, 'New Runner', 'the applied name should carry across');
  });

  it('someone signing up without an accepted application is linked to nobody', async () => {
    const stranger = await t.signUp('stranger@example.com', 'Stranger');
    const { rows } = await t.asService('select id from coach_athlete_links where athlete_id = $1', [stranger]);
    assert.equal(rows.length, 0);
  });

  it('an athlete cannot decide an application', async () => {
    await t.asService(
      `insert into coaching_applications (full_name, email, goal, experience, start_when)
       values ('Someone', 'someone@example.com', 'A marathon', 'Some', 'Soon')`,
    );
    const denied = await t.expectRefused(
      athlete,
      `select im_decide_application(
         (select id from coaching_applications where email = 'someone@example.com'),
         'accepted', null)`,
    );
    assert.ok(denied, 'expected the decision to be refused');
  });

  it('an athlete cannot read applications at all', async () => {
    const { rows } = await t.asUser(athlete, 'select id from coaching_applications');
    assert.equal(rows.length, 0);
  });

  it('an athlete cannot link themselves to a coach', async () => {
    const denied = await t.expectRefused(athlete, `select im_link_athlete($1)`, [athlete]);
    assert.ok(denied, 'expected the self-link to be refused');
  });
});

/* ---------------- the coaching relationship gates writes ---------------- */

describe('coach notes require the coaching relationship', () => {
  it('a coach cannot write a note about an athlete they do not coach', async () => {
    // Regression: the original policy checked coach_id = auth.uid() only, so any
    // coach could author a private note about any athlete in the system.
    const refused = await t.expectRefused(
      otherCoach,
      `insert into coach_notes (athlete_id, coach_id, body, visibility)
       values ($1, $2, 'intrusion', 'private')`,
      [athlete, otherCoach],
    );
    assert.ok(refused, 'expected the note to be refused');

    const { rows } = await t.asService('select body from coach_notes where athlete_id = $1', [athlete]);
    assert.ok(!rows.some((r) => r.body === 'intrusion'), 'no note should have been written');
  });

  it('a coach cannot forge authorship to reach an athlete they do not coach', async () => {
    const refused = await t.expectRefused(
      otherCoach,
      `insert into coach_notes (athlete_id, coach_id, body, visibility)
       values ($1, $2, 'spoofed author', 'private')`,
      [athlete, coach],
    );
    assert.ok(refused, 'expected the spoofed authorship to be refused');
  });

  it('the athlete\u2019s own coach can still write', async () => {
    const { rows } = await t.asUser(
      coach,
      `insert into coach_notes (athlete_id, coach_id, body, visibility)
       values ($1, $2, 'legitimate note', 'private') returning id`,
      [athlete, coach],
    );
    assert.equal(rows.length, 1);
  });
});

/* ---------------- the athlete model ---------------- */

describe('athlete profile fields', () => {
  it('training days are constrained to real weekdays', async () => {
    const refused = await t.expectRefused(
      athlete,
      `update profiles set available_training_days = array[0,9]::smallint[] where id = $1`,
      [athlete],
    );
    assert.ok(refused, 'expected weekday 0 and 9 to be rejected');
  });

  it('an athlete can set their own availability and coaching context', async () => {
    await t.asUser(
      athlete,
      `update profiles
          set available_training_days = array[1,3,5,7]::smallint[],
              current_weekly_km = 42.5,
              injury_notes = 'left calf tight after long runs'
        where id = $1`,
      [athlete],
    );
    const { rows } = await t.asService(
      'select available_training_days, current_weekly_km, injury_notes from profiles where id = $1',
      [athlete],
    );
    assert.deepEqual(rows[0].available_training_days, [1, 3, 5, 7]);
    assert.equal(Number(rows[0].current_weekly_km), 42.5);
    assert.match(rows[0].injury_notes, /calf/);
  });

  it('an athlete cannot edit another athlete\u2019s injury notes', async () => {
    await t.asUser(athlete, `update profiles set injury_notes = 'tampered' where id = $1`, [otherAthlete]);
    const { rows } = await t.asService('select injury_notes from profiles where id = $1', [otherAthlete]);
    assert.notEqual(rows[0].injury_notes, 'tampered');
  });

  it('a linked coach can read the athlete\u2019s coaching context', async () => {
    const { rows } = await t.asUser(
      coach,
      'select current_weekly_km, injury_notes, available_training_days from profiles where id = $1',
      [athlete],
    );
    assert.equal(rows.length, 1);
    assert.match(rows[0].injury_notes ?? '', /calf/);
  });

  it('an unlinked coach cannot', async () => {
    const { rows } = await t.asUser(otherCoach, 'select injury_notes from profiles where id = $1', [athlete]);
    assert.equal(rows.length, 0);
  });
});

/* ---------------- privacy ---------------- */

describe('privacy', () => {
  it('an athlete can export their own record', async () => {
    const { rows } = await t.asUser(athlete, 'select im_export_athlete_data($1) as data', [athlete]);
    assert.ok(rows[0].data.profile, 'export should include the profile');
    assert.ok(Array.isArray(rows[0].data.checkins));
  });

  it('an athlete cannot export somebody else’s record', async () => {
    const denied = await t.expectRefused(athlete, 'select im_export_athlete_data($1)', [otherAthlete]);
    assert.ok(denied, 'expected the export to be refused');
  });

  it('a coach cannot export a linked athlete’s record either', async () => {
    // reading data to coach with is one thing; taking a full copy is another
    const denied = await t.expectRefused(coach, 'select im_export_athlete_data($1)', [athlete]);
    assert.ok(denied, 'expected the export to be refused for a coach');
  });

  it('deleting a profile removes every trace of their training', async () => {
    const doomed = await t.signUp('doomed@example.com', 'Doomed');
    await t.asService(
      `insert into scheduled_workouts (athlete_id, date, name, type)
       values ($1, current_date, 'Easy', 'easy_run')`,
      [doomed],
    );
    await t.asService(
      `insert into checkins (athlete_id, week_start, fatigue, sleep, soreness, stress,
                             motivation, confidence, training_difficulty)
       values ($1, date_trunc('week', current_date)::date, 5,5,5,5,5,5,5)`,
      [doomed],
    );

    await t.asService('delete from profiles where id = $1', [doomed]);

    for (const table of ['scheduled_workouts', 'checkins', 'coach_athlete_links']) {
      const { rows } = await t.asService(`select count(*)::int as n from ${table} where athlete_id = $1`, [
        doomed,
      ]);
      assert.equal(rows[0].n, 0, `${table} should be empty after deletion`);
    }
  });
});

/* ---------------- admin ---------------- */

describe('admin', () => {
  it('an admin can read any athlete', async () => {
    const { rows } = await t.asUser(admin, 'select id from profiles where id = $1', [otherAthlete]);
    assert.equal(rows.length, 1);
  });

  it('a coach is not an admin', async () => {
    const { rows } = await t.asUser(coach, 'select id from profiles where id = $1', [otherAthlete]);
    assert.equal(rows.length, 0);
  });
});
