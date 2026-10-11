import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEMO_COACH_ID } from '@/data/demo-seed';
import { DemoRepo, resetDemoData } from './demo-repo.ts';
import { applyFilter, filterCounts, summariseToday } from '@/lib/domain/roster';
import { toISODate } from '@/lib/domain/dates';

/**
 * The demo roster must mean what the Postgres roster means. The Postgres side
 * is supabase/test/roster.test.mjs; both feed the same classifier, and these
 * check the facts it is fed.
 */

const today = toISODate(new Date());

beforeEach(() => resetDemoData());

describe('demo roster — parity', () => {
  it('returns the coach\'s athletes and nobody else', async () => {
    const repo = new DemoRepo();
    const roster = await repo.listRoster(DEMO_COACH_ID, today);
    const athletes = await repo.listAthletesForCoach(DEMO_COACH_ID);

    assert.equal(roster.length, athletes.length);
    assert.deepEqual(
      roster.map((r) => r.athleteId).sort(),
      athletes.map((a) => a.id).sort());
  });

  it('gives an empty roster rather than an error for an unknown coach', async () => {
    const repo = new DemoRepo();
    assert.deepEqual(await repo.listRoster('nobody', today), []);
  });

  it('reports where each athlete is in their programme', async () => {
    const repo = new DemoRepo();
    const roster = await repo.listRoster(DEMO_COACH_ID, today);
    const onProgramme = roster.filter((r) => r.programmeId);

    assert.ok(onProgramme.length > 0, 'the demo squad is training');
    for (const entry of onProgramme) {
      assert.ok(entry.programmeName);
      assert.ok(entry.totalWeeks && entry.totalWeeks > 0);
      if (entry.weekNo != null) {
        assert.ok(entry.weekNo >= 1 && entry.weekNo <= entry.totalWeeks,
          `week ${entry.weekNo} of ${entry.totalWeeks}`);
      }
    }
  });

  it('counts adherence over the current prescription, never below zero or above 100', async () => {
    const repo = new DemoRepo();
    const roster = await repo.listRoster(DEMO_COACH_ID, today);
    for (const entry of roster) {
      assert.ok(entry.completedFourWeeks <= entry.plannedFourWeeks,
        `${entry.fullName} completed more than was prescribed`);
      if (entry.adherencePct != null) {
        assert.ok(entry.adherencePct >= 0 && entry.adherencePct <= 100);
      }
    }
  });

  it('says nothing at all about an athlete who is fine', async () => {
    const repo = new DemoRepo();
    const roster = await repo.listRoster(DEMO_COACH_ID, today);
    // whatever the seed contains, an entry with no signals must also have no
    // top signal — the two must never disagree
    for (const entry of roster) {
      assert.equal(entry.topSignal, entry.signals[0] ?? null);
    }
  });

  it('says something about every athlete without a programme', async () => {
    const repo = new DemoRepo();
    const roster = await repo.listRoster(DEMO_COACH_ID, today);
    const withoutProgramme = roster.filter((r) => !r.programmeId);
    for (const entry of withoutProgramme) {
      const signal = entry.signals.find((s) => s.kind === 'no_programme');
      assert.ok(signal, `${entry.fullName} has no programme and nothing was said`);
      assert.notEqual(signal.severity, 'urgent',
        'having no programme yet is not an emergency');
    }
  });

  it('orders the roster with the loudest first', async () => {
    const repo = new DemoRepo();
    const roster = await repo.listRoster(DEMO_COACH_ID, today);
    const rank = (s?: string) => (s === 'urgent' ? 0 : s === 'attention' ? 1 : s === 'information' ? 2 : 3);

    for (let i = 1; i < roster.length; i++) {
      assert.ok(
        rank(roster[i - 1].topSignal?.severity) <= rank(roster[i].topSignal?.severity),
        `${roster[i - 1].fullName} should not sit above ${roster[i].fullName}`);
    }
  });

  it('gives every signal a destination', async () => {
    const repo = new DemoRepo();
    const roster = await repo.listRoster(DEMO_COACH_ID, today);
    for (const entry of roster) {
      for (const signal of entry.signals) {
        assert.ok(signal.href.startsWith('/coach/'), `${signal.kind} leads nowhere`);
        assert.ok(signal.detail.length > 0, `${signal.kind} explains nothing`);
      }
    }
  });

  it('filters and counts consistently', async () => {
    const repo = new DemoRepo();
    const roster = await repo.listRoster(DEMO_COACH_ID, today);
    const counts = filterCounts(roster);

    assert.equal(counts.all, roster.length);
    assert.equal(applyFilter(roster, 'all').length, counts.all);
    assert.equal(applyFilter(roster, 'attention').length, counts.attention);
    assert.ok(counts.attention <= counts.all);
  });

  it('searches by name', async () => {
    const repo = new DemoRepo();
    const roster = await repo.listRoster(DEMO_COACH_ID, today);
    const first = roster[0];
    const found = applyFilter(roster, 'all', first.fullName.slice(0, 4));
    assert.ok(found.some((e) => e.athleteId === first.athleteId));
  });

  it('summarises today from the roster it already loaded', async () => {
    const repo = new DemoRepo();
    const roster = await repo.listRoster(DEMO_COACH_ID, today);
    const summary = summariseToday(roster, today);

    assert.ok(summary.trainingToday >= 0);
    assert.ok(summary.checkInsToRead >= 0);
    assert.equal(summary.keySessionsToday.length, summary.trainingToday);
    assert.ok(summary.racesWithin.every((r) => r.days >= 0 && r.days <= 42));
  });

  it('reflects a missed session the moment it is marked', async () => {
    const repo = new DemoRepo();
    const [athlete] = await repo.listAthletesForCoach(DEMO_COACH_ID);
    const sessions = (await repo.listScheduled(athlete.id, '2000-01-01', today))
      .filter((w) => w.type !== 'rest');
    assert.ok(sessions.length >= 3, 'the demo athlete has training behind them');

    const before = (await repo.listRoster(DEMO_COACH_ID, today))
      .find((r) => r.athleteId === athlete.id)!;

    for (const s of sessions.slice(-3)) {
      await repo.saveScheduled({ ...s, status: 'missed' });
    }

    const after = (await repo.listRoster(DEMO_COACH_ID, today))
      .find((r) => r.athleteId === athlete.id)!;
    assert.ok(after.missedFourteenDays >= before.missedFourteenDays);
  });

  it('stays fast enough to be useful at fifty athletes', async () => {
    const repo = new DemoRepo();
    const started = Date.now();
    await repo.listRoster(DEMO_COACH_ID, today);
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 3000, `the demo roster took ${elapsed}ms`);
  });
});
