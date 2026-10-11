import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { requireCoach } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { CheckInQueue } from '@/components/roster/CheckInQueue';
import type { QueueRow } from '@/components/roster/CheckInQueue';

export const metadata: Metadata = { title: 'Check-in queue' };

/**
 * The screen where a coach reads what an athlete actually wrote.
 *
 * The roster carries the signals a check-in raises; it does not carry their
 * words. This page does, and that is why Slice 15 brought it up to the
 * roster's standard rather than folding it into one.
 */
export default async function CheckInQueuePage() {
  const session = await requireCoach();
  const repo = await getRepo();
  const queue = await repo.listCheckInQueue(session.userId);

  const rows: QueueRow[] = queue.map((c) => ({
    id: c.id,
    athleteId: c.athleteId,
    athleteName: c.athleteName,
    weekStart: c.weekStart,
    submittedAt: c.submittedAt,
    attentionLevel: c.attentionLevel,
    attentionReasons: c.attentionReasons,
    acknowledgedAt: c.acknowledgedAt,
    respondedAt: c.respondedAt,
    soreness: c.scores.soreness ?? null,
    painOrNiggles: c.painOrNiggles || null,
    scores: c.scores as unknown as Record<string, number>,
    wentWell: c.wentWell,
    feltDifficult: c.feltDifficult,
    affectingTraining: c.affectingTraining,
    confidenceNextWeek: c.confidenceNextWeek,
    forCoach: c.forCoach,
    coachResponse: c.coachResponse,
  }));

  const unread = rows.filter((c) => !c.acknowledgedAt).length;
  const owed = rows.filter((c) => c.attentionLevel === 'attention' && !c.respondedAt).length;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Review queue"
        title="Check-ins"
        lead={
          rows.length === 0
            ? 'No check-ins yet this week.'
            : owed
              ? `${owed} flagged and still unanswered. ${unread} nobody has read.`
              : `Nothing flagged is outstanding. ${unread} nobody has read.`
        }
        // the count that moves when a coach marks something read, so the
        // badge and the act agree
        action={<Badge tone={unread ? 'green' : 'neutral'}>{unread} unread</Badge>}
      />

      {rows.length === 0 ? (
        <Panel className="mt-8 p-8">
          <p className="text-[15px] text-muted">
            Nothing here yet. Check-ins appear as athletes submit them.
          </p>
        </Panel>
      ) : (
        <CheckInQueue rows={rows} now={new Date().toISOString()} />
      )}
    </AppPage>
  );
}
