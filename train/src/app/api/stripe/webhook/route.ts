import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { createAdminSupabase } from '@/lib/supabase/server';
import { hasSupabase } from '@/lib/env';
import { getStripe, stripeConfigured } from '@/lib/stripe/server';

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

  const db = createAdminSupabase();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const s = event.data.object;
        const athleteId = s.client_reference_id ?? s.metadata?.athleteId;
        if (!athleteId) break;

        await db.from('subscriptions').upsert(
          {
            athlete_id: athleteId,
            package_code: s.metadata?.packageCode ?? 'event_ready',
            status: 'active',
            stripe_customer_id: typeof s.customer === 'string' ? s.customer : null,
            stripe_subscription_id: typeof s.subscription === 'string' ? s.subscription : null,
            price_cents: s.amount_total ?? 12900,
            currency: s.currency ?? 'eur',
          },
          { onConflict: 'stripe_subscription_id' },
        );
        break;
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const athleteId = sub.metadata?.athleteId;
        const periodEnd = firstPeriodEnd(sub);

        await db
          .from('subscriptions')
          .update({
            status: mapStatus(sub.status, sub.pause_collection != null),
            current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
            cancel_at_period_end: sub.cancel_at_period_end ?? false,
          })
          .eq(
            athleteId ? 'athlete_id' : 'stripe_subscription_id',
            athleteId ?? sub.id,
          );
        break;
      }

      case 'invoice.paid':
      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
        if (!customerId) break;

        const { data: subscription } = await db
          .from('subscriptions')
          .select('id, athlete_id')
          .eq('stripe_customer_id', customerId)
          .maybeSingle();
        if (!subscription) break;

        await db.from('payments').upsert(
          {
            athlete_id: subscription.athlete_id,
            subscription_id: subscription.id,
            stripe_invoice_id: invoice.id,
            amount_cents: invoice.amount_paid ?? invoice.amount_due ?? 0,
            currency: invoice.currency ?? 'eur',
            status: event.type === 'invoice.paid' ? 'paid' : 'failed',
            invoice_url: invoice.hosted_invoice_url ?? null,
            paid_at: event.type === 'invoice.paid' ? new Date().toISOString() : null,
          },
          { onConflict: 'stripe_invoice_id' },
        );

        if (event.type === 'invoice.payment_failed') {
          await db.from('subscriptions').update({ status: 'past_due' }).eq('id', subscription.id);
          await db.from('notifications').insert({
            user_id: subscription.athlete_id,
            kind: 'payment_failed',
            title: 'Payment did not go through',
            body: 'Update your card in billing settings to keep coaching active.',
            href: '/app/profile/billing',
          });
        }
        break;
      }

      default:
        // unhandled event types are acknowledged rather than retried forever
        break;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook handling failed';
    // 500 tells Stripe to retry, which is what we want for a transient DB error
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}

function mapStatus(status: Stripe.Subscription.Status, paused: boolean) {
  if (paused) return 'paused';
  switch (status) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    default:
      return 'incomplete';
  }
}

/** Period end moved onto subscription items in recent API versions. */
function firstPeriodEnd(sub: Stripe.Subscription): number | null {
  const item = sub.items?.data?.[0] as { current_period_end?: number } | undefined;
  return item?.current_period_end ?? null;
}
