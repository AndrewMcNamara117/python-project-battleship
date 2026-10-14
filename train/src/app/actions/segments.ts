'use server';

import { revalidatePath } from 'next/cache';
import { requireCoach, requireCoachOf } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { longestPiece, SEGMENT_END_CLEARANCE_M, segmentFromLine } from '@/lib/activity/segments';

export interface SegmentResult {
  ok: boolean;
  message: string;
  segmentId?: string;
}

export async function createSegmentFromActivity(
  activityId: string,
  fromM: number,
  toM: number,
  name: string,
  description: string,
): Promise<SegmentResult> {
  const repo = await getRepo();
  const activity = await repo.getActivity(activityId);
  if (!activity) return { ok: false, message: 'That activity no longer exists.' };
  const { authorised, session } = await requireCoachOf(activity.athleteId);
  if (!authorised) return { ok: false, message: 'That activity no longer exists.' };

  const { line, length } = longestPiece(activity.route);
  if (line.length < 2) return { ok: false, message: 'This activity has no route to draw from.' };

  const from = Math.round(fromM);
  const to = Math.round(toM);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to - from < 200) {
    return { ok: false, message: 'A segment is at least 200 m long.' };
  }
  if (to - from > 20000) return { ok: false, message: 'Keep a segment under 20 km.' };
  if (from < SEGMENT_END_CLEARANCE_M || to > length - SEGMENT_END_CLEARANCE_M) {
    return {
      ok: false,
      message: `Keep at least ${SEGMENT_END_CLEARANCE_M} m from either end of the route — the ends are closest to where the athlete lives.`,
    };
  }
  const clean = name.replace(/\s+/g, ' ').trim();
  if (clean.length < 2 || clean.length > 80) return { ok: false, message: 'Give the segment a name (2–80 characters).' };

  const geometry = segmentFromLine(line, from, to);
  try {
    const segment = await repo.createSegment({
      name: clean,
      description: description.trim().slice(0, 300),
      route: geometry.route,
      distanceM: geometry.distanceM,
      createdBy: session.userId,
    });
    revalidatePath('/coach/segments');
    revalidatePath('/app/segments');
    return { ok: true, message: `“${segment.name}” drawn. Runs imported from now on are timed on it.`, segmentId: segment.id };
  } catch {
    return { ok: false, message: 'The segment could not be saved.' };
  }
}

export async function setSegmentArchived(segmentId: string, archived: boolean): Promise<SegmentResult> {
  await requireCoach();
  const repo = await getRepo();
  await repo.setSegmentArchived(segmentId, archived);
  revalidatePath('/coach/segments');
  revalidatePath('/app/segments');
  return { ok: true, message: archived ? 'Retired. Existing times stay; new runs are not timed on it.' : 'Back in use.' };
}
