import { daysBetween } from './dates';
import type { ISODate, ISOTimestamp, UUID } from './types';

/**
 * THE ROSTER OPERATING VIEW
 *
 * A coach with forty athletes should not open forty pages to find the three
 * that need them. This turns facts about each athlete into signals that say
 * what is going on and why, in the coach's own words.
 *
 * The rule that shapes everything here: Iron Miles surfaces signals, the coach
 * interprets them. There is no readiness score, no risk number, nothing that
 * claims to understand an athlete better than the person coaching them. Every
 * signal states the fact it came from, so a coach never has to reverse-engineer
 * why someone appeared.
 */

/**
 * Three levels, and the distinction matters.
 *
 * `urgent`      — training cannot proceed: no programme, or nothing scheduled.
 *                 Structural, not a judgement about the athlete.
 * `attention`   — worth a coach's eyes today.
 * `information` — context, shown but not raised.
 *
 * Normal training variability is never urgent. An athlete who missed one
 * session had a Tuesday, not a crisis.
 */
export type Severity = 'urgent' | 'attention' | 'information';

const SEVERITY_RANK: Record<Severity, number> = { urgent: 0, attention: 1, information: 2 };

/**
 * The soreness score, out of ten, at which a written niggle stops being a
 * note and starts being something to look at. The athlete sets it themselves
 * on the check-in; this is not an assessment of them.
 */
const SORENESS_RAISES = 7;

export type SignalKind =
  | 'no_programme'
  | 'no_future_sessions'
  | 'programme_ending'
  | 'checkin_flagged'
  | 'checkin_unreviewed'
  | 'soreness_reported'
  | 'missed_repeated'
  | 'missed_key_session'
  | 'not_training'
  | 'race_approaching'
  | 'unread_message';

export interface Signal {
  kind: SignalKind;
  severity: Severity;
  /** The fact, as a coach would say it. Never a score. */
  detail: string;
  /** Where the coach goes to act on it. Never a dead end. */
  href: string;
}

/**
 * What the database knows about one athlete, before anything is judged.
 *
 * Both adapters produce this shape and hand it to the same classifier, so the
 * roster cannot mean two different things in two different places.
 */
export interface RosterFacts {
  athleteId: UUID;
  fullName: string;
  avatarUrl: string | null;

  /** When this athlete joined this coach. A new athlete has no programme yet. */
  joinedAt: ISOTimestamp | null;

  programmeId: UUID | null;
  programmeName: string | null;
  programmeEndDate: ISODate | null;
  blockName: string | null;
  phase: string | null;
  weekNo: number | null;
  totalWeeks: number | null;

  /**
   * Adherence over the *current* prescription.
   *
   * A session a coach moved moves with it, so adapting a programme never
   * shows up as an athlete failing to follow it.
   */
  plannedThisWeek: number;
  completedThisWeek: number;
  plannedFourWeeks: number;
  completedFourWeeks: number;

  missedFourteenDays: number;
  missedKeySession: { name: string; date: ISODate } | null;

  lastCompletedDate: ISODate | null;
  lastCompletedName: string | null;
  nextSessionDate: ISODate | null;
  nextSessionName: string | null;
  futureSessions: number;

  checkIn: {
    weekStart: ISODate;
    submittedAt: ISOTimestamp;
    attention: 'none' | 'watch' | 'attention';
    reasons: string[];
    reviewedAt: ISOTimestamp | null;
    fatigue: number | null;
    soreness: number | null;
    painOrNiggles: string | null;
  } | null;

  raceId: UUID | null;
  raceName: string | null;
  raceDate: ISODate | null;
  /** What they are training for, whether or not a race is booked. */
  eventType: string | null;

  unreadFromAthlete: number;
  /** Changes this coach made to their programme in the last week. */
  recentAdaptations: number;
}

/** One athlete as the roster shows them. */
export interface RosterEntry extends RosterFacts {
  signals: Signal[];
  /** The loudest signal, or null when nothing needs saying. */
  topSignal: Signal | null;
  adherencePct: number | null;
  daysToRace: number | null;
  daysSinceTraining: number | null;
}

/** Sessions where missing one is worth a coach knowing about. */
export const KEY_SESSION_TYPES = new Set([
  'long_run', 'threshold', 'intervals', 'race_pace', 'hills', 'tempo', 'brick', 'race',
]);

const pct = (done: number, planned: number) => (planned ? Math.round((done / planned) * 100) : null);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

/**
 * Turn facts into signals.
 *
 * Every rule here is a sentence a coach would say out loud, and every
 * threshold is a plain number rather than a weighting. If a coach disagrees
 * with a threshold they can read it in one line.
 */
export function classify(facts: RosterFacts, today: ISODate): Signal[] {
  const signals: Signal[] = [];
  const athlete = `/coach/athletes/${facts.athleteId}`;

  /* ---- structural: training cannot proceed ---- */

  if (!facts.programmeId) {
    // An athlete who joined this week has no programme because they just
    // arrived. That is onboarding, not a broken state — and a signal that
    // fires for every new athlete stops being a signal at all.
    const sinceJoining = facts.joinedAt
      ? daysBetween(facts.joinedAt.slice(0, 10) as ISODate, today)
      : null;
    const settlingIn = sinceJoining != null && sinceJoining <= 7;

    signals.push({
      kind: 'no_programme',
      severity: settlingIn ? 'information' : 'attention',
      detail: settlingIn
        ? `Joined ${sinceJoining === 0 ? 'today' : `${plural(sinceJoining, 'day')} ago`}, no programme yet.`
        : 'No programme assigned.',
      href: '/coach/programs',
    });
  } else if (facts.futureSessions === 0) {
    signals.push({
      kind: 'no_future_sessions',
      // this one is genuinely broken: they are on a programme and it has run
      // out from under them
      severity: 'urgent',
      detail: 'On a programme with nothing scheduled from today.',
      href: '/coach/programs',
    });
  }

  const daysLeft = facts.programmeEndDate ? daysBetween(today, facts.programmeEndDate) : null;
  if (facts.programmeId && daysLeft != null && daysLeft >= 0 && daysLeft <= 28) {
    signals.push({
      kind: 'programme_ending',
      severity: daysLeft <= 14 ? 'attention' : 'information',
      detail: daysLeft === 0 ? 'Programme ends today.' : `Programme ends in ${plural(daysLeft, 'day')}.`,
      href: '/coach/programs',
    });
  }

  /* ---- what the athlete told them ---- */

  if (facts.checkIn) {
    const c = facts.checkIn;
    if (c.attention === 'attention' && !c.reviewedAt) {
      signals.push({
        kind: 'checkin_flagged',
        severity: 'attention',
        detail: c.reasons.length
          ? `Check-in flagged: ${c.reasons.join(', ')}.`
          : 'Check-in flagged for review.',
        href: `${athlete}#checkins`,
      });
    } else if (!c.reviewedAt) {
      signals.push({
        kind: 'checkin_unreviewed',
        severity: 'information',
        detail: 'Check-in submitted, not yet reviewed.',
        href: `${athlete}#checkins`,
      });
    }

    if (c.painOrNiggles) {
      // Severity comes from the athlete's own soreness score, not from
      // whether they typed anything. An athlete who writes "nothing to
      // report" in the niggles box was raising a signal that read
      // "Reported: Nothing to report." — and once this fed notifications it
      // would have woken a coach at midnight to tell them nobody was hurt.
      //
      // Their words are still carried through exactly as written. Nothing
      // here reads them, and nothing here decides what they mean.
      signals.push({
        kind: 'soreness_reported',
        severity: (c.soreness ?? 0) >= SORENESS_RAISES ? 'attention' : 'information',
        detail: `Reported: ${c.painOrNiggles}`,
        href: `${athlete}#checkins`,
      });
    }
  }

  /* ---- what they actually did ---- */

  if (facts.missedFourteenDays >= 3) {
    signals.push({
      kind: 'missed_repeated',
      severity: 'attention',
      detail: `${plural(facts.missedFourteenDays, 'session')} missed in the last two weeks.`,
      href: athlete,
    });
  }

  if (facts.missedKeySession) {
    signals.push({
      kind: 'missed_key_session',
      severity: 'attention',
      detail: `Missed ${facts.missedKeySession.name}.`,
      href: athlete,
    });
  }

  const idle = facts.lastCompletedDate ? daysBetween(facts.lastCompletedDate, today) : null;
  if (facts.programmeId && facts.plannedFourWeeks > 0 && (idle == null || idle >= 10)) {
    signals.push({
      kind: 'not_training',
      severity: 'attention',
      detail: idle == null
        ? 'Nothing logged yet, with sessions prescribed.'
        : `Nothing logged in ${plural(idle, 'day')}.`,
      href: athlete,
    });
  }

  /* ---- what is coming ---- */

  const daysToRace = facts.raceDate ? daysBetween(today, facts.raceDate) : null;
  if (daysToRace != null && daysToRace >= 0 && daysToRace <= 42) {
    signals.push({
      kind: 'race_approaching',
      severity: daysToRace <= 14 ? 'attention' : 'information',
      detail: daysToRace === 0
        ? `${facts.raceName ?? 'Race'} is today.`
        : `${facts.raceName ?? 'Race'} in ${plural(daysToRace, 'day')}.`,
      href: athlete,
    });
  }

  if (facts.unreadFromAthlete > 0) {
    signals.push({
      kind: 'unread_message',
      severity: 'attention',
      detail: `${plural(facts.unreadFromAthlete, 'unread message')}.`,
      href: '/coach/messages',
    });
  }

  return signals.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/** Facts plus what they mean, ready for the screen. */
export function buildEntry(facts: RosterFacts, today: ISODate): RosterEntry {
  const signals = classify(facts, today);
  return {
    ...facts,
    signals,
    topSignal: signals[0] ?? null,
    adherencePct: pct(facts.completedFourWeeks, facts.plannedFourWeeks),
    daysToRace: facts.raceDate ? daysBetween(today, facts.raceDate) : null,
    daysSinceTraining: facts.lastCompletedDate ? daysBetween(facts.lastCompletedDate, today) : null,
  };
}

/**
 * Who to look at first.
 *
 * Deterministic and explainable in one sentence: the loudest signal wins, then
 * the athlete carrying more of them, then alphabetically so the order never
 * shifts on its own between two people in the same state.
 */
export function rankEntries(entries: RosterEntry[]): RosterEntry[] {
  const worst = (e: RosterEntry) => (e.topSignal ? SEVERITY_RANK[e.topSignal.severity] : 99);
  return [...entries].sort((a, b) =>
    worst(a) - worst(b) ||
    b.signals.length - a.signals.length ||
    a.fullName.localeCompare(b.fullName));
}

/** The filters a coach reaches for daily. Deliberately few. */
export type RosterFilter =
  | 'attention'
  | 'all'
  | 'checkins'
  | 'missed'
  | 'ending'
  | 'races'
  | 'no_training';

export const FILTER_LABELS: Record<RosterFilter, string> = {
  attention: 'Needs attention',
  all: 'Everyone',
  checkins: 'Check-ins to read',
  missed: 'Missed training',
  ending: 'Programme ending',
  races: 'Race approaching',
  no_training: 'Nothing scheduled',
};

const FILTER_KINDS: Partial<Record<RosterFilter, SignalKind[]>> = {
  checkins: ['checkin_flagged', 'checkin_unreviewed'],
  missed: ['missed_repeated', 'missed_key_session', 'not_training'],
  ending: ['programme_ending'],
  races: ['race_approaching'],
  no_training: ['no_programme', 'no_future_sessions'],
};

export function applyFilter(entries: RosterEntry[], filter: RosterFilter, search = ''): RosterEntry[] {
  const term = search.trim().toLowerCase();
  const matches = (e: RosterEntry) => !term || e.fullName.toLowerCase().includes(term);

  if (filter === 'all') return entries.filter(matches);
  if (filter === 'attention') {
    return entries.filter((e) =>
      matches(e) && e.signals.some((s) => s.severity !== 'information'));
  }

  const kinds = FILTER_KINDS[filter] ?? [];
  return entries.filter((e) => matches(e) && e.signals.some((s) => kinds.includes(s.kind)));
}

/** The counts on the filter chips, so a coach sees the shape before choosing. */
export function filterCounts(entries: RosterEntry[]): Record<RosterFilter, number> {
  const counts = {} as Record<RosterFilter, number>;
  for (const filter of Object.keys(FILTER_LABELS) as RosterFilter[]) {
    counts[filter] = applyFilter(entries, filter).length;
  }
  return counts;
}

/** Today and the week ahead, from the roster the coach already has. */
export interface RosterToday {
  trainingToday: number;
  keySessionsToday: { athleteId: UUID; athleteName: string; sessionName: string }[];
  checkInsToRead: number;
  racesWithin: { athleteId: UUID; athleteName: string; raceName: string; days: number }[];
  programmesEnding: number;
}

export function summariseToday(entries: RosterEntry[], today: ISODate): RosterToday {
  return {
    trainingToday: entries.filter((e) => e.nextSessionDate === today).length,
    keySessionsToday: entries
      .filter((e) => e.nextSessionDate === today && e.nextSessionName)
      .map((e) => ({ athleteId: e.athleteId, athleteName: e.fullName, sessionName: e.nextSessionName! })),
    checkInsToRead: entries.filter((e) => e.checkIn && !e.checkIn.reviewedAt).length,
    racesWithin: entries
      .filter((e) => e.daysToRace != null && e.daysToRace >= 0 && e.daysToRace <= 42)
      .map((e) => ({
        athleteId: e.athleteId,
        athleteName: e.fullName,
        raceName: e.raceName ?? 'Race',
        days: e.daysToRace!,
      }))
      .sort((a, b) => a.days - b.days),
    programmesEnding: entries.filter((e) => e.signals.some((s) => s.kind === 'programme_ending')).length,
  };
}

/**
 * When many athletes share one problem, that is one fact about the squad —
 * not twenty rows a coach has to scroll past.
 *
 * A backlog of athletes waiting on a programme is the obvious case: it is real
 * and worth acting on, but listing each one individually buries the athlete
 * whose long run went badly. So a signal that is an athlete's *only* reason for
 * surfacing, and is shared by several of them, collapses into a single line.
 *
 * An athlete with anything else going on is never grouped away.
 */
export const GROUP_THRESHOLD = 3;

export interface RosterGroup {
  kind: SignalKind;
  severity: Severity;
  detail: string;
  href: string;
  entries: RosterEntry[];
}

export interface RosterPartition {
  /** Athletes to read one at a time. */
  individual: RosterEntry[];
  /** Shared problems, stated once. */
  groups: RosterGroup[];
}

const GROUP_DETAIL: Partial<Record<SignalKind, (n: number) => string>> = {
  no_programme: (n) => `${n} athletes are waiting on a programme.`,
  programme_ending: (n) => `${n} programmes end within the month.`,
  race_approaching: (n) => `${n} athletes have a race coming up.`,
};

export function partitionRoster(entries: RosterEntry[]): RosterPartition {
  const raised = (e: RosterEntry) => e.signals.filter((s) => s.severity !== 'information');

  // an athlete is groupable only when one signal is their whole story
  const soleKind = (e: RosterEntry): SignalKind | null => {
    const loud = raised(e);
    return loud.length === 1 && GROUP_DETAIL[loud[0].kind] ? loud[0].kind : null;
  };

  const byKind = new Map<SignalKind, RosterEntry[]>();
  for (const entry of entries) {
    const kind = soleKind(entry);
    if (!kind) continue;
    byKind.set(kind, [...(byKind.get(kind) ?? []), entry]);
  }

  const grouped = new Set<UUID>();
  const groups: RosterGroup[] = [];

  for (const [kind, members] of byKind) {
    if (members.length < GROUP_THRESHOLD) continue;
    const signal = members[0].signals.find((s) => s.kind === kind)!;
    groups.push({
      kind,
      severity: signal.severity,
      detail: GROUP_DETAIL[kind]!(members.length),
      href: signal.href,
      entries: members,
    });
    for (const m of members) grouped.add(m.athleteId);
  }

  return {
    individual: entries.filter((e) => !grouped.has(e.athleteId)),
    groups: groups.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]),
  };
}
