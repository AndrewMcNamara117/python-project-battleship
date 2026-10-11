'use server';

import { getRepo } from '@/lib/data';
import { applicationSchema } from '@/lib/validation/schemas';
import { rateLimit } from '@/lib/rate-limit';
import { headers } from 'next/headers';

export interface ActionResult {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
}

/**
 * Coaching application. Public and unauthenticated, so it is rate limited and
 * re-validated on the server regardless of what the client checked.
 */
export async function submitApplication(formData: FormData): Promise<ActionResult> {
  const h = await headers();
  const ip = h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';
  if (!rateLimit(`apply:${ip}`, 5, 60 * 60 * 1000)) {
    return { ok: false, message: 'Too many applications from this connection. Try again later.' };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = applicationSchema.safeParse({
    ...raw,
    consent: raw.consent === 'on' || raw.consent === 'true',
    currentWeeklyKm: raw.currentWeeklyKm === '' ? undefined : raw.currentWeeklyKm,
  });

  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? 'form');
      if (!fieldErrors[key]) fieldErrors[key] = issue.message;
    }
    return { ok: false, message: 'Some details need another look.', fieldErrors };
  }

  const repo = await getRepo();
  await repo.createApplication({
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    phone: parsed.data.phone || null,
    goal: parsed.data.goal,
    targetRace: parsed.data.targetRace || null,
    targetDate: parsed.data.targetDate || null,
    currentWeeklyKm: parsed.data.currentWeeklyKm ?? null,
    experience: parsed.data.experience,
    injuries: parsed.data.injuries || null,
    startWhen: parsed.data.startWhen,
  });

  return {
    ok: true,
    message: 'Application received. A person reads every one — expect a reply within two days.',
  };
}
