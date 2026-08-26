import type { ISOTimestamp, TrainingPhase, UUID, Weekday } from './types';
import type { Visibility } from './library';

/**
 * PROGRAMME TEMPLATE → BLOCK → WEEK → SLOT
 *
 * A reusable programme. Its weeks are relative — week seven knows it is week
 * seven, not that it is the week of March 9th. Dates are decided once, at
 * assignment, and assignment copies everything into the athlete's own
 * programme. Nothing connects the two afterwards.
 */

/** What a programme is written for. Not an enum: adding one should be cheap. */
export type Discipline = 'running' | 'trail' | 'triathlon' | 'duathlon' | 'hybrid' | 'strength' | 'other';

export const DISCIPLINE_LABELS: Record<Discipline, string> = {
  running: 'Running',
  trail: 'Trail',
  triathlon: 'Triathlon',
  duathlon: 'Duathlon',
  hybrid: 'Hybrid',
  strength: 'Strength',
  other: 'Other',
};

export interface ProgramTemplate {
  id: UUID;
  /** Null only for the programmes Iron Miles ships. */
  ownerId: UUID | null;
  visibility: Visibility;
  name: string;
  description: string;
  purpose: string | null;
  /** Coach-only. Never reaches the athlete. */
  coachNotes: string | null;
  discipline: Discipline;
  goalType: string;
  targetDistanceKm: number | null;
  experienceLevel: string | null;
  /**
   * The training frequency this programme was written for. It is what makes
   * "this is a three-day programme" a fact about the template rather than
   * something a coach works out by counting days.
   */
  minDaysPerWeek: number | null;
  maxDaysPerWeek: number | null;
  /** Follows the structure once the template has weeks of its own. */
  weeks: number;
  tags: string[];
  archivedAt: ISOTimestamp | null;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

/** A phase of the template. Several weeks that share an intent. */
export interface ProgramTemplateBlock {
  id: UUID;
  programTemplateId: UUID;
  blockIndex: number;
  name: string;
  phase: TrainingPhase | null;
  focus: string | null;
  description: string | null;
  createdAt: ISOTimestamp;
}

/** One week of the template, positioned but not dated. */
export interface ProgramTemplateWeek {
  id: UUID;
  programTemplateId: UUID;
  blockId: UUID;
  /** Position within the block. */
  weekIndex: number;
  /** Position within the whole template, from one. What a coach calls "week 7". */
  templateWeekNo: number;
  /** The coach's intent. Prescribed volume is computed from the sessions. */
  targetVolumeKm: number | null;
  isRecoveryWeek: boolean;
  focus: string | null;
  notes: string | null;
  createdAt: ISOTimestamp;
}

/**
 * One session in a template week — or one explicit rest day.
 *
 * A slot points at a library item rather than restating a prescription, which
 * is what stops a coach rewriting the same threshold session in every
 * programme they own. The overrides are deliberately narrow: enough to say
 * "the long run is 26km in this programme", not enough to fork the session.
 */
export interface ProgramTemplateSlot {
  id: UUID;
  programTemplateId: UUID;
  templateWeekId: UUID;
  /** ISO: Monday is 1. The same convention as athlete availability. */
  weekday: Weekday;
  /** Ordering within the day. A run and a strength session can share one. */
  slot: number;
  workoutTemplateId: UUID | null;
  strengthTemplateId: UUID | null;
  /**
   * A prescribed rest day. It is what the coach intends, and it never counts
   * as training the athlete failed to do.
   */
  isRest: boolean;
  isOptional: boolean;
  /** Overrides the library item's name for this programme only. */
  label: string | null;
  notes: string | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  rpeTarget: number | null;
}

/** A template week with what it actually prescribes, for the builder and the review. */
export interface TemplateWeekVolume {
  templateWeekNo: number;
  blockName: string;
  phase: TrainingPhase | null;
  isRecoveryWeek: boolean;
  /** What the coach meant to prescribe. */
  targetKm: number | null;
  /** What they actually prescribed, by the same rule im_week_volume uses. */
  prescribedKm: number;
  sessionCount: number;
  restDays: number;
  trainingDays: number;
}

/** The template with its structure, as the builder edits it. */
export interface ProgramTemplateDetail extends ProgramTemplate {
  blocks: (ProgramTemplateBlock & {
    weeks: (ProgramTemplateWeek & { slots: ProgramTemplateSlot[] })[];
  })[];
  volume: TemplateWeekVolume[];
}

/**
 * Something the coach should see before assigning.
 *
 * `block` means proceeding would produce something invalid or unauthorised.
 * `warn` means a coaching conflict — the athlete trains four days and the
 * programme wants five. Warnings are shown and never acted on: the system
 * does not move a session to a day the athlete said they were free.
 */
export interface AssignmentConflict {
  severity: 'block' | 'warn';
  kind:
    | 'template' | 'athlete' | 'authorisation' | 'archived' | 'structure' | 'start_date'
    | 'availability' | 'preferred_days' | 'frequency' | 'volume'
    | 'gym' | 'equipment' | 'active_programme' | 'replacing' | 'history_kept';
  detail: string;
}

/** Everything the pre-assignment review shows, gathered in one call. */
export interface AssignmentPreview {
  template: ProgramTemplate;
  athleteId: UUID;
  athleteName: string;
  /** ISO weekdays the athlete said they can train. */
  availableDays: Weekday[];
  preferredDays: Weekday[];
  /** ISO weekdays the programme actually uses. */
  templateDays: Weekday[];
  startDate: string;
  endDate: string;
  goal: {
    eventType: string | null;
    targetDate: string | null;
    raceName: string | null;
    raceDate: string | null;
  } | null;
  weeks: TemplateWeekVolume[];
  conflicts: AssignmentConflict[];
  /** The longest run of each week — the fastest read on a programme's shape. */
  keySessions: { templateWeekNo: number; weekday: Weekday; name: string; distanceKm: number | null }[];
  activeProgramme: { id: UUID; name: string } | null;
}

export const isBlocking = (c: AssignmentConflict) => c.severity === 'block';
