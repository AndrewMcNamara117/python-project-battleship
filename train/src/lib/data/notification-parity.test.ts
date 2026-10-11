import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEMO_COACH_ID } from '@/data/demo-seed';
import { DemoRepo, resetDemoData } from './demo-repo.ts';
import {
  alertsFor,
  composeDigest,
  DEFAULT_PREFERENCES,
  digestDraft,
} from '@/lib/domain/notifications';
import { toISODate } from '@/lib/domain/dates';
import { MAX_ATTEMPTS } from '@/lib/domain/retry';
import type { NotificationDraft, NotificationPreferences } from '@/lib/domain/notifications';

/**
 * The demo notification store must behave the way Postgres does, because a
 * coach exploring the product without a database should not be shown behaviour
 * they will not get with one. The Postgres side is
 * supabase/test/notifications.test.mjs; these are the same claims, asserted
 * against the in-memory adapter.
 */

const today = toISODate(new Date());

function prefsFor(userId: string, over: Partial<NotificationPreferences> = {}): NotificationPreferences {
  return { userId, ...DEFAULT_PREFERENCES, ...over };
}

function draft(over: Partial<NotificationDraft> = {}): NotificationDraft {
  return {
    userId: DEMO_COACH_ID,
    kind: 'digest',
    priority: 'information',
    athleteId: null,
    signalKind: null,
    title: 'Your morning',
    body: '2 athletes need a look.',
    href: '/coach',
    dedupeKey: `digest:${DEMO_COACH_ID}:${today}`,
    deliverAfter: null,
    payload: null,
    channels: ['in_app'],
    ...over,
  };
}

beforeEach(() => resetDemoData());

describe('demo notifications — parity', () => {
  it('gives a coach who has never opened settings a working default', async () => {
    const repo = new DemoRepo();
    const prefs = await repo.getNotificationPreferences(DEMO_COACH_ID);

    assert.equal(prefs.userId, DEMO_COACH_ID);
    assert.equal(prefs.digestEnabled, true);
    assert.equal(prefs.timezone, 'Europe/Dublin');
    assert.deepEqual(prefs.channels, ['in_app', 'email'],
      'email is on by default: a coach who must log in to opt into being told '
      + 'is the coach an external channel would never reach');
  });

  it('round-trips preferences', async () => {
    const repo = new DemoRepo();
    await repo.saveNotificationPreferences(
      prefsFor(DEMO_COACH_ID, { digestHour: 5, quietFrom: null, quietUntil: null, alertReportedPain: false }));

    const prefs = await repo.getNotificationPreferences(DEMO_COACH_ID);
    assert.equal(prefs.digestHour, 5);
    assert.equal(prefs.quietFrom, null);
    assert.equal(prefs.alertReportedPain, false);
    assert.equal(prefs.alertFlaggedCheckIn, true, 'the other switch is untouched');
  });

  it('says the same thing once', async () => {
    const repo = new DemoRepo();
    const first = await repo.createNotification(draft());
    const second = await repo.createNotification(draft({ title: 'Reworded, same news' }));

    assert.ok(first, 'the first is written');
    assert.equal(second, null, 'the second is suppressed, not an error');
    assert.equal((await repo.listNotificationFeed(DEMO_COACH_ID)).length, 1);
  });

  it('refuses to tell a coach about someone they do not coach', async () => {
    const repo = new DemoRepo();
    await assert.rejects(
      () => repo.createNotification(draft({
        kind: 'alert', athleteId: 'not-mine', dedupeKey: 'x:1', signalKind: 'checkin_flagged',
      })),
      /roster/i);
  });

  it('shows one coach nothing of another coach\'s feed', async () => {
    const repo = new DemoRepo();
    await repo.createNotification(draft());

    assert.equal((await repo.listNotificationFeed(DEMO_COACH_ID)).length, 1);
    assert.equal((await repo.listNotificationFeed('some-other-coach')).length, 0);
  });

  it('hides dismissed notifications and keeps read ones', async () => {
    const repo = new DemoRepo();
    const a = await repo.createNotification(draft());
    const b = await repo.createNotification(draft({ dedupeKey: 'digest:other', title: 'Second' }));

    await repo.setNotificationState(a!, 'read');
    await repo.setNotificationState(b!, 'dismissed');

    const feed = await repo.listNotificationFeed(DEMO_COACH_ID);
    assert.equal(feed.length, 1);
    assert.equal(feed[0].state, 'read');
  });

  it('queues one delivery per channel the notification names', async () => {
    const repo = new DemoRepo();
    await repo.createNotification(draft({ channels: ['in_app', 'email'] }));

    const pending = await repo.listPendingDeliveries();
    assert.deepEqual(pending.map((p) => p.channel).sort(), ['email', 'in_app']);
  });

  it('queues nothing for a channel the notification does not name', async () => {
    // the job narrows the coach's preference to what this deployment can
    // attempt, so a delivery that could only ever record itself unavailable
    // is never created in the first place
    const repo = new DemoRepo();
    await repo.createNotification(draft({ channels: ['in_app'] }));

    const pending = await repo.listPendingDeliveries();
    assert.deepEqual(pending.map((p) => p.channel), ['in_app']);
  });

  it('holds a delivery until quiet hours end, then releases it', async () => {
    const repo = new DemoRepo();
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const past = new Date(Date.now() - 60 * 1000).toISOString();

    await repo.createNotification(draft({ deliverAfter: future }));
    assert.equal((await repo.listPendingDeliveries()).length, 0, 'held');

    await repo.createNotification(draft({ dedupeKey: 'later', deliverAfter: past }));
    assert.equal((await repo.listPendingDeliveries()).length, 1, 'released');
  });

  it('stops retrying a channel that has failed three times', async () => {
    const repo = new DemoRepo();
    await repo.createNotification(draft());

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const [pending] = await repo.listPendingDeliveries();
      assert.ok(pending, `attempt ${attempt} is still offered`);
      await repo.recordAttempt(pending.deliveryId, {
        state: 'failed', detail: `attempt ${attempt} failed`, nextAttemptAt: null,
      });
    }
    assert.equal((await repo.listPendingDeliveries()).length, 0, 'given up, with a reason on the record');

    const [item] = await repo.listNotificationFeed(DEMO_COACH_ID);
    assert.match(item.deliveries[0].detail!, /attempt 4 failed/, 'and the last reason survives');
  });

  it('records a delivery outcome and its reason', async () => {
    const repo = new DemoRepo();
    await repo.createNotification(draft());
    const [pending] = await repo.listPendingDeliveries();

    await repo.recordAttempt(pending.deliveryId, {
      state: 'unavailable', detail: 'email is not configured in this environment.',
    });
    const [item] = await repo.listNotificationFeed(DEMO_COACH_ID);

    assert.equal(item.deliveries[0].state, 'unavailable');
    assert.match(item.deliveries[0].detail!, /not configured/);
  });

  it('remembers the last digest date per coach', async () => {
    const repo = new DemoRepo();
    assert.equal(await repo.lastDigestDate(DEMO_COACH_ID), null);

    await repo.markDigestSent(DEMO_COACH_ID, today);
    assert.equal(await repo.lastDigestDate(DEMO_COACH_ID), today);
    assert.equal(await repo.lastDigestDate('another-coach'), null);
  });

  it('lists coaches, not athletes, for the digest', async () => {
    const repo = new DemoRepo();
    const coaches = await repo.listCoachesForDigest();
    const athletes = await repo.listAthletesForCoach(DEMO_COACH_ID);

    assert.ok(coaches.some((c) => c.userId === DEMO_COACH_ID));
    for (const athlete of athletes) {
      assert.ok(!coaches.some((c) => c.userId === athlete.id), `${athlete.id} is not a coach`);
    }
  });

  it('writes what the domain decided, unchanged', async () => {
    const repo = new DemoRepo();
    const roster = await repo.listRoster(DEMO_COACH_ID, today);
    const prefs = prefsFor(DEMO_COACH_ID, { quietFrom: null, quietUntil: null });

    // the decision is made in the domain, from roster signals only; the
    // adapter's job is storage, and it must not editorialise
    const decided = alertsFor(roster, prefs, new Date());
    for (const d of decided) await repo.createNotification(d);

    const feed = await repo.listNotificationFeed(DEMO_COACH_ID);
    assert.equal(feed.length, decided.length);
    for (const d of decided) {
      const stored = feed.find((f) => f.title === d.title && f.athleteId === d.athleteId);
      assert.ok(stored, `${d.title} was stored`);
      assert.equal(stored.body, d.body);
      assert.equal(stored.href, d.href);
      assert.equal(stored.priority, d.priority);
      assert.equal(stored.signalKind, d.signalKind);
    }
  });

  it('names the athlete on the notification it stored', async () => {
    const repo = new DemoRepo();
    const roster = await repo.listRoster(DEMO_COACH_ID, today);
    const [athlete] = roster;

    await repo.createNotification(draft({
      kind: 'alert', priority: 'urgent', athleteId: athlete.athleteId,
      signalKind: 'checkin_flagged', dedupeKey: 'named:1',
    }));

    const [item] = await repo.listNotificationFeed(DEMO_COACH_ID);
    assert.equal(item.athleteName, athlete.fullName);
  });

  it('sends no digest at all when nothing needs a coach', async () => {
    const digest = composeDigest([], today);
    assert.equal(digestDraft(digest, prefsFor(DEMO_COACH_ID)), null);
  });

  it('holds a delivery back until its backoff has passed', async () => {
    const repo = new DemoRepo();
    await repo.createNotification(draft());
    const [first] = await repo.listPendingDeliveries();

    const soon = new Date(Date.now() + 5 * 60_000).toISOString();
    await repo.recordAttempt(first.deliveryId, {
      state: 'failed', detail: 'provider timed out', nextAttemptAt: soon,
    });

    assert.equal((await repo.listPendingDeliveries()).length, 0, 'not yet');
    assert.equal((await repo.listPendingDeliveries(100,
      new Date(Date.now() + 6 * 60_000).toISOString())).length, 1, 'once the backoff passes');
  });

  it('keeps a provider message id when a later attempt fails', async () => {
    const repo = new DemoRepo();
    await repo.createNotification(draft());
    const [pending] = await repo.listPendingDeliveries();

    await repo.recordAttempt(pending.deliveryId, {
      state: 'failed', detail: 'accepted, then something went wrong',
      provider: 'resend', providerMessageId: 'msg_1', nextAttemptAt: null,
    });
    await repo.recordAttempt(pending.deliveryId, {
      state: 'failed', detail: 'timed out', provider: 'resend', nextAttemptAt: null,
    });

    assert.equal(await repo.recordProviderStatus('msg_1', 'bounced'), true,
      'the webhook can still find it');
  });

  it('lets a webhook move sent to delivered, once', async () => {
    const repo = new DemoRepo();
    await repo.createNotification(draft());
    const [pending] = await repo.listPendingDeliveries();
    await repo.recordAttempt(pending.deliveryId, {
      state: 'sent', detail: 'Accepted.', provider: 'resend', providerMessageId: 'msg_2',
    });

    assert.equal(await repo.recordProviderStatus('msg_2', 'delivered'), true);
    assert.equal(await repo.recordProviderStatus('msg_2', 'delivered'), false, 'a duplicate changes nothing');
    assert.equal(await repo.recordProviderStatus('msg_2', 'bounced'), false, 'and a late bounce cannot undo it');

    const [item] = await repo.listNotificationFeed(DEMO_COACH_ID);
    assert.equal(item.deliveries[0].state, 'delivered');
  });

  it('ignores a webhook for a message it never sent', async () => {
    const repo = new DemoRepo();
    assert.equal(await repo.recordProviderStatus('not-ours', 'delivered'), false);
  });
});
