'use server';

import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { availableChannels } from '@/lib/notifications/channels';
import type { ChannelName, NotificationPreferences } from '@/lib/domain/notifications';
import type { Result } from './coach';

/**
 * Reading and clearing your own notifications, and setting how you get them.
 *
 * Every action re-reads the signed-in coach rather than trusting an id from
 * the client, so "mark as read" can only ever mean your own. Row-level
 * security enforces the same rule; these checks exist so a refusal reads as a
 * sentence instead of a silent no-op.
 */

export async function markNotification(
  id: string,
  state: 'pending' | 'read' | 'dismissed',
): Promise<Result> {
  // requireCoach throws for anyone else, and the id is only ever acted on
  // through im_notification_state, which matches it against the caller
  await requireCoach();

  const repo = await getRepo();
  await repo.setNotificationState(id, state);
  revalidatePath('/coach/notifications');
  revalidatePath('/coach');
  return { ok: true, message: state === 'dismissed' ? 'Cleared.' : 'Marked as read.' };
}

export async function markAllRead(): Promise<Result> {
  const session = await requireCoach();

  const repo = await getRepo();
  const feed = await repo.listNotificationFeed(session.userId);
  for (const item of feed.filter((i) => i.state === 'pending')) {
    await repo.setNotificationState(item.id, 'read');
  }

  revalidatePath('/coach/notifications');
  revalidatePath('/coach');
  return { ok: true, message: 'All caught up.' };
}

/** A number a coach types is never trusted to be in range. */
function hour(value: unknown, fallback: number | null): number | null {
  if (value === null || value === '' || value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 0 || n > 23) return fallback;
  return n;
}

export async function saveNotificationPreferences(form: {
  digestEnabled: boolean;
  digestHour: number;
  timezone: string;
  alertFlaggedCheckIn: boolean;
  alertReportedPain: boolean;
  quietHours: boolean;
  quietFrom: number;
  quietUntil: number;
  channels: string[];
}): Promise<Result> {
  const session = await requireCoach();

  // an unknown timezone would make every send time wrong in a way nobody
  // would notice until a digest arrived at three in the morning
  try {
    new Intl.DateTimeFormat('en-IE', { timeZone: form.timezone });
  } catch {
    return { ok: false, message: `${form.timezone} is not a timezone Iron Miles recognises.` };
  }

  // a coach cannot switch on a channel this deployment does not have; the
  // settings screen says so rather than storing a preference that will only
  // ever record itself as unavailable
  const allowed = new Set<ChannelName>(availableChannels());
  const channels = form.channels.filter((c): c is ChannelName =>
    allowed.has(c as ChannelName));

  const prefs: NotificationPreferences = {
    userId: session.userId,
    digestEnabled: form.digestEnabled,
    digestHour: hour(form.digestHour, 7) ?? 7,
    timezone: form.timezone,
    alertFlaggedCheckIn: form.alertFlaggedCheckIn,
    alertReportedPain: form.alertReportedPain,
    quietFrom: form.quietHours ? hour(form.quietFrom, 22) : null,
    quietUntil: form.quietHours ? hour(form.quietUntil, 7) : null,
    channels: channels.length ? channels : ['in_app'],
  };

  const repo = await getRepo();
  await repo.saveNotificationPreferences(prefs);
  revalidatePath('/coach/notifications');
  return { ok: true, message: 'Saved.' };
}
