import { formatDayMonth } from './dates';
import type { ISODate, ISOTimestamp, SessionStatus, UUID } from './types';

/**
 * ADAPTING A LIVE PROGRAMME
 *
 * Three things, kept apart:
 *
 *   what was originally prescribed  — revision one
 *   what is prescribed now          — the session
 *   what the athlete actually did   — the logged result
 *
 * A coach moving Tuesday's 10K to Thursday changes the second. It must not
 * touch the first, and it can never touch the third.
 */

/** What a bulk operation would do to one session. */
export type AdaptationAction = 'move' | 'scale' | 'keep' | 'blocked';

export interface ShiftRow {
  sessionId: UUID;
  action: AdaptationAction;
  name: string;
  fromDate: ISODate;
  toDate: ISODate;
  status: SessionStatus;
  detail: string;
}

export interface VolumeRow {
  sessionId: UUID;
  action: AdaptationAction;
  name: string;
  fromKm: number | null;
  toKm: number | null;
  status: SessionStatus;
  detail: string;
}

/** The tally a coach reads before confirming: changed, untouched, refused. */
export interface AdaptationSummary {
  changing: number;
  untouched: number;
  blocked: number;
}

export function summarise(rows: { action: AdaptationAction }[]): AdaptationSummary {
  return {
    changing: rows.filter((r) => r.action === 'move' || r.action === 'scale').length,
    untouched: rows.filter((r) => r.action === 'keep').length,
    blocked: rows.filter((r) => r.action === 'blocked').length,
  };
}

/** One session in the week a coach is working on. */
export interface WeekSession {
  sessionId: UUID;
  date: ISODate;
  slot: number;
  name: string;
  type: string;
  status: SessionStatus;
  distanceKm: number | null;
  durationMinutes: number | null;
  /** Set when the session cannot be adapted, and why. */
  blocker: string | null;
  revisions: number;
  /** Where it was originally prescribed, when that is not where it is now. */
  movedFrom: ISODate | null;
}

/* ---------- history ---------- */

export type RevisionKind = 'created' | 'edited' | 'moved' | 'reassigned' | 'status_changed' | 'deleted';

export interface SessionRevisionRow {
  revision: number;
  kind: RevisionKind;
  changedAt: ISOTimestamp;
  changedBy: UUID | null;
  changedByName: string | null;
  session: Record<string, unknown>;
  note: string | null;
}

/** One entry in the account a coach reads. */
export interface HistoryEntry {
  revision: number;
  kind: RevisionKind;
  changedAt: ISOTimestamp;
  /** "R. Doyle", or "Iron Miles" for anything the system did. */
  by: string;
  headline: string;
  /** The specific differences, already in coach language. */
  changes: string[];
}

/**
 * The prescription fields worth reporting, and how each reads.
 *
 * Deliberately not every column: a coach does not need to hear that
 * `updated_at` changed, and a history full of that is a history nobody opens.
 */
const FIELDS: { key: string; label: string; format?: (v: unknown) => string }[] = [
  { key: 'name', label: 'Session' },
  { key: 'date', label: 'Date', format: (v) => formatDayMonth(String(v).slice(0, 10)) },
  { key: 'slot', label: 'Slot' },
  { key: 'type', label: 'Type', format: (v) => String(v).replace(/_/g, ' ') },
  { key: 'intensity', label: 'Intensity' },
  { key: 'distance_km', label: 'Distance', format: (v) => `${v} km` },
  { key: 'duration_minutes', label: 'Duration', format: (v) => `${v} min` },
  { key: 'rpe_target', label: 'RPE' },
  { key: 'hr_zone', label: 'HR zone' },
  { key: 'warm_up', label: 'Warm-up' },
  { key: 'main_set', label: 'Main set' },
  { key: 'cool_down', label: 'Cool-down' },
  { key: 'notes', label: 'Description' },
  { key: 'coach_note', label: 'Note to athlete' },
  { key: 'status', label: 'Status' },
];

const HEADLINES: Record<RevisionKind, string> = {
  created: 'Prescribed',
  edited: 'Changed',
  moved: 'Moved',
  reassigned: 'Moved to another week',
  status_changed: 'Status changed',
  deleted: 'Removed',
};

function present(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'nothing';
  return String(value);
}

/**
 * Turn consecutive snapshots into an account a coach would recognise.
 *
 * Written once and shared by both adapters: two implementations of "what
 * changed" would eventually disagree, and the one a coach happened to be
 * looking at would be the wrong one.
 */
export function describeHistory(revisions: SessionRevisionRow[]): HistoryEntry[] {
  return revisions.map((r, i) => {
    const previous = i > 0 ? revisions[i - 1].session : null;
    const changes: string[] = [];

    if (previous) {
      for (const field of FIELDS) {
        const before = previous[field.key];
        const after = r.session[field.key];
        if (before === after) continue;
        if (before == null && after == null) continue;

        const show = (v: unknown) => (v == null || v === '' ? 'nothing' : (field.format ? field.format(v) : present(v)));
        changes.push(`${field.label}: ${show(before)} → ${show(after)}`);
      }
    }

    return {
      revision: r.revision,
      kind: r.kind,
      changedAt: r.changedAt,
      // anything with no author was the system: an assignment, a cascade
      by: r.changedByName ?? (r.changedBy ? 'A coach' : 'Iron Miles'),
      headline: HEADLINES[r.kind] ?? 'Changed',
      changes,
    };
  });
}

/** What a coach reads at the top of a session's history. */
export interface SessionHistory {
  entries: HistoryEntry[];
  /** Revision one: what the athlete was first given. */
  original: Record<string, unknown> | null;
  /** True when the current prescription differs from the original. */
  changed: boolean;
}

export function buildSessionHistory(revisions: SessionRevisionRow[]): SessionHistory {
  const entries = describeHistory(revisions);

  // "changed" means the coach changed the prescription. An athlete completing
  // a session is not a change to what they were asked to do.
  const changed = entries.slice(1).some((e) =>
    e.kind === 'moved' ||
    e.kind === 'reassigned' ||
    e.changes.some((c) => !c.startsWith('Status:')));

  return { entries, original: revisions[0]?.session ?? null, changed };
}

/* ---------- check-in context ---------- */

/**
 * The athlete's own account of the week just gone, beside the week the coach
 * is about to change.
 *
 * Context, not instruction. Nothing here decides anything — a simple rule over
 * six numbers is not coaching, and presenting it as one would be worse than
 * showing the coach nothing.
 */
export interface CheckInContext {
  weekStart: ISODate;
  submittedAt: ISOTimestamp;
  attention: 'none' | 'watch' | 'attention';
  reasons: string[];
  fatigue: number | null;
  soreness: number | null;
  sleep: number | null;
  motivation: number | null;
  painOrNiggles: string | null;
  feltDifficult: string | null;
  reviewedAt: ISOTimestamp | null;
}

/**
 * A check-in as the coach reads it beside the programme.
 *
 * Shared by both adapters so the same submission produces the same context
 * either way.
 */
export function toCheckInContext(c: {
  weekStart: ISODate;
  submittedAt: ISOTimestamp;
  attentionLevel: 'none' | 'watch' | 'attention';
  attentionReasons?: string[] | null;
  scores?: { fatigue?: number; soreness?: number; sleep?: number; motivation?: number } | null;
  painOrNiggles?: string | null;
  feltDifficult?: string | null;
  reviewedByCoachAt?: ISOTimestamp | null;
}): CheckInContext {
  return {
    weekStart: c.weekStart,
    submittedAt: c.submittedAt,
    attention: c.attentionLevel,
    reasons: c.attentionReasons ?? [],
    fatigue: c.scores?.fatigue ?? null,
    soreness: c.scores?.soreness ?? null,
    sleep: c.scores?.sleep ?? null,
    motivation: c.scores?.motivation ?? null,
    painOrNiggles: c.painOrNiggles?.trim() || null,
    feltDifficult: c.feltDifficult?.trim() || null,
    reviewedAt: c.reviewedByCoachAt ?? null,
  };
}
