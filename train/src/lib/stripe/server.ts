import 'server-only';
import Stripe from 'stripe';

/**
 * Server-side Stripe client.
 *
 * Constructed lazily so a deployment without billing configured still builds
 * and runs — the secret key is never read at module load, and never reaches a
 * client bundle (`server-only` makes importing this from a client component a
 * build error rather than a leak).
 */
let cached: Stripe | null = null;

export function getStripe(): Stripe {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  cached = new Stripe(key, { apiVersion: '2025-10-29.clover', typescript: true });
  return cached;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Resolve a package's Stripe price id from the env var its definition names. */
export function priceIdFor(envName: string): string {
  const id = process.env[envName];
  if (!id) throw new Error(`Missing Stripe price id: set ${envName}`);
  return id;
}
