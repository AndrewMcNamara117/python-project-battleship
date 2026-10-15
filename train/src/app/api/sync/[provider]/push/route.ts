import { NextResponse } from 'next/server';
import { getServiceRepo } from '@/lib/data';
import { handlePush } from '@/lib/sync/pipeline';
import { syncProvider, syncSecret } from '@/lib/sync/providers';

export const dynamic = 'force-dynamic';
// one push may carry several activities, each fetched in turn
export const maxDuration = 60;

/** The body as text, or null past `limit` bytes — counted as it streams, whatever the headers claim. */
async function readCapped(req: Request, limit: number): Promise<string | null> {
  if (!req.body) return '';
  const reader = req.body.getReader();
  const parts: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  return Buffer.concat(parts).toString('utf8');
}

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
  // refuse an oversized body before reading it: this route is reachable unsigned
  const LIMIT = 256 * 1024;
  const declared = Number(req.headers.get('content-length') ?? NaN);
  if (Number.isFinite(declared) && declared > LIMIT) return NextResponse.json({ error: 'Too large.' }, { status: 413 });
  const raw = await readCapped(req, LIMIT);
  if (raw == null) return NextResponse.json({ error: 'Too large.' }, { status: 413 });

  const { repo } = await getServiceRepo();
  const report = await handlePush({ provider, secret, raw, headers: req.headers, service: repo });
  return NextResponse.json(report, { status: report.status });
}
