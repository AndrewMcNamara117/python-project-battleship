'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { checkInSchema, logWorkoutSchema, messageSchema } from '@/lib/validation/schemas';
import { triageCheckIn } from '@/lib/domain/checkin-rules';
import { countsForAdherence } from '@/lib/domain/analytics';
import { addDays, startOfWeek, toISODate } from '@/lib/domain/dates';
import type { StrengthSetLog } from '@/lib/domain/types';

export interface Result {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
}

function fieldErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const k = String(i.path[0] ?? 'form');
    if (!out[k]) out[k] = i.message;
  }
  return out;
}

/** Log a completed session. Pace is derived on write so charts never recompute it. */
export async function logWorkout(formData: FormData): Promise<Result> {
  const session = await requireSession();
  const repo = await getRepo();

  const raw = Object.fromEntries(formData.entries());
  const cleaned = Object.fromEntries(
    Object.entries(raw).map(([k, v]) => [k, v === '' ? null : v]),
  );
  const parsed = logWorkoutSchema.safeParse(cleaned);
  if (!parsed.success) {
    return { ok: false, message: 'Check the numbers.', fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const scheduled = await repo.getScheduled(parsed.data.scheduledWorkoutId);
  if (!scheduled || scheduled.athleteId !== session.userId) {
    return { ok: false, message: 'That session is not on your plan.' };
  }

  const distance = parsed.data.actualDistanceKm ?? null;
  const duration = parsed.data.actualDurationMinutes ?? null;
  const pace = distance && duration && distance > 0 ? Math.round((duration * 60) / distance) : null;

  await repo.logWorkout({
    scheduledWorkoutId: scheduled.id,
    athleteId: session.userId,
    date: scheduled.date,
    type: scheduled.type,
    actualDistanceKm: distance,
    actualDurationMinutes: duration,
    averagePaceSecPerKm: pace,
    averageHeartRate: parsed.data.averageHeartRate ?? null,
    maxHeartRate: parsed.data.maxHeartRate ?? null,
    rpe: parsed.data.rpe ?? null,
    sessionRating: parsed.data.sessionRating ?? null,
    soreness: parsed.data.soreness ?? null,
    athleteNotes: parsed.data.athleteNotes ?? null,
    source: 'manual',
  });

  await awardWeeklyBonuses(session.userId, scheduled.date);

  revalidatePath('/app');
  revalidatePath('/app/today');
  revalidatePath('/app/calendar');
  revalidatePath('/app/progress');
  return { ok: true, message: 'Logged.' };
}

/** Mark a session as deliberately skipped, without pretending it happened. */
export async function markSessionStatus(
  scheduledWorkoutId: string,
  status: 'missed' | 'skipped' | 'scheduled',
): Promise<Result> {
  const session = await requireSession();
  const repo = await getRepo();
  const scheduled = await repo.getScheduled(scheduledWorkoutId);
  if (!scheduled || scheduled.athleteId !== session.userId) {
    return { ok: false, message: 'That session is not on your plan.' };
  }
  await repo.saveScheduled({ ...scheduled, status });
  revalidatePath('/app');
  revalidatePath('/app/today');
  revalidatePath('/app/calendar');
  return { ok: true, message: 'Updated.' };
}

/** Athletes may move their own sessions within the week; the coach owns the shape of it. */
export async function rescheduleSession(scheduledWorkoutId: string, toDate: string): Promise<Result> {
  const session = await requireSession();
  const repo = await getRepo();
  const scheduled = await repo.getScheduled(scheduledWorkoutId);
  if (!scheduled || scheduled.athleteId !== session.userId) {
    return { ok: false, message: 'That session is not on your plan.' };
  }
  if (scheduled.status === 'completed') {
    return { ok: false, message: 'Completed sessions stay where they happened.' };
  }

  // Move rules. The coach owns the shape of the week; an athlete may shuffle
  // within it, not redesign it. Without these an athlete could drag a session
  // months out and silently erase it from their block.
  const today = toISODate(new Date());
  if (toDate < today) {
    return { ok: false, message: 'You cannot move a session into the past.' };
  }
  if (startOfWeek(toDate) !== startOfWeek(scheduled.date)) {
    return {
      ok: false,
      message: 'Sessions move within their own week. Ask your coach to change the week itself.',
    };
  }

  const existing = await repo.listScheduled(session.userId, toDate, toDate);
  if (existing.some((w) => w.status === 'completed')) {
    return { ok: false, message: 'That day already has a completed session on it.' };
  }

  await repo.moveScheduled(scheduledWorkoutId, toDate);
  revalidatePath('/app/calendar');
  return { ok: true, message: 'Moved.' };
}

export async function saveStrengthProgress(
  scheduledWorkoutId: string | null,
  templateId: string,
  date: string,
  logs: StrengthSetLog[],
  complete: boolean,
  durationMinutes: number | null,
  notes: string | null,
): Promise<Result> {
  const session = await requireSession();
  const repo = await getRepo();

  // never trust a workout id from the client: without this an athlete could
  // complete somebody else's prescribed session by passing its id
  if (scheduledWorkoutId) {
    const scheduled = await repo.getScheduled(scheduledWorkoutId);
    if (!scheduled || scheduled.athleteId !== session.userId) {
      return { ok: false, message: 'That session is not on your plan.' };
    }
  }

  await repo.saveStrengthSession({
    id: `ss-${session.userId}-${date}`,
    athleteId: session.userId,
    scheduledWorkoutId,
    templateId,
    date,
    status: complete ? 'completed' : 'scheduled',
    logs,
    durationMinutes,
    notes,
    completedAt: complete ? new Date().toISOString() : null,
  });

  if (complete) await awardWeeklyBonuses(session.userId, date);

  revalidatePath('/app');
  revalidatePath('/app/strength');
  revalidatePath('/app/today');
  return { ok: true, message: complete ? 'Session complete.' : 'Progress saved.' };
}

/** Weekly check-in. Triage runs server-side so the flag cannot be spoofed by a client. */
export async function submitCheckIn(formData: FormData): Promise<Result> {
  const session = await requireSession();
  const repo = await getRepo();

  const parsed = checkInSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, message: 'Some answers need another look.', fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const d = parsed.data;
  const scores = {
    fatigue: d.fatigue,
    sleep: d.sleep,
    soreness: d.soreness,
    stress: d.stress,
    motivation: d.motivation,
    confidence: d.confidence,
    trainingDifficulty: d.trainingDifficulty,
  };

  const weekEnd = addDays(d.weekStart, 6);
  const [weekSessions, history] = await Promise.all([
    repo.listScheduled(session.userId, d.weekStart, weekEnd),
    repo.listCheckIns(session.userId, 4),
  ]);

  const prescribed = weekSessions.filter(countsForAdherence);
  const triage = triageCheckIn({
    scores,
    freeText: [d.wentWell, d.feltDifficult, d.painOrNiggles, d.affectingTraining, d.confidenceNextWeek, d.forCoach],
    sessionsCompleted: prescribed.filter((w) => w.status === 'completed').length,
    sessionsPrescribed: prescribed.length,
    history: history.map((c) => ({ scores: c.scores })),
  });

  await repo.submitCheckIn({
    athleteId: session.userId,
    weekStart: d.weekStart,
    scores,
    wentWell: d.wentWell,
    feltDifficult: d.feltDifficult,
    painOrNiggles: d.painOrNiggles,
    affectingTraining: d.affectingTraining,
    confidenceNextWeek: d.confidenceNextWeek,
    forCoach: d.forCoach,
    attentionLevel: triage.level,
    attentionReasons: triage.reasons,
    reviewedByCoachAt: null,
    acknowledgedAt: null,
    acknowledgedBy: null,
    respondedAt: null,
    coachResponse: null,
  });

  revalidatePath('/app/check-in');
  revalidatePath('/app');

  return {
    ok: true,
    message:
      triage.athleteGuidance ??
      'Check-in submitted. Your coach reads every one before writing next week.',
  };
}

export async function sendCoachMessage(formData: FormData): Promise<Result> {
  const session = await requireSession();
  const repo = await getRepo();

  const parsed = messageSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, message: 'Write something first.', fieldErrors: fieldErrors(parsed.error.issues) };
  }

  const coach = await repo.getCoachForAthlete(session.userId);
  if (!coach) return { ok: false, message: 'You are not linked to a coach yet.' };

  await repo.sendMessage({
    threadId: `thread-${session.userId}`,
    senderId: session.userId,
    recipientId: coach.id,
    body: parsed.data.body,
    authorKind: 'human',
  });

  revalidatePath('/app/coach');
  return { ok: true, message: 'Sent.' };
}

export async function toggleEventAttendance(eventId: string, going: boolean): Promise<Result> {
  const session = await requireSession();
  const repo = await getRepo();
  await repo.setEventAttendance(eventId, session.userId, going);
  revalidatePath('/app/community');
  return { ok: true, message: going ? 'You are in.' : 'Removed.' };
}

/**
 * Week-level Forge awards. Kept server-side and idempotent — the ledger's
 * unique index on (athlete, kind, source) means re-running this is harmless.
 */
async function awardWeeklyBonuses(athleteId: string, date: string) {
  const repo = await getRepo();
  const weekStart = startOfWeek(date);
  const weekEnd = addDays(weekStart, 6);
  const today = toISODate(new Date());

  const week = await repo.listScheduled(athleteId, weekStart, weekEnd);
  const prescribed = week.filter(countsForAdherence);
  if (!prescribed.length) return;

  const allDone = prescribed.every((w) => w.status === 'completed');
  const weekIsOver = weekEnd < today;

  if (allDone && weekIsOver) {
    await repo.awardForgePoints({
      athleteId,
      kind: 'full_week_adherence',
      points: 20,
      date: weekEnd,
      label: '100% weekly adherence',
      sourceId: `week-${weekStart}`,
    });
  }
}
