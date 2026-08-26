import type { ExperienceLevel, GymAccess, OnboardingData, Profile, Weekday } from './types';

/**
 * Onboarding answers → athlete profile columns.
 *
 * One mapping, used by both adapters, so the two backends cannot disagree about
 * what an athlete told us. The answers still land in `athlete_onboarding.data`
 * as the verbatim record; these are the queryable projections the coach
 * dashboard needs.
 */

const DAY_TO_ISO: Record<string, Weekday> = {
  monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6, sunday: 7,
};

export function toWeekdays(names: string[] | undefined): Weekday[] {
  if (!names?.length) return [];
  const seen = new Set<Weekday>();
  for (const n of names) {
    const iso = DAY_TO_ISO[n.trim().toLowerCase()];
    if (iso) seen.add(iso);
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * Experience banded from stated weekly volume.
 *
 * A deliberately coarse first guess a coach can correct, not a judgement — the
 * field is coach-editable precisely because kilometres alone do not describe an
 * athlete.
 */
export function bandExperience(weeklyKm: number | undefined): ExperienceLevel | null {
  if (weeklyKm == null || Number.isNaN(weeklyKm)) return null;
  if (weeklyKm >= 60) return 'competitive';
  if (weeklyKm >= 35) return 'experienced';
  if (weeklyKm >= 15) return 'developing';
  return 'beginner';
}

export function profileFieldsFromOnboarding(data: Partial<OnboardingData>): Partial<Profile> {
  const history = data.history;
  const availability = data.availability;
  const health = data.health;

  const available = toWeekdays(availability?.trainingDays);

  return {
    experienceLevel: bandExperience(history?.weeklyKm),
    currentWeeklyKm: history?.weeklyKm ?? null,
    availableTrainingDays: available,
    // nothing distinguishes preference from availability at onboarding, so they
    // start equal and diverge when the athlete says otherwise
    preferredTrainingDays: available,
    typicalSessionMinutes: availability?.typicalSessionMinutes ?? null,
    gymAccess: (availability?.gymAccess as GymAccess | undefined) ?? null,
    equipment: availability?.equipment ?? [],
    injuryNotes: health?.currentInjuries?.trim() || null,
    limitationsNotes: health?.recentInjuries?.trim() || null,
  };
}
