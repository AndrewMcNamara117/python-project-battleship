import {
  addDays,
  startOfWeek,
  toISODate,
  weekdayIndex,
} from '@/lib/domain/dates';
import type {
  Achievement,
  CheckIn,
  CheckInScores,
  CoachAthleteLink,
  CoachNote,
  CommunityEvent,
  CommunityPost,
  CompletedWorkout,
  ForgeScoreEvent,
  Goal,
  Integration,
  ISODate,
  Message,
  Notification,
  Profile,
  Program,
  Race,
  ScheduledWorkout,
  StrengthSession,
  Subscription,
  WorkoutType,
} from '@/lib/domain/types';
import { FORGE_POINTS } from '@/lib/domain/types';
import { triageCheckIn } from '@/lib/domain/checkin-rules';
import { strengthTemplateById } from './strength-library';

/* ------------------------------------------------------------------
   Deterministic demo dataset.

   Everything is generated relative to `today` so the Connemara countdown,
   the current training week and the charts stay coherent whenever the app
   is opened. Same day in, same data out — no random drift between renders,
   which matters because the server and the client both build it.
   ------------------------------------------------------------------ */

/** Small deterministic PRNG (mulberry32) seeded from a string. */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const jitter = (r: () => number, spread: number) => (r() - 0.5) * 2 * spread;
const round1 = (n: number) => Math.round(n * 10) / 10;
const mod = (n: number, m: number) => ((n % m) + m) % m;

export const DEMO_ATHLETE_ID = 'demo-athlete-andrew';
export const DEMO_COACH_ID = 'demo-coach';

/** Weeks of history the demo carries. Enough for 12-week charts to be honest. */
const HISTORY_WEEKS = 20;
const FUTURE_WEEKS = 6;

export interface DemoDataset {
  profiles: Profile[];
  links: CoachAthleteLink[];
  races: Race[];
  goals: Goal[];
  programs: Program[];
  scheduled: ScheduledWorkout[];
  completed: CompletedWorkout[];
  strengthSessions: StrengthSession[];
  checkins: CheckIn[];
  coachNotes: CoachNote[];
  messages: Message[];
  forgeEvents: ForgeScoreEvent[];
  achievements: Achievement[];
  communityEvents: CommunityEvent[];
  communityPosts: CommunityPost[];
  subscriptions: Subscription[];
  integrations: Integration[];
  notifications: Notification[];
}

/* ---------- the weekly frame ---------- */

interface DaySpec {
  name: string;
  type: WorkoutType;
  distanceKm: number | null;
  durationMinutes: number | null;
  intensity: ScheduledWorkout['intensity'];
  basis: ScheduledWorkout['basis'];
  hrZone: number | null;
  rpeTarget: number | null;
  paceSecPerKm: number | null;
  warmUp: string | null;
  mainSet: string | null;
  coolDown: string | null;
  notes: string | null;
  coachNote: string | null;
  strengthTemplateId: string | null;
}

/**
 * Long run progression anchored so that week offset 0 is exactly 22K —
 * the current week the brief specifies. Every third week steps back.
 */
function longRunKm(offset: number): number {
  const base = 22 + offset * 1.15;
  const stepBack = offset !== 0 && mod(offset, 4) === 2;
  const km = stepBack ? base * 0.72 : base;
  return Math.max(10, Math.min(42, Math.round(km)));
}

function weekPlan(offset: number): DaySpec[] {
  const long = longRunKm(offset);
  const easy = offset === 0 ? 8 : Math.max(6, Math.min(12, Math.round(8 + offset * 0.2)));
  const recovery = 6;
  const club = offset === 0 ? 10 : Math.max(8, Math.min(14, Math.round(10 + offset * 0.15)));

  return [
    {
      name: `Easy ${easy}K`,
      type: 'easy_run',
      distanceKm: easy,
      durationMinutes: Math.round(easy * 6),
      intensity: 'easy',
      basis: 'distance',
      hrZone: 2,
      rpeTarget: 3,
      paceSecPerKm: 345,
      warmUp: null,
      mainSet: 'Continuous easy running. Conversational throughout.',
      coolDown: null,
      notes: 'Zone 2. If you can not hold a conversation, slow down.',
      coachNote:
        offset === 0 ? 'Keep this genuinely easy. Tomorrow is where we work.' : null,
      strengthTemplateId: null,
    },
    {
      name: 'Strength — Foundation A',
      type: 'strength',
      distanceKm: null,
      durationMinutes: 45,
      intensity: 'steady',
      basis: 'time',
      hrZone: null,
      rpeTarget: 7,
      paceSecPerKm: null,
      warmUp: null,
      mainSet: 'Bilateral strength and posterior chain.',
      coolDown: null,
      notes: 'Two reps in reserve on every set.',
      coachNote: null,
      strengthTemplateId: 'st-foundation-a',
    },
    {
      name: 'Threshold — 6 x 5 min',
      type: 'threshold',
      distanceKm: 13,
      durationMinutes: 65,
      intensity: 'hard',
      basis: 'time',
      hrZone: 4,
      rpeTarget: 8,
      paceSecPerKm: 282,
      warmUp: '15 min easy + drills + 4 x 20s strides.',
      mainSet: '6 x 5 min at threshold, 90s easy jog between.',
      coolDown: '12 min easy.',
      notes: 'Controlled discomfort. Same pace on rep six as rep one.',
      coachNote: offset === 0 ? 'Rep six should look like rep one. Hold back early.' : null,
      strengthTemplateId: null,
    },
    {
      name: `Recovery ${recovery}K`,
      type: 'recovery_run',
      distanceKm: recovery,
      durationMinutes: 38,
      intensity: 'recovery',
      basis: 'time',
      hrZone: 1,
      rpeTarget: 2,
      paceSecPerKm: 380,
      warmUp: null,
      mainSet: 'Very easy, flat route.',
      coolDown: null,
      notes: 'Blood flow, not fitness. Shorter than it feels like it should be.',
      coachNote: null,
      strengthTemplateId: null,
    },
    {
      name: 'Strength — Foundation B',
      type: 'strength',
      distanceKm: null,
      durationMinutes: 45,
      intensity: 'steady',
      basis: 'time',
      hrZone: null,
      rpeTarget: 7,
      paceSecPerKm: null,
      warmUp: null,
      mainSet: 'Single-leg strength and lateral control.',
      coolDown: null,
      notes: 'The session that keeps you on the road.',
      coachNote: null,
      strengthTemplateId: 'st-foundation-b',
    },
    {
      name: 'Iron Miles Club Run',
      type: 'easy_run',
      distanceKm: club,
      durationMinutes: Math.round(club * 6.1),
      intensity: 'easy',
      basis: 'distance',
      hrZone: 2,
      rpeTarget: 4,
      paceSecPerKm: 352,
      warmUp: null,
      mainSet: 'Saturday morning with the club. Social pace.',
      coolDown: null,
      notes: 'Coffee after is part of the session.',
      coachNote: null,
      strengthTemplateId: null,
    },
    {
      name: `Long Run ${long}K`,
      type: 'long_run',
      distanceKm: long,
      durationMinutes: Math.round(long * 6.2),
      intensity: 'easy',
      basis: 'distance',
      hrZone: 2,
      rpeTarget: 5,
      paceSecPerKm: 368,
      warmUp: 'First 15 minutes deliberately slower than target.',
      mainSet: 'Steady, controlled. Practise race-day fuelling from 40 minutes.',
      coolDown: '10 minutes easy walking.',
      notes: 'Fuel early. Start controlled. Finish stronger than you started.',
      coachNote:
        offset === 0
          ? 'Take a gel at 40 minutes and every 35 after. Rehearse Connemara, do not survive it.'
          : null,
      strengthTemplateId: null,
    },
  ];
}

/* ---------- the club, for leaderboards and community ---------- */

const CLUB_MEMBERS: { id: string; name: string; group: string; bias: number }[] = [
  { id: 'demo-athlete-andrew', name: 'Andrew', group: 'Ultra Squad', bias: 1.0 },
  { id: 'demo-athlete-2', name: 'Ciara N.', group: 'Marathon Block', bias: 0.96 },
  { id: 'demo-athlete-3', name: 'Dara O.', group: 'Ultra Squad', bias: 0.92 },
  { id: 'demo-athlete-4', name: 'Sinead M.', group: 'Half Block', bias: 0.88 },
  { id: 'demo-athlete-5', name: 'Eoin C.', group: 'Marathon Block', bias: 0.85 },
  { id: 'demo-athlete-6', name: 'Roisin K.', group: 'Half Block', bias: 0.81 },
  { id: 'demo-athlete-7', name: 'Padraig B.', group: 'Ultra Squad', bias: 0.78 },
  { id: 'demo-athlete-8', name: 'Aoife D.', group: '10K Block', bias: 0.74 },
  { id: 'demo-athlete-9', name: 'Cathal R.', group: 'Marathon Block', bias: 0.69 },
  { id: 'demo-athlete-10', name: 'Niamh S.', group: '10K Block', bias: 0.63 },
];

/* ---------- builder ---------- */

export function buildDemoDataset(today: ISODate = toISODate(new Date())): DemoDataset {
  const r = rng(`iron-miles-${today}`);
  const currentWeek = startOfWeek(today);
  const raceDate = addDays(today, 218);
  const nowISO = `${today}T07:00:00.000Z`;

  /* profiles */
  const coach: Profile = {
    id: DEMO_COACH_ID,
    role: 'coach',
    fullName: 'R. Doyle',
    email: 'coach@ironmiles.ie',
    avatarUrl: null,
    dateOfBirth: null,
    location: 'Limerick, Ireland',
    timezone: 'Europe/Dublin',
    units: 'metric',
    createdAt: '2024-01-08T09:00:00.000Z',
    onboardedAt: '2024-01-08T09:00:00.000Z',
    healthDataConsentAt: '2024-01-08T09:00:00.000Z',
    leaderboardOptIn: false,
    forgeAssistantEnabled: true,
  };

  const profiles: Profile[] = [
    coach,
    ...CLUB_MEMBERS.map((m, i) => ({
      id: m.id,
      role: 'athlete' as const,
      fullName: m.name,
      email: `${m.name.toLowerCase().replace(/[^a-z]/g, '')}@example.com`,
      avatarUrl: null,
      dateOfBirth: i === 0 ? '1991-04-17' : null,
      location: 'Limerick, Ireland',
      timezone: 'Europe/Dublin',
      units: 'metric' as const,
      createdAt: '2024-06-01T09:00:00.000Z',
      onboardedAt: '2024-06-03T09:00:00.000Z',
      healthDataConsentAt: '2024-06-03T09:00:00.000Z',
      leaderboardOptIn: true,
      forgeAssistantEnabled: true,
    })),
  ];

  const links: CoachAthleteLink[] = CLUB_MEMBERS.map((m) => ({
    id: `link-${m.id}`,
    coachId: DEMO_COACH_ID,
    athleteId: m.id,
    status: 'active' as const,
    startedAt: '2024-06-03T09:00:00.000Z',
    endedAt: null,
  }));

  /* race + goal */
  const races: Race[] = [
    {
      id: 'race-connemara-ultra',
      name: 'Connemara Ultra',
      date: raceDate,
      location: 'Connemara, Co. Galway',
      eventType: 'ultra',
      distanceKm: 63,
      elevationM: 780,
      url: null,
      createdBy: null,
    },
    {
      id: 'race-limerick-half',
      name: 'Great Limerick Run — Half',
      date: addDays(today, 74),
      location: 'Limerick City',
      eventType: 'half_marathon',
      distanceKm: 21.1,
      elevationM: 90,
      url: null,
      createdBy: null,
    },
    {
      id: 'race-ballyhoura',
      name: 'Ballyhoura Trail 30K',
      date: addDays(today, 131),
      location: 'Ballyhoura Mountains',
      eventType: 'ultra',
      distanceKm: 30,
      elevationM: 950,
      url: null,
      createdBy: null,
    },
  ];

  const goals: Goal[] = [
    {
      id: 'goal-connemara',
      athleteId: DEMO_ATHLETE_ID,
      raceId: 'race-connemara-ultra',
      eventType: 'ultra',
      targetDate: raceDate,
      outcome: 'completion',
      targetTimeSeconds: 7 * 3600 + 30 * 60,
      why: 'I want to know what I am on the far side of 50K. Not for a time. To find out.',
      isPrimary: true,
      createdAt: '2024-11-02T20:14:00.000Z',
    },
  ];

  const programStart = addDays(currentWeek, -HISTORY_WEEKS * 7);
  const programs: Program[] = [
    {
      id: 'prog-connemara',
      athleteId: DEMO_ATHLETE_ID,
      coachId: DEMO_COACH_ID,
      templateId: 'pt-ultra',
      goalId: 'goal-connemara',
      name: 'Connemara Ultra — Time on Feet',
      startDate: programStart,
      endDate: raceDate,
      status: 'active',
      createdAt: '2024-11-04T10:00:00.000Z',
    },
  ];

  /* schedule, logs, strength, forge ledger */
  const scheduled: ScheduledWorkout[] = [];
  const completed: CompletedWorkout[] = [];
  const strengthSessions: StrengthSession[] = [];
  const forgeEvents: ForgeScoreEvent[] = [];

  for (let offset = -HISTORY_WEEKS; offset <= FUTURE_WEEKS; offset++) {
    const weekStart = addDays(currentWeek, offset * 7);
    const plan = weekPlan(offset);
    let weekPrescribed = 0;
    let weekCompleted = 0;

    plan.forEach((spec, dayIdx) => {
      const date = addDays(weekStart, dayIdx);
      const isPast = date < today;
      const id = `sw-${date}-${dayIdx}`;

      // ~88% adherence in past weeks, weighted so long runs and strength are
      // occasionally the ones that slip — which is what actually happens.
      // The current week is always complete up to today: a demo opening on a
      // day whose only elapsed session happened to be seeded as missed reads
      // like a broken dashboard rather than a realistic one. Missed sessions
      // still appear throughout the history and in the coach's flagged list.
      const skipChance =
        offset === 0 ? 0 : spec.type === 'strength' ? 0.16 : spec.type === 'long_run' ? 0.06 : 0.1;
      const didIt = isPast ? r() > skipChance : false;

      const status: ScheduledWorkout['status'] = !isPast
        ? 'scheduled'
        : didIt
          ? 'completed'
          : 'missed';

      weekPrescribed += 1;
      if (status === 'completed') weekCompleted += 1;

      scheduled.push({
        id,
        programId: 'prog-connemara',
        athleteId: DEMO_ATHLETE_ID,
        date,
        slot: 0,
        status,
        name: spec.name,
        type: spec.type,
        basis: spec.basis,
        intensity: spec.intensity,
        distanceKm: spec.distanceKm,
        durationMinutes: spec.durationMinutes,
        paceRange: spec.paceSecPerKm
          ? { minSecPerKm: spec.paceSecPerKm - 12, maxSecPerKm: spec.paceSecPerKm + 18 }
          : null,
        hrZone: spec.hrZone,
        rpeTarget: spec.rpeTarget,
        warmUp: spec.warmUp,
        mainSet: spec.mainSet,
        coolDown: spec.coolDown,
        notes: spec.notes,
        coachNote: spec.coachNote,
        strengthTemplateId: spec.strengthTemplateId,
        raceId: null,
        createdAt: '2024-11-04T10:00:00.000Z',
      });

      if (status !== 'completed') return;

      if (spec.type === 'strength' && spec.strengthTemplateId) {
        const tpl = strengthTemplateById(spec.strengthTemplateId);
        strengthSessions.push({
          id: `ss-${date}`,
          athleteId: DEMO_ATHLETE_ID,
          scheduledWorkoutId: id,
          templateId: spec.strengthTemplateId,
          date,
          status: 'completed',
          logs:
            tpl?.blocks.flatMap((b) =>
              Array.from({ length: b.sets }, (_, si) => ({
                exerciseId: b.exerciseId,
                setIndex: si,
                reps: Number(b.reps.match(/\d+/)?.[0] ?? 8),
                weightKg: null,
                rpe: Math.round(6 + jitter(r, 1.2)),
                completed: true,
              })),
            ) ?? [],
          durationMinutes: Math.round((spec.durationMinutes ?? 45) + jitter(r, 6)),
          notes: null,
          completedAt: `${date}T18:40:00.000Z`,
        });
        forgeEvents.push({
          id: `fe-str-${date}`,
          athleteId: DEMO_ATHLETE_ID,
          kind: 'strength_completed',
          points: FORGE_POINTS.strength_completed,
          date,
          label: spec.name,
          sourceId: id,
        });
        return;
      }

      const dist = round1((spec.distanceKm ?? 0) * (1 + jitter(r, 0.04)));
      const pace = Math.round((spec.paceSecPerKm ?? 350) * (1 + jitter(r, 0.035)));
      completed.push({
        id: `cw-${date}`,
        scheduledWorkoutId: id,
        athleteId: DEMO_ATHLETE_ID,
        date,
        type: spec.type,
        actualDistanceKm: dist,
        actualDurationMinutes: Math.round((dist * pace) / 60),
        averagePaceSecPerKm: pace,
        averageHeartRate: Math.round(
          (spec.hrZone === 1 ? 128 : spec.hrZone === 2 ? 142 : spec.hrZone === 4 ? 168 : 175) +
            jitter(r, 5),
        ),
        maxHeartRate: Math.round((spec.hrZone === 4 ? 182 : 168) + jitter(r, 6)),
        rpe: Math.max(1, Math.min(10, Math.round((spec.rpeTarget ?? 5) + jitter(r, 1.1)))),
        sessionRating: Math.max(1, Math.min(5, Math.round(4 + jitter(r, 0.9)))),
        soreness: Math.max(1, Math.min(10, Math.round(3 + jitter(r, 1.6)))),
        athleteNotes:
          spec.type === 'long_run' && r() > 0.6
            ? 'Legs came good after the first hour. Fuelled every 35 minutes.'
            : null,
        source: 'manual',
        createdAt: `${date}T19:05:00.000Z`,
      });

      const kind =
        dayIdx === 5 ? ('community_run' as const) : ('run_completed' as const);
      forgeEvents.push({
        id: `fe-run-${date}`,
        athleteId: DEMO_ATHLETE_ID,
        kind,
        points: FORGE_POINTS[kind],
        date,
        label: spec.name,
        sourceId: id,
      });
    });

    // week-level awards, only for weeks that are fully in the past
    const weekEnd = addDays(weekStart, 6);
    if (weekEnd < today && weekCompleted === weekPrescribed && weekPrescribed > 0) {
      forgeEvents.push({
        id: `fe-adh-${weekStart}`,
        athleteId: DEMO_ATHLETE_ID,
        kind: 'full_week_adherence',
        points: FORGE_POINTS.full_week_adherence,
        date: weekEnd,
        label: '100% weekly adherence',
        sourceId: null,
      });
    }
  }

  /* check-ins — one per completed past week */
  const checkins: CheckIn[] = [];
  for (let offset = -HISTORY_WEEKS; offset < 0; offset++) {
    const weekStart = addDays(currentWeek, offset * 7);
    const weekEnd = addDays(weekStart, 6);
    if (r() < 0.12) continue; // the occasional missed check-in

    const stress = Math.round(4 + jitter(r, 2.4));
    const scores: CheckInScores = {
      fatigue: clamp(Math.round(5 + jitter(r, 2) - offset * 0.06)),
      sleep: clamp(Math.round(7 + jitter(r, 1.8))),
      soreness: clamp(Math.round(4 + jitter(r, 2.2))),
      stress: clamp(stress),
      motivation: clamp(Math.round(8 + jitter(r, 1.6))),
      confidence: clamp(Math.round(7 + jitter(r, 1.7))),
      trainingDifficulty: clamp(Math.round(6 + jitter(r, 1.6))),
    };

    const weekSessions = scheduled.filter((s) => s.date >= weekStart && s.date <= weekEnd);
    const done = weekSessions.filter((s) => s.status === 'completed').length;

    const texts = {
      wentWell:
        offset === -1
          ? 'Long run felt controlled the whole way. First time the last 5K did not fall apart.'
          : 'Held the easy days genuinely easy.',
      feltDifficult:
        scores.fatigue >= 7
          ? 'Thursday recovery run felt harder than it should have.'
          : 'Threshold session took more out of me than expected.',
      painOrNiggles:
        scores.soreness >= 7 ? 'Left calf tight after the long run. Eased off by Monday.' : 'Nothing to report.',
      affectingTraining: stress >= 7 ? 'Busy stretch at work, sleep has been shorter.' : 'Normal week.',
      confidenceNextWeek: 'Good. Ready for the step up.',
      forCoach: offset === -1 ? 'Happy to add another long run block if you think it fits.' : '',
    };

    const triage = triageCheckIn({
      scores,
      freeText: Object.values(texts),
      sessionsCompleted: done,
      sessionsPrescribed: weekSessions.length,
      history: checkins.length ? [{ scores: checkins[checkins.length - 1].scores }] : [],
    });

    checkins.push({
      id: `ci-${weekStart}`,
      athleteId: DEMO_ATHLETE_ID,
      weekStart,
      scores,
      ...texts,
      attentionLevel: triage.level,
      attentionReasons: triage.reasons,
      reviewedByCoachAt: offset < -1 ? `${addDays(weekEnd, 1)}T09:00:00.000Z` : null,
      coachResponse:
        offset === -2
          ? 'Good week. We hold volume where it is for one more block, then step up.'
          : null,
      submittedAt: `${weekEnd}T19:20:00.000Z`,
    });

    forgeEvents.push({
      id: `fe-ci-${weekStart}`,
      athleteId: DEMO_ATHLETE_ID,
      kind: 'checkin_completed',
      points: FORGE_POINTS.checkin_completed,
      date: weekEnd,
      label: 'Weekly check-in',
      sourceId: null,
    });
  }

  /* coaching comms */
  const coachNotes: CoachNote[] = [
    {
      id: 'cn-1',
      athleteId: DEMO_ATHLETE_ID,
      coachId: DEMO_COACH_ID,
      body: 'Responds well to volume, poorly to back-to-back quality. Keep threshold to once a week through the build.',
      visibility: 'private',
      createdAt: `${addDays(today, -34)}T11:00:00.000Z`,
    },
    {
      id: 'cn-2',
      athleteId: DEMO_ATHLETE_ID,
      coachId: DEMO_COACH_ID,
      body: 'Left calf has flagged twice in check-ins after long runs. Soleus work is non-negotiable in Foundation B.',
      visibility: 'shared',
      createdAt: `${addDays(today, -12)}T09:30:00.000Z`,
    },
  ];

  const messages: Message[] = [
    {
      id: 'msg-1',
      threadId: 'thread-andrew',
      senderId: DEMO_COACH_ID,
      recipientId: DEMO_ATHLETE_ID,
      body: 'Saw the 22K on Sunday. Pace held from start to finish — that is the first time this block. Keep Monday genuinely easy.',
      authorKind: 'human',
      readAt: `${addDays(today, -6)}T20:00:00.000Z`,
      createdAt: `${addDays(today, -6)}T18:12:00.000Z`,
    },
    {
      id: 'msg-2',
      threadId: 'thread-andrew',
      senderId: DEMO_ATHLETE_ID,
      recipientId: DEMO_COACH_ID,
      body: 'Felt strong. Calf was quiet the whole way for once. Fuelling every 35 min worked.',
      authorKind: 'human',
      readAt: `${addDays(today, -6)}T19:00:00.000Z`,
      createdAt: `${addDays(today, -6)}T18:40:00.000Z`,
    },
    {
      id: 'msg-3',
      threadId: 'thread-andrew',
      senderId: DEMO_COACH_ID,
      recipientId: DEMO_ATHLETE_ID,
      body: 'Good. We hold this volume one more week, then the long run goes to 26K. Nothing heroic before then.',
      authorKind: 'human',
      readAt: null,
      createdAt: `${addDays(today, -2)}T08:05:00.000Z`,
    },
  ];

  /* community */
  const nextSaturday = addDays(currentWeek, 5);
  const communityEvents: CommunityEvent[] = [
    {
      id: 'ce-saturday',
      title: 'Iron Miles Saturday Run',
      kind: 'club_run',
      startsAt: `${nextSaturday}T08:00:00.000Z`,
      location: 'University of Limerick, Living Bridge',
      description: 'The standing Saturday session. Every pace covered, nobody left behind. Coffee after.',
      capacity: null,
      attendingCount: 34,
      attending: false,
    },
    {
      id: 'ce-hills',
      title: 'Hill Session — Clare Glens',
      kind: 'session',
      startsAt: `${addDays(currentWeek, 9)}T18:30:00.000Z`,
      location: 'Clare Glens car park',
      description: 'Six by four minutes uphill. Head torches from October.',
      capacity: 24,
      attendingCount: 19,
      attending: false,
    },
    {
      id: 'ce-volunteer',
      title: 'Volunteer — Great Limerick Run water station',
      kind: 'volunteer',
      startsAt: `${addDays(today, 74)}T07:30:00.000Z`,
      location: 'Kilometre 14, Ennis Road',
      description: 'Six volunteers needed. Counts toward your Forge Score.',
      capacity: 6,
      attendingCount: 4,
      attending: false,
    },
  ];

  const communityPosts: CommunityPost[] = [
    {
      id: 'cp-1',
      authorId: DEMO_COACH_ID,
      authorName: 'R. Doyle',
      kind: 'announcement',
      body: 'Saturday moves to 8am from this week. Same bridge, one hour earlier — the long-run crew asked and the long-run crew wins.',
      createdAt: `${addDays(today, -3)}T17:00:00.000Z`,
      reactions: { forge: 18, strong: 6 },
    },
    {
      id: 'cp-2',
      authorId: 'demo-athlete-4',
      authorName: 'Sinead M.',
      kind: 'milestone',
      body: 'First half marathon done in 1:58. Eighteen months ago I could not run to the end of my road.',
      createdAt: `${addDays(today, -5)}T12:20:00.000Z`,
      reactions: { forge: 41, strong: 22 },
    },
    {
      id: 'cp-3',
      authorId: DEMO_COACH_ID,
      authorName: 'R. Doyle',
      kind: 'shoutout',
      body: 'Padraig has not missed a prescribed session in eleven weeks. That is the whole game.',
      createdAt: `${addDays(today, -8)}T09:00:00.000Z`,
      reactions: { forge: 27, strong: 9 },
    },
  ];

  const achievements: Achievement[] = [
    {
      id: 'ach-1',
      athleteId: DEMO_ATHLETE_ID,
      code: 'first_marathon',
      title: 'First Marathon',
      description: 'Dublin Marathon — 3:41:22',
      earnedAt: `${addDays(today, -298)}T13:41:00.000Z`,
    },
    {
      id: 'ach-2',
      athleteId: DEMO_ATHLETE_ID,
      code: 'longest_run',
      title: 'Longest Run',
      description: 'First time past 30K in a single session',
      earnedAt: `${addDays(today, -66)}T11:02:00.000Z`,
    },
    {
      id: 'ach-3',
      athleteId: DEMO_ATHLETE_ID,
      code: 'ten_week_streak',
      title: 'Ten Weeks Forged',
      description: 'Ten consecutive weeks with every prescribed run completed',
      earnedAt: `${addDays(today, -21)}T20:00:00.000Z`,
    },
  ];

  /* other club members' forge ledgers, for a leaderboard with real shape */
  for (const m of CLUB_MEMBERS.slice(1)) {
    const mr = rng(`${m.id}-${today}`);
    for (let d = -84; d < 0; d++) {
      const date = addDays(today, d);
      if (mr() > m.bias * 0.72) continue;
      const kind = mr() > 0.78 ? ('strength_completed' as const) : ('run_completed' as const);
      forgeEvents.push({
        id: `fe-${m.id}-${date}`,
        athleteId: m.id,
        kind,
        points: FORGE_POINTS[kind],
        date,
        label: kind === 'strength_completed' ? 'Strength session' : 'Prescribed run',
        sourceId: null,
      });
    }
  }

  const subscriptions: Subscription[] = [
    {
      id: 'sub-andrew',
      athleteId: DEMO_ATHLETE_ID,
      packageCode: 'event_ready',
      status: 'active',
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      currentPeriodEnd: `${addDays(today, 19)}T00:00:00.000Z`,
      cancelAtPeriodEnd: false,
      priceCents: 12900,
      currency: 'eur',
    },
  ];

  const integrations: Integration[] = (
    ['strava', 'garmin', 'coros', 'apple_health', 'google_fit'] as const
  ).map((provider) => ({
    id: `int-${provider}`,
    athleteId: DEMO_ATHLETE_ID,
    provider,
    status: 'coming_soon' as const,
    connectedAt: null,
    lastSyncAt: null,
  }));

  const notifications: Notification[] = [
    {
      id: 'nt-1',
      userId: DEMO_ATHLETE_ID,
      kind: 'coach_message',
      title: 'New message from your coach',
      body: 'We hold this volume one more week, then the long run goes to 26K.',
      href: '/app/coach',
      readAt: null,
      createdAt: `${addDays(today, -2)}T08:05:00.000Z`,
    },
    {
      id: 'nt-2',
      userId: DEMO_ATHLETE_ID,
      kind: 'checkin_due',
      title: 'Weekly check-in is open',
      body: 'Seven scores and six questions. Two minutes.',
      href: '/app/check-in',
      readAt: null,
      createdAt: `${nowISO}`,
    },
  ];

  return {
    profiles,
    links,
    races,
    goals,
    programs,
    scheduled,
    completed,
    strengthSessions,
    checkins,
    coachNotes,
    messages,
    forgeEvents,
    achievements,
    communityEvents,
    communityPosts,
    subscriptions,
    integrations,
    notifications,
  };
}

function clamp(n: number): number {
  return Math.max(1, Math.min(10, n));
}

export const CLUB_MEMBER_META = CLUB_MEMBERS;

/** Weekday index helper re-exported so demo consumers do not import twice. */
export { weekdayIndex };
