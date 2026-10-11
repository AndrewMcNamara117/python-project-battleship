import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * DELIVERY WEBHOOKS.
 *
 * Without these, Iron Miles knows a provider accepted a message and nothing
 * more. That is the difference between "sent" and "delivered", and the whole
 * point of this slice is not claiming the second when only the first is true.
 *
 * Resend signs webhooks with Svix's scheme, which is a plain HMAC and needs no
 * SDK: the signed content is `id.timestamp.body`, the secret is base64 after a
 * `whsec_` prefix, and the header carries a space-separated list of versioned
 * signatures so a secret can be rotated without dropping events.
 *
 * Verification is pure and lives here rather than in the route so it can be
 * tested against known-good and known-bad signatures without a server.
 */

/** Anything older than this is a replay, not a delivery report. */
const TOLERANCE_SECONDS = 300;

export interface WebhookHeaders {
  id: string | null;
  timestamp: string | null;
  signature: string | null;
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; reason: string };

export function verifyResendSignature(
  rawBody: string,
  headers: WebhookHeaders,
  secret: string,
  now: Date = new Date(),
): VerifyResult {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) {
    return { ok: false, reason: 'Missing Svix signature headers.' };
  }

  const sentAt = Number(timestamp);
  if (!Number.isFinite(sentAt)) {
    return { ok: false, reason: 'Unreadable webhook timestamp.' };
  }

  const age = Math.abs(Math.floor(now.getTime() / 1000) - sentAt);
  if (age > TOLERANCE_SECONDS) {
    // a correctly signed event from an hour ago is a replay of a real one
    return { ok: false, reason: `Webhook timestamp is ${age}s out of tolerance.` };
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = createHmac('sha256', key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest('base64');

  // the header lists every version the sender supports, so a rotated secret
  // does not drop events mid-rollout
  const offered = signature.split(' ')
    .map((part) => part.split(','))
    .filter(([version]) => version === 'v1')
    .map(([, value]) => value ?? '');

  for (const candidate of offered) {
    const a = Buffer.from(candidate);
    const b = Buffer.from(expected);
    if (a.length === b.length && timingSafeEqual(a, b)) return { ok: true };
  }

  return { ok: false, reason: 'Signature did not match.' };
}

/** Provider event names mapped to the four outcomes Iron Miles records. */
const EVENT_STATUS: Record<string, 'delivered' | 'bounced' | 'complained' | 'delayed'> = {
  'email.delivered': 'delivered',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
  'email.delivery_delayed': 'delayed',
};

export interface WebhookEvent {
  messageId: string;
  status: 'delivered' | 'bounced' | 'complained' | 'delayed';
  detail: string;
}

/**
 * Read one event, or null when it is one Iron Miles does not act on.
 *
 * `email.sent` is deliberately ignored: the worker already recorded that when
 * the API call returned, and taking the provider's word for it a second time
 * would only overwrite a more precise record with a vaguer one.
 */
export function readResendEvent(payload: unknown): WebhookEvent | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const body = payload as { type?: unknown; data?: unknown };

  const type = typeof body.type === 'string' ? body.type : '';
  const status = EVENT_STATUS[type];
  if (!status) return null;

  const data = (typeof body.data === 'object' && body.data !== null ? body.data : {}) as {
    email_id?: unknown;
    bounce?: { message?: unknown };
  };
  const messageId = typeof data.email_id === 'string' ? data.email_id : '';
  if (!messageId) return null;

  const bounce = typeof data.bounce?.message === 'string' ? data.bounce.message : null;

  return {
    messageId,
    status,
    detail: bounce
      ? `${describe(status)} ${bounce}`
      : describe(status),
  };
}

function describe(status: WebhookEvent['status']): string {
  switch (status) {
    case 'delivered': return 'Delivered to the mailbox.';
    case 'bounced': return 'Bounced — the address rejected it.';
    case 'complained': return 'Marked as spam by the recipient.';
    case 'delayed': return 'The provider is still trying.';
  }
}
