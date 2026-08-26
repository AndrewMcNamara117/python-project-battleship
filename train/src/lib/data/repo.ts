import type {
  BlockWithWeeks,
  ProgramBlock,
  ProgramWeek,
  SessionComponent,
  SessionComponentDraft,
  SessionRevision,
} from '@/lib/domain/programme';
import type {
  LibraryQuery,
  StrengthExercise,
  StrengthTemplate,
  WeekVolume,
  WorkoutTemplate,
} from '@/lib/domain/library';
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
/** Which library a call is talking about. */
export type LibraryKind = 'workout' | 'exercise' | 'strength';

/** A library item on the way in: the database owns id and timestamps. */
export type WorkoutTemplateDraft = Omit<WorkoutTemplate, 'id' | 'createdAt' | 'updatedAt' | 'components'> &
  Partial<Pick<WorkoutTemplate, 'id'>>;
export type StrengthExerciseDraft = Omit<StrengthExercise, 'id' | 'createdAt' | 'updatedAt'> &
  Partial<Pick<StrengthExercise, 'id'>>;
export type StrengthTemplateDraft = Omit<StrengthTemplate, 'id' | 'createdAt' | 'updatedAt' | 'components'> &
  Partial<Pick<StrengthTemplate, 'id'>>;
/** Position comes from array order, so callers cannot desynchronise it. */
export type TemplateComponentDraft = Omit<SessionComponentDraft, 'position'>;

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

  /* ---- programme structure: block → week → session → component ---- */

  listBlocks(programId: UUID): Promise<BlockWithWeeks[]>;
  createBlock(block: Omit<ProgramBlock, 'id' | 'createdAt'>): Promise<ProgramBlock>;
  updateBlock(blockId: UUID, patch: Partial<ProgramBlock>): Promise<void>;
  deleteBlock(blockId: UUID): Promise<void>;

  createWeek(week: Omit<ProgramWeek, 'id' | 'createdAt'>): Promise<ProgramWeek>;
  updateWeek(weekId: UUID, patch: Partial<ProgramWeek>): Promise<void>;
  /** The week a date falls in, for attaching a session to its place. */
  findWeekByDate(programId: UUID, date: ISODate): Promise<ProgramWeek | null>;

  listComponents(scheduledWorkoutId: UUID): Promise<SessionComponent[]>;
  /** Replaces the session's components wholesale — position is the order. */
  saveComponents(
    scheduledWorkoutId: UUID,
    athleteId: UUID,
    components: SessionComponentDraft[],
  ): Promise<SessionComponent[]>;

  /* ---- duplication. Set-based, one call each. ---- */

  /** Copy a week's prescription onto a target Monday. Returns the target week. */
  duplicateWeek(sourceWeekId: UUID, targetStart: ISODate, targetBlockId?: UUID): Promise<UUID>;
  /** Copy a whole block — every week, session and component. */
  duplicateBlock(sourceBlockId: UUID, targetStart: ISODate, name?: string): Promise<UUID>;
  /** Hand an existing programme's whole structure to another athlete. */
  assignProgramToAthlete(
    sourceProgramId: UUID,
    athleteId: UUID,
    startDate: ISODate,
    name?: string,
  ): Promise<UUID>;

  /* ---- prescription history ---- */

  listSessionRevisions(scheduledWorkoutId: UUID): Promise<SessionRevision[]>;
  /** What the coach originally wrote, whatever has happened since. */
  getOriginalPrescription(scheduledWorkoutId: UUID): Promise<Record<string, unknown> | null>;

  /* ---- the libraries ---- */

  listWorkoutTemplates(query?: LibraryQuery): Promise<WorkoutTemplate[]>;
  /** Includes its components, in order. */
  getWorkoutTemplate(id: UUID): Promise<WorkoutTemplate | null>;
  saveWorkoutTemplate(
    template: WorkoutTemplateDraft,
    components?: TemplateComponentDraft[],
  ): Promise<WorkoutTemplate>;

  listStrengthExercises(query?: LibraryQuery): Promise<StrengthExercise[]>;
  getStrengthExercise(id: UUID): Promise<StrengthExercise | null>;
  saveStrengthExercise(exercise: StrengthExerciseDraft): Promise<StrengthExercise>;

  listStrengthTemplates(query?: LibraryQuery): Promise<StrengthTemplate[]>;
  getStrengthTemplate(id: UUID): Promise<StrengthTemplate | null>;
  saveStrengthTemplate(
    template: StrengthTemplateDraft,
    components?: TemplateComponentDraft[],
  ): Promise<StrengthTemplate>;

  /**
   * Archive rather than delete: anything previously prescribed keeps its
   * reference, and a coach can bring the item back.
   */
  setLibraryArchived(kind: LibraryKind, id: UUID, archived: boolean): Promise<void>;
  /** Copy a system or shared item into one the coach owns and can edit. */
  duplicateLibraryItem(kind: LibraryKind, id: UUID, name?: string): Promise<UUID>;

  /**
   * Prescribe a template to an athlete on a date.
   *
   * Copies the template — the resulting session records where it came from but
   * holds no live link, so editing the template later cannot change training
   * the athlete has already been given.
   */
  insertTemplateIntoProgramme(
    kind: 'workout' | 'strength',
    templateId: UUID,
    athleteId: UUID,
    date: ISODate,
    slot?: number,
  ): Promise<UUID>;

  /** Prescribed against intended volume, for the mismatch warning. */
  getWeekVolume(weekId: UUID): Promise<WeekVolume>;

  /* privacy */
  exportAthleteData(athleteId: UUID): Promise<Record<string, unknown>>;
  deleteAthleteData(athleteId: UUID): Promise<void>;
}
