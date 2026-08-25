import type { ForgeEventKind, ForgeScoreEvent, ISODate } from './types';
import { FORGE_POINTS } from './types';
import { addDays, startOfMonth, startOfWeek } from './dates';

/**
 * Forge Score rewards showing up as prescribed — not raw volume.
 * Running further than you were asked to earns nothing extra by design:
 * the score should never make overtraining look like progress.
 */

export const FORGE_RULES: { kind: ForgeEventKind; label: string; points: number; note: string }[] = [
  { kind: 'run_completed', label: 'Prescribed run completed', points: 10, note: 'As written — not further.' },
  { kind: 'strength_completed', label: 'Strength session completed', points: 8, note: 'The work that keeps you running.' },
  { kind: 'checkin_completed', label: 'Weekly check-in', points: 5, note: 'Tells your coach what the data cannot.' },
  { kind: 'community_run', label: 'Iron Miles club run', points: 10, note: 'Saturday mornings.' },
  { kind: 'full_week_adherence', label: '100% weekly adherence', points: 20, note: 'Every session, as prescribed.' },
  { kind: 'streak_week', label: 'Consecutive full week', points: 12, note: 'Consistency compounds.' },
  { kind: 'volunteered', label: 'Volunteered at an event', points: 15, note: 'The club runs on this.' },
  { kind: 'race_completed', label: 'Race completed', points: 25, note: 'Start lines count.' },
  { kind: 'milestone', label: 'Personal milestone', points: 0, note: 'Earns a badge, not points.' },
];

export function pointsFor(kind: ForgeEventKind): number {
  return FORGE_POINTS[kind];
}

export function totalScore(events: ForgeScoreEvent[]): number {
  return events.reduce((sum, e) => sum + e.points, 0);
}

export function scoreInRange(events: ForgeScoreEvent[], from: ISODate, to: ISODate): number {
  return totalScore(events.filter((e) => e.date >= from && e.date <= to));
}

export function weeklyScore(events: ForgeScoreEvent[], today: ISODate): number {
  const start = startOfWeek(today);
  return scoreInRange(events, start, addDays(start, 6));
}

export function monthlyScore(events: ForgeScoreEvent[], today: ISODate): number {
  return scoreInRange(events, startOfMonth(today), today);
}

/** Consecutive weeks, counting back from the current week, that earned any points. */
export function currentStreakWeeks(events: ForgeScoreEvent[], today: ISODate): number {
  const weeks = new Set(events.map((e) => startOfWeek(e.date)));
  let streak = 0;
  let cursor = startOfWeek(today);
  // the current week only breaks a streak once it is over
  if (!weeks.has(cursor)) cursor = addDays(cursor, -7);
  while (weeks.has(cursor)) {
    streak += 1;
    cursor = addDays(cursor, -7);
  }
  return streak;
}

/**
 * Forge tiers. Deliberately about accumulated consistency, not speed —
 * a first-time marathoner and a sub-3 runner climb at the same rate.
 */
export interface ForgeTier {
  name: string;
  min: number;
}

export const FORGE_TIERS: ForgeTier[] = [
  { name: 'Spark', min: 0 },
  { name: 'Ember', min: 250 },
  { name: 'Forge', min: 750 },
  { name: 'Anvil', min: 1500 },
  { name: 'Iron', min: 3000 },
];

export function tierFor(score: number) {
  let current = FORGE_TIERS[0];
  for (const t of FORGE_TIERS) if (score >= t.min) current = t;
  const next = FORGE_TIERS.find((t) => t.min > score) ?? null;
  const span = next ? next.min - current.min : 1;
  return {
    name: current.name,
    next: next?.name ?? null,
    pointsToNext: next ? next.min - score : 0,
    progress: next ? Math.min(1, (score - current.min) / span) : 1,
  };
}
