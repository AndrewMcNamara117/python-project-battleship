import { adherence, countsForAdherence, isRun } from '@/lib/domain/analytics';
import { addDays, daysBetween, formatDistance, startOfWeek, WEEKDAY_FULL, weekdayIndex } from '@/lib/domain/dates';
import type {
  CheckIn,
  CompletedWorkout,
  ISODate,
  Profile,
  Race,
  ScheduledWorkout,
} from '@/lib/domain/types';

/**
 * FORGE — the Iron Miles training assistant.
 *
 * Deterministic and rule-based. It reflects the athlete's own logged data back
 * to them and explains what is scheduled; it does not generate advice, and it
 * has no model behind it that could invent any.
 *
 * Hard limits, enforced here rather than trusted to a prompt:
 *   - never names, grades or diagnoses an injury or condition
 *   - never tells anyone to push through pain, or to ignore a symptom
 *   - never mentions medication
 *   - anything that reads as a red-flag symptom short-circuits every other
 *     message and returns a stop-and-seek-care response
 *   - a coach can disable it per athlete, and that switch is checked first
 */

export type ForgeTone = 'brief' | 'standard';

export interface ForgeMessage {
  id: string;
  kind: 'daily' | 'post_session' | 'weekly' | 'race_week' | 'missed' | 'safety' | 'idle';
  body: string;
  /** Safety messages are rendered differently and are never dismissible. */
  severity: 'normal' | 'urgent';
}

export interface ForgeContext {
  profile: Profile;
  today: ISODate;
  week: ScheduledWorkout[];
  todaySessions: ScheduledWorkout[];
  completedThisWeek: CompletedWorkout[];
  lastCheckIn: CheckIn | null;
  race: Race | null;
  daysToRace: number | null;
  goalName: string | null;
}

/** Red-flag language. Matched on the athlete's own most recent free text only. */
const RED_FLAGS =
  /\bchest (pain|tightness)\b|\bdizz(y|iness)\b|\bfaint(ed|ing)?\b|\bblack(ed)? out\b|\bnumb(ness)?\b|\btingl(e|ing)\b|\bsharp pain\b|\bcan'?t (walk|weight ?bear)\b|\bworsening\b/i;

const SAFETY_MESSAGE =
  'Some of what you described is worth having looked at properly. Stop training and speak to a doctor or physiotherapist before your next session. Your coach has been notified. I am not able to assess this, and Iron Miles is not a medical service.';

export function forgeDisabled(profile: Profile): boolean {
  return !profile.forgeAssistantEnabled;
}

/** The single message shown on the dashboard and on Today. */
export function dailyMessage(ctx: ForgeContext): ForgeMessage | null {
  if (forgeDisabled(ctx.profile)) return null;

  // safety overrides everything, every time
  if (ctx.lastCheckIn) {
    const text = [
      ctx.lastCheckIn.painOrNiggles,
      ctx.lastCheckIn.feltDifficult,
      ctx.lastCheckIn.affectingTraining,
      ctx.lastCheckIn.forCoach,
    ].join(' ');
    if (RED_FLAGS.test(text)) {
      return { id: 'forge-safety', kind: 'safety', body: SAFETY_MESSAGE, severity: 'urgent' };
    }
  }

  const weekStart = startOfWeek(ctx.today);
  const dayNumber = weekdayIndex(ctx.today) + 1;
  const prescribed = ctx.week.filter(countsForAdherence);
  const done = prescribed.filter((w) => w.status === 'completed').length;
  const units = ctx.profile.units;

  // race week
  if (ctx.daysToRace != null && ctx.daysToRace >= 0 && ctx.daysToRace <= 7) {
    return {
      id: 'forge-race-week',
      kind: 'race_week',
      body:
        ctx.daysToRace === 0
          ? `${ctx.race?.name ?? 'Race day'}. The work is done. Trust it.`
          : `${ctx.daysToRace} ${ctx.daysToRace === 1 ? 'day' : 'days'} to ${ctx.race?.name ?? 'the start line'}. Nothing you do this week makes you fitter. Sleep, eat, stay off your feet, and arrive fresh.`,
      severity: 'normal',
    };
  }

  const todayRun = ctx.todaySessions.find((s) => s.type !== 'rest');
  const completedToday = ctx.todaySessions.some((s) => s.status === 'completed');

  // after the session
  if (completedToday) {
    const remaining = prescribed.length - done;
    return {
      id: 'forge-post',
      kind: 'post_session',
      body: `Done. That is ${done} of ${prescribed.length} prescribed sessions this week${
        remaining > 0 ? `, ${remaining} to go` : ' — the full week'
      }. ${
        remaining === 0
          ? 'Another week forged.'
          : nextSessionHint(ctx.week, ctx.today) ?? 'Keep tomorrow easy and finish the week strong.'
      }`,
      severity: 'normal',
    };
  }

  // a rest day is a session
  if (ctx.todaySessions.length && ctx.todaySessions.every((s) => s.type === 'rest')) {
    return {
      id: 'forge-rest',
      kind: 'daily',
      body: 'Rest day. This is where the adaptation actually happens — treat it like a session, because it is one.',
      severity: 'normal',
    };
  }

  // missed yesterday
  const yesterday = addDays(ctx.today, -1);
  const missedYesterday = ctx.week.some(
    (w) => w.date === yesterday && w.status === 'missed' && countsForAdherence(w),
  );
  if (missedYesterday && todayRun) {
    return {
      id: 'forge-missed',
      kind: 'missed',
      body: `One session does not define the week. Today is ${describeSession(todayRun, units)}. Reset and go again.`,
      severity: 'normal',
    };
  }

  // the ordinary case: today's session, explained
  if (todayRun) {
    return {
      id: 'forge-daily',
      kind: 'daily',
      body: `Day ${dayNumber}. ${describeSession(todayRun, units)}. ${sessionIntent(todayRun)}`,
      severity: 'normal',
    };
  }

  // nothing scheduled
  void weekStart;
  return {
    id: 'forge-idle',
    kind: 'idle',
    body: 'Nothing prescribed today. If you feel like moving, keep it easy and short — the plan picks up tomorrow.',
    severity: 'normal',
  };
}

/** The end-of-week summary, shown on the check-in page and sent by the weekly job. */
export function weeklySummary(ctx: ForgeContext): ForgeMessage | null {
  if (forgeDisabled(ctx.profile)) return null;

  const weekStart = startOfWeek(ctx.today);
  const weekEnd = addDays(weekStart, 6);
  const stats = adherence(ctx.week, weekStart, weekEnd, ctx.today);
  const runKm = ctx.completedThisWeek
    .filter((w) => isRun(w.type))
    .reduce((a, w) => a + (w.actualDistanceKm ?? 0), 0);
  const strengthDone = ctx.week.filter((w) => w.type === 'strength' && w.status === 'completed').length;
  const longRun = ctx.week.find((w) => w.type === 'long_run');

  const parts = [
    `${stats.pct}% adherence this week.`,
    longRun ? (longRun.status === 'completed' ? 'Long run completed.' : 'Long run still outstanding.') : null,
    strengthDone > 0 ? `${strengthDone} strength ${strengthDone === 1 ? 'session' : 'sessions'} done.` : null,
    runKm > 0 ? `${formatDistance(Math.round(runKm * 10) / 10, ctx.profile.units)} on the legs.` : null,
    ctx.lastCheckIn ? fatigueNote(ctx.lastCheckIn) : null,
    stats.pct >= 90 ? 'Strong work.' : stats.pct >= 70 ? 'Solid week.' : 'Reset and go again.',
  ].filter(Boolean);

  return { id: 'forge-weekly', kind: 'weekly', body: parts.join(' '), severity: 'normal' };
}

/** Explains one scheduled session — used by the "why this session?" control. */
export function explainSession(workout: ScheduledWorkout): string {
  return `${sessionIntent(workout)}${
    workout.paceRange
      ? ' Hold the prescribed range even if the legs feel good — the range is the session.'
      : ''
  }`;
}

/* ---------- helpers ---------- */

function describeSession(w: ScheduledWorkout, units: Profile['units']): string {
  // Only add a detail the name does not already carry. "Strength — Foundation A"
  // does not need the word "strength" appended to it.
  if (w.distanceKm != null) return `${w.name} — ${formatDistance(w.distanceKm, units)}`;
  if (w.durationMinutes != null && w.type !== 'rest') return `${w.name} — ${w.durationMinutes} min`;
  return w.name;
}

const INTENT: Partial<Record<ScheduledWorkout['type'], string>> = {
  easy_run: 'Keep it genuinely easy. The point is aerobic volume without cost.',
  recovery_run: 'Slower than feels right. This one is for blood flow, not fitness.',
  long_run: 'Fuel early. Start controlled. Finish stronger than you started.',
  progression_run: 'Three thirds: easy, steady, then race effort. Negative split or it does not count.',
  tempo: 'Comfortably hard — an effort you could hold for an hour on race day.',
  threshold: 'Controlled discomfort. The last rep should look like the first.',
  intervals: 'Hard, but repeatable. Even splits beat a fast opener.',
  hills: 'Strength in disguise. Tall posture, quick feet, walk the recoveries if you need to.',
  race_pace: 'A rehearsal, not a test. Get familiar with the effort, then stop.',
  brick: 'The first ten minutes off the bike always feel wrong. Run through it.',
  strength: 'Leave two reps in reserve on every set. This is not the day to find a maximum.',
  mobility: 'Slow and unhurried. Nothing here should be uncomfortable.',
  rest: 'Complete rest. Adaptation happens here.',
  race: 'Execute the plan. Nothing new on race day.',
};

function sessionIntent(w: ScheduledWorkout): string {
  return INTENT[w.type] ?? 'Run it as written.';
}

function nextSessionHint(week: ScheduledWorkout[], today: ISODate): string | null {
  const next = week
    .filter((w) => w.date > today && w.status === 'scheduled' && countsForAdherence(w))
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (!next) return null;
  const days = daysBetween(today, next.date);
  const when = days === 1 ? 'Tomorrow' : WEEKDAY_FULL[weekdayIndex(next.date)];
  return `${when}: ${next.name}.`;
}

function fatigueNote(checkIn: CheckIn): string {
  const f = checkIn.scores.fatigue;
  if (f >= 8) return 'Fatigue is running high — worth flagging to your coach.';
  if (f >= 6) return 'Fatigue is moderate.';
  return 'Fatigue is low.';
}
