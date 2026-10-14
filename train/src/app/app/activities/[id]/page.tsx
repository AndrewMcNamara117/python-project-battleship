import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AttachPicker, DeleteActivity, RenameActivity } from '@/components/activity/ActivityControls';
import { ActivityDetail } from '@/components/activity/ActivityDetail';
import { AppPage } from '@/components/app/PageHeader';
import { AppHeader } from '@/components/forge/AppHeader';
import { ButtonLink } from '@/components/ui/Button';
import { attachOptions } from '@/lib/activity/service';
import { requireSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { addDays, formatDayMonth, formatDistance, formatLongDate } from '@/lib/domain/dates';
import { WORKOUT_TYPE_LABELS } from '@/lib/domain/types';

export const metadata: Metadata = { title: 'Activity' };

export default async function ActivityPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const repo = await getRepo();
  const activity = await repo.getActivity(id);
  // somebody else's activity reads exactly like a missing one
  if (!activity || activity.athleteId !== session.userId) notFound();

  const [profile, scheduled, completed] = await Promise.all([
    repo.getProfile(session.userId),
    activity.scheduledWorkoutId ? repo.getScheduled(activity.scheduledWorkoutId) : Promise.resolve(null),
    activity.completedWorkoutId
      ? // attaching allows the day either side, for a run that crossed midnight
        repo.listCompleted(session.userId, addDays(activity.localDate, -1), addDays(activity.localDate, 1))
      : Promise.resolve([]),
  ]);
  if (!profile) notFound();
  const units = profile.units;

  const options = scheduled ? [] : await attachOptions(repo, activity);
  const createdLog = completed.some((c) => c.id === activity.completedWorkoutId && c.source === 'upload');

  return (
    <AppPage>
      <AppHeader
        eyebrow={formatLongDate(activity.localDate)}
        title={activity.name}
        lead={scheduled ? `Logged against ${scheduled.name}.` : 'Not attached to a session on your plan.'}
        action={
          <ButtonLink href="/app/activities" variant="ghost" size="sm">
            All activities
          </ButtonLink>
        }
      />
      <div className="mt-7">
        <ActivityDetail
          activity={activity}
          session={scheduled}
          units={units}
          maxHr={profile.maxHeartRate}
          viewer="athlete"
          controls={
            <>
              <RenameActivity activityId={activity.id} name={activity.name} />
              <DeleteActivity activityId={activity.id} createdLog={createdLog} />
            </>
          }
          attach={
            <AttachPicker
              activityId={activity.id}
              options={options.map((o) => ({
                id: o.id,
                label: o.name,
                detail: [
                  formatDayMonth(o.date),
                  WORKOUT_TYPE_LABELS[o.type],
                  o.distanceKm ? formatDistance(o.distanceKm, units) : null,
                  o.status === 'completed' ? 'already logged — adds the file’s numbers' : null,
                ]
                  .filter(Boolean)
                  .join(' · '),
              }))}
            />
          }
        />
      </div>
    </AppPage>
  );
}
