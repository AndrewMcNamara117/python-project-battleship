import { haversine } from './analyse';
import { decodePolyline, decodeRoute, encodePolyline, simplify, type LatLon } from './route';
import type { ActivitySport, TrackPoint } from './types';

/**
 * Segments: a named stretch of road or trail, timed on every run that covers it.
 *
 * Matching runs on the full track at import — the only moment the raw
 * points exist, since they are never stored. That has two consequences
 * worth stating: a new segment times runs imported *after* it is created,
 * not before; and an effort is computed by the server from the file, never
 * submitted by a client.
 *
 * An effort is a pass from near the segment's start to near its end that
 * also passes every checkpoint along it, over a distance close to the
 * segment's own. Checkpoints are what stop a run that touches both ends by
 * a different road from being timed.
 */

export interface SegmentGeometry {
  id: string;
  /** Encoded polyline of the segment, start to finish. */
  route: string;
  distanceM: number;
}

export interface Effort {
  segmentId: string;
  /** Seconds from crossing the start to crossing the finish. */
  elapsedS: number;
  startedAt: string;
}

/** How close a fix must come to a segment's ends and checkpoints. GPS is good to ~5–15 m. */
const END_RADIUS_M = 30;
const CHECKPOINT_RADIUS_M = 40;
const CHECKPOINTS = 6;
/** Covered distance must sit within this band of the segment's length. */
const MIN_RATIO = 0.85;
const MAX_RATIO = 1.3;

/** Anything faster is a doctored file or a car, not an effort. Metres per second. */
const MAX_SPEED: Record<ActivitySport, number> = {
  run: 7.5,
  trail_run: 7.5,
  walk: 3.5,
  hike: 3.5,
  ride: 25,
  swim: 3,
  other: 25,
};

export function lineLength(line: LatLon[]): number {
  let total = 0;
  for (let i = 1; i < line.length; i++) total += haversine(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]);
  return total;
}

/** The point `d` metres along a line, interpolated. */
export function pointAlong(line: LatLon[], d: number): LatLon {
  let run = 0;
  for (let i = 1; i < line.length; i++) {
    const step = haversine(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]);
    if (run + step >= d) {
      const f = step > 0 ? (d - run) / step : 0;
      return [line[i - 1][0] + (line[i][0] - line[i - 1][0]) * f, line[i - 1][1] + (line[i][1] - line[i - 1][1]) * f];
    }
    run += step;
  }
  return line[line.length - 1];
}

/** The part of a line between two distances along it. */
export function cutLine(line: LatLon[], fromM: number, toM: number): LatLon[] {
  const out: LatLon[] = [pointAlong(line, fromM)];
  let run = 0;
  for (let i = 1; i < line.length; i++) {
    run += haversine(line[i - 1][0], line[i - 1][1], line[i][0], line[i][1]);
    if (run > fromM && run < toM) out.push(line[i]);
  }
  out.push(pointAlong(line, toM));
  return out;
}

/** A segment drawn from a stretch of an existing route: geometry and length. */
export function segmentFromLine(line: LatLon[], fromM: number, toM: number): { route: string; distanceM: number } {
  const piece = simplify(cutLine(line, fromM, toM), 2);
  return { route: encodePolyline(piece), distanceM: Math.round(lineLength(piece)) };
}

function interpolateTime(points: TrackPoint[], i: number): number | null {
  return points[i]?.t ?? null;
}

/** Index of the closest fix within `radius` of `target`, scanning [from, to). Null if none. */
function closestWithin(points: TrackPoint[], target: LatLon, radius: number, from: number, to: number): number | null {
  let best: number | null = null;
  let bestD = radius;
  for (let i = from; i < to; i++) {
    const p = points[i];
    if (p.lat == null || p.lon == null) continue;
    const d = haversine(target[0], target[1], p.lat, p.lon);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/**
 * The best effort on one segment within one activity, or null.
 *
 * `trimM` is the athlete's privacy distance. An effort beginning or ending
 * inside the hidden stretch is dropped: a time on a segment that starts at
 * someone's gate would say where the gate is.
 */
export function findEffort(
  points: TrackPoint[],
  cumulative: number[],
  segment: SegmentGeometry,
  sport: ActivitySport,
  trimM: number,
): Effort | null {
  const line = decodePolyline(segment.route);
  if (line.length < 2 || segment.distanceM < 50) return null;
  const start = line[0];
  const end = line[line.length - 1];
  const checkpoints = Array.from({ length: CHECKPOINTS }, (_, k) => pointAlong(line, (segment.distanceM * (k + 1)) / (CHECKPOINTS + 1)));
  const total = cumulative[cumulative.length - 1] ?? 0;

  let best: Effort | null = null;
  let i = 0;
  while (i < points.length) {
    // walk to the next approach to the start, then take its closest fix
    const p = points[i];
    if (p.lat == null || p.lon == null || haversine(start[0], start[1], p.lat, p.lon) > END_RADIUS_M) {
      i++;
      continue;
    }
    let j = i;
    while (j + 1 < points.length && points[j + 1].lat != null && haversine(start[0], start[1], points[j + 1].lat as number, points[j + 1].lon as number) <= END_RADIUS_M) j++;
    const s = closestWithin(points, start, END_RADIUS_M, i, j + 1) as number;

    // the finish must come within the plausible distance band
    let limit = s;
    while (limit < points.length && cumulative[limit] - cumulative[s] <= segment.distanceM * MAX_RATIO) limit++;
    let e: number | null = null;
    for (let k = s + 1; k < limit; k++) {
      if (cumulative[k] - cumulative[s] < segment.distanceM * MIN_RATIO) continue;
      const q = points[k];
      if (q.lat != null && q.lon != null && haversine(end[0], end[1], q.lat, q.lon) <= END_RADIUS_M) {
        // the closest fix of this approach to the finish
        let m = k;
        while (m + 1 < limit && points[m + 1].lat != null && haversine(end[0], end[1], points[m + 1].lat as number, points[m + 1].lon as number) <= END_RADIUS_M) m++;
        e = closestWithin(points, end, END_RADIUS_M, k, m + 1);
        break;
      }
    }

    if (e != null) {
      const throughAll = checkpoints.every((c) => closestWithin(points, c, CHECKPOINT_RADIUS_M, s, e + 1) != null);
      const ta = interpolateTime(points, s);
      const tb = interpolateTime(points, e);
      const private_ = cumulative[s] < trimM || cumulative[e] > total - trimM;
      if (throughAll && ta != null && tb != null && tb > ta && !private_) {
        const elapsedS = Math.round((tb - ta) / 1000);
        const plausible = segment.distanceM / elapsedS <= MAX_SPEED[sport];
        if (plausible && (!best || elapsedS < best.elapsedS)) {
          best = { segmentId: segment.id, elapsedS, startedAt: new Date(ta).toISOString() };
        }
      }
    }
    i = j + 1;
  }
  return best;
}

export function findEfforts(
  points: TrackPoint[],
  cumulative: number[],
  segments: SegmentGeometry[],
  sport: ActivitySport,
  trimM: number,
): Effort[] {
  if (!points.some((p) => p.lat != null)) return [];
  return segments
    .map((s) => findEffort(points, cumulative, s, sport, trimM))
    .filter((e): e is Effort => e != null);
}

/* ---------------- stored shapes ---------------- */

export interface Segment extends SegmentGeometry {
  name: string;
  description: string;
  createdBy: string | null;
  archived: boolean;
  createdAt: string;
}

export interface SegmentEffort {
  id: string;
  segmentId: string;
  activityId: string;
  athleteId: string;
  startedAt: string;
  elapsedS: number;
}

/** One line of a club board: an athlete's best, from a run they shared. */
export interface SegmentLeader {
  athleteId: string;
  athleteName: string;
  activityId: string;
  elapsedS: number;
  startedAt: string;
}

export type SegmentDraft = Pick<Segment, 'name' | 'description' | 'route' | 'distanceM' | 'createdBy'>;
export type EffortDraft = Omit<SegmentEffort, 'id'>;

/**
 * Kept clear of the ends of a visible route when a coach draws a segment
 * from it, on top of the athlete's own trim. A segment is public to every
 * member; one ending where an athlete's route becomes visible would narrow
 * down where they live.
 */
export const SEGMENT_END_CLEARANCE_M = 500;

/** The longest visible stretch of a stored route — privacy zones can split it. */
export function longestPiece(route: string | null): { line: LatLon[]; length: number } {
  return decodeRoute(route).reduce<{ line: LatLon[]; length: number }>(
    (best, line) => {
      const length = lineLength(line);
      return length > best.length ? { line, length } : best;
    },
    { line: [], length: 0 },
  );
}
