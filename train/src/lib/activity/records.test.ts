import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cumulativeDistance } from './analyse.ts';
import { syntheticRun } from './fixtures.ts';
import { bestEfforts, bestOver, newRecords, personalRecords } from './records.ts';
import type { TrackPoint } from './types.ts';

const START = '2026-10-10T07:00:00Z';

/** Stitch runs end to end, so pace can change part-way. */
function stitched(parts: { km: number; pace: number }[]): TrackPoint[] {
  const out: TrackPoint[] = [];
  let t = Date.parse(START);
  let d = 0;
  for (const p of parts) {
    const seg = syntheticRun({ start: new Date(t).toISOString(), distanceKm: p.km, paceSecPerKm: p.pace, intervalS: 1 });
    const from = out.length ? 1 : 0;
    for (const pt of seg.slice(from)) out.push({ ...pt, dist: (pt.dist as number) + d });
    t = seg[seg.length - 1].t as number;
    d += p.km * 1000;
  }
  return out;
}

const time = (pts: TrackPoint[], key: string, sport: 'run' | 'ride' | 'walk' = 'run') =>
  bestEfforts(pts, cumulativeDistance(pts), sport).find((e) => e.key === key)?.elapsedS;

describe('best efforts', () => {
  it('an even 10K gives every distance up to 10K at that pace', () => {
    const pts = syntheticRun({ start: START, distanceKm: 10, paceSecPerKm: 300, intervalS: 1 });
    const efforts = bestEfforts(pts, cumulativeDistance(pts), 'run');
    assert.deepEqual(efforts.map((e) => e.key), ['1k', 'mile', '5k', '10k']);
    for (const [key, expect] of [['1k', 300], ['mile', 483], ['5k', 1500], ['10k', 3000]] as const) {
      const got = efforts.find((e) => e.key === key)!.elapsedS;
      assert.ok(Math.abs(got - expect) <= 2, `${key}: ${got} vs ${expect}`);
    }
  });

  it('finds the fast 5K in the middle of a long run', () => {
    const pts = stitched([{ km: 5, pace: 330 }, { km: 5, pace: 270 }, { km: 5, pace: 330 }]);
    const fiveK = time(pts, '5k')!;
    assert.ok(Math.abs(fiveK - 1350) <= 3, `got ${fiveK}`);
    const best = bestOver(pts, cumulativeDistance(pts), 5000)!;
    assert.ok(Math.abs(best.startM - 5000) <= 20, `started at ${best.startM} m`);
  });

  it('includes a stop in the time, as a watch does', () => {
    const pts = syntheticRun({ start: START, distanceKm: 5, paceSecPerKm: 300, intervalS: 1 }).map((p, i) =>
      i > 600 ? { ...p, t: (p.t as number) + 60_000 } : p,
    );
    assert.ok(Math.abs(time(pts, '5k')! - 1560) <= 2);
  });

  it('a run shorter than a distance has no effort at it', () => {
    const pts = syntheticRun({ start: START, distanceKm: 3, paceSecPerKm: 300, intervalS: 1 });
    assert.deepEqual(bestEfforts(pts, cumulativeDistance(pts), 'run').map((e) => e.key), ['1k', 'mile']);
  });

  it('rides and walks set no running records', () => {
    const pts = syntheticRun({ start: START, distanceKm: 10, paceSecPerKm: 300, intervalS: 1 });
    assert.equal(time(pts, '5k', 'ride'), undefined);
    assert.equal(time(pts, '5k', 'walk'), undefined);
  });

  it('a pace no human runs is not a record', () => {
    const pts = syntheticRun({ start: START, distanceKm: 6, paceSecPerKm: 100, intervalS: 1 });
    assert.equal(time(pts, '5k'), undefined);
  });
});

describe('personal records', () => {
  const a = (id: string, date: string, fiveK: number) => ({ id, localDate: date, startedAt: `${date}T07:00:00Z`, bestEfforts: [{ key: '5k', elapsedS: fiveK, startM: 0 }] });

  it('is the best across activities, the earlier run winning a tie', () => {
    const prs = personalRecords([a('x', '2026-09-01', 1500), a('y', '2026-10-01', 1450), a('z', '2026-10-05', 1450)]);
    assert.deepEqual(prs.map((p) => [p.distance.key, p.elapsedS, p.activityId]), [['5k', 1450, 'y']]);
  });

  it('a new record is one that beats every earlier time', () => {
    assert.deepEqual(newRecords(a('n', '2026-10-10', 1400), [a('y', '2026-10-01', 1450)]).map((r) => [r.elapsedS, r.previousS]), [[1400, 1450]]);
    assert.deepEqual(newRecords(a('n', '2026-10-10', 1460), [a('y', '2026-10-01', 1450)]), []);
    assert.equal(newRecords(a('n', '2026-10-10', 1460), [])[0].previousS, null, 'a first time is marked as having nothing to beat');
  });
});
