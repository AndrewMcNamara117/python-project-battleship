import type { Metadata } from 'next';
import Link from 'next/link';
import { AppPage } from '@/components/app/PageHeader';
import { WorkoutCard } from '@/components/app/WorkoutCard';
import { ForgeAssistant } from '@/components/forge/ForgeAssistant';
import { ForgeLine } from '@/components/forge/ForgeLine';
import { ForgeScore } from '@/components/forge/ForgeScore';
import { MetricCard } from '@/components/forge/MetricCard';
import { RaceCountdown } from '@/components/forge/RaceCountdown';
import { WeekStrip } from '@/components/forge/WeekStrip';
import { Rise } from '@/components/motion/Rise';
import { StatusTag, adherenceTone } from '@/components/ui/StatusTag';
import { ButtonLink } from '@/components/ui/Button';
import { Panel } from '@/components/ui/Panel';
import { loadAthleteContext } from '@/lib/app-data';
import { getRepo } from '@/lib/data';
import { formatDistance, greeting } from '@/lib/domain/dates';
import { dailyMessage } from '@/lib/forge/assistant';
import { EVENT_TYPE_LABELS } from '@/lib/domain/types';

export const metadata: Metadata = { title: 'Dashboard' };

/**
 * THE ATHLETE DASHBOARD — the reference implementation.
 *
 * Information architecture is unchanged from the version this replaces. What
 * changed is the language it speaks: Montserrat, the cool-neutral ramp, one
 * mint accent, ForgeLine carrying real training data, and terrain kept to the
 * header where it cannot sit under a number.
 *
 * The ordering answers one question first — what am I doing today? Today's
 * session is the first substantial thing on the page on every viewport, and on
 * mobile it is above the fold before the race header scrolls away. Everything
 * below it is context for that answer.
 */
export default async function DashboardPage() {
  const ctx = await loadAthleteContext();
  const repo = await getRepo();
  const leaderboard = await repo.getLeaderboard('monthly', 'forge_score');

  const firstName = ctx.profile.fullName.split(' ')[0] || 'Athlete';
  const units = ctx.profile.units;

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

  const primary = ctx.todaySessions.find((s) => s.type !== 'rest') ?? ctx.todaySessions[0] ?? null;
  const nextStrength = ctx.week.find((w) => w.type === 'strength' && w.status === 'scheduled');
  const lastCoachMessage = [...ctx.messages].reverse().find((m) => m.senderId !== ctx.session.userId);
  const myRank = leaderboard.find((r) => r.athleteId === ctx.session.userId);

  // Real series, straight from the athlete's own logged training.
  const volumeSeries = ctx.buckets.map((b) => b.actualKm);
  const adherenceSeries = ctx.buckets.map((b) =>
    b.plannedSessions ? Math.round((b.completedSessions / b.plannedSessions) * 100) : 0,
  );
  const plannedSeries = ctx.buckets.map((b) => b.plannedKm);

  return (
    <AppPage>
      {/* ---- who and where ---- */}
      <Rise>
        <p className="im-micro-lg">
          {greeting()}, <span className="text-mint">{firstName}</span>
        </p>
      </Rise>

      {/* ---- the goal: why any of this is happening ---- */}
      {(ctx.race || ctx.goal) && (
        <Rise delay={40} className="mt-5">
          <RaceCountdown
            raceName={ctx.race?.name ?? 'Your goal'}
            raceDate={ctx.race?.date ?? ctx.goal?.targetDate ?? ctx.today}
            distanceKm={ctx.race?.distanceKm ?? null}
            daysToGo={ctx.daysToRace}
            units={units}
            eventLabel={ctx.goal ? EVENT_TYPE_LABELS[ctx.goal.eventType] : 'Goal'}
            trajectory={volumeSeries}
          />
        </Rise>
      )}

      {/* ---- today. the answer the athlete came for. ---- */}
      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <Rise delay={60}>
          {primary ? (
            <WorkoutCard workout={primary} units={units}>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/app/today">
                  {primary.status === 'completed' ? 'View session' : 'Open today'}
                </ButtonLink>
                <ButtonLink href="/app/calendar" variant="ghost">
                  See the week
                </ButtonLink>
              </div>
            </WorkoutCard>
          ) : (
            <Panel className="p-7 sm:p-8">
              <p className="im-micro">Today</p>
              <h2 className="im-display mt-4 text-[1.6rem] text-ink">A clear day.</h2>
              <p className="mt-3 max-w-[46ch] text-[14px] leading-relaxed text-ink-secondary">
                Nothing prescribed. Rest is part of the plan — the next session is in your calendar.
              </p>
              <ButtonLink href="/app/calendar" variant="ghost" className="mt-6">
                See the week
              </ButtonLink>
            </Panel>
          )}
        </Rise>

        <div className="grid min-w-0 gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <Rise delay={100}>
            <ForgeAssistant message={forge} />
          </Rise>
          <Rise delay={140}>
            <WeekStrip
              week={ctx.week}
              weekStart={ctx.weekStart}
              today={ctx.today}
              adherencePct={ctx.stats.weekAdherencePct}
              actualLabel={formatDistance(ctx.stats.weeklyActualKm, units)}
              targetLabel={formatDistance(ctx.stats.weeklyTargetKm, units)}
            />
          </Rise>
        </div>
      </div>

      {/* ---- the work, measured ---- */}
      <div className="mt-5 grid min-w-0 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <Rise delay={40}>
          <MetricCard
            label="Weekly volume"
            value={ctx.stats.weeklyActualKm}
            decimals={1}
            suffix={units === 'metric' ? 'km' : 'mi'}
            emphasis
            meter={
              ctx.stats.weeklyTargetKm ? ctx.stats.weeklyActualKm / ctx.stats.weeklyTargetKm : 0
            }
            note={`Against ${formatDistance(ctx.stats.weeklyTargetKm, units)} prescribed`}
          >
            <ForgeLine
              variant="load"
              data={volumeSeries}
              reference={plannedSeries}
              label="Weekly volume"
              unit={units === 'metric' ? 'km' : 'mi'}
              className="mt-4 w-full"
              height={40}
            />
          </MetricCard>
        </Rise>

        <Rise delay={80}>
          <MetricCard
            label="Block adherence"
            value={ctx.stats.blockAdherencePct}
            suffix="%"
            meter={ctx.stats.blockAdherencePct / 100}
            note="Completed against prescribed, last 12 weeks"
          >
            <div className="mt-4">
              <StatusTag tone={adherenceTone(ctx.stats.blockAdherencePct)}>
                {ctx.stats.blockAdherencePct >= 90
                  ? 'On the plan'
                  : ctx.stats.blockAdherencePct >= 70
                    ? 'Holding'
                    : 'Slipping'}
              </StatusTag>
            </div>
          </MetricCard>
        </Rise>

        <Rise delay={120}>
          <MetricCard
            label="Consistency"
            value={ctx.stats.consistencyPct}
            suffix="%"
            meter={ctx.stats.consistencyPct / 100}
            note="Weeks with training logged"
          >
            <ForgeLine
              variant="performance"
              data={adherenceSeries}
              label="Weekly adherence"
              unit="%"
              className="mt-4 w-full"
              height={40}
            />
          </MetricCard>
        </Rise>

        <Rise delay={160}>
          <ForgeScore
            total={ctx.stats.forgeTotal}
            tier={ctx.stats.tier}
            streakWeeks={ctx.stats.streakWeeks}
          />
        </Rise>
      </div>

      {/* ---- coaching, strength, community ---- */}
      <div className="mt-5 grid min-w-0 gap-5 lg:grid-cols-3">
        <Rise delay={40}>
          <Panel className="flex h-full flex-col p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <p className="im-micro">From your coach</p>
              {ctx.unreadCount > 0 && <StatusTag tone="solid">{ctx.unreadCount} new</StatusTag>}
            </div>

            {lastCoachMessage ? (
              <>
                <p className="mt-5 flex-1 text-[14px] leading-relaxed text-ink-body">
                  {lastCoachMessage.body}
                </p>
                <p className="im-micro mt-5">
                  {ctx.coach?.fullName ?? 'Coach'} ·{' '}
                  {new Date(lastCoachMessage.createdAt).toLocaleDateString('en-IE', {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
              </>
            ) : (
              <p className="mt-5 flex-1 text-[14px] text-ink-secondary">No messages yet.</p>
            )}

            <Link
              href="/app/coach"
              className="mt-6 border-t border-hairline pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-secondary transition-colors hover:text-mint"
            >
              Open messages
            </Link>
          </Panel>
        </Rise>

        <Rise delay={80}>
          <Panel className="flex h-full flex-col p-5 sm:p-6">
            <p className="im-micro">Next strength session</p>
            {nextStrength ? (
              <>
                <h3 className="im-display mt-4 text-[1.15rem] text-ink">{nextStrength.name}</h3>
                <p className="mt-3 flex-1 text-[13px] leading-relaxed text-ink-secondary">
                  {nextStrength.mainSet ?? 'Prescribed strength work.'}
                </p>
                <Link
                  href="/app/strength"
                  className="mt-6 border-t border-hairline pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-secondary transition-colors hover:text-mint"
                >
                  Open the session player
                </Link>
              </>
            ) : (
              <p className="mt-5 flex-1 text-[14px] text-ink-secondary">
                Both strength sessions done this week.
              </p>
            )}
          </Panel>
        </Rise>

        <Rise delay={120}>
          <Panel className="flex h-full flex-col p-5 sm:p-6">
            <p className="im-micro">Miles together</p>
            {ctx.profile.leaderboardOptIn && myRank ? (
              <div className="mt-4 flex-1">
                <p className="im-figure text-[2.2rem] text-mint">#{myRank.rank}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-ink-secondary">
                  of {leaderboard.length} athletes this month ·{' '}
                  <span className="im-mono text-ink-body">{myRank.value}</span> points
                </p>
                {myRank.group && <p className="im-micro mt-4">{myRank.group}</p>}
              </div>
            ) : (
              <p className="mt-4 flex-1 text-[14px] leading-relaxed text-ink-secondary">
                The leaderboard is opt-in and currently off. Turn it on in your profile to be listed —
                only your name and Forge Score are ever shown.
              </p>
            )}
            <Link
              href="/app/leaderboard"
              className="mt-6 border-t border-hairline pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-ink-secondary transition-colors hover:text-mint"
            >
              Open leaderboard
            </Link>
          </Panel>
        </Rise>
      </div>
    </AppPage>
  );
}
