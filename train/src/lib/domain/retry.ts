import type { ISOTimestamp } from './types';

/**
 * WHEN TO TRY AGAIN, AND WHEN TO STOP.
 *
 * Pure, and in the domain rather than in the worker, so the schedule can be
 * tested without a provider, a clock or a database — and so both adapters
 * cannot drift into different ideas of "gave up".
 *
 * The distinction that matters is not how many times something failed but
 * *why*. A timeout says nothing about the message and is worth repeating. A
 * rejected address, an unverified sender, a malformed request: those will be
 * refused identically for ever, and retrying them buries the real problem
 * under four identical log lines.
 */

/** Attempts in total, not retries after the first. */
export const MAX_ATTEMPTS = 4;

/**
 * A minute, then five, then half an hour.
 *
 * Long enough that a provider having a bad ten minutes recovers inside the
 * schedule; short enough that an urgent alert is not first delivered tomorrow.
 * The whole schedule spans about 36 minutes.
 */
const BACKOFF_SECONDS = [60, 300, 1800];

export interface RetryDecision {
  /** What the delivery row should now say. */
  state: 'failed' | 'failed_permanent';
  /** When the worker may pick it up again. Null when it never should. */
  nextAttemptAt: ISOTimestamp | null;
  /** Appended to the failure detail, so the record explains itself. */
  note: string;
}

/**
 * @param attemptsSoFar attempts already recorded, before this failure
 * @param permanent     the channel's own judgement that this cannot succeed
 * @param providerHint  a Retry-After the provider asked for, in seconds
 */
export function decideRetry(
  attemptsSoFar: number,
  permanent: boolean,
  providerHint: number | undefined,
  now: Date,
): RetryDecision {
  const attempt = attemptsSoFar + 1;

  if (permanent) {
    return {
      state: 'failed_permanent',
      nextAttemptAt: null,
      note: 'Not retried: this would fail the same way every time.',
    };
  }

  if (attempt >= MAX_ATTEMPTS) {
    return {
      state: 'failed_permanent',
      nextAttemptAt: null,
      // never silently dropped: the row stays, visibly, with the last reason
      note: `Gave up after ${attempt} attempts.`,
    };
  }

  // the provider knows its own rate limits better than this schedule does
  const seconds = providerHint && providerHint > 0
    ? Math.min(providerHint, 3600)
    : BACKOFF_SECONDS[Math.min(attemptsSoFar, BACKOFF_SECONDS.length - 1)];

  return {
    state: 'failed',
    nextAttemptAt: new Date(now.getTime() + seconds * 1000).toISOString(),
    note: `Attempt ${attempt} of ${MAX_ATTEMPTS}; trying again in ${describe(seconds)}.`,
  };
}

function describe(seconds: number): string {
  if (seconds < 90) return `${seconds} seconds`;
  const minutes = Math.round(seconds / 60);
  return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
}

/**
 * The key a provider uses to recognise a repeat of the same send.
 *
 * Deliberately the delivery row's own id: it is created once, survives a
 * restart, and is the same value on every retry of that delivery — so a worker
 * that dies after the provider accepted a message but before the outcome was
 * recorded cannot cause a second email.
 */
export function idempotencyKeyFor(deliveryId: string): string {
  return `im-delivery-${deliveryId}`;
}
