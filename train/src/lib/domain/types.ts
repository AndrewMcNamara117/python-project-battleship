/* ============================================================
   IRON MILES TRAINING — domain model
   Mirrors the Postgres schema in supabase/migrations.
   ============================================================ */

export type UUID = string;
/** ISO date, YYYY-MM-DD. Training is scheduled by calendar day, not instant. */
export type ISODate = string;
/** ISO 8601 timestamp. */
export type ISOTimestamp = string;

export type Role = 'athlete' | 'coach' | 'admin';
export type Units = 'metric' | 'imperial';

/* ---------------- identity ---------------- */

export interface Profile {
  id: UUID;
  role: Role;
  fullName: string;
  email: string;
  avatarUrl: string | null;
  dateOfBirth: ISODate | null;
  location: string | null;
  timezone: string;
  units: Units;
  createdAt: ISOTimestamp;
  onboardedAt: ISOTimestamp | null;
  /** Explicit, revocable consent for processing training + wellbeing data. */
  healthDataConsentAt: ISOTimestamp | null;
  /** Leaderboard visibility is opt-in, never on by default. */
  leaderboardOptIn: boolean;
  /** Coach can silence the automated assistant per athlete. */
  forgeAssistantEnabled: boolean;
}

export interface CoachAthleteLink {
  id: UUID;
  coachId: UUID;
  athleteId: UUID;
  status: 'pending' | 'active' | 'paused' | 'ended';
  startedAt: ISOTimestamp;
  endedAt: ISOTimestamp | null;
}

/* ---------------- goals + races ---------------- */

export type EventType =
  | '5k'
  | '10k'
  | 'half_marathon'
  | 'marathon'
  | 'ultra'
  | 'triathlon_70_3'
  | 'triathlon_olympic'
  | 'general_endurance';

export const EVENT_TYPE_LABELS: Record<EventType, string> = {
  '5k': '5K',
  '10k': '10K',
  half_marathon: 'Half Marathon',
  marathon: 'Marathon',
  ultra: 'Ultra',
  triathlon_70_3: '70.3',
  triathlon_olympic: 'Olympic Triathlon',
  general_endurance: 'General Endurance',
};

export interface Race {
  id: UUID;
  name: string;
  date: ISODate;
  location: string | null;
  eventType: EventType;
  distanceKm: number | null;
  elevationM: number | null;
  url: string | null;
  /** null = an Iron Miles community race on the shared calendar. */
  createdBy: UUID | null;
}

export type GoalOutcome = 'time' | 'completion' | 'placing' | 'process';

export interface Goal {
  id: UUID;
  athleteId: UUID;
  raceId: UUID | null;
  eventType: EventType;
  targetDate: ISODate;
  outcome: GoalOutcome;
  /** Target finish in seconds, when outcome is 'time'. */
  targetTimeSeconds: number | null;
  /** The athlete's own words. Shown back to them when the work gets hard. */
  why: string;
  isPrimary: boolean;
  createdAt: ISOTimestamp;
}

/* ---------------- training ---------------- */

export type WorkoutType =
  | 'easy_run'
  | 'recovery_run'
  | 'long_run'
  | 'progression_run'
  | 'tempo'
  | 'threshold'
  | 'intervals'
  | 'hills'
  | 'race_pace'
  | 'brick'
  | 'bike'
  | 'swim'
  | 'cross_training'
  | 'strength'
  | 'mobility'
  | 'rest'
  | 'race';

export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  easy_run: 'Easy Run',
  recovery_run: 'Recovery Run',
  long_run: 'Long Run',
  progression_run: 'Progression Run',
  tempo: 'Tempo',
  threshold: 'Threshold',
  intervals: 'Intervals',
  hills: 'Hills',
  race_pace: 'Race Pace',
  brick: 'Brick Session',
  bike: 'Bike',
  swim: 'Swim',
  cross_training: 'Cross Training',
  strength: 'Strength',
  mobility: 'Mobility',
  rest: 'Rest',
  race: 'Race',
};

/** How the session is prescribed — drives which fields the athlete sees. */
export type PrescriptionBasis = 'distance' | 'time' | 'pace' | 'heart_rate' | 'rpe';

export type Intensity = 'recovery' | 'easy' | 'steady' | 'hard' | 'max' | 'rest';

export const INTENSITY_LABELS: Record<Intensity, string> = {
  recovery: 'Recovery',
  easy: 'Easy',
  steady: 'Steady',
  hard: 'Hard',
  max: 'Max',
  rest: 'Rest',
};

export interface PaceRange {
  /** Seconds per kilometre. */
  minSecPerKm: number;
  maxSecPerKm: number;
}

/** The prescription itself — shared by templates and scheduled sessions. */
export interface WorkoutPrescription {
  name: string;
  type: WorkoutType;
  basis: PrescriptionBasis;
  intensity: Intensity;
  distanceKm: number | null;
  durationMinutes: number | null;
  paceRange: PaceRange | null;
  /** Zone 1-5. */
  hrZone: number | null;
  rpeTarget: number | null;
  warmUp: string | null;
  mainSet: string | null;
  coolDown: string | null;
  notes: string | null;
}

export interface WorkoutTemplate extends WorkoutPrescription {
  id: UUID;
  ownerId: UUID | null;
  /** Library templates seeded by Iron Miles are shared; coach copies are private. */
  isShared: boolean;
  createdAt: ISOTimestamp;
}

export type ProgramGoalType = EventType;

export interface ProgramTemplate {
  id: UUID;
  name: string;
  goalType: ProgramGoalType;
  weeks: number;
  description: string;
  /** Coach-editable. Nothing here is a medical prescription. */
  ownerId: UUID | null;
  isShared: boolean;
  createdAt: ISOTimestamp;
}

export interface Program {
  id: UUID;
  athleteId: UUID;
  coachId: UUID;
  templateId: UUID | null;
  name: string;
  goalId: UUID | null;
  startDate: ISODate;
  endDate: ISODate;
  status: 'draft' | 'active' | 'complete' | 'archived';
  createdAt: ISOTimestamp;
}

export type SessionStatus = 'scheduled' | 'completed' | 'missed' | 'rescheduled' | 'skipped';

export interface ScheduledWorkout extends WorkoutPrescription {
  id: UUID;
  programId: UUID | null;
  athleteId: UUID;
  date: ISODate;
  /** Ordering within a day — some days carry a run and a strength session. */
  slot: number;
  status: SessionStatus;
  coachNote: string | null;
  strengthTemplateId: UUID | null;
  raceId: UUID | null;
  createdAt: ISOTimestamp;
}

/** What actually happened. Athlete-owned. */
export interface CompletedWorkout {
  id: UUID;
  scheduledWorkoutId: UUID | null;
  athleteId: UUID;
  date: ISODate;
  type: WorkoutType;
  actualDistanceKm: number | null;
  actualDurationMinutes: number | null;
  /** Seconds per km, derived on write so charts don't recompute. */
  averagePaceSecPerKm: number | null;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  rpe: number | null;
  /** 1-5, how the session felt overall. */
  sessionRating: number | null;
  soreness: number | null;
  athleteNotes: string | null;
  /** Where the data came from — manual today, Strava/Garmin later. */
  source: 'manual' | 'strava' | 'garmin' | 'coros' | 'apple_health' | 'google_fit';
  createdAt: ISOTimestamp;
}

/* ---------------- strength & conditioning ---------------- */

export type MovementCategory =
  | 'squat'
  | 'hinge'
  | 'lunge'
  | 'push'
  | 'pull'
  | 'carry'
  | 'core'
  | 'plyometric'
  | 'mobility'
  | 'rehab';

export interface StrengthExercise {
  id: UUID;
  name: string;
  category: MovementCategory;
  muscleGroups: string[];
  videoUrl: string | null;
  cues: string[];
  regressions: string[];
  progressions: string[];
  equipment: string[];
  ownerId: UUID | null;
  isShared: boolean;
}

export interface StrengthSetPrescription {
  exerciseId: UUID;
  order: number;
  sets: number;
  reps: string;
  tempo: string | null;
  restSeconds: number | null;
  rpeTarget: number | null;
  notes: string | null;
}

export type StrengthCategory =
  | 'foundation'
  | 'performance'
  | 'maintenance'
  | 'ultra_prep'
  | 'triathlon_support';

export const STRENGTH_CATEGORY_LABELS: Record<StrengthCategory, string> = {
  foundation: 'Foundation',
  performance: 'Performance',
  maintenance: 'Maintenance',
  ultra_prep: 'Ultra Prep',
  triathlon_support: 'Triathlon Support',
};

export interface StrengthTemplate {
  id: UUID;
  name: string;
  category: StrengthCategory;
  description: string;
  estimatedMinutes: number;
  blocks: StrengthSetPrescription[];
  ownerId: UUID | null;
  isShared: boolean;
}

export interface StrengthSetLog {
  exerciseId: UUID;
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  rpe: number | null;
  completed: boolean;
}

export interface StrengthSession {
  id: UUID;
  athleteId: UUID;
  scheduledWorkoutId: UUID | null;
  templateId: UUID;
  date: ISODate;
  status: SessionStatus;
  logs: StrengthSetLog[];
  durationMinutes: number | null;
  notes: string | null;
  completedAt: ISOTimestamp | null;
}

/* ---------------- weekly check-in ---------------- */

export interface CheckInScores {
  fatigue: number;
  sleep: number;
  soreness: number;
  stress: number;
  motivation: number;
  confidence: number;
  trainingDifficulty: number;
}

export type AttentionLevel = 'none' | 'watch' | 'attention';

export interface CheckIn {
  id: UUID;
  athleteId: UUID;
  /** Monday of the week being reviewed. */
  weekStart: ISODate;
  scores: CheckInScores;
  wentWell: string;
  feltDifficult: string;
  painOrNiggles: string;
  affectingTraining: string;
  confidenceNextWeek: string;
  forCoach: string;
  /** Rule-based, never a diagnosis. */
  attentionLevel: AttentionLevel;
  attentionReasons: string[];
  reviewedByCoachAt: ISOTimestamp | null;
  coachResponse: string | null;
  submittedAt: ISOTimestamp;
}

/* ---------------- coaching comms ---------------- */

export interface CoachNote {
  id: UUID;
  athleteId: UUID;
  coachId: UUID;
  body: string;
  /** Private notes are never exposed to the athlete by RLS. */
  visibility: 'private' | 'shared';
  createdAt: ISOTimestamp;
}

export interface Message {
  id: UUID;
  threadId: UUID;
  senderId: UUID;
  recipientId: UUID;
  body: string;
  /** FORGE messages are labelled so an athlete always knows who is talking. */
  authorKind: 'human' | 'forge';
  readAt: ISOTimestamp | null;
  createdAt: ISOTimestamp;
}

/* ---------------- forge score + community ---------------- */

export type ForgeEventKind =
  | 'run_completed'
  | 'strength_completed'
  | 'checkin_completed'
  | 'community_run'
  | 'full_week_adherence'
  | 'race_completed'
  | 'volunteered'
  | 'milestone'
  | 'streak_week';

export const FORGE_POINTS: Record<ForgeEventKind, number> = {
  run_completed: 10,
  strength_completed: 8,
  checkin_completed: 5,
  community_run: 10,
  full_week_adherence: 20,
  race_completed: 25,
  volunteered: 15,
  milestone: 0,
  streak_week: 12,
};

export interface ForgeScoreEvent {
  id: UUID;
  athleteId: UUID;
  kind: ForgeEventKind;
  points: number;
  date: ISODate;
  label: string;
  /** Prevents double-award for the same source row. */
  sourceId: UUID | null;
}

export type LeaderboardScope = 'weekly' | 'monthly' | 'all_time';
export type LeaderboardCategory = 'forge_score' | 'consistency' | 'community' | 'streaks';

export interface LeaderboardEntry {
  athleteId: UUID;
  displayName: string;
  avatarUrl: string | null;
  value: number;
  rank: number;
  group: string | null;
}

export interface Achievement {
  id: UUID;
  athleteId: UUID;
  code: string;
  title: string;
  description: string;
  earnedAt: ISOTimestamp;
}

export interface CommunityEvent {
  id: UUID;
  title: string;
  kind: 'club_run' | 'race' | 'session' | 'social' | 'volunteer';
  startsAt: ISOTimestamp;
  location: string;
  description: string;
  capacity: number | null;
  attendingCount: number;
}

export interface CommunityPost {
  id: UUID;
  authorId: UUID | null;
  authorName: string;
  kind: 'announcement' | 'milestone' | 'shoutout';
  body: string;
  createdAt: ISOTimestamp;
  reactions: Record<string, number>;
}

/* ---------------- billing ---------------- */

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'paused'
  | 'canceled'
  | 'incomplete';

export interface Subscription {
  id: UUID;
  athleteId: UUID;
  packageCode: string;
  status: SubscriptionStatus;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: ISOTimestamp | null;
  cancelAtPeriodEnd: boolean;
  priceCents: number;
  currency: string;
}

/* ---------------- integrations ---------------- */

export type IntegrationProvider = 'strava' | 'garmin' | 'coros' | 'apple_health' | 'google_fit';

export interface Integration {
  id: UUID;
  athleteId: UUID;
  provider: IntegrationProvider;
  status: 'available' | 'connected' | 'error' | 'coming_soon';
  connectedAt: ISOTimestamp | null;
  lastSyncAt: ISOTimestamp | null;
}

/* ---------------- onboarding + applications ---------------- */

export interface OnboardingData {
  personal: {
    fullName: string;
    dateOfBirth: string;
    location: string;
    timezone: string;
    units: Units;
  };
  goal: {
    raceName: string;
    raceDate: string;
    eventType: EventType;
    outcome: GoalOutcome;
    targetTime: string;
    why: string;
  };
  history: {
    weeklyKm: number;
    sessionsPerWeek: number;
    longestRecentKm: number;
    personalBests: string;
    enduranceBackground: string;
    strengthBackground: string;
  };
  availability: {
    trainingDays: string[];
    longRunDay: string;
    typicalSessionMinutes: number;
    gymAccess: 'full_gym' | 'home_gym' | 'bodyweight' | 'none';
    equipment: string[];
  };
  health: {
    currentInjuries: string;
    recentInjuries: string;
    parqFlags: string[];
    medicalClearance: boolean;
    acknowledgedDisclaimer: boolean;
  };
  preferences: {
    feedbackStyle: 'direct' | 'encouraging' | 'analytical';
    motivationStyle: 'data' | 'process' | 'community' | 'challenge';
    messagingPreference: 'in_app' | 'email' | 'both';
    checkInFrequency: 'weekly' | 'fortnightly';
    forgeAssistantEnabled: boolean;
    leaderboardOptIn: boolean;
  };
}

export interface CoachingApplication {
  id: UUID;
  fullName: string;
  email: string;
  phone: string | null;
  goal: string;
  targetRace: string | null;
  targetDate: ISODate | null;
  currentWeeklyKm: number | null;
  experience: string;
  injuries: string | null;
  startWhen: string;
  status: 'new' | 'reviewing' | 'accepted' | 'declined';
  createdAt: ISOTimestamp;
}

/* ---------------- notifications ---------------- */

export interface Notification {
  id: UUID;
  userId: UUID;
  kind: string;
  title: string;
  body: string;
  href: string | null;
  readAt: ISOTimestamp | null;
  createdAt: ISOTimestamp;
}
