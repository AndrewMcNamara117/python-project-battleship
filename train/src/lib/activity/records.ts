import type { ActivitySport, TrackPoint } from './types';

/**
 * Best efforts and personal records.
 *
 * For each standard distance, the fastest stretch of that length anywhere
 * inside a run — the quick 5K in the middle of a long run counts, not only
 * runs that happened to be 5K. Found at import from the full track, which is
 * never stored; so activities imported before this existed have none, and
 * that is said rather than guessed.
 *
 * Wall time, the way a watch's own best-effort figures work: a stop at a
 * junction is in the time.
 */

export interface RecordDistance {
  key: string;
  label: string;
  metres: number;
}

export const RECORD_DISTANCES: RecordDistance[] = [
  { key: '1k', label: '1K', metres: 1000 },
  { key: 'mile', label: 'Mile', metres: 1609.344 },
  { key: '5k', label: '5K', metres: 5000 },
  { key: '10k', label: '10K', metres: 10000 },
  { key: 'half', label: 'Half marathon', metres: 21097.5 },
  { key: 'marathon', label: 'Marathon', metres: 42195 },
];

export interface BestEffort {
  key: string;
  elapsedS: number;
  /** Metres into the activity where the effort began. */
  startM: number;
}

/** Faster than the world record over the shortest distance here, so a doctored file or a car. */
const MAX_RUN_SPEED_MS = 7.2;
const RECORDED_SPORTS: ActivitySport[] = ['run', 'trail_run'];

/** The fastest `target` metres in the track, by two pointers. Null if the run is shorter. */
export function bestOver(points: TrackPoint[], cumulative: number[], target: number): BestEffort | null {
  const total = cumulative[cumulative.length - 1] ?? 0;
  if (total < target) return null;

  let best: { elapsed: number; startM: number } | null = null;
  let i = 0;
  for (let j = 1; j < points.length; j++) {
    const tj = points[j].t;
    if (tj == null) continue;
    // keep i as the last sample at or before cumulative[j] - target
    while (i + 1 < j && cumulative[i + 1] <= cumulative[j] - target) i++;
    if (cumulative[j] - cumulative[i] < target) continue;

    // interpolate the moment the effort began, exactly `target` metres back
    const a = points[i].t;
    const b = points[i + 1]?.t;
    const startM = cumulative[j] - target;
    if (a == null || b == null) continue;
    const span = cumulative[i + 1] - cumulative[i];
    const f = span > 0 ? (startM - cumulative[i]) / span : 0;
    const startT = a + (b - a) * Math.min(1, Math.max(0, f));
    const elapsed = (tj - startT) / 1000;
    if (elapsed > 0 && (!best || elapsed < best.elapsed)) best = { elapsed, startM };
  }
  if (!best) return null;
  return { key: '', elapsedS: Math.round(best.elapsed), startM: Math.round(best.startM) };
}

export function bestEfforts(points: TrackPoint[], cumulative: number[], sport: ActivitySport): BestEffort[] {
  if (!RECORDED_SPORTS.includes(sport) || !points.some((p) => p.t != null)) return [];
  const out: BestEffort[] = [];
  for (const d of RECORD_DISTANCES) {
    const e = bestOver(points, cumulative, d.metres);
    if (!e) break; // distances ascend: a run too short for this is too short for the rest
    if (d.metres / e.elapsedS > MAX_RUN_SPEED_MS) continue;
    out.push({ ...e, key: d.key });
  }
  return out;
}

export interface PersonalRecord {
  distance: RecordDistance;
  elapsedS: number;
  activityId: string;
  date: string;
}

/** The athlete's best at each distance across these activities. */
export function personalRecords(
  activities: { id: string; localDate: string; startedAt: string; bestEfforts: BestEffort[] }[],
): PersonalRecord[] {
  return RECORD_DISTANCES.flatMap((distance) => {
    let best: PersonalRecord | null = null;
    for (const a of activities) {
      const e = a.bestEfforts.find((x) => x.key === distance.key);
      // ties go to the earlier run: it got there first
      if (e && (!best || e.elapsedS < best.elapsedS || (e.elapsedS === best.elapsedS && a.localDate < best.date))) {
        best = { distance, elapsedS: e.elapsedS, activityId: a.id, date: a.localDate };
      }
    }
    return best ? [best] : [];
  });
}

/** Records this activity set, given the athlete's other activities: the ones it beat. */
export function newRecords(
  activity: { id: string; bestEfforts: BestEffort[] },
  others: { id: string; bestEfforts: BestEffort[] }[],
): { distance: RecordDistance; elapsedS: number; previousS: number | null }[] {
  return activity.bestEfforts.flatMap((e) => {
    const distance = RECORD_DISTANCES.find((d) => d.key === e.key);
    if (!distance) return [];
    const previous = others
      .filter((o) => o.id !== activity.id)
      .flatMap((o) => o.bestEfforts.filter((x) => x.key === e.key).map((x) => x.elapsedS));
    const prev = previous.length ? Math.min(...previous) : null;
    return prev == null || e.elapsedS < prev ? [{ distance, elapsedS: e.elapsedS, previousS: prev }] : [];
  });
}
