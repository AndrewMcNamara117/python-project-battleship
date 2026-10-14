import { addDays } from './dates';
import type { CompletedWorkout, ISODate, StrengthSession } from './types';

/**
 * Training load — how much work, not how many kilometres.
 *
 * One scale for everything: session-RPE (Foster), effort out of ten times
 * minutes. It is what a coach can get from every athlete, typed log or watch
 * file, run or strength session. An eight-kilometre tempo and an
 * eight-kilometre jog are not the same week; kilometres alone said they were.
 *
 * Where the athlete gave no RPE but the watch recorded heart rate, effort is
 * estimated from time in each zone — and said to be an estimate. Where there
 * is neither, the session is counted as unscored rather than guessed.
 *
 * From the daily loads:
 *   fitness   42-day exponentially weighted average (chronic load)
 *   fatigue    7-day exponentially weighted average (acute load)
 *   form      fitness − fatigue: negative while building, positive when fresh
 *   ratio     last 7 days against the 28-day weekly average
 *
 * All of it is context for a coach. Nothing here diagnoses, and the
 * thresholds below describe a trend; they do not tell anyone what to do.
 */

export type LoadBasis = 'rpe' | 'heart_rate';

export interface SessionLoad {
  date: ISODate;
  load: number;
  basis: LoadBasis;
}

/** Effort out of ten for each heart-rate zone — the midpoint of where that zone usually sits on the RPE scale. */
const ZONE_RPE = [2, 3.5, 5.5, 7.5, 9] as const;

/**
 * An RPE estimated from seconds per zone. Null without heart rate.
 * `zoneSeconds` is Z1..Z5.
 */
export function rpeFromZones(zoneSeconds: number[]): number | null {
  const total = zoneSeconds.reduce((a, b) => a + b, 0);
  if (total <= 0) return null;
  const weighted = zoneSeconds.reduce((sum, s, i) => sum + s * ZONE_RPE[i], 0);
  return Math.round((weighted / total) * 10) / 10;
}

/**
 * Load for one logged session. `estimatedRpe` comes from the linked watch
 * file's heart rate, when the athlete left RPE blank.
 */
export function sessionLoad(c: Pick<CompletedWorkout, 'date' | 'rpe' | 'actualDurationMinutes'>, estimatedRpe: number | null = null): SessionLoad | null {
  const minutes = c.actualDurationMinutes;
  if (!minutes || minutes <= 0) return null;
  if (c.rpe != null) return { date: c.date, load: Math.round(c.rpe * minutes), basis: 'rpe' };
  if (estimatedRpe != null) return { date: c.date, load: Math.round(estimatedRpe * minutes), basis: 'heart_rate' };
  return null;
}

/** Strength load: the session's minutes times the mean RPE of the sets logged. */
export function strengthLoad(s: Pick<StrengthSession, 'date' | 'status' | 'durationMinutes' | 'logs'>): SessionLoad | null {
  if (s.status !== 'completed' || !s.durationMinutes) return null;
  const rpes = s.logs.map((l) => l.rpe).filter((r): r is number => r != null && r > 0);
  if (!rpes.length) return null;
  const mean = rpes.reduce((a, b) => a + b, 0) / rpes.length;
  return { date: s.date, load: Math.round(mean * s.durationMinutes), basis: 'rpe' };
}

export interface LoadDay {
  date: ISODate;
  load: number;
  fitness: number;
  fatigue: number;
  form: number;
}

export type LoadTrend = 'easing' | 'steady' | 'building' | 'building_fast';

export interface LoadSummary {
  days: LoadDay[];
  fitness: number;
  fatigue: number;
  form: number;
  /** Null until there are four weeks of scored load to compare against. */
  ratio: number | null;
  trend: LoadTrend | null;
  /** How the scored sessions were scored, and how many could not be. */
  scored: { rpe: number; heartRate: number; unscored: number };
}

export const TREND_LABELS: Record<LoadTrend, string> = {
  easing: 'Easing off',
  steady: 'Steady',
  building: 'Building',
  building_fast: 'Building fast',
};

/**
 * Bands on the acute:chronic ratio. Commonly used in coaching; the evidence
 * that crossing one causes injury is contested, so the words describe the
 * trend and nothing more.
 */
export function trendFor(ratio: number | null): LoadTrend | null {
  if (ratio == null) return null;
  if (ratio < 0.8) return 'easing';
  if (ratio <= 1.3) return 'steady';
  if (ratio <= 1.5) return 'building';
  return 'building_fast';
}

const FITNESS_DAYS = 42;
const FATIGUE_DAYS = 7;

export function summariseLoad(
  sessions: SessionLoad[],
  unscored: number,
  today: ISODate,
  /** Days of series to return; the averages are warmed up over a longer history. */
  windowDays = 84,
): LoadSummary {
  const byDay = new Map<ISODate, number>();
  for (const s of sessions) if (s.date <= today) byDay.set(s.date, (byDay.get(s.date) ?? 0) + s.load);

  // The averages start from zero, so they are warmed up over five time
  // constants before the window shown — one constant left fitness ~5% short.
  // An athlete with less history than that starts from zero on their first
  // day, which is the truth: nothing was logged before it.
  const earliest = sessions.reduce<ISODate>((min, s) => (s.date < min ? s.date : min), today);
  const warmFrom = addDays(today, -(windowDays + FITNESS_DAYS * 5));
  const warmStart = earliest < warmFrom ? warmFrom : earliest;

  const days: LoadDay[] = [];
  let fitness = 0;
  let fatigue = 0;
  for (let d = warmStart; d <= today; d = addDays(d, 1)) {
    const load = byDay.get(d) ?? 0;
    fitness += (load - fitness) / FITNESS_DAYS;
    fatigue += (load - fatigue) / FATIGUE_DAYS;
    days.push({ date: d, load, fitness: round1(fitness), fatigue: round1(fatigue), form: round1(fitness - fatigue) });
  }

  const sum = (from: ISODate) => sessions.filter((s) => s.date >= from && s.date <= today).reduce((a, s) => a + s.load, 0);
  const acute = sum(addDays(today, -6));
  const chronicWeekly = sum(addDays(today, -27)) / 4;
  const hasFourWeeks = earliest <= addDays(today, -27);
  const ratio = hasFourWeeks && chronicWeekly > 0 ? Math.round((acute / chronicWeekly) * 100) / 100 : null;

  const last = days[days.length - 1];
  return {
    days: days.filter((d) => d.date > addDays(today, -windowDays)),
    fitness: last?.fitness ?? 0,
    fatigue: last?.fatigue ?? 0,
    form: last?.form ?? 0,
    ratio,
    trend: trendFor(ratio),
    scored: {
      rpe: sessions.filter((s) => s.basis === 'rpe').length,
      heartRate: sessions.filter((s) => s.basis === 'heart_rate').length,
      unscored,
    },
  };
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}
