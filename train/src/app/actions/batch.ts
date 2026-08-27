'use server';

import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { batchSizeError } from '@/lib/domain/batch';
import { previewBatch, runBatch } from '@/lib/coach/batch-runner';
import type { BatchParams, BatchPreview, BatchResult } from '@/lib/domain/batch';
import type { Result } from './coach';

/**
 * One coaching decision, applied to several athletes.
 *
 * The two actions mirror every other consequential change in Iron Miles:
 * preview first, apply only what the coach confirmed. Nothing here decides
 * anything — `previewBatch` and `runBatch` loop the existing single-athlete
 * operations, and those still own every rule about what may change.
 */

function validate(athleteIds: string[], params: BatchParams): string | null {
  const size = batchSizeError(athleteIds);
  if (size) return size;

  // The database refuses anything above 3x regardless; this is the narrower
  // range the UI offers, so a hand-crafted request cannot quietly exceed it.
  if (params.action === 'scale_volume') {
    if (!(params.factor > 0.5 && params.factor < 1.5)) {
      return 'A volume adjustment runs from 50% to 150%. Rewrite the sessions instead.';
    }
  }
  if (params.action === 'shift_sessions') {
    if (!Number.isInteger(params.days) || params.days === 0 || Math.abs(params.days) > 21) {
      return 'A shift runs from 1 to 21 days, in either direction.';
    }
  }
  return null;
}

export async function previewBatchAction(
  athleteIds: string[],
  params: BatchParams,
): Promise<{ ok: false; message: string } | { ok: true; preview: BatchPreview }> {
  const session = await requireCoach();

  const invalid = validate(athleteIds, params);
  if (invalid) return { ok: false, message: invalid };

  // deduplicated so a doubled id cannot double an athlete's adjustment
  const unique = [...new Set(athleteIds)];
  return { ok: true, preview: await previewBatch(session.userId, unique, params) };
}

export async function runBatchAction(
  athleteIds: string[],
  params: BatchParams,
): Promise<{ ok: false; message: string } | { ok: true; result: BatchResult }> {
  const session = await requireCoach();

  const invalid = validate(athleteIds, params);
  if (invalid) return { ok: false, message: invalid };

  const unique = [...new Set(athleteIds)];
  // the coach id is the authenticated session's, never a value from the client
  const result = await runBatch(session.userId, unique, params);

  // every athlete the batch touched, plus the coach's own views of them
  revalidatePath('/coach');
  revalidatePath('/coach/athletes');
  revalidatePath('/coach/checkins');
  for (const row of result.rows) {
    if (row.outcome === 'applied') revalidatePath(`/coach/athletes/${row.athleteId}`);
  }
  revalidatePath('/app');
  revalidatePath('/app/calendar');
  revalidatePath('/app/today');

  return { ok: true, result };
}

/** The batches that touched one athlete — "why did this change?" */
export async function loadBatchHistory(athleteId: string): Promise<Result & {
  rows?: Awaited<ReturnType<Awaited<ReturnType<typeof getRepo>>['listBatchHistory']>>;
}> {
  await requireCoach();
  const repo = await getRepo();
  return { ok: true, message: '', rows: await repo.listBatchHistory(athleteId, 10) };
}
