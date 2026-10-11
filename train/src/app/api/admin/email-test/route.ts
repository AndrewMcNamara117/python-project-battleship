import { NextResponse } from 'next/server';
import { optionalServerEnv, siteUrl } from '@/lib/env';
import { emailProvider, IRON_MILES_MAILBOX } from '@/lib/notifications/email';
import { renderEmail } from '@/lib/notifications/email/render';
import { sampleAlert, sampleDigest } from '@/lib/notifications/email/sample';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

/**
 * Send one test email, to one address, on purpose.
 *
 * Two deliberate constraints make this safe to leave in the deployment:
 *
 *   1. It sends only to EMAIL_TEST_RECIPIENT (defaulting to the Iron Miles
 *      mailbox). There is no `to` parameter, so it cannot be pointed at a
 *      coach, an athlete, or a list.
 *   2. Its content is a fixture. No roster is read and no athlete's name
 *      reaches it, so proving delivery never involves a real person's data.
 *
 * Authorised by the same bearer secret as the cron endpoints, checked in
 * constant time. Without CRON_SECRET set it refuses rather than defaulting
 * open.
 */
function authorised(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const header = request.headers.get('authorization') ?? '';
  const provided = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (provided.length !== secret.length) return false;

  let diff = 0;
  for (let i = 0; i < secret.length; i++) diff |= provided.charCodeAt(i) ^ secret.charCodeAt(i);
  return diff === 0;
}

export async function POST(request: Request) {
  if (!authorised(request)) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const provider = emailProvider();
  if (!provider) {
    return NextResponse.json({
      error: 'No email provider is configured in this environment.',
      fix: 'Set RESEND_API_KEY.',
    }, { status: 503 });
  }

  const to = optionalServerEnv('EMAIL_TEST_RECIPIENT') ?? IRON_MILES_MAILBOX;
  const which = new URL(request.url).searchParams.get('which') ?? 'both';
  const wanted = which === 'both' ? ['digest', 'alert'] : [which];

  const sender = provider.sender();
  const results = [];

  for (const kind of wanted) {
    const draft = kind === 'alert' ? sampleAlert() : sampleDigest();
    const rendered = renderEmail(draft, 'Iron Miles');
    if (!rendered) {
      results.push({ kind, error: 'Nothing to render.' });
      continue;
    }

    const result = await provider.send({
      to,
      subject: `[TEST] ${rendered.subject}`,
      html: rendered.html,
      text: `THIS IS A TEST SEND FROM IRON MILES. The names below are invented.\n\n${rendered.text}`,
      replyTo: sender.replyTo ?? undefined,
      // a new key each run, so a test send is never suppressed as a duplicate
      idempotencyKey: `im-test-${kind}-${Date.now()}`,
      tags: { kind: 'test' },
    });

    results.push({ kind, subject: rendered.subject, ...result });
  }

  return NextResponse.json({
    provider: provider.name,
    simulated: provider.name === 'demo',
    to,
    from: sender.from,
    replyTo: sender.replyTo,
    senderVerified: sender.verified,
    setupRequired: sender.setupRequired,
    siteUrl,
    results,
  });
}
