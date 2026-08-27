import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { createTestDatabase } from './harness.mjs';

/**
 * EXTERNAL DELIVERY, AGAINST REAL POSTGRES.
 *
 * Once a real provider is in the loop, the delivery record stops being a
 * bookkeeping detail and becomes the only evidence Iron Miles has that it
 * reached anyone. So the things asserted here are the things that would make
 * that evidence worthless: someone other than the worker writing to it, a
 * webhook resurrecting a dead delivery, or one coach seeing another's.
 */

let t, coachA, coachB, athleteA, outsider;

before(async () => {
  t = await createTestDatabase();

  coachA = await t.signUp('coach.a@ironmiles.ie', 'Coach A');
  coachB = await t.signUp('coach.b@ironmiles.ie', 'Coach B');
  await t.setRole(coachA, 'coach');
  await t.setRole(coachB, 'coach');

  athleteA = await t.signUp('athlete.a@ironmiles.ie', 'Athlete A');
  outsider = await t.signUp('outsider@ironmiles.ie', 'Outsider');

  await t.asService(
    `insert into coach_athlete_links (coach_id, athlete_id, status) values ($1,$2,'active')`,
    [coachA, athleteA]);
});

after(() => t.close());

/** A notification with one email delivery queued, and that delivery's id. */
async function queueEmail(user, key) {
  const { rows } = await t.asService(
    `select im_notify($1,'digest','information','D','b','/coach',$2,null,null,null,null,array['email']) as id`,
    [user, key]);
  const del = await t.asService(
    `select id from notification_deliveries where notification_id = $1`, [rows[0].id]);
  return del.rows[0].id;
}

describe('recording a send attempt', () => {
  it('keeps everything needed to answer what happened', async () => {
    const id = await queueEmail(coachA, 'attempt:1');
    await t.asService(
      `select im_record_attempt($1,'sent','Accepted by Resend.','resend','msg_one',null)`, [id]);

    const { rows } = await t.asService(
      `select state, provider, provider_message_id, attempts, attempted_at, delivered_at
         from notification_deliveries where id = $1`, [id]);

    assert.equal(rows[0].state, 'sent', 'accepted is a handoff, not a delivery');
    assert.equal(rows[0].provider, 'resend');
    assert.equal(rows[0].provider_message_id, 'msg_one');
    assert.equal(rows[0].attempts, 1);
    assert.ok(rows[0].attempted_at);
    assert.equal(rows[0].delivered_at, null, 'nothing is stamped delivered on a handoff');
  });

  it('sets a backoff on a retryable failure and clears it on success', async () => {
    const id = await queueEmail(coachA, 'attempt:2');
    await t.asService(
      `select im_record_attempt($1,'failed','timed out','resend',null, now() + interval '5 minutes')`, [id]);

    let { rows } = await t.asService(
      `select state, next_attempt_at > now() as waiting from notification_deliveries where id = $1`, [id]);
    assert.equal(rows[0].state, 'failed');
    assert.equal(rows[0].waiting, true);

    await t.asService(
      `select im_record_attempt($1,'sent','Accepted.','resend','msg_two',null)`, [id]);
    ({ rows } = await t.asService(
      `select state, next_attempt_at, attempts from notification_deliveries where id = $1`, [id]));
    assert.equal(rows[0].next_attempt_at, null, 'no longer waiting on anything');
    assert.equal(rows[0].attempts, 2, 'and both attempts are on the record');
  });

  it('never loses a message id to a later failed attempt', async () => {
    // the provider accepted it, then the worker died before recording that.
    // The id is the only handle a webhook has, so it must survive.
    const id = await queueEmail(coachA, 'attempt:3');
    await t.asService(`select im_record_attempt($1,'sent','ok','resend','msg_three',null)`, [id]);
    await t.asService(`select im_record_attempt($1,'failed','timed out','resend',null,null)`, [id]);

    const { rows } = await t.asService(
      `select provider_message_id from notification_deliveries where id = $1`, [id]);
    assert.equal(rows[0].provider_message_id, 'msg_three');
  });

  it('refuses a coach recording their own delivery as sent', async () => {
    const id = await queueEmail(coachA, 'attempt:4');
    const message = await t.expectRefused(coachA,
      `select im_record_attempt($1,'delivered','I got it','resend','forged',null)`, [id]);
    assert.match(message ?? '', /delivery worker/i);

    const { rows } = await t.asService(
      `select state, provider_message_id from notification_deliveries where id = $1`, [id]);
    assert.equal(rows[0].state, 'pending');
    assert.equal(rows[0].provider_message_id, null);
  });

  it('refuses an outsider entirely', async () => {
    const id = await queueEmail(coachA, 'attempt:5');
    assert.ok(await t.expectRefused(outsider,
      `select im_record_attempt($1,'delivered','forged')`, [id]));
  });
});

describe('what the provider says afterwards', () => {
  it('moves sent to delivered, once', async () => {
    const id = await queueEmail(coachA, 'hook:1');
    await t.asService(`select im_record_attempt($1,'sent','ok','resend','hook_one',null)`, [id]);

    const first = await t.asService(`select im_record_provider_status('hook_one','delivered') as changed`);
    assert.equal(first.rows[0].changed, true);

    const { rows } = await t.asService(
      `select state, delivered_at is not null as stamped, provider_status
         from notification_deliveries where id = $1`, [id]);
    assert.equal(rows[0].state, 'delivered');
    assert.equal(rows[0].stamped, true);
    assert.equal(rows[0].provider_status, 'delivered');

    const again = await t.asService(`select im_record_provider_status('hook_one','delivered') as changed`);
    assert.equal(again.rows[0].changed, false, 'a duplicate event changes nothing');
  });

  it('will not let a late bounce undo a delivery', async () => {
    // webhooks arrive out of order; state only ever moves forwards
    const late = await t.asService(`select im_record_provider_status('hook_one','bounced') as changed`);
    assert.equal(late.rows[0].changed, false);

    const { rows } = await t.asService(
      `select state from notification_deliveries where provider_message_id = 'hook_one'`);
    assert.equal(rows[0].state, 'delivered');
  });

  it('turns a bounce into a permanent failure, never a retry', async () => {
    const id = await queueEmail(coachA, 'hook:2');
    await t.asService(`select im_record_attempt($1,'sent','ok','resend','hook_two',null)`, [id]);
    await t.asService(
      `select im_record_provider_status('hook_two','bounced','Mailbox does not exist')`);

    const { rows } = await t.asService(
      `select state, detail, next_attempt_at from notification_deliveries where id = $1`, [id]);
    assert.equal(rows[0].state, 'failed_permanent');
    assert.match(rows[0].detail, /Mailbox does not exist/);
    assert.equal(rows[0].next_attempt_at, null, 'and it is not queued for another go');
  });

  it('treats a spam complaint the same way', async () => {
    const id = await queueEmail(coachA, 'hook:3');
    await t.asService(`select im_record_attempt($1,'sent','ok','resend','hook_three',null)`, [id]);
    await t.asService(`select im_record_provider_status('hook_three','complained')`);

    const { rows } = await t.asService(
      `select state from notification_deliveries where id = $1`, [id]);
    assert.equal(rows[0].state, 'failed_permanent');
  });

  it('records a delay without changing the delivery\'s state', async () => {
    const id = await queueEmail(coachA, 'hook:4');
    await t.asService(`select im_record_attempt($1,'sent','ok','resend','hook_four',null)`, [id]);
    const result = await t.asService(
      `select im_record_provider_status('hook_four','delivery_delayed') as changed`);

    assert.equal(result.rows[0].changed, false);
    const { rows } = await t.asService(
      `select state, provider_status from notification_deliveries where id = $1`, [id]);
    assert.equal(rows[0].state, 'sent', 'still in flight');
    assert.equal(rows[0].provider_status, 'delivery_delayed', 'but the report is on the record');
  });

  it('ignores an event for a message this deployment never sent', async () => {
    // a rebuilt environment should not make the provider retry for ever
    const result = await t.asService(
      `select im_record_provider_status('never-sent-this','delivered') as changed`);
    assert.equal(result.rows[0].changed, false);
  });

  it('refuses a signed-in user posting provider status', async () => {
    assert.ok(await t.expectRefused(coachA,
      `select im_record_provider_status('hook_two','delivered')`));
    assert.ok(await t.expectRefused(outsider,
      `select im_record_provider_status('hook_two','delivered')`));
  });
});

describe('one coach never sees another\'s mail', () => {
  before(async () => {
    const id = await queueEmail(coachB, 'b:1');
    await t.asService(`select im_record_attempt($1,'sent','ok','resend','b_message',null)`, [id]);
  });

  it('shows a coach only their own delivery rows', async () => {
    const mine = await t.asUser(coachA,
      `select count(*)::int n from notification_deliveries`);
    const theirs = await t.asUser(coachA,
      `select count(*)::int n from notification_deliveries where user_id = $1`, [coachB]);
    const all = await t.asService(`select count(*)::int n from notification_deliveries`);

    assert.ok(mine.rows[0].n > 0);
    assert.equal(theirs.rows[0].n, 0);
    assert.ok(all.rows[0].n > mine.rows[0].n, 'there is more in the table than coach A can see');
  });

  it('hides another coach\'s provider message ids', async () => {
    const { rows } = await t.asUser(coachA,
      `select count(*)::int n from notification_deliveries where provider_message_id = 'b_message'`);
    assert.equal(rows[0].n, 0, 'a message id is a handle to someone else\'s mail');
  });

  it('shows an athlete no delivery rows at all', async () => {
    const { rows } = await t.asUser(athleteA, `select count(*)::int n from notification_deliveries`);
    assert.equal(rows[0].n, 0);
  });

  it('refuses a coach writing to another coach\'s delivery row', async () => {
    const { rows } = await t.asService(
      `select id from notification_deliveries where provider_message_id = 'b_message'`);
    assert.ok(await t.expectRefused(coachA,
      `select im_record_attempt($1,'delivered','forged')`, [rows[0].id]));
  });
});
