'use server';

import { redirect } from 'next/navigation';
import { getRepo } from '@/lib/data';
import { requireSession } from '@/lib/auth';
import { onboardingStepSchemas } from '@/lib/validation/schemas';
import type { OnboardingData } from '@/lib/domain/types';

/** Save one step. Called as the athlete advances, so nothing is lost on a refresh. */
export async function saveOnboardingStep(
  step: number,
  data: Partial<OnboardingData>,
): Promise<{ ok: boolean; message?: string }> {
  const session = await requireSession();
  const repo = await getRepo();
  await repo.saveOnboarding(session.userId, data, step);
  return { ok: true };
}

/**
 * Final submit. Re-validates every step server-side — the client wizard's
 * per-step validation is a convenience, not a guarantee.
 */
export async function completeOnboarding(data: OnboardingData): Promise<{ ok: boolean; message?: string }> {
  const session = await requireSession();

  const checks = [
    onboardingStepSchemas.personal.safeParse(data.personal),
    onboardingStepSchemas.goal.safeParse(data.goal),
    onboardingStepSchemas.history.safeParse(data.history),
    onboardingStepSchemas.availability.safeParse(data.availability),
    onboardingStepSchemas.health.safeParse(data.health),
    onboardingStepSchemas.preferences.safeParse(data.preferences),
  ];

  const failed = checks.findIndex((c) => !c.success);
  if (failed >= 0) {
    return { ok: false, message: `Step ${failed + 1} still needs attention.` };
  }

  const repo = await getRepo();
  await repo.completeOnboarding(session.userId, data);
  redirect('/app');
}
