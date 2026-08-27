import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEMO_COACH_ID } from '@/data/demo-seed';
import { DemoRepo, resetDemoData } from './demo-repo.ts';

/**
 * The demo batch record must behave the way Postgres does, because a coach
 * exploring Iron Miles without a database should not be shown a safety
 * guarantee they will not get with one. The Postgres side is
 * supabase/test/batch.test.mjs; these are the same claims in memory.
 */

beforeEach(() => resetDemoData());

describe('demo batches — parity', () => {
  it('opens a batch that belongs to the coach', async () => {
    const repo = new DemoRepo();
    const id = await repo.openBatch('scale_volume', { factor: 0.9 }, 3);
    assert.ok(id);
  });

  it('records one athlete at a time', async () => {
    const repo = new DemoRepo();
    const [athlete] = await repo.listAthletesForCoach(DEMO_COACH_ID);
    const batch = await repo.openBatch('scale_volume', { factor: 0.9 }, 1);

    await repo.recordBatchItem(batch, athlete.id, 'applied', '3 sessions adjusted.');
    const history = await repo.listBatchHistory(athlete.id);

    assert.equal(history.length, 1);
    assert.equal(history[0].outcome, 'applied');
    assert.equal(history[0].athleteCount, 1);
    assert.match(history[0].detail ?? '', /3 sessions/);
  });

  it('refuses an athlete who is not on the roster', async () => {
    // one authorised id never vouches for the rest of a list
    const repo = new DemoRepo();
    const batch = await repo.openBatch('scale_volume', {}, 2);

    await assert.rejects(
      () => repo.recordBatchItem(batch, 'not-my-athlete', 'applied', 'smuggled'),
      /not on your roster/i);
  });

  it('still records that an unauthorised athlete was attempted', async () => {
    // a poisoned id must be reported, not silently dropped from the record
    const repo = new DemoRepo();
    const batch = await repo.openBatch('scale_volume', {}, 2);

    await repo.recordBatchItem(batch, 'not-my-athlete', 'unauthorised', 'Not on your roster.');
    const history = await repo.listBatchHistory('not-my-athlete');

    assert.equal(history.length, 1);
    assert.equal(history[0].outcome, 'unauthorised');
  });

  it('refuses a record against a batch that does not exist', async () => {
    const repo = new DemoRepo();
    await assert.rejects(
      () => repo.recordBatchItem('no-such-batch', 'a1', 'applied', ''),
      /No such batch/i);
  });

  it('reports the same athlete once when a batch is retried', async () => {
    const repo = new DemoRepo();
    const [athlete] = await repo.listAthletesForCoach(DEMO_COACH_ID);
    const batch = await repo.openBatch('shift_sessions', { days: 1 }, 1);

    await repo.recordBatchItem(batch, athlete.id, 'failed', 'timed out');
    await repo.recordBatchItem(batch, athlete.id, 'applied', 'worked second time');

    const history = await repo.listBatchHistory(athlete.id);
    assert.equal(history.length, 1, 'one row per athlete per batch');
    assert.equal(history[0].outcome, 'applied', 'the latest outcome wins');
    assert.equal(history[0].athleteCount, 1);
  });

  it('counts everyone in the batch, not just the athlete asking', async () => {
    const repo = new DemoRepo();
    const [a, b] = await repo.listAthletesForCoach(DEMO_COACH_ID);
    const batch = await repo.openBatch('scale_volume', { factor: 0.9 }, 2);

    await repo.recordBatchItem(batch, a.id, 'applied', 'done');
    await repo.recordBatchItem(batch, b.id, 'applied', 'done');

    const history = await repo.listBatchHistory(a.id);
    assert.equal(history[0].athleteCount, 2,
      'so a coach can see the change was part of a squad-wide decision');
  });

  it('shows an athlete only the batches that touched them', async () => {
    const repo = new DemoRepo();
    const [a, b] = await repo.listAthletesForCoach(DEMO_COACH_ID);
    const batch = await repo.openBatch('scale_volume', {}, 1);
    await repo.recordBatchItem(batch, a.id, 'applied', 'done');

    assert.equal((await repo.listBatchHistory(a.id)).length, 1);
    assert.equal((await repo.listBatchHistory(b.id)).length, 0);
  });

  it('keeps what the coach chose, so the record reads back later', async () => {
    const repo = new DemoRepo();
    const [athlete] = await repo.listAthletesForCoach(DEMO_COACH_ID);
    const batch = await repo.openBatch(
      'scale_volume', { factor: 0.9, described: '90% of prescribed distance' }, 1);
    await repo.recordBatchItem(batch, athlete.id, 'applied', 'done');

    const [row] = await repo.listBatchHistory(athlete.id);
    assert.equal(row.action, 'scale_volume');
    assert.match(String(row.params.described), /90%/);
  });

  it('returns the newest batch first', async () => {
    const repo = new DemoRepo();
    const [athlete] = await repo.listAthletesForCoach(DEMO_COACH_ID);

    const first = await repo.openBatch('scale_volume', {}, 1);
    await repo.recordBatchItem(first, athlete.id, 'applied', 'the older one');
    await new Promise((r) => setTimeout(r, 5));
    const second = await repo.openBatch('shift_sessions', {}, 1);
    await repo.recordBatchItem(second, athlete.id, 'applied', 'the newer one');

    const history = await repo.listBatchHistory(athlete.id);
    assert.equal(history[0].action, 'shift_sessions');
    assert.equal(history.length, 2);
  });
});
