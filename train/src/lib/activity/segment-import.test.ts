import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEMO_ATHLETE_ID } from '@/data/demo-seed';
import { DemoRepo, resetDemoData } from '@/lib/data/demo-repo';
import { addDays, toISODate } from '@/lib/domain/dates';
import type { Profile } from '@/lib/domain/types';
import { syntheticRun, toFit } from './fixtures.ts';
import { importActivity } from './service.ts';

/** Segment timing through the import, against the demo's canal segment. */

beforeEach(() => resetDemoData());

const CANAL: [number, number] = [52.6593, -8.6105];
const canalRun = (daysAhead: number, pace: number) =>
  toFit(syntheticRun({ start: `${addDays(toISODate(new Date()), daysAhead)}T07:00:00Z`, distanceKm: 10, paceSecPerKm: pace, intervalS: 1, centre: CANAL }));

async function athlete(repo: DemoRepo) {
  return (await repo.getProfile(DEMO_ATHLETE_ID)) as Profile;
}

describe('segments through the import', () => {
  it('a run over the canal is timed on the canal segment', async () => {
    const repo = new DemoRepo();
    const out = await importActivity(repo, await athlete(repo), canalRun(400, 300));
    assert.notEqual(out.status, 'duplicate');
    const timed = out.segments?.find((s) => s.segmentId === 'seg-canal-drag');
    assert.ok(timed, 'timed');
    assert.ok(Math.abs(timed.elapsedS - 600) <= 12, `got ${timed.elapsedS}`);
    assert.equal(timed.personalBest, false, 'a first effort is not announced as a best');
    assert.equal((await repo.listEffortsForActivity(out.activity.id)).length, 1);
  });

  it('a faster second run is a personal best; a slower third is not', async () => {
    const repo = new DemoRepo();
    const me = await athlete(repo);
    await importActivity(repo, me, canalRun(401, 310));
    const faster = await importActivity(repo, me, canalRun(402, 280));
    assert.equal(faster.segments?.find((s) => s.segmentId === 'seg-canal-drag')?.personalBest, true);
    const slower = await importActivity(repo, me, canalRun(403, 330));
    assert.equal(slower.segments?.find((s) => s.segmentId === 'seg-canal-drag')?.personalBest, false);
    assert.equal((await repo.listEfforts(DEMO_ATHLETE_ID, 'seg-canal-drag')).length >= 3, true);
  });

  it('without the server writer the run imports and nothing is timed', async () => {
    const repo = new DemoRepo();
    const out = await importActivity(repo, await athlete(repo), canalRun(404, 300), null);
    assert.ok(await repo.getActivity(out.activity.id), 'the import itself succeeded');
    assert.deepEqual(out.segments, []);
    assert.equal((await repo.listEffortsForActivity(out.activity.id)).length, 0);
  });

  it('an unshared run’s time is the athlete’s, not the club board’s', async () => {
    const repo = new DemoRepo();
    const out = await importActivity(repo, await athlete(repo), canalRun(405, 200));
    const board = await repo.getSegmentLeaders('seg-canal-drag');
    assert.ok(!board.some((b) => b.activityId === out.activity.id), 'not shared, not on the board');
    await repo.updateActivity(out.activity.id, { visibility: 'club' });
    const after = await repo.getSegmentLeaders('seg-canal-drag');
    assert.equal(after[0].activityId, out.activity.id, 'shared, and fastest');
  });

  it('deleting the activity removes its times', async () => {
    const repo = new DemoRepo();
    const out = await importActivity(repo, await athlete(repo), canalRun(406, 300));
    await repo.deleteActivity(out.activity.id);
    assert.equal((await repo.listEffortsForActivity(out.activity.id)).length, 0);
  });

  it('only staff draw a segment', async () => {
    const repo = new DemoRepo();
    const s = (await repo.listSegments())[0];
    await assert.rejects(repo.createSegment({ name: 'Mine', description: '', route: s.route, distanceM: s.distanceM, createdBy: DEMO_ATHLETE_ID }));
    const made = await repo.createSegment({ name: 'Coach drawn', description: '', route: s.route, distanceM: s.distanceM, createdBy: 'demo-coach' });
    assert.ok((await repo.listSegments()).some((x) => x.id === made.id));
    await repo.setSegmentArchived(made.id, true);
    assert.ok(!(await repo.listSegments()).some((x) => x.id === made.id), 'archived segments leave the list');
  });
});

describe('records through the import', () => {
  const run = (daysAhead: number, km: number, pace: number) =>
    toFit(syntheticRun({ start: `${addDays(toISODate(new Date()), daysAhead)}T07:00:00Z`, distanceKm: km, paceSecPerKm: pace, intervalS: 1 }));

  it('stores best efforts, and announces a record only when it beats an earlier time', async () => {
    const repo = new DemoRepo();
    const me = await athlete(repo);
    const first = await importActivity(repo, me, run(600, 6, 320));
    assert.ok((await repo.getActivity(first.activity.id))?.bestEfforts.some((e) => e.key === '5k'));
    // slower than the seeded runs (built through the same pipeline, best 279 s/km): no record
    assert.deepEqual(first.records, []);

    const faster = await importActivity(repo, me, run(601, 6, 260));
    assert.deepEqual(faster.records?.map((r) => r.label), ['1K', 'Mile', '5K']);
    assert.ok(faster.records!.every((r) => r.elapsedS < r.previousS));

    const slower = await importActivity(repo, me, run(602, 6, 330));
    assert.deepEqual(slower.records, []);
  });

  it('deleting the record-setting run hands the record back', async () => {
    const repo = new DemoRepo();
    const me = await athlete(repo);
    const best = await importActivity(repo, me, run(611, 5.2, 255));
    await repo.deleteActivity(best.activity.id);
    // 265 s/km would not beat 255, but 255 is gone; it beats the seeded 279
    const again = await importActivity(repo, me, run(612, 5.2, 265));
    assert.deepEqual(again.records?.map((r) => r.label), ['1K', 'Mile', '5K']);
  });
});
