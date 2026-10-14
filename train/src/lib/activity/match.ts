import { isRun } from '@/lib/domain/analytics';
import type { ISODate, ScheduledWorkout, WorkoutType } from '@/lib/domain/types';
import type { ActivitySport } from './types';

/**
 * Which planned session did this file record?
 *
 * This is the thing a coaching platform can do that a general activity app
 * cannot: put what the watch measured next to what the coach wrote. It is
 * also where an import could quietly do harm — completing the wrong session
 * would rewrite an athlete's adherence. So the rule is conservative: match
 * automatically only when exactly one session that day fits; when two could,
 * ask; when none does, keep the activity and attach it to nothing.
 */

export type MatchResult =
  | { kind: 'matched'; scheduledId: string }
  /** Already logged by hand: the file adds what the athlete did not type. */
  | { kind: 'logged'; scheduledId: string }
  | { kind: 'ambiguous'; candidateIds: string[] }
  | { kind: 'none'; reason: string };

/** The calendar date an instant falls on for the athlete, not for the server. */
export function localDate(iso: string, timeZone: string): ISODate {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      new Date(iso),
    );
  } catch {
    // an unknown zone name must not lose the import
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Dublin', year: 'numeric', month: '2-digit', day: '2-digit' }).format(
      new Date(iso),
    );
  }
}

/** Which prescribed session types a recorded sport can stand for. */
export function sportFits(sport: ActivitySport, type: WorkoutType): boolean {
  switch (sport) {
    case 'run':
    case 'trail_run':
      return isRun(type) || type === 'brick' || type === 'race' || type === 'cross_training';
    case 'ride':
      return type === 'bike' || type === 'brick' || type === 'cross_training';
    case 'swim':
      return type === 'swim' || type === 'cross_training';
    case 'walk':
    case 'hike':
      return type === 'recovery_run' || type === 'cross_training';
    default:
      return type === 'cross_training';
  }
}

/** Sessions an import may complete: the right sport, on the plan, not yet done. */
export function candidates(sessions: ScheduledWorkout[], date: ISODate, sport: ActivitySport): ScheduledWorkout[] {
  return sessions.filter(
    (s) =>
      s.date === date &&
      s.type !== 'rest' &&
      s.type !== 'strength' &&
      s.type !== 'mobility' &&
      s.status !== 'completed' &&
      sportFits(sport, s.type),
  );
}

export function matchSession(
  sessions: ScheduledWorkout[],
  date: ISODate,
  sport: ActivitySport,
): MatchResult {
  const fits = candidates(sessions, date, sport);
  if (fits.length === 1) return { kind: 'matched', scheduledId: fits[0].id };
  if (fits.length > 1) return { kind: 'ambiguous', candidateIds: fits.map((s) => s.id) };

  const sameDay = sessions.filter((s) => s.date === date && s.type !== 'rest');
  if (!sameDay.length) return { kind: 'none', reason: 'Nothing was prescribed that day.' };
  const logged = sameDay.filter((s) => s.status === 'completed' && sportFits(sport, s.type));
  if (logged.length === 1) return { kind: 'logged', scheduledId: logged[0].id };
  if (logged.length > 1) return { kind: 'ambiguous', candidateIds: logged.map((s) => s.id) };
  return { kind: 'none', reason: 'No session that day matches this kind of activity.' };
}
