import type { CheckIn, CompletedWorkout, ISODate, ScheduledWorkout, StrengthSession } from './types';
import { addDays, startOfWeek, toISODate } from './dates';

export interface WeekBucket {
  weekStart: ISODate;
  label: string;
  plannedKm: number;
  actualKm: number;
  plannedSessions: number;
  completedSessions: number;
  longestRunKm: number;
  avgPaceSecPerKm: number | null;
  avgRpe: number | null;
  avgHr: number | null;
  strengthPlanned: number;
  strengthCompleted: number;
}

const RUN_TYPES = new Set([
  'easy_run',
  'recovery_run',
  'long_run',
  'progression_run',
  'tempo',
  'threshold',
  'intervals',
  'hills',
  'race_pace',
  'race',
]);

export function isRun(type: string): boolean {
  return RUN_TYPES.has(type);
}

/** A prescribed session that counts toward adherence. Rest days do not. */
export function countsForAdherence(w: Pick<ScheduledWorkout, 'type'>): boolean {
  return w.type !== 'rest';
}

function mean(values: number[]): number | null {
  const clean = values.filter((v) => Number.isFinite(v));
  return clean.length ? clean.reduce((a, b) => a + b, 0) / clean.length : null;
}

/** Rolling weekly buckets, oldest first. */
export function buildWeekBuckets(
  scheduled: ScheduledWorkout[],
  completed: CompletedWorkout[],
  strength: StrengthSession[],
  weeks: number,
  today: ISODate = toISODate(new Date()),
): WeekBucket[] {
  const currentWeek = startOfWeek(today);
  const buckets: WeekBucket[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDays(currentWeek, -7 * i);
    const weekEnd = addDays(weekStart, 6);
    const inWeek = <T extends { date: ISODate }>(rows: T[]) =>
      rows.filter((r) => r.date >= weekStart && r.date <= weekEnd);

    const s = inWeek(scheduled);
    const c = inWeek(completed);
    const st = inWeek(strength);
    const runs = c.filter((w) => isRun(w.type));

    buckets.push({
      weekStart,
      label: weekStart.slice(5).replace('-', '/'),
      plannedKm: round1(s.filter((w) => isRun(w.type)).reduce((a, w) => a + (w.distanceKm ?? 0), 0)),
      actualKm: round1(runs.reduce((a, w) => a + (w.actualDistanceKm ?? 0), 0)),
      plannedSessions: s.filter(countsForAdherence).length,
      completedSessions: s.filter((w) => w.status === 'completed').length,
      longestRunKm: round1(Math.max(0, ...runs.map((w) => w.actualDistanceKm ?? 0))),
      avgPaceSecPerKm: roundOrNull(mean(runs.map((w) => w.averagePaceSecPerKm ?? NaN))),
      avgRpe: roundOrNull(mean(c.map((w) => w.rpe ?? NaN)), 1),
      avgHr: roundOrNull(mean(runs.map((w) => w.averageHeartRate ?? NaN))),
      strengthPlanned: s.filter((w) => w.type === 'strength').length,
      strengthCompleted: st.filter((w) => w.status === 'completed').length,
    });
  }

  return buckets;
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
function roundOrNull(n: number | null, decimals = 0): number | null {
  if (n == null) return null;
  const f = 10 ** decimals;
  return Math.round(n * f) / f;
}

/** Completed ÷ prescribed, ignoring sessions still in the future. */
export function adherence(
  scheduled: ScheduledWorkout[],
  from: ISODate,
  to: ISODate,
  today: ISODate = toISODate(new Date()),
): { completed: number; prescribed: number; pct: number } {
  const upTo = to < today ? to : today;
  const rows = scheduled.filter((w) => w.date >= from && w.date <= upTo && countsForAdherence(w));
  const completed = rows.filter((w) => w.status === 'completed').length;
  return {
    completed,
    prescribed: rows.length,
    pct: rows.length ? Math.round((completed / rows.length) * 100) : 0,
  };
}

/** Share of the last N weeks in which the athlete trained at all. */
export function consistency(buckets: WeekBucket[]): number {
  if (!buckets.length) return 0;
  const active = buckets.filter((b) => b.completedSessions > 0).length;
  return Math.round((active / buckets.length) * 100);
}

/**
 * Acute:chronic workload ratio — last 7 days against the 28-day average.
 * Shown as context for a coach, never as an instruction to an athlete.
 */
export function loadRatio(completed: CompletedWorkout[], today: ISODate): number | null {
  const km = (from: ISODate, to: ISODate) =>
    completed
      .filter((w) => w.date >= from && w.date <= to && isRun(w.type))
      .reduce((a, w) => a + (w.actualDistanceKm ?? 0), 0);

  const acute = km(addDays(today, -6), today);
  const chronic = km(addDays(today, -27), today) / 4;
  if (chronic <= 0) return null;
  return Math.round((acute / chronic) * 100) / 100;
}

export interface WellbeingPoint {
  weekStart: ISODate;
  label: string;
  fatigue: number;
  sleep: number;
  soreness: number;
  motivation: number;
}

export function wellbeingSeries(checkins: CheckIn[]): WellbeingPoint[] {
  return [...checkins]
    .sort((a, b) => a.weekStart.localeCompare(b.weekStart))
    .map((c) => ({
      weekStart: c.weekStart,
      label: c.weekStart.slice(5).replace('-', '/'),
      fatigue: c.scores.fatigue,
      sleep: c.scores.sleep,
      soreness: c.scores.soreness,
      motivation: c.scores.motivation,
    }));
}
