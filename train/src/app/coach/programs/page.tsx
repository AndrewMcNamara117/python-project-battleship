import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { PROGRAM_TEMPLATES } from '@/data/workout-library';
import { loadCoachContext } from '@/lib/coach-data';
import { addDays, startOfWeek } from '@/lib/domain/dates';
import { EVENT_TYPE_LABELS } from '@/lib/domain/types';
import { ProgramBuilder, WeekCloner } from './ProgramBuilder';

export const metadata: Metadata = { title: 'Programmes' };

export default async function ProgramsPage() {
  const ctx = await loadCoachContext();
  const athletes = ctx.athletes.map((a) => ({ id: a.profile.id, name: a.profile.fullName }));
  const nextMonday = addDays(startOfWeek(ctx.today), 7);

  return (
    <AppPage>
      <PageHeader
        eyebrow="Programme builder"
        title="Write the block."
        lead="Templates give you the frame. Everything after that is individual."
      />

      <div className="mt-8 grid gap-5">
        <Reveal>
          <ProgramBuilder athletes={athletes} defaultStart={nextMonday} />
        </Reveal>
        <Reveal delay={0.06}>
          <WeekCloner athletes={athletes} defaultStart={startOfWeek(ctx.today)} />
        </Reveal>
      </div>

      <section className="mt-12">
        <h2 className="im-micro">Template library</h2>
        <RevealGroup className="mt-5 grid gap-4 md:grid-cols-2">
          {PROGRAM_TEMPLATES.map((t) => (
            <RevealItem key={t.id}>
              <Panel hover className="h-full p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <h3 className="im-display text-[1.2rem]">{t.name}</h3>
                  <div className="flex gap-2">
                    <Badge tone="neutral">{EVENT_TYPE_LABELS[t.goalType]}</Badge>
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
