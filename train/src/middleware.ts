import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const PROTECTED = ['/app', '/coach', '/onboarding'];
const COACH_ONLY = ['/coach'];
const DEMO_COOKIE = 'im_demo_session';

/**
 * Route protection and session refresh.
 *
 * With Supabase configured this also refreshes the auth cookie on every
 * request, which is what keeps Server Components from seeing a stale session.
 * Middleware is the coarse gate; the real authorisation is row-level security
 * in Postgres, so a request that slips past this still cannot read another
 * athlete's data.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const needsAuth = PROTECTED.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // demo mode: gate on the demo cookie only
    if (!needsAuth) return NextResponse.next();
    const demo = request.cookies.get(DEMO_COOKIE)?.value;
    if (!demo) {
      const to = request.nextUrl.clone();
      to.pathname = '/login';
      to.searchParams.set('next', pathname);
      return NextResponse.redirect(to);
    }
    if (COACH_ONLY.some((p) => pathname.startsWith(p)) && demo !== 'coach') {
      const to = request.nextUrl.clone();
      to.pathname = '/app';
      return NextResponse.redirect(to);
    }
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (needsAuth && !user) {
    const to = request.nextUrl.clone();
    to.pathname = '/login';
    to.searchParams.set('next', pathname);
    return NextResponse.redirect(to);
  }

  if (user && COACH_ONLY.some((p) => pathname.startsWith(p))) {
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
    if (profile?.role !== 'coach' && profile?.role !== 'admin') {
      const to = request.nextUrl.clone();
      to.pathname = '/app';
      return NextResponse.redirect(to);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Everything except static assets and image optimisation — those never
     * need a session and running middleware on them costs latency.
     */
    '/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|avif|woff2?)$).*)',
  ],
};
