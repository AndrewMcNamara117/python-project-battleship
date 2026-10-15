import type { Metadata } from 'next';
import { AppPage } from '@/components/app/PageHeader';
import { InboxList } from '@/components/app/InboxList';
import { AppHeader } from '@/components/forge/AppHeader';
import { EmptyState } from '@/components/forge/EmptyState';
import { Rise } from '@/components/motion/Rise';
import { ButtonLink } from '@/components/ui/Button';
import { requireSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';

export const metadata: Metadata = { title: 'Notifications' };

export default async function AthleteNotificationsPage() {
  const session = await requireSession();
  const repo = await getRepo();
  const items = await repo.listNotifications(session.userId);

  return (
    <AppPage>
      <AppHeader
        eyebrow="Notifications"
        title="What you missed"
        lead="Kudos and comments on your activities, and reminders from the platform."
        action={
          <ButtonLink href="/app/activities#settings" variant="ghost" size="sm">
            Settings
          </ButtonLink>
        }
      />
      <div className="mx-auto mt-7 max-w-2xl">
        {items.length ? (
          <Rise>
            <InboxList items={items} />
          </Rise>
        ) : (
          <EmptyState title="Nothing yet." body="When someone gives kudos or comments on a run you shared, it shows up here." />
        )}
      </div>
    </AppPage>
  );
}
