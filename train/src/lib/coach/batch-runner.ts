import 'server-only';
import { getRepo } from '@/lib/data';
import { isBlocking } from '@/lib/domain/programme-template';
import { describeParams } from '@/lib/domain/batch';
import { toISODate } from '@/lib/domain/dates';
import type {
  BatchAction, BatchParams, BatchPreview, BatchPreviewRow,
  BatchResult, BatchResultRow,
} from '@/lib/domain/batch';
import type { IronMilesRepo } from '@/lib/data/repo';
import type { ShiftRow, VolumeRow } from '@/lib/domain/adaptation';
import type { Profile, UUID } from '@/lib/domain/types';

/**
 * RUNNING ONE COACHING DECISION ACROSS SEVERAL ATHLETES.
 *
 * This file is a loop. That is the entire architectural claim of the slice.
 *
 * There is no batch assignment logic, no batch volume logic, and no batch
 * authorisation. Each athlete goes through exactly the same call a coach makes
 * for one athlete — `previewAssignment`, `scaleVolume`, `shiftSessions` — each
 * of which already refuses an athlete the coach does not have, refuses to
 * touch completed training, refuses to move a session into the past or out of
 * its programme, and reports per session what it did.
 *
 * Three consequences follow from doing it this way rather than with a
 * privileged function taking uuid[]:
 *
 *   * Authorisation is per athlete. The roster is resolved once here as
 *     defence in depth, and the database's own `im_is_coach_of` runs again
 *     inside every operation — which is the actual enforcement boundary. A
 *     list containing one athlete the coach does not have loses that athlete
 *     and nothing else.
 *   * Each athlete is its own statement, so one failing cannot roll back the
 *     others. Partial failure is a real state, and it is reported as one.
 *   * There is one definition of "assign a programme". A batch cannot drift
 *     from a single assignment because it *is* single assignments.
 */

/** One athlete's check-in as the batch needs it: which one, and its state. */
interface CheckInState {
  checkInId: UUID | null;
  acknowledgedAt: string | null;
  attention: 'none' | 'watch' | 'attention';
  weekStart: string | null;
}

/**
 * Check-in state for the whole selection, taken from the roster the coach is
 * already looking at. One query, and the preview cannot disagree with the row
 * above it.
 */
async function checkInIndex(repo: IronMilesRepo, coachId: UUID): Promise<Map<UUID, CheckInState>> {
  const roster = await repo.listRoster(coachId, toISODate(new Date()));
  return new Map(roster.map((e) => [e.athleteId, {
    checkInId: e.checkIn?.id ?? null,
    acknowledgedAt: e.checkIn?.acknowledgedAt ?? null,
    attention: e.checkIn?.attention ?? 'none',
    weekStart: e.checkIn?.weekStart ?? null,
  }]));
}

/**
 * The coach's roster, resolved once rather than per athlete.
 *
 * `coachId` comes from the server action, which has already authenticated —
 * it is never a value from the client. This index is defence in depth and a
 * source of names for the report; the enforcement boundary remains the
 * database's own `im_is_coach_of`, which runs again inside every operation
 * below whatever this map says.
 */
async function rosterIndex(repo: IronMilesRepo, coachId: UUID): Promise<Map<UUID, Profile>> {
  const athletes = await repo.listAthletesForCoach(coachId);
  return new Map(athletes.map((a) => [a.id, a]));
}

/* ============================================================
 * PREVIEW — nothing is written
 * ========================================================== */

export async function previewBatch(
  coachId: UUID,
  athleteIds: UUID[],
  params: BatchParams,
): Promise<BatchPreview> {
  const repo = await getRepo();
  const mine = await rosterIndex(repo, coachId);
  const checkIns = params.action === 'acknowledge_checkin'
    ? await checkInIndex(repo, coachId)
    : null;
  const rows: BatchPreviewRow[] = [];

  for (const athleteId of athleteIds) {
    rows.push(await previewOne(repo, mine, athleteId, params, checkIns));
  }

  return { action: params.action, rows };
}

async function previewOne(
  repo: IronMilesRepo,
  mine: Map<UUID, Profile>,
  athleteId: UUID,
  params: BatchParams,
  checkIns: Map<UUID, CheckInState> | null,
): Promise<BatchPreviewRow> {
  const profile = mine.get(athleteId);
  if (!profile) {
    return {
      athleteId,
      athleteName: 'Not your athlete',
      outcome: 'unauthorised',
      summary: 'Not on your roster.',
      warnings: [],
      blockers: ['This athlete is not on your roster.'],
    };
  }

  const athleteName = profile.fullName;

  try {
    switch (params.action) {
      case 'assign_template': {
        const preview = await repo.previewAssignment(
          params.templateId, athleteId, params.startDate);

        const blockers = preview.conflicts.filter(isBlocking).map((c) => c.detail);
        const warnings = preview.conflicts.filter((c) => !isBlocking(c)).map((c) => c.detail);

        return {
          athleteId,
          athleteName: preview.athleteName || athleteName,
          outcome: blockers.length ? 'blocked' : 'applied',
          summary: blockers.length
            ? blockers[0]
            : `${preview.weeks.length} weeks · ${preview.startDate} to ${preview.endDate}`,
          warnings,
          blockers,
          assignment: preview,
        };
      }

      case 'scale_volume': {
        const rows = await repo.scaleVolume(
          athleteId, params.from, params.to, params.factor, false);
        return adaptationRow(athleteId, athleteName, rows, 'volume');
      }

      case 'shift_sessions': {
        const rows = await repo.shiftSessions(
          athleteId, params.from, params.to, params.days, false);
        return adaptationRow(athleteId, athleteName, rows, 'shift');
      }

      case 'acknowledge_checkin':
        return acknowledgeRow(athleteId, athleteName, checkIns?.get(athleteId));
    }
  } catch (error) {
    // a refusal from the database is a blocker for this athlete alone
    return {
      athleteId,
      athleteName,
      outcome: 'blocked',
      summary: message(error),
      warnings: [],
      blockers: [message(error)],
    };
  }
}

/**
 * A volume or shift preview, read as one line.
 *
 * The existing functions already classify every session: `scale`/`move` for
 * what would change, `keep` for what is deliberately left alone (the past, a
 * rest day, a session prescribed by time rather than distance), and `blocked`
 * for completed training. Nothing is reinterpreted here — the rows are counted
 * and the protected ones are named.
 */
function adaptationRow(
  athleteId: UUID,
  athleteName: string,
  rows: (ShiftRow | VolumeRow)[],
  kind: 'volume' | 'shift',
): BatchPreviewRow {
  const changing = rows.filter((r) => r.action === 'scale' || r.action === 'move');
  const blocked = rows.filter((r) => r.action === 'blocked');
  const kept = rows.filter((r) => r.action === 'keep');

  const detail = kind === 'volume'
    ? { volume: rows as VolumeRow[] }
    : { shift: rows as ShiftRow[] };
  const verb = kind === 'volume' ? 'adjusted' : 'moved';

  if (changing.length === 0) {
    return {
      athleteId,
      athleteName,
      outcome: 'skipped',
      summary: blocked.length
        ? `Nothing to change — ${blocked.length} already completed.`
        : kept.length
          ? 'Nothing to change in that range.'
          : 'No sessions in that range.',
      warnings: [],
      blockers: [],
      ...detail,
    };
  }

  return {
    athleteId,
    athleteName,
    outcome: 'applied',
    summary: `${changing.length} ${changing.length === 1 ? 'session' : 'sessions'} ${verb}`,
    // completed training is not an error and never stops the rest. It is
    // reported so the coach knows the week is not quite what they think.
    warnings: blocked.length
      ? [`${blocked.length} ${blocked.length === 1 ? 'session is' : 'sessions are'} already completed and will not change.`]
      : [],
    blockers: [],
    ...detail,
  };
}

/* ============================================================
 * APPLY — one athlete at a time, one statement each
 * ========================================================== */

export async function runBatch(
  coachId: UUID,
  athleteIds: UUID[],
  params: BatchParams,
): Promise<BatchResult> {
  const repo = await getRepo();
  const mine = await rosterIndex(repo, coachId);
  const checkIns = params.action === 'acknowledge_checkin'
    ? await checkInIndex(repo, coachId)
    : null;

  // opened first, so a batch that dies halfway still has a record of what it
  // was trying to do and how many athletes it expected to touch
  const batchId = await repo.openBatch(
    params.action,
    { ...params, described: describeParams(params) },
    athleteIds.length,
  );

  const rows: BatchResultRow[] = [];

  for (const athleteId of athleteIds) {
    const row = await applyOne(repo, mine, athleteId, params, checkIns, coachId);
    rows.push(row);

    // filed as each athlete finishes rather than in one write at the end, so
    // a crash mid-batch leaves a truthful partial record rather than none
    try {
      await repo.recordBatchItem(batchId, athleteId, row.outcome, row.detail, {
        programmeId: row.programmeId ?? null,
        sessionIds: row.sessionIds ?? [],
      });
    } catch {
      // the athlete's own change already succeeded or failed on its own terms.
      // Failing to file the paperwork must not change what happened to them.
    }
  }

  return { batchId, action: params.action, rows };
}

async function applyOne(
  repo: IronMilesRepo,
  mine: Map<UUID, Profile>,
  athleteId: UUID,
  params: BatchParams,
  checkIns: Map<UUID, CheckInState> | null,
  coach: UUID,
): Promise<BatchResultRow> {
  const profile = mine.get(athleteId);
  if (!profile) {
    return {
      athleteId,
      athleteName: 'Not your athlete',
      outcome: 'unauthorised',
      detail: 'This athlete is not on your roster.',
    };
  }

  const athleteName = profile.fullName;

  try {
    switch (params.action) {
      case 'assign_template': {
        const programmeId = await repo.assignProgramTemplate(
          params.templateId, athleteId, params.startDate);
        return {
          athleteId, athleteName, outcome: 'applied',
          detail: `Assigned, starting ${params.startDate}.`,
          programmeId,
        };
      }

      case 'scale_volume': {
        const rows = await repo.scaleVolume(
          athleteId, params.from, params.to, params.factor, true);
        return adaptationResult(athleteId, athleteName, rows, 'adjusted');
      }

      case 'shift_sessions': {
        const rows = await repo.shiftSessions(
          athleteId, params.from, params.to, params.days, true);
        return adaptationResult(athleteId, athleteName, rows, 'moved');
      }

      case 'acknowledge_checkin': {
        const state = checkIns?.get(athleteId);
        if (!state?.checkInId) {
          return {
            athleteId, athleteName, outcome: 'skipped',
            detail: 'No check-in to read.',
          };
        }
        // the same single-athlete operation, which re-checks the roster in the
        // database whatever this loop believes
        const changed = await repo.acknowledgeCheckIn(state.checkInId, coach);
        return {
          athleteId, athleteName,
          outcome: changed ? 'applied' : 'skipped',
          detail: changed ? 'Marked read.' : 'Already read.',
        };
      }
    }
  } catch (error) {
    // this athlete alone. The loop continues; the others are untouched.
    return { athleteId, athleteName, outcome: 'failed', detail: message(error) };
  }
}

/**
 * What marking read would do to one athlete.
 *
 * Deliberately says what it will NOT do. A coach acting on twenty-five
 * check-ins should not have to wonder whether they have just cleared a flagged
 * one off their roster — so the row that carries a flag says so.
 */
function acknowledgeRow(
  athleteId: UUID,
  athleteName: string,
  state: CheckInState | undefined,
): BatchPreviewRow {
  if (!state?.checkInId) {
    return {
      athleteId, athleteName, outcome: 'skipped',
      summary: 'No check-in to read.', warnings: [], blockers: [],
    };
  }
  if (state.acknowledgedAt) {
    return {
      athleteId, athleteName, outcome: 'skipped',
      summary: 'Already read.', warnings: [], blockers: [],
    };
  }

  return {
    athleteId,
    athleteName,
    outcome: 'applied',
    summary: `Check-in from ${state.weekStart} — marked read, not answered.`,
    warnings: state.attention === 'attention'
      ? ['Flagged for review. Reading it does not settle it — it stays on the roster until you reply.']
      : [],
    blockers: [],
  };
}

function adaptationResult(
  athleteId: UUID,
  athleteName: string,
  rows: (ShiftRow | VolumeRow)[],
  verb: string,
): BatchResultRow {
  const changed = rows.filter((r) => r.action === 'scale' || r.action === 'move');
  return {
    athleteId,
    athleteName,
    outcome: changed.length ? 'applied' : 'skipped',
    detail: changed.length
      ? `${changed.length} ${changed.length === 1 ? 'session' : 'sessions'} ${verb}.`
      : 'Nothing needed changing.',
    sessionIds: changed.map((r) => r.sessionId),
  };
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : 'The change was refused.';
}

export type { BatchAction, BatchParams };
