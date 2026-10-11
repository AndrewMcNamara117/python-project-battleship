import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { LibraryFilters } from '@/components/library/LibraryFilters';
import { StrengthLibrary } from '@/components/library/StrengthLibrary';
import { Badge } from '@/components/ui/Badge';
import { requireCoach } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { MOVEMENT_PATTERN_LABELS } from '@/lib/domain/library';
import type { LibraryQuery, MovementPattern, Visibility } from '@/lib/domain/library';
import { STRENGTH_CATEGORY_LABELS } from '@/lib/domain/types';

export const metadata: Metadata = { title: 'Strength library' };

export default async function StrengthLibraryPage({
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

  const shared: LibraryQuery = {
    search: one('q'),
    visibility: one('visibility') as Visibility | undefined,
    includeArchived: one('archived') === '1',
  };

  const [templates, exercises, athletes] = await Promise.all([
    // a movement pattern narrows the movement list, not the session list
    repo.listStrengthTemplates({ ...shared, category: one('category') }),
    repo.listStrengthExercises({
      ...shared,
      category: one('category'),
      movementPattern: one('pattern') as MovementPattern | undefined,
    }),
    repo.listAthletesForCoach(session.userId),
  ]);

  return (
    <AppPage>
      <PageHeader
        eyebrow="Library"
        title="Strength &amp; Conditioning"
        lead="Runner-specific work: the sessions you prescribe, and the movements they are built from. Editing a movement changes what future sessions start from — it never touches training already given to an athlete."
        action={
          <div className="flex gap-2">
            <Badge tone="neutral">{templates.length} sessions</Badge>
            <Badge tone="neutral">{exercises.length} movements</Badge>
          </div>
        }
      />

      <div className="mt-7">
        <LibraryFilters
          categories={Object.entries(STRENGTH_CATEGORY_LABELS).map(([value, label]) => ({ value, label }))}
          extra={{
            name: 'pattern',
            label: 'patterns',
            options: Object.entries(MOVEMENT_PATTERN_LABELS).map(([value, label]) => ({ value, label })),
          }}
        />
      </div>

      <StrengthLibrary
        templates={templates}
        exercises={exercises}
        coachId={session.userId}
        athletes={athletes.map((a) => ({ id: a.id, name: a.fullName }))}
      />
    </AppPage>
  );
}
