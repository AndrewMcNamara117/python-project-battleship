import type { Metadata } from 'next';
import { ActivityList } from '@/components/activity/ActivityList';
import { ActivitySettings } from '@/components/activity/ActivityControls';
import { distanceLabel } from '@/components/activity/ActivityPanels';
import { ImportDropzone } from '@/components/activity/ImportDropzone';
import { AppPage } from '@/components/app/PageHeader';
import { AppHeader, SectionHeading } from '@/components/forge/AppHeader';
import { EmptyState } from '@/components/forge/EmptyState';
import { Rise } from '@/components/motion/Rise';
import { Panel } from '@/components/ui/Panel';
import { requireSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { addDays, startOfWeek, toISODate } from '@/lib/domain/dates';

export const metadata: Metadata = { title: 'Activities' };

/**
 * ACTIVITIES — what the watch recorded.
 *
 * Import sits first, because on this screen it is the job. The list below
 * is every file brought in, each marked by whether it met a session on the
 * plan. Settings sit last: set once, rarely changed.
 */
export default async function ActivitiesPage() {
  const session = await requireSession();
  const repo = await getRepo();
  const [profile, activities] = await Promise.all([repo.getProfile(session.userId), repo.listActivities(session.userId, 60)]);
  if (!profile) throw new Error('Profile not found');

  const units = profile.units;
  const weekStart = startOfWeek(toISODate(new Date()));
  const thisWeek = activities.filter((a) => a.localDate >= weekStart && a.localDate <= addDays(weekStart, 6));
  const weekM = thisWeek.reduce((n, a) => n + a.distanceM, 0);
  const unattached = activities.filter((a) => !a.scheduledWorkoutId).length;

  return (
    <AppPage>
      <AppHeader
        eyebrow="Activities"
        title="From the watch"
        lead="Import a file and it lands on the session it belongs to. Your coach sees the route, the splits and the heart rate beside what they wrote."
        figure={thisWeek.length ? { value: distanceLabel(weekM, units), label: 'recorded this week' } : undefined}
      />

      <Rise>
        <Panel className="mt-7 p-5 sm:p-6">
          <SectionHeading label="Import" />
          <div className="mt-4">
            <ImportDropzone />
          </div>
          <details className="group mt-5 text-[13px] text-ink-secondary">
            <summary className="cursor-pointer font-bold text-ink-body marker:text-mint">Where do I find the file?</summary>
            <ul className="mt-3 space-y-2 leading-relaxed">
              <li><strong className="text-ink-body">Garmin Connect</strong> — open the activity on the website, the cog menu, Export Original (.fit).</li>
              <li><strong className="text-ink-body">COROS</strong> — the activity in the app, Share, Export, choose .fit.</li>
              <li><strong className="text-ink-body">Strava</strong> — the activity on the website, the ⋯ menu, Export Original. Or a bulk export from Settings; the .fit.gz files inside import as they are.</li>
              <li><strong className="text-ink-body">Apple Watch</strong> — use an app that exports .fit or .gpx (HealthFit, RunGap). Direct sync needs the phone app, which is not built yet.</li>
            </ul>
          </details>
        </Panel>
      </Rise>

      <section className="mt-9" aria-labelledby="activity-list">
        <SectionHeading
          label="Recorded"
          action={
            unattached ? (
              <span className="im-micro text-status-progress">
                {unattached} not attached to a session
              </span>
            ) : undefined
          }
        />
        <h2 id="activity-list" className="sr-only">
          Your activities
        </h2>
        <div className="mt-4">
          {activities.length ? (
            <Rise delay={40}>
              <ActivityList activities={activities} units={units} hrefFor={(a) => `/app/activities/${a.id}`} />
            </Rise>
          ) : (
            <EmptyState
              title="Nothing imported yet."
              body="Your manual logs still count. Import a watch file and the session it belongs to will show the route, splits and zones."
            />
          )}
        </div>
      </section>

      <section id="settings" className="mt-9 scroll-mt-24" aria-labelledby="activity-settings">
        <h2 id="activity-settings" className="sr-only">
          Activity settings
        </h2>
        <Rise delay={60}>
          <Panel className="p-5 sm:p-6">
            <SectionHeading label="Zones and privacy" />
            <div className="mt-5 max-w-xl">
              <ActivitySettings maxHeartRate={profile.maxHeartRate} privacyTrimM={profile.privacyTrimM} />
            </div>
          </Panel>
        </Rise>
      </section>
    </AppPage>
  );
}
