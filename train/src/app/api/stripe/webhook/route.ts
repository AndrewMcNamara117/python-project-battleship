import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase/server';
import { hasSupabase } from '@/lib/env';
import { getStripe, stripeConfigured } from '@/lib/stripe/server';
import { handleStripeEvent } from '@/lib/stripe/webhook';

/**
 * Stripe webhook.
 *
 * Every request is verified against the signing secret before anything is read
 * from it — an unsigned or mis-signed body is rejected outright, so this
 * endpoint cannot be used to grant somebody a subscription by POSTing JSON.
 * Writes use the service-role client because there is no user session here;
 * that client is constructed only after the signature has passed.
 */
export async function POST(request: Request) {
  if (!stripeConfigured()) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret not configured' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 });

  const raw = await request.text();
  const stripe = getStripe();

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Signature verification failed';
    return NextResponse.json({ error: message }, { status: 400 });
  }

  if (!hasSupabase) {
    // verified but nowhere to persist it — acknowledge so Stripe stops retrying
    return NextResponse.json({ received: true, persisted: false });
  }

  try {
    await handleStripeEvent(event, stripe, createAdminSupabase());
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handling failed';
    // 500 tells Stripe to retry, which is what we want for a transient DB error
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
