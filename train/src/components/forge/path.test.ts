import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { areaPath, bars, describeSeries, linearPath, routePath, smoothPath, toPoints } from './path.ts';

/**
 * ForgeLine geometry.
 *
 * The line represents an athlete's training, so it has to be honest: higher
 * values must sit higher, the curve must pass through the real points rather
 * than near them, and it must not invent a peak the data does not contain.
 */

describe('toPoints', () => {
  it('puts larger values higher on the canvas', () => {
    const [low, high] = toPoints([1, 10]);
    assert.ok(high.y < low.y, 'the larger value should have the smaller y');
  });

  it('spreads points evenly across the full width', () => {
    const pts = toPoints([1, 2, 3, 4, 5]);
    assert.equal(pts[0].x, 0);
    assert.equal(pts[pts.length - 1].x, 100);
    const gaps = pts.slice(1).map((p, i) => p.x - pts[i].x);
    assert.ok(gaps.every((g) => Math.abs(g - gaps[0]) < 1e-9), 'gaps should be uniform');
  });

  it('keeps the stroke inside the box so peaks are not clipped', () => {
    const pts = toPoints([0, 100], 8);
    assert.ok(Math.min(...pts.map((p) => p.y)) >= 8);
    assert.ok(Math.max(...pts.map((p) => p.y)) <= 92);
  });

  it('survives a flat series without dividing by zero', () => {
    const pts = toPoints([5, 5, 5]);
    assert.ok(pts.every((p) => Number.isFinite(p.y)));
  });

  it('handles empty and single-point series', () => {
    assert.deepEqual(toPoints([]), []);
    assert.equal(toPoints([7]).length, 1);
  });
});

describe('smoothPath', () => {
  it('passes exactly through every data point', () => {
    const pts = toPoints([3, 9, 4, 11, 6]);
    const d = smoothPath(pts);
    // every point must appear as a curve endpoint, not merely be approached
    for (const p of pts.slice(1)) {
      const x = Math.round(p.x * 100) / 100;
      const y = Math.round(p.y * 100) / 100;
      assert.ok(d.includes(`${x},${y}`), `curve should terminate on ${x},${y}`);
    }
  });

  it('never overshoots the data range', () => {
    // a high-tension spline invents peaks; ours must not
    const pts = toPoints([10, 10, 40, 10, 10]);
    const d = smoothPath(pts);
    const ys = [...d.matchAll(/[-\d.]+,([-\d.]+)/g)].map((m) => Number(m[1]));
    const dataMin = Math.min(...pts.map((p) => p.y));
    assert.ok(Math.min(...ys) >= dataMin - 6, 'control points should not fly above the peak');
  });

  it('falls back to straight segments below three points', () => {
    const pts = toPoints([1, 2]);
    assert.equal(smoothPath(pts), linearPath(pts));
  });
});

describe('areaPath', () => {
  it('closes down to the baseline', () => {
    const pts = toPoints([2, 8, 5]);
    const d = areaPath(pts, linearPath(pts));
    assert.ok(d.trim().endsWith('Z'), 'area must be a closed path');
    assert.ok(d.includes(',100'), 'area must reach the baseline');
  });
});

describe('bars', () => {
  it('grows every bar from the baseline', () => {
    for (const b of bars([4, 9, 2, 7])) {
      assert.ok(Math.abs(b.y + b.h - 100) < 1e-9, 'bar must sit on the baseline');
    }
  });

  it('scales height by value', () => {
    const [small, large] = bars([1, 10]);
    assert.ok(large.h > small.h);
  });

  it('gives a zero value a visible minimum rather than nothing', () => {
    assert.ok(bars([0, 5])[0].h > 0, 'a logged zero should still be visible as a bar');
  });

  it('keeps every bar inside the viewBox', () => {
    for (const b of bars([1, 5, 9, 3])) {
      assert.ok(b.x >= 0 && b.x + b.w <= 100.001);
    }
  });
});

describe('routePath', () => {
  it('is deterministic, so server and client render the same route', () => {
    assert.equal(routePath(7), routePath(7));
  });

  it('varies by seed', () => {
    assert.notEqual(routePath(1), routePath(2));
  });
});

describe('describeSeries', () => {
  it('states direction and endpoints in plain language', () => {
    assert.match(describeSeries([40, 52, 61], 'km', 'Weekly volume'), /rising from 40 to 61 km/);
    assert.match(describeSeries([61, 40], 'km', 'Weekly volume'), /falling/);
    assert.match(describeSeries([5, 5], 'km', 'Weekly volume'), /level/);
  });

  it('says so when there is nothing to describe', () => {
    assert.match(describeSeries([], 'km', 'Weekly volume'), /no data yet/);
  });
});
