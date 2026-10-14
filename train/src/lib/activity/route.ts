import { haversine } from './analyse';
import type { TrackPoint } from './types';

/**
 * The route an activity is allowed to show.
 *
 * A GPS track that starts and ends at someone's front door is their address.
 * So the stored route is never the raw track: the first and last stretch are
 * cut away, anything inside a privacy zone is cut away, and what is left is
 * simplified. The raw coordinates are not stored anywhere — distance, pace
 * and splits are computed from the full file at import and kept as numbers,
 * so trimming the map costs the athlete nothing in their statistics.
 */

export type LatLon = [number, number];

export interface PrivacyZone {
  lat: number;
  lon: number;
  radiusM: number;
}

/** How much of the start and finish to hide. 0 is allowed; the athlete chooses. */
export const PRIVACY_TRIM_OPTIONS = [0, 200, 500, 1000] as const;
export type PrivacyTrimM = (typeof PRIVACY_TRIM_OPTIONS)[number];
export const DEFAULT_PRIVACY_TRIM_M: PrivacyTrimM = 200;

/**
 * Cut the ends and the zones.
 *
 * Returns one or more segments: a run that passes through a zone mid-route
 * comes back as two lines, never as a straight bridge across the hidden part
 * (a bridge would point straight at what it was hiding).
 */
export function privateSegments(
  points: TrackPoint[],
  cumulative: number[],
  trimM: number,
  zones: PrivacyZone[] = [],
): LatLon[][] {
  const total = cumulative[cumulative.length - 1] ?? 0;
  if (total <= trimM * 2) return [];

  const segments: LatLon[][] = [];
  let current: LatLon[] = [];
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    const d = cumulative[i];
    const visible =
      p.lat != null &&
      p.lon != null &&
      d >= trimM &&
      d <= total - trimM &&
      !zones.some((z) => haversine(z.lat, z.lon, p.lat as number, p.lon as number) <= z.radiusM);
    if (visible) {
      current.push([p.lat as number, p.lon as number]);
    } else if (current.length) {
      segments.push(current);
      current = [];
    }
  }
  if (current.length) segments.push(current);
  return segments.filter((s) => s.length >= 2);
}

/** Perpendicular distance in metres, on a local flat projection — accurate at route scale. */
function offsetM(p: LatLon, a: LatLon, b: LatLon): number {
  const k = Math.cos((a[0] * Math.PI) / 180) * 111320;
  const ax = a[1] * k, ay = a[0] * 110540;
  const bx = b[1] * k, by = b[0] * 110540;
  const px = p[1] * k, py = p[0] * 110540;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

/** Douglas–Peucker, iterative so a long ultra cannot overflow the stack. */
export function simplify(line: LatLon[], toleranceM = 4): LatLon[] {
  if (line.length <= 2) return line.slice();
  const keep = new Uint8Array(line.length);
  keep[0] = 1;
  keep[line.length - 1] = 1;
  const stack: [number, number][] = [[0, line.length - 1]];
  while (stack.length) {
    const [s, e] = stack.pop() as [number, number];
    let worst = -1;
    let worstD = 0;
    for (let i = s + 1; i < e; i++) {
      const d = offsetM(line[i], line[s], line[e]);
      if (d > worstD) {
        worstD = d;
        worst = i;
      }
    }
    if (worst > 0 && worstD > toleranceM) {
      keep[worst] = 1;
      stack.push([s, worst], [worst, e]);
    }
  }
  return line.filter((_, i) => keep[i]);
}

/* ---- Encoded polyline: the widely used 5-decimal format, ~1 m precision ---- */

function encodeValue(v: number): string {
  let n = v < 0 ? ~(v << 1) : v << 1;
  let out = '';
  while (n >= 0x20) {
    out += String.fromCharCode((0x20 | (n & 0x1f)) + 63);
    n >>= 5;
  }
  return out + String.fromCharCode(n + 63);
}

export function encodePolyline(line: LatLon[]): string {
  let lat = 0;
  let lon = 0;
  let out = '';
  for (const [a, b] of line) {
    const la = Math.round(a * 1e5);
    const lo = Math.round(b * 1e5);
    out += encodeValue(la - lat) + encodeValue(lo - lon);
    lat = la;
    lon = lo;
  }
  return out;
}

export function decodePolyline(s: string): LatLon[] {
  const out: LatLon[] = [];
  let i = 0;
  let lat = 0;
  let lon = 0;
  const next = () => {
    let shift = 0;
    let result = 0;
    let b: number;
    do {
      if (i >= s.length) throw new Error('Truncated polyline');
      b = s.charCodeAt(i++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    return result & 1 ? ~(result >> 1) : result >> 1;
  };
  while (i < s.length) {
    lat += next();
    lon += next();
    out.push([lat / 1e5, lon / 1e5]);
  }
  return out;
}

/**
 * Segments joined for storage. An encoded polyline uses only ASCII 63–126,
 * so `;` (59) can never occur inside one. (`|` can: it is 124.)
 */
export function encodeRoute(segments: LatLon[][]): string {
  return segments.map(encodePolyline).join(';');
}

export function decodeRoute(s: string | null): LatLon[][] {
  if (!s) return [];
  return s.split(';').filter(Boolean).map(decodePolyline);
}

/**
 * Project segments into an SVG viewBox, preserving the route's true aspect.
 * Equirectangular with the latitude's cosine applied — at the scale of a run
 * the distortion is far below a pixel.
 */
export function projectRoute(
  segments: LatLon[][],
  width: number,
  height: number,
  pad = 12,
): { paths: string[]; start: [number, number] | null; end: [number, number] | null } {
  const all = segments.flat();
  if (all.length < 2) return { paths: [], start: null, end: null };

  const midLat = (Math.min(...all.map((p) => p[0])) + Math.max(...all.map((p) => p[0]))) / 2;
  const k = Math.cos((midLat * Math.PI) / 180);
  const xs = all.map((p) => p[1] * k);
  const ys = all.map((p) => -p[0]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const spanX = maxX - minX || 1e-9;
  const spanY = maxY - minY || 1e-9;
  const scale = Math.min((width - pad * 2) / spanX, (height - pad * 2) / spanY);
  const offX = (width - spanX * scale) / 2;
  const offY = (height - spanY * scale) / 2;
  const at = (p: LatLon): [number, number] => [
    Math.round(((p[1] * k - minX) * scale + offX) * 10) / 10,
    Math.round(((-p[0] - minY) * scale + offY) * 10) / 10,
  ];

  const paths = segments.map((seg) => seg.map((p, i) => `${i ? 'L' : 'M'}${at(p).join(' ')}`).join(''));
  const first = segments[0][0];
  const lastSeg = segments[segments.length - 1];
  return { paths, start: at(first), end: at(lastSeg[lastSeg.length - 1]) };
}
