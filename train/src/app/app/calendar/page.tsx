import type { Metadata } from 'next';
import { AppPage } from '@/components/app/PageHeader';
import { AppHeader } from '@/components/forge/AppHeader';
import { loadAthleteContext } from '@/lib/app-data';
import { getRepo } from '@/lib/data';
import { addDays, startOfWeek } from '@/lib/domain/dates';
import { CalendarView } from './CalendarView';

export const metadata: Metadata = { title: 'Calendar' };

export default async function CalendarPage() {
  const ctx = await loadAthleteContext();
  const repo = await getRepo();

  // a wide window so month paging never lands on an empty grid
  const from = addDays(startOfWeek(ctx.today), -7 * 12);
  const to = addDays(startOfWeek(ctx.today), 7 * 14);
  const workouts = await repo.listScheduled(ctx.session.userId, from, to);

  const program = await repo.getProgram(ctx.session.userId);

  return (
    <AppPage>
      <AppHeader
        eyebrow={program?.name ?? 'Your programme'}
        title="Calendar"
        lead="Every prescribed session, what happened, and what is still ahead. Session type is the mark; status is how it is drawn."
        figure={
          ctx.daysToRace != null
            ? { value: ctx.daysToRace, label: 'days to race' }
            : undefined
        }
      />
      <div className="mt-7">
        <CalendarView initialWorkouts={workouts} units={ctx.profile.units} today={ctx.today} />
      </div>
    </AppPage>
  );
}
