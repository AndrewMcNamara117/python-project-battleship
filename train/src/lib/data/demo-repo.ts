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
import { FORGE_POINTS } from '@/lib/domain/types';
import type {
  BlockWithWeeks,
  ProgramBlock,
  ProgramWeek,
  SessionComponent,
  SessionComponentDraft,
  SessionRevision,
} from '@/lib/domain/programme';
import type { IronMilesRepo } from './repo';

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
    const weekIds = this.weeks.filter((w) => w.blockId === blockId).map((w) => w.id);
    const d = dataset();
    for (let i = d.scheduled.length - 1; i >= 0; i--) {
      if (weekIds.includes(d.scheduled[i].programWeekId ?? '')) {
        this.snapshot(d.scheduled[i], 'deleted');
        d.scheduled.splice(i, 1);
      }
    }
    const ds = dataset();
    ds.weeks = ds.weeks.filter((w) => w.blockId !== blockId);
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
