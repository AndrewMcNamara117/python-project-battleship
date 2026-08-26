import {
  DEMO_PROGRAM_TEMPLATES,
  DEMO_TEMPLATE_BLOCKS,
  DEMO_TEMPLATE_SLOTS,
  DEMO_TEMPLATE_WEEKS,
  DEMO_STRENGTH_EXERCISES,
  DEMO_STRENGTH_TEMPLATES,
  DEMO_WORKOUT_TEMPLATES,
} from '@/data/demo-library.generated';
import { buildDemoDataset, CLUB_MEMBER_META, DEMO_ATHLETE_ID, DEMO_COACH_ID, type DemoDataset } from '@/data/demo-seed';
import { addDays, daysBetween, startOfMonth, startOfWeek, toISODate, weekdayIndex } from '@/lib/domain/dates';
import { currentStreakWeeks, totalScore } from '@/lib/domain/forge-score';
import { parseTimeToSeconds } from '@/lib/domain/dates';
import { profileFieldsFromOnboarding } from '@/lib/domain/onboarding-map';
import type {
  AcceptanceOutcome,
  Achievement,
  ApplicationStatus,
  CheckIn,
  CoachNote,
  CoachingApplication,
  CommunityEvent,
  CommunityPost,
  CompletedWorkout,
  ForgeEventKind,
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
import { FORGE_POINTS, weekdayList } from '@/lib/domain/types';
import type { Weekday } from '@/lib/domain/types';
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
import type {
  AssignmentConflict,
  AssignmentPreview,
  ExtractionMetadata,
  ExtractionNote,
  ExtractionPreview,
  ProgramTemplate,
  ProgramTemplateBlock,
  ProgramTemplateDetail,
  ProgramTemplateSlot,
  ProgramTemplateWeek,
  TemplateWeekVolume,
} from '@/lib/domain/programme-template';
import { buildAssignmentPreview } from '@/lib/domain/assignment-preview';
import { buildExtractionPreview } from '@/lib/domain/extraction-preview';
import type {
  IronMilesRepo,
  LibraryKind,
  ProgramTemplateDraft,
  StrengthExerciseDraft,
  TemplateBlockDraft,
  TemplateSlotDraft,
  TemplateWeekDraft,
  StrengthTemplateDraft,
  TemplateComponentDraft,
  WorkoutTemplateDraft,
} from './repo';

/**
 * In-memory implementation of the data contract.
 *
 * The dataset is rebuilt per calendar day and cached in module scope, so every
 * request within a day sees identical data. Writes mutate the cached copy —
 * they survive for the life of the server process, which is exactly the
 * behaviour you want for a demo and exactly the behaviour you must not ship
 * as production storage. `getRepo()` never selects this adapter when Supabase
 * credentials are configured.
 */

let cache: { day: ISODate; data: DemoDataset } | null = null;

function dataset(): DemoDataset {
  const day = toISODate(new Date());
  if (!cache || cache.day !== day) cache = { day, data: buildDemoDataset(day) };
  return cache.data;
}

const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
const round1 = (n: number) => Math.round(n * 10) / 10;
const uid = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 10)}`;

/** Which Forge event a completed session earns. */
function forgeKindFor(name: string, type: string): ForgeEventKind {
  if (/club run|iron miles/i.test(name)) return 'community_run';
  if (type === 'race') return 'race_completed';
  if (type === 'strength') return 'strength_completed';
  return 'run_completed';
}

export class DemoRepo implements IronMilesRepo {
  readonly mode = 'demo' as const;

  /* ---------- identity ---------- */
  async getProfile(userId: UUID): Promise<Profile | null> {
    return clone(dataset().profiles.find((p) => p.id === userId) ?? null);
  }

  async updateProfile(userId: UUID, patch: Partial<Profile>): Promise<Profile> {
    const d = dataset();
    const i = d.profiles.findIndex((p) => p.id === userId);
    if (i < 0) throw new Error('Profile not found');
    // role is never client-writable, in either adapter
    const { role: _role, id: _id, ...safe } = patch;
    d.profiles[i] = { ...d.profiles[i], ...safe };
    return clone(d.profiles[i]);
  }

  async getCoachForAthlete(athleteId: UUID): Promise<Profile | null> {
    const d = dataset();
    const link = d.links.find((l) => l.athleteId === athleteId && l.status === 'active');
    if (!link) return null;
    return clone(d.profiles.find((p) => p.id === link.coachId) ?? null);
  }

  async listAthletesForCoach(coachId: UUID): Promise<Profile[]> {
    const d = dataset();
    const ids = new Set(d.links.filter((l) => l.coachId === coachId && l.status === 'active').map((l) => l.athleteId));
    return clone(d.profiles.filter((p) => ids.has(p.id)));
  }

  /* ---------- onboarding ---------- */
  private onboarding = new Map<UUID, { data: Partial<OnboardingData>; step: number; completedAt: string | null }>();

  async getOnboarding(athleteId: UUID) {
    if (athleteId === DEMO_ATHLETE_ID && !this.onboarding.has(athleteId)) {
      return { data: {}, step: 7, completedAt: '2024-11-02T20:14:00.000Z' };
    }
    return this.onboarding.get(athleteId) ?? null;
  }

  async saveOnboarding(athleteId: UUID, data: Partial<OnboardingData>, step: number) {
    const prev = this.onboarding.get(athleteId);
    this.onboarding.set(athleteId, { data: { ...prev?.data, ...data }, step, completedAt: prev?.completedAt ?? null });
  }

  async completeOnboarding(athleteId: UUID, data: OnboardingData) {
    this.onboarding.set(athleteId, { data, step: 7, completedAt: new Date().toISOString() });
    const d = dataset();
    const p = d.profiles.find((x) => x.id === athleteId);
    if (p) {
      p.onboardedAt = new Date().toISOString();
      p.fullName = data.personal.fullName || p.fullName;
      p.units = data.personal.units;
      p.timezone = data.personal.timezone;
      p.location = data.personal.location;
      p.leaderboardOptIn = data.preferences.leaderboardOptIn;
      p.forgeAssistantEnabled = data.preferences.forgeAssistantEnabled;
      p.healthDataConsentAt = new Date().toISOString();
      Object.assign(p, profileFieldsFromOnboarding(data));
    }

    // The Supabase adapter records the athlete's goal here, so this one must
    // too — an adapter that quietly does less is worse than no adapter, because
    // the divergence only shows up in production.
    if (data.goal?.raceDate) {
      const existing = d.goals.findIndex((g) => g.athleteId === athleteId && g.isPrimary);
      const goal: Goal = {
        id: uid('goal'),
        athleteId,
        raceId: null,
        eventType: data.goal.eventType,
        targetDate: data.goal.raceDate,
        outcome: data.goal.outcome,
        targetTimeSeconds: parseTimeToSeconds(data.goal.targetTime || '') ?? null,
        why: data.goal.why ?? '',
        isPrimary: true,
        createdAt: new Date().toISOString(),
      };
      if (existing >= 0) d.goals[existing] = goal;
      else d.goals.push(goal);

      if (data.goal.raceName) {
        d.races.push({
          id: uid('race'),
          name: data.goal.raceName,
          date: data.goal.raceDate,
          location: data.personal?.location ?? null,
          eventType: data.goal.eventType,
          distanceKm: null,
          elevationM: null,
          url: null,
          createdBy: athleteId,
        });
        goal.raceId = d.races[d.races.length - 1].id;
      }
    }
  }

  /* ---------- goals + races ---------- */
  async getPrimaryGoal(athleteId: UUID): Promise<Goal | null> {
    return clone(dataset().goals.find((g) => g.athleteId === athleteId && g.isPrimary) ?? null);
  }

  async getRace(raceId: UUID): Promise<Race | null> {
    return clone(dataset().races.find((r) => r.id === raceId) ?? null);
  }

  async listRaces(): Promise<Race[]> {
    return clone(dataset().races.slice().sort((a, b) => a.date.localeCompare(b.date)));
  }

  /* ---------- training ---------- */
  async getProgram(athleteId: UUID): Promise<Program | null> {
    return clone(dataset().programs.find((p) => p.athleteId === athleteId && p.status === 'active') ?? null);
  }

  async listScheduled(athleteId: UUID, from: ISODate, to: ISODate): Promise<ScheduledWorkout[]> {
    return clone(
      dataset()
        .scheduled.filter((w) => w.athleteId === athleteId && w.date >= from && w.date <= to)
        .sort((a, b) => a.date.localeCompare(b.date) || a.slot - b.slot),
    );
  }

  async getScheduled(id: UUID): Promise<ScheduledWorkout | null> {
    return clone(dataset().scheduled.find((w) => w.id === id) ?? null);
  }

  async saveScheduled(workout: ScheduledWorkout): Promise<ScheduledWorkout> {
    const d = dataset();
    const i = d.scheduled.findIndex((w) => w.id === workout.id);
    if (i >= 0) d.scheduled[i] = clone(workout);
    else d.scheduled.push(clone(workout));
    return clone(workout);
  }

  async moveScheduled(id: UUID, toDate: ISODate): Promise<void> {
    const w = dataset().scheduled.find((x) => x.id === id);
    if (!w) return;
    w.date = toDate;
    if (w.status === 'scheduled') w.status = 'rescheduled';
  }

  async deleteScheduled(id: UUID): Promise<void> {
    const d = dataset();
    const i = d.scheduled.findIndex((w) => w.id === id);
    if (i >= 0) d.scheduled.splice(i, 1);
  }

  async listCompleted(athleteId: UUID, from: ISODate, to: ISODate): Promise<CompletedWorkout[]> {
    return clone(
      dataset()
        .completed.filter((w) => w.athleteId === athleteId && w.date >= from && w.date <= to)
        .sort((a, b) => b.date.localeCompare(a.date)),
    );
  }

  async logWorkout(entry: Omit<CompletedWorkout, 'id' | 'createdAt'>): Promise<CompletedWorkout> {
    const d = dataset();
    const row: CompletedWorkout = { ...entry, id: uid('cw'), createdAt: new Date().toISOString() };
    const existing = d.completed.findIndex((w) => w.scheduledWorkoutId && w.scheduledWorkoutId === entry.scheduledWorkoutId);
    if (existing >= 0) d.completed[existing] = row;
    else d.completed.push(row);

    if (entry.scheduledWorkoutId) {
      const sched = d.scheduled.find((w) => w.id === entry.scheduledWorkoutId);
      if (sched) sched.status = 'completed';
      // score the session that actually happened: a Saturday club run is
      // community attendance, not just another prescribed run
      const kind = forgeKindFor(sched?.name ?? '', entry.type);
      await this.awardForgePoints({
        athleteId: entry.athleteId,
        kind,
        points: FORGE_POINTS[kind],
        date: entry.date,
        label: sched?.name ?? 'Session completed',
        sourceId: entry.scheduledWorkoutId,
      });
    }
    return clone(row);
  }

  async listStrengthSessions(athleteId: UUID, from: ISODate, to: ISODate): Promise<StrengthSession[]> {
    return clone(
      dataset().strengthSessions.filter((s) => s.athleteId === athleteId && s.date >= from && s.date <= to),
    );
  }

  async getStrengthSession(id: UUID): Promise<StrengthSession | null> {
    return clone(dataset().strengthSessions.find((s) => s.id === id) ?? null);
  }

  async saveStrengthSession(session: StrengthSession): Promise<StrengthSession> {
    const d = dataset();
    const i = d.strengthSessions.findIndex((s) => s.id === session.id);
    if (i >= 0) d.strengthSessions[i] = clone(session);
    else d.strengthSessions.push(clone(session));

    if (session.status === 'completed') {
      if (session.scheduledWorkoutId) {
        const sched = d.scheduled.find((w) => w.id === session.scheduledWorkoutId);
        if (sched) sched.status = 'completed';
      }
      await this.awardForgePoints({
        athleteId: session.athleteId,
        kind: 'strength_completed',
        points: 8,
        date: session.date,
        label: 'Strength session',
        sourceId: session.id,
      });
    }
    return clone(session);
  }

  /* ---------- check-ins ---------- */
  async listCheckIns(athleteId: UUID, limit = 52): Promise<CheckIn[]> {
    return clone(
      dataset()
        .checkins.filter((c) => c.athleteId === athleteId)
        .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
        .slice(0, limit),
    );
  }

  async getCheckIn(athleteId: UUID, weekStart: ISODate): Promise<CheckIn | null> {
    return clone(dataset().checkins.find((c) => c.athleteId === athleteId && c.weekStart === weekStart) ?? null);
  }

  async submitCheckIn(checkIn: Omit<CheckIn, 'id' | 'submittedAt'>): Promise<CheckIn> {
    const d = dataset();
    const row: CheckIn = { ...checkIn, id: uid('ci'), submittedAt: new Date().toISOString() };
    const i = d.checkins.findIndex((c) => c.athleteId === checkIn.athleteId && c.weekStart === checkIn.weekStart);
    if (i >= 0) d.checkins[i] = row;
    else d.checkins.push(row);

    await this.awardForgePoints({
      athleteId: checkIn.athleteId,
      kind: 'checkin_completed',
      points: 5,
      date: checkIn.weekStart,
      label: 'Weekly check-in',
      sourceId: row.id,
    });
    return clone(row);
  }

  async respondToCheckIn(id: UUID, coachId: UUID, response: string): Promise<void> {
    const c = dataset().checkins.find((x) => x.id === id);
    if (!c) return;
    c.coachResponse = response;
    c.reviewedByCoachAt = new Date().toISOString();
    void coachId;
  }

  async listCheckInQueue(coachId: UUID): Promise<(CheckIn & { athleteName: string })[]> {
    const d = dataset();
    const athletes = await this.listAthletesForCoach(coachId);
    const names = new Map(athletes.map((a) => [a.id, a.fullName]));
    return clone(
      d.checkins
        .filter((c) => names.has(c.athleteId))
        .sort((a, b) => {
          const rank = (x: CheckIn) => (x.reviewedByCoachAt ? 2 : x.attentionLevel === 'attention' ? 0 : 1);
          return rank(a) - rank(b) || b.weekStart.localeCompare(a.weekStart);
        })
        .map((c) => ({ ...c, athleteName: names.get(c.athleteId) ?? 'Athlete' })),
    );
  }

  /* ---------- forge score ---------- */
  async listForgeEvents(athleteId: UUID): Promise<ForgeScoreEvent[]> {
    return clone(
      dataset()
        .forgeEvents.filter((e) => e.athleteId === athleteId)
        .sort((a, b) => b.date.localeCompare(a.date)),
    );
  }

  async awardForgePoints(event: Omit<ForgeScoreEvent, 'id'>): Promise<void> {
    const d = dataset();
    // idempotent on (athlete, kind, source) — mirrors the unique index in SQL
    const dup = d.forgeEvents.some(
      (e) => e.athleteId === event.athleteId && e.kind === event.kind && e.sourceId != null && e.sourceId === event.sourceId,
    );
    if (dup) return;
    d.forgeEvents.push({ ...event, id: uid('fe') });
  }

  async getLeaderboard(scope: LeaderboardScope, category: LeaderboardCategory): Promise<LeaderboardEntry[]> {
    const d = dataset();
    const today = toISODate(new Date());
    const from =
      scope === 'weekly' ? startOfWeek(today) : scope === 'monthly' ? startOfMonth(today) : '0000-01-01';

    // leaderboard membership is opt-in — an athlete who has not opted in is absent
    const eligible = d.profiles.filter((p) => p.role === 'athlete' && p.leaderboardOptIn);

    const rows = eligible.map((p) => {
      const events = d.forgeEvents.filter((e) => e.athleteId === p.id && e.date >= from);
      const meta = CLUB_MEMBER_META.find((m) => m.id === p.id);
      let value: number;
      switch (category) {
        case 'consistency': {
          const weeks = new Set(events.map((e) => startOfWeek(e.date)));
          value = weeks.size;
          break;
        }
        case 'community':
          value = events.filter((e) => e.kind === 'community_run' || e.kind === 'volunteered').length;
          break;
        case 'streaks':
          value = currentStreakWeeks(
            d.forgeEvents.filter((e) => e.athleteId === p.id),
            today,
          );
          break;
        default:
          value = totalScore(events);
      }
      return {
        athleteId: p.id,
        displayName: p.fullName,
        avatarUrl: p.avatarUrl,
        value,
        rank: 0,
        group: meta?.group ?? null,
      };
    });

    return rows
      .sort((a, b) => b.value - a.value)
      .map((row, i) => ({ ...row, rank: i + 1 }));
  }

  async listAchievements(athleteId: UUID): Promise<Achievement[]> {
    return clone(
      dataset()
        .achievements.filter((a) => a.athleteId === athleteId)
        .sort((a, b) => b.earnedAt.localeCompare(a.earnedAt)),
    );
  }

  /** eventId -> athletes attending. Mirrors the event_attendance table. */
  private attendance = new Map<string, Set<string>>();

  async listCommunityEvents(viewerId?: UUID): Promise<CommunityEvent[]> {
    return clone(
      dataset()
        .communityEvents.slice()
        .sort((a, b) => a.startsAt.localeCompare(b.startsAt))
        .map((e) => ({
          ...e,
          attending: viewerId ? (this.attendance.get(e.id)?.has(viewerId) ?? false) : false,
        })),
    );
  }

  async listCommunityPosts(): Promise<CommunityPost[]> {
    return clone(dataset().communityPosts.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async setEventAttendance(eventId: UUID, athleteId: UUID, going: boolean): Promise<void> {
    const e = dataset().communityEvents.find((x) => x.id === eventId);
    if (!e) return;

    const going_ = this.attendance.get(eventId) ?? new Set<string>();
    const already = going_.has(athleteId);
    if (going && !already) {
      going_.add(athleteId);
      e.attendingCount += 1;
    } else if (!going && already) {
      going_.delete(athleteId);
      e.attendingCount = Math.max(0, e.attendingCount - 1);
    }
    this.attendance.set(eventId, going_);
  }

  /* ---------- coaching comms ---------- */
  async listMessages(athleteId: UUID): Promise<Message[]> {
    return clone(
      dataset()
        .messages.filter((m) => m.senderId === athleteId || m.recipientId === athleteId)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    );
  }

  async sendMessage(msg: Omit<Message, 'id' | 'createdAt' | 'readAt'>): Promise<Message> {
    const row: Message = { ...msg, id: uid('msg'), createdAt: new Date().toISOString(), readAt: null };
    dataset().messages.push(row);
    return clone(row);
  }

  async markMessagesRead(athleteId: UUID, readerId: UUID): Promise<void> {
    const now = new Date().toISOString();
    for (const m of dataset().messages) {
      if (m.recipientId === readerId && (m.senderId === athleteId || m.recipientId === athleteId) && !m.readAt) {
        m.readAt = now;
      }
    }
  }

  async listCoachNotes(athleteId: UUID, viewerRole: 'athlete' | 'coach'): Promise<CoachNote[]> {
    return clone(
      dataset()
        .coachNotes.filter(
          (n) => n.athleteId === athleteId && (viewerRole === 'coach' || n.visibility === 'shared'),
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  async addCoachNote(note: Omit<CoachNote, 'id' | 'createdAt'>): Promise<CoachNote> {
    const row: CoachNote = { ...note, id: uid('cn'), createdAt: new Date().toISOString() };
    dataset().coachNotes.push(row);
    return clone(row);
  }

  /* ---------- billing + integrations ---------- */
  async getSubscription(athleteId: UUID): Promise<Subscription | null> {
    return clone(dataset().subscriptions.find((s) => s.athleteId === athleteId) ?? null);
  }

  async listIntegrations(athleteId: UUID): Promise<Integration[]> {
    return clone(dataset().integrations.filter((i) => i.athleteId === athleteId));
  }

  async listNotifications(userId: UUID): Promise<Notification[]> {
    return clone(
      dataset()
        .notifications.filter((n) => n.userId === userId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  /* ---------- public ---------- */
  private applications: CoachingApplication[] = [];

  async createApplication(
    app: Omit<
      CoachingApplication,
      'id' | 'createdAt' | 'status' | 'acceptedBy' | 'acceptedAt' | 'decidedNote' | 'joinedAthleteId'
    >,
  ): Promise<CoachingApplication> {
    const row: CoachingApplication = {
      ...app,
      id: uid('app'),
      status: 'new',
      createdAt: new Date().toISOString(),
      acceptedBy: null,
      acceptedAt: null,
      decidedNote: null,
      joinedAthleteId: null,
    };
    this.applications.push(row);
    return clone(row);
  }

  async listApplications(status?: ApplicationStatus): Promise<CoachingApplication[]> {
    return clone(
      this.applications
        .filter((a) => !status || a.status === status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    );
  }

  /**
   * Demo intake.
   *
   * Production cannot create an account on the athlete's behalf — a profile is
   * tied to an auth user, so acceptance there records the decision and the link
   * forms when the athlete registers. There is no auth here, so accepting
   * creates the athlete and links them immediately and reports that it did
   * (`awaitingSignUp: false`), which the coach UI states plainly rather than
   * implying an invite was sent.
   */
  async decideApplication(
    applicationId: UUID,
    coachId: UUID,
    decision: ApplicationStatus,
    note: string | null,
  ): Promise<AcceptanceOutcome> {
    const app = this.applications.find((a) => a.id === applicationId);
    if (!app) throw new Error('Application not found');

    app.status = decision;
    app.decidedNote = note;

    if (decision !== 'accepted') {
      app.acceptedBy = null;
      app.acceptedAt = null;
      return { application: clone(app), athleteId: null, awaitingSignUp: false };
    }

    app.acceptedBy = coachId;
    app.acceptedAt = new Date().toISOString();

    const d = dataset();
    const existing = d.profiles.find(
      (p) => p.email.toLowerCase() === app.email.toLowerCase() && p.role === 'athlete',
    );

    const athleteId = existing?.id ?? uid('athlete');
    if (!existing) {
      d.profiles.push({
        id: athleteId,
        role: 'athlete',
        fullName: app.fullName,
        email: app.email,
        avatarUrl: null,
        dateOfBirth: null,
        location: null,
        timezone: 'Europe/Dublin',
        units: 'metric',
        createdAt: new Date().toISOString(),
        // not onboarded: their first sign-in lands on onboarding, as in production
        onboardedAt: null,
        healthDataConsentAt: null,
        leaderboardOptIn: false,
        forgeAssistantEnabled: true,
        experienceLevel: null,
        trainingPhase: null,
        preferredTrainingDays: [],
        availableTrainingDays: [],
        typicalSessionMinutes: null,
        currentWeeklyKm: null,
        gymAccess: null,
        equipment: [],
        injuryNotes: null,
        limitationsNotes: null,
      });
    }

    await this.linkAthlete(coachId, athleteId);
    app.joinedAthleteId = athleteId;

    return { application: clone(app), athleteId, awaitingSignUp: false };
  }

  async linkAthlete(coachId: UUID, athleteId: UUID): Promise<void> {
    const d = dataset();
    const existing = d.links.find((l) => l.coachId === coachId && l.athleteId === athleteId);
    if (existing) {
      existing.status = 'active';
      existing.endedAt = null;
      return;
    }
    d.links.push({
      id: uid('link'),
      coachId,
      athleteId,
      status: 'active',
      startedAt: new Date().toISOString(),
      endedAt: null,
    });
  }

  async createProgram(program: Omit<Program, 'id' | 'createdAt'>): Promise<Program> {
    const d = dataset();
    // one active programme per athlete; assigning a new block retires the old one
    for (const p of d.programs) {
      if (p.athleteId === program.athleteId && p.status === 'active') p.status = 'archived';
    }
    const row: Program = { ...program, id: uid('prog'), createdAt: new Date().toISOString() };
    d.programs.push(row);
    return clone(row);
  }

  /* ================= programme structure =================
     The demo adapter mirrors the database semantics, including the audit
     trail: a demo that quietly skipped history would hide exactly the bug the
     history exists to prevent. ================================================ */

  /** Blocks and weeks live in the dataset so they rebuild with it each day. */
  private get blocks(): ProgramBlock[] {
    return dataset().blocks;
  }
  private get weeks(): ProgramWeek[] {
    return dataset().weeks;
  }
  private components: SessionComponent[] = [];
  private revisions: SessionRevision[] = [];

  /** Mirrors the Postgres trigger. Called wherever a session changes. */
  private snapshot(
    session: ScheduledWorkout | { id: UUID; athleteId: UUID },
    kind: SessionRevision['kind'],
    changedBy: UUID | null = null,
  ) {
    const existing = this.revisions.filter((r) => r.scheduledWorkoutId === session.id);
    this.revisions.push({
      id: uid('rev'),
      scheduledWorkoutId: session.id,
      athleteId: session.athleteId,
      revision: existing.length + 1,
      kind,
      changedBy,
      changedAt: new Date().toISOString(),
      session: clone(session) as unknown as Record<string, unknown>,
      components: clone(
        this.components.filter((c) => c.scheduledWorkoutId === session.id),
      ) as unknown as Record<string, unknown>[],
      note: null,
    });
  }

  async listBlocks(programId: UUID): Promise<BlockWithWeeks[]> {
    return clone(
      this.blocks
        .filter((b) => b.programId === programId)
        .sort((a, b) => a.blockIndex - b.blockIndex)
        .map((b) => ({
          ...b,
          weeks: this.weeks
            .filter((w) => w.blockId === b.id)
            .sort((x, y) => x.startDate.localeCompare(y.startDate)),
        })),
    );
  }

  async createBlock(block: Omit<ProgramBlock, 'id' | 'createdAt'>): Promise<ProgramBlock> {
    const row: ProgramBlock = { ...block, id: uid('blk'), createdAt: new Date().toISOString() };
    this.blocks.push(row);
    return clone(row);
  }

  async updateBlock(blockId: UUID, patch: Partial<ProgramBlock>): Promise<void> {
    const b = this.blocks.find((x) => x.id === blockId);
    if (b) Object.assign(b, patch, { id: b.id });
  }

  async deleteBlock(blockId: UUID): Promise<void> {
    // Matches the database guard: a populated block is never silently removed,
    // because doing so would take prescribed athlete history with it.
    const weekIds = this.weeks.filter((w) => w.blockId === blockId).map((w) => w.id);
    const sessions = dataset().scheduled.filter((w) => weekIds.includes(w.programWeekId ?? ''));
    if (weekIds.length || sessions.length) {
      throw new Error(
        `This block still holds ${weekIds.length} week(s) and ${sessions.length} prescribed session(s). ` +
          'Archive it instead, or empty it first.',
      );
    }
    const ds = dataset();
    ds.blocks = ds.blocks.filter((b) => b.id !== blockId);
  }

  async createWeek(week: Omit<ProgramWeek, 'id' | 'createdAt'>): Promise<ProgramWeek> {
    if (weekdayIndex(week.startDate) !== 0) throw new Error('A training week starts on a Monday');
    const row: ProgramWeek = { ...week, id: uid('wk'), createdAt: new Date().toISOString() };
    this.weeks.push(row);
    return clone(row);
  }

  async updateWeek(weekId: UUID, patch: Partial<ProgramWeek>): Promise<void> {
    const w = this.weeks.find((x) => x.id === weekId);
    if (w) Object.assign(w, patch, { id: w.id });
  }

  async findWeekByDate(programId: UUID, date: ISODate): Promise<ProgramWeek | null> {
    const start = startOfWeek(date);
    return clone(this.weeks.find((w) => w.programId === programId && w.startDate === start) ?? null);
  }

  async listComponents(scheduledWorkoutId: UUID): Promise<SessionComponent[]> {
    return clone(
      this.components
        .filter((c) => c.scheduledWorkoutId === scheduledWorkoutId)
        .sort((a, b) => a.position - b.position),
    );
  }

  async saveComponents(
    scheduledWorkoutId: UUID,
    athleteId: UUID,
    components: SessionComponentDraft[],
  ): Promise<SessionComponent[]> {
    this.components = this.components.filter((c) => c.scheduledWorkoutId !== scheduledWorkoutId);
    const rows = components.map((c, i) => ({
      ...c,
      position: i,
      id: uid('cmp'),
      scheduledWorkoutId,
      athleteId,
    }));
    this.components.push(...rows);

    const session = dataset().scheduled.find((w) => w.id === scheduledWorkoutId);
    if (session) this.snapshot(session, 'edited');
    return clone(rows);
  }

  /* ---- duplication ---- */

  async duplicateWeek(sourceWeekId: UUID, targetStart: ISODate, targetBlockId?: UUID): Promise<UUID> {
    if (weekdayIndex(targetStart) !== 0) throw new Error('A training week starts on a Monday');
    const src = this.weeks.find((w) => w.id === sourceWeekId);
    if (!src) throw new Error('Source week not found');

    let target = this.weeks.find((w) => w.programId === src.programId && w.startDate === targetStart);
    if (!target) {
      const blockId = targetBlockId ?? src.blockId;
      target = await this.createWeek({
        blockId,
        programId: src.programId,
        athleteId: src.athleteId,
        weekIndex: this.weeks.filter((w) => w.blockId === blockId).length,
        programWeekNo: this.weeks.filter((w) => w.programId === src.programId).length + 1,
        startDate: targetStart,
        targetVolumeKm: src.targetVolumeKm,
        focus: src.focus,
        notes: src.notes,
        isRecoveryWeek: src.isRecoveryWeek,
      });
      // createWeek pushed a clone; take the live row back
      target = this.weeks[this.weeks.length - 1];
    }

    const d = dataset();
    const offset = daysBetween(src.startDate, targetStart);
    for (const s of d.scheduled.filter((x) => x.programWeekId === sourceWeekId)) {
      const date = addDays(s.date, offset);
      const copy: ScheduledWorkout = {
        ...clone(s),
        id: uid('sw'),
        date,
        programWeekId: target.id,
        // a copy is a plan again, whatever happened to the original
        status: 'scheduled',
        createdAt: new Date().toISOString(),
      };
      const clash = d.scheduled.findIndex((x) => x.athleteId === copy.athleteId && x.date === date && x.slot === copy.slot);
      if (clash >= 0) d.scheduled[clash] = copy;
      else d.scheduled.push(copy);

      this.components = this.components.filter((c) => c.scheduledWorkoutId !== copy.id);
      this.components.push(
        ...this.components
          .filter((c) => c.scheduledWorkoutId === s.id)
          .map((c) => ({ ...clone(c), id: uid('cmp'), scheduledWorkoutId: copy.id })),
      );
      this.snapshot(copy, 'created');
    }
    return target.id;
  }

  async duplicateBlock(sourceBlockId: UUID, targetStart: ISODate, name?: string): Promise<UUID> {
    const src = this.blocks.find((b) => b.id === sourceBlockId);
    if (!src) throw new Error('Source block not found');

    const block = await this.createBlock({
      programId: src.programId,
      athleteId: src.athleteId,
      blockIndex: this.blocks.filter((b) => b.programId === src.programId).length,
      name: name ?? `${src.name} (copy)`,
      phase: src.phase,
      focus: src.focus,
      notes: src.notes,
    });

    const weeks = this.weeks
      .filter((w) => w.blockId === sourceBlockId)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
    if (!weeks.length) return block.id;

    const offset = daysBetween(weeks[0].startDate, targetStart);
    for (const w of weeks) {
      await this.duplicateWeek(w.id, addDays(w.startDate, offset), block.id);
    }
    return block.id;
  }

  async assignProgramToAthlete(
    sourceProgramId: UUID,
    athleteId: UUID,
    startDate: ISODate,
    name?: string,
  ): Promise<UUID> {
    const d = dataset();
    const src = d.programs.find((p) => p.id === sourceProgramId);
    if (!src) throw new Error('Source programme not found');
    if (weekdayIndex(startDate) !== 0) throw new Error('A programme starts on a Monday');

    const offset = daysBetween(src.startDate, startDate);
    const program = await this.createProgram({
      athleteId,
      coachId: src.coachId,
      templateId: src.templateId,
      goalId: null,
      name: name ?? src.name,
      startDate,
      endDate: addDays(src.endDate, offset),
      status: 'active',
    });

    for (const b of this.blocks.filter((x) => x.programId === sourceProgramId)) {
      const block = await this.createBlock({
        programId: program.id,
        athleteId,
        blockIndex: b.blockIndex,
        name: b.name,
        phase: b.phase,
        focus: b.focus,
        notes: b.notes,
      });

      for (const w of this.weeks.filter((x) => x.blockId === b.id)) {
        const week = await this.createWeek({
          blockId: block.id,
          programId: program.id,
          athleteId,
          weekIndex: w.weekIndex,
          programWeekNo: w.programWeekNo,
          startDate: addDays(w.startDate, offset),
          targetVolumeKm: w.targetVolumeKm,
          focus: w.focus,
          notes: w.notes,
          isRecoveryWeek: w.isRecoveryWeek,
        });

        for (const s of d.scheduled.filter((x) => x.programWeekId === w.id)) {
          const copy: ScheduledWorkout = {
            ...clone(s),
            id: uid('sw'),
            athleteId,
            programId: program.id,
            programWeekId: week.id,
            date: addDays(s.date, offset),
            status: 'scheduled',
            createdAt: new Date().toISOString(),
          };
          d.scheduled.push(copy);
          this.snapshot(copy, 'created');
        }
      }
    }
    return program.id;
  }

  /* ---- prescription history ---- */

  async listSessionRevisions(scheduledWorkoutId: UUID): Promise<SessionRevision[]> {
    return clone(
      this.revisions
        .filter((r) => r.scheduledWorkoutId === scheduledWorkoutId)
        .sort((a, b) => a.revision - b.revision),
    );
  }

  async getOriginalPrescription(scheduledWorkoutId: UUID): Promise<Record<string, unknown> | null> {
    const first = this.revisions
      .filter((r) => r.scheduledWorkoutId === scheduledWorkoutId)
      .sort((a, b) => a.revision - b.revision)[0];
    return first ? clone(first.session) : null;
  }

  /* ---------- privacy ---------- */
  async exportAthleteData(athleteId: UUID): Promise<Record<string, unknown>> {
    const d = dataset();
    const own = <T extends { athleteId?: string }>(rows: T[]) => rows.filter((r) => r.athleteId === athleteId);
    return clone({
      profile: d.profiles.find((p) => p.id === athleteId) ?? null,
      goals: own(d.goals),
      scheduledWorkouts: own(d.scheduled),
      completedWorkouts: own(d.completed),
      strengthSessions: own(d.strengthSessions),
      checkins: own(d.checkins),
      forgeScoreEvents: own(d.forgeEvents),
      achievements: own(d.achievements),
      messages: d.messages.filter((m) => m.senderId === athleteId || m.recipientId === athleteId),
      sharedCoachNotes: d.coachNotes.filter((n) => n.athleteId === athleteId && n.visibility === 'shared'),
      exportedAt: new Date().toISOString(),
    });
  }

  /* ================= the libraries ================= */

  private workoutTemplates: WorkoutTemplate[] = clone(DEMO_WORKOUT_TEMPLATES);
  private strengthExercises: StrengthExercise[] = clone(DEMO_STRENGTH_EXERCISES);
  private strengthTemplates: StrengthTemplate[] = clone(DEMO_STRENGTH_TEMPLATES);

  /** The same filtering the database does, so the two adapters agree. */
  private filterLibrary<T extends { name: string; tags: string[]; visibility: string; archivedAt: string | null }>(
    items: T[],
    q: LibraryQuery = {},
    extraText: (item: T) => (string | null)[] = () => [],
  ): T[] {
    const term = q.search?.trim().toLowerCase();
    return clone(
      items
        .filter((i) => (q.includeArchived ? true : !i.archivedAt))
        .filter((i) => (q.visibility ? i.visibility === q.visibility : true))
        .filter((i) => (q.category ? (i as { category?: string }).category === q.category : true))
        .filter((i) =>
          q.movementPattern ? (i as { movementPattern?: string }).movementPattern === q.movementPattern : true,
        )
        .filter((i) => (q.tags?.length ? i.tags.some((t) => q.tags!.includes(t)) : true))
        .filter((i) =>
          term
            ? [i.name, ...extraText(i), ...i.tags].some((t) => t?.toLowerCase().includes(term))
            : true,
        )
        .sort((a, b) => a.name.localeCompare(b.name))
        .slice(0, q.limit ?? 200),
    );
  }

  async listWorkoutTemplates(query?: LibraryQuery): Promise<WorkoutTemplate[]> {
    return this.filterLibrary(this.workoutTemplates, query, (t) => [t.purpose]);
  }

  async getWorkoutTemplate(id: UUID): Promise<WorkoutTemplate | null> {
    return clone(this.workoutTemplates.find((t) => t.id === id) ?? null);
  }

  async saveWorkoutTemplate(
    template: WorkoutTemplateDraft,
    components?: TemplateComponentDraft[],
  ): Promise<WorkoutTemplate> {
    return this.saveLibraryItem(this.workoutTemplates, template, components, 'wt');
  }

  async listStrengthExercises(query?: LibraryQuery): Promise<StrengthExercise[]> {
    return this.filterLibrary(this.strengthExercises, query, (e) => [e.description]);
  }

  async getStrengthExercise(id: UUID): Promise<StrengthExercise | null> {
    return clone(this.strengthExercises.find((e) => e.id === id) ?? null);
  }

  async saveStrengthExercise(exercise: StrengthExerciseDraft): Promise<StrengthExercise> {
    return this.saveLibraryItem(this.strengthExercises, exercise, undefined, 'ex');
  }

  async listStrengthTemplates(query?: LibraryQuery): Promise<StrengthTemplate[]> {
    return this.filterLibrary(this.strengthTemplates, query, (t) => [t.description]);
  }

  async getStrengthTemplate(id: UUID): Promise<StrengthTemplate | null> {
    return clone(this.strengthTemplates.find((t) => t.id === id) ?? null);
  }

  async saveStrengthTemplate(
    template: StrengthTemplateDraft,
    components?: TemplateComponentDraft[],
  ): Promise<StrengthTemplate> {
    return this.saveLibraryItem(this.strengthTemplates, template, components, 'st');
  }

  private saveLibraryItem<T extends { id: UUID; visibility: string; components?: SessionComponent[] }>(
    store: T[],
    draft: { id?: UUID },
    components: TemplateComponentDraft[] | undefined,
    prefix: string,
  ): T {
    const existing = draft.id ? store.find((i) => i.id === draft.id) : undefined;
    if (existing?.visibility === 'system') {
      throw new Error('System library content cannot be edited. Duplicate it and edit your copy.');
    }

    const now = new Date().toISOString();
    const positioned = components?.map((c, i) => ({ ...c, position: i, id: uid('tc'), scheduledWorkoutId: '', athleteId: '' }));

    if (existing) {
      Object.assign(existing, draft, { id: existing.id, updatedAt: now });
      if (positioned) existing.components = positioned as SessionComponent[];
      return clone(existing);
    }

    const row = {
      ...draft,
      id: draft.id ?? uid(prefix),
      createdAt: now,
      updatedAt: now,
      ...(positioned ? { components: positioned } : {}),
    } as unknown as T;
    store.push(row);
    return clone(row);
  }

  private libraryStore(kind: LibraryKind) {
    if (kind === 'workout') return this.workoutTemplates;
    if (kind === 'exercise') return this.strengthExercises;
    return this.strengthTemplates;
  }

  async setLibraryArchived(kind: LibraryKind, id: UUID, archived: boolean): Promise<void> {
    const item = this.libraryStore(kind).find((i) => i.id === id);
    if (!item) throw new Error('That library item is no longer available.');
    if (item.visibility === 'system') {
      throw new Error('System library content cannot be edited. Duplicate it and edit your copy.');
    }
    item.archivedAt = archived ? new Date().toISOString() : null;
    item.updatedAt = new Date().toISOString();
  }

  async duplicateLibraryItem(kind: LibraryKind, id: UUID, name?: string): Promise<UUID> {
    const store = this.libraryStore(kind);
    const source = store.find((i) => i.id === id);
    if (!source) throw new Error('That library item is no longer available.');
    const now = new Date().toISOString();
    const copy = {
      ...clone(source),
      id: uid(kind),
      name: name ?? `${source.name} (copy)`,
      // a copy is always the coach's own, whatever it came from
      visibility: 'private' as const,
      ownerId: DEMO_COACH_ID,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    store.push(copy as never);
    return copy.id;
  }

  async insertTemplateIntoProgramme(
    kind: 'workout' | 'strength',
    templateId: UUID,
    athleteId: UUID,
    date: ISODate,
    slotInput?: number,
  ): Promise<UUID> {
    const slot = slotInput ?? (kind === 'strength' ? 1 : 0);
    const template =
      kind === 'workout'
        ? this.workoutTemplates.find((t) => t.id === templateId)
        : this.strengthTemplates.find((t) => t.id === templateId);
    if (!template) throw new Error('That template is no longer available.');
    if (template.archivedAt) throw new Error('That template is archived. Restore it first.');

    const d = dataset();
    const program = d.programs.find((p) => p.athleteId === athleteId && p.status === 'active');
    const week = program ? await this.findWeekByDate(program.id, date) : null;

    const workout = kind === 'workout' ? (template as WorkoutTemplate) : null;
    const strength = kind === 'strength' ? (template as StrengthTemplate) : null;

    // A copy, not a reference: later edits to the template must not reach a
    // session an athlete has already been given.
    const session = clone({
      id: uid('sw'),
      athleteId,
      programId: program?.id ?? null,
      programWeekId: week?.id ?? null,
      date,
      slot,
      name: template.name,
      type: workout?.type ?? 'strength',
      basis: workout?.basis ?? 'time',
      intensity: workout?.intensity ?? 'easy',
      distanceKm: workout?.distanceKm ?? null,
      durationMinutes: workout?.durationMinutes ?? strength?.estimatedMinutes ?? null,
      paceMinSecPerKm: workout?.paceMinSecKm ?? null,
      paceMaxSecPerKm: workout?.paceMaxSecKm ?? null,
      hrZone: workout?.hrZone ?? null,
      rpeTarget: workout?.rpeTarget ?? null,
      warmUp: workout?.warmUp ?? null,
      mainSet: workout?.mainSet ?? null,
      coolDown: workout?.coolDown ?? null,
      description: template.purpose ?? null,
      coachNotes: null,
      status: 'scheduled' as const,
      prescriptionRevision: 1,
      sourceWorkoutTemplateId: kind === 'workout' ? template.id : null,
      sourceStrengthTemplateId: kind === 'strength' ? template.id : null,
      createdAt: new Date().toISOString(),
    }) as unknown as ScheduledWorkout;

    // a day holds one session per slot: the database has a unique constraint on
    // (athlete, date, slot) and replaces on conflict, so this has to as well
    const occupied = d.scheduled.findIndex(
      (w) => w.athleteId === athleteId && w.date === date && w.slot === slot,
    );
    if (occupied >= 0) {
      const previous = d.scheduled[occupied];
      this.snapshot(previous, 'edited');
      session.id = previous.id;
      session.prescriptionRevision = (previous.prescriptionRevision ?? 1) + 1;
      d.scheduled[occupied] = session;
      this.components = this.components.filter((c) => c.scheduledWorkoutId !== session.id);
    } else {
      d.scheduled.push(session);
    }

    const copied = clone(template.components ?? []);
    this.components.push(
      ...copied.map((c, i) => ({
        ...c,
        id: uid('cmp'),
        position: i,
        scheduledWorkoutId: session.id,
        athleteId,
      })),
    );

    return session.id;
  }

  private programTemplates: ProgramTemplateItem[] = clone(DEMO_PROGRAM_TEMPLATES);

  async listProgramTemplates(query?: LibraryQuery): Promise<ProgramTemplateItem[]> {
    return this.filterLibrary(this.programTemplates, query, (t) => [t.description]);
  }

  async getProgramTemplate(id: UUID): Promise<ProgramTemplateItem | null> {
    return clone(this.programTemplates.find((t) => t.id === id) ?? null);
  }

  async getWeekVolume(weekId: UUID): Promise<WeekVolume> {
    const week = this.weeks.find((w) => w.id === weekId);
    // every prescribed session counts, matching im_week_volume
    const sessions = dataset().scheduled.filter((s) => s.programWeekId === weekId);
    return {
      prescribedKm: Number(sessions.reduce((sum, s) => sum + (s.distanceKm ?? 0), 0).toFixed(1)),
      targetKm: week?.targetVolumeKm ?? null,
      sessionCount: sessions.length,
    };
  }

  /* ================= the programme template builder ================= */

  private templateBlocks: ProgramTemplateBlock[] = clone(DEMO_TEMPLATE_BLOCKS);
  private templateWeeks: ProgramTemplateWeek[] = clone(DEMO_TEMPLATE_WEEKS);
  private templateSlots: ProgramTemplateSlot[] = clone(DEMO_TEMPLATE_SLOTS);

  async getProgramTemplateDetail(id: UUID): Promise<ProgramTemplateDetail | null> {
    const template = this.programTemplates.find((t) => t.id === id);
    if (!template) return null;
    const volume = await this.getTemplateVolume(id);

    return clone({
      ...(template as unknown as ProgramTemplate),
      volume,
      blocks: this.templateBlocks
        .filter((b) => b.programTemplateId === id)
        .sort((a, b) => a.blockIndex - b.blockIndex)
        .map((b) => ({
          ...b,
          weeks: this.templateWeeks
            .filter((w) => w.blockId === b.id)
            .sort((a, c) => a.weekIndex - c.weekIndex)
            .map((w) => ({
              ...w,
              slots: this.templateSlots
                .filter((sl) => sl.templateWeekId === w.id)
                .sort((a, c) => a.weekday - c.weekday || a.slot - c.slot),
            })),
        })),
    });
  }

  async saveProgramTemplate(template: ProgramTemplateDraft): Promise<ProgramTemplate> {
    const existing = template.id ? this.programTemplates.find((t) => t.id === template.id) : undefined;
    if (existing?.visibility === 'system') {
      throw new Error('System library content cannot be edited. Duplicate it and edit your copy.');
    }
    const now = new Date().toISOString();
    if (existing) {
      Object.assign(existing, template, { id: existing.id, updatedAt: now });
      return clone(existing as unknown as ProgramTemplate);
    }
    const row = {
      ...template,
      id: template.id ?? uid('pt'),
      weeks: template.weeks ?? 1,
      createdAt: now,
      updatedAt: now,
    } as unknown as ProgramTemplateItem;
    this.programTemplates.push(row);
    return clone(row as unknown as ProgramTemplate);
  }

  /** weeks follows the structure, the way the database trigger keeps it. */
  private syncTemplateWeeks(templateId: UUID) {
    const count = this.templateWeeks.filter((w) => w.programTemplateId === templateId).length;
    const template = this.programTemplates.find((t) => t.id === templateId);
    if (template && count > 0) {
      (template as { weeks: number }).weeks = count;
      template.updatedAt = new Date().toISOString();
    }
  }

  async saveTemplateBlock(block: TemplateBlockDraft): Promise<ProgramTemplateBlock> {
    const existing = block.id ? this.templateBlocks.find((b) => b.id === block.id) : undefined;
    if (existing) {
      Object.assign(existing, block, { id: existing.id });
      return clone(existing);
    }
    const row: ProgramTemplateBlock = { ...block, id: block.id ?? uid('ptb'), createdAt: new Date().toISOString() };
    this.templateBlocks.push(row);
    return clone(row);
  }

  async deleteTemplateBlock(blockId: UUID): Promise<void> {
    const weeks = this.templateWeeks.filter((w) => w.blockId === blockId).length;
    if (weeks) {
      throw new Error(
        `This block still holds ${weeks} week(s). Remove them first, or delete the weeks you no longer want.`,
      );
    }
    this.templateBlocks = this.templateBlocks.filter((b) => b.id !== blockId);
  }

  async saveTemplateWeek(week: TemplateWeekDraft): Promise<ProgramTemplateWeek> {
    const existing = week.id ? this.templateWeeks.find((w) => w.id === week.id) : undefined;
    if (existing) {
      Object.assign(existing, week, { id: existing.id });
      return clone(existing);
    }
    const row: ProgramTemplateWeek = { ...week, id: week.id ?? uid('ptw'), createdAt: new Date().toISOString() };
    this.templateWeeks.push(row);
    this.syncTemplateWeeks(row.programTemplateId);
    return clone(row);
  }

  async deleteTemplateWeek(weekId: UUID): Promise<void> {
    const week = this.templateWeeks.find((w) => w.id === weekId);
    this.templateSlots = this.templateSlots.filter((s) => s.templateWeekId !== weekId);
    this.templateWeeks = this.templateWeeks.filter((w) => w.id !== weekId);
    if (week) this.syncTemplateWeeks(week.programTemplateId);
  }

  async saveTemplateSlot(slot: TemplateSlotDraft): Promise<ProgramTemplateSlot> {
    // one session per day per slot, as the database unique index enforces
    const clash = this.templateSlots.find(
      (s) => s.templateWeekId === slot.templateWeekId && s.weekday === slot.weekday
        && s.slot === slot.slot && s.id !== slot.id,
    );
    if (clash) this.templateSlots = this.templateSlots.filter((s) => s.id !== clash.id);

    const existing = slot.id ? this.templateSlots.find((s) => s.id === slot.id) : undefined;
    if (existing) {
      Object.assign(existing, slot, { id: existing.id });
      return clone(existing);
    }
    const row: ProgramTemplateSlot = { ...slot, id: slot.id ?? uid('pts') };
    this.templateSlots.push(row);
    return clone(row);
  }

  async deleteTemplateSlot(slotId: UUID): Promise<void> {
    this.templateSlots = this.templateSlots.filter((s) => s.id !== slotId);
  }

  async duplicateProgramTemplate(id: UUID, name?: string): Promise<UUID> {
    const source = this.programTemplates.find((t) => t.id === id);
    if (!source) throw new Error('That programme template is not available to you.');

    const now = new Date().toISOString();
    const copy = {
      ...clone(source),
      id: uid('pt'),
      name: name ?? `${source.name} (copy)`,
      visibility: 'private' as const,
      ownerId: DEMO_COACH_ID,
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    this.programTemplates.push(copy);

    for (const b of this.templateBlocks.filter((x) => x.programTemplateId === id)) {
      const block: ProgramTemplateBlock = { ...clone(b), id: uid('ptb'), programTemplateId: copy.id, createdAt: now };
      this.templateBlocks.push(block);

      for (const w of this.templateWeeks.filter((x) => x.blockId === b.id)) {
        const week: ProgramTemplateWeek = {
          ...clone(w), id: uid('ptw'), programTemplateId: copy.id, blockId: block.id, createdAt: now,
        };
        this.templateWeeks.push(week);

        for (const sl of this.templateSlots.filter((x) => x.templateWeekId === w.id)) {
          this.templateSlots.push({
            ...clone(sl), id: uid('pts'), programTemplateId: copy.id, templateWeekId: week.id,
          });
        }
      }
    }
    return copy.id;
  }

  /** The same rule im_template_week_volume applies: sum the distances. */
  async getTemplateVolume(templateId: UUID): Promise<TemplateWeekVolume[]> {
    const blocks = new Map(this.templateBlocks.map((b) => [b.id, b]));
    return this.templateWeeks
      .filter((w) => w.programTemplateId === templateId)
      .sort((a, b) => a.templateWeekNo - b.templateWeekNo)
      .map((w) => {
        const slots = this.templateSlots.filter((s) => s.templateWeekId === w.id);
        const training = slots.filter((s) => !s.isRest);
        const block = blocks.get(w.blockId);
        return {
          templateWeekNo: w.templateWeekNo,
          blockName: block?.name ?? '',
          phase: block?.phase ?? null,
          isRecoveryWeek: w.isRecoveryWeek,
          targetKm: w.targetVolumeKm,
          prescribedKm: Number(
            training
              .reduce((sum, s) => sum + (s.distanceKm ?? this.workoutDistance(s.workoutTemplateId) ?? 0), 0)
              .toFixed(1),
          ),
          sessionCount: training.length,
          restDays: slots.filter((s) => s.isRest).length,
          trainingDays: new Set(training.map((s) => s.weekday)).size,
        };
      });
  }

  private workoutDistance(id: UUID | null): number | null {
    return id ? (this.workoutTemplates.find((w) => w.id === id)?.distanceKm ?? null) : null;
  }

  /**
   * The same rules im_template_conflicts applies.
   *
   * Duplicated deliberately rather than shared: in Postgres these are the
   * authorisation boundary and must be evaluated there. Here they exist so
   * demo mode shows a coach the same warnings, and the parity tests are what
   * keep the two honest.
   */
  async getAssignmentConflicts(
    templateId: UUID,
    athleteId: UUID,
    startDate: ISODate,
  ): Promise<AssignmentConflict[]> {
    const out: AssignmentConflict[] = [];
    const block = (kind: AssignmentConflict['kind'], detail: string) =>
      out.push({ severity: 'block', kind, detail });
    const warn = (kind: AssignmentConflict['kind'], detail: string) =>
      out.push({ severity: 'warn', kind, detail });

    const template = this.programTemplates.find((t) => t.id === templateId);
    const profile = dataset().profiles.find((p) => p.id === athleteId);
    if (!template) { block('template', 'That programme template is not available to you.'); return out; }
    if (!profile) { block('athlete', 'That athlete no longer exists.'); return out; }
    if (template.archivedAt) {
      block('archived', 'This template is archived. Restore it before assigning it.');
    }

    const weeks = this.templateWeeks.filter((w) => w.programTemplateId === templateId);
    const slots = this.templateSlots.filter((s) => s.programTemplateId === templateId);
    if (!weeks.length) {
      block('structure', 'This template has no weeks yet. Add a block and at least one week before assigning it.');
    } else if (!slots.some((s) => !s.isRest)) {
      block('structure', 'This template prescribes no sessions — only rest days. Add sessions before assigning it.');
    }
    if (weekdayIndex(startDate) !== 0) block('start_date', 'A programme starts on a Monday.');

    const needed = [...new Set(slots.filter((s) => !s.isRest).map((s) => s.weekday))].sort((a, b) => a - b);
    const available = profile.availableTrainingDays ?? [];
    const preferred = profile.preferredTrainingDays ?? [];

    if (!available.length) {
      warn('availability', 'This athlete has not told us which days they can train, so nothing can be checked against.');
    } else if (needed.length) {
      const unmet = needed.filter((d) => !available.includes(d));
      if (unmet.length) {
        warn('availability',
          `The programme trains on ${weekdayList(unmet)}, which the athlete has not said they are available for.`);
      }
      if (needed.length < available.length) {
        warn('availability',
          `The athlete is available on ${weekdayList(available)}; the programme only uses ${weekdayList(needed)}.`);
      }
    }

    if (preferred.length && needed.length) {
      const unmet = needed.filter((d) => !preferred.includes(d));
      if (unmet.length) {
        warn('preferred_days',
          `The programme trains on ${weekdayList(unmet)}, outside the athlete's preferred days.`);
      }
    }

    const volume = await this.getTemplateVolume(templateId);
    const busiest = Math.max(0, ...volume.map((v) => v.trainingDays));
    if (busiest && available.length && busiest > available.length) {
      warn('frequency', `The heaviest week trains ${busiest} days; the athlete is available ${available.length}.`);
    }

    for (const v of volume) {
      if (v.targetKm == null) continue;
      const diff = v.prescribedKm - v.targetKm;
      if (Math.abs(diff) > Math.max(v.targetKm * 0.15, 5)) {
        warn('volume',
          `Week ${v.templateWeekNo}: ${round1(v.prescribedKm)} km prescribed against a ${round1(v.targetKm)} km target (${diff >= 0 ? '+' : ''}${round1(diff)} km).`);
      }
    }

    const equipment = [...new Set(
      slots
        .filter((s) => s.strengthTemplateId)
        .flatMap((s) => this.strengthTemplates.find((t) => t.id === s.strengthTemplateId)?.components ?? [])
        .flatMap((c) => this.strengthExercises.find((e) => e.id === c.strengthExerciseId)?.equipment ?? []),
    )].sort();

    if (equipment.length) {
      if (!profile.gymAccess) {
        warn('gym', 'The programme includes strength work, and the athlete has not told us what access they have.');
      } else if (profile.gymAccess === 'none') {
        warn('gym', `The programme's strength work needs ${equipment.join(', ')}, and the athlete has no gym access.`);
      } else if (profile.equipment?.length) {
        const missing = equipment.filter((e) => !profile.equipment.includes(e));
        if (missing.length) {
          warn('equipment',
            `The programme's strength work uses ${missing.join(', ')}, which is not on the athlete's equipment list.`);
        }
      }
    }

    const active = dataset().programs.find((p) => p.athleteId === athleteId && p.status === 'active');
    if (active) {
      warn('active_programme', `Assigning this will archive the athlete's current programme, "${active.name}".`);
    }

    const onOrAfter = dataset().scheduled.filter((w) => w.athleteId === athleteId && w.date >= startDate);
    const clearing = onOrAfter.filter((w) => w.status === 'scheduled').length;
    const keeping = onOrAfter.length - clearing;
    if (clearing) {
      warn('replacing', `${clearing} session(s) already scheduled from ${startDate} will be replaced by this programme.`);
    }
    if (keeping) {
      warn('history_kept',
        `${keeping} session(s) on or after that date are already completed or logged. Those are kept, and the programme works around them.`);
    }

    return out;
  }

  async previewAssignment(templateId: UUID, athleteId: UUID, startDate: ISODate): Promise<AssignmentPreview> {
    const detail = await this.getProgramTemplateDetail(templateId);
    if (!detail) throw new Error('That programme template is no longer available.');
    const goal = await this.getPrimaryGoal(athleteId);
    const sessionNames = new Map<string, string>([
      ...this.workoutTemplates.map((w) => [w.id, w.name] as const),
      ...this.strengthTemplates.map((s) => [s.id, s.name] as const),
    ]);
    return buildAssignmentPreview({
      template: detail as unknown as ProgramTemplate,
      athleteId,
      profile: await this.getProfile(athleteId),
      conflicts: await this.getAssignmentConflicts(templateId, athleteId, startDate),
      weeks: detail.volume,
      goal,
      race: goal?.raceId ? await this.getRace(goal.raceId) : null,
      program: await this.getProgram(athleteId),
      detail,
      sessionNames,
      startDate,
    });
  }

  async assignProgramTemplate(
    templateId: UUID,
    athleteId: UUID,
    startDate: ISODate,
    options?: { name?: string; goalId?: UUID },
  ): Promise<UUID> {
    const blocking = (await this.getAssignmentConflicts(templateId, athleteId, startDate))
      .find((c) => c.severity === 'block');
    if (blocking) throw new Error(blocking.detail);

    const template = this.programTemplates.find((t) => t.id === templateId)!;
    const d = dataset();
    const weeks = this.templateWeeks.filter((w) => w.programTemplateId === templateId);

    for (const p of d.programs) {
      if (p.athleteId === athleteId && p.status === 'active') p.status = 'archived';
    }

    // the new programme needs the old one's future days back; anything that
    // already happened is what happened, and stays
    const superseded = d.scheduled.filter(
      (w) => w.athleteId === athleteId && w.date >= startDate && w.status === 'scheduled',
    );
    for (const w of superseded) this.snapshot(w, 'deleted');
    const supersededIds = new Set(superseded.map((w) => w.id));
    d.scheduled = d.scheduled.filter((w) => !supersededIds.has(w.id));
    this.components = this.components.filter((c) => !supersededIds.has(c.scheduledWorkoutId));

    const program = await this.createProgram({
      athleteId,
      coachId: DEMO_COACH_ID,
      templateId,
      goalId: options?.goalId ?? null,
      name: options?.name ?? template.name,
      startDate,
      endDate: addDays(startDate, Math.max(weeks.length, 1) * 7 - 1),
      status: 'active',
    });

    for (const b of this.templateBlocks
      .filter((x) => x.programTemplateId === templateId)
      .sort((a, c) => a.blockIndex - c.blockIndex)) {
      const block = await this.createBlock({
        programId: program.id,
        athleteId,
        blockIndex: b.blockIndex,
        name: b.name,
        phase: b.phase,
        focus: b.focus,
        notes: b.description,
      });

      for (const w of weeks.filter((x) => x.blockId === b.id).sort((a, c) => a.weekIndex - c.weekIndex)) {
        const weekStart = addDays(startDate, (w.templateWeekNo - 1) * 7);
        const week = await this.createWeek({
          blockId: block.id,
          programId: program.id,
          athleteId,
          weekIndex: w.weekIndex,
          programWeekNo: w.templateWeekNo,
          startDate: weekStart,
          targetVolumeKm: w.targetVolumeKm,
          focus: w.focus,
          notes: w.notes,
          isRecoveryWeek: w.isRecoveryWeek,
        });

        for (const s of this.templateSlots
          .filter((x) => x.templateWeekId === w.id)
          .sort((a, c) => a.weekday - c.weekday || a.slot - c.slot)) {
          const date = addDays(weekStart, s.weekday - 1);
          // never overwrite a session that records something that happened
          if (d.scheduled.some((x) => x.athleteId === athleteId && x.date === date && x.slot === s.slot)) continue;

          if (s.isRest) {
            d.scheduled.push(clone({
              id: uid('sw'),
              programId: program.id,
              programWeekId: week.id,
              athleteId,
              date,
              slot: s.slot,
              status: 'scheduled',
              name: s.label ?? 'Rest',
              type: 'rest',
              basis: 'time',
              intensity: 'rest',
              notes: s.notes,
              prescriptionRevision: 1,
              createdAt: new Date().toISOString(),
            }) as unknown as ScheduledWorkout);
            continue;
          }

          const kind = s.workoutTemplateId ? 'workout' : 'strength';
          const id = await this.insertTemplateIntoProgramme(
            kind,
            (s.workoutTemplateId ?? s.strengthTemplateId)!,
            athleteId,
            date,
            s.slot,
          );
          const created = d.scheduled.find((x) => x.id === id);
          if (created) {
            created.programId = program.id;
            created.programWeekId = week.id;
            if (s.label) created.name = s.label;
            if (s.distanceKm != null) created.distanceKm = s.distanceKm;
            if (s.durationMinutes != null) created.durationMinutes = s.durationMinutes;
            if (s.rpeTarget != null) created.rpeTarget = s.rpeTarget;
            if (s.notes) created.notes = s.notes;
          }
        }
      }
    }

    return program.id;
  }

  /* ---- saving a live programme back out as a template ---- */

  /**
   * The same three dispositions im_session_disposition applies.
   *
   * A rest day stays a rest day. A session that still matches the library
   * item it came from becomes a slot pointing at it. Anything else is a
   * workout definition and earns its own library entry.
   */
  private dispositionOf(session: ScheduledWorkout): 'rest' | 'library' | 'promote' {
    if (session.type === 'rest') return 'rest';

    if (session.sourceWorkoutTemplateId) {
      const src = this.workoutTemplates.find((w) => w.id === session.sourceWorkoutTemplateId);
      if (!src) return 'promote';
      const differs =
        session.type !== src.type ||
        session.basis !== src.basis ||
        session.intensity !== src.intensity ||
        session.hrZone !== src.hrZone ||
        (session.warmUp ?? '') !== (src.warmUp ?? '') ||
        (session.mainSet ?? '') !== (src.mainSet ?? '') ||
        (session.coolDown ?? '') !== (src.coolDown ?? '');
      return differs ? 'promote' : 'library';
    }

    if (session.sourceStrengthTemplateId) {
      return this.strengthTemplates.some((x) => x.id === session.sourceStrengthTemplateId) ? 'library' : 'promote';
    }

    return 'promote';
  }

  private extractionSessions(programId: UUID) {
    const weeks = this.weeks.filter((w) => w.programId === programId);
    const weekIds = new Set(weeks.map((w) => w.id));
    return dataset().scheduled.filter((s) => s.programWeekId && weekIds.has(s.programWeekId));
  }

  async previewProgrammeExtraction(programId: UUID): Promise<ExtractionPreview> {
    const program = dataset().programs.find((p) => p.id === programId);
    const notes: ExtractionNote[] = [];
    const add = (severity: ExtractionNote['severity'], kind: ExtractionNote['kind'], detail: string, count = 0) =>
      notes.push({ severity, kind, detail, count });

    if (!program) {
      add('block', 'programme', 'That programme no longer exists.');
      return buildExtractionPreview({
        programId, programName: '', athleteName: '', blockCount: 0, weekCount: 0,
        sessions: [], goalEventType: null, notes,
      });
    }

    const blocks = this.blocks.filter((b) => b.programId === programId);
    const weeks = this.weeks.filter((w) => w.programId === programId);
    const sessions = this.extractionSessions(programId);

    if (!weeks.length) {
      add('block', 'structure', 'This programme has no weeks, so there is no shape to save.');
    } else if (!sessions.length) {
      add('block', 'structure', 'This programme has no sessions attached to its weeks.');
    } else {
      add('info', 'structure',
        `${blocks.length} block(s), ${weeks.length} week(s) and ${sessions.length} session(s) will be saved.`,
        sessions.length);

      const rest = sessions.filter((s) => s.type === 'rest').length;
      if (rest) add('info', 'rest', `${rest} prescribed rest day(s) are kept as rest days.`, rest);

      const promote = sessions.filter((s) => this.dispositionOf(s) === 'promote').length;
      if (promote) {
        add('warn', 'promote',
          `${promote} session(s) are not in your library, or have been changed beyond what a slot can hold. ` +
          'Each becomes a new private session in your workout library so the template can point at it.',
          promote);
      }

      const done = dataset().scheduled.filter((s) => s.programId === programId && s.status !== 'scheduled').length;
      if (done) {
        add('info', 'execution',
          `${done} session(s) have been completed, missed or moved. The template takes what was prescribed, ` +
          'never what happened.', done);
      }

      const noteCount =
        dataset().scheduled.filter((s) => s.programId === programId && s.coachNote).length +
        weeks.filter((w) => w.notes).length;
      if (noteCount) {
        add('warn', 'notes',
          `${noteCount} coach note(s) on weeks and sessions will not be copied — they usually refer to this athlete.`,
          noteCount);
      }

      const noVolume = weeks.filter((w) => w.targetVolumeKm == null).length;
      if (noVolume) {
        add('info', 'volume',
          `${noVolume} week(s) have no intended volume set, so the template will not carry one for them.`,
          noVolume);
      }
    }

    const profile = await this.getProfile(program.athleteId);
    const goal = await this.getPrimaryGoal(program.athleteId);

    return buildExtractionPreview({
      programId,
      programName: program.name,
      athleteName: profile?.fullName ?? 'This athlete',
      blockCount: blocks.length,
      weekCount: weeks.length,
      sessions: sessions.map((s) => ({ date: s.date, type: s.type, weekId: s.programWeekId! })),
      goalEventType: goal?.eventType ?? null,
      notes,
    });
  }

  async extractProgrammeTemplate(programId: UUID, metadata: ExtractionMetadata): Promise<UUID> {
    const preview = await this.previewProgrammeExtraction(programId);
    const blocking = preview.notes.find((n) => n.severity === 'block');
    if (blocking) throw new Error(blocking.detail);
    if ((metadata.visibility as string) === 'system') {
      throw new Error('A saved programme belongs to the coach who saved it, not to Iron Miles.');
    }
    if (!metadata.name.trim()) throw new Error('Give the template a name.');

    const now = new Date().toISOString();
    const templateId = uid('pt');
    const weeks = this.weeks.filter((w) => w.programId === programId);

    this.programTemplates.push({
      id: templateId,
      ownerId: DEMO_COACH_ID,
      visibility: metadata.visibility,
      name: metadata.name.trim(),
      goalType: metadata.goalType ?? 'general_endurance',
      weeks: Math.max(weeks.length, 1),
      description: metadata.purpose ?? '',
      purpose: metadata.purpose,
      coachNotes: metadata.coachNotes,
      discipline: metadata.discipline,
      targetDistanceKm: metadata.targetDistanceKm,
      experienceLevel: metadata.experienceLevel,
      minDaysPerWeek: metadata.minDaysPerWeek ?? preview.minDaysPerWeek,
      maxDaysPerWeek: metadata.maxDaysPerWeek ?? preview.maxDaysPerWeek,
      tags: [],
      archivedAt: null,
      createdAt: now,
      updatedAt: now,
    } as unknown as ProgramTemplateItem);

    // one promoted library item per distinct session, however many weeks use it
    const promoted = new Map<string, UUID>();

    for (const b of this.blocks.filter((x) => x.programId === programId).sort((a, c) => a.blockIndex - c.blockIndex)) {
      const block: ProgramTemplateBlock = {
        id: uid('ptb'),
        programTemplateId: templateId,
        blockIndex: b.blockIndex,
        name: b.name,
        phase: b.phase,
        focus: b.focus,
        // block notes stay with the athlete
        description: null,
        createdAt: now,
      };
      this.templateBlocks.push(block);

      for (const w of weeks.filter((x) => x.blockId === b.id).sort((a, c) => a.weekIndex - c.weekIndex)) {
        const week: ProgramTemplateWeek = {
          id: uid('ptw'),
          programTemplateId: templateId,
          blockId: block.id,
          weekIndex: w.weekIndex,
          templateWeekNo: w.programWeekNo,
          targetVolumeKm: w.targetVolumeKm,
          isRecoveryWeek: w.isRecoveryWeek,
          focus: w.focus,
          notes: null,
          createdAt: now,
        };
        this.templateWeeks.push(week);

        const inWeek = dataset().scheduled
          .filter((s) => s.programWeekId === w.id)
          .sort((a, c) => a.date.localeCompare(c.date) || a.slot - c.slot);

        for (const session of inWeek) {
          const weekday = (((new Date(session.date).getUTCDay() + 6) % 7) + 1) as Weekday;
          const disposition = this.dispositionOf(session);

          if (disposition === 'rest') {
            this.templateSlots.push({
              id: uid('pts'), programTemplateId: templateId, templateWeekId: week.id,
              weekday, slot: session.slot, workoutTemplateId: null, strengthTemplateId: null,
              isRest: true, isOptional: false,
              label: session.name === 'Rest' ? null : session.name,
              notes: null, distanceKm: null, durationMinutes: null, rpeTarget: null,
            });
            continue;
          }

          if (disposition === 'library') {
            const src = this.workoutTemplates.find((x) => x.id === session.sourceWorkoutTemplateId);
            this.templateSlots.push({
              id: uid('pts'), programTemplateId: templateId, templateWeekId: week.id,
              weekday, slot: session.slot,
              workoutTemplateId: session.sourceWorkoutTemplateId ?? null,
              strengthTemplateId: session.sourceStrengthTemplateId ?? null,
              isRest: false, isOptional: false,
              // only record an override where it actually differs
              label: src && session.name === src.name ? null : session.name,
              notes: null,
              distanceKm: src && session.distanceKm === src.distanceKm ? null : session.distanceKm,
              durationMinutes:
                src && session.durationMinutes === src.durationMinutes ? null : session.durationMinutes,
              rpeTarget: src && session.rpeTarget === src.rpeTarget ? null : session.rpeTarget,
            });
            continue;
          }

          const key = [
            session.name, session.type, session.basis, session.intensity, session.distanceKm,
            session.durationMinutes, session.hrZone, session.rpeTarget,
            session.warmUp, session.mainSet, session.coolDown,
          ].join('|');

          let libraryId = promoted.get(key);
          if (!libraryId) {
            const created = await this.saveWorkoutTemplate({
              ownerId: DEMO_COACH_ID,
              visibility: metadata.visibility,
              name: session.name,
              category: 'custom' as never,
              type: session.type as never,
              basis: session.basis as never,
              intensity: session.intensity as never,
              distanceKm: session.distanceKm,
              durationMinutes: session.durationMinutes,
              paceMinSecKm: null,
              paceMaxSecKm: null,
              hrZone: session.hrZone,
              rpeTarget: session.rpeTarget,
              warmUp: session.warmUp,
              mainSet: session.mainSet,
              coolDown: session.coolDown,
              purpose: session.notes,
              coachNotes: null,
              notes: null,
              tags: [],
              archivedAt: null,
            }, (await this.listComponents(session.id)).map(({ id: _id, scheduledWorkoutId: _s, athleteId: _a, position: _p, ...rest }) => rest));
            libraryId = created.id;
            promoted.set(key, libraryId);
          }

          this.templateSlots.push({
            id: uid('pts'), programTemplateId: templateId, templateWeekId: week.id,
            weekday, slot: session.slot,
            workoutTemplateId: libraryId, strengthTemplateId: null,
            isRest: false, isOptional: false,
            label: null, notes: null, distanceKm: null, durationMinutes: null, rpeTarget: null,
          });
        }
      }
    }

    return templateId;
  }

  async deleteAthleteData(athleteId: UUID): Promise<void> {
    const d = dataset();
    const strip = <T extends { athleteId?: string }>(rows: T[]) => {
      for (let i = rows.length - 1; i >= 0; i--) if (rows[i].athleteId === athleteId) rows.splice(i, 1);
    };
    strip(d.goals);
    strip(d.scheduled);
    strip(d.completed);
    strip(d.strengthSessions);
    strip(d.checkins);
    strip(d.forgeEvents);
    strip(d.achievements);
    strip(d.subscriptions);
    strip(d.integrations);
    for (let i = d.messages.length - 1; i >= 0; i--) {
      const m = d.messages[i];
      if (m.senderId === athleteId || m.recipientId === athleteId) d.messages.splice(i, 1);
    }
    for (let i = d.profiles.length - 1; i >= 0; i--) {
      if (d.profiles[i].id === athleteId) d.profiles.splice(i, 1);
    }
  }
}

export { DEMO_ATHLETE_ID, DEMO_COACH_ID, addDays };
