import type {
  AcceptanceOutcome,
  Achievement,
  CheckIn,
  ApplicationStatus,
  CoachNote,
  CoachingApplication,
  CommunityEvent,
  CommunityPost,
  CompletedWorkout,
  ForgeScoreEvent,
  Goal,
  Integration,
  ISODate,
  LeaderboardCategory,
  LeaderboardEntry,
  LeaderboardScope,
  Message,
  Notification,
  OnboardingData,
  Profile,
  Program,
  Race,
  ScheduledWorkout,
  StrengthSession,
  Subscription,
  UUID,
} from '@/lib/domain/types';

/**
 * The single data contract the whole application is written against.
 *
 * Two implementations satisfy it:
 *   - `SupabaseRepo`  — production Postgres, every read and write under RLS.
 *   - `DemoRepo`      — an in-memory dataset, so the product is fully explorable
 *                       (and reviewable) before a database exists.
 *
 * Components never import either one directly; they call `getRepo()`.
 */
export interface IronMilesRepo {
  readonly mode: 'supabase' | 'demo';

  /* identity */
  getProfile(userId: UUID): Promise<Profile | null>;
  updateProfile(userId: UUID, patch: Partial<Profile>): Promise<Profile>;
  getCoachForAthlete(athleteId: UUID): Promise<Profile | null>;
  listAthletesForCoach(coachId: UUID): Promise<Profile[]>;

  /* onboarding */
  getOnboarding(athleteId: UUID): Promise<{ data: Partial<OnboardingData>; step: number; completedAt: string | null } | null>;
  saveOnboarding(athleteId: UUID, data: Partial<OnboardingData>, step: number): Promise<void>;
  completeOnboarding(athleteId: UUID, data: OnboardingData): Promise<void>;

  /* goals + races */
  getPrimaryGoal(athleteId: UUID): Promise<Goal | null>;
  getRace(raceId: UUID): Promise<Race | null>;
  listRaces(): Promise<Race[]>;

  /* training */
  getProgram(athleteId: UUID): Promise<Program | null>;
  listScheduled(athleteId: UUID, from: ISODate, to: ISODate): Promise<ScheduledWorkout[]>;
  getScheduled(id: UUID): Promise<ScheduledWorkout | null>;
  saveScheduled(workout: ScheduledWorkout): Promise<ScheduledWorkout>;
  moveScheduled(id: UUID, toDate: ISODate): Promise<void>;
  deleteScheduled(id: UUID): Promise<void>;

  listCompleted(athleteId: UUID, from: ISODate, to: ISODate): Promise<CompletedWorkout[]>;
  logWorkout(entry: Omit<CompletedWorkout, 'id' | 'createdAt'>): Promise<CompletedWorkout>;

  listStrengthSessions(athleteId: UUID, from: ISODate, to: ISODate): Promise<StrengthSession[]>;
  getStrengthSession(id: UUID): Promise<StrengthSession | null>;
  saveStrengthSession(session: StrengthSession): Promise<StrengthSession>;

  /* check-ins */
  listCheckIns(athleteId: UUID, limit?: number): Promise<CheckIn[]>;
  getCheckIn(athleteId: UUID, weekStart: ISODate): Promise<CheckIn | null>;
  submitCheckIn(checkIn: Omit<CheckIn, 'id' | 'submittedAt'>): Promise<CheckIn>;
  respondToCheckIn(id: UUID, coachId: UUID, response: string): Promise<void>;
  listCheckInQueue(coachId: UUID): Promise<(CheckIn & { athleteName: string })[]>;

  /* forge score + community */
  listForgeEvents(athleteId: UUID): Promise<ForgeScoreEvent[]>;
  awardForgePoints(event: Omit<ForgeScoreEvent, 'id'>): Promise<void>;
  getLeaderboard(scope: LeaderboardScope, category: LeaderboardCategory): Promise<LeaderboardEntry[]>;
  listAchievements(athleteId: UUID): Promise<Achievement[]>;
  listCommunityEvents(viewerId?: UUID): Promise<CommunityEvent[]>;
  listCommunityPosts(): Promise<CommunityPost[]>;
  setEventAttendance(eventId: UUID, athleteId: UUID, going: boolean): Promise<void>;

  /* coaching comms */
  listMessages(athleteId: UUID): Promise<Message[]>;
  sendMessage(msg: Omit<Message, 'id' | 'createdAt' | 'readAt'>): Promise<Message>;
  markMessagesRead(athleteId: UUID, readerId: UUID): Promise<void>;
  listCoachNotes(athleteId: UUID, viewerRole: 'athlete' | 'coach'): Promise<CoachNote[]>;
  addCoachNote(note: Omit<CoachNote, 'id' | 'createdAt'>): Promise<CoachNote>;

  /* billing + integrations */
  getSubscription(athleteId: UUID): Promise<Subscription | null>;
  listIntegrations(athleteId: UUID): Promise<Integration[]>;

  /* notifications */
  listNotifications(userId: UUID): Promise<Notification[]>;

  /* public */
  createApplication(
    app: Omit<
      CoachingApplication,
      'id' | 'createdAt' | 'status' | 'acceptedBy' | 'acceptedAt' | 'decidedNote' | 'joinedAthleteId'
    >,
  ): Promise<CoachingApplication>;

  /* intake — the step between "applied" and "being coached" */
  listApplications(status?: ApplicationStatus): Promise<CoachingApplication[]>;
  decideApplication(
    applicationId: UUID,
    coachId: UUID,
    decision: ApplicationStatus,
    note: string | null,
  ): Promise<AcceptanceOutcome>;
  /** Adopt an athlete who already has an account. */
  linkAthlete(coachId: UUID, athleteId: UUID): Promise<void>;

  /* programmes */
  createProgram(program: Omit<Program, 'id' | 'createdAt'>): Promise<Program>;

  /* privacy */
  exportAthleteData(athleteId: UUID): Promise<Record<string, unknown>>;
  deleteAthleteData(athleteId: UUID): Promise<void>;
}
