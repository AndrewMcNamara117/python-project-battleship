import type { Metadata } from 'next';
import Link from 'next/link';
import { AppPage, PageHeader } from '@/components/app/PageHeader';
import { ForgeMessageCard } from '@/components/app/ForgeMessageCard';
import { LogSessionForm } from '@/components/app/LogSessionForm';
import { WorkoutCard } from '@/components/app/WorkoutCard';
import { Reveal } from '@/components/motion/Reveal';
import { ButtonLink } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { loadAthleteContext } from '@/lib/app-data';
import { getRepo } from '@/lib/data';
import { addDays, formatLongDate, WEEKDAY_FULL, weekdayIndex } from '@/lib/domain/dates';
import { dailyMessage, explainSession } from '@/lib/forge/assistant';

export const metadata: Metadata = { title: 'Today' };

export default async function TodayPage() {
  const ctx = await loadAthleteContext();
  const repo = await getRepo();
  const logged = await repo.listCompleted(ctx.session.userId, ctx.today, ctx.today);

  const forge = dailyMessage({
    profile: ctx.profile,
    today: ctx.today,
    week: ctx.week,
    todaySessions: ctx.todaySessions,
    completedThisWeek: ctx.completedThisWeek,
    lastCheckIn: ctx.checkins[0] ?? null,
    race: ctx.race,
    daysToRace: ctx.daysToRace,
    goalName: ctx.race?.name ?? null,
  });

  const tomorrow = addDays(ctx.today, 1);
  const tomorrowSessions = ctx.week.filter((w) => w.date === tomorrow);

  return (
    <AppPage>
      <PageHeader
        eyebrow={formatLongDate(ctx.today)}
        title="Today"
        lead={
          ctx.daysToRace != null
            ? `${ctx.daysToRace} days to ${ctx.race?.name ?? 'your goal'}.`
            : undefined
        }
        action={
          <ButtonLink href="/app/calendar" variant="ghost" size="sm">
            Full calendar
          </ButtonLink>
        }
      />

      <div className="mt-8 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)] lg:items-start">
        <div className="space-y-5">
          {ctx.todaySessions.length === 0 && (
            <Panel className="p-8">
              <p className="im-micro">Nothing prescribed</p>
              <h2 className="im-display mt-4 text-[1.6rem]">A clear day.</h2>
              <p className="mt-3 max-w-[48ch] text-[14px] leading-relaxed text-muted">
                No session on the plan today. If you feel like moving, keep it easy and short — the
                programme picks up tomorrow.
              </p>
            </Panel>
          )}

          {ctx.todaySessions.map((workout, i) => {
            const entry = logged.find((l) => l.scheduledWorkoutId === workout.id) ?? null;
            const isStrength = workout.type === 'strength';

            return (
              <Reveal key={workout.id} delay={i * 0.06}>
                <WorkoutCard workout={workout} units={ctx.profile.units}>
                  {workout.type === 'rest' ? (
                    <p className="text-[14px] leading-relaxed text-muted">
                      Nothing to log. Rest is prescribed work — adaptation happens here.
                    </p>
                  ) : isStrength ? (
                    <div>
                      <p className="text-[14px] leading-relaxed text-muted">
                        Strength sessions are logged set by set in the session player.
                      </p>
                      <ButtonLink href="/app/strength" className="mt-5">
                        Open the session player
                      </ButtonLink>
                    </div>
                  ) : (
                    <LogSessionForm
                      workout={workout}
                      units={ctx.profile.units}
                      logged={
                        entry && {
                          actualDistanceKm: entry.actualDistanceKm,
                          actualDurationMinutes: entry.actualDurationMinutes,
                          rpe: entry.rpe,
                          athleteNotes: entry.athleteNotes,
                        }
                      }
                    />
                  )}
                </WorkoutCard>
              </Reveal>
            );
          })}
        </div>

        <div className="space-y-5">
          <Reveal delay={0.06}>
            <ForgeMessageCard message={forge} />
          </Reveal>

          {ctx.todaySessions.some((s) => s.type !== 'rest') && (
            <Reveal delay={0.1}>
              <Panel className="p-6">
                <PanelHeader label="Why this session" />
                <p className="mt-4 text-[14px] leading-relaxed text-muted">
                  {explainSession(ctx.todaySessions.find((s) => s.type !== 'rest')!)}
                </p>
              </Panel>
            </Reveal>
          )}

          <Reveal delay={0.14}>
            <Panel className="p-6">
              <PanelHeader label={`Tomorrow · ${WEEKDAY_FULL[weekdayIndex(tomorrow)]}`} />
              {tomorrowSessions.length ? (
                <ul className="mt-4 space-y-3">
                  {tomorrowSessions.map((s) => (
                    <li key={s.id}>
                      <p className="text-[14px] font-bold">{s.name}</p>
                      {s.mainSet && (
                        <p className="mt-1 text-[12px] leading-relaxed text-muted">{s.mainSet}</p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[14px] text-muted">Nothing scheduled.</p>
              )}
              <Link
                href="/app/calendar"
                className="mt-6 block border-t border-line pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted transition-colors hover:text-green"
              >
                See the week
              </Link>
            </Panel>
          </Reveal>
        </div>
      </div>
    </AppPage>
  );
}
