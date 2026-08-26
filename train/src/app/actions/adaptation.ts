'use server';

import { revalidatePath } from 'next/cache';
import { requireCoachOf } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import type { Result } from './coach';
import type { ShiftRow, VolumeRow } from '@/lib/domain/adaptation';

/**
 * Adapting an athlete's live programme.
 *
 * Every action re-checks the roster. Row-level security enforces the same
 * rule, and the database refuses completed training regardless — these checks
 * exist so a refusal reads as a sentence.
 */

function refresh(athleteId: string) {
  revalidatePath(`/coach/athletes/${athleteId}`);
  revalidatePath('/app');
  revalidatePath('/app/calendar');
  revalidatePath('/app/training');
  revalidatePath('/app/today');
}

export async function moveSession(
  athleteId: string,
  sessionId: string,
  date: string,
  slot?: number,
): Promise<Result> {
  const { authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  const repo = await getRepo();
  try {
    await repo.moveSession(sessionId, date, slot);
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
  refresh(athleteId);
  return { ok: true, message: 'Moved. The athlete sees it now.' };
}

export async function swapSessions(athleteId: string, a: string, b: string): Promise<Result> {
  const { authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  const repo = await getRepo();
  try {
    await repo.swapSessions(a, b);
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
  refresh(athleteId);
  return { ok: true, message: 'Swapped.' };
}

/** Preview writes nothing. The rows it returns are the rows apply will act on. */
export async function previewShift(
  athleteId: string,
  from: string,
  to: string,
  days: number,
): Promise<{ ok: boolean; message: string; rows?: ShiftRow[] }> {
  const { authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  const repo = await getRepo();
  try {
    return { ok: true, message: '', rows: await repo.shiftSessions(athleteId, from, to, days, false) };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

export async function applyShift(
  athleteId: string,
  from: string,
  to: string,
  days: number,
): Promise<Result & { rows?: ShiftRow[] }> {
  const { authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  const repo = await getRepo();
  try {
    const rows = await repo.shiftSessions(athleteId, from, to, days, true);
    const moved = rows.filter((r) => r.action === 'move').length;
    refresh(athleteId);
    return {
      ok: true,
      rows,
      message: moved
        ? `${moved} session(s) moved. The athlete sees the new dates now.`
        : 'Nothing moved — everything in that range was protected or already in place.',
    };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

export async function previewVolume(
  athleteId: string,
  from: string,
  to: string,
  percent: number,
): Promise<{ ok: boolean; message: string; rows?: VolumeRow[] }> {
  const { authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  const repo = await getRepo();
  try {
    return { ok: true, message: '', rows: await repo.scaleVolume(athleteId, from, to, percent / 100, false) };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

export async function applyVolume(
  athleteId: string,
  from: string,
  to: string,
  percent: number,
): Promise<Result & { rows?: VolumeRow[] }> {
  const { authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  const repo = await getRepo();
  try {
    const rows = await repo.scaleVolume(athleteId, from, to, percent / 100, true);
    const scaled = rows.filter((r) => r.action === 'scale').length;
    refresh(athleteId);
    return {
      ok: true,
      rows,
      message: scaled
        ? `${scaled} session(s) adjusted.`
        : 'Nothing changed — no session in that range is prescribed by distance.',
    };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

/** Database refusals are written to be read; anything else gets a plain sentence. */
function messageFor(error: unknown): string {
  const raw = error instanceof Error ? error.message : '';
  if (/completed|logged result|already a session|outside the programme|roster|backwards|zero days|Tripling|not a volume/i.test(raw)) {
    return raw;
  }
  return 'That did not work. Try again.';
}
