import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { OnboardingWizard } from './OnboardingWizard';
import type { OnboardingData } from '@/lib/domain/types';

export const metadata: Metadata = {
  title: 'Onboarding',
  description: 'Set up your Iron Miles training profile.',
};

export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) redirect('/login?next=/onboarding');

  const repo = await getRepo();
  const saved = await repo.getOnboarding(session.userId);

  return (
    <OnboardingWizard
      initial={(saved?.data ?? {}) as Partial<OnboardingData>}
      startStep={saved?.step ?? 1}
    />
  );
}
