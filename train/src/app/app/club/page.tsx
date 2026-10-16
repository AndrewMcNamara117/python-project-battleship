import type { FeedCursor } from '@/lib/data/repo';
import type { Metadata } from 'next';
import { FeedCard } from '@/components/activity/FeedCard';
import { AppPage } from '@/components/app/PageHeader';
import { AppHeader } from '@/components/forge/AppHeader';
import { EmptyState } from '@/components/forge/EmptyState';
import { Rise } from '@/components/motion/Rise';
import { ButtonLink } from '@/components/ui/Button';
import { requireSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';

export const metadata: Metadata = { title: 'Club feed' };

/**
 * CLUB FEED — the runs members chose to share.
 *
 * Newest first, one card each. Nothing here ranks anyone: the leaderboard
 * already exists and rewards doing the plan, and a feed that sorted by
 * distance would reward exactly the overtraining the Forge Score avoids.
 */
/** "start~id", as the Older link writes it; anything else starts from the top. */
function readCursor(raw: string | undefined): FeedCursor | undefined {
  const [startedAt, id] = (raw ?? '').split('~');
  if (!startedAt || !id || Number.isNaN(Date.parse(startedAt)) || id.length > 64) return undefined;
  return { startedAt, id };
}

export default async function ClubFeedPage({ searchParams }: { searchParams: Promise<{ before?: string }> }) {
  const { before } = await searchParams;
  const session = await requireSession();
  const repo = await getRepo();
  const [profile, items] = await Promise.all([
    repo.getProfile(session.userId),
    repo.listClubFeed(session.userId, 20, readCursor(before)),
  ]);
  const units = profile?.units ?? 'metric';
  const last = items[items.length - 1];
  const older = items.length === 20 && last ? `${last.startedAt}~${last.id}` : null;

  return (
    <AppPage>
      <AppHeader
        eyebrow="Club"
        title="Club feed"
        lead="Runs your club-mates chose to share. Give kudos, say something. Heart rate and plans stay private — the club sees the run, not the athlete’s data."
        action={
          <ButtonLink href="/app/activities" variant="ghost" size="sm">
            Share yours
          </ButtonLink>
        }
      />
      <div className="mx-auto mt-7 max-w-2xl space-y-5">
        {items.length ? (
          items.map((item, i) => (
            <Rise key={item.id} delay={Math.min(i, 6) * 40}>
              <FeedCard
                item={item}
                units={units}
                viewerId={session.userId}
                href={item.athleteId === session.userId ? `/app/activities/${item.id}` : `/app/club/${item.id}`}
              />
            </Rise>
          ))
        ) : (
          <EmptyState
            title="Quiet out there."
            body="Nobody has shared a run yet. Import one of yours and tick “Share with the club” to be first."
            action={
              <ButtonLink href="/app/activities" variant="ghost">
                Your activities
              </ButtonLink>
            }
          />
        )}
        {older && (
          <div className="pt-2 text-center">
            <ButtonLink href={`/app/club?before=${encodeURIComponent(older)}`} variant="ghost" size="sm">
              Older runs
            </ButtonLink>
          </div>
        )}
      </div>
    </AppPage>
  );
}
