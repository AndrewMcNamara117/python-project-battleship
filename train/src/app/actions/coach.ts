'use server';

import { revalidatePath } from 'next/cache';
import { requireCoach, requireCoachOf } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { messageSchema } from '@/lib/validation/schemas';
import type { ExperienceLevel, ScheduledWorkout, TrainingPhase } from '@/lib/domain/types';
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
  const { session, authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

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
  const { session, authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  const text = response.trim();
  if (text.length < 2) return { ok: false, message: 'Write a response first.' };

  const repo = await getRepo();
  await repo.respondToCheckIn(checkInId, session.userId, text.slice(0, 4000));

  revalidatePath(`/coach/athletes/${athleteId}`);
  revalidatePath('/coach/checkins');
  return { ok: true, message: 'Response sent.' };
}

/**
 * A coach states they have read one check-in.
 *
 * The same operation the batch loops, so a single click and a batch of
 * twenty-five cannot diverge. Never called by rendering a page.
 */
export async function acknowledgeCheckIn(
  checkInId: string,
  athleteId: string,
): Promise<Result> {
  const { session, authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  const repo = await getRepo();
  try {
    const changed = await repo.acknowledgeCheckIn(checkInId, session.userId);
    revalidatePath('/coach');
    revalidatePath('/coach/checkins');
    revalidatePath(`/coach/athletes/${athleteId}`);
    revalidatePath('/app/check-in');
    return {
      ok: true,
      message: changed ? 'Marked read.' : 'Already read.',
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'That could not be marked read.',
    };
  }
}

export async function messageAthlete(athleteId: string, formData: FormData): Promise<Result> {
  const { session, authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

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
  const { authorised } = await requireCoachOf(workout.athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  const repo = await getRepo();
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
  const { authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  const repo = await getRepo();
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
  const { authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

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
/**
 * Assign a programme frame to an athlete.
 *
 * Every session is inserted from a library template, so each one carries a
 * record of where it came from and arrives with its structure already broken
 * into components. The copy is independent from the moment it lands: editing
 * the template afterwards cannot reach the athlete's prescribed training.
 */
export async function assignProgramTemplate(
  athleteId: string,
  templateId: string,
  startDateInput: string,
): Promise<Result> {
  const { session, authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  const repo = await getRepo();

  const template = await repo.getProgramTemplate(templateId);
  if (!template) return { ok: false, message: 'That programme template is no longer available.' };

  const [workouts, strengthTemplates] = await Promise.all([
    repo.listWorkoutTemplates(),
    repo.listStrengthTemplates(),
  ]);
  const byCategory = (category: string) => workouts.find((w) => w.category === category);

  const easy = byCategory('easy');
  const threshold = byCategory('threshold');
  const recovery = byCategory('recovery');
  const long = byCategory('long_run');
  if (!easy || !threshold || !recovery || !long) {
    return { ok: false, message: 'The workout library is incomplete — a programme cannot be built from it.' };
  }

  // Mon–Sun frame. A coach edits from here; nothing about it is prescriptive.
  const frame: ({ kind: 'workout' | 'strength'; id: string } | null)[] = [
    { kind: 'workout', id: easy.id },
    strengthTemplates[0] ? { kind: 'strength', id: strengthTemplates[0].id } : null,
    { kind: 'workout', id: threshold.id },
    { kind: 'workout', id: recovery.id },
    strengthTemplates[1] ? { kind: 'strength', id: strengthTemplates[1].id } : null,
    { kind: 'workout', id: easy.id },
    { kind: 'workout', id: long.id },
  ];

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

  // Blocks and weeks are rows, not something inferred from dates — the
  // structure has to exist before sessions can land in it.
  const block = await repo.createBlock({
    programId: program.id,
    athleteId,
    blockIndex: 0,
    name: template.name,
    phase: 'base',
    focus: null,
    notes: null,
  });

  for (let week = 0; week < template.weeks; week++) {
    await repo.createWeek({
      blockId: block.id,
      programId: program.id,
      athleteId,
      weekIndex: week,
      programWeekNo: week + 1,
      startDate: addDays(startDate, week * 7),
      targetVolumeKm: null,
      focus: null,
      notes: null,
      // every fourth week steps back — a coaching decision, stated as one
      isRecoveryWeek: week > 0 && (week + 1) % 4 === 0,
    });
  }

  for (let week = 0; week < template.weeks; week++) {
    for (let day = 0; day < 7; day++) {
      const slot = frame[day];
      if (!slot) continue;
      await repo.insertTemplateIntoProgramme(
        slot.kind,
        slot.id,
        athleteId,
        addDays(startDate, week * 7 + day),
      );
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

/**
 * Copy one week's prescription forward.
 *
 * Set-based and executed in the database — a week of eight sessions and their
 * components is one call, not thirty. That is what keeps a roster of fifty
 * athletes from becoming administrative work.
 */
export async function duplicateWeek(
  athleteId: string,
  sourceWeekId: string,
  targetWeekStart: string,
): Promise<Result> {
  const { authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  const repo = await getRepo();
  try {
    await repo.duplicateWeek(sourceWeekId, targetWeekStart);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not copy that week.' };
  }

  revalidatePath(`/coach/athletes/${athleteId}`);
  revalidatePath('/app');
  revalidatePath('/app/calendar');
  return { ok: true, message: `Week copied to ${targetWeekStart}.` };
}

/** Copy an entire block — every week, session and component in one call. */
export async function duplicateBlock(
  athleteId: string,
  sourceBlockId: string,
  targetStart: string,
  name?: string,
): Promise<Result> {
  const { authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  const repo = await getRepo();
  try {
    await repo.duplicateBlock(sourceBlockId, targetStart, name);
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Could not copy that block.' };
  }

  revalidatePath(`/coach/athletes/${athleteId}`);
  revalidatePath('/app');
  revalidatePath('/app/training');
  return { ok: true, message: `Block copied, starting ${targetStart}.` };
}

/**
 * Hand an existing programme's whole structure to another athlete.
 *
 * The lever that makes a large roster tractable: write a block once, give it to
 * everyone it suits, then edit per athlete. Both athletes must be on the
 * calling coach's roster.
 */
export async function assignProgramToAthlete(
  sourceProgramId: string,
  targetAthleteId: string,
  startDate: string,
  name?: string,
): Promise<Result> {
  const { authorised } = await requireCoachOf(targetAthleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  const repo = await getRepo();
  try {
    await repo.assignProgramToAthlete(sourceProgramId, targetAthleteId, startDate, name);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : 'Could not assign that programme.',
    };
  }

  revalidatePath(`/coach/athletes/${targetAthleteId}`);
  revalidatePath('/coach/athletes');
  revalidatePath('/app');
  return { ok: true, message: 'Programme assigned.' };
}


/**
 * Set an athlete's coaching context.
 *
 * The coach owns experience level and training phase; the athlete owns their
 * own availability and what they report about their body. That split is
 * deliberate — a coach reclassifying an athlete is a coaching decision, a coach
 * editing what the athlete said about their calf is not.
 */
export async function setAthleteCoachingContext(
  athleteId: string,
  patch: { experienceLevel?: ExperienceLevel | null; trainingPhase?: TrainingPhase | null },
): Promise<Result> {
  const { authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  const repo = await getRepo();
  await repo.updateProfile(athleteId, patch);

  revalidatePath(`/coach/athletes/${athleteId}`);
  revalidatePath('/coach/athletes');
  revalidatePath('/app');
  return { ok: true, message: 'Updated.' };
}
