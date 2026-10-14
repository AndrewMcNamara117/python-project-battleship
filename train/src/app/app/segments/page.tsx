import type { Metadata } from 'next';
import Link from 'next/link';
import { distanceLabel } from '@/components/activity/ActivityPanels';
import { RouteMap } from '@/components/activity/RouteMap';
import { AppPage } from '@/components/app/PageHeader';
import { AppHeader } from '@/components/forge/AppHeader';
import { EmptyState } from '@/components/forge/EmptyState';
import { Rise } from '@/components/motion/Rise';
import { Panel } from '@/components/ui/Panel';
import { requireSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { formatDuration } from '@/lib/domain/dates';

export const metadata: Metadata = { title: 'Segments' };

/** SEGMENTS — the club's stretches around Limerick, with your best and the club's. */
export default async function SegmentsPage() {
  const session = await requireSession();
  const repo = await getRepo();
  const [profile, segments, mine] = await Promise.all([
    repo.getProfile(session.userId),
    repo.listSegments(),
    repo.listEfforts(session.userId),
  ]);
  const units = profile?.units ?? 'metric';
  const leaders = await Promise.all(segments.map((s) => repo.getSegmentLeaders(s.id, 1)));

  return (
    <AppPage>
      <AppHeader
        eyebrow="Club"
        title="Segments"
        lead="Stretches the club runs every week, drawn by the coaches. Every imported run that covers one is timed on it."
      />
      <div className="mt-7 grid gap-5 md:grid-cols-2">
        {segments.length ? (
          segments.map((s, i) => {
            const mineHere = mine.filter((e) => e.segmentId === s.id);
            const best = mineHere.length ? Math.min(...mineHere.map((e) => e.elapsedS)) : null;
            const top = leaders[i][0];
            return (
              <Rise key={s.id} delay={i * 40}>
                <Link href={`/app/segments/${s.id}`} className="group block h-full">
                  <Panel hover className="h-full overflow-hidden p-0">
                    <RouteMap route={s.route} trimM={0} label="" compact height={130} className="h-[130px] w-full border-b border-hairline" />
                    <div className="p-5">
                      <h2 className="text-[16px] font-bold text-ink group-hover:text-mint">{s.name}</h2>
                      <p className="mt-1 text-[12px] text-ink-tertiary">{distanceLabel(s.distanceM, units)}</p>
                      <dl className="mt-4 grid grid-cols-2 gap-3 text-[13px]">
                        <div>
                          <dt className="im-micro">Your best</dt>
                          <dd className="mt-1 font-bold tabular-nums text-ink">{best != null ? formatDuration(best) : '—'}</dd>
                        </div>
                        <div>
                          <dt className="im-micro">Club best</dt>
                          <dd className="mt-1 font-bold tabular-nums text-ink">
                            {top ? `${formatDuration(top.elapsedS)}` : '—'}
                            {top && <span className="ml-1.5 font-normal text-ink-tertiary">{top.athleteId === session.userId ? 'you' : top.athleteName}</span>}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </Panel>
                </Link>
              </Rise>
            );
          })
        ) : (
          <EmptyState title="No segments yet." body="Your coaches draw them from routes the club runs. They will appear here when they do." />
        )}
      </div>
    </AppPage>
  );
}
