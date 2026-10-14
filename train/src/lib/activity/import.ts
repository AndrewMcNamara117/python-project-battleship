import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { analyse, type ActivityAnalysis } from './analyse';
import { looksLikeFit, parseFit } from './fit';
import { localDate } from './match';
import { encodeRoute, privateSegments, simplify, type LatLon, type PrivacyZone } from './route';
import {
  ActivityFileError,
  SPORT_LABELS,
  type ActivityDraft,
  type ActivitySource,
  type HrHistogram,
  type ParsedActivity,
  type TrackPoint,
} from './types';
import { looksLikeGpx, looksLikeTcx, parseGpx, parseTcx } from './xml';

/**
 * From uploaded bytes to a stored activity.
 *
 * Everything here is pure apart from hashing, so the whole pipeline is
 * testable with a fixture and no server.
 */

/** An honest ceiling: a 12-hour ultra at 1 Hz is ~4 MB of FIT. */
export const MAX_FILE_BYTES = 25 * 1024 * 1024;
/** And for what a gzip may expand to, so a small file cannot become a large one. */
const MAX_INFLATED_BYTES = 60 * 1024 * 1024;
/** Enough to draw a route crisply at any size this app renders it. */
const MAX_ROUTE_POINTS = 1500;

export const ACCEPTED_EXTENSIONS = ['.fit', '.gpx', '.tcx', '.fit.gz', '.gpx.gz', '.tcx.gz'];

function isGzip(bytes: Uint8Array): boolean {
  return bytes.length > 2 && bytes[0] === 0x1f && bytes[1] === 0x8b;
}

/** Sniff the format from the bytes, never the file name — names lie, magic numbers do not. */
export function decodeFile(input: Uint8Array): ParsedActivity {
  if (input.length === 0) throw new ActivityFileError('That file is empty.');
  if (input.length > MAX_FILE_BYTES) throw new ActivityFileError('That file is over 25 MB — too large to be one activity.');

  let bytes = input;
  if (isGzip(bytes)) {
    try {
      bytes = new Uint8Array(gunzipSync(bytes, { maxOutputLength: MAX_INFLATED_BYTES }));
    } catch {
      throw new ActivityFileError('That compressed file could not be opened.');
    }
  }

  if (looksLikeFit(bytes)) return parseFit(bytes);

  const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes.subarray(0, Math.min(bytes.length, MAX_INFLATED_BYTES)));
  if (looksLikeGpx(text)) return parseGpx(text);
  if (looksLikeTcx(text)) return parseTcx(text);

  throw new ActivityFileError('That is not an activity file. Export a .fit, .gpx or .tcx from your watch or app.');
}

export function fingerprint(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

/** Seconds at each bpm, so zones can be cut later against whatever max HR is current. */
export function hrHistogram(points: TrackPoint[]): HrHistogram {
  const seconds = new Map<number, number>();
  for (let i = 0; i < points.length - 1; i++) {
    const hr = points[i].hr;
    const a = points[i].t;
    const b = points[i + 1].t;
    if (hr == null || a == null || b == null || hr < 25 || hr > 250) continue;
    const dt = (b - a) / 1000;
    if (dt <= 0 || dt > 30) continue;
    const bpm = Math.round(hr);
    seconds.set(bpm, (seconds.get(bpm) ?? 0) + dt);
  }
  return [...seconds.entries()].sort((x, y) => x[0] - y[0]).map(([bpm, s]) => [bpm, Math.round(s)]);
}

/** Simplify until the route fits the point budget. */
function budgetRoute(segments: LatLon[][]): LatLon[][] {
  let tolerance = 3;
  let out = segments.map((s) => simplify(s, tolerance));
  while (out.reduce((n, s) => n + s.length, 0) > MAX_ROUTE_POINTS && tolerance < 200) {
    tolerance *= 1.6;
    out = segments.map((s) => simplify(s, tolerance));
  }
  return out;
}

export function defaultName(sport: ParsedActivity['sport'], startedAt: string, timeZone: string): string {
  let hour = 12;
  try {
    hour = Number(new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(new Date(startedAt)));
  } catch {
    /* keep midday */
  }
  const part = hour < 5 ? 'Night' : hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : hour < 21 ? 'Evening' : 'Night';
  return `${part} ${SPORT_LABELS[sport].toLowerCase()}`.replace(/^./, (c) => c.toUpperCase());
}

export interface BuildOptions {
  athleteId: string;
  timeZone: string;
  source?: ActivitySource;
  privacyTrimM: number;
  zones?: PrivacyZone[];
  /** Imperial athletes get mile splits. */
  units?: 'metric' | 'imperial';
}

/** Everything about the activity except what links it to the plan. */
export function buildActivity(
  parsed: ParsedActivity,
  fileFingerprint: string,
  opts: BuildOptions,
): { draft: ActivityDraft; analysis: ActivityAnalysis } {
  const points = parsed.points;
  const startedAt = parsed.startedAt;
  if (!startedAt) throw new ActivityFileError('The file has no timestamps, so there is no way to tell when it happened.');

  const analysis = analyse(points, parsed.device, opts.units === 'imperial' ? 1609.344 : 1000);
  if (analysis.distanceM <= 0 && analysis.movingS <= 0) {
    throw new ActivityFileError('The file has no movement in it.');
  }

  const segments = analysis.hasGps
    ? budgetRoute(privateSegments(points, analysis.cumulative, opts.privacyTrimM, opts.zones ?? []))
    : [];

  const draft: ActivityDraft = {
    athleteId: opts.athleteId,
    source: opts.source ?? 'upload',
    format: parsed.format,
    fingerprint: fileFingerprint,
    name: parsed.name ?? defaultName(parsed.sport, startedAt, opts.timeZone),
    sport: parsed.sport,
    startedAt,
    localDate: localDate(startedAt, opts.timeZone),
    distanceM: analysis.distanceM,
    movingS: analysis.movingS,
    elapsedS: analysis.elapsedS,
    avgPaceSecPerKm: analysis.avgPaceSecPerKm,
    avgHr: analysis.avgHr,
    maxHr: analysis.maxHr,
    ascentM: analysis.ascentM,
    descentM: analysis.descentM,
    route: segments.length ? encodeRoute(segments) : null,
    privacyTrimM: opts.privacyTrimM,
    splits: analysis.splits,
    series: analysis.series,
    hrHistogram: hrHistogram(points),
    scheduledWorkoutId: null,
    completedWorkoutId: null,
    visibility: 'coach',
  };
  return { draft, analysis };
}
