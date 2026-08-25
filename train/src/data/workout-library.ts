import type { ProgramTemplate, WorkoutTemplate } from '@/lib/domain/types';

const now = '2025-01-01T00:00:00.000Z';

const t = (
  id: string,
  name: string,
  type: WorkoutTemplate['type'],
  basis: WorkoutTemplate['basis'],
  intensity: WorkoutTemplate['intensity'],
  rest: Partial<WorkoutTemplate>,
): WorkoutTemplate => ({
  id,
  ownerId: null,
  isShared: true,
  createdAt: now,
  name,
  type,
  basis,
  intensity,
  distanceKm: null,
  durationMinutes: null,
  paceRange: null,
  hrZone: null,
  rpeTarget: null,
  warmUp: null,
  mainSet: null,
  coolDown: null,
  notes: null,
  ...rest,
});

/**
 * The shared workout library. Every entry is a starting point a coach edits —
 * paces, zones and durations are defaults, not prescriptions.
 */
export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  t('wt-easy', 'Easy Run', 'easy_run', 'distance', 'easy', {
    distanceKm: 8,
    durationMinutes: 50,
    hrZone: 2,
    rpeTarget: 3,
    mainSet: 'Continuous easy running. Conversational the whole way.',
    notes: 'If you cannot speak in full sentences, you are going too hard.',
  }),
  t('wt-recovery', 'Recovery Run', 'recovery_run', 'time', 'recovery', {
    distanceKm: 6,
    durationMinutes: 35,
    hrZone: 1,
    rpeTarget: 2,
    mainSet: 'Very easy. Flat route. Shorter than it feels like it should be.',
    notes: 'The point is blood flow, not fitness.',
  }),
  t('wt-long', 'Long Run', 'long_run', 'distance', 'easy', {
    distanceKm: 22,
    durationMinutes: 135,
    hrZone: 2,
    rpeTarget: 4,
    warmUp: 'First 15 minutes deliberately slower than target.',
    mainSet: 'Steady, controlled effort. Practise race-day fuelling.',
    coolDown: '10 minutes easy walking.',
    notes: 'Fuel early. Start controlled. Finish stronger than you started.',
  }),
  t('wt-progression', 'Progression Run', 'progression_run', 'distance', 'steady', {
    distanceKm: 14,
    durationMinutes: 75,
    rpeTarget: 6,
    mainSet: 'Three equal thirds: easy, steady, then marathon effort.',
    notes: 'Negative split or it does not count.',
  }),
  t('wt-tempo', 'Tempo', 'tempo', 'time', 'hard', {
    distanceKm: 12,
    durationMinutes: 60,
    hrZone: 4,
    rpeTarget: 7,
    warmUp: '15 min easy + 4 x 20s strides.',
    mainSet: '25 minutes continuous at comfortably hard. You could hold it for an hour on race day.',
    coolDown: '12 min easy.',
  }),
  t('wt-threshold', 'Threshold Intervals', 'threshold', 'time', 'hard', {
    distanceKm: 13,
    durationMinutes: 65,
    hrZone: 4,
    rpeTarget: 8,
    warmUp: '15 min easy + drills + 4 x 20s strides.',
    mainSet: '6 x 5 min at threshold, 90s easy jog between.',
    coolDown: '12 min easy.',
    notes: 'Controlled discomfort, not a race. Same pace on the last rep as the first.',
  }),
  t('wt-intervals', 'VO2 Intervals', 'intervals', 'time', 'max', {
    distanceKm: 12,
    durationMinutes: 60,
    hrZone: 5,
    rpeTarget: 9,
    warmUp: '15 min easy + drills + 4 x 100m strides.',
    mainSet: '5 x 3 min hard, 3 min easy jog recovery.',
    coolDown: '12 min easy.',
  }),
  t('wt-hills', 'Hill Repeats', 'hills', 'time', 'hard', {
    distanceKm: 11,
    durationMinutes: 55,
    rpeTarget: 8,
    warmUp: '15 min easy to the hill.',
    mainSet: '8 x 60s uphill at hard effort. Jog down as recovery.',
    coolDown: '12 min easy.',
    notes: 'Strength in disguise. Tall posture, quick feet.',
  }),
  t('wt-race-pace', 'Race Pace', 'race_pace', 'pace', 'steady', {
    distanceKm: 16,
    durationMinutes: 85,
    rpeTarget: 6,
    warmUp: '15 min easy.',
    mainSet: '3 x 15 min at goal race pace, 3 min float between.',
    coolDown: '10 min easy.',
    notes: 'Rehearsal, not a test.',
  }),
  t('wt-brick', 'Brick Session', 'brick', 'time', 'steady', {
    durationMinutes: 90,
    rpeTarget: 6,
    mainSet: '60 min bike at steady effort, straight into 25 min run off the bike.',
    notes: 'The first 10 minutes off the bike always feel wrong. Run through it.',
  }),
  t('wt-bike', 'Bike — Endurance', 'bike', 'time', 'easy', {
    durationMinutes: 90,
    hrZone: 2,
    rpeTarget: 4,
    mainSet: 'Steady aerobic riding. Smooth cadence, 85–95rpm.',
  }),
  t('wt-swim', 'Swim — Technique + Endurance', 'swim', 'time', 'steady', {
    durationMinutes: 45,
    rpeTarget: 5,
    warmUp: '400m mixed.',
    mainSet: '8 x 100m steady, 20s rest. Focus on catch.',
    coolDown: '200m easy.',
  }),
  t('wt-cross', 'Cross Training', 'cross_training', 'time', 'easy', {
    durationMinutes: 45,
    hrZone: 2,
    rpeTarget: 4,
    mainSet: 'Low-impact aerobic work — bike, row, elliptical or pool.',
    notes: 'Aerobic stimulus without the pounding.',
  }),
  t('wt-mobility', 'Mobility', 'mobility', 'time', 'recovery', {
    durationMinutes: 20,
    rpeTarget: 1,
    mainSet: 'Hips, ankles, thoracic spine. Slow and unhurried.',
  }),
  t('wt-rest', 'Rest', 'rest', 'time', 'rest', {
    mainSet: 'Complete rest. This is a session — treat it like one.',
    notes: 'Adaptation happens here, not in the session you skipped it for.',
  }),
  t('wt-race', 'Race Day', 'race', 'distance', 'max', {
    rpeTarget: 10,
    mainSet: 'Execute the plan. Nothing new on race day.',
    notes: 'The work is done. Trust it.',
  }),
];

export function workoutTemplateById(id: string): WorkoutTemplate | undefined {
  return WORKOUT_TEMPLATES.find((w) => w.id === id);
}

/**
 * Programme templates. Week counts and structure are a coach's starting frame;
 * every assigned programme becomes an independent, individually editable copy.
 */
export const PROGRAM_TEMPLATES: ProgramTemplate[] = [
  {
    id: 'pt-5k',
    name: '5K — Sharpen',
    goalType: '5k',
    weeks: 8,
    description:
      'Eight weeks around one hard session and one sharpening session per week. Built for someone who already runs three or four times a week.',
    ownerId: null,
    isShared: true,
    createdAt: now,
  },
  {
    id: 'pt-10k',
    name: '10K — Build',
    goalType: '10k',
    weeks: 10,
    description: 'Threshold-led ten-week block. Enough volume to hold the pace, enough speed to find it.',
    ownerId: null,
    isShared: true,
    createdAt: now,
  },
  {
    id: 'pt-half',
    name: 'Half Marathon — Foundation to Start Line',
    goalType: 'half_marathon',
    weeks: 14,
    description: 'Fourteen weeks. Long run progression, one quality session, two strength sessions a week throughout.',
    ownerId: null,
    isShared: true,
    createdAt: now,
  },
  {
    id: 'pt-marathon',
    name: 'Marathon — The Long Way',
    goalType: 'marathon',
    weeks: 18,
    description:
      'Eighteen weeks with three build blocks and a three-week taper. Race-pace work lives in the long run, where it belongs.',
    ownerId: null,
    isShared: true,
    createdAt: now,
  },
  {
    id: 'pt-ultra',
    name: 'Ultra — Time on Feet',
    goalType: 'ultra',
    weeks: 24,
    description:
      'Twenty-four weeks built around back-to-back long runs, terrain specificity and durability work. Volume rises slowly and steps back every fourth week.',
    ownerId: null,
    isShared: true,
    createdAt: now,
  },
  {
    id: 'pt-70-3',
    name: '70.3 — Three Disciplines',
    goalType: 'triathlon_70_3',
    weeks: 20,
    description: 'Twenty weeks balancing swim, bike and run with weekly brick work and triathlon-specific strength.',
    ownerId: null,
    isShared: true,
    createdAt: now,
  },
  {
    id: 'pt-general',
    name: 'General Endurance',
    goalType: 'general_endurance',
    weeks: 12,
    description:
      'No start line yet. Aerobic base, consistent strength, and the habit of showing up. The best place to begin.',
    ownerId: null,
    isShared: true,
    createdAt: now,
  },
];

export function programTemplateById(id: string): ProgramTemplate | undefined {
  return PROGRAM_TEMPLATES.find((p) => p.id === id);
}
