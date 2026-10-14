import { rpeFromZones, sessionLoad, strengthLoad, summariseLoad, type LoadSummary, type SessionLoad } from '@/lib/domain/load';
import type { CompletedWorkout, ISODate, StrengthSession } from '@/lib/domain/types';
import { zonesFromHistogram } from './analyse';
import type { Activity } from './types';

/**
 * An athlete's training load from everything logged: typed sessions, watch
 * files (heart rate standing in for a missing RPE), and strength work.
 */
export function athleteLoad(input: {
  completed: CompletedWorkout[];
  strength: StrengthSession[];
  activities: Activity[];
  maxHr: number | null;
  today: ISODate;
  windowDays?: number;
}): LoadSummary {
  const byLog = new Map(input.activities.filter((a) => a.completedWorkoutId).map((a) => [a.completedWorkoutId as string, a]));
  const sessions: SessionLoad[] = [];
  let unscored = 0;

  for (const c of input.completed) {
    if (c.type === 'strength' || c.type === 'rest') continue; // strength is scored from its own sets below
    const a = byLog.get(c.id);
    const estimated =
      c.rpe == null && a && input.maxHr && a.hrHistogram.length
        ? rpeFromZones(zonesFromHistogram(a.hrHistogram, input.maxHr).map((z) => z.seconds))
        : null;
    const load = sessionLoad(c, estimated);
    if (load) sessions.push(load);
    else unscored++;
  }
  for (const s of input.strength) {
    if (s.status !== 'completed') continue;
    const load = strengthLoad(s);
    if (load) sessions.push(load);
    else unscored++;
  }
  return summariseLoad(sessions, unscored, input.today, input.windowDays);
}
