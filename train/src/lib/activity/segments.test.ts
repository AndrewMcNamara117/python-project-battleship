import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { cumulativeDistance } from './analyse.ts';
import { syntheticRun } from './fixtures.ts';
import type { LatLon } from './route.ts';
import { cutLine, findEffort, findEfforts, lineLength, segmentFromLine, type SegmentGeometry } from './segments.ts';
import type { TrackPoint } from './types.ts';

const START = '2026-10-10T07:00:00Z';
const run10 = (pace = 300, extra: Partial<Parameters<typeof syntheticRun>[0]> = {}) =>
  syntheticRun({ start: START, distanceKm: 10, paceSecPerKm: pace, intervalS: 1, ...extra });
const lineOf = (pts: TrackPoint[]): LatLon[] => pts.map((p) => [p.lat as number, p.lon as number]);

/** A segment from 2 km to 4 km of the 10 km loop. */
function canalDrag(): SegmentGeometry {
  const { route, distanceM } = segmentFromLine(lineOf(run10()), 2000, 4000);
  return { id: 'seg-canal', route, distanceM };
}

describe('segment geometry', () => {
  it('cuts the stretch it is asked for', () => {
    const line = lineOf(run10());
    assert.ok(Math.abs(lineLength(cutLine(line, 2000, 4000)) - 2000) < 5);
    assert.ok(Math.abs(canalDrag().distanceM - 2000) < 10);
  });
});

describe('finding efforts', () => {
  it('times a run that covers the segment', () => {
    const pts = run10(300);
    const e = findEffort(pts, cumulativeDistance(pts), canalDrag(), 'run', 200);
    assert.ok(e, 'effort found');
    // 2 km at 5:00/km is 600 s; the ends are matched to within a fix or two
    assert.ok(Math.abs(e.elapsedS - 600) <= 12, `got ${e.elapsedS}`);
    assert.equal(e.startedAt.slice(0, 13), '2026-10-10T07');
  });

  it('a faster run gets a faster time', () => {
    const slow = run10(330);
    const fast = run10(270);
    const a = findEffort(slow, cumulativeDistance(slow), canalDrag(), 'run', 0)!;
    const b = findEffort(fast, cumulativeDistance(fast), canalDrag(), 'run', 0)!;
    assert.ok(b.elapsedS < a.elapsedS);
  });

  it('ignores a run that shares the start but takes another road', () => {
    // a 6 km loop from the same gate: a different circle through the same start
    const other = syntheticRun({ start: START, distanceKm: 6, paceSecPerKm: 300, intervalS: 1 });
    assert.equal(findEffort(other, cumulativeDistance(other), canalDrag(), 'run', 0), null);
  });

  it('ignores a shortcut that touches both ends but cuts the corner', () => {
    // straight from the segment's start to its finish: 93% of its length, so
    // inside the distance band — only the checkpoints can catch it
    const line = lineOf(run10());
    const [a, b] = [cutLine(line, 2000, 2000)[0], cutLine(line, 4000, 4000)[0]];
    const chordM = lineLength([a, b]);
    assert.ok(chordM / 2000 > 0.85, `chord ratio ${(chordM / 2000).toFixed(2)} is inside the band`);
    const steps = Math.round(chordM / 3.3);
    const t0 = Date.parse(START);
    const pts: TrackPoint[] = Array.from({ length: steps + 1 }, (_, i) => ({
      t: t0 + i * 1000, lat: a[0] + ((b[0] - a[0]) * i) / steps, lon: a[1] + ((b[1] - a[1]) * i) / steps,
      ele: null, hr: null, cad: null, dist: null,
    }));
    assert.equal(findEffort(pts, cumulativeDistance(pts), canalDrag(), 'run', 0), null);
  });

  it('ignores the segment run backwards', () => {
    const pts = run10().reverse().map((p, i, all) => ({ ...p, t: (all[all.length - 1].t as number) + i * 1000, dist: null }));
    assert.equal(findEffort(pts, cumulativeDistance(pts), canalDrag(), 'run', 0), null);
  });

  it('drops an effort inside the athlete’s privacy trim', () => {
    const { route, distanceM } = segmentFromLine(lineOf(run10()), 0, 1500);
    const seg = { id: 'gate', route, distanceM };
    const pts = run10();
    assert.equal(findEffort(pts, cumulativeDistance(pts), seg, 'run', 200), null, 'hidden: begins at the door');
    assert.ok(findEffort(pts, cumulativeDistance(pts), seg, 'run', 0), 'shown when the athlete hides nothing');
  });

  it('refuses a time no runner could do', () => {
    const pts = run10(100); // 1:40 /km
    assert.equal(findEffort(pts, cumulativeDistance(pts), canalDrag(), 'run', 0), null);
    assert.ok(findEffort(pts, cumulativeDistance(pts), canalDrag(), 'ride', 0), 'a plausible ride');
  });

  it('takes the best of two laps', () => {
    const lap1 = run10(320);
    const lap2 = syntheticRun({ start: new Date((lap1[lap1.length - 1].t as number) + 1000).toISOString(), distanceKm: 10, paceSecPerKm: 280, intervalS: 1 });
    const pts = [...lap1, ...lap2.map((p) => ({ ...p, dist: (p.dist as number) + 10000 }))];
    const e = findEffort(pts, cumulativeDistance(pts), canalDrag(), 'run', 0)!;
    assert.ok(Math.abs(e.elapsedS - 560) <= 12, `got ${e.elapsedS}`);
  });

  it('no GPS, no efforts', () => {
    const pts = run10().map((p) => ({ ...p, lat: null, lon: null }));
    assert.deepEqual(findEfforts(pts, cumulativeDistance(pts), [canalDrag()], 'run', 0), []);
  });

  it('stays quick on a long file against several segments', () => {
    const long = syntheticRun({ start: START, distanceKm: 60, paceSecPerKm: 400, intervalS: 1 });
    const c = cumulativeDistance(long);
    const segs = Array.from({ length: 10 }, (_, k) => ({ ...canalDrag(), id: `s${k}` }));
    const t = Date.now();
    findEfforts(long, c, segs, 'run', 0);
    assert.ok(Date.now() - t < 3000, `${Date.now() - t} ms`);
  });
});
