import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getRepo } from '@/lib/data';
import { siteUrl } from '@/lib/env';
import { getStripe, stripeConfigured } from '@/lib/stripe/server';

/** Stripe's own billing portal: cancel, pause, update card, download invoices. */
export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

  if (!stripeConfigured()) {
    return NextResponse.json({ error: 'Billing is not configured on this deployment.' }, { status: 503 });
  }

  const repo = await getRepo();
  const subscription = await repo.getSubscription(session.userId);
  if (!subscription?.stripeCustomerId) {
    return NextResponse.json({ error: 'No billing account yet' }, { status: 404 });
  }

  const stripe = getStripe();
  const portal = await stripe.billingPortal.sessions.create({
    customer: subscription.stripeCustomerId,
    return_url: `${siteUrl}/app/profile/billing`,
  });

  return NextResponse.json({ url: portal.url });
}
