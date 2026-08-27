import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEMO_COACH_ID } from '@/data/demo-seed';
import { DemoRepo, resetDemoData } from './demo-repo.ts';

/**
 * Read, replied, and still a concern — in memory.
 *
 * The Postgres side is supabase/test/checkin-acknowledgement.test.mjs. These
 * are the same claims against the demo adapter, because a coach exploring
 * Iron Miles without a database should not be shown a different set of rules
 * from the one they will get with one.
 */

beforeEach(() => resetDemoData());

async function unread(repo: DemoRepo) {
  const queue = await repo.listCheckInQueue(DEMO_COACH_ID);
  return queue.find((c) => !c.acknowledgedAt) ?? null;
}

describe('demo check-in acknowledgement — parity', () => {
  it('marks one read, recording who and when, with no reply', async () => {
    const repo = new DemoRepo();
    const c = await unread(repo);
    if (!c) return;

    assert.equal(await repo.acknowledgeCheckIn(c.id, DEMO_COACH_ID), true);

    const after = (await repo.listCheckInQueue(DEMO_COACH_ID)).find((x) => x.id === c.id)!;
    assert.ok(after.acknowledgedAt, 'read');
    assert.equal(after.acknowledgedBy, DEMO_COACH_ID, 'and by whom');
    assert.equal(after.respondedAt, null, 'but nothing was said');
    assert.equal(after.coachResponse, null);
  });

  it('is idempotent, and keeps the moment the coach actually looked', async () => {
    const repo = new DemoRepo();
    const c = await unread(repo);
    if (!c) return;

    await repo.acknowledgeCheckIn(c.id, DEMO_COACH_ID);
    const first = (await repo.listCheckInQueue(DEMO_COACH_ID)).find((x) => x.id === c.id)!.acknowledgedAt;

    assert.equal(await repo.acknowledgeCheckIn(c.id, DEMO_COACH_ID), false);
    const second = (await repo.listCheckInQueue(DEMO_COACH_ID)).find((x) => x.id === c.id)!.acknowledgedAt;
    assert.equal(second, first);
  });

  it('replying reads it as well, and keeps the two apart', async () => {
    const repo = new DemoRepo();
    const c = await unread(repo);
    if (!c) return;

    await repo.respondToCheckIn(c.id, DEMO_COACH_ID, 'Good week. Hold the volume.');
    const after = (await repo.listCheckInQueue(DEMO_COACH_ID)).find((x) => x.id === c.id)!;

    assert.ok(after.acknowledgedAt, 'you cannot answer what you have not read');
    assert.ok(after.respondedAt, 'and it is on the record as an answer');
    assert.equal(after.coachResponse, 'Good week. Hold the volume.');
  });

  it('replying after reading keeps the original read time', async () => {
    const repo = new DemoRepo();
    const c = await unread(repo);
    if (!c) return;

    await repo.acknowledgeCheckIn(c.id, DEMO_COACH_ID);
    const read = (await repo.listCheckInQueue(DEMO_COACH_ID)).find((x) => x.id === c.id)!.acknowledgedAt;

    await repo.respondToCheckIn(c.id, DEMO_COACH_ID, 'Following up.');
    const after = (await repo.listCheckInQueue(DEMO_COACH_ID)).find((x) => x.id === c.id)!;
    assert.equal(after.acknowledgedAt, read, 'read then, answered later');
    assert.ok(after.respondedAt);
  });

  it('refuses a coach acknowledging an athlete who is not theirs', async () => {
    const repo = new DemoRepo();
    const c = await unread(repo);
    if (!c) return;
    await assert.rejects(
      () => repo.acknowledgeCheckIn(c.id, 'some-other-coach'),
      /not on your roster/i);
  });

  it('refuses that coach replying to it either', async () => {
    const repo = new DemoRepo();
    const c = await unread(repo);
    if (!c) return;
    await assert.rejects(
      () => repo.respondToCheckIn(c.id, 'some-other-coach', 'Not mine to answer'),
      /not on your roster/i);
  });

  it('refuses a check-in that does not exist', async () => {
    const repo = new DemoRepo();
    await assert.rejects(
      () => repo.acknowledgeCheckIn('no-such-checkin', DEMO_COACH_ID), /No such check-in/i);
  });

  it('takes a read check-in out of the waiting queue', async () => {
    const repo = new DemoRepo();
    const before = (await repo.listCheckInQueue(DEMO_COACH_ID)).filter((c) => !c.acknowledgedAt).length;
    const c = await unread(repo);
    if (!c) return;

    await repo.acknowledgeCheckIn(c.id, DEMO_COACH_ID);
    const after = (await repo.listCheckInQueue(DEMO_COACH_ID)).filter((x) => !x.acknowledgedAt).length;
    assert.equal(after, before - 1, 'which is the whole point of the slice');
  });

  it('keeps a read check-in in the roster\'s flagged signal until it is answered', async () => {
    const repo = new DemoRepo();
    const queue = await repo.listCheckInQueue(DEMO_COACH_ID);
    const flagged = queue.find((c) => !c.acknowledgedAt && c.attentionLevel === 'attention');
    if (!flagged) return;

    await repo.acknowledgeCheckIn(flagged.id, DEMO_COACH_ID);
    const roster = await repo.listRoster(DEMO_COACH_ID, new Date().toISOString().slice(0, 10));
    const entry = roster.find((e) => e.athleteId === flagged.athleteId)!;

    assert.ok(entry.signals.some((s) => s.kind === 'checkin_flagged'),
      'reading it did not settle it');
    assert.ok(!entry.signals.some((s) => s.kind === 'checkin_unreviewed'),
      'but it is no longer waiting to be read');
  });
});
