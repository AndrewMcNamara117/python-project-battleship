import 'server-only';
import { getServiceRepo } from '@/lib/data';
import {
  alertsFor,
  composeDigest,
  digestDraft,
  digestDue,
  localParts,
} from '@/lib/domain/notifications';
import { channelFor } from './channels';
import type { IronMilesRepo } from '@/lib/data/repo';
import type { NotificationDraft } from '@/lib/domain/notifications';

/**
 * THE THREE JOBS
 *
 * Deliberately three, and deliberately separate:
 *
 *   1. `coach-alerts`   — signals urgent enough to interrupt someone
 *   2. `coach-digest`   — everything else, once a day, in their own morning
 *   3. `notification-delivery` — actually getting it out of the database
 *
 * None of them decides what a signal *is*. They ask the roster, and the roster
 * is the same code the coach's screen renders from. If "missed repeated"
 * changes meaning, it changes here for free — which is the whole point. The
 * alternative, a second copy of the rules living in a cron job, is how a
 * product ends up emailing a coach about an athlete whose row is green.
 *
 * Nothing here composes a notification from an LLM, and nothing here decides
 * an athlete is injured. A signal says what happened; the coach reads it.
 */

export interface NotificationJobReport {
  job: string;
  ranAt: string;
  /** True when there is no database to write to — the logic still runs. */
  dryRun: boolean;
  /** Coaches (or deliveries) considered. */
  processed: number;
  /** Notifications actually written. */
  created: number;
  /** Decided, then found already told. Not a failure — the dedupe working. */
  suppressed: number;
  /** Written, but not to be delivered until quiet hours end. */
  held: number;
  /** Per-item detail, so a run can be read rather than trusted. */
  items: {
    userId: string;
    kind: string;
    title: string;
    outcome: 'created' | 'suppressed' | 'held' | 'delivered' | 'failed' | 'unavailable';
    detail?: string;
  }[];
}

function emptyReport(job: string, dryRun: boolean): NotificationJobReport {
  return {
    job,
    ranAt: new Date().toISOString(),
    dryRun,
    processed: 0,
    created: 0,
    suppressed: 0,
    held: 0,
    items: [],
  };
}

/** Write one decided notification and record what became of it. */
async function record(
  repo: IronMilesRepo,
  draft: NotificationDraft,
  report: NotificationJobReport,
): Promise<string | null> {
  const id = await repo.createNotification(draft);

  if (id === null) {
    // the coach has already been told this exact thing; saying it twice is
    // how a notification system trains someone to ignore it
    report.suppressed += 1;
    report.items.push({ userId: draft.userId, kind: draft.kind, title: draft.title, outcome: 'suppressed' });
    return null;
  }

  const held = Boolean(draft.deliverAfter);
  if (held) report.held += 1;
  else report.created += 1;

  report.items.push({
    userId: draft.userId,
    kind: draft.kind,
    title: draft.title,
    outcome: held ? 'held' : 'created',
    detail: held ? `Held until ${draft.deliverAfter}.` : undefined,
  });
  return id;
}


/* ============================================================
 * 1. ALERTS
 *
 * Runs often — every fifteen minutes is reasonable. Almost every run does
 * nothing, which is correct behaviour, not a wasted run.
 * ========================================================== */

export async function runCoachAlerts(now = new Date()): Promise<NotificationJobReport> {
  const { repo, dryRun } = await getServiceRepo();
  const report = emptyReport('coach-alerts', dryRun);

  for (const coach of await repo.listCoachesForDigest()) {
    const prefs = await repo.getNotificationPreferences(coach.userId);

    // the roster is asked in the coach's own today, not the server's
    const today = localParts(now, prefs.timezone).date;
    const roster = await repo.listRoster(coach.userId, today);
    report.processed += 1;

    for (const draft of alertsFor(roster, prefs, now)) {
      await record(repo, draft, report);
    }
  }

  return report;
}


/* ============================================================
 * 2. DIGEST
 *
 * Runs hourly. Each coach receives it at their own local hour, once per their
 * own local date — so a coach in Limerick and a coach in Sydney both get a
 * morning digest, and the clocks changing does not give anyone two or none.
 * ========================================================== */

export async function runCoachDigest(now = new Date()): Promise<NotificationJobReport> {
  const { repo, dryRun } = await getServiceRepo();
  const report = emptyReport('coach-digest', dryRun);

  for (const coach of await repo.listCoachesForDigest()) {
    const prefs = await repo.getNotificationPreferences(coach.userId);
    const last = await repo.lastDigestDate(coach.userId);

    if (!digestDue(prefs, now, last)) continue;
    report.processed += 1;

    const local = localParts(now, prefs.timezone);
    const roster = await repo.listRoster(coach.userId, local.date);
    const digest = composeDigest(roster, local.date);
    const draft = digestDraft(digest, prefs);

    // a digest with nothing in it is not sent. Silence on a quiet morning is
    // information; "0 athletes need attention" every day for a week is noise,
    // and the coach stops opening it before the week it matters
    if (!draft) {
      // still marked, or the hour rolls round again and again all day
      await repo.markDigestSent(coach.userId, local.date);
      report.items.push({
        userId: coach.userId, kind: 'digest', title: 'Nothing to report',
        outcome: 'suppressed', detail: 'No athlete needed attention.',
      });
      continue;
    }

    await record(repo, draft, report);
    await repo.markDigestSent(coach.userId, local.date);
  }

  return report;
}


/* ============================================================
 * 3. DELIVERY
 *
 * The only place that claims anything left the building — and it only claims
 * it because a channel said so. A notification row is not a delivery.
 * ========================================================== */

export async function runDeliveries(limit = 100): Promise<NotificationJobReport> {
  const { repo, dryRun } = await getServiceRepo();
  const report = emptyReport('notification-delivery', dryRun);

  for (const pending of await repo.listPendingDeliveries(limit)) {
    report.processed += 1;
    const channel = channelFor(pending.channel);

    if (!channel || !channel.available()) {
      // an unconfigured channel has not failed. Recording it as 'unavailable'
      // is the difference between "we could not reach you" and "we never had
      // any way to" — and the coach's settings screen shows which
      const detail = channel
        ? `${pending.channel} is not configured in this environment.`
        : `Unknown channel ${pending.channel}.`;
      await repo.recordDelivery(pending.deliveryId, 'unavailable', detail);
      report.items.push({
        userId: pending.userId, kind: pending.channel,
        title: pending.draft.title, outcome: 'unavailable', detail,
      });
      continue;
    }

    const outcome = await channel.send({
      draft: pending.draft,
      recipientEmail: pending.recipientEmail,
      athleteName: pending.athleteName,
    });

    await repo.recordDelivery(pending.deliveryId, outcome.state, outcome.detail);
    if (outcome.state === 'delivered') report.created += 1;

    report.items.push({
      userId: pending.userId,
      kind: pending.channel,
      title: pending.draft.title,
      outcome: outcome.state,
      detail: outcome.detail,
    });
  }

  return report;
}
