import { requireCoach, type Session } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { startOfWeek, toISODate } from '@/lib/domain/dates';
import type { RosterEntry } from '@/lib/domain/roster';
import type { ISODate, ISOTimestamp, Profile, UUID } from '@/lib/domain/types';

/**
 * One athlete as the coach's screens read them.
 *
 * Sourced from the single roster query rather than assembled per athlete: a
 * coach with fifty athletes used to cost six database round trips each.
 */
export interface AthleteRow {
  profile: Pick<Profile, 'id' | 'fullName' | 'avatarUrl'>;
  eventType: string | null;
  race: { id: UUID; name: string; date: ISODate } | null;
  daysToRace: number | null;
  weekAdherencePct: number | null;
  sessionsThisWeek: { completed: number; prescribed: number };
  lastWorkoutDate: ISODate | null;
  lastCheckIn: {
    weekStart: ISODate;
    attentionLevel: 'none' | 'watch' | 'attention';
    attentionReasons: string[];
    /** Read by the coach. Not the same as answered. */
    reviewedByCoachAt: ISOTimestamp | null;
  } | null;
  checkInDue: boolean;
  unreadMessages: number;
  missedLastTwoWeeks: number;
  /** Everything the roster view needs, kept rather than flattened away. */
  entry: RosterEntry;
}

export interface CoachContext {
  session: Session;
  coach: Profile;
  today: string;
  /** One clock for the render, so waiting times agree down the page. */
  now: string;
  weekStart: string;
  athletes: AthleteRow[];
  /** The same athletes, with their signals, for the operating view. */
  roster: RosterEntry[];
  totals: {
    athletes: number;
    needingAttention: number;
    checkInsWaiting: number;
    missedSessions: number;
    upcomingRaces: number;
    averageAdherence: number;
  };
  upcomingRaces: { race: { id: UUID; name: string; date: ISODate }; athleteName: string; daysAway: number }[];
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

  // one call, whatever the roster size
  const roster = await repo.listRoster(session.userId, today);

  const athletes: AthleteRow[] = roster.map((entry) => ({
    profile: { id: entry.athleteId, fullName: entry.fullName, avatarUrl: entry.avatarUrl },
    eventType: entry.eventType,
    race: entry.raceId && entry.raceName && entry.raceDate
      ? { id: entry.raceId, name: entry.raceName, date: entry.raceDate }
      : null,
    daysToRace: entry.daysToRace,
    weekAdherencePct: entry.plannedThisWeek
      ? Math.round((entry.completedThisWeek / entry.plannedThisWeek) * 100)
      : null,
    sessionsThisWeek: { completed: entry.completedThisWeek, prescribed: entry.plannedThisWeek },
    lastWorkoutDate: entry.lastCompletedDate,
    lastCheckIn: entry.checkIn
      ? {
          weekStart: entry.checkIn.weekStart,
          attentionLevel: entry.checkIn.attention,
          attentionReasons: entry.checkIn.reasons,
          reviewedByCoachAt: entry.checkIn.acknowledgedAt,
        }
      : null,
    checkInDue: entry.checkIn?.weekStart !== weekStart,
    unreadMessages: entry.unreadFromAthlete,
    missedLastTwoWeeks: entry.missedFourteenDays,
    entry,
  }));

  const needingAttention = athletes.filter(
    (a) => a.entry.signals.some((s) => s.severity !== 'information'),
  ).length;

  const upcomingRaces = athletes
    .filter((a) => a.race && a.daysToRace != null && a.daysToRace >= 0)
    .map((a) => ({ race: a.race!, athleteName: a.profile.fullName, daysAway: a.daysToRace! }))
    .sort((x, y) => x.daysAway - y.daysAway);

  const withAdherence = athletes.filter((a) => a.weekAdherencePct != null);

  return {
    session,
    coach,
    today,
    // One clock for the whole render, stamped on the server. A waiting time
    // computed per component would disagree with itself down the page.
    now: new Date().toISOString(),
    weekStart,
    // already ranked by the roster: loudest signal, then most signals, then name
    athletes,
    roster,
    totals: {
      athletes: athletes.length,
      needingAttention,
      // waiting to be read, not waiting to be answered
      checkInsWaiting: athletes.filter((a) => a.lastCheckIn && !a.lastCheckIn.reviewedByCoachAt).length,
      missedSessions: athletes.reduce((sum, a) => sum + a.missedLastTwoWeeks, 0),
      upcomingRaces: upcomingRaces.length,
      averageAdherence: withAdherence.length
        ? Math.round(withAdherence.reduce((sum, a) => sum + (a.weekAdherencePct ?? 0), 0) / withAdherence.length)
        : 0,
    },
    upcomingRaces,
  };
}

export function attentionFlag(a: AthleteRow): { tone: 'alert' | 'warn' | 'green'; label: string } {
  if (a.lastCheckIn?.attentionLevel === 'attention') return { tone: 'alert', label: 'Attention' };
  if (a.missedLastTwoWeeks >= 3) return { tone: 'alert', label: 'Missing sessions' };
  if (a.lastCheckIn?.attentionLevel === 'watch') return { tone: 'warn', label: 'Watch' };
  if (a.weekAdherencePct != null && a.weekAdherencePct < 60) {
    return { tone: 'warn', label: 'Low adherence' };
  }
  return { tone: 'green', label: 'On track' };
}
