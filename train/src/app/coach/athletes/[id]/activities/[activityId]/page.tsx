import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ActivityDetail } from '@/components/activity/ActivityDetail';
import { CommentThread } from '@/components/activity/Social';
import { SectionHeading } from '@/components/forge/AppHeader';
import { Panel } from '@/components/ui/Panel';
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
  const [scheduled, social] = await Promise.all([
    activity.scheduledWorkoutId ? repo.getScheduled(activity.scheduledWorkoutId) : Promise.resolve(null),
    repo.getActivitySocial(session.userId, activity.id),
  ]);

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
          social={
            <Panel className="p-5 sm:p-6">
              <SectionHeading
                label="Comments"
                action={
                  <span className="im-micro text-ink-tertiary">
                    {activity.visibility === 'club' ? `Shared with the club · ${social.kudos.length} kudos` : 'Not shared — only you and the athlete see this'}
                  </span>
                }
              />
              <div className="mt-4">
                <CommentThread activityId={activity.id} comments={social.comments} viewerId={session.userId} canModerate canComment />
              </div>
            </Panel>
          }
        />
      </div>
    </AppPage>
  );
}
