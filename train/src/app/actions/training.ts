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
  // a session on a later day has not happened: the database refuses to mark
  // it completed, and the log would sit under a session still "scheduled"
  if (scheduled.date > addDays(toISODate(new Date()), 1)) {
    return { ok: false, message: 'This session is on a later day — log it once you have done it.' };
  }

  const distance = parsed.data.actualDistanceKm ?? null;
  const duration = parsed.data.actualDurationMinutes ?? null;

  // Adding an RPE to a session a watch file already logged must not erase
  // what the watch measured. The form does not pre-fill heart rate, rating or
  // soreness, so a blank there means "not touched", not "clear it"; and the
  // file's moving pace stands while distance and time are as it recorded them.
  const existing = (await repo.listCompleted(session.userId, scheduled.date, scheduled.date)).find(
    (c) => c.scheduledWorkoutId === scheduled.id,
  );
  const unchangedFromFile =
    existing?.source === 'upload' &&
    existing.actualDistanceKm === distance &&
    existing.actualDurationMinutes === duration;
  const pace = unchangedFromFile
    ? existing.averagePaceSecPerKm
    : distance && duration && distance > 0
      ? Math.round((duration * 60) / distance)
      : null;

  await repo.logWorkout({
    scheduledWorkoutId: scheduled.id,
    athleteId: session.userId,
    date: scheduled.date,
    type: scheduled.type,
    actualDistanceKm: distance,
    actualDurationMinutes: duration,
    averagePaceSecPerKm: pace,
    averageHeartRate: parsed.data.averageHeartRate ?? existing?.averageHeartRate ?? null,
    maxHeartRate: parsed.data.maxHeartRate ?? existing?.maxHeartRate ?? null,
    rpe: parsed.data.rpe ?? null,
    sessionRating: parsed.data.sessionRating ?? existing?.sessionRating ?? null,
    soreness: parsed.data.soreness ?? existing?.soreness ?? null,
    athleteNotes: parsed.data.athleteNotes ?? null,
    // a log the athlete has saved is theirs, even one an import began: so
    // deleting that file later leaves what they typed (removeActivity)
    source: existing && existing.source !== 'upload' ? existing.source : 'manual',
  });

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
  // a stale tab's "did not happen" must not overwrite a session since logged
  if (scheduled.status === 'completed') {
    return { ok: false, message: 'You have logged this session, so it stays completed. Remove the log to change it.' };
  }
  // status only: a full-row write would send back every field the coach set,
  // and the database refuses an athlete's write that touches those
  await repo.setScheduledStatus(scheduled.id, status);
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

  // a day can hold two sessions: this one takes the next free slot there,
  // rather than colliding with the one already on it (which used to throw)
  const taken = new Set(existing.filter((w) => w.id !== scheduledWorkoutId).map((w) => w.slot));
  let slot = scheduled.slot;
  while (taken.has(slot)) slot += 1;
  try {
    await repo.moveScheduled(scheduledWorkoutId, toDate, slot);
  } catch {
    return { ok: false, message: 'That session could not be moved there. Try another day.' };
  }
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
  let scheduledTemplate: string | null = null;
  let tooEarly = false;
  if (scheduledWorkoutId) {
    const scheduled = await repo.getScheduled(scheduledWorkoutId);
    if (!scheduled || scheduled.athleteId !== session.userId) {
      return { ok: false, message: 'That session is not on your plan.' };
    }
    // a session on a later day cannot be completed yet (the database refuses
    // it too); the sets are kept, and it is finished on the day
    tooEarly = complete && scheduled.date > addDays(toISODate(new Date()), 1);
    // the template is the session's, read here: the player sent the session's
    // own id, which is no template, and every save failed in production
    scheduledTemplate = scheduled.strengthTemplateId ?? scheduled.sourceStrengthTemplateId ?? null;
  }
  void templateId;

  await repo.saveStrengthSession({
    id: `ss-${session.userId}-${date}`,
    athleteId: session.userId,
    scheduledWorkoutId,
    templateId: scheduledTemplate,
    date,
    status: complete && !tooEarly ? 'completed' : 'scheduled',
    logs,
    durationMinutes,
    notes,
    completedAt: complete && !tooEarly ? new Date().toISOString() : null,
  });

  revalidatePath('/app');
  revalidatePath('/app/strength');
  revalidatePath('/app/today');
  if (tooEarly) return { ok: false, message: 'This session is on a later day. Your sets are saved — finish it on the day.' };
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

  // the week the date falls in, and one that has begun: the client sends
  // weekStart, and a Tuesday made a second check-in for the same week
  const today = toISODate(new Date());
  const weekStart = startOfWeek(d.weekStart);
  if (weekStart > startOfWeek(today)) {
    return { ok: false, message: 'A check-in is for a week that has begun.' };
  }
  const weekEnd = addDays(weekStart, 6);
  const [weekSessions, history] = await Promise.all([
    repo.listScheduled(session.userId, weekStart, weekEnd),
    repo.listCheckIns(session.userId, 5),
  ]);

  // sessions due so far — a Thursday check-in is not three misses short
  // because Friday to Sunday have not happened yet
  const prescribed = weekSessions.filter((w) => countsForAdherence(w) && w.date <= today);
  const triage = triageCheckIn({
    scores,
    freeText: [d.wentWell, d.feltDifficult, d.painOrNiggles, d.affectingTraining, d.confidenceNextWeek, d.forCoach],
    sessionsCompleted: prescribed.filter((w) => w.status === 'completed').length,
    sessionsPrescribed: prescribed.length,
    // earlier weeks only: resubmitting a week compared it against itself,
    // and a sharp rise from last week vanished
    history: history.filter((c) => c.weekStart < weekStart).slice(0, 4).map((c) => ({ scores: c.scores })),
  });

  await repo.submitCheckIn({
    athleteId: session.userId,
    weekStart,
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
