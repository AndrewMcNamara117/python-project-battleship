/**
 * ForgeLine path generation.
 *
 * Pure functions, no React, no DOM. Kept separate so the geometry is testable
 * on its own — a line that misreports an athlete's training is worse than no
 * line at all.
 *
 * Every path is emitted in a normalised 0→100 × 0→100 viewBox and stretched by
 * `preserveAspectRatio="none"`, so a ForgeLine fills whatever box it is given
 * without the caller doing arithmetic.
 */

export interface Point {
  x: number;
  y: number;
}

const VB = 100;

/** Guard against a flat series producing a divide-by-zero. */
function extent(values: number[]): { min: number; max: number } {
  const min = Math.min(...values);
  const max = Math.max(...values);
  return max - min < 1e-9 ? { min: min - 0.5, max: max + 0.5 } : { min, max };
}

/**
 * Map a series into the viewBox.
 *
 * `padY` keeps the stroke and its endpoint node inside the box — without it a
 * peak at the maximum is clipped in half by the top edge.
 */
export function toPoints(values: number[], padY = 8): Point[] {
  if (values.length === 0) return [];
  if (values.length === 1) return [{ x: VB / 2, y: VB / 2 }];

  const { min, max } = extent(values);
  const span = max - min;
  const usable = VB - padY * 2;

  return values.map((v, i) => ({
    x: (i / (values.length - 1)) * VB,
    // SVG y grows downward; a larger value must sit higher
    y: padY + (1 - (v - min) / span) * usable,
  }));
}

const r = (n: number) => Math.round(n * 100) / 100;

/** Straight segments. Honest about the data — used for elevation and courses. */
export function linearPath(points: Point[]): string {
  if (!points.length) return '';
  return points.map((p, i) => `${i === 0 ? 'M' : 'L'}${r(p.x)},${r(p.y)}`).join(' ');
}

/**
 * Catmull-Rom smoothing converted to cubic béziers.
 *
 * Tension is deliberately low: the curve passes exactly through every data
 * point and only eases the corners. It never invents a peak the data does not
 * contain, which a higher-tension spline will happily do.
 */
export function smoothPath(points: Point[], tension = 0.22): string {
  if (points.length < 3) return linearPath(points);

  let d = `M${r(points[0].x)},${r(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] ?? points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] ?? p2;

    const c1x = p1.x + (p2.x - p0.x) * tension;
    const c1y = p1.y + (p2.y - p0.y) * tension;
    const c2x = p2.x - (p3.x - p1.x) * tension;
    const c2y = p2.y - (p3.y - p1.y) * tension;

    d += ` C${r(c1x)},${r(c1y)} ${r(c2x)},${r(c2y)} ${r(p2.x)},${r(p2.y)}`;
  }
  return d;
}

/** Close a line down to the baseline so it can carry an area fill. */
export function areaPath(points: Point[], linePath: string): string {
  if (!points.length) return '';
  const first = points[0];
  const last = points[points.length - 1];
  return `${linePath} L${r(last.x)},${VB} L${r(first.x)},${VB} Z`;
}

/**
 * A winding route through terrain.
 *
 * Deterministic from `seed`: the same route renders identically on the server
 * and the client, and does not reshuffle between renders. Decorative only —
 * this variant is never used to represent athlete data.
 */
export function routePath(seed = 1, segments = 5): string {
  let s = seed * 9301 + 49297;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  const pts: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    pts.push({
      x: (i / segments) * VB,
      y: 20 + rand() * 60,
    });
  }
  return smoothPath(pts, 0.3);
}

/** Bar geometry for the accumulating-load variant. */
export function bars(values: number[], gap = 26): { x: number; y: number; w: number; h: number }[] {
  if (!values.length) return [];
  const { min, max } = extent([0, ...values]);
  const span = max - min;
  const slot = VB / values.length;
  const w = Math.max(1.5, slot * (1 - gap / 100));
  const inset = (slot - w) / 2;

  return values.map((v, i) => {
    const h = Math.max(1.5, ((v - min) / span) * (VB - 6));
    return { x: i * slot + inset, y: VB - h, w, h };
  });
}

/** Plain-language summary for the accessible label. */
export function describeSeries(values: number[], unit: string, label: string): string {
  if (!values.length) return `${label}: no data yet`;
  const first = values[0];
  const last = values[values.length - 1];
  const dir = last > first ? 'rising' : last < first ? 'falling' : 'level';
  const round = (n: number) => (Number.isInteger(n) ? n : Math.round(n * 10) / 10);
  return `${label}: ${values.length} points, ${dir} from ${round(first)} to ${round(last)} ${unit}`;
}
