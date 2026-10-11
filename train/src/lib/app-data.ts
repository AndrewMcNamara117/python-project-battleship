import { getRepo } from '@/lib/data';
import { requireSession, type Session } from '@/lib/auth';
import { adherence, buildWeekBuckets, consistency, loadRatio, type WeekBucket } from '@/lib/domain/analytics';
import { addDays, daysBetween, endOfWeek, startOfWeek, toISODate } from '@/lib/domain/dates';
import { currentStreakWeeks, monthlyScore, tierFor, totalScore, weeklyScore } from '@/lib/domain/forge-score';
import type {
  CheckIn,
  CompletedWorkout,
  ForgeScoreEvent,
  Goal,
  Message,
  Profile,
  Race,
  ScheduledWorkout,
  StrengthSession,
} from '@/lib/domain/types';

export interface AthleteContext {
  session: Session;
  profile: Profile;
  coach: Profile | null;
  goal: Goal | null;
  race: Race | null;
  today: string;
  weekStart: string;
  weekEnd: string;
  daysToRace: number | null;
  /** This week's prescribed sessions, in order. */
  week: ScheduledWorkout[];
  todaySessions: ScheduledWorkout[];
  completedThisWeek: CompletedWorkout[];
  strengthThisWeek: StrengthSession[];
  buckets: WeekBucket[];
  checkins: CheckIn[];
  forgeEvents: ForgeScoreEvent[];
  messages: Message[];
  unreadCount: number;
  stats: {
    weeklyTargetKm: number;
    weeklyActualKm: number;
    weekAdherencePct: number;
    blockAdherencePct: number;
    consistencyPct: number;
    loadRatio: number | null;
    forgeTotal: number;
    forgeWeek: number;
    forgeMonth: number;
    streakWeeks: number;
    tier: ReturnType<typeof tierFor>;
  };
}

/**
 * One load for the whole athlete area.
 *
 * Every /app route needs most of this, and fetching it once per request keeps
 * the pages declarative — they read from a context object instead of each
 * issuing its own overlapping queries.
 */
export async function loadAthleteContext(): Promise<AthleteContext> {
  const session = await requireSession();
  const repo = await getRepo();

  const today = toISODate(new Date());
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const historyFrom = addDays(weekStart, -7 * 19);

  const [profile, coach, goal, week, completedRange, strengthRange, scheduledRange, checkins, forgeEvents, messages] =
    await Promise.all([
      repo.getProfile(session.userId),
      repo.getCoachForAthlete(session.userId),
      repo.getPrimaryGoal(session.userId),
      repo.listScheduled(session.userId, weekStart, weekEnd),
      repo.listCompleted(session.userId, historyFrom, weekEnd),
      repo.listStrengthSessions(session.userId, historyFrom, weekEnd),
      repo.listScheduled(session.userId, historyFrom, weekEnd),
      repo.listCheckIns(session.userId, 20),
      repo.listForgeEvents(session.userId),
      repo.listMessages(session.userId),
    ]);

  if (!profile) throw new Error('Profile not found');

  const race = goal?.raceId ? await repo.getRace(goal.raceId) : null;
  const buckets = buildWeekBuckets(scheduledRange, completedRange, strengthRange, 12, today);
  const thisWeekBucket = buckets[buckets.length - 1];

  const weekAdherence = adherence(week, weekStart, weekEnd, today);
  const blockAdherence = adherence(scheduledRange, addDays(weekStart, -7 * 11), weekEnd, today);

  const total = totalScore(forgeEvents);

  return {
    session,
    profile,
    coach,
    goal,
    race,
    today,
    weekStart,
    weekEnd,
    daysToRace: race ? daysBetween(today, race.date) : goal ? daysBetween(today, goal.targetDate) : null,
    week,
    todaySessions: week.filter((w) => w.date === today),
    completedThisWeek: completedRange.filter((w) => w.date >= weekStart && w.date <= weekEnd),
    strengthThisWeek: strengthRange.filter((s) => s.date >= weekStart && s.date <= weekEnd),
    buckets,
    checkins,
    forgeEvents,
    messages,
    unreadCount: messages.filter((m) => m.recipientId === session.userId && !m.readAt).length,
    stats: {
      weeklyTargetKm: thisWeekBucket?.plannedKm ?? 0,
      weeklyActualKm: thisWeekBucket?.actualKm ?? 0,
      weekAdherencePct: weekAdherence.pct,
      blockAdherencePct: blockAdherence.pct,
      consistencyPct: consistency(buckets),
      loadRatio: loadRatio(completedRange, today),
      forgeTotal: total,
      forgeWeek: weeklyScore(forgeEvents, today),
      forgeMonth: monthlyScore(forgeEvents, today),
      streakWeeks: currentStreakWeeks(forgeEvents, today),
      tier: tierFor(total),
    },
  };
}
