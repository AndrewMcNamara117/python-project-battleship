import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';
import { Badge } from '@/components/ui/Badge';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { STRENGTH_EXERCISES, STRENGTH_TEMPLATES, strengthTemplateById } from '@/data/strength-library';
import { loadAthleteContext } from '@/lib/app-data';
import { getRepo } from '@/lib/data';
import { addDays, formatDayMonth } from '@/lib/domain/dates';
import { STRENGTH_CATEGORY_LABELS } from '@/lib/domain/types';
import { SessionPlayer } from './SessionPlayer';

export const metadata: Metadata = { title: 'Strength' };

export default async function StrengthPage() {
  const ctx = await loadAthleteContext();
  const repo = await getRepo();

  // the session to play: today's if there is one, otherwise the next prescribed
  const upcoming = await repo.listScheduled(ctx.session.userId, ctx.today, addDays(ctx.today, 14));
  const target =
    upcoming.find((w) => w.type === 'strength' && w.date === ctx.today) ??
    upcoming.find((w) => w.type === 'strength');

  const template = target?.strengthTemplateId
    ? strengthTemplateById(target.strengthTemplateId)
    : STRENGTH_TEMPLATES[0];

  const existing = target
    ? (await repo.listStrengthSessions(ctx.session.userId, target.date, target.date)).find(
        (s) => s.scheduledWorkoutId === target.id,
      )
    : undefined;

  const upcomingStrength = upcoming.filter((w) => w.type === 'strength');
  const doneThisBlock = ctx.buckets.reduce((a, b) => a + b.strengthCompleted, 0);
  const plannedThisBlock = ctx.buckets.reduce((a, b) => a + b.strengthPlanned, 0);

  return (
    <AppPage>
      <PageHeader
        eyebrow="Strength & conditioning"
        title={target?.date === ctx.today ? "Today's strength session" : 'Your strength plan'}
        lead="Two sessions a week, written around the running rather than bolted onto it. Leave two reps in reserve on every set."
        action={
          <Badge tone="neutral">
            {doneThisBlock}/{plannedThisBlock} this block
          </Badge>
        }
      />

      {template && (
        <div className="mt-8">
          <SessionPlayer
            template={template}
            exercises={STRENGTH_EXERCISES}
            scheduledWorkoutId={target?.id ?? null}
            date={target?.date ?? ctx.today}
            initialLogs={existing?.logs ?? []}
            initialComplete={existing?.status === 'completed'}
          />
        </div>
      )}

      <section className="mt-12">
        <h2 className="im-micro">Scheduled strength</h2>
        <RevealGroup className="mt-5 grid gap-4 sm:grid-cols-2">
          {upcomingStrength.map((w) => {
            const tpl = w.strengthTemplateId ? strengthTemplateById(w.strengthTemplateId) : null;
            return (
              <RevealItem key={w.id}>
                <Panel hover className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="im-micro">{formatDayMonth(w.date)}</p>
                    <Badge tone={w.status === 'completed' ? 'green' : 'neutral'}>
                      {w.status === 'completed' ? 'Done' : 'Scheduled'}
                    </Badge>
                  </div>
                  <h3 className="mt-4 text-[15px] font-bold">{w.name}</h3>
                  {tpl && (
                    <p className="mt-2 text-[12px] leading-relaxed text-muted">
                      {tpl.blocks.length} exercises · about {tpl.estimatedMinutes} minutes
                    </p>
                  )}
                </Panel>
              </RevealItem>
            );
          })}
          {!upcomingStrength.length && (
            <Panel className="p-6">
              <p className="text-[14px] text-muted">No strength sessions scheduled in the next two weeks.</p>
            </Panel>
          )}
        </RevealGroup>
      </section>

      <section className="mt-12">
        <h2 className="im-micro">Template library</h2>
        <Reveal>
          <Panel className="mt-5 p-6 sm:p-8">
            <PanelHeader
              label="Available templates"
              action={<span className="text-[11px] text-muted-2">Your coach assigns these</span>}
            />
            <ul className="mt-6 space-y-5">
              {STRENGTH_TEMPLATES.map((t) => (
                <li key={t.id} className="border-b border-line pb-5 last:border-b-0 last:pb-0">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-[15px] font-bold">{t.name}</h3>
                    <Badge tone="neutral">{STRENGTH_CATEGORY_LABELS[t.category]}</Badge>
                  </div>
                  <p className="mt-2.5 max-w-[70ch] text-[13px] leading-relaxed text-muted">{t.description}</p>
                  <p className="im-mono mt-2.5 text-[11px] tracking-[0.12em] text-muted-2">
                    {t.blocks.length} exercises · {t.estimatedMinutes} min
                  </p>
                </li>
              ))}
            </ul>
          </Panel>
        </Reveal>
      </section>
    </AppPage>
  );
}
