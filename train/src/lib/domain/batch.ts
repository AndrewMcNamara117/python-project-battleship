import type { AssignmentPreview } from './programme-template';
import type { ShiftRow, VolumeRow } from './adaptation';
import type { RosterEntry } from './roster';
import type { ISODate, UUID } from './types';

/**
 * ONE COACHING DECISION, APPLIED TO SEVERAL ATHLETES.
 *
 * The whole of this file is bookkeeping around decisions made elsewhere. It
 * does not decide what a volume adjustment means, what blocks an assignment,
 * or who a coach may touch — Slices 4 and 6 decided those, once, and a batch
 * calls them per athlete. What lives here is the part that only exists when
 * there is more than one athlete in play:
 *
 *   what a selection is, and what it permits
 *   how N per-athlete previews read as one sentence
 *   what the confirm button says, so it can never overstate
 *   what happened to each athlete afterwards
 *
 * Pure and adapter-free, so both the demo and Postgres paths summarise a batch
 * identically and neither can invent its own arithmetic.
 */

export type BatchAction = 'assign_template' | 'scale_volume' | 'shift_sessions' | 'acknowledge_checkin';

export const BATCH_ACTION_LABEL: Record<BatchAction, string> = {
  assign_template: 'Assign a programme',
  scale_volume: 'Adjust volume',
  shift_sessions: 'Shift training days',
  acknowledge_checkin: 'Mark check-in read',
};

/**
 * What became of one athlete.
 *
 * `skipped` is not a failure: it is the athlete for whom the action would
 * change nothing — every session already at that distance, or nothing in the
 * date range. Reporting it as applied would overstate; reporting it as failed
 * would alarm.
 */
export type BatchOutcome =
  | 'applied'
  | 'skipped'
  | 'blocked'
  | 'failed'
  | 'unauthorised'
  | 'removed';

export const OUTCOME_LABEL: Record<BatchOutcome, string> = {
  applied: 'Applied',
  skipped: 'Nothing to change',
  blocked: 'Blocked',
  failed: 'Failed',
  unauthorised: 'Not on your roster',
  removed: 'Removed by you',
};

/* ============================================================
 * SELECTION
 * ========================================================== */

/**
 * Which athletes the coach has chosen.
 *
 * Deliberately a plain set of ids rather than a query. A selection that is
 * stored as "everyone matching this filter" changes underneath the coach
 * between the review and the apply; a set of ids is the athletes they actually
 * looked at when they decided.
 */
export interface Selection {
  ids: UUID[];
}

export const EMPTY_SELECTION: Selection = { ids: [] };

export function isSelected(selection: Selection, athleteId: UUID): boolean {
  return selection.ids.includes(athleteId);
}

export function toggle(selection: Selection, athleteId: UUID): Selection {
  return isSelected(selection, athleteId)
    ? { ids: selection.ids.filter((id) => id !== athleteId) }
    : { ids: [...selection.ids, athleteId] };
}

/** Add without removing what is already chosen — "select all of these too". */
export function selectAll(selection: Selection, athleteIds: UUID[]): Selection {
  return { ids: [...new Set([...selection.ids, ...athleteIds])] };
}

export function deselectAll(selection: Selection, athleteIds: UUID[]): Selection {
  const drop = new Set(athleteIds);
  return { ids: selection.ids.filter((id) => !drop.has(id)) };
}

/** True when every one of these is already chosen — drives the header tick. */
export function allSelected(selection: Selection, athleteIds: UUID[]): boolean {
  return athleteIds.length > 0 && athleteIds.every((id) => isSelected(selection, id));
}

/**
 * Selection survives filtering, but only for athletes still on the roster.
 *
 * A coach who selects four, filters to a different group, then filters back
 * expects their four to still be chosen. An athlete who has left the roster
 * entirely is dropped rather than silently carried into a batch.
 */
export function reconcile(selection: Selection, roster: RosterEntry[]): Selection {
  const live = new Set(roster.map((e) => e.athleteId));
  return { ids: selection.ids.filter((id) => live.has(id)) };
}

export function selectedEntries(selection: Selection, roster: RosterEntry[]): RosterEntry[] {
  const chosen = new Set(selection.ids);
  return roster.filter((e) => chosen.has(e.athleteId));
}

/** "4 selected", never "4 athletes selected · 4". */
export function selectionLabel(selection: Selection): string {
  const n = selection.ids.length;
  return n === 1 ? '1 selected' : `${n} selected`;
}

/**
 * Which actions make sense for this selection.
 *
 * An adaptation needs something to adapt: an athlete with no programme has no
 * future sessions to shift or scale. Offering the action anyway would produce
 * a review that is entirely "nothing to change", which wastes the coach's
 * time and teaches them to distrust the preview.
 */
export function availableActions(entries: RosterEntry[]): BatchAction[] {
  if (entries.length === 0) return [];

  const anyOnProgramme = entries.some((e) => e.programmeId !== null);
  const anyUnread = entries.some((e) => e.checkIn && !e.checkIn.acknowledgedAt);

  const actions: BatchAction[] = ['assign_template'];
  if (anyOnProgramme) actions.push('scale_volume', 'shift_sessions');
  // offered only when there is something unread, so the button is never a
  // no-op the coach has to click to discover
  if (anyUnread) actions.push('acknowledge_checkin');
  return actions;
}

/** Why an action is not offered, in words rather than a disabled button. */
export function unavailableReason(action: BatchAction, entries: RosterEntry[]): string | null {
  if (entries.length === 0) return 'Select an athlete first.';
  if (action === 'assign_template') return null;

  if (action === 'acknowledge_checkin') {
    return entries.some((e) => e.checkIn && !e.checkIn.acknowledgedAt)
      ? null
      : 'Every selected athlete\'s check-in has already been read.';
  }

  return entries.some((e) => e.programmeId !== null)
    ? null
    : 'None of the selected athletes are on a programme, so there is nothing to adjust.';
}

/* ============================================================
 * THE REVIEW, BEFORE ANYTHING CHANGES
 * ========================================================== */

/** One athlete's row in the review, whatever the action. */
export interface BatchPreviewRow {
  athleteId: UUID;
  athleteName: string;
  /** What would happen if the coach confirmed right now. */
  outcome: Extract<BatchOutcome, 'applied' | 'skipped' | 'blocked' | 'unauthorised'>;
  /** One line the coach can act on. Never a stack trace. */
  summary: string;
  /** Everything worth knowing that is not a blocker. Shown, never resolved. */
  warnings: string[];
  /** Why this athlete cannot be included. */
  blockers: string[];
  /** The action's own detail, for the coach who opens the row. */
  assignment?: AssignmentPreview;
  volume?: VolumeRow[];
  shift?: ShiftRow[];
}

export interface BatchPreview {
  action: BatchAction;
  rows: BatchPreviewRow[];
}

/**
 * The tally under the confirm button.
 *
 * `willChange` is the number the button is allowed to claim. Anything blocked,
 * unauthorised or with nothing to do is excluded from it, so the button can
 * never promise more than the batch will deliver.
 */
export interface BatchTally {
  total: number;
  willChange: number;
  nothingToDo: number;
  blocked: number;
  unauthorised: number;
  warnings: number;
}

export function tally(preview: BatchPreview): BatchTally {
  const rows = preview.rows;
  return {
    total: rows.length,
    willChange: rows.filter((r) => r.outcome === 'applied').length,
    nothingToDo: rows.filter((r) => r.outcome === 'skipped').length,
    blocked: rows.filter((r) => r.outcome === 'blocked').length,
    unauthorised: rows.filter((r) => r.outcome === 'unauthorised').length,
    warnings: rows.filter((r) => r.warnings.length > 0).length,
  };
}

/** The athletes the apply will actually be asked to change. */
export function applicableIds(preview: BatchPreview): UUID[] {
  return preview.rows.filter((r) => r.outcome === 'applied').map((r) => r.athleteId);
}

/** What the confirm button says. It states the number, never "Apply to all". */
export function confirmLabel(action: BatchAction, t: BatchTally): string {
  if (t.willChange === 0) return 'Nothing to apply';

  if (action === 'acknowledge_checkin') {
    return `Mark ${t.willChange} read`;
  }

  const verb = action === 'assign_template' ? 'Assign to'
    : action === 'scale_volume' ? 'Adjust'
      : 'Shift';
  return `${verb} ${t.willChange} ${t.willChange === 1 ? 'athlete' : 'athletes'}`;
}

/** The sentence beside the button, so a coach never has to count the rows. */
export function tallySentence(t: BatchTally): string {
  const parts = [
    `${t.willChange} will change`,
    t.nothingToDo ? `${t.nothingToDo} already as prescribed` : null,
    t.blocked ? `${t.blocked} blocked` : null,
    t.unauthorised ? `${t.unauthorised} not on your roster` : null,
    t.warnings ? `${t.warnings} with warnings` : null,
  ].filter(Boolean);
  return parts.join(' · ');
}

/* ============================================================
 * WHAT ACTUALLY HAPPENED
 * ========================================================== */

export interface BatchResultRow {
  athleteId: UUID;
  athleteName: string;
  outcome: BatchOutcome;
  detail: string;
  /** For an assignment: the programme the athlete now has. */
  programmeId?: UUID | null;
  /** For an adaptation: which of their sessions changed. */
  sessionIds?: UUID[];
}

export interface BatchResult {
  batchId: UUID | null;
  action: BatchAction;
  rows: BatchResultRow[];
}

/**
 * A partial failure must never read as a success.
 *
 * This is the sentence the coach sees afterwards, and it leads with the
 * failures when there are any — a batch that quietly says "7 assigned" while
 * one athlete silently did not is the exact thing this slice must not do.
 */
export function resultSentence(result: BatchResult): string {
  const rows = result.rows;
  const applied = rows.filter((r) => r.outcome === 'applied').length;
  const bad = rows.filter((r) =>
    r.outcome === 'failed' || r.outcome === 'blocked' || r.outcome === 'unauthorised');
  const skipped = rows.filter((r) => r.outcome === 'skipped').length;

  const verb = result.action === 'assign_template' ? 'assigned'
    : result.action === 'scale_volume' ? 'adjusted'
      : result.action === 'acknowledge_checkin' ? 'marked read'
        : 'shifted';

  if (applied === 0 && bad.length === 0) return 'Nothing needed changing.';

  const head = applied > 0
    ? `${applied} ${applied === 1 ? 'athlete' : 'athletes'} ${verb}.`
    : `Nothing was ${verb}.`;

  if (bad.length === 0) {
    return skipped ? `${head} ${skipped} already as prescribed.` : head;
  }

  // named, not counted: the coach has to know who to go back to
  const names = bad.slice(0, 3).map((r) => r.athleteName).join(', ');
  const more = bad.length > 3 ? ` and ${bad.length - 3} more` : '';
  return `${head} ${bad.length === 1 ? 'One athlete was' : `${bad.length} were`} not: ${names}${more}.`;
}

export function succeeded(result: BatchResult): boolean {
  return result.rows.every((r) => r.outcome === 'applied' || r.outcome === 'skipped');
}

/* ============================================================
 * PARAMETERS
 * ========================================================== */

export interface AssignTemplateParams {
  action: 'assign_template';
  templateId: UUID;
  startDate: ISODate;
}

export interface ScaleVolumeParams {
  action: 'scale_volume';
  from: ISODate;
  to: ISODate;
  /** 0.7 to 1.3 in the UI; the database refuses anything above 3 regardless. */
  factor: number;
}

export interface ShiftSessionsParams {
  action: 'shift_sessions';
  from: ISODate;
  to: ISODate;
  days: number;
}

/**
 * Marking read takes no parameters at all.
 *
 * That is the point of it: there is nothing to configure, nothing to get
 * wrong, and nothing said to anybody. It records that the coach looked.
 */
export interface AcknowledgeCheckInParams {
  action: 'acknowledge_checkin';
}

export type BatchParams =
  | AssignTemplateParams
  | ScaleVolumeParams
  | ShiftSessionsParams
  | AcknowledgeCheckInParams;

/**
 * The most athletes one batch may name.
 *
 * Not a performance limit — a blast-radius limit. A coach acting on more than
 * this in one go has almost certainly selected more than they meant to, and
 * the roster is not large enough for it to be otherwise.
 */
export const MAX_BATCH_SIZE = 60;

export function batchSizeError(ids: UUID[]): string | null {
  if (ids.length === 0) return 'Select at least one athlete.';
  if (ids.length > MAX_BATCH_SIZE) {
    return `A single action covers at most ${MAX_BATCH_SIZE} athletes. Narrow the selection.`;
  }
  return null;
}

/** What the coach chose, in one line, for the confirm screen and the record. */
export function describeParams(params: BatchParams): string {
  switch (params.action) {
    case 'assign_template':
      return `starting ${params.startDate}`;
    case 'scale_volume': {
      const pct = Math.round(params.factor * 100);
      return `${pct}% of prescribed distance, ${params.from} to ${params.to}`;
    }
    case 'shift_sessions': {
      const d = Math.abs(params.days);
      const dir = params.days > 0 ? 'later' : 'earlier';
      return `${d} ${d === 1 ? 'day' : 'days'} ${dir}, ${params.from} to ${params.to}`;
    }
    case 'acknowledge_checkin':
      return 'read, not answered';
  }
}
