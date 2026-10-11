/**
 * Coaching packages.
 *
 * One tier ships today. The shape is deliberately a list so additional tiers —
 * a group option, a race-block one-off, a strength-only plan — drop in without
 * touching the pricing page, the checkout route or the Stripe handler. Each
 * tier maps to one Stripe price via `stripePriceEnv`.
 */
export interface CoachingPackage {
  code: string;
  name: string;
  position: string;
  priceCents: number;
  currency: 'eur';
  interval: 'month';
  /** Name of the env var holding this tier's Stripe price id. */
  stripePriceEnv: string;
  badge: string | null;
  summary: string;
  includes: string[];
  notIncluded?: string[];
  available: boolean;
  /** Founding-athlete framing: a real cap, shown honestly. */
  foundingSpots?: { total: number; remaining: number };
}

export const PACKAGES: CoachingPackage[] = [
  {
    code: 'event_ready',
    name: 'Event Ready Coaching',
    position: 'You pick the start line. We get you there.',
    priceCents: 12900,
    currency: 'eur',
    interval: 'month',
    stripePriceEnv: 'STRIPE_PRICE_EVENT_READY',
    badge: 'Founding athlete rate',
    summary:
      'One-to-one endurance coaching with the full training hub behind it. Built around one goal and adjusted every week as you respond to it.',
    includes: [
      'A personalised training plan, written for your goal and your week',
      'Running and endurance programming, adjusted weekly',
      'A strength and conditioning plan that fits around the running',
      'Progress tracking across volume, pace, effort and consistency',
      'Race preparation and pacing strategy',
      'Weekly check-ins reviewed by a human coach',
      'Direct coach messaging',
      'Full access to the Iron Miles Training Hub',
      'FORGE, the daily training assistant',
    ],
    available: true,
    foundingSpots: { total: 20, remaining: 7 },
  },
];

export function packageByCode(code: string): CoachingPackage | undefined {
  return PACKAGES.find((p) => p.code === code);
}

export function formatPrice(cents: number, currency = 'eur'): string {
  return new Intl.NumberFormat('en-IE', {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
  }).format(cents / 100);
}
