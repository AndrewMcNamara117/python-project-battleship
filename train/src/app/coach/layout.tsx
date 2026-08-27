import { redirect } from 'next/navigation';
import { AppShell } from '@/components/app/AppShell';
import { TopBar } from '@/components/app/TopBar';
import { COACH_MOBILE_NAV, COACH_NAV } from '@/components/app/nav-config';
import { getSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';

export default async function CoachLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login?next=/coach');
  if (session.role !== 'coach' && session.role !== 'admin') redirect('/app');

  const repo = await getRepo();
  const [profile, feed] = await Promise.all([
    repo.getProfile(session.userId),
    repo.listNotificationFeed(session.userId),
  ]);

  return (
    <AppShell
      items={COACH_NAV}
      mobileItems={COACH_MOBILE_NAV}
      sub="Coach"
      topBar={
        <TopBar
          name={profile?.fullName ?? 'Coach'}
          role="Coach"
          home="/coach"
          isDemo={session.isDemo}
          unread={0}
          notifications={feed.filter((n) => n.state === 'pending').length}
        />
      }
    >
      {children}
    </AppShell>
  );
}
