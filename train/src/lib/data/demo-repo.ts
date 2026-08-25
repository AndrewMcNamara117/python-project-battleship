import { buildDemoDataset, CLUB_MEMBER_META, DEMO_ATHLETE_ID, DEMO_COACH_ID, type DemoDataset } from '@/data/demo-seed';
import { addDays, startOfMonth, startOfWeek, toISODate } from '@/lib/domain/dates';
import { currentStreakWeeks, totalScore } from '@/lib/domain/forge-score';
import type {
  Achievement,
  CheckIn,
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
      await this.awardForgePoints({
        athleteId: entry.athleteId,
        kind: 'run_completed',
        points: 10,
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

  async listCommunityEvents(): Promise<CommunityEvent[]> {
    return clone(dataset().communityEvents.slice().sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
  }

  async listCommunityPosts(): Promise<CommunityPost[]> {
    return clone(dataset().communityPosts.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
  }

  async setEventAttendance(eventId: UUID, athleteId: UUID, going: boolean): Promise<void> {
    const e = dataset().communityEvents.find((x) => x.id === eventId);
    if (!e) return;
    e.attendingCount = Math.max(0, e.attendingCount + (going ? 1 : -1));
    void athleteId;
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

  async createApplication(app: Omit<CoachingApplication, 'id' | 'createdAt' | 'status'>): Promise<CoachingApplication> {
    const row: CoachingApplication = {
      ...app,
      id: uid('app'),
      status: 'new',
      createdAt: new Date().toISOString(),
    };
    this.applications.push(row);
    return clone(row);
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
