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
 * Which concern a coach should meet first when two signals are equally severe.
 *
 * Severity still decides: this only breaks ties. It exists because severity
 * alone let an ending programme sit above a flagged check-in — both are
 * `attention`, and the classifier happened to push the programme first, so
 * the athlete whose Achilles hurts was listed under an administrative note
 * about a renewal date. Ordering by the order the code was written in is not
 * a clinical judgement.
 *
 * The rule is readable in one line: what the athlete's body is telling us,
 * then what they told us, then whether they are training at all, then what is
 * coming, then paperwork.
 */
const SIGNAL_CONCERN: Record<SignalKind, number> = {
  soreness_reported: 0,
  checkin_flagged: 1,
  // Someone is sitting there waiting for a human to answer them. That is not
  // urgent the way an injury is, but it outranks anything about a schedule:
  // the athlete is already aware of it and already waiting.
  awaiting_reply: 2,
  no_future_sessions: 3,
  no_programme: 4,
  not_training: 5,
  missed_repeated: 6,
  missed_key_session: 7,
  race_approaching: 8,
  programme_ending: 9,
  checkin_unreviewed: 10,
};

/** Severity first, then the concern order. Nothing else. */
export function compareSignals(a: Signal, b: Signal): number {
  return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]
    || SIGNAL_CONCERN[a.kind] - SIGNAL_CONCERN[b.kind];
}

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
  | 'awaiting_reply';

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
    /** So an action on a check-in does not need a second lookup to find it. */
    id: UUID;
    weekStart: ISODate;
    submittedAt: ISOTimestamp;
    attention: 'none' | 'watch' | 'attention';
    reasons: string[];
    /** A coach marked it read. Clears the "to read" signal, nothing else. */
    acknowledgedAt: ISOTimestamp | null;
    /** A coach wrote back. This is what settles a flagged check-in. */
    respondedAt: ISOTimestamp | null;
    fatigue: number | null;
    soreness: number | null;
    painOrNiggles: string | null;
  } | null;

  raceId: UUID | null;
  raceName: string | null;
  raceDate: ISODate | null;
  /** What they are training for, whether or not a race is booked. */
  eventType: string | null;

  /**
   * The conversation with this coach, as it actually stands.
   *
   * Waiting is not unread. `unreadFromAthlete` counts messages nobody has
   * opened, and on the coach's side nothing has ever set `read_at` — so it
   * counted every message the athlete had ever sent, for ever, and a coach
   * who answered still saw "1 unread message" on the roster the next morning.
   *
   * Who is waiting is a fact about the conversation, not about a flag: the
   * athlete is waiting when the last human message in the thread is theirs.
   * These three fields carry that, derived in the roster query.
   */
  conversation: {
    /**
     * When the athlete started waiting — the first message they sent after
     * the coach last spoke, not the most recent one. Someone who wrote three
     * times yesterday has been waiting since yesterday, not since the last
     * of the three.
     */
    waitingSince: ISOTimestamp;
    /** Messages in that unanswered run. One conversation, not three items. */
    unanswered: number;
    /** What they said, so the coach knows what they are answering. */
    latest: string;
  } | null;

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
export function classify(
  facts: RosterFacts,
  today: ISODate,
  /** Only a waiting reply needs the clock rather than the calendar. */
  now: ISOTimestamp = new Date().toISOString(),
): Signal[] {
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
    // A flagged check-in is settled by answering it, not by reading it.
    // Reading "my Achilles is sore" has not made the Achilles better, and a
    // product that clears the signal on a click is one that loses injuries.
    if (c.attention === 'attention' && !c.respondedAt) {
      signals.push({
        kind: 'checkin_flagged',
        severity: 'attention',
        detail: c.reasons.length
          ? `Check-in flagged: ${c.reasons.join(', ')}.`
          : 'Check-in flagged for review.',
        href: `${athlete}#checkins`,
      });
    } else if (!c.acknowledgedAt) {
      // purely a communication state: has anyone looked at this yet
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

  if (facts.conversation) {
    // Constant severity, deliberately. Something that has waited four days is
    // older, not more dangerous, and letting age climb a severity ladder would
    // rank a question about parking above a reported injury.
    const { waitingSince, unanswered } = facts.conversation;
    signals.push({
      kind: 'awaiting_reply',
      severity: 'attention',
      detail: unanswered > 1
        ? `Waiting for a reply · ${waitedFor(waitingSince, now)} · ${unanswered} messages`
        : `Waiting for a reply · ${waitedFor(waitingSince, now)}`,
      // to the athlete, where their words and the box to answer them are —
      // not to a list of everybody
      href: `${athlete}#messages`,
    });
  }

  return signals.sort(compareSignals);
}

/** Facts plus what they mean, ready for the screen. */
export function buildEntry(
  facts: RosterFacts,
  today: ISODate,
  now: ISOTimestamp = new Date().toISOString(),
): RosterEntry {
  const signals = classify(facts, today, now);
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
  // An athlete's place in the list is decided by the same rule that decides
  // the order of their own signals, so the roster and the row agree.
  const rank = (a: RosterEntry, b: RosterEntry) => {
    if (!a.topSignal && !b.topSignal) return 0;
    if (!a.topSignal) return 1;
    if (!b.topSignal) return -1;
    return compareSignals(a.topSignal, b.topSignal);
  };
  return [...entries].sort((a, b) =>
    rank(a, b) ||
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
  | 'no_training'
  | 'pain'
  | 'waiting';

export const FILTER_LABELS: Record<RosterFilter, string> = {
  attention: 'Needs attention',
  all: 'Everyone',
  checkins: 'Check-ins to read',
  missed: 'Missed training',
  ending: 'Programme ending',
  races: 'Race approaching',
  no_training: 'Nothing scheduled',
  pain: 'Pain or soreness',
  waiting: 'Waiting for a reply',
};

const FILTER_KINDS: Partial<Record<RosterFilter, SignalKind[]>> = {
  checkins: ['checkin_flagged', 'checkin_unreviewed'],
  missed: ['missed_repeated', 'missed_key_session', 'not_training'],
  ending: ['programme_ending'],
  races: ['race_approaching'],
  no_training: ['no_programme', 'no_future_sessions'],
  pain: ['soreness_reported'],
  waiting: ['awaiting_reply'],
};

/**
 * How long someone has been waiting, in the words a coach would use.
 *
 * Age is information, not priority. This never changes a severity and never
 * feeds a score: a message four days old is not a clinical concern, it is a
 * discourtesy, and the two are not the same thing. The coach reads the number
 * and decides.
 */
export function waitedFor(since: ISOTimestamp, now: ISOTimestamp): string {
  const mins = Math.max(0, Math.round((Date.parse(now) - Date.parse(since)) / 60000));
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 48) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

/** Which signals answer a given filter. One definition, asked by name. */
export function kindsForFilter(filter: RosterFilter): SignalKind[] {
  return FILTER_KINDS[filter] ?? [];
}

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
    checkInsToRead: entries.filter((e) => e.checkIn && !e.checkIn.acknowledgedAt).length,
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
 * The squad's workload, by the thing that needs doing.
 *
 * The previous model made a coach choose between two half-truths. It grouped
 * an athlete only when a single signal was their entire story, and then
 * *removed* them from the list — so at forty athletes the roster showed no
 * groups at all and twenty-one individual rows, because twelve of those
 * twenty-one had more than one thing going on. The view degraded exactly when
 * the week got hard, which is the only time it matters.
 *
 * So grouping no longer competes with the list. A workload row is a count of
 * everyone who carries that concern, whatever else they carry; the roster
 * below still shows each athlete once, with their whole story. Sarah, who has
 * missed training and has a programme ending and flagged her check-in, is
 * counted in all three rows and listed once. No count is deflated to keep her
 * from appearing twice, and she is never filed under one problem and hidden
 * from the others.
 *
 * The counts are the filter counts — the same `applyFilter` a coach gets when
 * they tap the row — so the number on the row and the list it opens cannot
 * disagree.
 */
export const WORKLOAD_KINDS = [
  'pain',
  'waiting',
  'checkins',
  'no_training',
  'missed',
  'races',
  'ending',
] as const satisfies readonly RosterFilter[];

export type WorkloadKind = (typeof WORKLOAD_KINDS)[number];

export interface WorkloadRow {
  kind: WorkloadKind;
  /** The chip a coach already knows this concern by. */
  label: string;
  /** The worst severity actually present, not a severity declared up front. */
  severity: Severity;
  detail: string;
  /** Everyone carrying this concern. Never reduced to avoid double-counting. */
  athleteIds: UUID[];
  count: number;
  /** How many of them the coach also needs for something else. */
  alsoElsewhere: number;
  href: string;
}

const WORKLOAD_DETAIL: Record<WorkloadKind, (n: number) => string> = {
  pain: (n) => `${plural(n, 'athlete')} reported pain or soreness.`,
  waiting: (n) => `${plural(n, 'athlete')} waiting for a reply.`,
  checkins: (n) => `${plural(n, 'check-in')} to answer or read.`,
  no_training: (n) => `${plural(n, 'athlete')} with nothing scheduled.`,
  missed: (n) => `${plural(n, 'athlete')} missing training.`,
  races: (n) => `${plural(n, 'athlete')} with a race coming up.`,
  ending: (n) => `${n === 1 ? '1 programme ends' : `${n} programmes end`} within the month.`,
};

/** A group is worth stating once several athletes share it. */
export const GROUP_THRESHOLD = 3;

export function rosterWorkload(
  entries: RosterEntry[],
  { threshold = GROUP_THRESHOLD }: { threshold?: number } = {},
): WorkloadRow[] {
  const members = new Map<WorkloadKind, RosterEntry[]>(
    WORKLOAD_KINDS.map((kind) => [kind, applyFilter(entries, kind)]),
  );

  // how many concerns each athlete carries, counted once across the whole
  // board so "also needs you elsewhere" is a fact and not an estimate
  const carried = new Map<UUID, number>();
  for (const group of members.values()) {
    for (const e of group) carried.set(e.athleteId, (carried.get(e.athleteId) ?? 0) + 1);
  }

  const rows: WorkloadRow[] = [];
  for (const kind of WORKLOAD_KINDS) {
    const group = members.get(kind)!;
    if (group.length < threshold) continue;

    const kinds = FILTER_KINDS[kind] ?? [];
    const matching = group.flatMap((e) => e.signals.filter((s) => kinds.includes(s.kind)));
    const severity = matching
      .map((s) => s.severity)
      .reduce<Severity>((worst, s) => (SEVERITY_RANK[s] < SEVERITY_RANK[worst] ? s : worst), 'information');

    rows.push({
      kind,
      label: FILTER_LABELS[kind],
      severity,
      detail: WORKLOAD_DETAIL[kind](group.length),
      athleteIds: group.map((e) => e.athleteId),
      count: group.length,
      alsoElsewhere: group.filter((e) => (carried.get(e.athleteId) ?? 0) > 1).length,
      href: `/coach?filter=${kind}`,
    });
  }

  // WORKLOAD_KINDS is already in concern order; severity may still promote a
  // row above it, the same way it does for one athlete's own signals.
  return rows.sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity]);
}

/**
 * Which operational concerns this one athlete belongs to.
 *
 * The same membership the workload rows count, asked one athlete at a time —
 * so a row can never claim someone the athlete's own card does not show, and
 * the card can never show a concern the row failed to count.
 */
/**
 * A filter named in a URL, or the default.
 *
 * A deep link from a digest lands on a concern. It cannot do anything else:
 * the roster it narrows was already fetched for this coach and nobody else,
 * so an unrecognised or hand-crafted value can only ever show the coach fewer
 * of their own athletes.
 */
export function parseFilter(value: string | string[] | undefined): RosterFilter {
  const one = Array.isArray(value) ? value[0] : value;
  return one && one in FILTER_LABELS ? (one as RosterFilter) : 'attention';
}

export function concernsFor(
  entry: RosterEntry,
  { raisedOnly = false }: { raisedOnly?: boolean } = {},
): WorkloadKind[] {
  const signals = raisedOnly
    ? entry.signals.filter((s) => s.severity !== 'information')
    : entry.signals;
  return WORKLOAD_KINDS.filter((kind) =>
    signals.some((s) => (FILTER_KINDS[kind] ?? []).includes(s.kind)));
}

/**
 * Everyone who needs the coach, each appearing once, ranked.
 *
 * Deliberately not filtered by what the workload rows already state: a
 * grouped concern is a count, not a filing cabinet, and an athlete is never
 * removed from the roster because one of their problems was totalled above.
 */
export function attentionRoster(entries: RosterEntry[]): RosterEntry[] {
  return rankEntries(applyFilter(entries, 'attention'));
}

/**
 * The one-line reason this athlete is on the list, and how much else is true
 * of them. Used where there is room for a row but not for every signal.
 */
export function entrySummary(entry: RosterEntry): { lead: Signal | null; more: number } {
  const raised = entry.signals.filter((s) => s.severity !== 'information');
  const shown = raised.length ? raised : entry.signals;
  return { lead: shown[0] ?? null, more: Math.max(0, entry.signals.length - 1) };
}
