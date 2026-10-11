import { addDays } from './dates';
import type {
  AssignmentConflict,
  AssignmentPreview,
  ProgramTemplate,
  ProgramTemplateDetail,
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
  athleteId: string;
  profile: Profile | null;
  conflicts: AssignmentConflict[];
  weeks: TemplateWeekVolume[];
  goal: Goal | null;
  race: Race | null;
  program: Program | null;
  detail: ProgramTemplateDetail;
  /** Library names, so a slot that points at a session can be read as one. */
  sessionNames: Map<string, string>;
  startDate: string;
}): AssignmentPreview {
  const { template, athleteId, profile, conflicts, weeks, goal, race, program, detail, sessionNames, startDate } = input;

  const allWeeks = detail.blocks.flatMap((b) => b.weeks);
  const allSlots = allWeeks.flatMap((w) => w.slots);

  const templateDays = [...new Set(allSlots.filter((s) => !s.isRest).map((s) => s.weekday))]
    .sort((a, b) => a - b) as Weekday[];

  /**
   * The session a coach eyeballs before committing: the longest run of each
   * week. It is what tells them whether the programme is the right shape for
   * this athlete faster than any total does.
   */
  const keySessions = allWeeks
    .map((w) => {
      const longest = w.slots
        .filter((s) => !s.isRest && s.distanceKm != null)
        .sort((a, b) => (b.distanceKm ?? 0) - (a.distanceKm ?? 0))[0];
      if (!longest) return null;
      const name = longest.label
        ?? sessionNames.get(longest.workoutTemplateId ?? longest.strengthTemplateId ?? '')
        ?? 'Session';
      return {
        templateWeekNo: w.templateWeekNo,
        weekday: longest.weekday,
        name,
        distanceKm: longest.distanceKm,
      };
    })
    .filter(Boolean) as AssignmentPreview['keySessions'];

  return {
    template,
    athleteId,
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
