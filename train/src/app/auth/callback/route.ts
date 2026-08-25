import { NextResponse } from 'next/server';
import { hasSupabase } from '@/lib/env';
import { createServerSupabase } from '@/lib/supabase/server';

/**
 * Supabase email-confirmation and magic-link callback.
 * Exchanges the one-time code for a session cookie, then sends the athlete on.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next') ?? '/app';

  if (!hasSupabase || !code) {
    return NextResponse.redirect(new URL('/login', url.origin));
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/login?error=link_expired', url.origin));
  }

  // a confirmed account with no onboarding has nothing to show in the hub yet
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('onboarded_at')
      .eq('id', user.id)
      .maybeSingle();
    if (!profile?.onboarded_at) {
      return NextResponse.redirect(new URL('/onboarding', url.origin));
    }
  }

  return NextResponse.redirect(new URL(next, url.origin));
}
