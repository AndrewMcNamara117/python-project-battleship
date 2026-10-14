'use server';

import { revalidatePath } from 'next/cache';
import { requireSession } from '@/lib/auth';
import { getRepo, getServiceRepo } from '@/lib/data';
import { rateLimit } from '@/lib/rate-limit';
import { attachActivity, importActivity, removeActivity } from '@/lib/activity/service';
import { ActivityFileError } from '@/lib/activity/types';
import { PRIVACY_TRIM_OPTIONS } from '@/lib/activity/route';
import { formatDayMonth, formatDuration } from '@/lib/domain/dates';

export interface ImportResult {
  ok: boolean;
  message: string;
  status?: 'matched' | 'enriched' | 'ambiguous' | 'unmatched' | 'duplicate';
  activityId?: string;
}

export interface ActivityResult {
  ok: boolean;
  message: string;
}

/** What arrives over the wire: gzip from our own form, so this is generous. */
const MAX_UPLOAD_BYTES = 4.4 * 1024 * 1024;

function revalidateTraining() {
  for (const path of ['/app', '/app/today', '/app/calendar', '/app/progress', '/app/training', '/app/activities']) {
    revalidatePath(path);
  }
}

/** Import one watch file. Athletes only; coaches read activities, never create them. */
export async function importActivityFile(formData: FormData): Promise<ImportResult> {
  const session = await requireSession();
  if (session.role !== 'athlete') {
    return { ok: false, message: 'Only athletes import activities. Coaches see them on the athlete’s page.' };
  }
  // generous for a person, a ceiling for a script: thirty files in ten minutes
  if (!rateLimit(`activity-import:${session.userId}`, 30, 10 * 60 * 1000)) {
    return { ok: false, message: 'That is a lot of files at once. Give it a few minutes and try the rest.' };
  }

  const file = formData.get('file');
  if (!(file instanceof Blob) || file.size === 0) {
    return { ok: false, message: 'Choose a .fit, .gpx or .tcx file first.' };
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false, message: 'That file is too large to be one activity.' };
  }

  const repo = await getRepo();
  const profile = await repo.getProfile(session.userId);
  if (!profile) return { ok: false, message: 'Your profile could not be found.' };

  try {
    const bytes = new Uint8Array(await file.arrayBuffer());
    // segment times are the server's to write, from this file — see importActivity
    let writer: Awaited<ReturnType<typeof getServiceRepo>>['repo'] | null = null;
    try {
      writer = (await getServiceRepo()).repo;
    } catch (error) {
      // a missing service key must not cost the athlete their import
      console.warn('[activities] segments not timed: no service repo', error);
    }
    const out = await importActivity(repo, profile, bytes, writer);
    revalidateTraining();
    const when = formatDayMonth(out.activity.localDate);
    const records = out.records?.length
      ? ' New record' + (out.records.length > 1 ? 's' : '') + ': ' + out.records.map((r) => `${r.label} ${formatDuration(r.elapsedS)}`).join(', ') + '.'
      : '';
    const timed = out.segments?.length
      ? ' ' +
        out.segments
          .map((s) => `${s.name} ${formatDuration(s.elapsedS)}${s.personalBest ? ' — a personal best' : ''}`)
          .join(', ') +
        '.'
      : '';
    const result = ((): ImportResult => {
    switch (out.status) {
      case 'matched':
        return { ok: true, status: out.status, activityId: out.activity.id, message: `Logged against ${out.session.name} on ${when}.` };
      case 'enriched':
        return {
          ok: true,
          status: out.status,
          activityId: out.activity.id,
          message: `Added to the ${out.session.name} you logged on ${when}. Nothing you typed was changed.`,
        };
      case 'ambiguous':
        return { ok: true, status: out.status, activityId: out.activity.id, message: `Imported. Two sessions on ${when} could be this one — pick which.` };
      case 'unmatched':
        return { ok: true, status: out.status, activityId: out.activity.id, message: `Imported. ${out.reason}` };
      case 'duplicate':
        return { ok: true, status: out.status, activityId: out.activity.id, message: `Already imported — that is the run from ${when}.` };
    }
    })();
    return { ...result, message: result.message + records + timed };
  } catch (error) {
    if (error instanceof ActivityFileError) return { ok: false, message: error.message };
    console.error('[activities] import failed', error);
    return { ok: false, message: 'The file could not be imported. Nothing was saved.' };
  }
}

export async function attachActivityToSession(activityId: string, scheduledId: string): Promise<ActivityResult> {
  const session = await requireSession();
  const repo = await getRepo();
  const out = await attachActivity(repo, session.userId, activityId, scheduledId);
  if (!out.ok) {
    const message = {
      not_found: 'That activity no longer exists.',
      not_yours: 'That activity no longer exists.',
      already_attached: 'That activity is already attached to a session.',
      not_an_option: 'That session cannot take this activity.',
    }[out.error];
    return { ok: false, message };
  }
  revalidateTraining();
  revalidatePath(`/app/activities/${activityId}`);
  return { ok: true, message: `Logged against ${out.session.name}.` };
}

export async function deleteActivity(activityId: string): Promise<ActivityResult> {
  const session = await requireSession();
  const repo = await getRepo();
  const out = await removeActivity(repo, session.userId, activityId);
  if (!out.ok) return { ok: false, message: 'That activity no longer exists.' };
  revalidateTraining();
  return {
    ok: true,
    message: out.unlogged ? 'Deleted, and its session is back on your plan.' : 'Deleted. Your log for that session is unchanged.',
  };
}

export async function renameActivity(activityId: string, name: string): Promise<ActivityResult> {
  const session = await requireSession();
  const repo = await getRepo();
  const activity = await repo.getActivity(activityId);
  if (!activity || activity.athleteId !== session.userId) return { ok: false, message: 'That activity no longer exists.' };
  const clean = name.replace(/\s+/g, ' ').trim().slice(0, 120);
  if (!clean) return { ok: false, message: 'Give it a name.' };
  await repo.updateActivity(activityId, { name: clean });
  revalidatePath(`/app/activities/${activityId}`);
  revalidatePath('/app/activities');
  return { ok: true, message: 'Renamed.' };
}

/** The two settings the importer reads. */
export async function saveActivitySettings(formData: FormData): Promise<ActivityResult> {
  const session = await requireSession();
  const repo = await getRepo();

  const rawMax = String(formData.get('maxHeartRate') ?? '').trim();
  const max = rawMax === '' ? null : Number(rawMax);
  if (max !== null && (!Number.isInteger(max) || max < 100 || max > 240)) {
    return { ok: false, message: 'Max heart rate is a whole number between 100 and 240.' };
  }
  const trim = Number(formData.get('privacyTrimM'));
  if (!(PRIVACY_TRIM_OPTIONS as readonly number[]).includes(trim)) {
    return { ok: false, message: 'Choose one of the privacy distances.' };
  }

  const shareDefault = formData.get('shareActivitiesDefault') === 'on';
  await repo.updateProfile(session.userId, { maxHeartRate: max, privacyTrimM: trim, shareActivitiesDefault: shareDefault });
  revalidatePath('/app/activities');
  revalidatePath('/app/profile');
  return {
    ok: true,
    message: 'Saved. The privacy distance applies to files you import from now on.',
  };
}

/* ---------------- the club ---------------- */

export async function setActivitySharing(activityId: string, share: boolean): Promise<ActivityResult> {
  const session = await requireSession();
  const repo = await getRepo();
  const activity = await repo.getActivity(activityId);
  if (!activity || activity.athleteId !== session.userId) return { ok: false, message: 'That activity no longer exists.' };
  await repo.updateActivity(activityId, { visibility: share ? 'club' : 'coach' });
  revalidatePath(`/app/activities/${activityId}`);
  revalidatePath('/app/club');
  return {
    ok: true,
    message: share ? 'Shared with the club. They see the route, distance and pace — never your heart rate.' : 'Only you and your coach can see it now.',
  };
}

export async function toggleKudos(activityId: string, give: boolean): Promise<ActivityResult> {
  const session = await requireSession();
  if (!rateLimit(`kudos:${session.userId}`, 120, 10 * 60 * 1000)) return { ok: false, message: 'Slow down a moment.' };
  const repo = await getRepo();
  try {
    if (give) await repo.giveKudos(activityId, session.userId);
    else await repo.takeBackKudos(activityId, session.userId);
  } catch {
    return { ok: false, message: 'Kudos could not be given on that one.' };
  }
  revalidatePath('/app/club');
  revalidatePath(`/app/club/${activityId}`);
  return { ok: true, message: give ? 'Kudos given.' : 'Kudos taken back.' };
}

export async function postComment(activityId: string, body: string): Promise<ActivityResult> {
  const session = await requireSession();
  if (!rateLimit(`comment:${session.userId}`, 20, 10 * 60 * 1000)) {
    return { ok: false, message: 'That is a lot of comments in a few minutes. Give it a moment.' };
  }
  const text = body.replace(/\s+/g, ' ').trim();
  if (!text) return { ok: false, message: 'Write something first.' };
  if (text.length > 500) return { ok: false, message: 'Keep it under 500 characters.' };
  const repo = await getRepo();
  try {
    await repo.addComment(activityId, session.userId, text);
  } catch {
    return { ok: false, message: 'That activity is not open for comments.' };
  }
  revalidatePath(`/app/club/${activityId}`);
  revalidatePath(`/app/activities/${activityId}`);
  revalidatePath('/app/club');
  return { ok: true, message: 'Posted.' };
}

export async function removeComment(commentId: string, activityId: string): Promise<ActivityResult> {
  const session = await requireSession();
  const repo = await getRepo();
  await repo.deleteComment(commentId, session.userId);
  revalidatePath(`/app/club/${activityId}`);
  revalidatePath(`/app/activities/${activityId}`);
  return { ok: true, message: 'Removed.' };
}
