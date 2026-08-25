'use server';

import { revalidatePath } from 'next/cache';
import { requireCoach } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { messageSchema } from '@/lib/validation/schemas';
import type { ScheduledWorkout } from '@/lib/domain/types';
import { PROGRAM_TEMPLATES, WORKOUT_TEMPLATES } from '@/data/workout-library';
import { STRENGTH_TEMPLATES } from '@/data/strength-library';
import { addDays, startOfWeek, toISODate } from '@/lib/domain/dates';

export interface Result {
  ok: boolean;
  message: string;
}

/** Coach note. Private by default — an athlete never sees a private note. */
export async function addCoachNote(
  athleteId: string,
  body: string,
  visibility: 'private' | 'shared',
): Promise<Result> {
  const session = await requireCoach();
  const text = body.trim();
  if (text.length < 2) return { ok: false, message: 'Write something first.' };

  const repo = await getRepo();
  await repo.addCoachNote({ athleteId, coachId: session.userId, body: text.slice(0, 4000), visibility });

  revalidatePath(`/coach/athletes/${athleteId}`);
  return { ok: true, message: 'Note saved.' };
}

export async function respondToCheckIn(
  checkInId: string,
  athleteId: string,
  response: string,
): Promise<Result> {
  const session = await requireCoach();
  const text = response.trim();
  if (text.length < 2) return { ok: false, message: 'Write a response first.' };

  const repo = await getRepo();
  await repo.respondToCheckIn(checkInId, session.userId, text.slice(0, 4000));

  revalidatePath(`/coach/athletes/${athleteId}`);
  revalidatePath('/coach/checkins');
  return { ok: true, message: 'Response sent.' };
}

export async function messageAthlete(athleteId: string, formData: FormData): Promise<Result> {
  const session = await requireCoach();
  const parsed = messageSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { ok: false, message: 'Write something first.' };

  const repo = await getRepo();
  await repo.sendMessage({
    threadId: `thread-${athleteId}`,
    senderId: session.userId,
    recipientId: athleteId,
    body: parsed.data.body,
    authorKind: 'human',
  });

  revalidatePath('/coach/messages');
  revalidatePath(`/coach/athletes/${athleteId}`);
  return { ok: true, message: 'Sent.' };
}

/** Coach edits to a prescribed session. The athlete cannot reach this path. */
export async function updateScheduledWorkout(workout: ScheduledWorkout): Promise<Result> {
  const session = await requireCoach();
  const repo = await getRepo();

  // a coach may only edit sessions for an athlete they actually coach
  const roster = await repo.listAthletesForCoach(session.userId);
  if (!roster.some((a) => a.id === workout.athleteId)) {
    return { ok: false, message: 'That athlete is not on your roster.' };
  }

  const existing = await repo.getScheduled(workout.id);
  if (existing && existing.athleteId !== workout.athleteId) {
    return { ok: false, message: 'That session belongs to a different athlete.' };
  }

  await repo.saveScheduled(workout);

  revalidatePath(`/coach/athletes/${workout.athleteId}`);
  // the athlete's own views, so the edit is visible without waiting for a cache miss
  revalidatePath('/app');
  revalidatePath('/app/today');
  revalidatePath('/app/calendar');
  revalidatePath('/app/training');
  return { ok: true, message: 'Session updated. The athlete sees it now.' };
}

/** Remove a prescribed session from an athlete's plan. */
export async function deleteScheduledWorkout(
  workoutId: string,
  athleteId: string,
): Promise<Result> {
  const session = await requireCoach();
  const repo = await getRepo();

  const roster = await repo.listAthletesForCoach(session.userId);
  if (!roster.some((a) => a.id === athleteId)) {
    return { ok: false, message: 'That athlete is not on your roster.' };
  }

  const existing = await repo.getScheduled(workoutId);
  if (!existing || existing.athleteId !== athleteId) {
    return { ok: false, message: 'Session not found.' };
  }
  if (existing.status === 'completed') {
    return { ok: false, message: 'A completed session is a record of what happened — it stays.' };
  }

  await repo.deleteScheduled(workoutId);
  revalidatePath(`/coach/athletes/${athleteId}`);
  revalidatePath('/app');
  revalidatePath('/app/today');
  revalidatePath('/app/calendar');
  return { ok: true, message: 'Session removed.' };
}

/* ------------------------------------------------------------------
   Intake — deciding who gets coached
   ------------------------------------------------------------------ */

export async function decideApplication(
  applicationId: string,
  decision: 'accepted' | 'declined' | 'reviewing',
  note: string | null,
): Promise<Result> {
  const session = await requireCoach();
  const repo = await getRepo();

  const outcome = await repo.decideApplication(applicationId, session.userId, decision, note);

  revalidatePath('/coach/applications');
  revalidatePath('/coach');
  revalidatePath('/coach/athletes');

  if (decision === 'declined') return { ok: true, message: 'Declined.' };
  if (decision === 'reviewing') return { ok: true, message: 'Marked as reviewing.' };

  return {
    ok: true,
    message: outcome.awaitingSignUp
      ? `Accepted. ${outcome.application.fullName} is linked to you automatically when they register with ${outcome.application.email}.`
      : `Accepted. ${outcome.application.fullName} is on your roster and can start onboarding.`,
  };
}

/**
 * Toggle FORGE for one athlete. The coach's override — an athlete who is
 * finding the automated messages unhelpful should not have to argue with them.
 */
export async function setForgeEnabled(athleteId: string, enabled: boolean): Promise<Result> {
  await requireCoach();
  const repo = await getRepo();
  await repo.updateProfile(athleteId, { forgeAssistantEnabled: enabled });
  revalidatePath(`/coach/athletes/${athleteId}`);
  return { ok: true, message: enabled ? 'FORGE enabled.' : 'FORGE disabled for this athlete.' };
}

/* ------------------------------------------------------------------
   Programme building
   ------------------------------------------------------------------ */


/**
 * Assign a programme template to an athlete.
 *
 * The template is a starting frame, not a link: every session is copied into
 * the athlete's own schedule so the coach can edit one athlete's week without
 * touching anyone else's.
 */
export async function assignProgramTemplate(
  athleteId: string,
  templateId: string,
  startDateInput: string,
): Promise<Result> {
  const session = await requireCoach();
  const repo = await getRepo();

  const template = PROGRAM_TEMPLATES.find((t) => t.id === templateId);
  if (!template) return { ok: false, message: 'Unknown template.' };

  const startDate = startOfWeek(startDateInput || toISODate(new Date()));
  const endDate = addDays(startDate, template.weeks * 7 - 1);

  // the programme row is what the athlete's Endurance page resolves; without it
  // an assigned block renders as "no active programme"
  const goal = await repo.getPrimaryGoal(athleteId);
  const program = await repo.createProgram({
    athleteId,
    coachId: session.userId,
    templateId: template.id,
    goalId: goal?.id ?? null,
    name: template.name,
    startDate,
    endDate,
    status: 'active',
  });
  const easy = WORKOUT_TEMPLATES.find((w) => w.id === 'wt-easy')!;
  const long = WORKOUT_TEMPLATES.find((w) => w.id === 'wt-long')!;
  const threshold = WORKOUT_TEMPLATES.find((w) => w.id === 'wt-threshold')!;
  const recovery = WORKOUT_TEMPLATES.find((w) => w.id === 'wt-recovery')!;
  const rest = WORKOUT_TEMPLATES.find((w) => w.id === 'wt-rest')!;

  // Mon–Sun frame. A coach edits from here; nothing about it is prescriptive.
  const frame = [easy, null, threshold, recovery, null, easy, long];
  const strengthDays = new Set([1, 4]);

  for (let week = 0; week < template.weeks; week++) {
    for (let day = 0; day < 7; day++) {
      const date = addDays(startDate, week * 7 + day);
      const isStrength = strengthDays.has(day);
      const source = frame[day] ?? rest;
      const strengthTemplate = isStrength
        ? STRENGTH_TEMPLATES[day === 1 ? 0 : 1]
        : null;

      await repo.saveScheduled({
        id: `sw-${athleteId}-${date}-0`,
        programId: program.id,
        athleteId,
        date,
        slot: 0,
        status: 'scheduled',
        name: isStrength ? `Strength — ${strengthTemplate?.name ?? 'Session'}` : source.name,
        type: isStrength ? 'strength' : source.type,
        basis: source.basis,
        intensity: isStrength ? 'steady' : source.intensity,
        distanceKm: isStrength ? null : source.distanceKm,
        durationMinutes: isStrength ? (strengthTemplate?.estimatedMinutes ?? 45) : source.durationMinutes,
        paceRange: isStrength ? null : source.paceRange,
        hrZone: isStrength ? null : source.hrZone,
        rpeTarget: source.rpeTarget,
        warmUp: source.warmUp,
        mainSet: isStrength ? (strengthTemplate?.description ?? null) : source.mainSet,
        coolDown: source.coolDown,
        notes: source.notes,
        coachNote: null,
        strengthTemplateId: strengthTemplate?.id ?? null,
        raceId: null,
        createdAt: new Date().toISOString(),
      });
    }
  }

  await repo.addCoachNote({
    athleteId,
    coachId: session.userId,
    body: `Assigned "${template.name}" — ${template.weeks} weeks from ${startDate}.`,
    visibility: 'shared',
  });

  revalidatePath(`/coach/athletes/${athleteId}`);
  revalidatePath('/coach/programs');
  revalidatePath('/app');
  revalidatePath('/app/training');
  revalidatePath('/app/calendar');
  return {
    ok: true,
    message: `${template.name} assigned — ${template.weeks} weeks from ${startDate}. The athlete sees it now.`,
  };
}

/** Copy one week's prescription forward. The bulk edit coaches actually use. */
export async function cloneWeek(
  athleteId: string,
  sourceWeekStart: string,
  targetWeekStart: string,
): Promise<Result> {
  await requireCoach();
  const repo = await getRepo();

  const source = await repo.listScheduled(athleteId, sourceWeekStart, addDays(sourceWeekStart, 6));
  if (!source.length) return { ok: false, message: 'That week has nothing in it to copy.' };

  const offset = Math.round(
    (new Date(`${targetWeekStart}T00:00:00Z`).getTime() - new Date(`${sourceWeekStart}T00:00:00Z`).getTime()) /
      86_400_000,
  );

  for (const w of source) {
    const date = addDays(w.date, offset);
    await repo.saveScheduled({
      ...w,
      id: `sw-${athleteId}-${date}-${w.slot}`,
      date,
      // a copied week is a plan again, whatever happened in the original
      status: 'scheduled',
      createdAt: new Date().toISOString(),
    });
  }

  revalidatePath(`/coach/athletes/${athleteId}`);
  return { ok: true, message: `Copied ${source.length} sessions to the week of ${targetWeekStart}.` };
}
