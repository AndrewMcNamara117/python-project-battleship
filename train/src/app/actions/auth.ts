'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { DEMO_COOKIE } from '@/lib/auth';
import { hasSupabase, siteUrl } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { createServerSupabase } from '@/lib/supabase/server';
import { credentialsSchema, registerSchema } from '@/lib/validation/schemas';

export interface AuthResult {
  ok: boolean;
  message: string;
  fieldErrors?: Record<string, string>;
}

function collectErrors(issues: { path: PropertyKey[]; message: string }[]) {
  const fieldErrors: Record<string, string> = {};
  for (const issue of issues) {
    const key = String(issue.path[0] ?? 'form');
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return fieldErrors;
}

async function clientKey(prefix: string) {
  const h = await headers();
  return `${prefix}:${h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'}`;
}

export async function signIn(formData: FormData): Promise<AuthResult> {
  if (!rateLimit(await clientKey('signin'), 10, 15 * 60 * 1000)) {
    return { ok: false, message: 'Too many attempts. Wait a few minutes and try again.' };
  }

  const parsed = credentialsSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) {
    return { ok: false, message: 'Check your details.', fieldErrors: collectErrors(parsed.error.issues) };
  }

  if (!hasSupabase) {
    return {
      ok: false,
      message:
        'No authentication provider is configured on this deployment. Use the demo entry below to explore the platform.',
    };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  });
  // deliberately vague: never confirm whether an address has an account
  if (error) return { ok: false, message: 'That email and password did not match.' };

  redirect('/app');
}

export async function signUp(formData: FormData): Promise<AuthResult> {
  if (!rateLimit(await clientKey('signup'), 5, 60 * 60 * 1000)) {
    return { ok: false, message: 'Too many attempts. Try again later.' };
  }

  const raw = Object.fromEntries(formData.entries());
  const parsed = registerSchema.safeParse({ ...raw, acceptTerms: raw.acceptTerms === 'on' });
  if (!parsed.success) {
    return { ok: false, message: 'Check your details.', fieldErrors: collectErrors(parsed.error.issues) };
  }

  if (!hasSupabase) {
    return {
      ok: false,
      message:
        'No authentication provider is configured on this deployment. Use the demo entry below to explore the platform.',
    };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.fullName },
      emailRedirectTo: `${siteUrl}/auth/callback`,
    },
  });
  if (error) return { ok: false, message: error.message };

  return {
    ok: true,
    message: 'Check your email to confirm the address, then log in and start onboarding.',
  };
}

export async function signOut(): Promise<void> {
  const jar = await cookies();
  if (hasSupabase) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  jar.delete(DEMO_COOKIE);
  redirect('/');
}

/**
 * Demo entry. Only reachable while no Supabase project is configured — with
 * credentials present this returns without setting anything, so it can never
 * become a back door into a real deployment.
 */
export async function enterDemo(role: 'athlete' | 'coach'): Promise<void> {
  if (hasSupabase) return;
  const jar = await cookies();
  jar.set(DEMO_COOKIE, role, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 12,
  });
  redirect(role === 'coach' ? '/coach' : '/app');
}
