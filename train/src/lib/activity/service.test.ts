import assert from 'node:assert/strict';
import { afterEach, beforeEach, describe, it, mock } from 'node:test';
import { DEMO_ATHLETE_ID } from '@/data/demo-seed';
import { DemoRepo, resetDemoData } from '@/lib/data/demo-repo';
import { isRun } from '@/lib/domain/analytics';
import { addDays, toISODate } from '@/lib/domain/dates';
import type { Profile, ScheduledWorkout } from '@/lib/domain/types';
import { syntheticRun, toFit, toGpx } from './fixtures.ts';
import { attachActivity, attachOptions, importActivity, removeActivity } from './service.ts';

/**
 * The import flow end to end against the demo adapter: the same calls the
 * server action makes, the same repository contract production implements.
 */

beforeEach(() => resetDemoData());
afterEach(() => mock.timers.reset());

const enc = (s: string) => new TextEncoder().encode(s);

async function setup() {
  const repo = new DemoRepo();
  const profile = (await repo.getProfile(DEMO_ATHLETE_ID)) as Profile;
  const today = toISODate(new Date());
  const upcoming = await repo.listScheduled(DEMO_ATHLETE_ID, today, addDays(today, 14));
  // a day with exactly one run on it
  const session = upcoming.find(
    (s) => isRun(s.type) && s.status === 'scheduled' && upcoming.filter((o) => o.date === s.date && o.type !== 'rest').length === 1,
  ) as ScheduledWorkout;
  assert.ok(session, 'the demo plan has an upcoming single-run day');
  // a run on a day that has not come yet completes nothing, so the clock
  // stands on the session's own day (the dataset was built for today already)
  mock.timers.enable({ apis: ['Date'], now: Date.parse(`${session.date}T20:00:00Z`) });
  return { repo, profile, session };
}

/** A run on the session's date at 07:00 Dublin time (06:00Z in summer, 07:00Z in winter — either is that date). */
function runOn(date: string, km = 8, start = '06:30:00Z') {
  return syntheticRun({ start: `${date}T${start}`, distanceKm: km, paceSecPerKm: 320, intervalS: 2 });
}

describe('import — matched to the plan', () => {
  it('completes the one session that fits, from the file’s numbers', async () => {
    const { repo, profile, session } = await setup();
    const out = await importActivity(repo, profile, toFit(runOn(session.date)));
    assert.equal(out.status, 'matched');

    const log = (await repo.listCompleted(DEMO_ATHLETE_ID, session.date, session.date)).find((c) => c.scheduledWorkoutId === session.id);
    assert.ok(log);
    assert.equal(log.source, 'upload');
    assert.equal(log.actualDistanceKm, 8);
    assert.ok(log.averageHeartRate && log.averageHeartRate > 130);
    assert.equal((await repo.getScheduled(session.id))?.status, 'completed');

    const stored = await repo.getActivity(out.activity.id);
    assert.equal(stored?.scheduledWorkoutId, session.id);
    assert.equal(stored?.completedWorkoutId, log.id);
  });

  it('the same file twice is one activity', async () => {
    const { repo, profile, session } = await setup();
    const bytes = toFit(runOn(session.date));
    await importActivity(repo, profile, bytes);
    const again = await importActivity(repo, profile, bytes);
    assert.equal(again.status, 'duplicate');
    assert.equal((await repo.listActivitiesOn(DEMO_ATHLETE_ID, session.date, session.date)).length, 1);
  });

  it('the same run exported as GPX is recognised too', async () => {
    const { repo, profile, session } = await setup();
    const run = runOn(session.date);
    await importActivity(repo, profile, toFit(run));
    const gpx = await importActivity(repo, profile, enc(toGpx(run)));
    assert.equal(gpx.status, 'duplicate');
  });

  it('editing the log afterwards keeps the activity attached', async () => {
    const { repo, profile, session } = await setup();
    const out = await importActivity(repo, profile, toFit(runOn(session.date)));
    const [log] = (await repo.listCompleted(DEMO_ATHLETE_ID, session.date, session.date)).filter((c) => c.scheduledWorkoutId === session.id);
    const edited = await repo.logWorkout({ ...log, rpe: 4, athleteNotes: 'Legs good' });
    assert.equal(edited.id, log.id);
    assert.equal((await repo.getActivity(out.activity.id))?.completedWorkoutId, log.id);
  });
});

describe('import — a session already logged by hand', () => {
  it('fills the gaps and never overwrites what the athlete typed', async () => {
    const { repo, profile, session } = await setup();
    await repo.logWorkout({
      scheduledWorkoutId: session.id,
      athleteId: DEMO_ATHLETE_ID,
      date: session.date,
      type: session.type,
      actualDistanceKm: 7.5,
      actualDurationMinutes: 40,
      averagePaceSecPerKm: 320,
      averageHeartRate: null,
      maxHeartRate: null,
      rpe: 5,
      sessionRating: 4,
      soreness: 2,
      athleteNotes: 'Windy on the bridge',
      source: 'manual',
    });

    const out = await importActivity(repo, profile, toFit(runOn(session.date)));
    assert.equal(out.status, 'enriched');
    const [log] = (await repo.listCompleted(DEMO_ATHLETE_ID, session.date, session.date)).filter((c) => c.scheduledWorkoutId === session.id);
    assert.equal(log.actualDistanceKm, 7.5, 'typed distance kept');
    assert.equal(log.rpe, 5);
    assert.equal(log.athleteNotes, 'Windy on the bridge');
    assert.equal(log.source, 'manual');
    assert.ok(log.averageHeartRate, 'heart rate filled from the file');
  });

  it('deleting that activity keeps the typed log', async () => {
    const { repo, profile, session } = await setup();
    await repo.logWorkout({
      scheduledWorkoutId: session.id, athleteId: DEMO_ATHLETE_ID, date: session.date, type: session.type,
      actualDistanceKm: 7.5, actualDurationMinutes: 40, averagePaceSecPerKm: 320, averageHeartRate: null,
      maxHeartRate: null, rpe: 5, sessionRating: null, soreness: null, athleteNotes: null, source: 'manual',
    });
    const out = await importActivity(repo, profile, toFit(runOn(session.date)));
    const removed = await removeActivity(repo, DEMO_ATHLETE_ID, out.activity.id);
    assert.deepEqual(removed, { ok: true, unlogged: false });
    assert.equal((await repo.getScheduled(session.id))?.status, 'completed');
  });
});

describe('import — when the match is not certain', () => {
  it('asks when two sessions could fit, then completes the one chosen', async () => {
    const { repo, profile, session } = await setup();
    const second = await repo.saveScheduled({ ...session, id: `${session.id}-pm`, slot: 1, name: 'Shakeout' });
    const out = await importActivity(repo, profile, toFit(runOn(session.date)));
    assert.equal(out.status, 'ambiguous');
    if (out.status !== 'ambiguous') return;
    assert.equal(out.options.length, 2);
    assert.equal((await repo.getScheduled(session.id))?.status, 'scheduled', 'nothing completed by guessing');

    const picked = await attachActivity(repo, DEMO_ATHLETE_ID, out.activity.id, second.id);
    assert.equal(picked.ok, true);
    assert.equal((await repo.getScheduled(second.id))?.status, 'completed');
    assert.equal((await repo.getScheduled(session.id))?.status, 'scheduled');

    const twice = await attachActivity(repo, DEMO_ATHLETE_ID, out.activity.id, session.id);
    assert.deepEqual(twice, { ok: false, error: 'already_attached' });
  });

  it('keeps an activity with nothing to match, and says why', async () => {
    const { repo, profile } = await setup();
    const far = addDays(toISODate(new Date()), 400);
    const out = await importActivity(repo, profile, toFit(runOn(far)));
    assert.equal(out.status, 'unmatched');
    if (out.status === 'unmatched') assert.match(out.reason, /dated after today/);
    assert.ok(await repo.getActivity(out.activity.id), 'stored anyway');
  });

  it('offers the day either side, for a run that crossed midnight', async () => {
    const { repo, profile, session } = await setup();
    const dayBefore = addDays(session.date, -1);
    const out = await importActivity(repo, profile, toFit(runOn(dayBefore, 5, '22:30:00Z')));
    const options = await attachOptions(repo, out.activity);
    assert.ok(options.some((s) => s.id === session.id));
  });

  it('a ride is never offered as a run', async () => {
    const { repo, profile, session } = await setup();
    const ride = toFit(runOn(session.date), { sport: 2 });
    const out = await importActivity(repo, profile, ride);
    assert.notEqual(out.status, 'matched');
    assert.ok(!(await attachOptions(repo, out.activity)).some((s) => s.id === session.id));
  });
});

describe('import — ownership', () => {
  it('an athlete cannot attach, or delete, somebody else’s activity', async () => {
    const { repo, profile, session } = await setup();
    const out = await importActivity(repo, profile, toFit(runOn(addDays(session.date, 400))));
    assert.deepEqual(await attachActivity(repo, 'someone-else', out.activity.id, session.id), { ok: false, error: 'not_yours' });
    assert.deepEqual(await removeActivity(repo, 'someone-else', out.activity.id), { ok: false, unlogged: false });
    assert.ok(await repo.getActivity(out.activity.id));
  });

  it('the demo adapter refuses a link to another athlete’s session, as the trigger does', async () => {
    const { repo, profile, session } = await setup();
    const out = await importActivity(repo, profile, toFit(runOn(addDays(toISODate(new Date()), 400))));
    const theirs = await repo.saveScheduled({ ...session, id: 'someone-elses-session', athleteId: 'someone-else' });
    await assert.rejects(
      repo.linkActivity(out.activity.id, { scheduledWorkoutId: theirs.id, completedWorkoutId: null }),
      /own session/,
    );
  });
});

describe('delete', () => {
  it('deleting an import that created the log puts the session back on the plan', async () => {
    const { repo, profile, session } = await setup();
    const out = await importActivity(repo, profile, toFit(runOn(session.date)));
    const removed = await removeActivity(repo, DEMO_ATHLETE_ID, out.activity.id);
    assert.deepEqual(removed, { ok: true, unlogged: true });
    assert.equal((await repo.getScheduled(session.id))?.status, 'scheduled');
    assert.equal((await repo.listCompleted(DEMO_ATHLETE_ID, session.date, session.date)).filter((c) => c.scheduledWorkoutId === session.id).length, 0);
    assert.equal(await repo.getActivity(out.activity.id), null);
  });
});

describe('demo seed', () => {
  it('recent runs carry an activity built by the real pipeline', async () => {
    const repo = new DemoRepo();
    const list = await repo.listActivities(DEMO_ATHLETE_ID);
    assert.ok(list.length >= 6, `got ${list.length}`);
    const a = list[0];
    assert.ok(a.route && a.hrHistogram.length);
    assert.ok(a.completedWorkoutId);
    // a list item is light; the activity itself has the full detail
    assert.equal(a.series.length + a.splits.length, 0);
    const full = await repo.getActivity(a.id);
    assert.ok(full?.splits.length && full.series.length);
  });
});

describe('import — what a file cannot do', () => {
  it('a file dated in the future completes nothing', async () => {
    const { repo, profile, session } = await setup();
    mock.timers.reset();
    const out = await importActivity(repo, profile, toFit(runOn(addDays(toISODate(new Date()), 9))));
    assert.equal(out.status, 'unmatched');
    assert.notEqual((await repo.getScheduled(session.id))?.status, 'completed');
  });

  it('a second file on a day already completed by another does not take the session over', async () => {
    const { repo, profile, session } = await setup();
    const first = await importActivity(repo, profile, toFit(runOn(session.date)));
    assert.equal(first.status, 'matched');
    const evening = await importActivity(repo, profile, toFit(runOn(session.date, 3, '18:30:00Z')));
    assert.equal(evening.status, 'unmatched');
    // and deleting the evening file leaves the morning's log alone
    const out = await removeActivity(repo, DEMO_ATHLETE_ID, evening.activity.id);
    assert.equal(out.unlogged, false);
    assert.equal((await repo.getScheduled(session.id))?.status, 'completed');
  });
});

describe('import — an interrupted import finishes on retry', () => {
  it('the same file again links the session the first attempt never reached', async () => {
    const { repo, profile, session } = await setup();
    const bytes = toFit(runOn(session.date));
    // as if the first attempt stopped right after saving the activity
    const realList = repo.listScheduled.bind(repo);
    repo.listScheduled = async () => {
      throw new Error('timed out');
    };
    await assert.rejects(importActivity(repo, profile, bytes));
    repo.listScheduled = realList;
    assert.notEqual((await repo.getScheduled(session.id))?.status, 'completed');

    const retry = await importActivity(repo, profile, bytes);
    assert.equal(retry.status, 'matched');
    assert.equal((await repo.getScheduled(session.id))?.status, 'completed');
    assert.equal((await repo.listActivitiesOn(DEMO_ATHLETE_ID, session.date, session.date)).length, 1, 'still one activity');
  });

  it('a finished duplicate is still only a duplicate', async () => {
    const { repo, profile, session } = await setup();
    const bytes = toFit(runOn(session.date));
    await importActivity(repo, profile, bytes);
    assert.equal((await importActivity(repo, profile, bytes)).status, 'duplicate');
  });
});

