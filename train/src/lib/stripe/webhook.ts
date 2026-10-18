import type Stripe from 'stripe';

/**
 * The Stripe webhook's work, apart from the request: given a verified event,
 * a Stripe client and a database, bring the subscription and payment rows to
 * the truth. Separate so it can be driven by fakes in tests — the order in
 * which Stripe delivers events is the thing most worth testing.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- a supabase-js client, or a stand-in for one
type Db = any;
type StripeLike = { subscriptions: { retrieve(id: string): Promise<Stripe.Subscription> } };

export async function handleStripeEvent(event: Stripe.Event, stripe: StripeLike, db: Db): Promise<void> {
  // Every write is checked: supabase-js returns errors rather than throwing,
  // and an unchecked failure was answered 200 — so Stripe never retried it.
  const must = <T extends { error: { message: string } | null }>(r: T): T => {
    if (r.error) throw new Error(r.error.message);
    return r;
  };

  /**
   * Write a subscription as Stripe has it now, keyed on Stripe's own id.
   *
   * Events arrive out of order and are retried: subscription.created usually
   * lands before checkout.session.completed, and a late copy of a checkout
   * event used to set a cancelled subscription back to "active". Reading the
   * live object instead of trusting the event's snapshot makes every write
   * the current truth, so order and replays stop mattering.
   */
  async function syncSubscription(id: string, hints: { athleteId?: string | null; packageCode?: string | null } = {}) {
    const sub = await stripe.subscriptions.retrieve(id);
    const existing = must(await db.from('subscriptions').select('athlete_id, package_code').eq('stripe_subscription_id', id).maybeSingle()).data;
    const athleteId = existing?.athlete_id ?? hints.athleteId ?? sub.metadata?.athleteId ?? null;
    if (!athleteId) return; // a subscription this app did not start
    const periodEnd = firstPeriodEnd(sub);
    const price = sub.items?.data?.[0]?.price;
    must(
      await db.from('subscriptions').upsert(
        {
          athlete_id: athleteId,
          package_code: existing?.package_code ?? hints.packageCode ?? sub.metadata?.packageCode ?? 'event_ready',
          status: mapStatus(sub.status, sub.pause_collection != null),
          stripe_customer_id: typeof sub.customer === 'string' ? sub.customer : sub.customer.id,
          stripe_subscription_id: sub.id,
          current_period_end: periodEnd ? new Date(periodEnd * 1000).toISOString() : null,
          cancel_at_period_end: sub.cancel_at_period_end ?? false,
          price_cents: price?.unit_amount ?? 12900,
          currency: price?.currency ?? 'eur',
        },
        { onConflict: 'stripe_subscription_id' },
      ),
    );
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object;
      const subId = typeof s.subscription === 'string' ? s.subscription : s.subscription?.id;
      if (!subId) break;
      await syncSubscription(subId, {
        athleteId: s.client_reference_id ?? s.metadata?.athleteId,
        packageCode: s.metadata?.packageCode,
      });
      break;
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      await syncSubscription(event.data.object.id);
      break;
    }

    case 'invoice.paid':
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice & {
        subscription?: string | { id: string } | null;
        parent?: { subscription_details?: { subscription?: string | { id: string } } | null } | null;
      };
      const ref = invoice.parent?.subscription_details?.subscription ?? invoice.subscription ?? null;
      const subId = typeof ref === 'string' ? ref : ref?.id;
      if (!subId) break;
      // the subscription's own state (past_due after a failure) comes from Stripe
      await syncSubscription(subId);
      const subscription = must(
        await db.from('subscriptions').select('id, athlete_id').eq('stripe_subscription_id', subId).maybeSingle(),
      ).data;
      if (!subscription) break;

      must(
        await db.from('payments').upsert(
          {
            athlete_id: subscription.athlete_id,
            subscription_id: subscription.id,
            stripe_invoice_id: invoice.id,
            amount_cents: invoice.amount_paid ?? invoice.amount_due ?? 0,
            currency: invoice.currency ?? 'eur',
            status: event.type === 'invoice.paid' ? 'paid' : 'failed',
            invoice_url: invoice.hosted_invoice_url ?? null,
            paid_at: event.type === 'invoice.paid' ? new Date(event.created * 1000).toISOString() : null,
          },
          { onConflict: 'stripe_invoice_id' },
        ),
      );

      if (event.type === 'invoice.payment_failed') {
        // once per invoice, however often Stripe retries the event
        const { error } = await db.from('notifications').insert({
          user_id: subscription.athlete_id,
          kind: 'payment_failed',
          title: 'Payment did not go through',
          body: 'Update your card in billing settings to keep coaching active.',
          href: '/app/profile/billing',
          dedupe_key: `payment_failed:${invoice.id}`,
        });
        if (error && error.code !== '23505') throw new Error(error.message);
      }
      break;
    }

    default:
      // unhandled event types are acknowledged rather than retried forever
      break;
  }
}

export function mapStatus(status: Stripe.Subscription.Status, paused: boolean) {
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
export function firstPeriodEnd(sub: Stripe.Subscription): number | null {
  const item = sub.items?.data?.[0] as { current_period_end?: number } | undefined;
  return item?.current_period_end ?? null;
}
