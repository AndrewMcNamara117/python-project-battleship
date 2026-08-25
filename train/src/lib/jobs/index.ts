import 'server-only';
import { getRepo } from '@/lib/data';
import { hasSupabase } from '@/lib/env';
import { createAdminSupabase } from '@/lib/supabase/server';
import { countsForAdherence } from '@/lib/domain/analytics';
import { addDays, daysBetween, endOfWeek, startOfWeek, toISODate } from '@/lib/domain/dates';
import { dailyMessage, weeklySummary } from '@/lib/forge/assistant';

/**
 * Scheduled jobs.
 *
 * Each returns a report of what it would send and what it actually sent, so a
 * run is auditable. Without a database attached the jobs still compute their
 * output and report it as a dry run — that way the logic is testable before
 * any athlete's phone is involved.
 */

export interface JobReport {
  job: string;
  ranAt: string;
  dryRun: boolean;
  processed: number;
  notifications: { userId: string; kind: string; title: string; body: string; href: string | null }[];
}

export const JOB_NAMES = [
  'morning-reminder',
  'session-incomplete',
  'checkin-request',
  'weekly-summary',
  'race-countdown',
  'coach-alerts',
] as const;

export type JobName = (typeof JOB_NAMES)[number];

export function isJobName(value: string): value is JobName {
  return (JOB_NAMES as readonly string[]).includes(value);
}

async function deliver(report: JobReport): Promise<JobReport> {
  if (!hasSupabase || !report.notifications.length) return report;

  const db = createAdminSupabase();
  await db.from('notifications').insert(
    report.notifications.map((n) => ({
      user_id: n.userId,
      kind: n.kind,
      title: n.title,
      body: n.body,
      href: n.href,
    })),
  );
  return { ...report, dryRun: false };
}

/** Every athlete this deployment can see. Under Supabase this is the admin view. */
async function allAthletes() {
  if (hasSupabase) {
    const db = createAdminSupabase();
    const { data } = await db.from('profiles').select('id').eq('role', 'athlete');
    return (data ?? []).map((r: { id: string }) => r.id);
  }
  const repo = await getRepo();
  const roster = await repo.listAthletesForCoach('demo-coach');
  return roster.map((p) => p.id);
}

export async function runJob(job: JobName): Promise<JobReport> {
  const repo = await getRepo();
  const today = toISODate(new Date());
  const weekStart = startOfWeek(today);
  const weekEnd = endOfWeek(today);
  const athleteIds = await allAthletes();

  const report: JobReport = {
    job,
    ranAt: new Date().toISOString(),
    dryRun: !hasSupabase,
    processed: athleteIds.length,
    notifications: [],
  };

  for (const athleteId of athleteIds) {
    const profile = await repo.getProfile(athleteId);
    if (!profile) continue;

    const week = await repo.listScheduled(athleteId, weekStart, weekEnd);
    const todaySessions = week.filter((w) => w.date === today);

    switch (job) {
      case 'morning-reminder': {
        if (!profile.forgeAssistantEnabled) break;
        if (!todaySessions.length) break;

        const completed = await repo.listCompleted(athleteId, weekStart, weekEnd);
        const checkins = await repo.listCheckIns(athleteId, 1);
        const goal = await repo.getPrimaryGoal(athleteId);
        const race = goal?.raceId ? await repo.getRace(goal.raceId) : null;

        const message = dailyMessage({
          profile,
          today,
          week,
          todaySessions,
          completedThisWeek: completed,
          lastCheckIn: checkins[0] ?? null,
          race,
          daysToRace: race ? daysBetween(today, race.date) : null,
          goalName: race?.name ?? null,
        });
        if (!message) break;

        report.notifications.push({
          userId: athleteId,
          kind: 'morning_reminder',
          title: todaySessions[0].name,
          body: message.body,
          href: '/app/today',
        });
        break;
      }

      case 'session-incomplete': {
        // run in the evening: anything prescribed today and still untouched
        const outstanding = todaySessions.filter(
          (w) => w.status === 'scheduled' && countsForAdherence(w),
        );
        if (!outstanding.length) break;

        report.notifications.push({
          userId: athleteId,
          kind: 'session_incomplete',
          title: 'Still to log',
          body: `${outstanding[0].name} is not logged yet. If it happened, twenty seconds finishes it. If it did not, mark it and move on.`,
          href: '/app/today',
        });
        break;
      }

      case 'checkin-request': {
        const existing = await repo.getCheckIn(athleteId, weekStart);
        if (existing) break;

        report.notifications.push({
          userId: athleteId,
          kind: 'checkin_due',
          title: 'Weekly check-in is open',
          body: 'Seven scores and six questions. It is the part your coach cannot see from your logs.',
          href: '/app/check-in',
        });
        break;
      }

      case 'weekly-summary': {
        if (!profile.forgeAssistantEnabled) break;
        const completed = await repo.listCompleted(athleteId, weekStart, weekEnd);
        const checkins = await repo.listCheckIns(athleteId, 1);

        const summary = weeklySummary({
          profile,
          today,
          week,
          todaySessions,
          completedThisWeek: completed,
          lastCheckIn: checkins[0] ?? null,
          race: null,
          daysToRace: null,
          goalName: null,
        });
        if (!summary) break;

        report.notifications.push({
          userId: athleteId,
          kind: 'weekly_summary',
          title: 'Your week',
          body: summary.body,
          href: '/app/progress',
        });
        break;
      }

      case 'race-countdown': {
        const goal = await repo.getPrimaryGoal(athleteId);
        if (!goal) break;
        const race = goal.raceId ? await repo.getRace(goal.raceId) : null;
        const target = race?.date ?? goal.targetDate;
        const days = daysBetween(today, target);

        // milestones only — a countdown that fires daily stops being a milestone
        const MILESTONES = [180, 120, 90, 60, 30, 21, 14, 7, 3, 1, 0];
        if (!MILESTONES.includes(days)) break;

        report.notifications.push({
          userId: athleteId,
          kind: 'race_countdown',
          title: days === 0 ? 'Race day' : `${days} days to go`,
          body:
            days === 0
              ? `${race?.name ?? 'Race day'}. The work is done. Trust it.`
              : days <= 7
                ? 'Race week. Nothing you do now makes you fitter. Sleep, eat, arrive fresh.'
                : `${days} days to ${race?.name ?? 'your goal'}. Keep stacking ordinary weeks.`,
          href: '/app',
        });
        break;
      }

      case 'coach-alerts': {
        const coach = await repo.getCoachForAthlete(athleteId);
        if (!coach) break;

        const recent = await repo.listScheduled(athleteId, addDays(weekStart, -14), today);
        const missed = recent.filter((w) => w.status === 'missed' && countsForAdherence(w)).length;
        const checkins = await repo.listCheckIns(athleteId, 1);
        const flagged = checkins[0]?.attentionLevel === 'attention' && !checkins[0].reviewedByCoachAt;

        if (missed < 3 && !flagged) break;

        report.notifications.push({
          userId: coach.id,
          kind: 'coach_alert',
          title: `${profile.fullName} needs a look`,
          body: flagged
            ? `Check-in flagged: ${checkins[0].attentionReasons.slice(0, 2).join('; ')}.`
            : `${missed} prescribed sessions missed in the last two weeks.`,
          href: `/coach/athletes/${athleteId}`,
        });
        break;
      }
    }
  }

  return deliver(report);
}
