import type { Metadata } from 'next';
import Link from 'next/link';
import { AppPage } from '@/components/app/PageHeader';
import { LogSessionForm } from '@/components/app/LogSessionForm';
import { AppHeader, SectionHeading } from '@/components/forge/AppHeader';
import { CompletedSummary } from '@/components/forge/CompletedSummary';
import { EmptyState } from '@/components/forge/EmptyState';
import { ForgeAssistant } from '@/components/forge/ForgeAssistant';
import { SessionCard, SessionRow } from '@/components/forge/SessionCard';
import { Rise } from '@/components/motion/Rise';
import { ButtonLink } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { loadAthleteContext } from '@/lib/app-data';
import { getRepo } from '@/lib/data';
import { addDays, formatLongDate, WEEKDAY_FULL, weekdayIndex } from '@/lib/domain/dates';
import { dailyMessage } from '@/lib/forge/assistant';

export const metadata: Metadata = { title: 'Today' };

/**
 * TODAY — the execution screen.
 *
 * Answers three questions in order, and nothing else competes with them:
 *   What am I doing today?   the session, at lead size
 *   Why am I doing it?       the purpose line inside the card
 *   How do I execute it?     structure, then the log form directly beneath
 *
 * Everything secondary — FORGE, what is next — sits in a side rail on desktop
 * and below the fold on a phone. An athlete standing at the trailhead should
 * never scroll past their session to find out what it is.
 */
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
  const units = ctx.profile.units;

  // the session that is the point of today, and any second slot after it
  const ordered = [...ctx.todaySessions].sort((a, b) => a.slot - b.slot);
  const lead = ordered.find((s) => s.type !== 'rest') ?? ordered[0] ?? null;
  const rest = ordered.filter((s) => s.id !== lead?.id);

  return (
    <AppPage>
      <AppHeader
        eyebrow={WEEKDAY_FULL[weekdayIndex(ctx.today)]}
        title={formatLongDate(ctx.today).replace(/^\w+,\s*/, '')}
        lead={
          lead && lead.type !== 'rest'
            ? 'One session on the plan. Run it as written.'
            : 'Nothing prescribed today.'
        }
        figure={
          ctx.daysToRace != null
            ? { value: ctx.daysToRace, label: `days to ${ctx.race?.name ?? 'race'}` }
            : undefined
        }
        action={
          <ButtonLink href="/app/calendar" variant="ghost" size="sm">
            Full calendar
          </ButtonLink>
        }
      />

      <div className="mt-7 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.65fr)_minmax(0,1fr)] lg:items-start">
        {/* ---- the session ---- */}
        <div className="min-w-0 space-y-5">
          {!lead && (
            <Rise>
              <EmptyState
                title="A clear day."
                body="Nothing is prescribed. Rest is part of the plan — the next session is waiting in your calendar."
                action={
                  <ButtonLink href="/app/calendar" variant="ghost">
                    See the week
                  </ButtonLink>
                }
              />
            </Rise>
          )}

          {lead && (
            <Rise>
              <SessionCard workout={lead} units={units} size="lead">
                {lead.type === 'rest' ? (
                  <p className="text-[14px] leading-relaxed text-ink-secondary">
                    Nothing to log. Rest is prescribed work — the adaptation you are training for
                    happens today, not in the session you would replace this with.
                  </p>
                ) : lead.type === 'strength' ? (
                  <div>
                    <p className="text-[14px] leading-relaxed text-ink-secondary">
                      Strength is logged set by set in the session player, so the loads and RPE stay
                      with the exercise they belong to.
                    </p>
                    <ButtonLink href="/app/strength" className="mt-5">
                      Open the session player
                    </ButtonLink>
                  </div>
                ) : (
                  <LogSessionForm
                    workout={lead}
                    units={units}
                    logged={(() => {
                      const entry = logged.find((l) => l.scheduledWorkoutId === lead.id);
                      return entry
                        ? {
                            actualDistanceKm: entry.actualDistanceKm,
                            actualDurationMinutes: entry.actualDurationMinutes,
                            rpe: entry.rpe,
                            athleteNotes: entry.athleteNotes,
                          }
                        : null;
                    })()}
                  />
                )}
              </SessionCard>
            </Rise>
          )}

          {/* what actually happened, once it has */}
          {lead &&
            logged
              .filter((l) => l.scheduledWorkoutId === lead.id)
              .map((entry) => (
                <Rise key={entry.id} delay={60}>
                  <CompletedSummary logged={entry} scheduled={lead} units={units} />
                </Rise>
              ))}

          {/* a second session on the same day */}
          {rest.length > 0 && (
            <div className="space-y-4 pt-2">
              <SectionHeading label="Also today" />
              {rest.map((w, i) => (
                <Rise key={w.id} delay={80 + i * 40}>
                  <SessionCard workout={w} units={units} purpose={false} />
                </Rise>
              ))}
            </div>
          )}
        </div>

        {/* ---- context, deliberately secondary ---- */}
        <div className="min-w-0 space-y-5">
          <Rise delay={60}>
            <ForgeAssistant message={forge} />
          </Rise>

          <Rise delay={100}>
            <Panel className="p-5 sm:p-6">
              <SectionHeading label={`Tomorrow · ${WEEKDAY_FULL[weekdayIndex(tomorrow)]}`} />
              {tomorrowSessions.length ? (
                <ul className="mt-5 space-y-4">
                  {tomorrowSessions.map((s) => (
                    <li key={s.id}>
                      <SessionRow workout={s} units={units} />
                      {s.mainSet && (
                        <p className="mt-2.5 pl-[22px] text-[12px] leading-relaxed text-ink-secondary">
                          {s.mainSet}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[14px] text-ink-secondary">Nothing scheduled.</p>
              )}
              <Link
                href="/app/calendar"
                className="mt-6 block border-t border-hairline pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-secondary transition-colors hover:text-mint"
              >
                See the week
              </Link>
            </Panel>
          </Rise>
        </div>
      </div>
    </AppPage>
  );
}
