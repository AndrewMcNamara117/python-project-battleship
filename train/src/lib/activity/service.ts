import type { IronMilesRepo } from '@/lib/data/repo';
import { addDays } from '@/lib/domain/dates';
import type { CompletedWorkout, Profile, ScheduledWorkout } from '@/lib/domain/types';
import { buildActivity, decodeFile, fingerprint } from './import';
import { matchSession, sportFits } from './match';
import { findEfforts, type Effort } from './segments';
import { newRecords } from './records';
import type { Activity, ActivitySource, TrackPoint } from './types';

/**
 * Importing an activity against the plan.
 *
 * The order is deliberate. The activity is stored first, so a failure later
 * never loses the file's numbers; then it is matched; then — only when the
 * match is unambiguous — it completes the session. A hand-typed log is
 * never overwritten: the file only fills in what the athlete left blank.
 */

/** A segment timed on this import, and whether it beat the athlete's previous best. */
export interface TimedSegment extends Effort {
  name: string;
  personalBest: boolean;
}

/** A distance this import set a new best at, and the time it beat. */
export interface NewRecord {
  label: string;
  elapsedS: number;
  previousS: number;
}

export type ImportOutcome = (
  | { status: 'matched'; activity: Activity; session: ScheduledWorkout }
  | { status: 'enriched'; activity: Activity; session: ScheduledWorkout }
  | { status: 'ambiguous'; activity: Activity; options: ScheduledWorkout[] }
  | { status: 'unmatched'; activity: Activity; reason: string }
) & { segments: TimedSegment[]; records: NewRecord[] } | { status: 'duplicate'; activity: Activity; segments?: undefined; records?: undefined };

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

/**
 * `effortWriter` records segment times. In production it is the service
 * repo: no user may write a time (0023 has no insert policy), so the server
 * writes the one it computed from the athlete's own file, and nothing else.
 */
export async function importActivity(
  repo: IronMilesRepo,
  profile: Profile,
  bytes: Uint8Array,
  effortWriter: IronMilesRepo | null = repo,
  /** Where the file came from: an upload, or a provider's push. */
  source: ActivitySource = 'upload',
): Promise<ImportOutcome> {
  const parsed = decodeFile(bytes);
  const { draft, analysis } = buildActivity(parsed, fingerprint(bytes), {
    source,
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

  // segments are timed now, from the full track — the only moment it exists
  const segments = await timeSegments(repo, effortWriter, activity, parsed.points, analysis.cumulative);
  // a first time at a distance is not announced; beating one is
  const records: NewRecord[] = newRecords(activity, await repo.listActivities(profile.id, Infinity))
    .filter((r) => r.previousS != null)
    .map((r) => ({ label: r.distance.label, elapsedS: r.elapsedS, previousS: r.previousS as number }));

  // a file dated after tomorrow did not happen yet, whatever it says: kept,
  // but it completes nothing on the plan
  if (aheadOfToday(draft.localDate)) {
    return { status: 'unmatched', activity, reason: 'It is dated after today, so it is not matched to your plan.', segments, records };
  }

  const sessions = await repo.listScheduled(profile.id, draft.localDate, draft.localDate);
  const match = matchSession(sessions, draft.localDate, draft.sport);
  // a second file on a day whose session another file already completed
  // (a morning run, then an evening jog) does not take that session over
  if (match.kind === 'logged' && (await linkedSessions(repo, activity)).has(match.scheduledId)) {
    return { status: 'unmatched', activity, reason: 'That day’s session already has a run on it.', segments, records };
  }

  if (match.kind === 'matched' || match.kind === 'logged') {
    const session = sessions.find((s) => s.id === match.scheduledId) as ScheduledWorkout;
    const { completed, enriched } = await completeFrom(repo, activity, session);
    const linked = { ...activity, scheduledWorkoutId: session.id, completedWorkoutId: completed.id };
    return enriched
      ? { status: 'enriched', activity: linked, session, segments, records }
      : { status: 'matched', activity: linked, session, segments, records };
  }
  if (match.kind === 'ambiguous') {
    return { status: 'ambiguous', activity, options: sessions.filter((s) => match.candidateIds.includes(s.id)), segments, records };
  }
  return { status: 'unmatched', activity, reason: match.reason, segments, records };
}

async function timeSegments(
  repo: IronMilesRepo,
  writer: IronMilesRepo | null,
  activity: Activity,
  points: TrackPoint[],
  cumulative: number[],
): Promise<TimedSegment[]> {
  // no writer (the service key is not configured): the import still succeeds, untimed
  if (!writer) return [];
  const all = await repo.listSegments();
  if (!all.length) return [];
  const found = findEfforts(points, cumulative, all, activity.sport, activity.privacyTrimM);
  if (!found.length) return [];

  const previous = await repo.listEfforts(activity.athleteId);
  await writer.saveEfforts(
    found.map((e) => ({ segmentId: e.segmentId, activityId: activity.id, athleteId: activity.athleteId, startedAt: e.startedAt, elapsedS: e.elapsedS })),
  );
  return found.map((e) => {
    const before = previous.filter((p) => p.segmentId === e.segmentId && p.activityId !== activity.id);
    return {
      ...e,
      name: all.find((s) => s.id === e.segmentId)?.name ?? 'Segment',
      // a first effort is not a "personal best" worth announcing; a beaten one is
      personalBest: before.length > 0 && before.every((p) => e.elapsedS < p.elapsedS),
    };
  });
}

const aheadOfToday = (date: string) => date > addDays(new Date().toISOString().slice(0, 10), 1);

/** Sessions that other activities, near this one's date, are already attached to. */
async function linkedSessions(repo: IronMilesRepo, activity: Activity): Promise<Set<string | null>> {
  return new Set(
    (await repo.listActivitiesOn(activity.athleteId, addDays(activity.localDate, -1), addDays(activity.localDate, 1)))
      .filter((a) => a.id !== activity.id && a.scheduledWorkoutId)
      .map((a) => a.scheduledWorkoutId),
  );
}

/** Sessions an unattached activity could still be attached to: that day, the day either side — none whose day has not come. */
export async function attachOptions(repo: IronMilesRepo, activity: Activity): Promise<ScheduledWorkout[]> {
  const sessions = await repo.listScheduled(activity.athleteId, addDays(activity.localDate, -1), addDays(activity.localDate, 1));
  const linkedElsewhere = await linkedSessions(repo, activity);
  return sessions.filter(
    (s) =>
      s.type !== 'rest' &&
      s.type !== 'strength' &&
      s.type !== 'mobility' &&
      sportFits(activity.sport, s.type) &&
      !aheadOfToday(s.date) &&
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
    // only a log this import created, untouched since, and no other file's
    const shared = (await linkedSessions(repo, activity)).has(activity.scheduledWorkoutId);
    if (log && log.source === 'upload' && !shared) {
      await repo.unlogWorkout(log.id);
      unlogged = true;
    }
  }
  await repo.deleteActivity(activityId);
  return { ok: true, unlogged };
}
