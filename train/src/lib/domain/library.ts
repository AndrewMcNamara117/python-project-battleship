import type { Intensity, ISOTimestamp, PrescriptionBasis, StrengthCategory, UUID, WorkoutType } from './types';
import type { SessionComponent } from './programme';

/**
 * THE LIBRARIES
 *
 * Reusable coaching material: endurance sessions, strength movements and
 * strength sessions. A template is not a programme and never becomes one —
 * prescribing copies it. That copy is the whole point: a coach can rework a
 * template years later without reaching back into training an athlete has
 * already done.
 */

/**
 * Who may see an item.
 *
 * - `private` — the owning coach only.
 * - `shared` — readable by every coach, writable by its owner.
 * - `system` — the content Iron Miles ships. No owner, immutable, duplicate
 *   it to get your own.
 */
export type Visibility = 'private' | 'shared' | 'system';

/** What an endurance session is *for*. Broader than its type — how a coach files it. */
export type WorkoutCategory =
  | 'easy' | 'recovery' | 'long_run' | 'threshold' | 'intervals'
  | 'hills' | 'tempo' | 'progression' | 'race_specific' | 'race' | 'custom';

/** How a movement loads the body. Drives balance checks across a strength week. */
export type MovementPattern =
  | 'squat' | 'hinge' | 'push' | 'pull' | 'lunge' | 'calf' | 'core'
  | 'plyometric' | 'mobility' | 'stability' | 'carry' | 'rehab' | 'other';

/** Fields every library item carries. */
interface LibraryItem {
  id: UUID;
  /** Null only for system content. */
  ownerId: UUID | null;
  visibility: Visibility;
  name: string;
  tags: string[];
  /** Set means archived: hidden from pickers, still readable by anything that references it. */
  archivedAt: ISOTimestamp | null;
  createdAt: ISOTimestamp;
  updatedAt: ISOTimestamp;
}

/** A reusable endurance session. */
export interface WorkoutTemplate extends LibraryItem {
  category: WorkoutCategory;
  type: WorkoutType;
  basis: PrescriptionBasis;
  intensity: Intensity;
  distanceKm: number | null;
  durationMinutes: number | null;
  paceMinSecKm: number | null;
  paceMaxSecKm: number | null;
  hrZone: number | null;
  rpeTarget: number | null;
  /** Prose fallbacks, kept for sessions that were never broken into components. */
  warmUp: string | null;
  mainSet: string | null;
  coolDown: string | null;
  /** What the session is meant to achieve. Shown to the athlete. */
  purpose: string | null;
  /** Coach-only. Never reaches the athlete. */
  coachNotes: string | null;
  notes: string | null;
  components?: SessionComponent[];
}

/** A movement in the strength library. */
export interface StrengthExercise extends LibraryItem {
  category: StrengthCategory;
  movementPattern: MovementPattern | null;
  description: string | null;
  muscleGroups: string[];
  cues: string[];
  regressions: string[];
  progressions: string[];
  equipment: string[];
  videoUrl: string | null;
  /** Starting points a coach overrides per athlete. */
  defaultSets: number | null;
  defaultReps: string | null;
  loadGuidance: string | null;
  defaultTempo: string | null;
  defaultRestSeconds: number | null;
  defaultRpe: number | null;
  /** Per side, so a coach reads "8 each" rather than "8". */
  isUnilateral: boolean;
}

/** A reusable strength session: ordered movements with prescriptions. */
export interface StrengthTemplate extends LibraryItem {
  category: StrengthCategory;
  description: string;
  estimatedMinutes: number;
  purpose: string | null;
  coachNotes: string | null;
  components?: SessionComponent[];
}

/** What a coach typed into the library filters. */
export interface LibraryQuery {
  /** Matched against name, purpose and tags. */
  search?: string;
  category?: string;
  visibility?: Visibility;
  movementPattern?: MovementPattern;
  tags?: string[];
  /** Archived items are excluded unless asked for. */
  includeArchived?: boolean;
  limit?: number;
}

/** Prescribed against intended volume, so a mismatch can be shown without blocking a save. */
export interface WeekVolume {
  prescribedKm: number;
  targetKm: number | null;
  sessionCount: number;
}
