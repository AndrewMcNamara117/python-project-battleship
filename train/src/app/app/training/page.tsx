import type { Metadata } from 'next';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { WorkoutCard } from '@/components/app/WorkoutCard';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';
import { RouteLine } from '@/components/motion/RouteLine';
import { Badge } from '@/components/ui/Badge';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { loadAthleteContext } from '@/lib/app-data';
import { getRepo } from '@/lib/data';
import { addDays, daysBetween, formatDistance, formatDayMonth } from '@/lib/domain/dates';
import { explainSession } from '@/lib/forge/assistant';
import { INTENSITY_LABELS, WORKOUT_TYPE_LABELS } from '@/lib/domain/types';

export const metadata: Metadata = { title: 'Endurance' };

export default async function TrainingPage() {
  const ctx = await loadAthleteContext();
  const repo = await getRepo();
  const program = await repo.getProgram(ctx.session.userId);

  const upcoming = await repo.listScheduled(
    ctx.session.userId,
    ctx.today,
    addDays(ctx.today, 21),
  );
  const upcomingRuns = upcoming.filter((w) => w.type !== 'strength' && w.type !== 'rest');

  const weeksElapsed = program ? Math.max(0, Math.floor(daysBetween(program.startDate, ctx.today) / 7)) : 0;
  const weeksTotal = program ? Math.ceil(daysBetween(program.startDate, program.endDate) / 7) : 0;

  return (
    <AppPage>
      <PageHeader
        eyebrow="Endurance programme"
        title={program?.name ?? 'Your programme'}
        lead={
          program
            ? `Week ${weeksElapsed + 1} of ${weeksTotal}. Written by ${ctx.coach?.fullName ?? 'your coach'} and adjusted every week off what you log.`
            : 'No active programme yet. Your coach writes the first block after onboarding.'
        }
        action={
          program ? <Badge tone="green">{program.status === 'active' ? 'Active' : program.status}</Badge> : undefined
        }
      />

      {program && (
        <Reveal>
          <Panel className="mt-8 p-7">
            <PanelHeader label="Block progress" />
            <div className="mt-5 flex items-baseline justify-between gap-4">
              <p className="im-mono text-[13px] text-muted">
                {formatDayMonth(program.startDate)} → {formatDayMonth(program.endDate)}
              </p>
              <p className="im-mono text-[13px] font-bold text-green">
                {weeksTotal ? Math.round(((weeksElapsed + 1) / weeksTotal) * 100) : 0}%
              </p>
            </div>
            <div className="mt-4 h-px w-full bg-line-2">
              <div
                className="h-px bg-green"
                style={{ width: `${weeksTotal ? Math.min(100, ((weeksElapsed + 1) / weeksTotal) * 100) : 0}%` }}
              />
            </div>
            <RouteLine className="mt-8 h-16 w-full" />
          </Panel>
        </Reveal>
      )}

      <section className="mt-10">
        <h2 className="im-micro">Next three weeks</h2>
        <RevealGroup className="mt-5 space-y-4">
          {upcomingRuns.slice(0, 12).map((w) => (
            <RevealItem key={w.id}>
              <Panel hover className="flex flex-wrap items-center gap-x-6 gap-y-4 p-5">
                <div className="min-w-[110px]">
                  <p className="im-micro">{formatDayMonth(w.date)}</p>
                  <p className="mt-1.5 text-[11px] uppercase tracking-[0.14em] text-muted-2">
                    {WORKOUT_TYPE_LABELS[w.type]}
                  </p>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-bold">{w.name}</p>
                  {w.mainSet && <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{w.mainSet}</p>}
                </div>
                <div className="im-mono flex shrink-0 gap-5 text-[12px]">
                  {w.distanceKm != null && (
                    <span className="text-white">{formatDistance(w.distanceKm, ctx.profile.units)}</span>
                  )}
                  <Badge tone={w.intensity === 'hard' || w.intensity === 'max' ? 'green' : 'neutral'}>
                    {INTENSITY_LABELS[w.intensity]}
                  </Badge>
                </div>
              </Panel>
            </RevealItem>
          ))}
          {!upcomingRuns.length && (
            <Panel className="p-7">
              <p className="text-[14px] text-muted">No endurance sessions scheduled in the next three weeks.</p>
            </Panel>
          )}
        </RevealGroup>
      </section>

      {ctx.todaySessions.some((s) => s.type !== 'rest' && s.type !== 'strength') && (
        <section className="mt-12">
          <h2 className="im-micro">Today in detail</h2>
          <div className="mt-5">
            {ctx.todaySessions
              .filter((s) => s.type !== 'rest' && s.type !== 'strength')
              .map((w) => (
                <WorkoutCard key={w.id} workout={w} units={ctx.profile.units}>
                  <p className="text-[14px] leading-relaxed text-muted">{explainSession(w)}</p>
                </WorkoutCard>
              ))}
          </div>
        </section>
      )}
    </AppPage>
  );
}
