import { haversine } from './analyse';
import type { ActivitySport, TrackPoint } from './types';

/**
 * Recording a run in the browser, as pure state.
 *
 * The page feeds in position fixes; this decides which to keep and keeps the
 * running figures. Kept separate from the page so the rules — what counts
 * as a bad fix, what counts as moving, what a pause does — are tested
 * without a phone in a field.
 *
 * Nothing leaves the device while recording. On finish the track becomes a
 * GPX file and goes through the same import as a watch file, so privacy
 * trimming, matching, segments and records all apply unchanged.
 */

export interface Fix {
  /** ms since epoch, from the position's own timestamp. */
  t: number;
  lat: number;
  lon: number;
  /** Metres, 68% confidence radius, as the Geolocation API reports. */
  accuracy: number;
  altitude: number | null;
}

export interface RecorderState {
  sport: ActivitySport;
  status: 'recording' | 'paused';
  points: TrackPoint[];
  distanceM: number;
  /** Time spent recording, excluding pauses. */
  activeMs: number;
  /** When the current recording stretch began; null while paused. */
  resumedAt: number | null;
  startedAt: number;
  /** Fixes thrown away, so the page can say "weak GPS" honestly. */
  rejected: number;
  /** Set on resume: the next fix starts a new stretch and adds no distance. */
  freshStretch: boolean;
}

/** Worse than this and a fix is more guess than position. */
export const MAX_ACCURACY_M = 35;
/** Slower than this between fixes is standing still, whatever GPS says. */
const MIN_MOVE_M = 3;
/** A jump implying more than this is a bad fix, not a sprint. Metres per second. */
const MAX_SPEED: Record<ActivitySport, number> = { run: 9, trail_run: 9, walk: 4, hike: 4, ride: 30, swim: 4, other: 30 };

export function startRecording(sport: ActivitySport, now: number): RecorderState {
  return { sport, status: 'recording', points: [], distanceM: 0, activeMs: 0, resumedAt: now, startedAt: now, rejected: 0, freshStretch: false };
}

export function addFix(s: RecorderState, f: Fix): RecorderState {
  if (s.status !== 'recording') return s;
  if (!Number.isFinite(f.lat) || !Number.isFinite(f.lon) || f.accuracy > MAX_ACCURACY_M) {
    return { ...s, rejected: s.rejected + 1 };
  }
  const point: TrackPoint = { t: f.t, lat: f.lat, lon: f.lon, ele: f.altitude, hr: null, cad: null, dist: null };
  const last = s.points[s.points.length - 1];
  // the first fix, or the first after a pause: wherever the athlete went while
  // paused is not distance they ran
  if (!last || last.lat == null || last.lon == null || last.t == null || s.freshStretch) {
    if (last?.t != null && f.t <= last.t) return s;
    return { ...s, points: [...s.points, { ...point, dist: s.distanceM }], freshStretch: false };
  }
  if (f.t <= last.t) return s; // out of order or repeated

  const step = haversine(last.lat, last.lon, f.lat, f.lon);
  const dt = (f.t - last.t) / 1000;
  if (step / dt > MAX_SPEED[s.sport]) return { ...s, rejected: s.rejected + 1 };
  // standing at a junction, GPS drifts a few metres: keep the time, not the drift
  const counted = step < MIN_MOVE_M ? 0 : step;
  const distanceM = s.distanceM + counted;
  const kept: TrackPoint = counted ? { ...point, dist: distanceM } : { ...last, t: f.t, ele: f.altitude ?? last.ele };
  return { ...s, points: [...s.points, kept], distanceM };
}

export function pause(s: RecorderState, now: number): RecorderState {
  if (s.status !== 'recording' || s.resumedAt == null) return s;
  return { ...s, status: 'paused', activeMs: s.activeMs + (now - s.resumedAt), resumedAt: null };
}

export function resume(s: RecorderState, now: number): RecorderState {
  if (s.status !== 'paused') return s;
  return { ...s, status: 'recording', resumedAt: now, freshStretch: true };
}

export function elapsedActiveMs(s: RecorderState, now: number): number {
  return s.activeMs + (s.status === 'recording' && s.resumedAt != null ? now - s.resumedAt : 0);
}

/** Pace over roughly the last `windowS` seconds, sec/km; null when standing or too little data. */
export function currentPace(s: RecorderState, windowS = 30): number | null {
  const pts = s.points;
  const last = pts[pts.length - 1];
  if (!last?.t || last.dist == null) return null;
  for (let i = pts.length - 2; i >= 0; i--) {
    const p = pts[i];
    if (p.t == null || p.dist == null) continue;
    const dt = (last.t - p.t) / 1000;
    if (dt >= windowS) {
      const dd = last.dist - p.dist;
      return dd > 10 ? Math.round((dt / dd) * 1000) : null;
    }
  }
  return null;
}

/** A recording worth saving: long enough to be an activity, not a pocket-dial. */
export function canSave(s: RecorderState, now: number): { ok: boolean; reason?: string } {
  if (s.points.length < 10) return { ok: false, reason: 'Not enough GPS to save yet.' };
  if (s.distanceM < 100) return { ok: false, reason: 'Under 100 m — nothing to save yet.' };
  if (elapsedActiveMs(s, now) < 60_000) return { ok: false, reason: 'Under a minute — nothing to save yet.' };
  return { ok: true };
}

const TCX_SPORT: Record<ActivitySport, string> = {
  run: 'Running',
  trail_run: 'Running',
  walk: 'Other',
  hike: 'Other',
  ride: 'Biking',
  swim: 'Other',
  other: 'Other',
};

/**
 * The recording as TCX. TCX rather than GPX because it carries distance on
 * every point: the import then uses the recorder's own cleaned distance —
 * jitter at a standstill removed, nothing added across a pause — instead of
 * re-deriving it from raw positions, which would bridge a pause with a
 * straight line. A pause shows as a gap in time, so moving time excludes it.
 */
export function toTcx(s: RecorderState): string {
  const first = s.points.find((p) => p.t != null);
  const id = new Date(first?.t ?? s.startedAt).toISOString();
  const pts = s.points
    .filter((p) => p.t != null && p.lat != null && p.lon != null)
    .map(
      (p) =>
        `<Trackpoint><Time>${new Date(p.t as number).toISOString()}</Time>` +
        `<Position><LatitudeDegrees>${(p.lat as number).toFixed(7)}</LatitudeDegrees><LongitudeDegrees>${(p.lon as number).toFixed(7)}</LongitudeDegrees></Position>` +
        (p.ele != null ? `<AltitudeMeters>${p.ele.toFixed(1)}</AltitudeMeters>` : '') +
        `<DistanceMeters>${(p.dist ?? 0).toFixed(1)}</DistanceMeters></Trackpoint>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2">
<Activities><Activity Sport="${TCX_SPORT[s.sport]}"><Id>${id}</Id><Lap StartTime="${id}"><Track>
${pts}
</Track></Lap><Creator><Name>Iron Miles Training</Name></Creator></Activity></Activities>
</TrainingCenterDatabase>
`;
}
