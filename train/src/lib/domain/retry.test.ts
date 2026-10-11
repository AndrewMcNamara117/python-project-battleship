import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { decideRetry, idempotencyKeyFor, MAX_ATTEMPTS } from './retry.ts';

const NOW = new Date('2026-09-16T07:00:00Z');
const secondsUntil = (iso: string | null) =>
  iso === null ? null : Math.round((new Date(iso).getTime() - NOW.getTime()) / 1000);

describe('when to try again', () => {
  it('backs off further each time rather than hammering', () => {
    assert.equal(secondsUntil(decideRetry(0, false, undefined, NOW).nextAttemptAt), 60);
    assert.equal(secondsUntil(decideRetry(1, false, undefined, NOW).nextAttemptAt), 300);
    assert.equal(secondsUntil(decideRetry(2, false, undefined, NOW).nextAttemptAt), 1800);
  });

  it('stops, rather than retrying for ever', () => {
    const last = decideRetry(MAX_ATTEMPTS - 1, false, undefined, NOW);
    assert.equal(last.state, 'failed_permanent');
    assert.equal(last.nextAttemptAt, null);
    assert.match(last.note, /Gave up after 4 attempts/);
  });

  it('does not retry something that will fail identically every time', () => {
    // a rejected address or an unverified sender. Four goes at it would bury
    // the real problem under four identical log lines.
    const decision = decideRetry(0, true, undefined, NOW);
    assert.equal(decision.state, 'failed_permanent');
    assert.equal(decision.nextAttemptAt, null);
    assert.match(decision.note, /fail the same way every time/);
  });

  it('honours the provider\'s own rate-limit hint over the schedule', () => {
    assert.equal(secondsUntil(decideRetry(0, false, 45, NOW).nextAttemptAt), 45);
    assert.equal(secondsUntil(decideRetry(0, false, 900, NOW).nextAttemptAt), 900);
  });

  it('will not let a provider push the next attempt beyond an hour', () => {
    assert.equal(secondsUntil(decideRetry(0, false, 86_400, NOW).nextAttemptAt), 3600);
  });

  it('ignores a nonsense hint', () => {
    assert.equal(secondsUntil(decideRetry(0, false, 0, NOW).nextAttemptAt), 60);
    assert.equal(secondsUntil(decideRetry(0, false, -5, NOW).nextAttemptAt), 60);
  });

  it('says where it is in the schedule, so the record explains itself', () => {
    assert.match(decideRetry(0, false, undefined, NOW).note, /Attempt 1 of 4/);
    assert.match(decideRetry(1, false, undefined, NOW).note, /5 minutes/);
  });

  it('finishes the whole schedule inside about forty minutes', () => {
    // an urgent alert that eventually succeeds must not first arrive tomorrow
    const total = [0, 1, 2]
      .map((n) => secondsUntil(decideRetry(n, false, undefined, NOW).nextAttemptAt)!)
      .reduce((a, b) => a + b, 0);
    assert.ok(total <= 2400, `${total}s`);
  });
});

describe('not sending the same email twice', () => {
  it('keys on the delivery, which survives a restart', () => {
    assert.equal(idempotencyKeyFor('abc'), 'im-delivery-abc');
    assert.equal(idempotencyKeyFor('abc'), idempotencyKeyFor('abc'), 'stable across retries');
    assert.notEqual(idempotencyKeyFor('abc'), idempotencyKeyFor('def'));
  });
});
