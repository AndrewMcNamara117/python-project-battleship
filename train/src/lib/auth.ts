import { cookies } from 'next/headers';
import { hasSupabase } from '@/lib/env';
import { createServerSupabase } from '@/lib/supabase/server';
import { DEMO_ATHLETE_ID, DEMO_COACH_ID } from '@/data/demo-seed';
import type { Role, UUID } from '@/lib/domain/types';

export interface Session {
  userId: UUID;
  email: string;
  role: Role;
  /** True when this session is backed by the demo dataset rather than Supabase. */
  isDemo: boolean;
}

export const DEMO_COOKIE = 'im_demo_session';

/**
 * Resolve the current session.
 *
 * With Supabase configured this is `auth.getUser()` — a verified JWT, not a
 * cookie the client can forge. Without it, the app runs in demo mode and a
 * signed-out visitor can enter as the demo athlete or the demo coach; that
 * branch is unreachable the moment real credentials exist.
 */
export async function getSession(): Promise<Session | null> {
  if (hasSupabase) {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    return {
      userId: user.id,
      email: user.email ?? '',
      role: (profile?.role as Role) ?? 'athlete',
      isDemo: false,
    };
  }

  const jar = await cookies();
  const value = jar.get(DEMO_COOKIE)?.value;
  if (!value) return null;
  if (value === 'coach') {
    return { userId: DEMO_COACH_ID, email: 'coach@ironmiles.ie', role: 'coach', isDemo: true };
  }
  return { userId: DEMO_ATHLETE_ID, email: 'andrew@ironmiles.ie', role: 'athlete', isDemo: true };
}

/** Session or bust — for routes that have already been guarded by middleware. */
export async function requireSession(): Promise<Session> {
  const session = await getSession();
  if (!session) throw new Error('Not authenticated');
  return session;
}

export async function requireCoach(): Promise<Session> {
  const session = await requireSession();
  if (session.role !== 'coach' && session.role !== 'admin') {
    throw new Error('Coach access required');
  }
  return session;
}

/**
 * A coach, and specifically this athlete's coach.
 *
 * Row-level security enforces the same rule in Postgres, but an action that
 * takes an athleteId from the client must not rely on the database alone:
 * demo mode has no RLS, an admin client bypasses it, and a policy gap becomes a
 * silent hole rather than a refused request. Defence in depth is the point —
 * this is the second lock, not the only one.
 *
 * Admins pass, because an admin is authorised over every athlete by definition.
 */
export async function requireCoachOf(
  athleteId: string,
): Promise<{ session: Session; authorised: true } | { session: Session; authorised: false }> {
  const session = await requireCoach();
  if (session.role === 'admin') return { session, authorised: true };

  const { getRepo } = await import('@/lib/data');
  const repo = await getRepo();
  const roster = await repo.listAthletesForCoach(session.userId);
  return { session, authorised: roster.some((a) => a.id === athleteId) };
}
