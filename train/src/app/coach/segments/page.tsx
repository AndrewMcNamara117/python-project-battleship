import type { Metadata } from 'next';
import { distanceLabel } from '@/components/activity/ActivityPanels';
import { RouteMap } from '@/components/activity/RouteMap';
import { ArchiveSegment } from '@/components/activity/SegmentAdmin';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { Panel } from '@/components/ui/Panel';
import { requireCoach } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { formatDuration } from '@/lib/domain/dates';

export const metadata: Metadata = { title: 'Segments' };

/** The coach's view of the club's segments: draw, see the boards, retire. */
export default async function CoachSegmentsPage() {
  await requireCoach();
  const repo = await getRepo();
  const segments = await repo.listSegments(true);
  const boards = await Promise.all(segments.map((s) => repo.getSegmentLeaders(s.id, 3)));

  return (
    <AppPage>
      <PageHeader
        eyebrow="Club"
        title="Segments"
        lead="Draw a segment from any of your athletes’ routes: open the activity from their page and use “Draw a segment from this route”. Runs imported after a segment exists are timed on it. Retiring one stops new timing and keeps the history."
      />
      <div className="mt-8 space-y-4">
        {segments.length === 0 && <p className="text-[14px] text-ink-secondary">No segments yet.</p>}
        {segments.map((s, i) => (
          <Panel key={s.id} className={`grid gap-4 p-4 sm:grid-cols-[9rem_minmax(0,1fr)_auto] sm:items-center ${s.archived ? 'opacity-60' : ''}`}>
            <RouteMap route={s.route} trimM={0} label="" compact height={80} className="h-[80px] w-full overflow-hidden rounded-xs" />
            <div className="min-w-0">
              <p className="text-[15px] font-bold text-ink">
                {s.name}
                {s.archived && <span className="im-micro ml-3 text-ink-tertiary">Retired</span>}
              </p>
              <p className="mt-1 text-[12px] text-ink-tertiary">
                {distanceLabel(s.distanceM, 'metric')}
                {s.description && ` · ${s.description}`}
              </p>
              {boards[i].length ? (
                <ol className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-ink-secondary">
                  {boards[i].map((b, r) => (
                    <li key={b.activityId} className="whitespace-nowrap">
                      <span className="im-mono text-ink-tertiary">{r + 1}</span> {b.athleteName}{' '}
                      <span className="font-bold tabular-nums text-ink-body">{formatDuration(b.elapsedS)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-[12px] text-ink-secondary">No shared times yet.</p>
              )}
            </div>
            <ArchiveSegment segmentId={s.id} archived={s.archived} />
          </Panel>
        ))}
      </div>
    </AppPage>
  );
}
