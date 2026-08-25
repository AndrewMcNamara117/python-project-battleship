import { requireCoach, type Session } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { adherence, countsForAdherence } from '@/lib/domain/analytics';
import { addDays, daysBetween, endOfWeek, startOfWeek, toISODate } from '@/lib/domain/dates';
import type { CheckIn, Goal, Profile, Race, ScheduledWorkout } from '@/lib/domain/types';

export interface AthleteRow {
  profile: Profile;
  goal: Goal | null;
  race: Race | null;
  daysToRace: number | null;
  weekAdherencePct: number;
  sessionsThisWeek: { completed: number; prescribed: number };
  lastWorkoutDate: string | null;
  lastCheckIn: CheckIn | null;
  checkInDue: boolean;
  unreadMessages: number;
  missedLastTwoWeeks: number;
}

export interface CoachContext {
  session: Session;
  coach: Profile;
  today: string;
  weekStart: string;
  athletes: AthleteRow[];
  totals: {
    athletes: number;
    needingAttention: number;
    checkInsWaiting: number;
    missedSessions: number;
    upcomingRaces: number;
    averageAdherence: number;
  };
  upcomingRaces: { race: Race; athleteName: string; daysAway: number }[];
}

/**
 * The coach's whole operational picture, assembled once.
 *
 * Under Supabase every one of these reads is scoped by RLS to athletes actively
 * linked to this coach, so a coach cannot widen this by changing a parameter.
 */
export async function loadCoachContext(): Promise<CoachContext> {
  const session = await requireCoach();
  const repo = await getRepo();

  const coach = await repo.getProfile(session.userId);
  if (!coach) throw new Error('Coach profile not found');

  const today = toISODate(new Date());
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const twoWeeksAgo = addDays(weekStart, -14);

  const [profiles, queue] = await Promise.all([
    repo.listAthletesForCoach(session.userId),
    repo.listCheckInQueue(session.userId),
  ]);

  const athletes: AthleteRow[] = await Promise.all(
    profiles.map(async (profile) => {
      const [goal, week, recent, completed, messages] = await Promise.all([
        repo.getPrimaryGoal(profile.id),
        repo.listScheduled(profile.id, weekStart, weekEnd),
        repo.listScheduled(profile.id, twoWeeksAgo, today),
        repo.listCompleted(profile.id, twoWeeksAgo, today),
        repo.listMessages(profile.id),
      ]);

      const race = goal?.raceId ? await repo.getRace(goal.raceId) : null;
      const prescribed = week.filter(countsForAdherence);
      const lastCheckIn = queue.find((c) => c.athleteId === profile.id) ?? null;

      return {
        profile,
        goal,
        race,
        daysToRace: race ? daysBetween(today, race.date) : goal ? daysBetween(today, goal.targetDate) : null,
        weekAdherencePct: adherence(week, weekStart, weekEnd, today).pct,
        sessionsThisWeek: {
          completed: prescribed.filter((w) => w.status === 'completed').length,
          prescribed: prescribed.length,
        },
        lastWorkoutDate: completed[0]?.date ?? null,
        lastCheckIn,
        checkInDue: !queue.some((c) => c.athleteId === profile.id && c.weekStart === weekStart),
        unreadMessages: messages.filter((m) => m.recipientId === session.userId && !m.readAt).length,
        missedLastTwoWeeks: recent.filter((w) => w.status === 'missed' && countsForAdherence(w)).length,
      };
    }),
  );

  const needingAttention = athletes.filter(
    (a) => a.lastCheckIn?.attentionLevel === 'attention' || a.missedLastTwoWeeks >= 3,
  ).length;

  const upcomingRaces = athletes
    .filter((a) => a.race && a.daysToRace != null && a.daysToRace >= 0)
    .map((a) => ({ race: a.race!, athleteName: a.profile.fullName, daysAway: a.daysToRace! }))
    .sort((x, y) => x.daysAway - y.daysAway);

  return {
    session,
    coach,
    today,
    weekStart,
    athletes: athletes.sort((a, b) => rank(a) - rank(b)),
    totals: {
      athletes: athletes.length,
      needingAttention,
      checkInsWaiting: queue.filter((c) => !c.reviewedByCoachAt).length,
      missedSessions: athletes.reduce((sum, a) => sum + a.missedLastTwoWeeks, 0),
      upcomingRaces: upcomingRaces.filter((r) => r.daysAway <= 60).length,
      averageAdherence: athletes.length
        ? Math.round(athletes.reduce((s, a) => s + a.weekAdherencePct, 0) / athletes.length)
        : 0,
    },
    upcomingRaces,
  };
}

/** Athletes who need something come first — that is the entire point of the list. */
function rank(a: AthleteRow): number {
  if (a.lastCheckIn?.attentionLevel === 'attention') return 0;
  if (a.missedLastTwoWeeks >= 3) return 1;
  if (a.unreadMessages > 0) return 2;
  if (a.lastCheckIn && !a.lastCheckIn.reviewedByCoachAt) return 3;
  return 4;
}

export function attentionFlag(a: AthleteRow): { tone: 'alert' | 'warn' | 'green'; label: string } {
  if (a.lastCheckIn?.attentionLevel === 'attention') return { tone: 'alert', label: 'Attention' };
  if (a.missedLastTwoWeeks >= 3) return { tone: 'alert', label: 'Missing sessions' };
  if (a.lastCheckIn?.attentionLevel === 'watch') return { tone: 'warn', label: 'Watch' };
  if (a.weekAdherencePct < 60) return { tone: 'warn', label: 'Low adherence' };
  return { tone: 'green', label: 'On track' };
}

/** Sessions prescribed but not yet done, for the coach's own week view. */
export function outstanding(week: ScheduledWorkout[], today: string): ScheduledWorkout[] {
  return week.filter((w) => w.date <= today && w.status === 'scheduled' && countsForAdherence(w));
}
