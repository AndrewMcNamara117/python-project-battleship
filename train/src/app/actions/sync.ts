'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { getServiceRepo } from '@/lib/data';
import { disconnect } from '@/lib/sync/pipeline';
import { syncProvider } from '@/lib/sync/providers';

/** Forget a watch connection: its sealed tokens are deleted, not just hidden. */
export async function disconnectProvider(name: string): Promise<{ ok: boolean; message: string }> {
  const session = await requireSession();
  const provider = syncProvider(name);
  if (!provider) return { ok: false, message: 'Unknown provider.' };
  // service repo because the secrets table has no client policy; the athlete is the session's own
  const { repo } = await getServiceRepo();
  await disconnect(provider, session.userId, repo);
  revalidatePath('/app/profile');
  return { ok: true, message: `${provider.label} disconnected. New activities will no longer arrive.` };
}
