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
  ProgramTemplateItem,
  StrengthExercise,
  StrengthTemplate,
  WeekVolume,
  WorkoutTemplate,
} from '@/lib/domain/library';
import type { RosterEntry } from '@/lib/domain/roster';
import type { BatchAction, BatchOutcome } from '@/lib/domain/batch';
import type {
  ChannelName, DeliveryStatus, NotificationDraft, NotificationPreferences,
} from '@/lib/domain/notifications';
import type {
  CheckInContext,
  SessionHistory,
  ShiftRow,
  VolumeRow,
  WeekSession,
} from '@/lib/domain/adaptation';
import type {
  AssignmentConflict,
  AssignmentPreview,
  ExtractionMetadata,
  ExtractionPreview,
  ProgramTemplate,
  ProgramTemplateBlock,
  ProgramTemplateDetail,
  ProgramTemplateSlot,
  ProgramTemplateWeek,
  TemplateWeekVolume,
} from '@/lib/domain/programme-template';
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
  ISOTimestamp,
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

/** A programme template on the way in. */
export type ProgramTemplateDraft = Omit<ProgramTemplate, 'id' | 'createdAt' | 'updatedAt' | 'weeks'> &
  Partial<Pick<ProgramTemplate, 'id' | 'weeks'>>;
export type TemplateBlockDraft = Omit<ProgramTemplateBlock, 'id' | 'createdAt'> &
  Partial<Pick<ProgramTemplateBlock, 'id'>>;
export type TemplateWeekDraft = Omit<ProgramTemplateWeek, 'id' | 'createdAt'> &
  Partial<Pick<ProgramTemplateWeek, 'id'>>;
export type TemplateSlotDraft = Omit<ProgramTemplateSlot, 'id'> &
  Partial<Pick<ProgramTemplateSlot, 'id'>>;

/** One line in a coach's notification centre. */
export interface NotificationItem {
  id: UUID;
  kind: 'digest' | 'alert';
  priority: 'urgent' | 'attention' | 'information';
  athleteId: UUID | null;
  athleteName: string | null;
  signalKind: string | null;
  title: string;
  body: string;
  href: string;
  state: 'pending' | 'read' | 'dismissed';
  createdAt: ISOTimestamp;
  /** How it went out, so "why did I not get this" is answerable. */
  deliveries: { channel: ChannelName; state: DeliveryStatus; detail: string | null }[];
}

/** A delivery the worker still has to attempt. */
export interface PendingDelivery {
  deliveryId: UUID;
  notificationId: UUID;
  channel: ChannelName;
  /** Attempts already recorded. Drives the backoff and the give-up point. */
  attempts: number;
  userId: UUID;
  recipientEmail: string | null;
  recipientName: string | null;
  athleteName: string | null;
  /** Without `channels`: a pending delivery is already about exactly one. */
  draft: Omit<NotificationDraft, 'channels'>;
}

/** One send attempt and everything worth keeping about it. */
/** One line of "this athlete's programme changed as part of a squad decision". */
export interface BatchHistoryRow {
  batchId: UUID;
  action: BatchAction;
  params: Record<string, unknown>;
  outcome: BatchOutcome;
  detail: string | null;
  athleteCount: number;
  createdAt: ISOTimestamp;
}

export interface DeliveryAttempt {
  state: DeliveryStatus;
  detail: string;
  provider?: string;
  providerMessageId?: string;
  /** Set only for a retryable failure. Null clears any existing backoff. */
  nextAttemptAt?: ISOTimestamp | null;
}

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
   *
   * A day holds one session per slot. Runs default to slot 0 and strength to
   * slot 1, so a strength session lands alongside that day's run rather than
   * on top of it. Prescribing into an occupied slot replaces what is there,
   * and the replacement is recorded in the session's revision history.
   */
  insertTemplateIntoProgramme(
    kind: 'workout' | 'strength',
    templateId: UUID,
    athleteId: UUID,
    date: ISODate,
    slot?: number,
  ): Promise<UUID>;

  listProgramTemplates(query?: LibraryQuery): Promise<ProgramTemplateItem[]>;
  getProgramTemplate(id: UUID): Promise<ProgramTemplateItem | null>;

  /* ---- the programme template builder ---- */

  /** The template with every block, week and slot, plus its volume table. */
  getProgramTemplateDetail(id: UUID): Promise<ProgramTemplateDetail | null>;
  saveProgramTemplate(template: ProgramTemplateDraft): Promise<ProgramTemplate>;

  saveTemplateBlock(block: TemplateBlockDraft): Promise<ProgramTemplateBlock>;
  /** Refuses while the block still holds weeks, the way a live block does. */
  deleteTemplateBlock(blockId: UUID): Promise<void>;

  saveTemplateWeek(week: TemplateWeekDraft): Promise<ProgramTemplateWeek>;
  deleteTemplateWeek(weekId: UUID): Promise<void>;

  saveTemplateSlot(slot: TemplateSlotDraft): Promise<ProgramTemplateSlot>;
  deleteTemplateSlot(slotId: UUID): Promise<void>;

  /** "16 Week Marathon — Intermediate" into "— High Volume", structure and all. */
  duplicateProgramTemplate(id: UUID, name?: string): Promise<UUID>;

  /**
   * Save a live athlete programme back out as a reusable template.
   *
   * A snapshot, independent from the moment it exists: later edits to the
   * athlete's programme do not reach it, and later edits to it do not reach
   * the athlete. What was prescribed travels; what the athlete actually did
   * stays with the athlete.
   */
  previewProgrammeExtraction(programId: UUID): Promise<ExtractionPreview>;
  extractProgrammeTemplate(programId: UUID, metadata: ExtractionMetadata): Promise<UUID>;

  /** Prescribed against intended, week by week. */
  getTemplateVolume(templateId: UUID): Promise<TemplateWeekVolume[]>;

  /** Everything the coach sees before committing an assignment. */
  previewAssignment(templateId: UUID, athleteId: UUID, startDate: ISODate): Promise<AssignmentPreview>;
  /** Just the conflicts, for a live re-check as the coach changes the date. */
  getAssignmentConflicts(templateId: UUID, athleteId: UUID, startDate: ISODate): Promise<AssignmentConflict[]>;

  /**
   * Copy the template into the athlete's own programme.
   *
   * Refuses only what previewAssignment calls a blocker. Coaching conflicts
   * are the coach's to weigh, and nothing here resolves one: no session is
   * moved or dropped to fit an athlete's stated availability.
   */
  assignProgramTemplate(
    templateId: UUID,
    athleteId: UUID,
    startDate: ISODate,
    options?: { name?: string; goalId?: UUID },
  ): Promise<UUID>;

  /** Prescribed against intended volume, for the mismatch warning. */
  getWeekVolume(weekId: UUID): Promise<WeekVolume>;

  /* ---- adapting a live programme ---- */

  /**
   * Move one session. Re-homes it in the week that contains the new date, and
   * refuses to land on an occupied slot, on completed training, or outside
   * the programme.
   */
  moveSession(sessionId: UUID, date: ISODate, slot?: number): Promise<void>;
  /** Exchange two sessions' days. Neither may be completed. */
  swapSessions(a: UUID, b: UUID): Promise<void>;

  /**
   * Shift every adaptable session in a range.
   *
   * `apply: false` returns exactly the rows `apply: true` would act on, so
   * what a coach confirms is what runs. Completed training always comes back
   * blocked.
   */
  shiftSessions(
    athleteId: UUID,
    from: ISODate,
    to: ISODate,
    days: number,
    apply: boolean,
  ): Promise<ShiftRow[]>;

  /** Scale prescribed distance across a range, on the same preview contract. */
  scaleVolume(
    athleteId: UUID,
    from: ISODate,
    to: ISODate,
    factor: number,
    apply: boolean,
  ): Promise<VolumeRow[]>;

  /** The week a coach is working on: what is in it, and what is protected. */
  getWeekAdaptationContext(weekId: UUID): Promise<WeekSession[]>;

  /** Originally prescribed, what changed, and what it is now. */
  getSessionHistory(sessionId: UUID): Promise<SessionHistory>;

  /** The athlete's own account of the week just gone. Context, never an instruction. */
  getCheckInContext(athleteId: UUID): Promise<CheckInContext | null>;

  /* ---- the roster ---- */

  /**
   * Every athlete on the coach's roster, with what is going on for each.
   *
   * One call, whatever the roster size — a coach with fifty athletes was
   * previously six database round trips per athlete. Signals are classified
   * in the domain layer, so both adapters mean the same thing by "needs
   * attention".
   */
  listRoster(coachId: UUID, today: ISODate): Promise<RosterEntry[]>;

  /* ---- notifications ---- */

  getNotificationPreferences(userId: UUID): Promise<NotificationPreferences>;
  saveNotificationPreferences(prefs: NotificationPreferences): Promise<void>;

  /**
   * Record that a coach should be told something.
   *
   * Returns null when they have already been told: the dedupe key identifies
   * the news, so the same thing cannot be reported twice however often the
   * job runs.
   */
  createNotification(draft: NotificationDraft): Promise<UUID | null>;

  listNotificationFeed(userId: UUID, limit?: number): Promise<NotificationItem[]>;
  setNotificationState(id: UUID, state: 'pending' | 'read' | 'dismissed'): Promise<void>;

  /** Deliveries waiting to go out, past any quiet-hours hold. */
  /**
   * Deliveries the worker may attempt right now: never attempted, or failed
   * and past their backoff. Anything sent, delivered, given up on or held for
   * quiet hours is excluded.
   */
  listPendingDeliveries(limit?: number, now?: ISOTimestamp): Promise<PendingDelivery[]>;
  recordAttempt(deliveryId: UUID, attempt: DeliveryAttempt): Promise<void>;

  /**
   * A provider's later report about a message it already accepted. Returns
   * true when it changed the delivery's state — a duplicate or out-of-order
   * event returns false rather than raising.
   */
  recordProviderStatus(providerMessageId: string, status: string, detail?: string): Promise<boolean>;

  /* ---- batches: one coaching decision, several athletes ---- */

  /**
   * Start a record of one coaching decision.
   *
   * The athletes are recorded one at a time as each single-athlete operation
   * returns, so a batch that half-succeeds is a batch that half-recorded —
   * which is the honest shape.
   */
  openBatch(action: BatchAction, params: Record<string, unknown>, intended: number): Promise<UUID>;

  /**
   * Record what became of one athlete. Re-checks the roster per athlete: one
   * authorised id never vouches for the rest of a list.
   */
  recordBatchItem(
    batchId: UUID,
    athleteId: UUID,
    outcome: BatchOutcome,
    detail: string,
    extra?: { programmeId?: UUID | null; sessionIds?: UUID[] },
  ): Promise<void>;

  /** The batches that touched this athlete, for "why did this change?". */
  listBatchHistory(athleteId: UUID, limit?: number): Promise<BatchHistoryRow[]>;

  /** Which coaches have a roster to summarise, for the digest job. */
  listCoachesForDigest(): Promise<{ userId: UUID; email: string | null }[]>;
  markDigestSent(userId: UUID, localDate: ISODate): Promise<void>;

  /** The coach's own local date of their last digest — the once-a-day rule. */
  lastDigestDate(userId: UUID): Promise<ISODate | null>;

  /* privacy */
  exportAthleteData(athleteId: UUID): Promise<Record<string, unknown>>;
  deleteAthleteData(athleteId: UUID): Promise<void>;
}
