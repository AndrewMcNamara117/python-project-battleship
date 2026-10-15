import type { CheckIn, CompletedWorkout, ForgeScoreEvent, ISODate, ScheduledWorkout } from './types';

/**
 * Club challenges: a target over a window, opted into, finished rather than
 * won. The rules here are the demo's copy of migration 0027's; the
 * challenges RLS suite and the demo parity tests keep the two in step.
 */

export type ChallengeMetric = 'sessions' | 'club_runs' | 'checkins' | 'distance_km';

export const METRICS: Record<ChallengeMetric, { label: string; unit: string; one: string; many: string; integer: boolean }> = {
  sessions: { label: 'Sessions as written', unit: 'sessions', one: 'session', many: 'sessions', integer: true },
  club_runs: { label: 'Club runs', unit: 'club runs', one: 'club run', many: 'club runs', integer: true },
  checkins: { label: 'Weekly check-ins', unit: 'check-ins', one: 'check-in', many: 'check-ins', integer: true },
  distance_km: { label: 'Kilometres', unit: 'km', one: 'km', many: 'km', integer: false },
};

export interface Challenge {
  id: string;
  name: string;
  description: string;
  metric: ChallengeMetric;
  target: number;
  startsOn: ISODate;
  endsOn: ISODate;
  createdBy: string | null;
  archived: boolean;
  createdAt: string;
}

export type ChallengeDraft = Pick<Challenge, 'name' | 'description' | 'metric' | 'target' | 'startsOn' | 'endsOn' | 'createdBy'>;

/** What any member may know, plus the viewer's own number. */
export interface ChallengeSummary {
  participants: number;
  finishers: string[];
  viewerJoined: boolean;
  /** Null unless the viewer has joined. */
  viewerProgress: number | null;
}

export type ChallengeState = 'upcoming' | 'open' | 'closed';

export function challengeState(c: Pick<Challenge, 'startsOn' | 'endsOn' | 'archived'>, today: ISODate): ChallengeState {
  if (c.archived || c.endsOn < today) return 'closed';
  return c.startsOn > today ? 'upcoming' : 'open';
}

/** Open for joining: not archived and not yet ended (an upcoming one can be joined early). */
export function canJoin(c: Pick<Challenge, 'endsOn' | 'archived'>, today: ISODate): boolean {
  return !c.archived && c.endsOn >= today;
}

export function progressFor(
  c: Pick<Challenge, 'metric' | 'startsOn' | 'endsOn'>,
  data: { scheduled: ScheduledWorkout[]; completed: CompletedWorkout[]; forge: ForgeScoreEvent[]; checkins: CheckIn[] },
): number {
  const inWindow = (d: ISODate) => d >= c.startsOn && d <= c.endsOn;
  switch (c.metric) {
    case 'sessions':
      return data.scheduled.filter((s) => s.status === 'completed' && s.type !== 'rest' && inWindow(s.date)).length;
    case 'club_runs':
      return data.forge.filter((f) => f.kind === 'community_run' && inWindow(f.date)).length;
    case 'checkins':
      return data.checkins.filter((k) => inWindow(k.weekStart)).length;
    case 'distance_km':
      return Math.round(data.completed.filter((w) => inWindow(w.date)).reduce((a, w) => a + (w.actualDistanceKm ?? 0), 0) * 10) / 10;
  }
}

export function formatAmount(metric: ChallengeMetric, n: number): string {
  const m = METRICS[metric];
  const v = m.integer ? String(Math.round(n)) : n.toFixed(1).replace(/\.0$/, '');
  return `${v} ${n === 1 && m.integer ? m.one : m.many}`;
}
