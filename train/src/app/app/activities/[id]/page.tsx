import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AttachPicker, DeleteActivity, RenameActivity } from '@/components/activity/ActivityControls';
import { CommentThread, KudosButton, ShareToggle } from '@/components/activity/Social';
import { ActivitySegments } from '@/components/activity/SegmentPanels';
import { BestEffortsPanel } from '@/components/activity/Records';
import { SectionHeading } from '@/components/forge/AppHeader';
import { Panel } from '@/components/ui/Panel';
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

  const [options, social, efforts, segmentList, history, allActivities] = await Promise.all([
    scheduled ? Promise.resolve([]) : attachOptions(repo, activity),
    repo.getActivitySocial(session.userId, activity.id),
    repo.listEffortsForActivity(activity.id),
    repo.listSegments(true),
    repo.listEfforts(session.userId),
    repo.listActivities(session.userId, Infinity),
  ]);
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
          records={<BestEffortsPanel activity={activity} others={allActivities} units={units} />}
          segments={
            <ActivitySegments
              efforts={efforts}
              segments={segmentList}
              history={history}
              units={units}
              hrefFor={(sid) => `/app/segments/${sid}`}
            />
          }
          social={
            <Panel as="section" className="scroll-mt-24 space-y-6 p-5 sm:p-6">
              <span id="comments" className="sr-only">Comments</span>
              <ShareToggle activityId={activity.id} shared={activity.visibility === 'club'} />
              {(activity.visibility === 'club' || social.comments.length > 0) && (
                <div className="border-t border-hairline pt-5">
                  <SectionHeading
                    label="Kudos and comments"
                    action={<KudosButton activityId={activity.id} given={false} count={social.kudos.length} disabled />}
                  />
                  {social.kudos.length > 0 && (
                    <p className="mt-3 text-[12px] leading-relaxed text-ink-secondary">
                      From {social.kudos.map((k) => k.name).join(', ')}
                    </p>
                  )}
                  <div className="mt-4">
                    <CommentThread
                      activityId={activity.id}
                      comments={social.comments}
                      viewerId={session.userId}
                      canModerate
                      canComment
                    />
                  </div>
                </div>
              )}
            </Panel>
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
