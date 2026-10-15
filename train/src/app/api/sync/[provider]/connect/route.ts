import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { siteUrl } from '@/lib/env';
import { connectUrl } from '@/lib/sync/pipeline';
import { syncProvider, syncSecret } from '@/lib/sync/providers';

export const dynamic = 'force-dynamic';

/** Start connecting a watch account: off to the provider, with signed state. */
export async function GET(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: name } = await params;
  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL('/login?next=/app/profile', siteUrl));
  if (session.role !== 'athlete') return NextResponse.redirect(new URL('/coach', siteUrl));

  const provider = syncProvider(name);
  const secret = syncSecret();
  if (!provider || !provider.configured() || !secret) {
    return NextResponse.redirect(new URL('/app/profile?sync=unavailable', siteUrl));
  }
  return NextResponse.redirect(connectUrl(provider, secret, session.userId, `${siteUrl}/api/sync/${provider.name}/callback`));
}
