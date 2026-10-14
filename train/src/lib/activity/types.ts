import type { SeriesPoint, Split } from './analyse';
import type { BestEffort } from './records';

/**
 * Activity files, normalised.
 *
 * A watch records one of three formats — FIT (binary, what Garmin, COROS,
 * Wahoo, Suunto and Polar write natively), GPX (XML, the lowest common
 * denominator), or TCX (Garmin's older XML). Each parser turns its format into
 * the same shape, so everything downstream — analysis, privacy, matching —
 * is written once.
 */

/** One sample. Any channel may be missing; most files omit some. */
export interface TrackPoint {
  /** Milliseconds since the Unix epoch. */
  t: number | null;
  lat: number | null;
  lon: number | null;
  /** Metres above sea level. */
  ele: number | null;
  /** Beats per minute. */
  hr: number | null;
  /** Steps or revolutions per minute, as the device reports it. */
  cad: number | null;
  /** Cumulative metres, when the device measured it (footpod, wheel, GPS fusion). */
  dist: number | null;
}

export type ActivityFormat = 'fit' | 'gpx' | 'tcx';

export type ActivitySport = 'run' | 'trail_run' | 'walk' | 'hike' | 'ride' | 'swim' | 'other';

export const SPORT_LABELS: Record<ActivitySport, string> = {
  run: 'Run',
  trail_run: 'Trail run',
  walk: 'Walk',
  hike: 'Hike',
  ride: 'Ride',
  swim: 'Swim',
  other: 'Activity',
};

/** Totals the device itself computed, preferred over our own where present. */
export interface DeviceSummary {
  distanceM: number | null;
  elapsedS: number | null;
  /** Timer time: elapsed minus auto-pause. */
  movingS: number | null;
  avgHr: number | null;
  maxHr: number | null;
  ascentM: number | null;
}

export interface ParsedActivity {
  format: ActivityFormat;
  sport: ActivitySport;
  name: string | null;
  /** ISO timestamp of the first sample, or the device's declared start. */
  startedAt: string | null;
  points: TrackPoint[];
  device: DeviceSummary | null;
}

/** Thrown for a file we can say something useful about. The message is shown to the athlete. */
export class ActivityFileError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ActivityFileError';
  }
}

/** Where an activity came in from. Files today; provider sync later, same table. */
export type ActivitySource = 'upload' | 'garmin' | 'coros' | 'strava';

/** Who besides the athlete may see it. The coach always can; the club only if chosen. */
export type ActivityVisibility = 'coach' | 'club';

/** Seconds spent at each heart rate, so zones can be re-cut when max HR changes. */
export type HrHistogram = [bpm: number, seconds: number][];

/**
 * An imported activity as stored.
 *
 * Numbers, not the file: the raw track is never kept. The route is the
 * privacy-trimmed, simplified line; everything else is a computed figure.
 */
export interface Activity {
  id: string;
  athleteId: string;
  source: ActivitySource;
  format: ActivityFormat;
  /** sha256 of the file bytes; the same file twice is the same activity. */
  fingerprint: string;
  name: string;
  sport: ActivitySport;
  startedAt: string;
  /** The athlete's calendar date the activity started on. */
  localDate: string;
  distanceM: number;
  movingS: number;
  elapsedS: number;
  avgPaceSecPerKm: number | null;
  avgHr: number | null;
  maxHr: number | null;
  ascentM: number | null;
  descentM: number | null;
  /** Encoded polyline segments joined by `;`, after privacy trimming. Null without GPS. */
  route: string | null;
  privacyTrimM: number;
  splits: Split[];
  series: SeriesPoint[];
  hrHistogram: HrHistogram;
  /** Fastest standard distances inside this run, found at import. */
  bestEfforts: BestEffort[];
  scheduledWorkoutId: string | null;
  completedWorkoutId: string | null;
  visibility: ActivityVisibility;
  createdAt: string;
}

export type ActivityDraft = Omit<Activity, 'id' | 'createdAt'>;

/**
 * A shared activity as the club sees it. Deliberately not an `Activity`:
 * no heart rate, no splits, no link to the plan — those stay between the
 * athlete and their coach.
 */
export interface FeedItem {
  id: string;
  athleteId: string;
  athleteName: string;
  trainingGroup: string | null;
  name: string;
  sport: ActivitySport;
  startedAt: string;
  localDate: string;
  distanceM: number;
  movingS: number;
  avgPaceSecPerKm: number | null;
  ascentM: number | null;
  route: string | null;
  privacyTrimM: number;
  kudosCount: number;
  commentCount: number;
  viewerKudos: boolean;
}

export interface ActivityComment {
  id: string;
  authorId: string;
  authorName: string;
  body: string;
  createdAt: string;
}

export interface ActivitySocial {
  comments: ActivityComment[];
  kudos: { athleteId: string; name: string; createdAt: string }[];
}

/** The shareable columns of an activity, in the shape the feed uses. */
export function toFeedItem(
  a: Activity,
  athlete: { fullName: string; trainingGroup: string | null },
  social: { kudosCount: number; commentCount: number; viewerKudos: boolean },
): FeedItem {
  return {
    id: a.id,
    athleteId: a.athleteId,
    athleteName: athlete.fullName,
    trainingGroup: athlete.trainingGroup,
    name: a.name,
    sport: a.sport,
    startedAt: a.startedAt,
    localDate: a.localDate,
    distanceM: a.distanceM,
    movingS: a.movingS,
    avgPaceSecPerKm: a.avgPaceSecPerKm,
    ascentM: a.ascentM,
    route: a.route,
    privacyTrimM: a.privacyTrimM,
    ...social,
  };
}
