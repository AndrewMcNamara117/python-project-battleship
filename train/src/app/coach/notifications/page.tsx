import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { NotificationFeed } from '@/components/notifications/NotificationFeed';
import { NotificationSettings } from '@/components/notifications/NotificationSettings';
import { requireCoach } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { availableChannels } from '@/lib/notifications/channels';

export const metadata: Metadata = { title: 'Notifications' };

/**
 * What Iron Miles told you, and how it should tell you.
 *
 * Feed and settings on one page deliberately: the moment a coach wants to
 * change how often they are interrupted is the moment they are looking at
 * something that interrupted them.
 */
export default async function NotificationsPage() {
  const session = await requireCoach();
  const repo = await getRepo();

  const [items, preferences] = await Promise.all([
    repo.listNotificationFeed(session.userId),
    repo.getNotificationPreferences(session.userId),
  ]);

  const unread = items.filter((i) => i.state === 'pending').length;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Notifications"
        title={unread ? `${unread} waiting` : 'All caught up'}
        lead="Everything here comes from the same signals as your roster. If a notification says an athlete needs a look, their row says so too."
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-start">
        <section aria-label="Recent notifications">
          <NotificationFeed items={items} />
        </section>

        <section aria-label="Notification preferences">
          <h2 className="im-eyebrow mb-4">How you are told</h2>
          <NotificationSettings preferences={preferences} available={availableChannels()} />
        </section>
      </div>
    </AppPage>
  );
}
