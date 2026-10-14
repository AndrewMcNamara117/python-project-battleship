import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { distanceLabel } from '@/components/activity/ActivityPanels';
import { RouteMap } from '@/components/activity/RouteMap';
import { SegmentBoard, SegmentHistory } from '@/components/activity/SegmentPanels';
import { AppPage } from '@/components/app/PageHeader';
import { AppHeader } from '@/components/forge/AppHeader';
import { Rise } from '@/components/motion/Rise';
import { ButtonLink } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { requireSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';

export const metadata: Metadata = { title: 'Segment' };

export default async function SegmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession();
  const repo = await getRepo();
  const segment = await repo.getSegment(id);
  if (!segment) notFound();
  const [profile, mine, leaders] = await Promise.all([
    repo.getProfile(session.userId),
    repo.listEfforts(session.userId, id),
    repo.getSegmentLeaders(id, 25),
  ]);
  const units = profile?.units ?? 'metric';

  return (
    <AppPage>
      <AppHeader
        eyebrow={`Segment · ${distanceLabel(segment.distanceM, units)}`}
        title={segment.name}
        lead={segment.description || undefined}
        action={
          <ButtonLink href="/app/segments" variant="ghost" size="sm">
            All segments
          </ButtonLink>
        }
      />
      <div className="mt-7 space-y-5">
        <Rise>
          <Panel edge className="p-0">
            <RouteMap
              route={segment.route}
              trimM={0}
              label={`Map of the ${segment.name} segment, ${distanceLabel(segment.distanceM, units)}`}
              height={260}
              caption={segment.archived ? 'Retired — no longer timed' : 'A public stretch, drawn by the coaches'}
            />
          </Panel>
        </Rise>
        <div className="grid min-w-0 gap-5 lg:grid-cols-2 lg:items-start">
          <Rise delay={40}>
            <SegmentHistory efforts={mine} segment={segment} units={units} activityHref={(a) => `/app/activities/${a}`} />
          </Rise>
          <Rise delay={60}>
            <SegmentBoard leaders={leaders} segment={segment} viewerId={session.userId} units={units} />
          </Rise>
        </div>
      </div>
    </AppPage>
  );
}
