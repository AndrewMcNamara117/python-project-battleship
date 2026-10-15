import type { Metadata } from 'next';
import { ChallengeCard } from '@/components/challenges/ChallengeCard';
import { JoinChallenge } from '@/components/challenges/ChallengeControls';
import { AppPage } from '@/components/app/PageHeader';
import { AppHeader } from '@/components/forge/AppHeader';
import { EmptyState } from '@/components/forge/EmptyState';
import { Rise } from '@/components/motion/Rise';
import { requireSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { canJoin } from '@/lib/domain/challenges';
import { toISODate } from '@/lib/domain/dates';

export const metadata: Metadata = { title: 'Challenges' };

/** CHALLENGES — the club's targets for the month. Finished, not won. */
export default async function ChallengesPage() {
  const session = await requireSession();
  const repo = await getRepo();
  const today = toISODate(new Date());
  const challenges = (await repo.listChallenges()).filter((c) => c.endsOn >= today || c.startsOn > today);
  const summaries = await Promise.all(challenges.map((c) => repo.getChallengeSummary(session.userId, c.id)));

  return (
    <AppPage>
      <AppHeader
        eyebrow="Club"
        title="Challenges"
        lead="Targets your coaches set for the club. Join the ones that suit your plan — there is no ranking, only finishing. Your progress is yours and your coach’s; the club sees who finished."
      />
      <div className="mt-7 grid gap-5 md:grid-cols-2">
        {challenges.length ? (
          challenges.map((c, i) => (
            <Rise key={c.id} delay={i * 40}>
              <ChallengeCard
                challenge={c}
                summary={summaries[i]}
                today={today}
                action={canJoin(c, today) ? <JoinChallenge challengeId={c.id} joined={summaries[i].viewerJoined} /> : undefined}
              />
            </Rise>
          ))
        ) : (
          <EmptyState title="Nothing running." body="When your coaches set a challenge for the club, it appears here." />
        )}
      </div>
    </AppPage>
  );
}
