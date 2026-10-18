import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type Stripe from 'stripe';
import { handleStripeEvent } from './webhook.ts';

/**
 * Stripe delivers events late, twice, and out of order. These drive the
 * handler with a fake Stripe (holding the subscription's real, current state)
 * and an in-memory table store, in the orders that used to go wrong.
 */

type Row = Record<string, unknown>;

function fakeDb(opts: { failOn?: string } = {}) {
  const tables: Record<string, Row[]> = { subscriptions: [], payments: [], notifications: [] };
  let nextId = 1;
  const from = (table: string) => {
    const filters: [string, unknown][] = [];
    const q = {
      select: () => q,
      eq: (col: string, val: unknown) => {
        filters.push([col, val]);
        return q;
      },
      maybeSingle: async () => {
        const hit = tables[table].filter((r) => filters.every(([c, v]) => r[c] === v));
        return { data: hit[0] ?? null, error: null };
      },
      upsert: async (row: Row, { onConflict }: { onConflict: string }) => {
        if (opts.failOn === table) return { error: { message: `${table} is down` } };
        const at = tables[table].findIndex((r) => r[onConflict] === row[onConflict]);
        if (at >= 0) tables[table][at] = { ...tables[table][at], ...row };
        else tables[table].push({ id: `row-${nextId++}`, ...row });
        return { error: null };
      },
      insert: async (row: Row) => {
        const dup = row.dedupe_key && tables[table].some((r) => r.user_id === row.user_id && r.dedupe_key === row.dedupe_key);
        if (dup) return { error: { code: '23505', message: 'duplicate key' } };
        tables[table].push({ id: `row-${nextId++}`, ...row });
        return { error: null };
      },
    };
    return q;
  };
  return { db: { from }, tables };
}

function fakeStripe(state: { status: Stripe.Subscription.Status }) {
  return {
    subscriptions: {
      retrieve: async (id: string) =>
        ({
          id,
          status: state.status,
          customer: 'cus_1',
          metadata: {},
          pause_collection: null,
          cancel_at_period_end: false,
          items: { data: [{ current_period_end: 1_800_000_000, price: { unit_amount: 12900, currency: 'eur' } }] },
        }) as unknown as Stripe.Subscription,
    },
  };
}

const ev = (type: string, object: Row, created = 1_700_000_000) => ({ type, created, data: { object } }) as unknown as Stripe.Event;
const checkout = ev('checkout.session.completed', { subscription: 'sub_1', client_reference_id: 'athlete-1', metadata: { packageCode: 'event_ready' } });

describe('the Stripe webhook, in the orders Stripe really uses', () => {
  it('subscription.created before checkout.session.completed still records the athlete and the period', async () => {
    const { db, tables } = fakeDb();
    const stripe = fakeStripe({ status: 'active' });
    // created carries no athlete; nothing to attach it to yet
    await handleStripeEvent(ev('customer.subscription.created', { id: 'sub_1' }), stripe, db);
    await handleStripeEvent(checkout, stripe, db);
    assert.equal(tables.subscriptions.length, 1);
    assert.equal(tables.subscriptions[0].athlete_id, 'athlete-1');
    assert.ok(tables.subscriptions[0].current_period_end, 'the period end is known');
  });

  it('a late copy of the checkout event does not bring a cancelled subscription back', async () => {
    const { db, tables } = fakeDb();
    const state = { status: 'active' as Stripe.Subscription.Status };
    const stripe = fakeStripe(state);
    await handleStripeEvent(checkout, stripe, db);
    state.status = 'canceled';
    await handleStripeEvent(ev('customer.subscription.deleted', { id: 'sub_1' }), stripe, db);
    await handleStripeEvent(checkout, stripe, db); // retried, arriving last
    assert.equal(tables.subscriptions[0].status, 'canceled');
  });

  it('a failed payment is recorded, marks the subscription past due, and notifies once however often it is retried', async () => {
    const { db, tables } = fakeDb();
    const state = { status: 'active' as Stripe.Subscription.Status };
    const stripe = fakeStripe(state);
    await handleStripeEvent(checkout, stripe, db);
    state.status = 'past_due';
    const failed = ev('invoice.payment_failed', { id: 'in_1', customer: 'cus_1', amount_due: 12900, currency: 'eur', parent: { subscription_details: { subscription: 'sub_1' } } });
    await handleStripeEvent(failed, stripe, db);
    await handleStripeEvent(failed, stripe, db);
    assert.equal(tables.subscriptions[0].status, 'past_due');
    assert.equal(tables.payments.length, 1);
    assert.equal(tables.notifications.length, 1);
  });

  it('a database failure is an error — so the route answers 500 and Stripe retries', async () => {
    const { db } = fakeDb({ failOn: 'subscriptions' });
    await assert.rejects(handleStripeEvent(checkout, fakeStripe({ status: 'active' }), db), /subscriptions is down/);
  });

  it('a resubscription is a second row, and both keep their own state', async () => {
    const { db, tables } = fakeDb();
    const state = { status: 'canceled' as Stripe.Subscription.Status };
    await handleStripeEvent(checkout, fakeStripe(state), db);
    state.status = 'active';
    await handleStripeEvent(ev('checkout.session.completed', { subscription: 'sub_2', client_reference_id: 'athlete-1', metadata: {} }), fakeStripe(state), db);
    assert.deepEqual(tables.subscriptions.map((r) => [r.stripe_subscription_id, r.status]), [['sub_1', 'canceled'], ['sub_2', 'active']]);
  });
});
