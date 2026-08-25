'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';
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
  const repo = await getRepo();
  await repo.deleteAthleteData(session.userId);
  return { ok: true, message: 'Your data has been deleted.' };
}
