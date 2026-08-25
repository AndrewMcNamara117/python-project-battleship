import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app/AppShell';
import { TopBar } from '@/components/app/TopBar';
import { COACH_NAV } from '@/components/app/nav-config';
import { getSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login?next=/coach');
  if (session.role !== 'coach' && session.role !== 'admin') redirect('/app');

  const repo = await getRepo();
  const profile = await repo.getProfile(session.userId);

  return (
    <AppShell
      items={COACH_NAV}
      sub="Coach"
      topBar={
        <TopBar
          name={profile?.fullName ?? 'Coach'}
          role="Coach"
          isDemo={session.isDemo}
          unread={0}
        />
      }
    >
      {children}
    </AppShell>
  );
}
