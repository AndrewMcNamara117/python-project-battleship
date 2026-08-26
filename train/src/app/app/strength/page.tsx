import type { Metadata } from 'next';
import { AppPage } from '@/components/app/PageHeader';
import { AppHeader, SectionHeading } from '@/components/forge/AppHeader';
import { Rise } from '@/components/motion/Rise';
import { Badge } from '@/components/ui/Badge';
import { Panel } from '@/components/ui/Panel';
import { loadAthleteContext } from '@/lib/app-data';
import { getRepo } from '@/lib/data';
import { addDays, formatDayMonth } from '@/lib/domain/dates';
import type { SessionComponent } from '@/lib/domain/programme';
import type { StrengthExercise, StrengthSetPrescription, StrengthTemplate } from '@/lib/domain/types';
import { SessionPlayer } from './SessionPlayer';

export const metadata: Metadata = { title: 'Strength' };

/**
 * The session an athlete plays is their own copy, not the coach's template.
 *
 * It is built from the components saved against this scheduled session, so a
 * coach reworking the template in their library changes nothing here. What the
 * athlete was given is what the athlete sees.
 */
function toPrescriptions(components: SessionComponent[]): StrengthSetPrescription[] {
  return components
    .filter((c) => c.kind === 'exercise')
    .map((c, i) => ({
      exerciseId: c.strengthExerciseId ?? c.id,
      order: i,
      sets: c.sets ?? 3,
      reps: c.reps ?? '8',
      tempo: c.tempo,
      restSeconds: c.restSeconds,
      rpeTarget: c.rpeTarget,
      notes: c.notes,
    }));
}

export default async function StrengthPage() {
  const ctx = await loadAthleteContext();
  const repo = await getRepo();

  // the session to play: today's if there is one, otherwise the next prescribed
  const upcoming = await repo.listScheduled(ctx.session.userId, ctx.today, addDays(ctx.today, 14));
  const target =
    upcoming.find((w) => w.type === 'strength' && w.date === ctx.today) ??
    upcoming.find((w) => w.type === 'strength');

  const upcomingStrength = upcoming.filter((w) => w.type === 'strength');

  const componentsBySession = new Map<string, SessionComponent[]>();
  await Promise.all(
    upcomingStrength.map(async (w) => componentsBySession.set(w.id, await repo.listComponents(w.id))),
  );

  const targetComponents = target ? (componentsBySession.get(target.id) ?? []) : [];
  const blocks = toPrescriptions(targetComponents);

  // the movements this session actually names — an athlete can read these and
  // nothing else in the library
  const exercises = (
    await Promise.all(
      [...new Set(targetComponents.map((c) => c.strengthExerciseId).filter(Boolean))].map((id) =>
        repo.getStrengthExercise(id as string),
      ),
    )
  ).filter(Boolean) as unknown as StrengthExercise[];

  const template: StrengthTemplate | null =
    target && blocks.length
      ? {
          id: target.id,
          name: target.name,
          category: 'foundation',
          description: target.mainSet ?? '',
          estimatedMinutes: target.durationMinutes ?? 45,
          blocks,
          ownerId: null,
          isShared: false,
        }
      : null;

  const existing = target
    ? (await repo.listStrengthSessions(ctx.session.userId, target.date, target.date)).find(
        (s) => s.scheduledWorkoutId === target.id,
      )
    : undefined;

  const doneThisBlock = ctx.buckets.reduce((a, b) => a + b.strengthCompleted, 0);
  const plannedThisBlock = ctx.buckets.reduce((a, b) => a + b.strengthPlanned, 0);

  return (
    <AppPage>
      <AppHeader
        eyebrow="Strength & conditioning"
        title={target?.date === ctx.today ? "Today's strength session" : 'Your strength plan'}
        lead="Two sessions a week, written around the running rather than bolted onto it. This is the work that keeps you on the road."
        figure={{ value: `${doneThisBlock}/${plannedThisBlock}`, label: 'sessions this block' }}
      />

      {template ? (
        <div className="mt-8">
          <SessionPlayer
            template={template}
            exercises={exercises}
            scheduledWorkoutId={target?.id ?? null}
            date={target?.date ?? ctx.today}
            initialLogs={existing?.logs ?? []}
            initialComplete={existing?.status === 'completed'}
          />
        </div>
      ) : (
        <Panel className="mt-8 p-8">
          <p className="text-[14px] leading-relaxed text-ink-secondary">
            No strength session prescribed yet. Your coach adds these to your calendar — when one is
            scheduled, it opens here.
          </p>
        </Panel>
      )}

      <section className="mt-12">
        <SectionHeading label="Scheduled strength" />
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {upcomingStrength.map((w) => {
            const count = (componentsBySession.get(w.id) ?? []).filter((c) => c.kind === 'exercise').length;
            return (
              <Rise key={w.id}>
                <Panel hover className="p-6">
                  <div className="flex items-center justify-between gap-3">
                    <p className="im-micro">{formatDayMonth(w.date)}</p>
                    <Badge tone={w.status === 'completed' ? 'green' : 'neutral'}>
                      {w.status === 'completed' ? 'Done' : 'Scheduled'}
                    </Badge>
                  </div>
                  <h3 className="mt-4 text-[15px] font-bold">{w.name}</h3>
                  {count > 0 && (
                    <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">
                      {count} exercises
                      {w.durationMinutes ? ` · about ${w.durationMinutes} minutes` : ''}
                    </p>
                  )}
                </Panel>
              </Rise>
            );
          })}
          {!upcomingStrength.length && (
            <Panel className="p-6">
              <p className="text-[14px] text-ink-secondary">No strength sessions scheduled in the next two weeks.</p>
            </Panel>
          )}
        </div>
      </section>
    </AppPage>
  );
}
