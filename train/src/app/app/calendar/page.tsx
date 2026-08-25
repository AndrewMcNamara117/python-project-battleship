import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { loadAthleteContext } from '@/lib/app-data';
import { getRepo } from '@/lib/data';
import { addDays, startOfWeek } from '@/lib/domain/dates';
import { CalendarView } from './CalendarView';

export const metadata: Metadata = { title: 'Calendar' };

export default async function CalendarPage() {
  const ctx = await loadAthleteContext();
  const repo = await getRepo();

  // a wide window so month paging never hits an empty grid
  const from = addDays(startOfWeek(ctx.today), -7 * 12);
  const to = addDays(startOfWeek(ctx.today), 7 * 14);
  const workouts = await repo.listScheduled(ctx.session.userId, from, to);

  return (
    <AppPage>
      <PageHeader
        eyebrow="Your programme"
        title="Calendar"
        lead="Every prescribed session, what happened, and what is still to come."
      />
      <div className="mt-8">
        <CalendarView initialWorkouts={workouts} units={ctx.profile.units} today={ctx.today} />
      </div>
    </AppPage>
  );
}
