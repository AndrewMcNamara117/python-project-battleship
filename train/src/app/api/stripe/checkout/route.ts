import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { siteUrl } from '@/lib/env';
import { rateLimit } from '@/lib/rate-limit';
import { getStripe, priceIdFor, stripeConfigured } from '@/lib/stripe/server';
import { packageByCode } from '@/data/packages';

/**
 * Start a subscription checkout.
 *
 * Prices are resolved server-side from the package code — the client never
 * sends an amount, so a tampered request cannot buy coaching for one cent.
 */
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!rateLimit(`checkout:${session.userId}`, 8, 60 * 60 * 1000)) {
    return NextResponse.json({ error: 'Too many attempts' }, { status: 429 });
  }

  if (!stripeConfigured()) {
    return NextResponse.json(
      { error: 'Billing is not configured on this deployment.' },
      { status: 503 },
    );
  }

  let body: { packageCode?: string; promoCode?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const pkg = packageByCode(body.packageCode ?? 'event_ready');
  if (!pkg || !pkg.available) {
    return NextResponse.json({ error: 'Unknown package' }, { status: 400 });
  }

  const repo = await getRepo();
  const [profile, existing] = await Promise.all([
    repo.getProfile(session.userId),
    repo.getSubscription(session.userId),
  ]);

  const stripe = getStripe();
  const checkout = await stripe.checkout.sessions.create({
    mode: 'subscription',
    line_items: [{ price: priceIdFor(pkg.stripePriceEnv), quantity: 1 }],
    customer: existing?.stripeCustomerId ?? undefined,
    customer_email: existing?.stripeCustomerId ? undefined : (profile?.email ?? session.email),
    allow_promotion_codes: true,
    // the athlete id is the join key the webhook uses; never trust it from the client
    client_reference_id: session.userId,
    subscription_data: {
      metadata: { athleteId: session.userId, packageCode: pkg.code },
    },
    metadata: { athleteId: session.userId, packageCode: pkg.code },
    success_url: `${siteUrl}/app/profile/billing?checkout=success`,
    cancel_url: `${siteUrl}/pricing?checkout=cancelled`,
  });

  return NextResponse.json({ url: checkout.url });
}
