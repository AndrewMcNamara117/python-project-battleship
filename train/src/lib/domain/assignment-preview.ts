import { addDays } from './dates';
import type {
  AssignmentConflict,
  AssignmentPreview,
  ProgramTemplate,
  ProgramTemplateSlot,
  TemplateWeekVolume,
} from './programme-template';
import type { Goal, Profile, Program, Race, Weekday } from './types';

/**
 * Assemble what the coach sees before assigning.
 *
 * Shared by both adapters deliberately: a preview that differs between demo
 * and Postgres would be a preview nobody could trust. The conflicts come from
 * the database, which is the only thing that can authoritatively answer them;
 * everything else here is arrangement.
 */
export function buildAssignmentPreview(input: {
  template: ProgramTemplate;
  profile: Profile | null;
  conflicts: AssignmentConflict[];
  weeks: TemplateWeekVolume[];
  goal: Goal | null;
  race: Race | null;
  program: Program | null;
  slots: ProgramTemplateSlot[];
  startDate: string;
}): AssignmentPreview {
  const { template, profile, conflicts, weeks, goal, race, program, slots, startDate } = input;

  const templateDays = [...new Set(slots.filter((s) => !s.isRest).map((s) => s.weekday))]
    .sort((a, b) => a - b) as Weekday[];

  // the sessions a coach eyeballs before committing: the hardest run of each
  // week, which is what tells them whether the programme is the right shape
  const keySessions = weeks
    .map((w) => {
      const week = slots.filter((s) => !s.isRest && s.distanceKm != null);
      const longest = week.sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0))[0];
      return longest && longest.label
        ? { templateWeekNo: w.templateWeekNo, weekday: longest.weekday, name: longest.label }
        : null;
    })
    .filter(Boolean) as AssignmentPreview['keySessions'];

  return {
    template,
    athleteName: profile?.fullName ?? 'This athlete',
    availableDays: profile?.availableTrainingDays ?? [],
    preferredDays: profile?.preferredTrainingDays ?? [],
    templateDays,
    startDate,
    endDate: addDays(startDate, Math.max(template.weeks, 1) * 7 - 1),
    goal: goal
      ? {
          eventType: goal.eventType ?? null,
          targetDate: goal.targetDate ?? null,
          raceName: race?.name ?? null,
          raceDate: race?.date ?? null,
        }
      : null,
    weeks,
    conflicts,
    keySessions,
    activeProgramme: program ? { id: program.id, name: program.name } : null,
  };
}
