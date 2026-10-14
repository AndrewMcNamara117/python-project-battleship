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

/* ---------------- the club ---------------- */

interface ClubRun {
  member: string;
  daysAgo: number;
  name: string;
  km: number;
  pace: number;
  hour: string;
  centre: number;
  hill: number;
}

/** A believable fortnight of the club's shared running. */
const CLUB_RUNS: ClubRun[] = [
  { member: 'demo-athlete-2', daysAgo: 0, name: 'Canal bank tempo', km: 10, pace: 268, hour: '06:10', centre: 1, hill: 6 },
  { member: 'demo-athlete-3', daysAgo: 1, name: 'Clare Glens long one', km: 24, pace: 345, hour: '08:00', centre: 2, hill: 60 },
  { member: 'demo-athlete-5', daysAgo: 1, name: 'Easy before work', km: 8, pace: 330, hour: '06:30', centre: 0, hill: 8 },
  { member: 'demo-athlete-4', daysAgo: 2, name: 'Hills at Castletroy', km: 9, pace: 315, hour: '18:30', centre: 2, hill: 35 },
  { member: 'demo-athlete-7', daysAgo: 3, name: 'Back-to-back, day two', km: 18, pace: 360, hour: '07:30', centre: 0, hill: 40 },
  { member: 'demo-athlete-8', daysAgo: 3, name: 'Parkrun shakeout', km: 5, pace: 290, hour: '09:30', centre: 1, hill: 4 },
  { member: 'demo-athlete-2', daysAgo: 4, name: 'Recovery jog', km: 6, pace: 355, hour: '12:30', centre: 0, hill: 5 },
  { member: 'demo-athlete-6', daysAgo: 5, name: 'Riverside 12', km: 12, pace: 320, hour: '07:00', centre: 0, hill: 10 },
  { member: 'demo-athlete-9', daysAgo: 6, name: 'Marathon pace 3 x 5K', km: 18, pace: 285, hour: '08:15', centre: 1, hill: 8 },
  { member: 'demo-athlete-3', daysAgo: 8, name: 'Night trail with headtorch', km: 14, pace: 372, hour: '19:30', centre: 2, hill: 70 },
];

const CLUB_COMMENTS: [run: number, author: string, body: string][] = [
  [0, 'demo-athlete-3', 'Flying, Ciara. That bank is a headwind both ways somehow.'],
  [0, 'demo-coach', 'Even splits — that is the session done properly.'],
  [1, 'demo-athlete-7', 'Fair play. The second climb at the Glens is cruel.'],
  [3, 'demo-athlete-2', 'Same hills Thursday?'],
  [3, 'demo-athlete-4', 'Go on so. 6:30 at the Kilmurry gate.'],
  [8, 'demo-athlete-5', 'Steady as a metronome.'],
];

/**
 * Shared activities from the rest of the club, with kudos and comments, plus
 * the lead athlete's most recent run shared so they see the other side of it.
 */
export function demoClub(
  own: Activity[],
  profiles: Profile[],
  today: string,
): { activities: Activity[]; kudos: { activityId: string; athleteId: string; createdAt: string }[]; comments: { id: string; activityId: string; authorId: string; body: string; createdAt: string }[] } {
  const club: Activity[] = CLUB_RUNS.map((r, i) => {
    const date = new Date(Date.parse(`${today}T00:00:00Z`) - r.daysAgo * 86_400_000).toISOString().slice(0, 10);
    const points = syntheticRun({
      start: `${date}T${r.hour}:00Z`,
      distanceKm: r.km,
      paceSecPerKm: r.pace,
      intervalS: 5,
      centre: CENTRES[r.centre],
      hillM: r.hill,
      baseHr: 140,
    });
    const profile = profiles.find((p) => p.id === r.member);
    const { draft } = buildActivity(
      { format: 'fit', sport: r.hill >= 60 ? 'trail_run' : 'run', name: r.name, startedAt: new Date(points[0].t as number).toISOString(), points, device: null },
      fingerprint(enc.encode(`demo-club-${i}-${r.member}`)),
      { athleteId: r.member, timeZone: profile?.timezone ?? 'Europe/Dublin', privacyTrimM: 200 },
    );
    return { ...draft, id: `act-club-${i}`, visibility: 'club', createdAt: `${date}T${r.hour}:00.000Z` };
  });

  const latestOwn = [...own].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
  const ownShared = own.map((a) => (a === latestOwn ? { ...a, visibility: 'club' as const } : a));

  const members = profiles.filter((p) => p.role === 'athlete').map((p) => p.id);
  const kudos: { activityId: string; athleteId: string; createdAt: string }[] = [];
  [...club, ...(latestOwn ? [latestOwn] : [])].forEach((a, i) => {
    // a deterministic handful of the club, never the runner themselves
    members
      .filter((m, j) => m !== a.athleteId && (i + j) % 3 !== 0)
      .slice(0, 2 + (i % 5))
      .forEach((m, j) => kudos.push({ activityId: a.id, athleteId: m, createdAt: new Date(Date.parse(a.startedAt) + (j + 1) * 3_600_000).toISOString() }));
  });

  const comments = CLUB_COMMENTS.map(([run, author, body], i) => ({
    id: `cmt-demo-${i}`,
    activityId: club[run].id,
    authorId: author,
    body,
    createdAt: new Date(Date.parse(club[run].startedAt) + (i + 2) * 1_800_000).toISOString(),
  }));
  if (latestOwn) {
    comments.push({
      id: 'cmt-demo-own',
      activityId: latestOwn.id,
      authorId: 'demo-athlete-2',
      body: 'Nice one Andrew — see you Saturday.',
      createdAt: new Date(Date.parse(latestOwn.startedAt) + 5_400_000).toISOString(),
    });
  }

  return { activities: [...ownShared, ...club], kudos, comments };
}
