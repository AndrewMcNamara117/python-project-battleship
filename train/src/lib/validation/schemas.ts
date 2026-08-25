import { z } from 'zod';

/**
 * One schema per form, shared by the client (React Hook Form) and the server
 * action that receives it. Client-side validation is a convenience; the server
 * parse is the one that counts.
 */

export const applicationSchema = z.object({
  fullName: z.string().trim().min(2, 'Tell us your name').max(120),
  email: z.email('That does not look like an email address').max(200),
  phone: z.string().trim().max(40).optional().or(z.literal('')),
  goal: z.string().trim().min(10, 'A sentence or two is plenty').max(2000),
  targetRace: z.string().trim().max(200).optional().or(z.literal('')),
  targetDate: z.string().trim().max(10).optional().or(z.literal('')),
  currentWeeklyKm: z.coerce.number().min(0).max(400).optional(),
  experience: z.string().trim().min(10, 'Give us a little more detail').max(2000),
  injuries: z.string().trim().max(2000).optional().or(z.literal('')),
  startWhen: z.string().trim().min(2).max(200),
  consent: z.literal(true, { message: 'We need your consent to process this' }),
});

export type ApplicationInput = z.infer<typeof applicationSchema>;

export const credentialsSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(8, 'At least 8 characters'),
});

export const registerSchema = credentialsSchema.extend({
  fullName: z.string().trim().min(2, 'Tell us your name').max(120),
  acceptTerms: z.literal(true, { message: 'You need to accept the terms to continue' }),
});

export const logWorkoutSchema = z.object({
  scheduledWorkoutId: z.string().min(1),
  actualDistanceKm: z.coerce.number().min(0).max(500).nullable().optional(),
  actualDurationMinutes: z.coerce.number().int().min(0).max(2880).nullable().optional(),
  averageHeartRate: z.coerce.number().int().min(30).max(240).nullable().optional(),
  maxHeartRate: z.coerce.number().int().min(30).max(250).nullable().optional(),
  rpe: z.coerce.number().int().min(1).max(10).nullable().optional(),
  sessionRating: z.coerce.number().int().min(1).max(5).nullable().optional(),
  soreness: z.coerce.number().int().min(1).max(10).nullable().optional(),
  athleteNotes: z.string().trim().max(2000).nullable().optional(),
});

export const checkInSchema = z.object({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fatigue: z.coerce.number().int().min(1).max(10),
  sleep: z.coerce.number().int().min(1).max(10),
  soreness: z.coerce.number().int().min(1).max(10),
  stress: z.coerce.number().int().min(1).max(10),
  motivation: z.coerce.number().int().min(1).max(10),
  confidence: z.coerce.number().int().min(1).max(10),
  trainingDifficulty: z.coerce.number().int().min(1).max(10),
  wentWell: z.string().trim().max(2000).default(''),
  feltDifficult: z.string().trim().max(2000).default(''),
  painOrNiggles: z.string().trim().max(2000).default(''),
  affectingTraining: z.string().trim().max(2000).default(''),
  confidenceNextWeek: z.string().trim().max(2000).default(''),
  forCoach: z.string().trim().max(2000).default(''),
});

export const messageSchema = z.object({
  body: z.string().trim().min(1, 'Write something first').max(4000),
});

/* ---------- onboarding, one schema per step ---------- */

export const onboardingStepSchemas = {
  personal: z.object({
    fullName: z.string().trim().min(2, 'Tell us your name').max(120),
    dateOfBirth: z.string().trim().min(1, 'We need this to set training zones safely'),
    location: z.string().trim().min(2, 'Where are you training?').max(160),
    timezone: z.string().trim().min(1),
    units: z.enum(['metric', 'imperial']),
  }),
  goal: z.object({
    raceName: z.string().trim().max(200).default(''),
    raceDate: z.string().trim().min(1, 'Pick a date, even an approximate one'),
    eventType: z.enum([
      '5k',
      '10k',
      'half_marathon',
      'marathon',
      'ultra',
      'triathlon_70_3',
      'triathlon_olympic',
      'general_endurance',
    ]),
    outcome: z.enum(['time', 'completion', 'placing', 'process']),
    targetTime: z.string().trim().max(20).default(''),
    why: z.string().trim().min(10, 'This is the part that matters. A sentence is enough.').max(1200),
  }),
  history: z.object({
    weeklyKm: z.coerce.number().min(0).max(400),
    sessionsPerWeek: z.coerce.number().int().min(0).max(14),
    longestRecentKm: z.coerce.number().min(0).max(300),
    personalBests: z.string().trim().max(1000).default(''),
    enduranceBackground: z.string().trim().max(2000).default(''),
    strengthBackground: z.string().trim().max(2000).default(''),
  }),
  availability: z.object({
    trainingDays: z.array(z.string()).min(1, 'Pick at least one day you can train'),
    longRunDay: z.string().min(1, 'Which day suits the long run?'),
    typicalSessionMinutes: z.coerce.number().int().min(15).max(360),
    gymAccess: z.enum(['full_gym', 'home_gym', 'bodyweight', 'none']),
    equipment: z.array(z.string()).default([]),
  }),
  health: z.object({
    currentInjuries: z.string().trim().max(2000).default(''),
    recentInjuries: z.string().trim().max(2000).default(''),
    parqFlags: z.array(z.string()).default([]),
    medicalClearance: z.boolean(),
    acknowledgedDisclaimer: z.literal(true, {
      message: 'Please confirm you have read this before continuing',
    }),
  }),
  preferences: z.object({
    feedbackStyle: z.enum(['direct', 'encouraging', 'analytical']),
    motivationStyle: z.enum(['data', 'process', 'community', 'challenge']),
    messagingPreference: z.enum(['in_app', 'email', 'both']),
    checkInFrequency: z.enum(['weekly', 'fortnightly']),
    forgeAssistantEnabled: z.boolean(),
    leaderboardOptIn: z.boolean(),
  }),
} as const;
