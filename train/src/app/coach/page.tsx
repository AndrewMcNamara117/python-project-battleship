import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { RosterView } from '@/components/roster/RosterView';
import { loadCoachContext } from '@/lib/coach-data';
import { greeting } from '@/lib/domain/dates';
import { parseFilter } from '@/lib/domain/roster';

export const metadata: Metadata = { title: 'Coach' };

/**
 * The coach's operating view.
 *
 * One question: who should I look at first. Athletes carrying the loudest
 * signal come first, each signal says what it is and leads to where the coach
 * can act on it, and an athlete with nothing going on says nothing.
 */
export default async function CoachOverviewPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await loadCoachContext();
  // A concern can be linked to. It selects among athletes already loaded for
  // this coach, so it narrows and never widens.
  const filter = parseFilter((await searchParams).filter);
  const firstName = ctx.coach.fullName.split(' ')[0] || 'Coach';

  const attention = ctx.roster.filter((e) =>
    e.signals.some((s) => s.severity !== 'information')).length;

  return (
    <AppPage>
      <PageHeader
        eyebrow={`${greeting()}, ${firstName}`}
        title="Your roster"
        lead={
          ctx.roster.length === 0
            ? 'No athletes yet. Accepted applications appear here.'
            : attention === 0
              ? 'Nothing needs you this morning. Every athlete is on track.'
              : `${attention} of ${ctx.roster.length} ${attention === 1 ? 'athlete needs' : 'athletes need'} something from you.`
        }
      />

      <div className="mt-8">
        <RosterView roster={ctx.roster} today={ctx.today} initialFilter={filter} />
      </div>
    </AppPage>
  );
}
