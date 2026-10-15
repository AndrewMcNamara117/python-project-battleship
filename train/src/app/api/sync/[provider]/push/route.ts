import { NextResponse } from 'next/server';
import { getServiceRepo } from '@/lib/data';
import { handlePush } from '@/lib/sync/pipeline';
import { syncProvider, syncSecret } from '@/lib/sync/providers';

export const dynamic = 'force-dynamic';

/**
 * A provider telling us an athlete has a new activity.
 *
 * Read raw, because the signature covers the exact bytes; refused unsigned;
 * and a push for nobody we know is a 200 with nothing done, so a provider
 * does not retry it for ever. Everything else is in handlePush.
 */
export async function POST(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: name } = await params;
  const provider = syncProvider(name);
  const secret = syncSecret();
  if (!provider || !provider.configured() || !secret) {
    return NextResponse.json({ error: 'Sync is not configured.' }, { status: 503 });
  }
  const raw = await req.text();
  if (raw.length > 256 * 1024) return NextResponse.json({ error: 'Too large.' }, { status: 413 });

  const { repo } = await getServiceRepo();
  const report = await handlePush({ provider, secret, raw, headers: req.headers, service: repo });
  return NextResponse.json(report, { status: report.status });
}
