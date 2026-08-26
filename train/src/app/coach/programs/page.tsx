import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { loadCoachContext } from '@/lib/coach-data';
import { addDays, formatDayMonth, startOfWeek } from '@/lib/domain/dates';
import { getRepo } from '@/lib/data';
import { EVENT_TYPE_LABELS } from '@/lib/domain/types';
import { ProgramBuilder, WeekCloner } from './ProgramBuilder';

export const metadata: Metadata = { title: 'Programmes' };

export default async function ProgramsPage() {
  const ctx = await loadCoachContext();
  const repo = await getRepo();
  const athletes = ctx.athletes.map((a) => ({ id: a.profile.id, name: a.profile.fullName }));
  const nextMonday = addDays(startOfWeek(ctx.today), 7);
  const programTemplates = await repo.listProgramTemplates();

  // real weeks per athlete, so the coach picks a week rather than typing a date
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
        eyebrow="Programme builder"
        title="Write the block."
        lead="Templates give you the frame. Everything after that is individual."
      />

      <div className="mt-8 grid gap-5">
        <Reveal>
          <ProgramBuilder athletes={athletes} templates={programTemplates} defaultStart={nextMonday} />
        </Reveal>
        <Reveal delay={0.06}>
          <WeekCloner
            athletes={athletes}
            weeksByAthlete={weeksByAthlete}
            defaultStart={addDays(startOfWeek(ctx.today), 7)}
          />
        </Reveal>
      </div>

      <section className="mt-12">
        <h2 className="im-micro">Template library</h2>
        <RevealGroup className="mt-5 grid gap-4 md:grid-cols-2">
          {programTemplates.map((t) => (
            <RevealItem key={t.id}>
              <Panel hover className="h-full p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="im-display text-[1.2rem]">{t.name}</h3>
                  <div className="flex gap-2">
                    <Badge tone="neutral">{EVENT_TYPE_LABELS[t.goalType as keyof typeof EVENT_TYPE_LABELS]}</Badge>
                    <Badge tone="green">{t.weeks}w</Badge>
                  </div>
                </div>
                <p className="mt-4 text-[13px] leading-relaxed text-muted">{t.description}</p>
              </Panel>
            </RevealItem>
          ))}
        </RevealGroup>
        <p className="mt-6 max-w-[72ch] text-[12px] leading-relaxed text-muted-2">
          Nothing in these templates is a medical prescription or a guarantee. They are editable
          starting points, and the coach who assigns one is responsible for what it becomes.
        </p>
      </section>
    </AppPage>
  );
}
