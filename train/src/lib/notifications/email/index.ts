import 'server-only';
import { hasSupabase } from '@/lib/env';
import { resendProvider } from './resend';
import { simulatedProvider } from './simulated';
import type { EmailProvider } from './provider';

/**
 * Which provider this environment has, if any.
 *
 * Selection is by environment and never by anything a request can influence.
 * The order says what the product believes: a real key means real sending; no
 * key plus no database means the demo, which simulates and says so; no key
 * plus a real database means email genuinely is not set up, and every caller
 * is told that rather than shown a switch that does nothing.
 */
export function emailProvider(): EmailProvider | null {
  if (resendProvider.configured()) return resendProvider;
  if (!hasSupabase) return simulatedProvider;
  return null;
}

/** True when this deployment simulates rather than sends. */
export function emailIsSimulated(): boolean {
  return emailProvider()?.name === simulatedProvider.name;
}

export type { EmailMessage, EmailProvider, ProviderResult, SenderIdentity } from './provider';
export { IRON_MILES_MAILBOX } from './resend';
