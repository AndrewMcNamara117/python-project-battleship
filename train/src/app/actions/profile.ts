'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { hasSupabase } from '@/lib/env';
import { getStripe, stripeConfigured } from '@/lib/stripe/server';
import { createAdminSupabase, createServerSupabase } from '@/lib/supabase/server';
import type { Units } from '@/lib/domain/types';

export interface Result {
  ok: boolean;
  message: string;
}

export async function updatePreferences(formData: FormData): Promise<Result> {
  const session = await requireSession();
  const repo = await getRepo();

  await repo.updateProfile(session.userId, {
    fullName: String(formData.get('fullName') ?? '').trim().slice(0, 120) || undefined,
    location: String(formData.get('location') ?? '').trim().slice(0, 160),
    timezone: String(formData.get('timezone') ?? 'Europe/Dublin'),
    units: (formData.get('units') === 'imperial' ? 'imperial' : 'metric') as Units,
  });

  revalidatePath('/app/profile');
  return { ok: true, message: 'Saved.' };
}

export async function updatePrivacy(
  leaderboardOptIn: boolean,
  forgeAssistantEnabled: boolean,
): Promise<Result> {
  const session = await requireSession();
  const repo = await getRepo();
  await repo.updateProfile(session.userId, { leaderboardOptIn, forgeAssistantEnabled });
  revalidatePath('/app/profile');
  revalidatePath('/app/leaderboard');
  revalidatePath('/app');
  return { ok: true, message: 'Updated.' };
}

/** GDPR export — everything held about the athlete, as one JSON document. */
export async function exportMyData(): Promise<{ ok: boolean; json: string }> {
  const session = await requireSession();
  const repo = await getRepo();
  const data = await repo.exportAthleteData(session.userId);
  return { ok: true, json: JSON.stringify(data, null, 2) };
}

/**
 * Account deletion. Irreversible, and deliberately requires the athlete to type
 * their email — a single click should not be able to destroy a training history.
 */
export async function deleteMyAccount(confirmation: string): Promise<Result> {
  const session = await requireSession();
  if (confirmation.trim().toLowerCase() !== session.email.toLowerCase()) {
    return { ok: false, message: 'Type your email address exactly to confirm.' };
  }
  if (!hasSupabase) {
    const repo = await getRepo();
    await repo.deleteAthleteData(session.userId);
    return { ok: true, message: 'Your data has been deleted.' };
  }

  // A user cannot delete their own profile row (no policy allows it), so the
  // old path matched nothing, raised nothing, and told the athlete their data
  // was gone. Deletion is the server's: stop any billing first, so nobody is
  // charged for an account that no longer exists, then delete the sign-in —
  // which cascades through profiles to every row they own (0002).
  const repo = await getRepo();
  const subscription = await repo.getSubscription(session.userId);
  if (subscription?.stripeSubscriptionId && stripeConfigured() && subscription.status !== 'canceled') {
    try {
      await getStripe().subscriptions.cancel(subscription.stripeSubscriptionId);
    } catch {
      return { ok: false, message: 'Your subscription could not be cancelled, so nothing was deleted. Try again, or contact your coach.' };
    }
  }
  const admin = createAdminSupabase();
  const { error } = await admin.auth.admin.deleteUser(session.userId);
  if (error) return { ok: false, message: 'Your account could not be deleted. Nothing was removed — try again.' };
  const { data: left } = await admin.from('profiles').select('id').eq('id', session.userId).maybeSingle();
  if (left) return { ok: false, message: 'Your account could not be deleted. Nothing was removed — try again.' };

  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  return { ok: true, message: 'Your account and all its data have been deleted.' };
}
