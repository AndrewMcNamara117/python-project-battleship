import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getServiceRepo } from '@/lib/data';
import { siteUrl } from '@/lib/env';
import { finishConnect } from '@/lib/sync/pipeline';
import { syncProvider, syncSecret } from '@/lib/sync/providers';

export const dynamic = 'force-dynamic';

/**
 * Back from the provider. The state must be ours, recent, and started by the
 * athlete now signed in; only then are tokens exchanged and stored, sealed.
 */
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: name } = await params;
  const session = await getSession();
  if (!session || session.role !== 'athlete') return NextResponse.redirect(new URL('/login?next=/app/profile', siteUrl));
  const provider = syncProvider(name);
  const secret = syncSecret();
  if (!provider || !provider.configured() || !secret) return NextResponse.redirect(new URL('/app/profile?sync=unavailable', siteUrl));

  const url = new URL(req.url);
  const { repo } = await getServiceRepo();
  const result = await finishConnect({
    provider,
    secret,
    athleteId: session.userId,
    code: url.searchParams.get('code'),
    state: url.searchParams.get('state'),
    redirectUri: `${siteUrl}/api/sync/${provider.name}/callback`,
    service: repo,
  });
  const back = new URL('/app/profile', siteUrl);
  back.searchParams.set('sync', result.ok ? `connected:${provider.name}` : 'failed');
  // a code, not text: the page says it in its own words, so a crafted link cannot put words in its mouth
  if (!result.ok) back.searchParams.set('reason', result.code);
  return NextResponse.redirect(back);
}
