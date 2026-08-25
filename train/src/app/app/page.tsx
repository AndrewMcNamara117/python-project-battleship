import type { Metadata } from 'next';
import Link from 'next/link';
import { AppPage } from '@/components/app/PageHeader';
import { ForgeMessageCard } from '@/components/app/ForgeMessageCard';
import { StatCard } from '@/components/app/StatCard';
import { WorkoutCard, WorkoutRow } from '@/components/app/WorkoutCard';
import { Sparkline } from '@/components/charts/TrainingCharts';
import { Reveal, RevealGroup, RevealItem } from '@/components/motion/Reveal';
import { Badge, Dot } from '@/components/ui/Badge';
import { ButtonLink } from '@/components/ui/Button';
import { Panel, PanelHeader } from '@/components/ui/Panel';
import { loadAthleteContext } from '@/lib/app-data';
import { formatDistance, formatLongDate, greeting, WEEKDAY_LABELS, weekDates } from '@/lib/domain/dates';
import { dailyMessage } from '@/lib/forge/assistant';
import { EVENT_TYPE_LABELS } from '@/lib/domain/types';
import { getRepo } from '@/lib/data';

export const metadata: Metadata = { title: 'Dashboard' };

export default async function DashboardPage() {
  const ctx = await loadAthleteContext();
  const repo = await getRepo();
  const leaderboard = await repo.getLeaderboard('monthly', 'forge_score');

  const firstName = ctx.profile.fullName.split(' ')[0] || 'Athlete';
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
  const days = weekDates(ctx.weekStart);

  return (
    <AppPage>
      {/* ---- greeting + race countdown ---- */}
      <Reveal>
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="im-eyebrow">
              {greeting()}, {firstName}
            </p>
            <h1 className="im-display mt-3 text-[clamp(1.9rem,4.4vw,2.8rem)]">
              {ctx.race?.name ?? ctx.goal ? (ctx.race?.name ?? 'Your goal') : 'No goal set'}
            </h1>
            <p className="im-mono mt-3 text-[13px] tracking-[0.16em] text-muted">
              {ctx.race?.distanceKm
                ? `${formatDistance(ctx.race.distanceKm, ctx.profile.units)} · `
                : ctx.goal
                  ? `${EVENT_TYPE_LABELS[ctx.goal.eventType]} · `
                  : ''}
              {formatLongDate(ctx.race?.date ?? ctx.goal?.targetDate ?? ctx.today)}
            </p>
          </div>

          {ctx.daysToRace != null && (
            <div className="text-right">
              <p className="im-display text-[clamp(2.6rem,7vw,4.2rem)] leading-none text-green">
                {ctx.daysToRace}
              </p>
              <p className="im-micro mt-2">
                {ctx.daysToRace === 1 ? 'day to go' : 'days to go'}
              </p>
            </div>
          )}
        </div>
      </Reveal>

      {/* ---- today ---- */}
      <div className="mt-9 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <Reveal>
          {primary ? (
            <WorkoutCard workout={primary} units={ctx.profile.units}>
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
            <Panel className="p-8">
              <p className="im-micro">Today</p>
              <h2 className="im-display mt-4 text-[1.6rem]">Nothing prescribed</h2>
              <p className="mt-3 text-[14px] text-muted">
                Your next session is in the calendar. Rest is part of the plan.
              </p>
              <ButtonLink href="/app/calendar" variant="ghost" className="mt-6">
                See the week
              </ButtonLink>
            </Panel>
          )}
        </Reveal>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1">
          <Reveal delay={0.06}>
            <ForgeMessageCard message={forge} />
          </Reveal>

          <Reveal delay={0.12}>
            <Panel className="p-6">
              <PanelHeader
                label="This week"
                action={
                  <span className="im-mono text-[11px] tracking-[0.14em] text-green">
                    {ctx.stats.weekAdherencePct}%
                  </span>
                }
              />
              <ol className="mt-5 grid grid-cols-7 gap-1.5">
                {days.map((d, i) => {
                  const sessions = ctx.week.filter((w) => w.date === d);
                  const done = sessions.some((s) => s.status === 'completed');
                  const missed = sessions.some((s) => s.status === 'missed');
                  const rest = sessions.length > 0 && sessions.every((s) => s.type === 'rest');
                  const isToday = d === ctx.today;
                  return (
                    <li key={d} className="text-center">
                      <span className="im-micro block">{WEEKDAY_LABELS[i]}</span>
                      <span
                        className={`mt-2 flex h-9 items-center justify-center rounded-xs border text-[11px] font-bold ${
                          done
                            ? 'border-green bg-green/15 text-green'
                            : missed
                              ? 'border-alert/40 text-alert'
                              : rest
                                ? 'border-line text-muted-2'
                                : 'border-line-2 text-muted'
                        } ${isToday ? 'ring-1 ring-green/60' : ''}`}
                        title={sessions.map((s) => s.name).join(', ') || 'Nothing scheduled'}
                      >
                        {done ? '✓' : rest ? '—' : missed ? '×' : sessions.length ? '•' : ''}
                      </span>
                    </li>
                  );
                })}
              </ol>
              <p className="mt-5 border-t border-line pt-4 text-[12px] text-muted">
                {formatDistance(ctx.stats.weeklyActualKm, ctx.profile.units)} of{' '}
                {formatDistance(ctx.stats.weeklyTargetKm, ctx.profile.units)} prescribed
              </p>
            </Panel>
          </Reveal>
        </div>
      </div>

      {/* ---- the numbers ---- */}
      <RevealGroup className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <RevealItem>
          <StatCard
            label="Block adherence"
            value={ctx.stats.blockAdherencePct}
            suffix="%"
            meter={ctx.stats.blockAdherencePct / 100}
            note="Completed against prescribed, last 12 weeks."
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Weekly volume"
            value={ctx.stats.weeklyActualKm}
            decimals={1}
            suffix={ctx.profile.units === 'metric' ? 'km' : 'mi'}
            meter={ctx.stats.weeklyTargetKm ? ctx.stats.weeklyActualKm / ctx.stats.weeklyTargetKm : 0}
          >
            <div className="mt-4">
              <Sparkline data={ctx.buckets} dataKey="actualKm" />
            </div>
          </StatCard>
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Forge Score"
            value={ctx.stats.forgeTotal}
            meter={ctx.stats.tier.progress}
            note={
              ctx.stats.tier.next
                ? `${ctx.stats.tier.name} · ${ctx.stats.tier.pointsToNext} to ${ctx.stats.tier.next}`
                : `${ctx.stats.tier.name} — top tier`
            }
          />
        </RevealItem>
        <RevealItem>
          <StatCard
            label="Week streak"
            value={ctx.stats.streakWeeks}
            note={
              ctx.stats.loadRatio != null
                ? `Load ratio ${ctx.stats.loadRatio.toFixed(2)} — last 7 days against your 28-day average.`
                : 'Consecutive weeks with training logged.'
            }
          />
        </RevealItem>
      </RevealGroup>

      {/* ---- coach, strength, community ---- */}
      <div className="mt-5 grid gap-5 lg:grid-cols-3">
        <Reveal>
          <Panel className="flex h-full flex-col p-6">
            <PanelHeader
              label="From your coach"
              action={
                ctx.unreadCount > 0 ? <Badge tone="green">{ctx.unreadCount} new</Badge> : undefined
              }
            />
            {lastCoachMessage ? (
              <>
                <p className="mt-5 flex-1 text-[14px] leading-relaxed text-white">
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
              <p className="mt-5 flex-1 text-[14px] text-muted">No messages yet.</p>
            )}
            <Link
              href="/app/coach"
              className="mt-6 border-t border-line pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted transition-colors hover:text-green"
            >
              Open messages
            </Link>
          </Panel>
        </Reveal>

        <Reveal delay={0.06}>
          <Panel className="flex h-full flex-col p-6">
            <PanelHeader label="Next strength session" />
            {nextStrength ? (
              <>
                <div className="mt-5 flex-1">
                  <WorkoutRow workout={nextStrength} units={ctx.profile.units} />
                  <p className="mt-4 text-[13px] leading-relaxed text-muted">
                    {nextStrength.mainSet ?? 'Prescribed strength work.'}
                  </p>
                </div>
                <Link
                  href="/app/strength"
                  className="mt-6 border-t border-line pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted transition-colors hover:text-green"
                >
                  Open the plan
                </Link>
              </>
            ) : (
              <p className="mt-5 flex-1 text-[14px] text-muted">
                Both strength sessions done this week.
              </p>
            )}
          </Panel>
        </Reveal>

        <Reveal delay={0.12}>
          <Panel className="flex h-full flex-col p-6">
            <PanelHeader label="Community position" />
            {ctx.profile.leaderboardOptIn && myRank ? (
              <div className="mt-5 flex-1">
                <p className="im-display text-[2.4rem] leading-none text-green">#{myRank.rank}</p>
                <p className="mt-3 text-[13px] text-muted">
                  of {leaderboard.length} athletes this month · {myRank.value} points
                </p>
                {myRank.group && (
                  <p className="im-micro mt-4 flex items-center gap-2">
                    <Dot /> {myRank.group}
                  </p>
                )}
              </div>
            ) : (
              <div className="mt-5 flex-1">
                <p className="text-[14px] leading-relaxed text-muted">
                  The leaderboard is opt-in and currently off. Turn it on in your profile if you want
                  to be listed — only your name and Forge Score are ever shown.
                </p>
              </div>
            )}
            <Link
              href="/app/leaderboard"
              className="mt-6 border-t border-line pt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted transition-colors hover:text-green"
            >
              Open leaderboard
            </Link>
          </Panel>
        </Reveal>
      </div>
    </AppPage>
  );
}
