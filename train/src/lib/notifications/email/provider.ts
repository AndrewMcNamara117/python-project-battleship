import 'server-only';

/**
 * WHAT AN EMAIL PROVIDER IS, AS FAR AS IRON MILES IS CONCERNED.
 *
 * Everything above this file — the roster signals, the digest, the coach's
 * preferences — is written without knowing that Resend exists. Swapping to
 * Postmark or SES should mean writing one more file next to `resend.ts` and
 * changing one line of selection, and nothing else.
 *
 * The interface is deliberately narrow. A provider takes a finished message
 * and reports what happened to it. It does not compose subjects, decide what
 * is urgent, or know what a roster is.
 */

export interface EmailAddress {
  address: string;
  name?: string;
}

export interface EmailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** Where a coach's reply goes. Always a mailbox a person actually reads. */
  replyTo?: string;
  /**
   * Stable across retries of the same delivery, so a provider that supports
   * idempotency will not send twice when a worker is restarted mid-flight.
   */
  idempotencyKey: string;
  /** Provider-side labels, for their dashboard. Never anything about a person. */
  tags?: Record<string, string>;
}

/**
 * What became of one send attempt.
 *
 * `sent` means the provider accepted it, not that it reached anyone. That
 * distinction is the whole reason this slice exists — an accepted API call is
 * evidence of a handoff, and only a webhook is evidence of delivery.
 */
export interface ProviderResult {
  state: 'sent' | 'failed' | 'failed_permanent';
  detail: string;
  providerMessageId?: string;
  /** Honour a provider's own rate-limit hint rather than guessing. */
  retryAfterSeconds?: number;
}

/**
 * Who the email says it is from.
 *
 * `verified` is the important field and the reason this is a type rather than
 * a string. Every provider refuses to send as a domain you have not proved you
 * control, and claiming an address that is not verified means the mail is
 * rejected or lands in spam. Iron Miles reports what is actually configured
 * instead of what it would like to be true.
 */
export interface SenderIdentity {
  from: EmailAddress;
  replyTo: string | null;
  verified: boolean;
  /** What a human has to do, when something is missing. Shown, not swallowed. */
  setupRequired: string | null;
}

export interface EmailProvider {
  /** Recorded on every delivery row, so "which provider handled it" is answerable. */
  readonly name: string;
  /** False when this environment has no key. Never a silent no-op. */
  configured(): boolean;
  sender(): SenderIdentity;
  send(message: EmailMessage): Promise<ProviderResult>;
}
