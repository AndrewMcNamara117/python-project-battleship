import { buildEntry } from '@/lib/domain/roster';
import type { RosterEntry, RosterFacts } from '@/lib/domain/roster';
import type { ISODate } from '@/lib/domain/types';

/**
 * One row of `im_coach_roster()`, turned into the facts the classifier reads.
 *
 * Extracted from the Supabase adapter so that the tests which run against a
 * real Postgres go through the same mapping the product does. A roster test
 * that hand-writes its own mapping is testing the test.
 *
 * The date coercion is here for the same reason: a Postgres driver may hand
 * back `Date` objects where PostgREST hands back strings, and the domain
 * works in ISO strings throughout. Normalising once, in the one place that
 * reads the row, keeps that detail out of the classifier.
 */
const day = (v: unknown): ISODate | null =>
  v == null ? null : v instanceof Date ? (v.toISOString().slice(0, 10) as ISODate) : (String(v).slice(0, 10) as ISODate);

const stamp = (v: unknown): string | null =>
  v == null ? null : v instanceof Date ? v.toISOString() : String(v);

export function rosterFactsFromRow(r: Record<string, unknown>): RosterFacts {
  const n = (v: unknown) => Number(v ?? 0);
  return {
    athleteId: r.athlete_id as string,
    fullName: r.full_name as string,
    avatarUrl: (r.avatar_url as string) ?? null,
    joinedAt: stamp(r.joined_at),

    programmeId: (r.programme_id as string) ?? null,
    programmeName: (r.programme_name as string) ?? null,
    programmeEndDate: day(r.programme_end_date),
    blockName: (r.block_name as string) ?? null,
    phase: (r.phase as string) ?? null,
    weekNo: (r.week_no as number) ?? null,
    totalWeeks: (r.total_weeks as number) ?? null,

    plannedThisWeek: n(r.planned_this_week),
    completedThisWeek: n(r.completed_this_week),
    plannedFourWeeks: n(r.planned_four_weeks),
    completedFourWeeks: n(r.completed_four_weeks),

    missedFourteenDays: n(r.missed_fourteen_days),
    missedKeySession: r.missed_key_name
      ? { name: r.missed_key_name as string, date: day(r.missed_key_date)! }
      : null,

    lastCompletedDate: day(r.last_completed_date),
    lastCompletedName: (r.last_completed_name as string) ?? null,
    nextSessionDate: day(r.next_session_date),
    nextSessionName: (r.next_session_name as string) ?? null,
    futureSessions: n(r.future_sessions),

    checkIn: r.checkin_week_start
      ? {
          id: r.checkin_id as string,
          weekStart: day(r.checkin_week_start)!,
          submittedAt: stamp(r.checkin_submitted_at)!,
          attention: r.checkin_attention as 'none' | 'watch' | 'attention',
          reasons: (r.checkin_reasons as string[]) ?? [],
          acknowledgedAt: stamp(r.checkin_acknowledged_at),
          respondedAt: stamp(r.checkin_responded_at),
          fatigue: (r.checkin_fatigue as number) ?? null,
          soreness: (r.checkin_soreness as number) ?? null,
          painOrNiggles: (r.checkin_pain as string) ?? null,
        }
      : null,

    raceId: (r.race_id as string) ?? null,
    raceName: (r.race_name as string) ?? null,
    raceDate: day(r.race_date),
    eventType: (r.goal_event_type as RosterFacts['eventType']) ?? null,

    unreadFromAthlete: n(r.unread_from_athlete),
    recentAdaptations: n(r.recent_adaptations),
  };
}

/** Every row of the roster query, classified. */
export function rosterFromRows(rows: Record<string, unknown>[], today: ISODate): RosterEntry[] {
  return rows.map((r) => buildEntry(rosterFactsFromRow(r), today));
}
