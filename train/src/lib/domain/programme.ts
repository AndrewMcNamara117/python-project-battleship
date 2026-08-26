import type { ISODate, ISOTimestamp, TrainingPhase, UUID } from './types';

/**
 * PROGRAMME → BLOCK → WEEK → SESSION → COMPONENT
 *
 * Blocks and weeks are rows, not something inferred from dates. That is what
 * makes "duplicate this block" a single database call rather than a loop, and
 * it is the difference between a coach handling five athletes and fifty.
 *
 * The session itself is `ScheduledWorkout` in types.ts — it keeps that name
 * because renaming it would churn every policy, adapter and test for no gain.
 */

/** A phase of training. Several weeks that share an intent. */
export interface ProgramBlock {
  id: UUID;
  programId: UUID;
  athleteId: UUID;
  /** Position within the programme, from zero. */
  blockIndex: number;
  name: string;
  phase: TrainingPhase | null;
  focus: string | null;
  notes: string | null;
  createdAt: ISOTimestamp;
}

/** One training week. Always starts on a Monday — the database enforces it. */
export interface ProgramWeek {
  id: UUID;
  blockId: UUID;
  programId: UUID;
  athleteId: UUID;
  /** Position within the block. */
  weekIndex: number;
  /** Position within the whole programme, from one. What the athlete sees. */
  programWeekNo: number;
  startDate: ISODate;
  targetVolumeKm: number | null;
  focus: string | null;
  notes: string | null;
  /** A step-back week is a coaching decision, not just a smaller number. */
  isRecoveryWeek: boolean;
  createdAt: ISOTimestamp;
}

export type ComponentKind =
  | 'warm_up'
  | 'main_set'
  | 'interval'
  | 'exercise'
  | 'circuit'
  | 'cool_down'
  | 'note';

export const COMPONENT_KIND_LABELS: Record<ComponentKind, string> = {
  warm_up: 'Warm-up',
  main_set: 'Main set',
  interval: 'Interval',
  exercise: 'Exercise',
  circuit: 'Circuit',
  cool_down: 'Cool-down',
  note: 'Note',
};

/**
 * An ordered part of a prescribed session.
 *
 * One shape for endurance and strength. Two parallel component systems would
 * mean every consumer downstream branches on session type forever, and a
 * session that mixes both — a brick, a run with a core finisher — could not be
 * expressed at all.
 */
export interface SessionComponent {
  id: UUID;
  scheduledWorkoutId: UUID;
  athleteId: UUID;
  position: number;
  kind: ComponentKind;
  label: string | null;
  notes: string | null;

  /** Shared: how many times, and how hard. */
  repeats: number | null;
  rpeTarget: number | null;

  /* endurance */
  distanceKm: number | null;
  durationSeconds: number | null;
  paceMinSecPerKm: number | null;
  paceMaxSecPerKm: number | null;
  hrZone: number | null;
  recoverySeconds: number | null;
  recoveryDescription: string | null;

  /* strength */
  strengthExerciseId: UUID | null;
  sets: number | null;
  reps: string | null;
  loadPrescription: string | null;
  tempo: string | null;
  restSeconds: number | null;
}

/** What a component looks like before it has an id. */
export type SessionComponentDraft = Omit<SessionComponent, 'id' | 'scheduledWorkoutId' | 'athleteId'>;

export type RevisionKind =
  | 'created'
  | 'edited'
  | 'moved'
  | 'reassigned'
  | 'status_changed'
  | 'deleted';

export const REVISION_LABELS: Record<RevisionKind, string> = {
  created: 'Prescribed',
  edited: 'Prescription changed',
  moved: 'Moved to another day',
  reassigned: 'Moved to another week',
  status_changed: 'Status changed',
  deleted: 'Removed from the plan',
};

/**
 * One entry in a session's prescription history.
 *
 * Written by a database trigger, not by application code, and readable by the
 * athlete and their coach but writable by neither. An audit trail a coach could
 * edit would not be an audit trail.
 */
export interface SessionRevision {
  id: UUID;
  scheduledWorkoutId: UUID;
  athleteId: UUID;
  revision: number;
  kind: RevisionKind;
  changedBy: UUID | null;
  changedAt: ISOTimestamp;
  /** The prescription as it stood after this change. */
  session: Record<string, unknown>;
  components: Record<string, unknown>[];
  note: string | null;
}

/** A block with its weeks, which is how the builder actually wants it. */
export interface BlockWithWeeks extends ProgramBlock {
  weeks: ProgramWeek[];
}

/** Derive a block's date range from its weeks rather than storing it twice. */
export function blockRange(weeks: ProgramWeek[]): { start: ISODate; end: ISODate } | null {
  if (!weeks.length) return null;
  const sorted = [...weeks].sort((a, b) => a.startDate.localeCompare(b.startDate));
  const last = sorted[sorted.length - 1];
  const end = new Date(`${last.startDate}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 6);
  return { start: sorted[0].startDate, end: end.toISOString().slice(0, 10) };
}

/**
 * Total prescribed distance for a week, from its sessions.
 *
 * Deliberately computed rather than stored: `targetVolumeKm` is what the coach
 * intended, this is what they actually wrote. The gap between the two is
 * frequently the useful part.
 */
export function prescribedVolume(sessions: { distanceKm: number | null }[]): number {
  return Math.round(sessions.reduce((total, s) => total + (s.distanceKm ?? 0), 0) * 10) / 10;
}
