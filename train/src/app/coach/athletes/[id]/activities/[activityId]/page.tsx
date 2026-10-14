import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ActivityDetail } from '@/components/activity/ActivityDetail';
import { AppPage } from '@/components/app/PageHeader';
import { AppHeader } from '@/components/forge/AppHeader';
import { ButtonLink } from '@/components/ui/Button';
import { requireCoach } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { formatLongDate } from '@/lib/domain/dates';

export const metadata: Metadata = { title: 'Activity' };

/** The coach's read of an athlete's activity. Read-only: the record is the athlete's. */
export default async function CoachActivityPage({
  params,
}: {
  params: Promise<{ id: string; activityId: string }>;
}) {
  const { id, activityId } = await params;
  const session = await requireCoach();
  const repo = await getRepo();

  // the same gate as the athlete page: a coach sees only athletes linked to them
  const roster = await repo.listAthletesForCoach(session.userId);
  const athlete = roster.find((p) => p.id === id);
  if (!athlete) notFound();

  const activity = await repo.getActivity(activityId);
  if (!activity || activity.athleteId !== athlete.id) notFound();
  const scheduled = activity.scheduledWorkoutId ? await repo.getScheduled(activity.scheduledWorkoutId) : null;

  return (
    <AppPage>
      <AppHeader
        eyebrow={`${athlete.fullName} · ${formatLongDate(activity.localDate)}`}
        title={activity.name}
        lead={scheduled ? `Logged against ${scheduled.name}.` : 'Not attached to a session on the plan.'}
        action={
          <ButtonLink href={`/coach/athletes/${athlete.id}`} variant="ghost" size="sm">
            Back to {athlete.fullName.split(' ')[0]}
          </ButtonLink>
        }
      />
      <div className="mt-7">
        <ActivityDetail
          activity={activity}
          session={scheduled}
          // the coach reads in the athlete's units: it is the athlete's plan
          units={athlete.units}
          maxHr={athlete.maxHeartRate}
          viewer="coach"
        />
      </div>
    </AppPage>
  );
}
