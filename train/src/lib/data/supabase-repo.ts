import type { SupabaseClient } from '@supabase/supabase-js';
import { startOfMonth, startOfWeek, toISODate } from '@/lib/domain/dates';
import { currentStreakWeeks } from '@/lib/domain/forge-score';
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
import { buildSessionHistory, toCheckInContext } from '@/lib/domain/adaptation';
import { buildEntry, rankEntries } from '@/lib/domain/roster';
import type { RosterEntry } from '@/lib/domain/roster';
import type {
  CheckInContext,
  SessionHistory,
  ShiftRow,
  VolumeRow,
  WeekSession,
} from '@/lib/domain/adaptation';
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

/* eslint-disable @typescript-eslint/no-explicit-any */

import { profileFieldsFromOnboarding } from '@/lib/domain/onboarding-map';

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
    experienceLevel: r.experience_level ?? null,
    trainingPhase: r.training_phase ?? null,
    preferredTrainingDays: r.preferred_training_days ?? [],
    availableTrainingDays: r.available_training_days ?? [],
    typicalSessionMinutes: r.typical_session_minutes ?? null,
    currentWeeklyKm: r.current_weekly_km == null ? null : Number(r.current_weekly_km),
    gymAccess: r.gym_access ?? null,
    equipment: r.equipment ?? [],
    injuryNotes: r.injury_notes ?? null,
    limitationsNotes: r.limitations_notes ?? null,
  });

  private toScheduled = (r: any): ScheduledWorkout => ({
    id: r.id,
    programId: r.program_id,
    programWeekId: r.program_week_id ?? null,
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
    sourceWorkoutTemplateId: r.source_workout_template_id ?? null,
    sourceStrengthTemplateId: r.source_strength_template_id ?? null,
    prescriptionRevision: r.prescription_revision ?? 1,
    createdAt: r.created_at,
  });

  private fromScheduled = (w: ScheduledWorkout) => ({
    id: w.id,
    program_id: w.programId,
    program_week_id: w.programWeekId,
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
    source_workout_template_id: w.sourceWorkoutTemplateId,
    source_strength_template_id: w.sourceStrengthTemplateId,
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
    if (patch.experienceLevel !== undefined) row.experience_level = patch.experienceLevel;
    if (patch.trainingPhase !== undefined) row.training_phase = patch.trainingPhase;
    if (patch.preferredTrainingDays !== undefined) row.preferred_training_days = patch.preferredTrainingDays;
    if (patch.availableTrainingDays !== undefined) row.available_training_days = patch.availableTrainingDays;
    if (patch.typicalSessionMinutes !== undefined) row.typical_session_minutes = patch.typicalSessionMinutes;
    if (patch.currentWeeklyKm !== undefined) row.current_weekly_km = patch.currentWeeklyKm;
    if (patch.gymAccess !== undefined) row.gym_access = patch.gymAccess;
    if (patch.equipment !== undefined) row.equipment = patch.equipment;
    if (patch.injuryNotes !== undefined) row.injury_notes = patch.injuryNotes;
    if (patch.limitationsNotes !== undefined) row.limitations_notes = patch.limitationsNotes;

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
      // onboarding answers land in real columns, not only the JSONB blob, so
      // the coach dashboard can query them
      ...profileFieldsFromOnboarding(data),
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

  async listCommunityEvents(viewerId?: UUID): Promise<CommunityEvent[]> {
    const { data, error } = await this.db
      .from('community_events')
      .select('*, event_attendance(count)')
      .gte('starts_at', new Date(Date.now() - 86400000).toISOString())
      .order('starts_at');
    if (error) throw new Error(error.message);

    // RLS only returns this athlete's own attendance rows, which is exactly
    // the set needed to decide whether the button reads "I'm in"
    let mine = new Set<string>();
    if (viewerId) {
      const { data: rows } = await this.db
        .from('event_attendance')
        .select('event_id')
        .eq('athlete_id', viewerId);
      mine = new Set((rows ?? []).map((r: any) => r.event_id));
    }

    return (data ?? []).map((r: any) => ({
      id: r.id,
      title: r.title,
      kind: r.kind,
      startsAt: r.starts_at,
      location: r.location,
      description: r.description,
      capacity: r.capacity,
      attendingCount: r.event_attendance?.[0]?.count ?? 0,
      attending: mine.has(r.id),
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

  private toApplication = (r: any): CoachingApplication => ({
    id: r.id,
    fullName: r.full_name,
    email: r.email,
    phone: r.phone,
    goal: r.goal,
    targetRace: r.target_race,
    targetDate: r.target_date,
    currentWeeklyKm: r.current_weekly_km == null ? null : Number(r.current_weekly_km),
    experience: r.experience,
    injuries: r.injuries,
    startWhen: r.start_when,
    status: r.status,
    createdAt: r.created_at,
    acceptedBy: r.accepted_by ?? null,
    acceptedAt: r.accepted_at ?? null,
    decidedNote: r.decided_note ?? null,
    joinedAthleteId: r.joined_athlete_id ?? null,
  });

  listApplications(status?: ApplicationStatus) {
    let q = this.db.from('coaching_applications').select('*');
    if (status) q = q.eq('status', status);
    return this.rows(q.order('created_at', { ascending: false }).limit(200), this.toApplication);
  }

  /**
   * Decide an application.
   *
   * The decision runs through `im_decide_application`, a security-definer
   * function that re-checks the caller is staff — so the authorisation lives in
   * the database next to the data, not only in the action that called it.
   *
   * Accepting does not create an account: a profile row is tied to an
   * auth.users row, so the coach-athlete link is formed by the sign-up trigger
   * when the applicant registers with the address they applied with. If they
   * already have an account, they are linked immediately.
   */
  async decideApplication(
    applicationId: UUID,
    coachId: UUID,
    decision: ApplicationStatus,
    note: string | null,
  ): Promise<AcceptanceOutcome> {
    const { data, error } = await this.db.rpc('im_decide_application', {
      application_id: applicationId,
      decision,
      note,
    });
    if (error) throw new Error(error.message);

    const application = this.toApplication(Array.isArray(data) ? data[0] : data);
    if (decision !== 'accepted') {
      return { application, athleteId: null, awaitingSignUp: false };
    }

    // already registered? link now rather than waiting for a sign-up that happened
    const { data: existing } = await this.db
      .from('profiles')
      .select('id')
      .ilike('email', application.email)
      .eq('role', 'athlete')
      .maybeSingle();

    if (existing?.id) {
      await this.linkAthlete(coachId, existing.id);
      await this.db
        .from('coaching_applications')
        .update({ joined_athlete_id: existing.id })
        .eq('id', applicationId);
      return { application: { ...application, joinedAthleteId: existing.id }, athleteId: existing.id, awaitingSignUp: false };
    }

    return { application, athleteId: null, awaitingSignUp: true };
  }

  async linkAthlete(_coachId: UUID, athleteId: UUID): Promise<void> {
    // the coach is taken from auth.uid() inside the function, never from an argument
    const { error } = await this.db.rpc('im_link_athlete', { target_athlete: athleteId });
    if (error) throw new Error(error.message);
  }

  async createProgram(program: Omit<Program, 'id' | 'createdAt'>): Promise<Program> {
    // one active programme per athlete
    await this.db
      .from('programs')
      .update({ status: 'archived' })
      .eq('athlete_id', program.athleteId)
      .eq('status', 'active');

    const { data, error } = await this.db
      .from('programs')
      .insert({
        athlete_id: program.athleteId,
        coach_id: program.coachId,
        template_id: program.templateId,
        goal_id: program.goalId,
        name: program.name,
        start_date: program.startDate,
        end_date: program.endDate,
        status: program.status,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);

    return {
      id: data.id,
      athleteId: data.athlete_id,
      coachId: data.coach_id,
      templateId: data.template_id,
      goalId: data.goal_id,
      name: data.name,
      startDate: data.start_date,
      endDate: data.end_date,
      status: data.status,
      createdAt: data.created_at,
    };
  }

  /* ================= programme structure ================= */

  private toBlock = (r: any): ProgramBlock => ({
    id: r.id,
    programId: r.program_id,
    athleteId: r.athlete_id,
    blockIndex: r.block_index,
    name: r.name,
    phase: r.phase ?? null,
    focus: r.focus ?? null,
    notes: r.notes ?? null,
    createdAt: r.created_at,
  });

  private toWeek = (r: any): ProgramWeek => ({
    id: r.id,
    blockId: r.block_id,
    programId: r.program_id,
    athleteId: r.athlete_id,
    weekIndex: r.week_index,
    programWeekNo: r.program_week_no,
    startDate: r.start_date,
    targetVolumeKm: r.target_volume_km == null ? null : Number(r.target_volume_km),
    focus: r.focus ?? null,
    notes: r.notes ?? null,
    isRecoveryWeek: r.is_recovery_week,
    createdAt: r.created_at,
  });

  private toComponent = (r: any): SessionComponent => ({
    id: r.id,
    scheduledWorkoutId: r.scheduled_workout_id,
    athleteId: r.athlete_id,
    position: r.position,
    kind: r.kind,
    label: r.label ?? null,
    notes: r.notes ?? null,
    repeats: r.repeats ?? null,
    rpeTarget: r.rpe_target ?? null,
    distanceKm: r.distance_km == null ? null : Number(r.distance_km),
    durationSeconds: r.duration_seconds ?? null,
    paceMinSecPerKm: r.pace_min_sec_km ?? null,
    paceMaxSecPerKm: r.pace_max_sec_km ?? null,
    hrZone: r.hr_zone ?? null,
    recoverySeconds: r.recovery_seconds ?? null,
    recoveryDescription: r.recovery_description ?? null,
    strengthExerciseId: r.strength_exercise_id ?? null,
    sets: r.sets ?? null,
    reps: r.reps ?? null,
    loadPrescription: r.load_prescription ?? null,
    tempo: r.tempo ?? null,
    restSeconds: r.rest_seconds ?? null,
  });

  private fromComponent = (c: SessionComponentDraft, sessionId: UUID, athleteId: UUID) => ({
    scheduled_workout_id: sessionId,
    athlete_id: athleteId,
    position: c.position,
    kind: c.kind,
    label: c.label,
    notes: c.notes,
    repeats: c.repeats,
    rpe_target: c.rpeTarget,
    distance_km: c.distanceKm,
    duration_seconds: c.durationSeconds,
    pace_min_sec_km: c.paceMinSecPerKm,
    pace_max_sec_km: c.paceMaxSecPerKm,
    hr_zone: c.hrZone,
    recovery_seconds: c.recoverySeconds,
    recovery_description: c.recoveryDescription,
    strength_exercise_id: c.strengthExerciseId,
    sets: c.sets,
    reps: c.reps,
    load_prescription: c.loadPrescription,
    tempo: c.tempo,
    rest_seconds: c.restSeconds,
  });

  async listBlocks(programId: UUID): Promise<BlockWithWeeks[]> {
    const [blocks, weeks] = await Promise.all([
      this.rows(
        this.db.from('program_blocks').select('*').eq('program_id', programId).order('block_index'),
        this.toBlock,
      ),
      this.rows(
        this.db.from('program_weeks').select('*').eq('program_id', programId).order('start_date'),
        this.toWeek,
      ),
    ]);
    return blocks.map((b) => ({ ...b, weeks: weeks.filter((w) => w.blockId === b.id) }));
  }

  async createBlock(block: Omit<ProgramBlock, 'id' | 'createdAt'>): Promise<ProgramBlock> {
    const { data, error } = await this.db
      .from('program_blocks')
      .insert({
        program_id: block.programId,
        athlete_id: block.athleteId,
        block_index: block.blockIndex,
        name: block.name,
        phase: block.phase,
        focus: block.focus,
        notes: block.notes,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return this.toBlock(data);
  }

  async updateBlock(blockId: UUID, patch: Partial<ProgramBlock>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.name !== undefined) row.name = patch.name;
    if (patch.phase !== undefined) row.phase = patch.phase;
    if (patch.focus !== undefined) row.focus = patch.focus;
    if (patch.notes !== undefined) row.notes = patch.notes;
    if (patch.blockIndex !== undefined) row.block_index = patch.blockIndex;
    const { error } = await this.db.from('program_blocks').update(row).eq('id', blockId);
    if (error) throw new Error(error.message);
  }

  async deleteBlock(blockId: UUID): Promise<void> {
    // cascades to weeks and their sessions; the prescription history survives
    const { error } = await this.db.from('program_blocks').delete().eq('id', blockId);
    if (error) throw new Error(error.message);
  }

  async createWeek(week: Omit<ProgramWeek, 'id' | 'createdAt'>): Promise<ProgramWeek> {
    const { data, error } = await this.db
      .from('program_weeks')
      .insert({
        block_id: week.blockId,
        program_id: week.programId,
        athlete_id: week.athleteId,
        week_index: week.weekIndex,
        program_week_no: week.programWeekNo,
        start_date: week.startDate,
        target_volume_km: week.targetVolumeKm,
        focus: week.focus,
        notes: week.notes,
        is_recovery_week: week.isRecoveryWeek,
      })
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return this.toWeek(data);
  }

  async updateWeek(weekId: UUID, patch: Partial<ProgramWeek>): Promise<void> {
    const row: Record<string, unknown> = {};
    if (patch.targetVolumeKm !== undefined) row.target_volume_km = patch.targetVolumeKm;
    if (patch.focus !== undefined) row.focus = patch.focus;
    if (patch.notes !== undefined) row.notes = patch.notes;
    if (patch.isRecoveryWeek !== undefined) row.is_recovery_week = patch.isRecoveryWeek;
    const { error } = await this.db.from('program_weeks').update(row).eq('id', weekId);
    if (error) throw new Error(error.message);
  }

  findWeekByDate(programId: UUID, date: ISODate) {
    return this.one(
      this.db
        .from('program_weeks')
        .select('*')
        .eq('program_id', programId)
        .lte('start_date', date)
        .order('start_date', { ascending: false })
        .limit(1)
        .maybeSingle(),
      this.toWeek,
    );
  }

  listComponents(scheduledWorkoutId: UUID) {
    return this.rows(
      this.db
        .from('session_components')
        .select('*')
        .eq('scheduled_workout_id', scheduledWorkoutId)
        .order('position'),
      this.toComponent,
    );
  }

  async saveComponents(
    scheduledWorkoutId: UUID,
    athleteId: UUID,
    components: SessionComponentDraft[],
  ): Promise<SessionComponent[]> {
    // replace wholesale: position is the order, and a partial update would
    // leave orphaned positions behind
    const { error: clearError } = await this.db
      .from('session_components')
      .delete()
      .eq('scheduled_workout_id', scheduledWorkoutId);
    if (clearError) throw new Error(clearError.message);

    if (!components.length) return [];

    const { data, error } = await this.db
      .from('session_components')
      .insert(components.map((c, i) => this.fromComponent({ ...c, position: i }, scheduledWorkoutId, athleteId)))
      .select('*');
    if (error) throw new Error(error.message);
    return (data ?? []).map(this.toComponent);
  }

  /* ---- duplication: one round trip each ---- */

  async duplicateWeek(sourceWeekId: UUID, targetStart: ISODate, targetBlockId?: UUID): Promise<UUID> {
    const { data, error } = await this.db.rpc('im_duplicate_week', {
      p_source_week: sourceWeekId,
      p_target_start: targetStart,
      p_target_block: targetBlockId ?? null,
    });
    if (error) throw new Error(error.message);
    return data as UUID;
  }

  async duplicateBlock(sourceBlockId: UUID, targetStart: ISODate, name?: string): Promise<UUID> {
    const { data, error } = await this.db.rpc('im_duplicate_block', {
      p_source_block: sourceBlockId,
      p_target_start: targetStart,
      p_name: name ?? null,
    });
    if (error) throw new Error(error.message);
    return data as UUID;
  }

  async assignProgramToAthlete(
    sourceProgramId: UUID,
    athleteId: UUID,
    startDate: ISODate,
    name?: string,
  ): Promise<UUID> {
    const { data, error } = await this.db.rpc('im_assign_program', {
      p_source_program: sourceProgramId,
      p_athlete: athleteId,
      p_start: startDate,
      p_name: name ?? null,
    });
    if (error) throw new Error(error.message);
    return data as UUID;
  }

  /* ---- prescription history ---- */

  listSessionRevisions(scheduledWorkoutId: UUID) {
    return this.rows(
      this.db
        .from('session_revisions')
        .select('*')
        .eq('scheduled_workout_id', scheduledWorkoutId)
        .order('revision'),
      (r: any): SessionRevision => ({
        id: r.id,
        scheduledWorkoutId: r.scheduled_workout_id,
        athleteId: r.athlete_id,
        revision: r.revision,
        kind: r.kind,
        changedBy: r.changed_by ?? null,
        changedAt: r.changed_at,
        session: r.session ?? {},
        components: r.components ?? [],
        note: r.note ?? null,
      }),
    );
  }

  async getOriginalPrescription(scheduledWorkoutId: UUID): Promise<Record<string, unknown> | null> {
    const { data, error } = await this.db.rpc('im_original_prescription', {
      p_session_id: scheduledWorkoutId,
    });
    if (error) throw new Error(error.message);
    return (data as Record<string, unknown> | null) ?? null;
  }

  async createApplication(
    app: Omit<
      CoachingApplication,
      'id' | 'createdAt' | 'status' | 'acceptedBy' | 'acceptedAt' | 'decidedNote' | 'joinedAthleteId'
    >,
  ): Promise<CoachingApplication> {
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
    return {
      ...app,
      id: data.id,
      status: 'new',
      createdAt: data.created_at,
      acceptedBy: null,
      acceptedAt: null,
      decidedNote: null,
      joinedAthleteId: null,
    };
  }

  /* ---------- privacy ---------- */

  async exportAthleteData(athleteId: UUID): Promise<Record<string, unknown>> {
    const { data, error } = await this.db.rpc('im_export_athlete_data', { target: athleteId });
    if (error) throw new Error(error.message);
    return data as Record<string, unknown>;
  }

  /* ================= the libraries ================= */

  private toWorkoutTemplate = (r: any): WorkoutTemplate => ({
    id: r.id,
    ownerId: r.owner_id ?? null,
    visibility: r.visibility,
    name: r.name,
    category: r.category,
    type: r.type,
    basis: r.basis,
    intensity: r.intensity,
    distanceKm: r.distance_km == null ? null : Number(r.distance_km),
    durationMinutes: r.duration_minutes ?? null,
    paceMinSecKm: r.pace_min_sec_km ?? null,
    paceMaxSecKm: r.pace_max_sec_km ?? null,
    hrZone: r.hr_zone ?? null,
    rpeTarget: r.rpe_target ?? null,
    warmUp: r.warm_up ?? null,
    mainSet: r.main_set ?? null,
    coolDown: r.cool_down ?? null,
    purpose: r.purpose ?? null,
    coachNotes: r.coach_notes ?? null,
    notes: r.notes ?? null,
    tags: r.tags ?? [],
    archivedAt: r.archived_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ...(r.template_components
      ? { components: [...r.template_components].sort((a: any, b: any) => a.position - b.position).map(this.toTemplateComponent) }
      : {}),
  });

  private toStrengthExercise = (r: any): StrengthExercise => ({
    id: r.id,
    ownerId: r.owner_id ?? null,
    visibility: r.visibility,
    name: r.name,
    category: r.category,
    movementPattern: r.movement_pattern ?? null,
    description: r.description ?? null,
    muscleGroups: r.muscle_groups ?? [],
    cues: r.cues ?? [],
    regressions: r.regressions ?? [],
    progressions: r.progressions ?? [],
    equipment: r.equipment ?? [],
    videoUrl: r.video_url ?? null,
    defaultSets: r.default_sets ?? null,
    defaultReps: r.default_reps ?? null,
    loadGuidance: r.load_guidance ?? null,
    defaultTempo: r.default_tempo ?? null,
    defaultRestSeconds: r.default_rest_seconds ?? null,
    defaultRpe: r.default_rpe ?? null,
    isUnilateral: r.is_unilateral ?? false,
    tags: r.tags ?? [],
    archivedAt: r.archived_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });

  private toStrengthTemplate = (r: any): StrengthTemplate => ({
    id: r.id,
    ownerId: r.owner_id ?? null,
    visibility: r.visibility,
    name: r.name,
    category: r.category,
    description: r.description ?? '',
    estimatedMinutes: r.estimated_minutes ?? 0,
    purpose: r.purpose ?? null,
    coachNotes: r.coach_notes ?? null,
    tags: r.tags ?? [],
    archivedAt: r.archived_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    ...(r.template_components
      ? { components: [...r.template_components].sort((a: any, b: any) => a.position - b.position).map(this.toTemplateComponent) }
      : {}),
  });

  /**
   * A template component maps onto the same shape as a session component —
   * they are the same columns, which is what lets a template be copied into a
   * session without translation.
   */
  private toTemplateComponent = (r: any): SessionComponent => ({
    id: r.id,
    scheduledWorkoutId: '',
    athleteId: '',
    position: r.position,
    kind: r.kind,
    label: r.label ?? null,
    notes: r.notes ?? null,
    repeats: r.repeats ?? null,
    rpeTarget: r.rpe_target ?? null,
    distanceKm: r.distance_km == null ? null : Number(r.distance_km),
    durationSeconds: r.duration_seconds ?? null,
    paceMinSecPerKm: r.pace_min_sec_km ?? null,
    paceMaxSecPerKm: r.pace_max_sec_km ?? null,
    hrZone: r.hr_zone ?? null,
    recoverySeconds: r.recovery_seconds ?? null,
    recoveryDescription: r.recovery_description ?? null,
    strengthExerciseId: r.strength_exercise_id ?? null,
    sets: r.sets ?? null,
    reps: r.reps ?? null,
    loadPrescription: r.load_prescription ?? null,
    tempo: r.tempo ?? null,
    restSeconds: r.rest_seconds ?? null,
  });

  private fromTemplateComponent = (c: TemplateComponentDraft, position: number, parent: Record<string, UUID>) => ({
    ...parent,
    position,
    kind: c.kind,
    label: c.label,
    notes: c.notes,
    repeats: c.repeats,
    rpe_target: c.rpeTarget,
    distance_km: c.distanceKm,
    duration_seconds: c.durationSeconds,
    pace_min_sec_km: c.paceMinSecPerKm,
    pace_max_sec_km: c.paceMaxSecPerKm,
    hr_zone: c.hrZone,
    recovery_seconds: c.recoverySeconds,
    recovery_description: c.recoveryDescription,
    strength_exercise_id: c.strengthExerciseId,
    sets: c.sets,
    reps: c.reps,
    load_prescription: c.loadPrescription,
    tempo: c.tempo,
    rest_seconds: c.restSeconds,
  });

  /** Shared filtering. RLS already decides what is visible; this narrows it. */
  private applyLibraryQuery(query: any, q: LibraryQuery = {}, searchColumns = 'name,purpose') {
    if (!q.includeArchived) query = query.is('archived_at', null);
    if (q.visibility) query = query.eq('visibility', q.visibility);
    if (q.category) query = query.eq('category', q.category);
    if (q.movementPattern) query = query.eq('movement_pattern', q.movementPattern);
    if (q.tags?.length) query = query.overlaps('tags', q.tags);
    if (q.search?.trim()) {
      const term = q.search.trim().replace(/[%,()]/g, ' ');
      const ors = searchColumns.split(',').map((c) => `${c}.ilike.%${term}%`);
      query = query.or(ors.join(','));
    }
    return query.order('name').limit(q.limit ?? 200);
  }

  listWorkoutTemplates(query?: LibraryQuery) {
    return this.rows(
      this.applyLibraryQuery(this.db.from('workout_templates').select('*'), query),
      this.toWorkoutTemplate,
    );
  }

  getWorkoutTemplate(id: UUID) {
    return this.one(
      this.db.from('workout_templates').select('*, template_components(*)').eq('id', id).single(),
      this.toWorkoutTemplate,
    );
  }

  async saveWorkoutTemplate(template: WorkoutTemplateDraft, components?: TemplateComponentDraft[]) {
    const row: Record<string, unknown> = {
      owner_id: template.ownerId,
      visibility: template.visibility,
      name: template.name,
      category: template.category,
      type: template.type,
      basis: template.basis,
      intensity: template.intensity,
      distance_km: template.distanceKm,
      duration_minutes: template.durationMinutes,
      pace_min_sec_km: template.paceMinSecKm,
      pace_max_sec_km: template.paceMaxSecKm,
      hr_zone: template.hrZone,
      rpe_target: template.rpeTarget,
      warm_up: template.warmUp,
      main_set: template.mainSet,
      cool_down: template.coolDown,
      purpose: template.purpose,
      coach_notes: template.coachNotes,
      notes: template.notes,
      tags: template.tags,
      archived_at: template.archivedAt,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await this.db
      .from('workout_templates')
      .upsert(template.id ? { ...row, id: template.id } : row)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    if (components) await this.replaceTemplateComponents({ workout_template_id: data.id }, components);
    return this.toWorkoutTemplate(data);
  }

  listStrengthExercises(query?: LibraryQuery) {
    return this.rows(
      this.applyLibraryQuery(this.db.from('strength_exercises').select('*'), query, 'name,description'),
      this.toStrengthExercise,
    );
  }

  getStrengthExercise(id: UUID) {
    return this.one(this.db.from('strength_exercises').select('*').eq('id', id).single(), this.toStrengthExercise);
  }

  async saveStrengthExercise(exercise: StrengthExerciseDraft) {
    const row: Record<string, unknown> = {
      owner_id: exercise.ownerId,
      visibility: exercise.visibility,
      name: exercise.name,
      category: exercise.category,
      movement_pattern: exercise.movementPattern,
      description: exercise.description,
      muscle_groups: exercise.muscleGroups,
      cues: exercise.cues,
      regressions: exercise.regressions,
      progressions: exercise.progressions,
      equipment: exercise.equipment,
      video_url: exercise.videoUrl,
      default_sets: exercise.defaultSets,
      default_reps: exercise.defaultReps,
      load_guidance: exercise.loadGuidance,
      default_tempo: exercise.defaultTempo,
      default_rest_seconds: exercise.defaultRestSeconds,
      default_rpe: exercise.defaultRpe,
      is_unilateral: exercise.isUnilateral,
      tags: exercise.tags,
      archived_at: exercise.archivedAt,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await this.db
      .from('strength_exercises')
      .upsert(exercise.id ? { ...row, id: exercise.id } : row)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return this.toStrengthExercise(data);
  }

  listStrengthTemplates(query?: LibraryQuery) {
    return this.rows(
      this.applyLibraryQuery(this.db.from('strength_templates').select('*'), query, 'name,description'),
      this.toStrengthTemplate,
    );
  }

  getStrengthTemplate(id: UUID) {
    return this.one(
      this.db.from('strength_templates').select('*, template_components(*)').eq('id', id).single(),
      this.toStrengthTemplate,
    );
  }

  async saveStrengthTemplate(template: StrengthTemplateDraft, components?: TemplateComponentDraft[]) {
    const row: Record<string, unknown> = {
      owner_id: template.ownerId,
      visibility: template.visibility,
      name: template.name,
      category: template.category,
      description: template.description,
      estimated_minutes: template.estimatedMinutes,
      purpose: template.purpose,
      coach_notes: template.coachNotes,
      tags: template.tags,
      archived_at: template.archivedAt,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await this.db
      .from('strength_templates')
      .upsert(template.id ? { ...row, id: template.id } : row)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    if (components) await this.replaceTemplateComponents({ strength_template_id: data.id }, components);
    return this.toStrengthTemplate(data);
  }

  /** Replace wholesale — position is array order, and a partial write would strand positions. */
  private async replaceTemplateComponents(parent: Record<string, UUID>, components: TemplateComponentDraft[]) {
    const [column, id] = Object.entries(parent)[0];
    const { error: clearError } = await this.db.from('template_components').delete().eq(column, id);
    if (clearError) throw new Error(clearError.message);
    if (!components.length) return;
    const { error } = await this.db
      .from('template_components')
      .insert(components.map((c, i) => this.fromTemplateComponent(c, i, parent)));
    if (error) throw new Error(error.message);
  }

  private static readonly LIBRARY_TABLES: Record<LibraryKind, string> = {
    workout: 'workout_templates',
    exercise: 'strength_exercises',
    strength: 'strength_templates',
  };

  async setLibraryArchived(kind: LibraryKind, id: UUID, archived: boolean): Promise<void> {
    const { error } = await this.db
      .from(SupabaseRepo.LIBRARY_TABLES[kind])
      .update({ archived_at: archived ? new Date().toISOString() : null, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  }

  async duplicateLibraryItem(kind: LibraryKind, id: UUID, name?: string): Promise<UUID> {
    if (kind === 'exercise') {
      const source = await this.getStrengthExercise(id);
      if (!source) throw new Error('That exercise is no longer available.');
      const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = source;
      const copy = await this.saveStrengthExercise({
        ...rest,
        name: name ?? `${source.name} (copy)`,
        visibility: 'private',
        ownerId: await this.currentUserId(),
        archivedAt: null,
      });
      return copy.id;
    }
    const fn = kind === 'workout' ? 'im_duplicate_workout_template' : 'im_duplicate_strength_template';
    const { data, error } = await this.db.rpc(fn, { p_source: id, p_name: name ?? null });
    if (error) throw new Error(error.message);
    return data as UUID;
  }

  async insertTemplateIntoProgramme(
    kind: 'workout' | 'strength',
    templateId: UUID,
    athleteId: UUID,
    date: ISODate,
    slot?: number,
  ): Promise<UUID> {
    const fn = kind === 'workout' ? 'im_insert_workout_template' : 'im_insert_strength_template';
    const { data, error } = await this.db.rpc(fn, {
      p_template: templateId,
      p_athlete: athleteId,
      p_date: date,
      p_slot: slot ?? (kind === 'strength' ? 1 : 0),
    });
    if (error) throw new Error(error.message);
    return data as UUID;
  }

  private toProgramTemplate = (r: any): ProgramTemplateItem => ({
    id: r.id,
    ownerId: r.owner_id ?? null,
    visibility: r.visibility,
    name: r.name,
    goalType: r.goal_type,
    weeks: r.weeks,
    description: r.description ?? '',
    tags: r.tags ?? [],
    archivedAt: r.archived_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });

  listProgramTemplates(query?: LibraryQuery) {
    return this.rows(
      this.applyLibraryQuery(this.db.from('program_templates').select('*'), query, 'name,description'),
      this.toProgramTemplate,
    );
  }

  getProgramTemplate(id: UUID) {
    return this.one(this.db.from('program_templates').select('*').eq('id', id).single(), this.toProgramTemplate);
  }

  async getWeekVolume(weekId: UUID): Promise<WeekVolume> {
    const { data, error } = await this.db.rpc('im_week_volume', { p_week: weekId });
    if (error) throw new Error(error.message);
    const row = Array.isArray(data) ? data[0] : data;
    return {
      prescribedKm: Number(row?.prescribed_km ?? 0),
      targetKm: row?.target_km == null ? null : Number(row.target_km),
      sessionCount: Number(row?.session_count ?? 0),
    };
  }

  private async currentUserId(): Promise<UUID> {
    const { data } = await this.db.auth.getUser();
    const id = data.user?.id;
    if (!id) throw new Error('You need to be signed in to do that.');
    return id;
  }

  /* ================= the programme template builder ================= */

  private toTemplateBlock = (r: any): ProgramTemplateBlock => ({
    id: r.id,
    programTemplateId: r.program_template_id,
    blockIndex: r.block_index,
    name: r.name,
    phase: r.phase ?? null,
    focus: r.focus ?? null,
    description: r.description ?? null,
    createdAt: r.created_at,
  });

  private toTemplateWeek = (r: any): ProgramTemplateWeek => ({
    id: r.id,
    programTemplateId: r.program_template_id,
    blockId: r.block_id,
    weekIndex: r.week_index,
    templateWeekNo: r.template_week_no,
    targetVolumeKm: r.target_volume_km == null ? null : Number(r.target_volume_km),
    isRecoveryWeek: r.is_recovery_week ?? false,
    focus: r.focus ?? null,
    notes: r.notes ?? null,
    createdAt: r.created_at,
  });

  private toTemplateSlot = (r: any): ProgramTemplateSlot => ({
    id: r.id,
    programTemplateId: r.program_template_id,
    templateWeekId: r.template_week_id,
    weekday: r.weekday,
    slot: r.slot,
    workoutTemplateId: r.workout_template_id ?? null,
    strengthTemplateId: r.strength_template_id ?? null,
    isRest: r.is_rest ?? false,
    isOptional: r.is_optional ?? false,
    label: r.label ?? null,
    notes: r.notes ?? null,
    distanceKm: r.distance_km == null ? null : Number(r.distance_km),
    durationMinutes: r.duration_minutes ?? null,
    rpeTarget: r.rpe_target ?? null,
  });

  private toTemplateVolume = (r: any): TemplateWeekVolume => ({
    templateWeekNo: r.template_week_no,
    blockName: r.block_name,
    phase: r.phase ?? null,
    isRecoveryWeek: r.is_recovery_week ?? false,
    targetKm: r.target_km == null ? null : Number(r.target_km),
    prescribedKm: Number(r.prescribed_km ?? 0),
    sessionCount: Number(r.session_count ?? 0),
    restDays: Number(r.rest_days ?? 0),
    trainingDays: Number(r.training_days ?? 0),
  });

  async getProgramTemplateDetail(id: UUID): Promise<ProgramTemplateDetail | null> {
    const template = await this.getProgramTemplateRow(id);
    if (!template) return null;

    const [blocks, weeks, slots, volume] = await Promise.all([
      this.rows(
        this.db.from('program_template_blocks').select('*').eq('program_template_id', id).order('block_index'),
        this.toTemplateBlock,
      ),
      this.rows(
        this.db.from('program_template_weeks').select('*').eq('program_template_id', id).order('template_week_no'),
        this.toTemplateWeek,
      ),
      this.rows(
        this.db.from('program_template_slots').select('*').eq('program_template_id', id)
          .order('weekday').order('slot'),
        this.toTemplateSlot,
      ),
      this.getTemplateVolume(id),
    ]);

    const slotsByWeek = new Map<UUID, ProgramTemplateSlot[]>();
    for (const s of slots) {
      const list = slotsByWeek.get(s.templateWeekId) ?? [];
      list.push(s);
      slotsByWeek.set(s.templateWeekId, list);
    }

    return {
      ...template,
      volume,
      blocks: blocks.map((b) => ({
        ...b,
        weeks: weeks
          .filter((w) => w.blockId === b.id)
          .map((w) => ({ ...w, slots: slotsByWeek.get(w.id) ?? [] })),
      })),
    };
  }

  private toProgramTemplateFull = (r: any): ProgramTemplate => ({
    id: r.id,
    ownerId: r.owner_id ?? null,
    visibility: r.visibility,
    name: r.name,
    description: r.description ?? '',
    purpose: r.purpose ?? null,
    coachNotes: r.coach_notes ?? null,
    discipline: r.discipline ?? 'running',
    goalType: r.goal_type,
    targetDistanceKm: r.target_distance_km == null ? null : Number(r.target_distance_km),
    experienceLevel: r.experience_level ?? null,
    minDaysPerWeek: r.min_days_per_week ?? null,
    maxDaysPerWeek: r.max_days_per_week ?? null,
    weeks: r.weeks,
    tags: r.tags ?? [],
    archivedAt: r.archived_at ?? null,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  });

  private getProgramTemplateRow(id: UUID) {
    return this.one(
      this.db.from('program_templates').select('*').eq('id', id).single(),
      this.toProgramTemplateFull,
    );
  }

  async saveProgramTemplate(template: ProgramTemplateDraft): Promise<ProgramTemplate> {
    const row: Record<string, unknown> = {
      owner_id: template.ownerId,
      visibility: template.visibility,
      name: template.name,
      description: template.description,
      purpose: template.purpose,
      coach_notes: template.coachNotes,
      discipline: template.discipline,
      goal_type: template.goalType,
      target_distance_km: template.targetDistanceKm,
      experience_level: template.experienceLevel,
      min_days_per_week: template.minDaysPerWeek,
      max_days_per_week: template.maxDaysPerWeek,
      tags: template.tags,
      archived_at: template.archivedAt,
      updated_at: new Date().toISOString(),
    };
    // weeks follows the structure once there is one; on create it is the
    // nominal length the coach typed
    if (!template.id) row.weeks = template.weeks ?? 1;

    const { data, error } = await this.db
      .from('program_templates')
      .upsert(template.id ? { ...row, id: template.id } : row)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return this.toProgramTemplateFull(data);
  }

  async saveTemplateBlock(block: TemplateBlockDraft): Promise<ProgramTemplateBlock> {
    const row: Record<string, unknown> = {
      program_template_id: block.programTemplateId,
      block_index: block.blockIndex,
      name: block.name,
      phase: block.phase,
      focus: block.focus,
      description: block.description,
    };
    const { data, error } = await this.db
      .from('program_template_blocks')
      .upsert(block.id ? { ...row, id: block.id } : row)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return this.toTemplateBlock(data);
  }

  async deleteTemplateBlock(blockId: UUID): Promise<void> {
    const { count, error: countError } = await this.db
      .from('program_template_weeks')
      .select('id', { count: 'exact', head: true })
      .eq('block_id', blockId);
    if (countError) throw new Error(countError.message);
    if (count) {
      throw new Error(
        `This block still holds ${count} week(s). Remove them first, or delete the weeks you no longer want.`,
      );
    }
    const { error } = await this.db.from('program_template_blocks').delete().eq('id', blockId);
    if (error) throw new Error(error.message);
  }

  async saveTemplateWeek(week: TemplateWeekDraft): Promise<ProgramTemplateWeek> {
    const row: Record<string, unknown> = {
      program_template_id: week.programTemplateId,
      block_id: week.blockId,
      week_index: week.weekIndex,
      template_week_no: week.templateWeekNo,
      target_volume_km: week.targetVolumeKm,
      is_recovery_week: week.isRecoveryWeek,
      focus: week.focus,
      notes: week.notes,
    };
    const { data, error } = await this.db
      .from('program_template_weeks')
      .upsert(week.id ? { ...row, id: week.id } : row)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return this.toTemplateWeek(data);
  }

  async deleteTemplateWeek(weekId: UUID): Promise<void> {
    const { error } = await this.db.from('program_template_weeks').delete().eq('id', weekId);
    if (error) throw new Error(error.message);
  }

  async saveTemplateSlot(slot: TemplateSlotDraft): Promise<ProgramTemplateSlot> {
    const row: Record<string, unknown> = {
      program_template_id: slot.programTemplateId,
      template_week_id: slot.templateWeekId,
      weekday: slot.weekday,
      slot: slot.slot,
      workout_template_id: slot.workoutTemplateId,
      strength_template_id: slot.strengthTemplateId,
      is_rest: slot.isRest,
      is_optional: slot.isOptional,
      label: slot.label,
      notes: slot.notes,
      distance_km: slot.distanceKm,
      duration_minutes: slot.durationMinutes,
      rpe_target: slot.rpeTarget,
    };
    const { data, error } = await this.db
      .from('program_template_slots')
      .upsert(slot.id ? { ...row, id: slot.id } : row)
      .select('*')
      .single();
    if (error) throw new Error(error.message);
    return this.toTemplateSlot(data);
  }

  async deleteTemplateSlot(slotId: UUID): Promise<void> {
    const { error } = await this.db.from('program_template_slots').delete().eq('id', slotId);
    if (error) throw new Error(error.message);
  }

  async duplicateProgramTemplate(id: UUID, name?: string): Promise<UUID> {
    const { data, error } = await this.db.rpc('im_duplicate_program_template', {
      p_source: id,
      p_name: name ?? null,
    });
    if (error) throw new Error(error.message);
    return data as UUID;
  }

  async getTemplateVolume(templateId: UUID): Promise<TemplateWeekVolume[]> {
    const { data, error } = await this.db.rpc('im_template_week_volume', { p_template: templateId });
    if (error) throw new Error(error.message);
    return (data ?? []).map(this.toTemplateVolume);
  }

  async getAssignmentConflicts(
    templateId: UUID,
    athleteId: UUID,
    startDate: ISODate,
  ): Promise<AssignmentConflict[]> {
    const { data, error } = await this.db.rpc('im_template_conflicts', {
      p_template: templateId,
      p_athlete: athleteId,
      p_start: startDate,
    });
    if (error) throw new Error(error.message);
    return (data ?? []) as AssignmentConflict[];
  }

  async previewAssignment(
    templateId: UUID,
    athleteId: UUID,
    startDate: ISODate,
  ): Promise<AssignmentPreview> {
    const [detail, profile, conflicts, goal, program, workouts, strength] = await Promise.all([
      this.getProgramTemplateDetail(templateId),
      this.getProfile(athleteId),
      this.getAssignmentConflicts(templateId, athleteId, startDate),
      this.getPrimaryGoal(athleteId),
      this.getProgram(athleteId),
      this.listWorkoutTemplates({ includeArchived: true }),
      this.listStrengthTemplates({ includeArchived: true }),
    ]);
    if (!detail) throw new Error('That programme template is no longer available.');

    const race = goal?.raceId ? await this.getRace(goal.raceId) : null;
    const sessionNames = new Map<string, string>([
      ...workouts.map((w) => [w.id, w.name] as const),
      ...strength.map((s) => [s.id, s.name] as const),
    ]);
    return buildAssignmentPreview({
      template: detail,
      athleteId,
      profile,
      conflicts,
      weeks: detail.volume,
      goal,
      race,
      program,
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
    const { data, error } = await this.db.rpc('im_instantiate_program_template', {
      p_template: templateId,
      p_athlete: athleteId,
      p_start: startDate,
      p_name: options?.name ?? null,
      p_goal: options?.goalId ?? null,
    });
    if (error) throw new Error(error.message);
    return data as UUID;
  }

  /* ---- saving a live programme back out as a template ---- */

  async previewProgrammeExtraction(programId: UUID): Promise<ExtractionPreview> {
    const { data, error } = await this.db.rpc('im_extract_preview', { p_program: programId });
    if (error) throw new Error(error.message);
    const notes = ((data ?? []) as ExtractionNote[]).map((n) => ({ ...n, count: Number(n.count ?? 0) }));

    const [program, blocks] = await Promise.all([
      this.one(
        this.db.from('programs').select('id, name, athlete_id, goal_id').eq('id', programId).single(),
        (r: any) => r,
      ),
      this.rows(
        this.db.from('program_blocks').select('id').eq('program_id', programId),
        (r: any) => r.id as UUID,
      ),
    ]);
    if (!program) throw new Error('That programme no longer exists.');

    const [profile, weeks, sessions] = await Promise.all([
      this.getProfile(program.athlete_id),
      this.rows(this.db.from('program_weeks').select('id').eq('program_id', programId), (r: any) => r.id as UUID),
      this.rows(
        this.db.from('scheduled_workouts').select('date, type, program_week_id').eq('program_id', programId),
        (r: any) => r,
      ),
    ]);

    return buildExtractionPreview({
      programId,
      programName: program.name,
      athleteName: profile?.fullName ?? 'This athlete',
      blockCount: blocks.length,
      weekCount: weeks.length,
      sessions: sessions
        .filter((r: any) => r.program_week_id)
        .map((r: any) => ({ date: r.date as ISODate, type: r.type as string, weekId: r.program_week_id as UUID })),
      goalEventType: (await this.getPrimaryGoal(program.athlete_id))?.eventType ?? null,
      notes,
    });
  }

  async extractProgrammeTemplate(programId: UUID, metadata: ExtractionMetadata): Promise<UUID> {
    const { data, error } = await this.db.rpc('im_extract_program_template', {
      p_program: programId,
      p_name: metadata.name,
      p_visibility: metadata.visibility,
      p_discipline: metadata.discipline,
      p_goal_type: metadata.goalType,
      p_target_distance_km: metadata.targetDistanceKm,
      p_experience: metadata.experienceLevel,
      p_min_days: metadata.minDaysPerWeek,
      p_max_days: metadata.maxDaysPerWeek,
      p_purpose: metadata.purpose,
      p_coach_notes: metadata.coachNotes,
    });
    if (error) throw new Error(error.message);
    return data as UUID;
  }

  /* ================= adapting a live programme ================= */

  async moveSession(sessionId: UUID, date: ISODate, slot?: number): Promise<void> {
    const { error } = await this.db.rpc('im_move_session', {
      p_session: sessionId,
      p_date: date,
      p_slot: slot ?? null,
    });
    if (error) throw new Error(error.message);
  }

  async swapSessions(a: UUID, b: UUID): Promise<void> {
    const { error } = await this.db.rpc('im_swap_sessions', { p_a: a, p_b: b });
    if (error) throw new Error(error.message);
  }

  async shiftSessions(
    athleteId: UUID,
    from: ISODate,
    to: ISODate,
    days: number,
    apply: boolean,
  ): Promise<ShiftRow[]> {
    const { data, error } = await this.db.rpc('im_shift_sessions', {
      p_athlete: athleteId, p_from: from, p_to: to, p_days: days, p_apply: apply,
    });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      sessionId: r.session_id,
      action: r.action,
      name: r.name,
      fromDate: r.from_date,
      toDate: r.to_date,
      status: r.status,
      detail: r.detail,
    }));
  }

  async scaleVolume(
    athleteId: UUID,
    from: ISODate,
    to: ISODate,
    factor: number,
    apply: boolean,
  ): Promise<VolumeRow[]> {
    const { data, error } = await this.db.rpc('im_scale_volume', {
      p_athlete: athleteId, p_from: from, p_to: to, p_factor: factor, p_apply: apply,
    });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      sessionId: r.session_id,
      action: r.action,
      name: r.name,
      fromKm: r.from_km == null ? null : Number(r.from_km),
      toKm: r.to_km == null ? null : Number(r.to_km),
      status: r.status,
      detail: r.detail,
    }));
  }

  async getWeekAdaptationContext(weekId: UUID): Promise<WeekSession[]> {
    const { data, error } = await this.db.rpc('im_week_adaptation_context', { p_week: weekId });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      sessionId: r.session_id,
      date: r.date,
      slot: r.slot,
      name: r.name,
      type: r.type,
      status: r.status,
      distanceKm: r.distance_km == null ? null : Number(r.distance_km),
      durationMinutes: r.duration_minutes ?? null,
      blocker: r.blocker ?? null,
      revisions: Number(r.revisions ?? 0),
      movedFrom: r.moved_from ?? null,
    }));
  }

  async getSessionHistory(sessionId: UUID): Promise<SessionHistory> {
    const { data, error } = await this.db.rpc('im_session_history', { p_session: sessionId });
    if (error) throw new Error(error.message);
    return buildSessionHistory((data ?? []).map((r: any) => ({
      revision: r.revision,
      kind: r.kind,
      changedAt: r.changed_at,
      changedBy: r.changed_by ?? null,
      changedByName: r.changed_by_name ?? null,
      session: r.session ?? {},
      note: r.note ?? null,
    })));
  }

  async getCheckInContext(athleteId: UUID): Promise<CheckInContext | null> {
    const [latest] = await this.listCheckIns(athleteId, 1);
    return latest ? toCheckInContext(latest) : null;
  }

  /* ================= the roster ================= */

  async listRoster(coachId: UUID, today: ISODate): Promise<RosterEntry[]> {
    const { data, error } = await this.db.rpc('im_coach_roster', { p_coach: coachId, p_today: today });
    if (error) throw new Error(error.message);

    return rankEntries((data ?? []).map((r: any) => buildEntry({
      athleteId: r.athlete_id,
      fullName: r.full_name,
      avatarUrl: r.avatar_url ?? null,
      joinedAt: r.joined_at ?? null,

      programmeId: r.programme_id ?? null,
      programmeName: r.programme_name ?? null,
      programmeEndDate: r.programme_end_date ?? null,
      blockName: r.block_name ?? null,
      phase: r.phase ?? null,
      weekNo: r.week_no ?? null,
      totalWeeks: r.total_weeks ?? null,

      plannedThisWeek: Number(r.planned_this_week ?? 0),
      completedThisWeek: Number(r.completed_this_week ?? 0),
      plannedFourWeeks: Number(r.planned_four_weeks ?? 0),
      completedFourWeeks: Number(r.completed_four_weeks ?? 0),

      missedFourteenDays: Number(r.missed_fourteen_days ?? 0),
      missedKeySession: r.missed_key_name
        ? { name: r.missed_key_name, date: r.missed_key_date }
        : null,

      lastCompletedDate: r.last_completed_date ?? null,
      lastCompletedName: r.last_completed_name ?? null,
      nextSessionDate: r.next_session_date ?? null,
      nextSessionName: r.next_session_name ?? null,
      futureSessions: Number(r.future_sessions ?? 0),

      checkIn: r.checkin_week_start
        ? {
            weekStart: r.checkin_week_start,
            submittedAt: r.checkin_submitted_at,
            attention: r.checkin_attention,
            reasons: r.checkin_reasons ?? [],
            reviewedAt: r.checkin_reviewed_at ?? null,
            fatigue: r.checkin_fatigue ?? null,
            soreness: r.checkin_soreness ?? null,
            painOrNiggles: r.checkin_pain ?? null,
          }
        : null,

      raceId: r.race_id ?? null,
      raceName: r.race_name ?? null,
      raceDate: r.race_date ?? null,
      eventType: r.goal_event_type ?? null,

      unreadFromAthlete: Number(r.unread_from_athlete ?? 0),
      recentAdaptations: Number(r.recent_adaptations ?? 0),
    }, today)));
  }

  async deleteAthleteData(athleteId: UUID): Promise<void> {
    // deleting the auth user cascades through profiles to every owned row
    const { error } = await this.db.from('profiles').delete().eq('id', athleteId);
    if (error) throw new Error(error.message);
  }
}
