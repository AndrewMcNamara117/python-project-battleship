'use server';

import { revalidatePath } from 'next/cache';
import { requireCoach, requireCoachOf } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import type { LibraryKind } from '@/lib/data/repo';
import type { Result } from './coach';

/**
 * The libraries a coach owns.
 *
 * Every action re-checks who is asking. Row-level security enforces the same
 * rules in Postgres and is the real boundary — these checks are here so a
 * refusal reads as a sentence rather than a database error.
 */

const LIBRARY_PATHS = ['/coach/workouts', '/coach/strength'];
const revalidateLibraries = () => LIBRARY_PATHS.forEach((p) => revalidatePath(p));

/** Save an endurance session to the library, or update one already there. */
export async function saveWorkoutTemplate(input: {
  id?: string;
  name: string;
  category: string;
  type: string;
  basis: string;
  intensity: string;
  distanceKm: number | null;
  durationMinutes: number | null;
  rpeTarget: number | null;
  hrZone: number | null;
  purpose: string | null;
  warmUp: string | null;
  mainSet: string | null;
  coolDown: string | null;
  coachNotes: string | null;
  visibility: 'private' | 'shared';
  tags: string[];
}): Promise<Result> {
  const session = await requireCoach();

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, message: 'Give the session a name.' };

  const repo = await getRepo();

  if (input.id) {
    const existing = await repo.getWorkoutTemplate(input.id);
    if (!existing) return { ok: false, message: 'That session is no longer in your library.' };
    if (existing.visibility === 'system') {
      return { ok: false, message: 'Shipped sessions cannot be edited. Duplicate it and edit your copy.' };
    }
    if (existing.ownerId !== session.userId) {
      return { ok: false, message: 'That session belongs to another coach.' };
    }
  }

  try {
    await repo.saveWorkoutTemplate({
      id: input.id,
      ownerId: session.userId,
      visibility: input.visibility,
      name,
      category: input.category as never,
      type: input.type as never,
      basis: input.basis as never,
      intensity: input.intensity as never,
      distanceKm: input.distanceKm,
      durationMinutes: input.durationMinutes,
      paceMinSecKm: null,
      paceMaxSecKm: null,
      hrZone: input.hrZone,
      rpeTarget: input.rpeTarget,
      warmUp: input.warmUp,
      mainSet: input.mainSet,
      coolDown: input.coolDown,
      purpose: input.purpose,
      coachNotes: input.coachNotes,
      notes: null,
      tags: input.tags,
      archivedAt: null,
    });
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }

  revalidateLibraries();
  return { ok: true, message: input.id ? 'Session updated.' : 'Saved to your library.' };
}

/** Save a movement to the strength library, or update one already there. */
export async function saveStrengthExercise(input: {
  id?: string;
  name: string;
  category: string;
  movementPattern: string | null;
  description: string | null;
  defaultSets: number | null;
  defaultReps: string | null;
  loadGuidance: string | null;
  defaultRestSeconds: number | null;
  isUnilateral: boolean;
  cues: string[];
  equipment: string[];
  visibility: 'private' | 'shared';
  tags: string[];
}): Promise<Result> {
  const session = await requireCoach();

  const name = input.name.trim();
  if (name.length < 2) return { ok: false, message: 'Give the movement a name.' };

  const repo = await getRepo();

  if (input.id) {
    const existing = await repo.getStrengthExercise(input.id);
    if (!existing) return { ok: false, message: 'That movement is no longer in your library.' };
    if (existing.visibility === 'system') {
      return { ok: false, message: 'Shipped movements cannot be edited. Duplicate it and edit your copy.' };
    }
    if (existing.ownerId !== session.userId) {
      return { ok: false, message: 'That movement belongs to another coach.' };
    }
  }

  try {
    await repo.saveStrengthExercise({
      id: input.id,
      ownerId: session.userId,
      visibility: input.visibility,
      name,
      category: input.category as never,
      movementPattern: input.movementPattern as never,
      description: input.description,
      muscleGroups: [],
      cues: input.cues,
      regressions: [],
      progressions: [],
      equipment: input.equipment,
      videoUrl: null,
      defaultSets: input.defaultSets,
      defaultReps: input.defaultReps,
      loadGuidance: input.loadGuidance,
      defaultTempo: null,
      defaultRestSeconds: input.defaultRestSeconds,
      defaultRpe: null,
      isUnilateral: input.isUnilateral,
      tags: input.tags,
      archivedAt: null,
    });
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }

  revalidateLibraries();
  return { ok: true, message: input.id ? 'Movement updated.' : 'Saved to your library.' };
}

/**
 * Archive or restore.
 *
 * Never a delete: anything already prescribed keeps its reference, and a coach
 * gets the item back if they change their mind.
 */
export async function setLibraryArchived(kind: LibraryKind, id: string, archived: boolean): Promise<Result> {
  await requireCoach();
  const repo = await getRepo();
  try {
    await repo.setLibraryArchived(kind, id, archived);
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
  revalidateLibraries();
  return { ok: true, message: archived ? 'Archived. Nothing already prescribed changes.' : 'Restored.' };
}

/** Copy a shipped or shared item into one the coach owns and can edit. */
export async function duplicateLibraryItem(kind: LibraryKind, id: string, name?: string): Promise<Result> {
  await requireCoach();
  const repo = await getRepo();
  try {
    await repo.duplicateLibraryItem(kind, id, name?.trim() || undefined);
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }
  revalidateLibraries();
  return { ok: true, message: 'Copied to your library. Edit it freely — the original is untouched.' };
}

/**
 * Prescribe a library template to an athlete on a date.
 *
 * The session is a copy. It records which template it came from, and nothing
 * else connects them: editing the template afterwards cannot change training
 * this athlete has already been given.
 */
export async function addTemplateToProgramme(
  kind: 'workout' | 'strength',
  templateId: string,
  athleteId: string,
  date: string,
): Promise<Result> {
  const { authorised } = await requireCoachOf(athleteId);
  if (!authorised) return { ok: false, message: 'That athlete is not on your roster.' };

  const repo = await getRepo();

  // a day holds one session per slot, and prescribing into an occupied one
  // replaces what was there — say so rather than letting a session disappear
  const slot = kind === 'strength' ? 1 : 0;
  const existing = (await repo.listScheduled(athleteId, date, date)).find((w) => w.slot === slot);

  try {
    await repo.insertTemplateIntoProgramme(kind, templateId, athleteId, date, slot);
  } catch (error) {
    return { ok: false, message: messageFor(error) };
  }

  revalidatePath(`/coach/athletes/${athleteId}`);
  revalidatePath('/app/calendar');
  revalidatePath('/app/training');
  revalidatePath('/app');
  return {
    ok: true,
    message: existing
      ? `Replaced "${existing.name}" on ${date}. The athlete sees it now.`
      : `Added to ${date}. The athlete sees it now.`,
  };
}

/** Database refusals are written to be read; anything else gets a plain sentence. */
function messageFor(error: unknown): string {
  const raw = error instanceof Error ? error.message : '';
  if (/archived|cannot be edited|cannot be deleted|still holds|not on your roster/i.test(raw)) return raw;
  return 'That did not save. Try again.';
}
