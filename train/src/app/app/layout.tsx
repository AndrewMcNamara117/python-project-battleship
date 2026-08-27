import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app/AppShell';
import { TopBar } from '@/components/app/TopBar';
import { ATHLETE_NAV, MOBILE_NAV } from '@/components/app/nav-config';
import { getSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login?next=/app');
  if (session.role === 'coach' || session.role === 'admin') redirect('/coach');

  const repo = await getRepo();
  const [profile, messages] = await Promise.all([
    repo.getProfile(session.userId),
    repo.listMessages(session.userId),
  ]);

  // an athlete who has not onboarded has no programme to look at
  if (profile && !profile.onboardedAt) redirect('/onboarding');

  const unread = messages.filter((m) => m.recipientId === session.userId && !m.readAt).length;

  return (
    <AppShell
      items={ATHLETE_NAV}
      mobileItems={MOBILE_NAV}
      sub="Training"
      topBar={
        <TopBar
          name={profile?.fullName ?? 'Athlete'}
          role="Athlete"
          isDemo={session.isDemo}
          unread={unread}
        />
      }
    >
      {children}
    </AppShell>
  );
}
