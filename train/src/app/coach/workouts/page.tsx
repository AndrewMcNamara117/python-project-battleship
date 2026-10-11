import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { LibraryFilters } from '@/components/library/LibraryFilters';
import { WorkoutLibrary } from '@/components/library/WorkoutLibrary';
import { Badge } from '@/components/ui/Badge';
import { requireCoach } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { WORKOUT_CATEGORY_LABELS } from '@/lib/domain/library';
import type { LibraryQuery, Visibility } from '@/lib/domain/library';

export const metadata: Metadata = { title: 'Workout library' };

export default async function WorkoutLibraryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCoach();
  const params = await searchParams;
  const repo = await getRepo();

  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? undefined;
  };

  const query: LibraryQuery = {
    search: one('q'),
    category: one('category'),
    visibility: one('visibility') as Visibility | undefined,
    includeArchived: one('archived') === '1',
  };

  const [templates, athletes] = await Promise.all([
    repo.listWorkoutTemplates(query),
    repo.listAthletesForCoach(session.userId),
  ]);

  return (
    <AppPage>
      <PageHeader
        eyebrow="Library"
        title="Workouts"
        lead="Sessions you can reuse. Paces, zones and durations are your defaults — nothing here is a prescription until you add it to an athlete, and that copy is theirs from the moment it lands."
        action={<Badge tone="neutral">{templates.length} sessions</Badge>}
      />

      <div className="mt-7">
        <LibraryFilters
          categories={Object.entries(WORKOUT_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
        />
      </div>

      <WorkoutLibrary
        templates={templates}
        coachId={session.userId}
        athletes={athletes.map((a) => ({ id: a.id, name: a.fullName }))}
      />
    </AppPage>
  );
}
