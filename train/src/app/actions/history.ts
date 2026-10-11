'use server';

import { requireCoachOf } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import type { SessionHistory } from '@/lib/domain/adaptation';

/** What happened to one session, for the coach who prescribes for this athlete. */
export async function loadSessionHistory(
  sessionId: string,
): Promise<{ ok: boolean; message: string; history?: SessionHistory }> {
  const repo = await getRepo();
  const session = await repo.getScheduled(sessionId);
  if (!session) return { ok: false, message: 'That session no longer exists.' };

  const { authorised } = await requireCoachOf(session.athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  return { ok: true, message: '', history: await repo.getSessionHistory(sessionId) };
}
