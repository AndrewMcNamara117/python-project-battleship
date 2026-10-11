import { NextResponse } from 'next/server';
import { getServiceRepo } from '@/lib/data';
import { optionalServerEnv } from '@/lib/env';
import { readResendEvent, verifyResendSignature } from '@/lib/notifications/email/webhook';

export const dynamic = 'force-dynamic';

/**
 * Resend's delivery reports.
 *
 * This is the only thing that can promote a delivery from "the provider
 * accepted it" to "it reached a mailbox". Everything about it is defensive:
 * the body is read raw because the signature covers the exact bytes, an
 * unsigned request is refused rather than trusted, and an event for a message
 * this deployment never sent is a 200 with nothing done — a rebuilt
 * environment should not make the provider retry for ever.
 */
export async function POST(request: Request) {
  const secret = optionalServerEnv('RESEND_WEBHOOK_SECRET');
  if (!secret) {
    // refusing beats accepting unverified claims about delivery
    return NextResponse.json({ error: 'Webhooks are not configured.' }, { status: 503 });
  }

  const raw = await request.text();
  const verified = verifyResendSignature(raw, {
    id: request.headers.get('svix-id'),
    timestamp: request.headers.get('svix-timestamp'),
    signature: request.headers.get('svix-signature'),
  }, secret);

  if (!verified.ok) {
    return NextResponse.json({ error: verified.reason }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: 'Body was not JSON.' }, { status: 400 });
  }

  const event = readResendEvent(payload);
  if (!event) {
    // a signed event of a kind Iron Miles does not act on. Acknowledged, so
    // the provider stops retrying it.
    return NextResponse.json({ ignored: true });
  }

  const { repo } = await getServiceRepo();
  const changed = await repo.recordProviderStatus(event.messageId, event.status, event.detail);

  return NextResponse.json({ status: event.status, changed });
}
