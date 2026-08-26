import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { LibraryFilters } from '@/components/library/LibraryFilters';
import { ProgrammeList } from '@/components/programme/ProgrammeList';
import { Badge } from '@/components/ui/Badge';
import { requireCoach } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { loadCoachContext } from '@/lib/coach-data';
import { addDays, formatDayMonth, startOfWeek } from '@/lib/domain/dates';
import { DISCIPLINE_LABELS } from '@/lib/domain/programme-template';
import type { LibraryQuery, Visibility } from '@/lib/domain/library';
import { WeekCloner } from './ProgramBuilder';

export const metadata: Metadata = { title: 'Programmes' };

export default async function ProgrammesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await requireCoach();
  const params = await searchParams;
  const repo = await getRepo();
  const ctx = await loadCoachContext();

  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value) ?? undefined;
  };

  const query: LibraryQuery = {
    search: one('q'),
    visibility: one('visibility') as Visibility | undefined,
    includeArchived: one('archived') === '1',
  };

  const templates = await repo.listProgramTemplates(query);

  // real weeks per athlete, so the week cloner offers a week rather than a date
  const weeksByAthlete: Record<string, { id: string; label: string }[]> = {};
  for (const a of ctx.athletes) {
    const program = await repo.getProgram(a.profile.id);
    if (!program) {
      weeksByAthlete[a.profile.id] = [];
      continue;
    }
    const blocks = await repo.listBlocks(program.id);
    weeksByAthlete[a.profile.id] = blocks.flatMap((b) =>
      b.weeks.map((w) => ({
        id: w.id,
        label: `Week ${w.programWeekNo} · ${b.name} · ${formatDayMonth(w.startDate)}${
          w.isRecoveryWeek ? ' · step-back' : ''
        }`,
      })),
    );
  }

  return (
    <AppPage>
      <PageHeader
        eyebrow="Programmes"
        title="Build the block once."
        lead="A programme is blocks, weeks and the sessions in them. Build it once, assign it to as many athletes as you like — each one gets their own independent copy, and editing this never touches theirs."
        action={<Badge tone="neutral">{templates.length} programmes</Badge>}
      />

      <div className="mt-7">
        <LibraryFilters
          categories={Object.entries(DISCIPLINE_LABELS).map(([value, label]) => ({ value, label }))}
          categoryLabel="disciplines"
        />
      </div>

      <ProgrammeList
        templates={templates}
        coachId={session.userId}
        athletes={ctx.athletes.map((a) => ({ id: a.profile.id, name: a.profile.fullName }))}
        defaultStart={addDays(startOfWeek(ctx.today), 7)}
      />

      <section className="mt-14">
        <h2 className="im-eyebrow">Inside a live programme</h2>
        <div className="mt-5">
          <WeekCloner
            athletes={ctx.athletes.map((a) => ({ id: a.profile.id, name: a.profile.fullName }))}
            weeksByAthlete={weeksByAthlete}
            defaultStart={addDays(startOfWeek(ctx.today), 7)}
          />
        </div>
      </section>
    </AppPage>
  );
}
