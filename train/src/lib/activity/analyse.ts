import type { DeviceSummary, TrackPoint } from './types';

/**
 * What a run file says, computed once on import.
 *
 * Every figure prefers what the device measured over what we can infer:
 * a watch's distance fuses GPS with an accelerometer and is better than
 * haversine over noisy fixes, and its timer knows when auto-pause fired.
 * Where the device is silent, the fallbacks are deliberately conservative —
 * GPS teleports are dropped rather than added, and elevation is smoothed
 * with a dead band so a barometer's jitter is not reported as climbing.
 */

export const EARTH_RADIUS_M = 6371008.8;

export function haversine(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const toRad = Math.PI / 180;
  const dLat = (bLat - aLat) * toRad;
  const dLon = (bLon - aLon) * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toRad) * Math.cos(bLat * toRad) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Faster than anyone runs or rides; a jump implying more is a GPS fault. */
const MAX_PLAUSIBLE_SPEED_MS = 40;
/** Slower than this between samples counts as stopped. */
const MOVING_SPEED_MS = 0.5;
/** A gap longer than this is a pause, not slow movement. */
const MAX_MOVING_GAP_S = 30;
/** Elevation changes smaller than this are noise. */
const ELEVATION_DEAD_BAND_M = 3;

export interface Split {
  /** 1-based kilometre (or mile) number. */
  index: number;
  /** Metres covered in this split — the last one is usually partial. */
  distanceM: number;
  /** Seconds spent covering it. */
  durationS: number;
  paceSecPerKm: number | null;
  avgHr: number | null;
  /** Net elevation change across the split, metres. */
  elevationDeltaM: number | null;
}

/** One point of a chart series, sampled against distance. */
export interface SeriesPoint {
  /** Metres from the start. */
  d: number;
  ele: number | null;
  hr: number | null;
  /** Seconds per km over the surrounding window; null when stopped. */
  pace: number | null;
}

export interface ZoneBand {
  zone: 1 | 2 | 3 | 4 | 5;
  /** Inclusive lower bound, bpm. */
  fromBpm: number;
  /** Exclusive upper bound, bpm; null for the top zone. */
  toBpm: number | null;
  seconds: number;
}

export interface ActivityAnalysis {
  distanceM: number;
  elapsedS: number;
  movingS: number;
  avgPaceSecPerKm: number | null;
  avgHr: number | null;
  maxHr: number | null;
  ascentM: number | null;
  descentM: number | null;
  hasGps: boolean;
  hasHr: boolean;
  /** Per-sample cumulative distance, aligned with the input points. */
  cumulative: number[];
  splits: Split[];
  series: SeriesPoint[];
}

/**
 * Cumulative distance per sample.
 *
 * The device's own distance channel wins when it is present and never goes
 * backwards; otherwise we integrate GPS, dropping any step that would need a
 * superhuman speed to explain.
 */
export function cumulativeDistance(points: TrackPoint[]): number[] {
  const deviceDist = points.filter((p) => p.dist != null);
  const deviceUsable =
    deviceDist.length >= points.length * 0.8 &&
    deviceDist.length > 1 &&
    deviceDist.every((p, i) => i === 0 || (p.dist as number) >= (deviceDist[i - 1].dist as number));

  const out: number[] = new Array(points.length);
  if (deviceUsable) {
    let last = 0;
    for (let i = 0; i < points.length; i++) {
      const d = points[i].dist;
      if (d != null) last = d;
      out[i] = last;
    }
    // some devices start the counter mid-stream; measure from the first sample
    const base = out[0] ?? 0;
    return out.map((d) => d - base);
  }

  let total = 0;
  let prev: TrackPoint | null = null;
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    if (p.lat != null && p.lon != null) {
      if (prev) {
        const step = haversine(prev.lat as number, prev.lon as number, p.lat, p.lon);
        const dt = p.t != null && prev.t != null ? (p.t - prev.t) / 1000 : null;
        const plausible = dt == null || dt <= 0 ? step < 100 : step / dt <= MAX_PLAUSIBLE_SPEED_MS;
        if (plausible) total += step;
      }
      prev = p;
    }
    out[i] = total;
  }
  return out;
}

/** Gain and loss with hysteresis: only a sustained change of more than the dead band counts. */
export function elevationChange(points: TrackPoint[]): { ascent: number; descent: number } | null {
  const eles = points.map((p) => p.ele).filter((e): e is number => e != null);
  if (eles.length < 2) return null;
  let ascent = 0;
  let descent = 0;
  let anchor = eles[0];
  for (const e of eles) {
    const delta = e - anchor;
    if (delta >= ELEVATION_DEAD_BAND_M) {
      ascent += delta;
      anchor = e;
    } else if (delta <= -ELEVATION_DEAD_BAND_M) {
      descent -= delta;
      anchor = e;
    }
  }
  return { ascent: Math.round(ascent), descent: Math.round(descent) };
}

/** Time-weighted: a minute at 150 counts sixty times as much as a second at 180. */
function weightedHr(points: TrackPoint[]): { avg: number | null; max: number | null } {
  let sum = 0;
  let weight = 0;
  let max: number | null = null;
  for (let i = 0; i < points.length; i++) {
    const hr = points[i].hr;
    if (hr == null || hr < 25 || hr > 250) continue;
    max = max == null ? hr : Math.max(max, hr);
    const next = points[i + 1];
    const t = points[i].t;
    const dt = next?.t != null && t != null ? Math.min(MAX_MOVING_GAP_S, Math.max(0, (next.t - t) / 1000)) : 1;
    sum += hr * dt;
    weight += dt;
  }
  return { avg: weight > 0 ? Math.round(sum / weight) : null, max };
}

function movingTime(points: TrackPoint[], cumulative: number[]): number {
  let moving = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1].t;
    const b = points[i].t;
    if (a == null || b == null) continue;
    const dt = (b - a) / 1000;
    if (dt <= 0 || dt > MAX_MOVING_GAP_S) continue;
    const speed = (cumulative[i] - cumulative[i - 1]) / dt;
    if (speed >= MOVING_SPEED_MS) moving += dt;
  }
  return moving;
}

/** Interpolated time (ms) at which cumulative distance reached `target`. */
function timeAtDistance(points: TrackPoint[], cumulative: number[], target: number, from: number): { t: number; i: number } | null {
  for (let i = Math.max(1, from); i < points.length; i++) {
    if (cumulative[i] >= target) {
      const a = points[i - 1].t;
      const b = points[i].t;
      if (a == null || b == null) return null;
      const span = cumulative[i] - cumulative[i - 1];
      const f = span > 0 ? (target - cumulative[i - 1]) / span : 0;
      return { t: a + (b - a) * f, i };
    }
  }
  return null;
}

/**
 * Splits at every `unitM` metres (1000 for km, 1609.344 for miles).
 *
 * A split's duration is wall time across it, the same way a watch lap is, so
 * a stop at a junction shows in that kilometre rather than vanishing.
 */
export function computeSplits(points: TrackPoint[], cumulative: number[], unitM = 1000): Split[] {
  const total = cumulative[cumulative.length - 1] ?? 0;
  const firstT = points.find((p) => p.t != null)?.t;
  if (firstT == null || total < 50) return [];

  const splits: Split[] = [];
  let prevT = firstT;
  let prevI = 0;
  let prevD = 0;
  const lastT = [...points].reverse().find((p) => p.t != null)?.t as number;

  for (let k = 1; prevD < total - 1; k++) {
    const target = Math.min(k * unitM, total);
    const hit = target >= total ? { t: lastT, i: points.length - 1 } : timeAtDistance(points, cumulative, target, prevI);
    if (!hit) break;
    const durationS = Math.max(0, (hit.t - prevT) / 1000);
    const distanceM = target - prevD;

    const slice = points.slice(prevI, hit.i + 1);
    const hrs = slice.map((p) => p.hr).filter((h): h is number => h != null && h > 25);
    const startEle = slice.find((p) => p.ele != null)?.ele ?? null;
    const endEle = [...slice].reverse().find((p) => p.ele != null)?.ele ?? null;

    // a final fragment of a few metres says nothing about pace
    if (distanceM >= 50 || splits.length === 0) {
      splits.push({
        index: k,
        distanceM: Math.round(distanceM),
        durationS: Math.round(durationS),
        paceSecPerKm: distanceM > 0 ? Math.round((durationS / distanceM) * 1000) : null,
        avgHr: hrs.length ? Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length) : null,
        elevationDeltaM: startEle != null && endEle != null ? Math.round(endEle - startEle) : null,
      });
    }

    prevT = hit.t;
    prevI = hit.i;
    prevD = target;
  }
  return splits;
}

/**
 * About `samples` points evenly spaced by distance, for charts.
 *
 * Pace is taken over a window either side of the sample rather than between
 * two adjacent fixes, which on GPS alone swings wildly second to second.
 */
export function sampleSeries(points: TrackPoint[], cumulative: number[], samples = 160): SeriesPoint[] {
  const total = cumulative[cumulative.length - 1] ?? 0;
  if (points.length < 2 || total <= 0) return [];
  const step = total / samples;
  const windowM = Math.max(100, step * 2);
  const out: SeriesPoint[] = [];
  let j = 0;
  for (let s = 0; s <= samples; s++) {
    const d = s * step;
    while (j < points.length - 1 && cumulative[j + 1] <= d) j++;
    const p = points[j];

    let lo = j;
    while (lo > 0 && cumulative[lo] > d - windowM / 2) lo--;
    let hi = j;
    while (hi < points.length - 1 && cumulative[hi] < d + windowM / 2) hi++;
    const dd = cumulative[hi] - cumulative[lo];
    const ta = points[lo].t;
    const tb = points[hi].t;
    const dt = ta != null && tb != null ? (tb - ta) / 1000 : null;
    const pace = dt != null && dd > 10 && dt > 0 && dd / dt >= MOVING_SPEED_MS ? Math.round((dt / dd) * 1000) : null;

    out.push({ d: Math.round(d), ele: p.ele != null ? Math.round(p.ele * 10) / 10 : null, hr: p.hr, pace });
  }
  return out;
}

/**
 * Five zones as a share of maximum heart rate — the model most club coaches
 * prescribe against (Z1 50–60%, Z2 60–70%, Z3 70–80%, Z4 80–90%, Z5 90%+).
 * Time below Z1 is counted in Z1: it is still time on feet.
 */
export function zoneBounds(maxHr: number): ZoneBand[] {
  const at = (f: number) => Math.round(maxHr * f);
  return [
    { zone: 1, fromBpm: at(0.5), toBpm: at(0.6), seconds: 0 },
    { zone: 2, fromBpm: at(0.6), toBpm: at(0.7), seconds: 0 },
    { zone: 3, fromBpm: at(0.7), toBpm: at(0.8), seconds: 0 },
    { zone: 4, fromBpm: at(0.8), toBpm: at(0.9), seconds: 0 },
    { zone: 5, fromBpm: at(0.9), toBpm: null, seconds: 0 },
  ];
}

export function timeInZones(points: TrackPoint[], maxHr: number): ZoneBand[] {
  const bands = zoneBounds(maxHr);
  for (let i = 0; i < points.length - 1; i++) {
    const hr = points[i].hr;
    const a = points[i].t;
    const b = points[i + 1].t;
    if (hr == null || a == null || b == null) continue;
    const dt = (b - a) / 1000;
    if (dt <= 0 || dt > MAX_MOVING_GAP_S) continue;
    const band = [...bands].reverse().find((z) => hr >= z.fromBpm) ?? bands[0];
    band.seconds += dt;
  }
  return bands.map((b) => ({ ...b, seconds: Math.round(b.seconds) }));
}

export function analyse(points: TrackPoint[], device: DeviceSummary | null, splitUnitM = 1000): ActivityAnalysis {
  const timed = points.filter((p) => p.t != null);
  const cumulative = cumulativeDistance(points);
  const measured = cumulative[cumulative.length - 1] ?? 0;

  const distanceM = device?.distanceM ?? measured;
  const elapsedS =
    device?.elapsedS ?? (timed.length > 1 ? ((timed[timed.length - 1].t as number) - (timed[0].t as number)) / 1000 : 0);
  const movingS = device?.movingS ?? movingTime(points, cumulative);
  const hr = weightedHr(points);
  const elevation = elevationChange(points);

  return {
    distanceM: Math.round(distanceM),
    elapsedS: Math.round(elapsedS),
    movingS: Math.round(movingS),
    avgPaceSecPerKm: distanceM > 0 && movingS > 0 ? Math.round((movingS / distanceM) * 1000) : null,
    avgHr: device?.avgHr ?? hr.avg,
    maxHr: device?.maxHr ?? hr.max,
    ascentM: device?.ascentM ?? elevation?.ascent ?? null,
    descentM: elevation?.descent ?? null,
    hasGps: points.some((p) => p.lat != null),
    hasHr: points.some((p) => p.hr != null),
    cumulative,
    splits: computeSplits(points, cumulative, splitUnitM),
    series: sampleSeries(points, cumulative),
  };
}

/** Zones from a stored bpm histogram, against the max HR that is current now. */
export function zonesFromHistogram(histogram: [number, number][], maxHr: number): ZoneBand[] {
  const bands = zoneBounds(maxHr);
  for (const [bpm, seconds] of histogram) {
    const band = [...bands].reverse().find((z) => bpm >= z.fromBpm) ?? bands[0];
    band.seconds += seconds;
  }
  return bands;
}
