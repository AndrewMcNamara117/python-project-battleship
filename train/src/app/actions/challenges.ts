'use server';

import { revalidatePath } from 'next/cache';
import { requireCoach, requireSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { METRICS, type ChallengeMetric } from '@/lib/domain/challenges';
import { daysBetween } from '@/lib/domain/dates';

export interface ChallengeResult {
  ok: boolean;
  message: string;
}

const revalidate = () => {
  revalidatePath('/app/challenges');
  revalidatePath('/coach/challenges');
};

export async function joinChallenge(challengeId: string, join: boolean): Promise<ChallengeResult> {
  const session = await requireSession();
  if (session.role !== 'athlete') return { ok: false, message: 'Challenges are for athletes to join.' };
  const repo = await getRepo();
  try {
    if (join) await repo.joinChallenge(challengeId, session.userId);
    else await repo.leaveChallenge(challengeId, session.userId);
  } catch {
    return { ok: false, message: 'That challenge has closed.' };
  }
  revalidate();
  return { ok: true, message: join ? 'You are in.' : 'You have left it.' };
}

export async function createChallenge(formData: FormData): Promise<ChallengeResult> {
  const session = await requireCoach();
  const name = String(formData.get('name') ?? '').replace(/\s+/g, ' ').trim();
  const description = String(formData.get('description') ?? '').trim().slice(0, 400);
  const metric = String(formData.get('metric') ?? '') as ChallengeMetric;
  const target = Number(formData.get('target'));
  const startsOn = String(formData.get('startsOn') ?? '');
  const endsOn = String(formData.get('endsOn') ?? '');

  if (name.length < 3 || name.length > 80) return { ok: false, message: 'Give it a name (3–80 characters).' };
  if (!(metric in METRICS)) return { ok: false, message: 'Choose what counts.' };
  if (!Number.isFinite(target) || target <= 0 || target > 10000) return { ok: false, message: 'Set a target above zero.' };
  if (METRICS[metric].integer && !Number.isInteger(target)) return { ok: false, message: 'That target is a whole number.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startsOn) || !/^\d{4}-\d{2}-\d{2}$/.test(endsOn)) return { ok: false, message: 'Set both dates.' };
  const span = daysBetween(startsOn, endsOn);
  if (span < 0) return { ok: false, message: 'It has to end after it starts.' };
  if (span > 366) return { ok: false, message: 'Keep a challenge within a year.' };

  const repo = await getRepo();
  try {
    await repo.createChallenge({ name, description, metric, target, startsOn, endsOn, createdBy: session.userId });
  } catch {
    return { ok: false, message: 'The challenge could not be saved.' };
  }
  revalidate();
  return { ok: true, message: `“${name}” is set. Athletes can join it now.` };
}

export async function archiveChallenge(challengeId: string, archived: boolean): Promise<ChallengeResult> {
  const session = await requireCoach();
  const repo = await getRepo();
  const challenge = await repo.getChallenge(challengeId);
  // 0027: only the coach who set it (or an admin) changes it; say so rather than fail silently
  if (!challenge || (challenge.createdBy !== session.userId && session.role !== 'admin')) {
    return { ok: false, message: 'Only the coach who set this challenge can retire it.' };
  }
  await repo.setChallengeArchived(challengeId, archived);
  revalidate();
  return { ok: true, message: archived ? 'Retired.' : 'Back in use.' };
}
