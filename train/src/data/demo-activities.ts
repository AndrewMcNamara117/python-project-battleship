import { buildActivity, fingerprint } from '@/lib/activity/import';
import { syntheticRun } from '@/lib/activity/fixtures';
import type { Activity } from '@/lib/activity/types';
import { isRun } from '@/lib/domain/analytics';
import type { CompletedWorkout, Profile } from '@/lib/domain/types';

/**
 * Watch files for the demo athlete's recent runs.
 *
 * Built through the real import pipeline from synthetic tracks, so what the
 * demo shows — routes, splits, zones — is exactly what an upload produces.
 * Only the last three weeks: older history stays as manual logs, which is
 * what an athlete who started uploading recently would actually have.
 */

/** Loops around Limerick: the UL riverside, the Canal bank, and Castletroy. */
const CENTRES: [number, number][] = [
  [52.6735, -8.5713],
  [52.6593, -8.6105],
  [52.6681, -8.5502],
];

const HR_BY_TYPE: Record<string, number> = {
  recovery_run: 128,
  easy_run: 136,
  long_run: 140,
  progression_run: 148,
  tempo: 160,
  threshold: 163,
  intervals: 158,
  hills: 156,
  race_pace: 158,
};

const enc = new TextEncoder();

export function demoActivities(completed: CompletedWorkout[], profiles: Profile[]): Activity[] {
  const dates = completed.map((c) => c.date).sort();
  const latest = dates[dates.length - 1];
  if (!latest) return [];
  const cutoff = new Date(Date.parse(`${latest}T00:00:00Z`) - 21 * 86_400_000).toISOString().slice(0, 10);

  const out: Activity[] = [];
  completed
    .filter((c) => c.date >= cutoff && isRun(c.type) && (c.actualDistanceKm ?? 0) > 0)
    .forEach((c, i) => {
      const profile = profiles.find((p) => p.id === c.athleteId);
      const points = syntheticRun({
        start: `${c.date}T06:40:00Z`,
        distanceKm: c.actualDistanceKm as number,
        paceSecPerKm: c.averagePaceSecPerKm ?? 330,
        intervalS: 4,
        centre: CENTRES[i % CENTRES.length],
        baseHr: HR_BY_TYPE[c.type] ?? 140,
        hillM: c.type === 'hills' ? 30 : 10,
      });
      const { draft } = buildActivity(
        { format: 'fit', sport: 'run', name: null, startedAt: new Date(points[0].t as number).toISOString(), points, device: null },
        fingerprint(enc.encode(`demo-${c.id}`)),
        {
          athleteId: c.athleteId,
          timeZone: profile?.timezone ?? 'Europe/Dublin',
          privacyTrimM: profile?.privacyTrimM ?? 200,
          units: profile?.units,
        },
      );
      out.push({
        ...draft,
        id: `act-${c.id}`,
        scheduledWorkoutId: c.scheduledWorkoutId,
        completedWorkoutId: c.id,
        createdAt: `${c.date}T08:00:00.000Z`,
      });
    });
  return out;
}
