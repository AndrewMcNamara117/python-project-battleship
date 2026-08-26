'use server';

import { revalidatePath } from 'next/cache';
import { requireCoach, requireCoachOf } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import type { Result } from './coach';
import type { Weekday } from '@/lib/domain/types';

/**
 * The programme template builder.
 *
 * Row-level security is the real boundary; these checks exist so a refusal
 * reads as a sentence rather than a database error, and so a coach is never
 * shown a control that would be refused.
 */

const revalidateTemplates = (id?: string) => {
  revalidatePath('/coach/programs');
  if (id) revalidatePath(`/coach/programs/${id}`);
};

type Guard =
  | { ok: false; message: string }
  | { ok: true; session: Awaited<ReturnType<typeof requireCoach>>;
      repo: Awaited<ReturnType<typeof getRepo>>;
      template: NonNullable<Awaited<ReturnType<Awaited<ReturnType<typeof getRepo>>['getProgramTemplateDetail']>>> };

async function ownedByCaller(id: string): Promise<Guard> {
  const session = await requireCoach();
  const repo = await getRepo();
  const template = await repo.getProgramTemplateDetail(id);
  if (!template) return { ok: false, message: 'That programme is no longer available.' };
  if (template.visibility === 'system') {
    return { ok: false, message: 'Shipped programmes cannot be edited. Duplicate it and edit your copy.' };
  }
  if (template.ownerId !== session.userId) {
    return { ok: false, message: 'That programme belongs to another coach.' };
  }
  return { ok: true, session, repo, template };
}

export async function saveProgrammeTemplate(input: {
  id?: string;
  name: string;
  description: string;
  purpose: string | null;
  coachNotes: string | null;
  discipline: string;
  goalType: string;
  targetDistanceKm: number | null;
  experienceLevel: string | null;
  minDaysPerWeek: number | null;
  maxDaysPerWeek: number | null;
  weeks?: number;
  visibility: 'private' | 'shared';
  tags: string[];
}): Promise<Result & { id?: string }> {
  const session = await requireCoach();
  const name = input.name.trim();
  if (name.length < 2) return { ok: false, message: 'Give the programme a name.' };

  if (input.minDaysPerWeek && input.maxDaysPerWeek && input.minDaysPerWeek > input.maxDaysPerWeek) {
    return { ok: false, message: 'The minimum training days cannot be more than the maximum.' };
  }

  if (input.id) {
    const guard = await ownedByCaller(input.id);
    if (!guard.ok) return guard;
  }

  const repo = await getRepo();
  try {
    const saved = await repo.saveProgramTemplate({
      ...(input.id ? { id: input.id } : {}),
      ...(input.weeks ? { weeks: input.weeks } : {}),
      ownerId: session.userId,
      visibility: input.visibility,
      name,
      description: input.description,
      purpose: input.purpose,
      coachNotes: input.coachNotes,
      discipline: input.discipline as never,
      goalType: input.goalType,
      targetDistanceKm: input.targetDistanceKm,
      experienceLevel: input.experienceLevel,
      minDaysPerWeek: input.minDaysPerWeek,
      maxDaysPerWeek: input.maxDaysPerWeek,
      tags: input.tags,
      archivedAt: null,
    });
    revalidateTemplates(saved.id);
    return { ok: true, message: input.id ? 'Programme updated.' : 'Programme created.', id: saved.id };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

export async function saveBlock(input: {
  id?: string;
  programTemplateId: string;
  blockIndex: number;
  name: string;
  phase: string | null;
  focus: string | null;
  description: string | null;
}): Promise<Result> {
  const guard = await ownedByCaller(input.programTemplateId);
  if (!guard.ok) return guard;

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, message: 'Give the block a name.' };

  try {
    await guard.repo.saveTemplateBlock({
      ...(input.id ? { id: input.id } : {}),
      programTemplateId: input.programTemplateId,
      blockIndex: input.blockIndex,
      name,
      phase: input.phase as never,
      focus: input.focus,
      description: input.description,
    });
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
  revalidateTemplates(input.programTemplateId);
  return { ok: true, message: 'Block saved.' };
}

export async function deleteBlock(programTemplateId: string, blockId: string): Promise<Result> {
  const guard = await ownedByCaller(programTemplateId);
  if (!guard.ok) return guard;
  try {
    await guard.repo.deleteTemplateBlock(blockId);
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
  revalidateTemplates(programTemplateId);
  return { ok: true, message: 'Block removed.' };
}

/** Adds a week to the end of a block, numbered after every week before it. */
export async function addWeek(programTemplateId: string, blockId: string): Promise<Result> {
  const guard = await ownedByCaller(programTemplateId);
  if (!guard.ok) return guard;

  const block = guard.template.blocks.find((b) => b.id === blockId);
  if (!block) return { ok: false, message: 'That block is no longer there.' };

  const allWeeks = guard.template.blocks.flatMap((b) => b.weeks);
  try {
    await guard.repo.saveTemplateWeek({
      programTemplateId,
      blockId,
      weekIndex: block.weeks.length,
      templateWeekNo: allWeeks.length + 1,
      targetVolumeKm: null,
      isRecoveryWeek: false,
      focus: null,
      notes: null,
    });
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
  revalidateTemplates(programTemplateId);
  return { ok: true, message: 'Week added.' };
}

/** The coach's intent for the week, and whether it is a step-back. */
export async function updateWeek(input: {
  programTemplateId: string;
  weekId: string;
  targetVolumeKm: number | null;
  isRecoveryWeek: boolean;
  focus: string | null;
  notes: string | null;
}): Promise<Result> {
  const guard = await ownedByCaller(input.programTemplateId);
  if (!guard.ok) return guard;

  const week = guard.template.blocks.flatMap((b) => b.weeks).find((w) => w.id === input.weekId);
  if (!week) return { ok: false, message: 'That week is no longer there.' };

  try {
    await guard.repo.saveTemplateWeek({
      ...week,
      targetVolumeKm: input.targetVolumeKm,
      isRecoveryWeek: input.isRecoveryWeek,
      focus: input.focus,
      notes: input.notes,
    });
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
  revalidateTemplates(input.programTemplateId);
  return { ok: true, message: 'Week updated.' };
}

export async function deleteWeek(programTemplateId: string, weekId: string): Promise<Result> {
  const guard = await ownedByCaller(programTemplateId);
  if (!guard.ok) return guard;
  try {
    await guard.repo.deleteTemplateWeek(weekId);
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
  revalidateTemplates(programTemplateId);
  return { ok: true, message: 'Week removed.' };
}

/** Put a library session — or an explicit rest day — on a day of the week. */
export async function saveSlot(input: {
  id?: string;
  programTemplateId: string;
  templateWeekId: string;
  weekday: number;
  slot: number;
  kind: 'workout' | 'strength' | 'rest';
  templateId: string | null;
  label: string | null;
  notes: string | null;
  distanceKm: number | null;
  durationMinutes: number | null;
  rpeTarget: number | null;
}): Promise<Result> {
  const guard = await ownedByCaller(input.programTemplateId);
  if (!guard.ok) return guard;

  if (input.kind !== 'rest' && !input.templateId) {
    return { ok: false, message: 'Choose a session from the library first.' };
  }
  if (input.weekday < 1 || input.weekday > 7) {
    return { ok: false, message: 'That is not a day of the week.' };
  }

  try {
    await guard.repo.saveTemplateSlot({
      ...(input.id ? { id: input.id } : {}),
      programTemplateId: input.programTemplateId,
      templateWeekId: input.templateWeekId,
      weekday: input.weekday as Weekday,
      slot: input.slot,
      workoutTemplateId: input.kind === 'workout' ? input.templateId : null,
      strengthTemplateId: input.kind === 'strength' ? input.templateId : null,
      isRest: input.kind === 'rest',
      isOptional: false,
      label: input.label,
      notes: input.notes,
      distanceKm: input.distanceKm,
      durationMinutes: input.durationMinutes,
      rpeTarget: input.rpeTarget,
    });
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
  revalidateTemplates(input.programTemplateId);
  return { ok: true, message: input.kind === 'rest' ? 'Rest day set.' : 'Session added.' };
}

export async function deleteSlot(programTemplateId: string, slotId: string): Promise<Result> {
  const guard = await ownedByCaller(programTemplateId);
  if (!guard.ok) return guard;
  try {
    await guard.repo.deleteTemplateSlot(slotId);
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
  revalidateTemplates(programTemplateId);
  return { ok: true, message: 'Removed.' };
}

export async function duplicateProgrammeTemplate(id: string, name?: string): Promise<Result & { id?: string }> {
  await requireCoach();
  const repo = await getRepo();
  try {
    const copy = await repo.duplicateProgramTemplate(id, name?.trim() || undefined);
    revalidateTemplates();
    return { ok: true, message: 'Copied. Edit it freely — the original is untouched.', id: copy };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

export async function setProgrammeArchived(id: string, archived: boolean): Promise<Result> {
  const guard = await ownedByCaller(id);
  if (!guard.ok) return guard;
  try {
    await guard.repo.saveProgramTemplate({
      ...guard.template,
      archivedAt: archived ? new Date().toISOString() : null,
    });
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
  revalidateTemplates(id);
  return { ok: true, message: archived ? 'Archived. Nothing already assigned changes.' : 'Restored.' };
}

/**
 * Assign the programme.
 *
 * The database re-checks every blocker before it copies anything, so this
 * cannot assign something the review said it could not.
 */
export async function assignProgramme(
  templateId: string,
  athleteId: string,
  startDate: string,
  name?: string,
): Promise<Result & { programId?: string }> {
  const { authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  const repo = await getRepo();
  try {
    const programId = await repo.assignProgramTemplate(templateId, athleteId, startDate, { name });
    revalidatePath(`/coach/athletes/${athleteId}`);
    revalidatePath('/coach/programs');
    revalidatePath('/app');
    revalidatePath('/app/calendar');
    revalidatePath('/app/training');
    return { ok: true, message: 'Assigned. The athlete sees it now.', programId };
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
}

/** Database refusals are written to be read; anything else gets a plain sentence. */
function messageFor(error: unknown): string {
  const raw = error instanceof Error ? error.message : '';
  if (/Monday|roster|archived|still holds|cannot be edited|no weeks|no sessions|available to you|structurally/i.test(raw)) {
    return raw;
  }
  return 'That did not save. Try again.';
}
