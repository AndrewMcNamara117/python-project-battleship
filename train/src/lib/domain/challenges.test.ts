import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEMO_ATHLETE_ID, DEMO_COACH_ID } from '@/data/demo-seed';
import { DemoRepo, resetDemoData } from '@/lib/data/demo-repo';
import { addDays, toISODate } from './dates.ts';
import { canJoin, challengeState, formatAmount, progressFor } from './challenges.ts';

/** Challenges: the rules, and the demo holding to migration 0027's limits. */

beforeEach(() => resetDemoData());
const TODAY = toISODate(new Date());

describe('challenge rules', () => {
  it('states: upcoming, open, closed — and archived is closed', () => {
    const c = { startsOn: addDays(TODAY, 1), endsOn: addDays(TODAY, 30), archived: false };
    assert.equal(challengeState(c, TODAY), 'upcoming');
    assert.equal(challengeState({ ...c, startsOn: TODAY }, TODAY), 'open');
    assert.equal(challengeState({ ...c, endsOn: addDays(TODAY, -1) }, TODAY), 'closed');
    assert.equal(challengeState({ ...c, archived: true }, TODAY), 'closed');
    assert.equal(canJoin(c, TODAY), true, 'an upcoming one can be joined early');
  });

  it('counts by the same rules as 0027', () => {
    const window = { startsOn: '2026-10-01', endsOn: '2026-10-31' };
    const s = (date: string, type = 'easy_run', status = 'completed', id = `s-${date}`) => ({ id, date, type, status }) as never;
    const data = {
      scheduled: [s('2026-10-02'), s('2026-10-03', 'rest'), s('2026-10-04', 'tempo', 'missed'), s('2026-11-01'), s('2026-10-05', 'easy_run', 'scheduled'), s('2026-09-27', 'easy_run', 'scheduled')],
      completed: [{ date: '2026-10-02', actualDistanceKm: 8.25 }, { date: '2026-10-09', actualDistanceKm: 12 }] as never,
      // club runs count by the session's date: the second was logged in the
      // window but run in September, so it does not count
      forge: [
        { kind: 'community_run', date: '2026-10-05', sourceId: 's-2026-10-05' },
        { kind: 'community_run', date: '2026-10-06', sourceId: 's-2026-09-27' },
        { kind: 'run_completed', date: '2026-10-06', sourceId: 's-2026-10-02' },
      ] as never,
      // two in one week are one week; the September week is outside
      checkins: [{ weekStart: '2026-10-05' }, { weekStart: '2026-10-07' }, { weekStart: '2026-09-28' }] as never,
    };
    assert.equal(progressFor({ ...window, metric: 'sessions' }, data), 1);
    assert.equal(progressFor({ ...window, metric: 'club_runs' }, data), 1);
    assert.equal(progressFor({ ...window, metric: 'checkins' }, data), 1);
    assert.equal(progressFor({ ...window, metric: 'distance_km' }, data), 20.3);
  });

  it('says amounts like a person would', () => {
    assert.equal(formatAmount('sessions', 1), '1 session');
    assert.equal(formatAmount('sessions', 20), '20 sessions');
    assert.equal(formatAmount('distance_km', 42.2), '42.2 km');
    assert.equal(formatAmount('distance_km', 40), '40 km');
  });
});

describe('challenges — demo parity', () => {
  it('the seeded month has challenges the demo athlete is in, with their own progress', async () => {
    const repo = new DemoRepo();
    const list = await repo.listChallenges();
    assert.ok(list.length >= 3);
    const s = await repo.getChallengeSummary(DEMO_ATHLETE_ID, 'ch-sessions');
    assert.equal(s.viewerJoined, true);
    assert.ok(s.viewerProgress != null && s.viewerProgress >= 0);
  });

  it('a member who has not joined sees counts and finishers, not numbers', async () => {
    const s = await new DemoRepo().getChallengeSummary('demo-athlete-7', 'ch-sessions');
    assert.equal(s.viewerJoined, false);
    assert.equal(s.viewerProgress, null);
    assert.ok(s.participants >= 5);
  });

  it('join and leave while open; not once closed', async () => {
    const repo = new DemoRepo();
    await repo.joinChallenge('ch-club-runs', DEMO_ATHLETE_ID);
    assert.equal((await repo.getChallengeSummary(DEMO_ATHLETE_ID, 'ch-club-runs')).viewerJoined, true);
    await repo.leaveChallenge('ch-club-runs', DEMO_ATHLETE_ID);
    assert.equal((await repo.getChallengeSummary(DEMO_ATHLETE_ID, 'ch-club-runs')).viewerJoined, false);

    await repo.setChallengeArchived('ch-club-runs', true);
    await assert.rejects(repo.joinChallenge('ch-club-runs', DEMO_ATHLETE_ID));
  });

  it('only staff set one, and within the limits', async () => {
    const repo = new DemoRepo();
    const draft = { name: 'Coach set', description: '', metric: 'sessions' as const, target: 10, startsOn: TODAY, endsOn: addDays(TODAY, 30) };
    await assert.rejects(repo.createChallenge({ ...draft, createdBy: DEMO_ATHLETE_ID }));
    await assert.rejects(repo.createChallenge({ ...draft, createdBy: DEMO_COACH_ID, endsOn: addDays(TODAY, 400) }));
    await assert.rejects(repo.createChallenge({ ...draft, createdBy: DEMO_COACH_ID, endsOn: addDays(TODAY, -1) }));
    const made = await repo.createChallenge({ ...draft, createdBy: DEMO_COACH_ID });
    assert.ok((await repo.listChallenges()).some((c) => c.id === made.id));
  });

  it('a finisher is named once they reach the target', async () => {
    const repo = new DemoRepo();
    const made = await repo.createChallenge({
      name: 'One session', description: '', metric: 'sessions', target: 1,
      startsOn: addDays(TODAY, -60), endsOn: TODAY, createdBy: DEMO_COACH_ID,
    });
    await repo.joinChallenge(made.id, DEMO_ATHLETE_ID);
    const s = await repo.getChallengeSummary('demo-athlete-7', made.id);
    assert.deepEqual(s.finishers, ['Andrew']);
  });
});
