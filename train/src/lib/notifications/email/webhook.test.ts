import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { describe, it } from 'node:test';
import { readResendEvent, verifyResendSignature } from './webhook.ts';

/**
 * A webhook endpoint that accepts unsigned claims about delivery is worse than
 * no webhook at all: it would let anyone mark any email as delivered, and
 * "delivered" is the strongest thing this product says about reaching a coach.
 */

const SECRET = `whsec_${Buffer.from('a-shared-secret-for-tests').toString('base64')}`;
const NOW = new Date('2026-09-16T07:00:00Z');
const TS = String(Math.floor(NOW.getTime() / 1000));

function sign(body: string, id = 'msg_1', timestamp = TS, secret = SECRET): string {
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  return `v1,${createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest('base64')}`;
}

const BODY = JSON.stringify({ type: 'email.delivered', data: { email_id: 'abc' } });

describe('verifying a delivery webhook', () => {
  it('accepts a correctly signed event', () => {
    const result = verifyResendSignature(BODY,
      { id: 'msg_1', timestamp: TS, signature: sign(BODY) }, SECRET, NOW);
    assert.deepEqual(result, { ok: true });
  });

  it('refuses one signed with a different secret', () => {
    const other = `whsec_${Buffer.from('not-the-secret').toString('base64')}`;
    const result = verifyResendSignature(BODY,
      { id: 'msg_1', timestamp: TS, signature: sign(BODY, 'msg_1', TS, other) }, SECRET, NOW);
    assert.equal(result.ok, false);
  });

  it('refuses one whose body was altered after signing', () => {
    const signature = sign(BODY);
    const tampered = JSON.stringify({ type: 'email.delivered', data: { email_id: 'someone-else' } });
    const result = verifyResendSignature(tampered,
      { id: 'msg_1', timestamp: TS, signature }, SECRET, NOW);
    assert.equal(result.ok, false);
  });

  it('refuses a replay of a real event from an hour ago', () => {
    const old = String(Math.floor(NOW.getTime() / 1000) - 3600);
    const result = verifyResendSignature(BODY,
      { id: 'msg_1', timestamp: old, signature: sign(BODY, 'msg_1', old) }, SECRET, NOW);
    assert.equal(result.ok, false);
    assert.match(result.ok === false ? result.reason : '', /tolerance/);
  });

  it('refuses a request with no signature at all', () => {
    const result = verifyResendSignature(BODY,
      { id: null, timestamp: null, signature: null }, SECRET, NOW);
    assert.equal(result.ok, false);
    assert.match(result.ok === false ? result.reason : '', /Missing/);
  });

  it('accepts when one of several offered signatures matches', () => {
    // what a secret rotation looks like in flight
    const header = `v1,AAAA${' '}${sign(BODY)}`;
    const result = verifyResendSignature(BODY,
      { id: 'msg_1', timestamp: TS, signature: header }, SECRET, NOW);
    assert.equal(result.ok, true);
  });

  it('ignores signature versions it does not know', () => {
    const result = verifyResendSignature(BODY,
      { id: 'msg_1', timestamp: TS, signature: `v2,${sign(BODY).slice(3)}` }, SECRET, NOW);
    assert.equal(result.ok, false);
  });
});

describe('reading a delivery webhook', () => {
  it('reads the four events Iron Miles acts on', () => {
    for (const [type, status] of [
      ['email.delivered', 'delivered'],
      ['email.bounced', 'bounced'],
      ['email.complained', 'complained'],
      ['email.delivery_delayed', 'delayed'],
    ] as const) {
      const event = readResendEvent({ type, data: { email_id: 'abc' } });
      assert.equal(event?.status, status, type);
      assert.equal(event?.messageId, 'abc');
    }
  });

  it('ignores email.sent, which the worker already recorded more precisely', () => {
    assert.equal(readResendEvent({ type: 'email.sent', data: { email_id: 'abc' } }), null);
  });

  it('carries the provider\'s bounce reason so the record explains itself', () => {
    const event = readResendEvent({
      type: 'email.bounced',
      data: { email_id: 'abc', bounce: { message: 'Mailbox does not exist' } },
    });
    assert.match(event!.detail, /Mailbox does not exist/);
  });

  it('ignores anything without a message id, which it could not act on', () => {
    assert.equal(readResendEvent({ type: 'email.delivered', data: {} }), null);
    assert.equal(readResendEvent({ type: 'email.delivered' }), null);
    assert.equal(readResendEvent(null), null);
    assert.equal(readResendEvent('not an object'), null);
  });
});
