import type { Metadata } from 'next';
import { AppPage } from '@/components/app/PageHeader';
import { AppHeader, SectionHeading } from '@/components/forge/AppHeader';
import { EmptyState } from '@/components/forge/EmptyState';
import { ForgeLine } from '@/components/forge/ForgeLine';
import { IntensityScale } from '@/components/forge/IntensityScale';
import { SessionCard } from '@/components/forge/SessionCard';
import { SessionGlyph } from '@/components/forge/SessionGlyph';
import { Rise } from '@/components/motion/Rise';
import { StatusTag, sessionLabel, sessionTone } from '@/components/ui/StatusTag';
import { ButtonLink } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { loadAthleteContext } from '@/lib/app-data';
import { getRepo } from '@/lib/data';
import { isRun } from '@/lib/domain/analytics';
import {
  addDays,
  daysBetween,
  formatDayMonth,
  formatDistance,
  formatMinutes,
  formatPaceRange,
  WEEKDAY_LABELS,
  weekdayIndex,
} from '@/lib/domain/dates';
import { WORKOUT_TYPE_LABELS } from '@/lib/domain/types';

export const metadata: Metadata = { title: 'Endurance' };

/**
 * ENDURANCE — the running programme.
 *
 * Structured so a session is the unit of attention, not a row in a list. The
 * next prescribed run gets the full card treatment; everything after it is a
 * legible queue that still carries type, intensity and the numbers to hold.
 *
 * The block header states where the athlete is in the programme, because a
 * session means something different in week 3 than in week 19 — and that
 * context is the difference between a training system and a workout list.
 */
export default async function TrainingPage() {
  const ctx = await loadAthleteContext();
  const repo = await getRepo();
  const program = await repo.getProgram(ctx.session.userId);

  const upcoming = await repo.listScheduled(ctx.session.userId, ctx.today, addDays(ctx.today, 28));
  const runs = upcoming.filter((w) => isRun(w.type) || w.type === 'brick' || w.type === 'cross_training');
  const [next, ...queue] = runs;

  const units = ctx.profile.units;
  const weeksElapsed = program
    ? Math.max(0, Math.floor(daysBetween(program.startDate, ctx.today) / 7))
    : 0;
  const weeksTotal = program ? Math.ceil(daysBetween(program.startDate, program.endDate) / 7) : 0;
  const blockProgress = weeksTotal ? Math.min(1, (weeksElapsed + 1) / weeksTotal) : 0;

  const volumeSeries = ctx.buckets.map((b) => b.actualKm);
  const longRunSeries = ctx.buckets.map((b) => b.longestRunKm);

  return (
    <AppPage>
      <AppHeader
        eyebrow="Endurance programme"
        title={program?.name ?? 'Your programme'}
        lead={
          program
            ? `Written by ${ctx.coach?.fullName ?? 'your coach'} and adjusted every week off what you log.`
            : 'No active programme yet. Your coach writes the first block after onboarding.'
        }
        figure={
          program ? { value: `${weeksElapsed + 1}/${weeksTotal}`, label: 'weeks into the block' } : undefined
        }
      />

      {/* ---- where the block is ---- */}
      {program && (
        <Rise>
          <Panel className="mt-7 p-5 sm:p-6">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
              <SectionHeading label="Block progress" />
              <p className="im-mono text-[11px] tracking-[0.12em] text-ink-secondary">
                {formatDayMonth(program.startDate)} → {formatDayMonth(program.endDate)}
              </p>
            </div>
            <div className="mt-4 h-px w-full bg-steel">
              <div
                className="h-px bg-mint transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ width: `${blockProgress * 100}%` }}
              />
            </div>

            <div className="mt-7 grid gap-x-8 gap-y-7 sm:grid-cols-2">
              <div className="min-w-0">
                <SectionHeading label="Weekly volume" />
                <ForgeLine
                  variant="load"
                  data={volumeSeries}
                  label="Weekly volume"
                  unit={units === 'metric' ? 'km' : 'mi'}
                  className="mt-3.5 w-full"
                  height={46}
                />
              </div>
              <div className="min-w-0">
                <SectionHeading label="Long-run progression" />
                <ForgeLine
                  variant="elevation"
                  data={longRunSeries}
                  label="Longest run each week"
                  unit={units === 'metric' ? 'km' : 'mi'}
                  className="mt-3.5 w-full"
                  height={46}
                  delay={120}
                />
              </div>
            </div>
          </Panel>
        </Rise>
      )}

      {/* ---- the next session, at full weight ---- */}
      <section className="mt-9">
        <SectionHeading
          label="Next session"
          action={
            next ? (
              <span className="im-mono text-[11px] tracking-[0.12em] text-ink-secondary">
                {next.date === ctx.today
                  ? 'Today'
                  : `${WEEKDAY_LABELS[weekdayIndex(next.date)]} · ${formatDayMonth(next.date)}`}
              </span>
            ) : undefined
          }
        />
        <div className="mt-4">
          {next ? (
            <Rise>
              <SessionCard workout={next} units={units} size="lead">
                <div className="flex flex-wrap gap-3">
                  {next.date === ctx.today && (
                    <ButtonLink href="/app/today">Open today</ButtonLink>
                  )}
                  <ButtonLink href="/app/calendar" variant="ghost">
                    See it in the calendar
                  </ButtonLink>
                </div>
              </SessionCard>
            </Rise>
          ) : (
            <EmptyState
              title="Nothing prescribed."
              body="No endurance sessions are scheduled in the next four weeks. Your coach assigns the next block from their programme builder."
              action={
                <ButtonLink href="/app/coach" variant="ghost">
                  Message your coach
                </ButtonLink>
              }
            />
          )}
        </div>
      </section>

      {/* ---- the queue ---- */}
      {queue.length > 0 && (
        <section className="mt-10">
          <SectionHeading
            label="Coming up"
            action={
              <span className="im-mono text-[10px] uppercase tracking-[0.16em] text-ink-tertiary">
                Next four weeks
              </span>
            }
          />
          <ul className="mt-4 space-y-3">
            {queue.slice(0, 14).map((w, i) => (
              <Rise key={w.id} delay={Math.min(i * 25, 200)}>
                <Panel hover className="flex flex-wrap items-center gap-x-6 gap-y-4 p-4 sm:p-5">
                  <div className="flex w-[104px] shrink-0 items-center gap-3">
                    <SessionGlyph type={w.type} status={w.status} className="shrink-0" />
                    <div className="min-w-0">
                      <p className="im-mono text-[11px] font-bold text-ink">{formatDayMonth(w.date)}</p>
                      <p className="im-micro mt-1 text-[9px]">{WEEKDAY_LABELS[weekdayIndex(w.date)]}</p>
                    </div>
                  </div>

                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-semibold text-ink-body">{w.name}</p>
                    <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-ink-secondary">
                      {WORKOUT_TYPE_LABELS[w.type]}
                    </p>
                    {w.mainSet && (
                      <p className="mt-2 max-w-[62ch] text-[12px] leading-relaxed text-ink-secondary">
                        {w.mainSet}
                      </p>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2">
                    <dl className="im-mono flex gap-5 text-[12px]">
                      {w.distanceKm != null && (
                        <div>
                          <dt className="im-micro text-[9px]">Distance</dt>
                          <dd className="mt-1 font-bold text-ink">
                            {formatDistance(w.distanceKm, units)}
                          </dd>
                        </div>
                      )}
                      {w.durationMinutes != null && (
                        <div>
                          <dt className="im-micro text-[9px]">Time</dt>
                          <dd className="mt-1 font-bold text-ink">
                            {formatMinutes(w.durationMinutes)}
                          </dd>
                        </div>
                      )}
                      {w.paceRange && (
                        <div className="hidden xl:block">
                          <dt className="im-micro text-[9px]">Pace</dt>
                          <dd className="mt-1 font-bold text-ink">
                            {formatPaceRange(w.paceRange, units)}
                          </dd>
                        </div>
                      )}
                    </dl>
                    <IntensityScale intensity={w.intensity} showLabel={false} />
                    <StatusTag tone={sessionTone(w.status)}>{sessionLabel(w.status)}</StatusTag>
                  </div>
                </Panel>
              </Rise>
            ))}
          </ul>
        </section>
      )}
    </AppPage>
  );
}
