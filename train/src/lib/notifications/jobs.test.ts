import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEMO_COACH_ID } from '@/data/demo-seed';
import { getServiceRepo } from '@/lib/data';
import { resetDemoData } from '@/lib/data/demo-repo.ts';
import { startOfWeek, toISODate } from '@/lib/domain/dates';
import { DEFAULT_PREFERENCES } from '@/lib/domain/notifications';
import { runCoachAlerts, runCoachDigest, runDeliveries } from './jobs.ts';
import type { CheckInScores } from '@/lib/domain/types';

/**
 * The three jobs, end to end, against the demo adapter.
 *
 * These exist because the previous version of this product had a `coach-alerts`
 * cron job that decided for itself what needed attention, and nothing ever
 * checked that its answer matched the coach's screen. Every assertion here runs
 * the real job function.
 */

const today = toISODate(new Date());
const weekStart = startOfWeek(today);

/** 7:30am in Dublin, expressed as the instant the job would actually run. */
const morning = (hourUTC = 6) =>
  new Date(`${today}T${String(hourUTC).padStart(2, '0')}:30:00Z`);

const scores = (over: Partial<CheckInScores> = {}): CheckInScores => ({
  fatigue: 4, sleep: 7, soreness: 3, stress: 4,
  motivation: 7, confidence: 7, trainingDifficulty: 5, ...over,
});

/** Put a real, alert-worthy report on the roster the way an athlete would. */
async function reportSevereNiggle(athleteId: string, words: string) {
  const { repo } = await getServiceRepo();
  await repo.submitCheckIn({
    athleteId,
    weekStart,
    scores: scores({ soreness: 9, fatigue: 8 }),
    wentWell: '', feltDifficult: '', painOrNiggles: words,
    affectingTraining: '', confidenceNextWeek: '', forCoach: '',
    attentionLevel: 'attention',
    attentionReasons: ['soreness high'],
    reviewedByCoachAt: null,
    coachResponse: null,
  });
}

async function quietPrefs(over = {}) {
  const { repo } = await getServiceRepo();
  await repo.saveNotificationPreferences({
    userId: DEMO_COACH_ID, ...DEFAULT_PREFERENCES,
    timezone: 'UTC', digestHour: 6, quietFrom: null, quietUntil: null, ...over,
  });
}

beforeEach(() => resetDemoData());

describe('the alert job', () => {
  it('interrupts a coach about a niggle the athlete scored high', async () => {
    await quietPrefs();
    const { repo } = await getServiceRepo();
    const [athlete] = await repo.listRoster(DEMO_COACH_ID, today);
    await reportSevereNiggle(athlete.athleteId, 'Sharp pain in my left Achilles on hills');

    const report = await runCoachAlerts(morning());
    assert.ok(report.created > 0, 'the coach is told');

    const feed = await repo.listNotificationFeed(DEMO_COACH_ID);
    const alert = feed.find((n) => n.athleteId === athlete.athleteId);
    assert.ok(alert, 'and it is in their feed');
    assert.equal(feed.filter((n) => n.athleteId === athlete.athleteId).length, 1,
      'one buzz per athlete, not one per signal from the same check-in');
    assert.equal(alert.athleteName, athlete.fullName);
    assert.match(alert.body, /Sharp pain in my left Achilles on hills/,
      'their exact words, carried through');
    assert.doesNotMatch(alert.body, /injur|tendinopath|rest for|stop running/i,
      'and nothing that reads like a diagnosis');
  });

  it('does not interrupt a coach twice about the same report', async () => {
    await quietPrefs();
    const { repo } = await getServiceRepo();
    const [athlete] = await repo.listRoster(DEMO_COACH_ID, today);
    await reportSevereNiggle(athlete.athleteId, 'Left Achilles again');

    const first = await runCoachAlerts(morning());
    const second = await runCoachAlerts(morning(7));

    assert.ok(first.created > 0);
    assert.equal(second.created, 0, 'nothing new');
    assert.ok(second.suppressed > 0, 'and it says why rather than failing');
  });

  it('says nothing at all on a quiet morning', async () => {
    await quietPrefs();
    const report = await runCoachAlerts(morning());
    assert.equal(report.created, 0);
    assert.equal(report.items.length, 0, 'a run that sends nothing is the normal case');
  });

  it('obeys a coach who turned that alert off', async () => {
    await quietPrefs({ alertReportedPain: false });
    const { repo } = await getServiceRepo();
    const [athlete] = await repo.listRoster(DEMO_COACH_ID, today);
    await reportSevereNiggle(athlete.athleteId, 'Calf again');

    // the same check-in also flags for review, and that switch is still on —
    // so the assertion is about this signal, not about silence in general
    const report = await runCoachAlerts(morning());
    assert.ok(!report.items.some((i) => i.title.includes('reported a niggle')),
      'their settings are not advisory');
    assert.ok(report.items.some((i) => i.title.includes('check-in flagged')),
      'and turning one off does not turn the other off');
  });

  it('holds an alert raised inside quiet hours until quiet hours end', async () => {
    await quietPrefs({ quietFrom: 22, quietUntil: 7 });
    const { repo } = await getServiceRepo();
    const [athlete] = await repo.listRoster(DEMO_COACH_ID, today);
    await reportSevereNiggle(athlete.athleteId, 'Woke up sore');

    const report = await runCoachAlerts(new Date(`${today}T23:15:00Z`));
    assert.ok(report.held > 0, 'written now, delivered later');
    assert.equal(report.created, 0, 'nothing goes out at quarter past eleven');
    assert.ok(report.items.every((i) => i.outcome === 'held'));

    // and the delivery worker leaves it alone in the meantime
    assert.equal((await repo.listPendingDeliveries()).length, 0);
    const [item] = await repo.listNotificationFeed(DEMO_COACH_ID);
    assert.ok(item, 'the coach can still see it if they open the app themselves');
  });
});

describe('the digest job', () => {
  it('sends once, at the coach\'s own hour', async () => {
    await quietPrefs({ digestHour: 6 });
    const early = await runCoachDigest(new Date(`${today}T04:30:00Z`));
    assert.equal(early.processed, 0, 'not yet');

    const due = await runCoachDigest(morning());
    assert.equal(due.created, 1);

    const again = await runCoachDigest(new Date(`${today}T09:30:00Z`));
    assert.equal(again.processed, 0, 'the hour rolling round does not send it twice');
  });

  it('summarises without naming a diagnosis or a score', async () => {
    await quietPrefs();
    const { repo } = await getServiceRepo();
    await runCoachDigest(morning());

    const [digest] = await repo.listNotificationFeed(DEMO_COACH_ID);
    assert.equal(digest.kind, 'digest');
    assert.equal(digest.athleteId, null, 'a digest is about the squad, not one person');
    assert.doesNotMatch(digest.body, /risk|readiness|score/i);
  });

  it('respects a coach who turned the digest off', async () => {
    await quietPrefs({ digestEnabled: false });
    const report = await runCoachDigest(morning());
    assert.equal(report.processed, 0);
    assert.equal(report.created, 0);
  });
});

describe('the delivery job', () => {
  it('delivers in-app and records that it did', async () => {
    await quietPrefs({ channels: ['in_app'] });
    const { repo } = await getServiceRepo();
    await runCoachDigest(morning());

    const report = await runDeliveries();
    assert.equal(report.processed, 1);
    assert.equal(report.items[0].outcome, 'delivered');

    const [item] = await repo.listNotificationFeed(DEMO_COACH_ID);
    assert.equal(item.deliveries[0].state, 'delivered');
  });

  it('emails by default, without the coach having to opt in', async () => {
    // the objective of the whole slice: a coach who is not logged in still
    // finds out. Requiring them to log in and opt into that would be circular.
    await quietPrefs();
    await runCoachDigest(morning());

    const report = await runDeliveries();
    assert.ok(report.items.some((i) => i.kind === 'email'),
      JSON.stringify(report.items.map((i) => i.kind)));
  });

  it('simulates email in demo mode and says so, never claiming delivery', async () => {
    // demo mode has to show a coach where email would appear. What it must
    // never do is imply one was sent.
    await quietPrefs({ channels: ['in_app', 'email'] });
    await runCoachDigest(morning());

    const report = await runDeliveries();
    const email = report.items.find((i) => i.kind === 'email');
    assert.ok(email);
    assert.equal(email.outcome, 'sent', 'handed off, not delivered');
    assert.notEqual(email.outcome, 'delivered');
    assert.match(email.detail ?? '', /DEMO/);
    assert.match(email.detail ?? '', /simulated/i);
    assert.match(email.detail ?? '', /demo_/, 'and the message id cannot pass for a real one');
  });

  it('does not re-deliver what it already delivered', async () => {
    await quietPrefs();
    await runCoachDigest(morning());
    await runDeliveries();

    const second = await runDeliveries();
    assert.equal(second.processed, 0);
  });
});
