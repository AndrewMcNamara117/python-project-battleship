import type { ExtractionMetadata, ExtractionNote, ExtractionPreview } from './programme-template';
import type { ISODate, UUID } from './types';

/**
 * Assemble what the coach reads before saving a programme as a template.
 *
 * Shared by both adapters. The notes come from the database, which is the
 * only thing that can authoritatively answer what is in the programme;
 * everything here is counting and arrangement.
 */
export function buildExtractionPreview(input: {
  programId: UUID;
  programName: string;
  athleteName: string;
  blockCount: number;
  weekCount: number;
  sessions: { date: ISODate; type: string; weekId: UUID }[];
  goalEventType: string | null;
  notes: ExtractionNote[];
}): ExtractionPreview {
  const { programId, programName, athleteName, blockCount, weekCount, sessions, goalEventType, notes } = input;

  const training = sessions.filter((s) => s.type !== 'rest');

  // days a week, read off what the coach actually built rather than asked for
  const daysPerWeek = new Map<UUID, Set<number>>();
  for (const s of training) {
    const iso = ((new Date(s.date).getUTCDay() + 6) % 7) + 1;
    const set = daysPerWeek.get(s.weekId) ?? new Set<number>();
    set.add(iso);
    daysPerWeek.set(s.weekId, set);
  }
  const counts = [...daysPerWeek.values()].map((set) => set.size);

  const suggested: ExtractionMetadata = {
    // the athlete's name is theirs; the template gets the programme's
    name: `${programName} — template`,
    visibility: 'private',
    discipline: 'running',
    goalType: goalEventType,
    targetDistanceKm: null,
    experienceLevel: null,
    minDaysPerWeek: counts.length ? Math.min(...counts) : null,
    maxDaysPerWeek: counts.length ? Math.max(...counts) : null,
    purpose: null,
    coachNotes: null,
  };

  return {
    programId,
    programName,
    athleteName,
    blocks: blockCount,
    weeks: weekCount,
    sessions: training.length,
    restDays: sessions.length - training.length,
    minDaysPerWeek: suggested.minDaysPerWeek,
    maxDaysPerWeek: suggested.maxDaysPerWeek,
    notes,
    suggested,
  };
}
