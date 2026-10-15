'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';

/** Mark one, or all, of the caller's own notifications read. */
export async function markRead(ids?: string[]): Promise<void> {
  const session = await requireSession();
  if (ids && (!Array.isArray(ids) || ids.length > 200 || ids.some((id) => typeof id !== 'string'))) return;
  if (ids && !ids.length) return;
  const repo = await getRepo();
  await repo.markNotificationsRead(session.userId, ids);
  revalidatePath('/app', 'layout');
}
