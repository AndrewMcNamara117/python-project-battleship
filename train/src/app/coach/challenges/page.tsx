import type { Metadata } from 'next';
import { ChallengeCard } from '@/components/challenges/ChallengeCard';
import { ArchiveChallenge, NewChallenge } from '@/components/challenges/ChallengeControls';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { SectionHeading } from '@/components/forge/AppHeader';
import { Panel } from '@/components/ui/Panel';
import { requireCoach } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { addDays, startOfMonth, toISODate } from '@/lib/domain/dates';

export const metadata: Metadata = { title: 'Challenges' };

/** The coach's challenges: set one, see who is in and who has finished, retire it. */
export default async function CoachChallengesPage() {
  const session = await requireCoach();
  const repo = await getRepo();
  const today = toISODate(new Date());
  const challenges = await repo.listChallenges(true);
  const summaries = await Promise.all(challenges.map((c) => repo.getChallengeSummary(session.userId, c.id)));

  // default the form to next month
  const next = new Date(`${startOfMonth(today)}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const nextStart = next.toISOString().slice(0, 10);
  const after = new Date(next);
  after.setUTCMonth(after.getUTCMonth() + 1);
  const nextEnd = addDays(after.toISOString().slice(0, 10), -1);

  return (
    <AppPage>
      <PageHeader
        eyebrow="Club"
        title="Challenges"
        lead="A target over a window, for athletes to opt into. Progress comes from what they log — sessions completed as written, club runs, check-ins or kilometres. Finished, not won: nothing is ranked."
      />
      <Panel className="mt-8 p-5 sm:p-7">
        <SectionHeading label="Set a challenge" />
        <div className="mt-5 max-w-2xl">
          <NewChallenge defaultStart={nextStart} defaultEnd={nextEnd} />
        </div>
      </Panel>
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {challenges.map((c, i) => (
          <div key={c.id} className={c.archived ? 'opacity-60' : ''}>
            <ChallengeCard challenge={c} summary={summaries[i]} today={today} action={<ArchiveChallenge challengeId={c.id} archived={c.archived} />} />
          </div>
        ))}
      </div>
    </AppPage>
  );
}
