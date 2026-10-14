import type { IronMilesRepo } from '@/lib/data/repo';
import { addDays } from '@/lib/domain/dates';
import type { CompletedWorkout, Profile, ScheduledWorkout } from '@/lib/domain/types';
import { buildActivity, decodeFile, fingerprint } from './import';
import { matchSession, sportFits } from './match';
import type { Activity } from './types';

/**
 * Importing an activity against the plan.
 *
 * The order is deliberate. The activity is stored first, so a failure later
 * never loses the file's numbers; then it is matched; then — only when the
 * match is unambiguous — it completes the session. A hand-typed log is
 * never overwritten: the file only fills in what the athlete left blank.
 */

export type ImportOutcome =
  | { status: 'matched'; activity: Activity; session: ScheduledWorkout }
  | { status: 'enriched'; activity: Activity; session: ScheduledWorkout }
  | { status: 'ambiguous'; activity: Activity; options: ScheduledWorkout[] }
  | { status: 'unmatched'; activity: Activity; reason: string }
  | { status: 'duplicate'; activity: Activity };

/** Two uploads starting this close together are the same run exported twice. */
const SAME_RUN_WINDOW_MS = 2 * 60 * 1000;

const km = (m: number) => Math.round(m / 10) / 100;
const minutes = (s: number) => Math.max(1, Math.round(s / 60));

/** What the log says, from the file. */
function logFields(activity: Activity) {
  return {
    actualDistanceKm: activity.distanceM > 0 ? km(activity.distanceM) : null,
    actualDurationMinutes: activity.movingS > 0 ? minutes(activity.movingS) : null,
    averagePaceSecPerKm: activity.avgPaceSecPerKm,
    averageHeartRate: activity.avgHr,
    maxHeartRate: activity.maxHr,
  };
}

/** Complete a session from an activity, or fill the gaps in its existing log. */
async function completeFrom(
  repo: IronMilesRepo,
  activity: Activity,
  session: ScheduledWorkout,
): Promise<{ completed: CompletedWorkout; enriched: boolean }> {
  const existing = (await repo.listCompleted(activity.athleteId, session.date, session.date)).find(
    (c) => c.scheduledWorkoutId === session.id,
  );
  const fromFile = logFields(activity);

  const completed = existing
    ? await repo.logWorkout({
        ...existing,
        actualDistanceKm: existing.actualDistanceKm ?? fromFile.actualDistanceKm,
        actualDurationMinutes: existing.actualDurationMinutes ?? fromFile.actualDurationMinutes,
        averagePaceSecPerKm: existing.averagePaceSecPerKm ?? fromFile.averagePaceSecPerKm,
        averageHeartRate: existing.averageHeartRate ?? fromFile.averageHeartRate,
        maxHeartRate: existing.maxHeartRate ?? fromFile.maxHeartRate,
      })
    : await repo.logWorkout({
        scheduledWorkoutId: session.id,
        athleteId: activity.athleteId,
        date: session.date,
        type: session.type,
        ...fromFile,
        rpe: null,
        sessionRating: null,
        soreness: null,
        athleteNotes: null,
        source: 'upload',
      });

  await repo.linkActivity(activity.id, { scheduledWorkoutId: session.id, completedWorkoutId: completed.id });
  return { completed, enriched: Boolean(existing) };
}

export async function importActivity(
  repo: IronMilesRepo,
  profile: Profile,
  bytes: Uint8Array,
): Promise<ImportOutcome> {
  const parsed = decodeFile(bytes);
  const { draft } = buildActivity(parsed, fingerprint(bytes), {
    athleteId: profile.id,
    timeZone: profile.timezone,
    privacyTrimM: profile.privacyTrimM,
    units: profile.units,
  });
  // the athlete's standing choice; off unless they turned it on
  draft.visibility = profile.shareActivitiesDefault ? 'club' : 'coach';

  // the same run exported twice in different formats has different bytes
  const nearby = await repo.listActivitiesOn(profile.id, addDays(draft.localDate, -1), addDays(draft.localDate, 1));
  const sameRun = nearby.find((a) => Math.abs(Date.parse(a.startedAt) - Date.parse(draft.startedAt)) < SAME_RUN_WINDOW_MS);
  if (sameRun) return { status: 'duplicate', activity: sameRun };

  const { activity, duplicate } = await repo.saveActivity(draft);
  if (duplicate) return { status: 'duplicate', activity };

  const sessions = await repo.listScheduled(profile.id, draft.localDate, draft.localDate);
  const match = matchSession(sessions, draft.localDate, draft.sport);

  if (match.kind === 'matched' || match.kind === 'logged') {
    const session = sessions.find((s) => s.id === match.scheduledId) as ScheduledWorkout;
    const { completed, enriched } = await completeFrom(repo, activity, session);
    const linked = { ...activity, scheduledWorkoutId: session.id, completedWorkoutId: completed.id };
    return enriched ? { status: 'enriched', activity: linked, session } : { status: 'matched', activity: linked, session };
  }
  if (match.kind === 'ambiguous') {
    return { status: 'ambiguous', activity, options: sessions.filter((s) => match.candidateIds.includes(s.id)) };
  }
  return { status: 'unmatched', activity, reason: match.reason };
}

/** Sessions an unattached activity could still be attached to: that day, the day either side. */
export async function attachOptions(repo: IronMilesRepo, activity: Activity): Promise<ScheduledWorkout[]> {
  const sessions = await repo.listScheduled(activity.athleteId, addDays(activity.localDate, -1), addDays(activity.localDate, 1));
  const linkedElsewhere = new Set(
    (await repo.listActivitiesOn(activity.athleteId, addDays(activity.localDate, -1), addDays(activity.localDate, 1)))
      .filter((a) => a.id !== activity.id && a.scheduledWorkoutId)
      .map((a) => a.scheduledWorkoutId),
  );
  return sessions.filter(
    (s) =>
      s.type !== 'rest' &&
      s.type !== 'strength' &&
      s.type !== 'mobility' &&
      sportFits(activity.sport, s.type) &&
      !linkedElsewhere.has(s.id),
  );
}

export type AttachError = 'not_found' | 'not_yours' | 'not_an_option' | 'already_attached';

/** The athlete picks which session an activity was. */
export async function attachActivity(
  repo: IronMilesRepo,
  athleteId: string,
  activityId: string,
  scheduledId: string,
): Promise<{ ok: true; session: ScheduledWorkout } | { ok: false; error: AttachError }> {
  const activity = await repo.getActivity(activityId);
  if (!activity) return { ok: false, error: 'not_found' };
  if (activity.athleteId !== athleteId) return { ok: false, error: 'not_yours' };
  if (activity.scheduledWorkoutId) return { ok: false, error: 'already_attached' };

  const options = await attachOptions(repo, activity);
  const session = options.find((s) => s.id === scheduledId);
  if (!session) return { ok: false, error: 'not_an_option' };

  await completeFrom(repo, activity, session);
  return { ok: true, session };
}

/**
 * Delete an activity. If its import created the log (rather than enriching
 * one the athlete typed), the log goes too and the session returns to the
 * plan — deleting the wrong file must not leave a run that never happened.
 */
export async function removeActivity(
  repo: IronMilesRepo,
  athleteId: string,
  activityId: string,
): Promise<{ ok: boolean; unlogged: boolean }> {
  const activity = await repo.getActivity(activityId);
  if (!activity || activity.athleteId !== athleteId) return { ok: false, unlogged: false };

  let unlogged = false;
  if (activity.completedWorkoutId && activity.scheduledWorkoutId) {
    const log = (await repo.listCompleted(athleteId, addDays(activity.localDate, -1), addDays(activity.localDate, 1))).find(
      (c) => c.id === activity.completedWorkoutId,
    );
    if (log && log.source === 'upload') {
      await repo.unlogWorkout(log.id);
      unlogged = true;
    }
  }
  await repo.deleteActivity(activityId);
  return { ok: true, unlogged };
}
