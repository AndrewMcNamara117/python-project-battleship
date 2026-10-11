import 'server-only';
import { optionalServerEnv } from '@/lib/env';
import type { EmailMessage, EmailProvider, ProviderResult, SenderIdentity } from './provider';

/**
 * RESEND.
 *
 * Chosen over Postmark and SES for three reasons that matter to this project:
 * the whole integration is one authenticated POST so no SDK joins the
 * dependency list; it supports an Idempotency-Key header, which is exactly the
 * guarantee this slice needs when a worker restarts mid-send; and it has a
 * built-in verified sender (`onboarding@resend.dev`) that delivers to the
 * account owner's own address, so real delivery can be proven before anyone
 * touches DNS.
 *
 * ---------------------------------------------------------------------------
 * ABOUT ironmilesclub@outlook.com
 *
 * Resend — like Postmark and SES — will not send as an address on a domain you
 * have not verified by DNS, and nobody can add DNS records to outlook.com. So
 * `From: ironmilesclub@outlook.com` is not available and this file will not
 * pretend otherwise.
 *
 * What it does instead:
 *   - Reply-To is set to ironmilesclub@outlook.com, which needs no verification
 *     and means a coach hitting reply reaches the real Iron Miles mailbox.
 *   - From falls back to Resend's verified test sender until a domain is
 *     verified, and `sender().verified` reports false so nothing downstream
 *     claims otherwise.
 *   - Once ironmiles.ie is verified in Resend, setting EMAIL_FROM_ADDRESS to
 *     something like training@ironmiles.ie is the only change required.
 * ---------------------------------------------------------------------------
 */

/** Overridable so the adapter can be tested against a server that behaves
 *  like Resend. Unset everywhere except in tests. */
const ENDPOINT = () => optionalServerEnv('RESEND_ENDPOINT') ?? 'https://api.resend.com/emails';

/** Resend's own sender, which delivers only to the account owner's address. */
const RESEND_TEST_SENDER = 'onboarding@resend.dev';

/** The mailbox a coach reaches by replying. Needs no provider verification. */
export const IRON_MILES_MAILBOX = 'ironmilesclub@outlook.com';

const FROM_NAME = 'Iron Miles Training';

/** 4xx that will never succeed on a retry, however many times it is tried. */
const PERMANENT_STATUSES = new Set([400, 401, 403, 404, 409, 413, 422]);

export const resendProvider: EmailProvider = {
  name: 'resend',

  configured: () => Boolean(optionalServerEnv('RESEND_API_KEY')),

  sender(): SenderIdentity {
    const configured = optionalServerEnv('EMAIL_FROM_ADDRESS');
    const replyTo = optionalServerEnv('EMAIL_REPLY_TO') ?? IRON_MILES_MAILBOX;

    // Verification is asserted by whoever set the environment up, because only
    // they can see the Resend dashboard. Absent that, this reports unverified —
    // the safe direction to be wrong in.
    const claimedVerified = optionalServerEnv('EMAIL_FROM_VERIFIED') === 'true';

    if (!configured) {
      return {
        from: { address: RESEND_TEST_SENDER, name: FROM_NAME },
        replyTo,
        verified: false,
        setupRequired:
          `No EMAIL_FROM_ADDRESS is set, so mail goes out as ${RESEND_TEST_SENDER}. ` +
          'Resend only delivers from that address to the email address the Resend ' +
          'account itself was registered with — fine for verifying delivery, not for ' +
          'coaches. Verify a domain in Resend, then set EMAIL_FROM_ADDRESS and ' +
          'EMAIL_FROM_VERIFIED=true.',
      };
    }

    return {
      from: { address: configured, name: optionalServerEnv('EMAIL_FROM_NAME') ?? FROM_NAME },
      replyTo,
      verified: claimedVerified,
      setupRequired: claimedVerified
        ? null
        : `${configured} is configured but EMAIL_FROM_VERIFIED is not set to true. ` +
          'Resend will reject the send until its domain is verified by DNS.',
    };
  },

  async send(message: EmailMessage): Promise<ProviderResult> {
    const key = optionalServerEnv('RESEND_API_KEY');
    if (!key) {
      return { state: 'failed_permanent', detail: 'RESEND_API_KEY is not set.' };
    }

    const { from, replyTo } = resendProvider.sender();

    let response: Response;
    try {
      response = await fetch(ENDPOINT(), {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${key}`,
          'Content-Type': 'application/json',
          // the provider's own duplicate suppression, on top of ours
          'Idempotency-Key': message.idempotencyKey,
        },
        body: JSON.stringify({
          from: from.name ? `${from.name} <${from.address}>` : from.address,
          to: [message.to],
          subject: message.subject,
          html: message.html,
          text: message.text,
          ...(replyTo ? { reply_to: replyTo } : {}),
          ...(message.tags
            ? { tags: Object.entries(message.tags).map(([name, value]) => ({ name, value })) }
            : {}),
        }),
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      // a timeout or a DNS failure says nothing about the message itself
      return {
        state: 'failed',
        detail: error instanceof Error
          ? `Could not reach Resend: ${error.message}`
          : 'Could not reach Resend.',
      };
    }

    const raw = await response.text();
    const parsed = safeJson(raw);

    if (response.ok) {
      return {
        state: 'sent',
        detail: 'Accepted by Resend.',
        providerMessageId: typeof parsed?.id === 'string' ? parsed.id : undefined,
      };
    }

    const reason = typeof parsed?.message === 'string'
      ? parsed.message
      : raw.slice(0, 200) || `HTTP ${response.status}`;

    if (response.status === 429) {
      const header = response.headers.get('retry-after');
      const seconds = header ? Number(header) : NaN;
      return {
        state: 'failed',
        detail: `Rate limited by Resend: ${reason}`,
        retryAfterSeconds: Number.isFinite(seconds) ? seconds : undefined,
      };
    }

    // A rejected address or an unverified sender will be rejected identically
    // for ever. Retrying those wastes attempts and hides the real problem.
    if (PERMANENT_STATUSES.has(response.status)) {
      return { state: 'failed_permanent', detail: `Resend refused it: ${reason}` };
    }

    return { state: 'failed', detail: `Resend returned ${response.status}: ${reason}` };
  },
};

function safeJson(raw: string): Record<string, unknown> | null {
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return null;
  }
}
