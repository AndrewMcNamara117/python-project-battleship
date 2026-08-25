import type { SupabaseClient } from '@supabase/supabase-js';
import { startOfMonth, startOfWeek, toISODate } from '@/lib/domain/dates';
import { currentStreakWeeks } from '@/lib/domain/forge-score';
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

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Postgres-backed implementation. Every call goes through a request-scoped
 * client carrying the user's JWT, so row-level security — not this file — is
 * what actually enforces who can read and write what. The mappers below only
 * translate snake_case rows into the domain shapes.
 */
export class SupabaseRepo implements IronMilesRepo {
  readonly mode = 'supabase' as const;

  constructor(private readonly db: SupabaseClient) {}

  private async rows<T>(query: PromiseLike<{ data: any; error: any }>, map: (row: any) => T): Promise<T[]> {
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map(map);
  }

  private async one<T>(query: PromiseLike<{ data: any; error: any }>, map: (row: any) => T): Promise<T | null> {
    const { data, error } = await query;
    // PGRST116 = "no rows", which is an empty result, not a failure
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data ? map(data) : null;
  }

  /* ---------- mappers ---------- */

  private toProfile = (r: any): Profile => ({
    id: r.id,
    role: r.role,
    fullName: r.full_name,
    email: r.email,
    avatarUrl: r.avatar_url,
    dateOfBirth: r.date_of_birth,
    location: r.location,
    timezone: r.timezone,
    units: r.units,
    createdAt: r.created_at,
    onboardedAt: r.onboarded_at,
    healthDataConsentAt: r.health_data_consent_at,
    leaderboardOptIn: r.leaderboard_opt_in,
    forgeAssistantEnabled: r.forge_assistant_enabled,
  });

  private toScheduled = (r: any): ScheduledWorkout => ({
    id: r.id,
    programId: r.program_id,
    athleteId: r.athlete_id,
    date: r.date,
    slot: r.slot,
    status: r.status,
    name: r.name,
    type: r.type,
    basis: r.basis,
    intensity: r.intensity,
    distanceKm: r.distance_km == null ? null : Number(r.distance_km),
    durationMinutes: r.duration_minutes,
    paceRange:
      r.pace_min_sec_km == null || r.pace_max_sec_km == null
        ? null
        : { minSecPerKm: r.pace_min_sec_km, maxSecPerKm: r.pace_max_sec_km },
    hrZone: r.hr_zone,
    rpeTarget: r.rpe_target,
    warmUp: r.warm_up,
    mainSet: r.main_set,
    coolDown: r.cool_down,
    notes: r.notes,
    coachNote: r.coach_note,
    strengthTemplateId: r.strength_template_id,
    raceId: r.race_id,
    createdAt: r.created_at,
  });

  private fromScheduled = (w: ScheduledWorkout) => ({
    id: w.id,
    program_id: w.programId,
    athlete_id: w.athleteId,
    date: w.date,
    slot: w.slot,
    status: w.status,
    name: w.name,
    type: w.type,
    basis: w.basis,
    intensity: w.intensity,
    distance_km: w.distanceKm,
    duration_minutes: w.durationMinutes,
    pace_min_sec_km: w.paceRange?.minSecPerKm ?? null,
    pace_max_sec_km: w.paceRange?.maxSecPerKm ?? null,
    hr_zone: w.hrZone,
    rpe_target: w.rpeTarget,
    warm_up: w.warmUp,
    main_set: w.mainSet,
    cool_down: w.coolDown,
    notes: w.notes,
    coach_note: w.coachNote,
    strength_template_id: w.strengthTemplateId,
    race_id: w.raceId,
  });

  private toCompleted = (r: any): CompletedWorkout => ({
    id: r.id,
    scheduledWorkoutId: r.scheduled_workout_id,
    athleteId: r.athlete_id,
    date: r.date,
    type: r.type,
    actualDistanceKm: r.actual_distance_km == null ? null : Number(r.actual_distance_km),
    actualDurationMinutes: r.actual_duration_minutes,
    averagePaceSecPerKm: r.average_pace_sec_per_km,
    averageHeartRate: r.average_heart_rate,
    maxHeartRate: r.max_heart_rate,
    rpe: r.rpe,
    sessionRating: r.session_rating,
    soreness: r.soreness,
    athleteNotes: r.athlete_notes,
    source: r.source,
    createdAt: r.created_at,
  });

  private toCheckIn = (r: any): CheckIn => ({
    id: r.id,
    athleteId: r.athlete_id,
    weekStart: r.week_start,
    scores: {
      fatigue: r.fatigue,
      sleep: r.sleep,
      soreness: r.soreness,
      stress: r.stress,
      motivation: r.motivation,
      confidence: r.confidence,
      trainingDifficulty: r.training_difficulty,
    },
    wentWell: r.went_well,
    feltDifficult: r.felt_difficult,
    painOrNiggles: r.pain_or_niggles,
    affectingTraining: r.affecting_training,
    confidenceNextWeek: r.confidence_next_week,
    forCoach: r.for_coach,
    attentionLevel: r.attention_level,
    attentionReasons: r.attention_reasons ?? [],
    reviewedByCoachAt: r.reviewed_by_coach_at,
    coachResponse: r.coach_response,
    submittedAt: r.submitted_at,
  });

  private toStrengthSession = (r: any): StrengthSession => ({
    id: r.id,
    athleteId: r.athlete_id,
    scheduledWorkoutId: r.scheduled_workout_id,
    templateId: r.template_id,
    date: r.date,
    status: r.status,
    logs: r.logs ?? [],
    durationMinutes: r.duration_minutes,
    notes: r.notes,
    completedAt: r.completed_at,
  });

  private toRace = (r: any): Race => ({
    id: r.id,
    name: r.name,
    date: r.date,
    location: r.location,
    eventType: r.event_type,
    distanceKm: r.distance_km == null ? null : Number(r.distance_km),
    elevationM: r.elevation_m,
    url: r.url,
    createdBy: r.created_by,
  });

  private toMessage = (r: any): Message => ({
    id: r.id,
    threadId: r.thread_id,
    senderId: r.sender_id,
    recipientId: r.recipient_id,
    body: r.body,
    authorKind: r.author_kind,
    readAt: r.read_at,
    createdAt: r.created_at,
  });

  /* ---------- identity ---------- */

  getProfile(userId: UUID) {
    return this.one(this.db.from('profiles').select('*').eq('id', userId).maybeSingle(), this.toProfile);
  }

  async updateProfile(userId: UUID, patch: Partial<Profile>): Promise<Profile> {
    // role is deliberately absent: the schema trigger rejects role changes anyway
    const row: Record<string, unknown> = {};
    if (patch.fullName !== undefined) row.full_name = patch.fullName;
    if (patch.avatarUrl !== undefined) row.avatar_url = patch.avatarUrl;
    if (patch.dateOfBirth !== undefined) row.date_of_birth = patch.dateOfBirth;
    if (patch.location !== undefined) row.location = patch.location;
    if (patch.timezone !== undefined) row.timezone = patch.timezone;
    if (patch.units !== undefined) row.units = patch.units;
    if (patch.leaderboardOptIn !== undefined) row.leaderboard_opt_in = patch.leaderboardOptIn;
    if (patch.forgeAssistantEnabled !== undefined) row.forge_assistant_enabled = patch.forgeAssistantEnabled;
    if (patch.healthDataConsentAt !== undefined) row.health_data_consent_at = patch.healthDataConsentAt;
    if (patch.onboardedAt !== undefined) row.onboarded_at = patch.onboardedAt;

    const { data, error } = await this.db.from('profiles').update(row).eq('id', userId).select('*').single();
    if (error) throw new Error(error.message);
    return this.toProfile(data);
  }

  async getCoachForAthlete(athleteId: UUID): Promise<Profile | null> {
    const { data, error } = await this.db
      .from('coach_athlete_links')
      .select('coach_id, profiles!coach_athlete_links_coach_id_fkey(*)')
      .eq('athlete_id', athleteId)
      .eq('status', 'active')
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    const coach = (data as any)?.profiles;
    return coach ? this.toProfile(coach) : null;
  }

  async listAthletesForCoach(coachId: UUID): Promise<Profile[]> {
    const { data, error } = await this.db
      .from('coach_athlete_links')
      .select('profiles!coach_athlete_links_athlete_id_fkey(*)')
      .eq('coach_id', coachId)
      .eq('status', 'active');
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => this.toProfile(r.profiles)).filter(Boolean);
  }

  /* ---------- onboarding ---------- */

  async getOnboarding(athleteId: UUID) {
    const { data, error } = await this.db
      .from('athlete_onboarding')
      .select('data, step, completed_at')
      .eq('athlete_id', athleteId)
      .maybeSingle();
    if (error && error.code !== 'PGRST116') throw new Error(error.message);
    return data ? { data: data.data ?? {}, step: data.step ?? 1, completedAt: data.completed_at } : null;
  }

  async saveOnboarding(athleteId: UUID, data: Partial<OnboardingData>, step: number) {
    const existing = await this.getOnboarding(athleteId);
    const { error } = await this.db
      .from('athlete_onboarding')
      .upsert({ athlete_id: athleteId, data: { ...existing?.data, ...data }, step, updated_at: new Date().toISOString() });
    if (error) throw new Error(error.message);
  }

  async completeOnboarding(athleteId: UUID, data: OnboardingData) {
    const now = new Date().toISOString();
    const { error } = await this.db
      .from('athlete_onboarding')
      .upsert({ athlete_id: athleteId, data, step: 7, completed_at: now, updated_at: now });
    if (error) throw new Error(error.message);

    await this.updateProfile(athleteId, {
      fullName: data.personal.fullName,
      dateOfBirth: data.personal.dateOfBirth || null,
      location: data.personal.location,
      timezone: data.personal.timezone,
      units: data.personal.units,
      leaderboardOptIn: data.preferences.leaderboardOptIn,
      forgeAssistantEnabled: data.preferences.forgeAssistantEnabled,
      healthDataConsentAt: now,
      onboardedAt: now,
    });

    if (data.goal.raceDate) {
      await this.db.from('goals').insert({
        athlete_id: athleteId,
        event_type: data.goal.eventType,
        target_date: data.goal.raceDate,
        outcome: data.goal.outcome,
        why: data.goal.why,
        is_primary: true,
      });
    }
  }

  /* ---------- goals + races ---------- */

  getPrimaryGoal(athleteId: UUID) {
    return this.one(
      this.db.from('goals').select('*').eq('athlete_id', athleteId).eq('is_primary', true).maybeSingle(),
      (r: any): Goal => ({
        id: r.id,
        athleteId: r.athlete_id,
        raceId: r.race_id,
        eventType: r.event_type,
        targetDate: r.target_date,
        outcome: r.outcome,
        targetTimeSeconds: r.target_time_seconds,
        why: r.why,
        isPrimary: r.is_primary,
        createdAt: r.created_at,
      }),
    );
  }

  getRace(raceId: UUID) {
    return this.one(this.db.from('races').select('*').eq('id', raceId).maybeSingle(), this.toRace);
  }

  listRaces() {
    return this.rows(this.db.from('races').select('*').order('date'), this.toRace);
  }

  /* ---------- training ---------- */

  getProgram(athleteId: UUID) {
    return this.one(
      this.db.from('programs').select('*').eq('athlete_id', athleteId).eq('status', 'active').maybeSingle(),
      (r: any): Program => ({
        id: r.id,
        athleteId: r.athlete_id,
        coachId: r.coach_id,
        templateId: r.template_id,
        goalId: r.goal_id,
        name: r.name,
        startDate: r.start_date,
        endDate: r.end_date,
        status: r.status,
        createdAt: r.created_at,
      }),
    );
  }

  listScheduled(athleteId: UUID, from: ISODate, to: ISODate) {
    return this.rows(
      this.db
        .from('scheduled_workouts')
        .select('*')
        .eq('athlete_id', athleteId)
        .gte('date', from)
        .lte('date', to)
        .order('date')
        .order('slot'),
      this.toScheduled,
    );
  }

  getScheduled(id: UUID) {
    return this.one(this.db.from('scheduled_workouts').select('*').eq('id', id).maybeSingle(), this.toScheduled);
  }

  async saveScheduled(workout: ScheduledWorkout): Promise<ScheduledWorkout> {
    const { data, error } = await this.db
      .from('scheduled_workouts')
      .upsert(this.fromScheduled(workout))
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return this.toScheduled(data);
  }

  async moveScheduled(id: UUID, toDate: ISODate) {
    const { error } = await this.db
      .from('scheduled_workouts')
      .update({ date: toDate, status: 'rescheduled' })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async deleteScheduled(id: UUID) {
    const { error } = await this.db.from('scheduled_workouts').delete().eq('id', id);
    if (error) throw new Error(error.message);
  }

  listCompleted(athleteId: UUID, from: ISODate, to: ISODate) {
    return this.rows(
      this.db
        .from('completed_workouts')
        .select('*')
        .eq('athlete_id', athleteId)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false }),
      this.toCompleted,
    );
  }

  async logWorkout(entry: Omit<CompletedWorkout, 'id' | 'createdAt'>): Promise<CompletedWorkout> {
    const { data, error } = await this.db
      .from('completed_workouts')
      .upsert(
        {
          scheduled_workout_id: entry.scheduledWorkoutId,
          athlete_id: entry.athleteId,
          date: entry.date,
          type: entry.type,
          actual_distance_km: entry.actualDistanceKm,
          actual_duration_minutes: entry.actualDurationMinutes,
          average_pace_sec_per_km: entry.averagePaceSecPerKm,
          average_heart_rate: entry.averageHeartRate,
          max_heart_rate: entry.maxHeartRate,
          rpe: entry.rpe,
          session_rating: entry.sessionRating,
          soreness: entry.soreness,
          athlete_notes: entry.athleteNotes,
          source: entry.source,
        },
        { onConflict: 'scheduled_workout_id' },
      )
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    if (entry.scheduledWorkoutId) {
      await this.db
        .from('scheduled_workouts')
        .update({ status: 'completed' })
        .eq('id', entry.scheduledWorkoutId);
    }
    return this.toCompleted(data);
  }

  listStrengthSessions(athleteId: UUID, from: ISODate, to: ISODate) {
    return this.rows(
      this.db
        .from('strength_sessions')
        .select('*')
        .eq('athlete_id', athleteId)
        .gte('date', from)
        .lte('date', to)
        .order('date', { ascending: false }),
      this.toStrengthSession,
    );
  }

  getStrengthSession(id: UUID) {
    return this.one(this.db.from('strength_sessions').select('*').eq('id', id).maybeSingle(), this.toStrengthSession);
  }

  async saveStrengthSession(session: StrengthSession): Promise<StrengthSession> {
    const { data, error } = await this.db
      .from('strength_sessions')
      .upsert({
        id: session.id,
        athlete_id: session.athleteId,
        scheduled_workout_id: session.scheduledWorkoutId,
        template_id: session.templateId,
        date: session.date,
        status: session.status,
        logs: session.logs,
        duration_minutes: session.durationMinutes,
        notes: session.notes,
        completed_at: session.completedAt,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    if (session.status === 'completed' && session.scheduledWorkoutId) {
      await this.db.from('scheduled_workouts').update({ status: 'completed' }).eq('id', session.scheduledWorkoutId);
    }
    return this.toStrengthSession(data);
  }

  /* ---------- check-ins ---------- */

  listCheckIns(athleteId: UUID, limit = 52) {
    return this.rows(
      this.db
        .from('checkins')
        .select('*')
        .eq('athlete_id', athleteId)
        .order('week_start', { ascending: false })
        .limit(limit),
      this.toCheckIn,
    );
  }

  getCheckIn(athleteId: UUID, weekStart: ISODate) {
    return this.one(
      this.db.from('checkins').select('*').eq('athlete_id', athleteId).eq('week_start', weekStart).maybeSingle(),
      this.toCheckIn,
    );
  }

  async submitCheckIn(checkIn: Omit<CheckIn, 'id' | 'submittedAt'>): Promise<CheckIn> {
    const { data, error } = await this.db
      .from('checkins')
      .upsert(
        {
          athlete_id: checkIn.athleteId,
          week_start: checkIn.weekStart,
          ...checkIn.scores,
          training_difficulty: checkIn.scores.trainingDifficulty,
          went_well: checkIn.wentWell,
          felt_difficult: checkIn.feltDifficult,
          pain_or_niggles: checkIn.painOrNiggles,
          affecting_training: checkIn.affectingTraining,
          confidence_next_week: checkIn.confidenceNextWeek,
          for_coach: checkIn.forCoach,
          attention_level: checkIn.attentionLevel,
          attention_reasons: checkIn.attentionReasons,
        },
        { onConflict: 'athlete_id,week_start' },
      )
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return this.toCheckIn(data);
  }

  async respondToCheckIn(id: UUID, coachId: UUID, response: string) {
    void coachId;
    const { error } = await this.db
      .from('checkins')
      .update({ coach_response: response, reviewed_by_coach_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async listCheckInQueue(coachId: UUID): Promise<(CheckIn & { athleteName: string })[]> {
    const athletes = await this.listAthletesForCoach(coachId);
    const names = new Map(athletes.map((a) => [a.id, a.fullName]));
    if (!names.size) return [];
    const rows = await this.rows(
      this.db
        .from('checkins')
        .select('*')
        .in('athlete_id', [...names.keys()])
        .order('week_start', { ascending: false })
        .limit(120),
      this.toCheckIn,
    );
    return rows
      .map((c) => ({ ...c, athleteName: names.get(c.athleteId) ?? 'Athlete' }))
      .sort((a, b) => {
        const rank = (x: CheckIn) => (x.reviewedByCoachAt ? 2 : x.attentionLevel === 'attention' ? 0 : 1);
        return rank(a) - rank(b) || b.weekStart.localeCompare(a.weekStart);
      });
  }

  /* ---------- forge score + community ---------- */

  listForgeEvents(athleteId: UUID) {
    return this.rows(
      this.db.from('forge_score_events').select('*').eq('athlete_id', athleteId).order('date', { ascending: false }),
      (r: any): ForgeScoreEvent => ({
        id: r.id,
        athleteId: r.athlete_id,
        kind: r.kind,
        points: r.points,
        date: r.date,
        label: r.label,
        sourceId: r.source_id,
      }),
    );
  }

  async awardForgePoints(event: Omit<ForgeScoreEvent, 'id'>) {
    // the (athlete, kind, source) unique index makes this idempotent
    const { error } = await this.db.from('forge_score_events').upsert(
      {
        athlete_id: event.athleteId,
        kind: event.kind,
        points: event.points,
        date: event.date,
        label: event.label,
        source_id: event.sourceId,
      },
      { onConflict: 'athlete_id,kind,source_id', ignoreDuplicates: true },
    );
    if (error) throw new Error(error.message);
  }

  async getLeaderboard(scope: LeaderboardScope, category: LeaderboardCategory): Promise<LeaderboardEntry[]> {
    const today = toISODate(new Date());
    const from = scope === 'weekly' ? startOfWeek(today) : scope === 'monthly' ? startOfMonth(today) : '0001-01-01';

    // RLS on profiles only exposes opted-in athletes to other members
    const { data: people, error: peopleError } = await this.db
      .from('profiles')
      .select('id, full_name, avatar_url, training_group')
      .eq('role', 'athlete')
      .eq('leaderboard_opt_in', true);
    if (peopleError) throw new Error(peopleError.message);
    if (!people?.length) return [];

    const { data: events, error: eventsError } = await this.db
      .from('forge_score_events')
      .select('athlete_id, kind, points, date')
      .in('athlete_id', people.map((p: any) => p.id))
      .gte('date', from);
    if (eventsError) throw new Error(eventsError.message);

    const byAthlete = new Map<string, { kind: string; points: number; date: string }[]>();
    for (const e of events ?? []) {
      const list = byAthlete.get(e.athlete_id) ?? [];
      list.push(e);
      byAthlete.set(e.athlete_id, list);
    }

    return people
      .map((p: any) => {
        const rows = byAthlete.get(p.id) ?? [];
        let value: number;
        switch (category) {
          case 'consistency':
            value = new Set(rows.map((r) => startOfWeek(r.date))).size;
            break;
          case 'community':
            value = rows.filter((r) => r.kind === 'community_run' || r.kind === 'volunteered').length;
            break;
          case 'streaks':
            value = currentStreakWeeks(rows as unknown as ForgeScoreEvent[], today);
            break;
          default:
            value = rows.reduce((a, r) => a + r.points, 0);
        }
        return {
          athleteId: p.id,
          displayName: p.full_name,
          avatarUrl: p.avatar_url,
          value,
          rank: 0,
          group: p.training_group ?? null,
        };
      })
      .sort((a, b) => b.value - a.value)
      .map((row, i) => ({ ...row, rank: i + 1 }));
  }

  listAchievements(athleteId: UUID) {
    return this.rows(
      this.db.from('achievements').select('*').eq('athlete_id', athleteId).order('earned_at', { ascending: false }),
      (r: any): Achievement => ({
        id: r.id,
        athleteId: r.athlete_id,
        code: r.code,
        title: r.title,
        description: r.description,
        earnedAt: r.earned_at,
      }),
    );
  }

  async listCommunityEvents(): Promise<CommunityEvent[]> {
    const { data, error } = await this.db
      .from('community_events')
      .select('*, event_attendance(count)')
      .gte('starts_at', new Date(Date.now() - 86400000).toISOString())
      .order('starts_at');
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      startsAt: r.starts_at,
      location: r.location,
      description: r.description,
      capacity: r.capacity,
      attendingCount: r.event_attendance?.[0]?.count ?? 0,
    }));
  }

  listCommunityPosts() {
    return this.rows(
      this.db
        .from('community_posts')
        .select('*, profiles(full_name)')
        .order('created_at', { ascending: false })
        .limit(40),
      (r: any): CommunityPost => ({
        id: r.id,
        authorId: r.author_id,
        authorName: r.profiles?.full_name ?? 'Iron Miles',
        kind: r.kind,
        body: r.body,
        createdAt: r.created_at,
        reactions: r.reactions ?? {},
      }),
    );
  }

  async setEventAttendance(eventId: UUID, athleteId: UUID, going: boolean) {
    if (going) {
      const { error } = await this.db
        .from('event_attendance')
        .upsert({ event_id: eventId, athlete_id: athleteId, status: 'going' }, { onConflict: 'event_id,athlete_id' });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await this.db
        .from('event_attendance')
        .delete()
        .eq('event_id', eventId)
        .eq('athlete_id', athleteId);
      if (error) throw new Error(error.message);
    }
  }

  /* ---------- coaching comms ---------- */

  async listMessages(athleteId: UUID): Promise<Message[]> {
    const { data: thread } = await this.db
      .from('message_threads')
      .select('id')
      .eq('athlete_id', athleteId)
      .maybeSingle();
    if (!thread) return [];
    return this.rows(
      this.db.from('messages').select('*').eq('thread_id', thread.id).order('created_at'),
      this.toMessage,
    );
  }

  async sendMessage(msg: Omit<Message, 'id' | 'createdAt' | 'readAt'>): Promise<Message> {
    const { data, error } = await this.db
      .from('messages')
      .insert({
        thread_id: msg.threadId,
        sender_id: msg.senderId,
        recipient_id: msg.recipientId,
        body: msg.body,
        author_kind: msg.authorKind,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    await this.db.from('message_threads').update({ updated_at: new Date().toISOString() }).eq('id', msg.threadId);
    return this.toMessage(data);
  }

  async markMessagesRead(athleteId: UUID, readerId: UUID) {
    const { data: thread } = await this.db
      .from('message_threads')
      .select('id')
      .eq('athlete_id', athleteId)
      .maybeSingle();
    if (!thread) return;
    await this.db
      .from('messages')
      .update({ read_at: new Date().toISOString() })
      .eq('thread_id', thread.id)
      .eq('recipient_id', readerId)
      .is('read_at', null);
  }

  listCoachNotes(athleteId: UUID, viewerRole: 'athlete' | 'coach') {
    // RLS already hides private notes from athletes; the filter keeps the
    // query honest about intent rather than relying on the policy alone
    let q = this.db.from('coach_notes').select('*').eq('athlete_id', athleteId);
    if (viewerRole === 'athlete') q = q.eq('visibility', 'shared');
    return this.rows(q.order('created_at', { ascending: false }), (r: any): CoachNote => ({
      id: r.id,
      athleteId: r.athlete_id,
      coachId: r.coach_id,
      body: r.body,
      visibility: r.visibility,
      createdAt: r.created_at,
    }));
  }

  async addCoachNote(note: Omit<CoachNote, 'id' | 'createdAt'>): Promise<CoachNote> {
    const { data, error } = await this.db
      .from('coach_notes')
      .insert({
        athlete_id: note.athleteId,
        coach_id: note.coachId,
        body: note.body,
        visibility: note.visibility,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      athleteId: data.athlete_id,
      coachId: data.coach_id,
      body: data.body,
      visibility: data.visibility,
      createdAt: data.created_at,
    };
  }

  /* ---------- billing + integrations ---------- */

  getSubscription(athleteId: UUID) {
    return this.one(
      this.db.from('subscriptions').select('*').eq('athlete_id', athleteId).maybeSingle(),
      (r: any): Subscription => ({
        id: r.id,
        athleteId: r.athlete_id,
        packageCode: r.package_code,
        status: r.status,
        stripeCustomerId: r.stripe_customer_id,
        stripeSubscriptionId: r.stripe_subscription_id,
        currentPeriodEnd: r.current_period_end,
        cancelAtPeriodEnd: r.cancel_at_period_end,
        priceCents: r.price_cents,
        currency: r.currency,
      }),
    );
  }

  listIntegrations(athleteId: UUID) {
    return this.rows(
      this.db.from('integrations').select('*').eq('athlete_id', athleteId),
      (r: any): Integration => ({
        id: r.id,
        athleteId: r.athlete_id,
        provider: r.provider,
        status: r.status,
        connectedAt: r.connected_at,
        lastSyncAt: r.last_sync_at,
      }),
    );
  }

  listNotifications(userId: UUID) {
    return this.rows(
      this.db.from('notifications').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(30),
      (r: any): Notification => ({
        id: r.id,
        userId: r.user_id,
        kind: r.kind,
        title: r.title,
        body: r.body,
        href: r.href,
        readAt: r.read_at,
        createdAt: r.created_at,
      }),
    );
  }

  /* ---------- public ---------- */

  async createApplication(app: Omit<CoachingApplication, 'id' | 'createdAt' | 'status'>): Promise<CoachingApplication> {
    const { data, error } = await this.db
      .from('coaching_applications')
      .insert({
        full_name: app.fullName,
        email: app.email,
        phone: app.phone,
        goal: app.goal,
        target_race: app.targetRace,
        target_date: app.targetDate,
        current_weekly_km: app.currentWeeklyKm,
        experience: app.experience,
        injuries: app.injuries,
        start_when: app.startWhen,
      })
      .select('id, created_at')
      .single();
    if (error) throw new Error(error.message);
    return { ...app, id: data.id, status: 'new', createdAt: data.created_at };
  }

  /* ---------- privacy ---------- */

  async exportAthleteData(athleteId: UUID): Promise<Record<string, unknown>> {
    const { data, error } = await this.db.rpc('im_export_athlete_data', { target: athleteId });
    if (error) throw new Error(error.message);
    return data as Record<string, unknown>;
  }

  async deleteAthleteData(athleteId: UUID): Promise<void> {
    // deleting the auth user cascades through profiles to every owned row
    const { error } = await this.db.from('profiles').delete().eq('id', athleteId);
    if (error) throw new Error(error.message);
  }
}
