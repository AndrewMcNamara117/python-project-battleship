import { partitionRoster } from './roster';
import type { RosterEntry, Severity, Signal, SignalKind } from './roster';
import type { ISODate, ISOTimestamp, UUID } from './types';

/**
 * SIGNALS, OUTSIDE THE BROWSER
 *
 * The roster decides what needs a coach's attention. This decides which of
 * those things should reach them when they are not looking at it, and how
 * often. It never re-derives a signal — if the roster's definition of "missed
 * repeated" changes, this inherits it, because it only ever reads
 * `RosterEntry.signals`.
 *
 * The governing question for every rule below: if this would not change what
 * the coach does, it should not be sent.
 */

export type NotificationKind = 'digest' | 'alert';

/**
 * The signals urgent enough to interrupt a coach.
 *
 * Deliberately two. A coach who gets twenty urgent alerts a day stops reading
 * them, and then the one that mattered is lost with the rest. Everything else
 * waits for the morning digest.
 */
export const ALERT_SIGNALS = new Set<SignalKind>(['checkin_flagged', 'soreness_reported']);

/** Which preference switches each alert answers to. */
export const ALERT_PREFERENCE: Record<string, 'alertFlaggedCheckIn' | 'alertReportedPain'> = {
  checkin_flagged: 'alertFlaggedCheckIn',
  soreness_reported: 'alertReportedPain',
};

export interface NotificationPreferences {
  userId: UUID;
  digestEnabled: boolean;
  /** Local hour, 0–23, in the coach's own timezone. */
  digestHour: number;
  /** IANA name. Never an offset — offsets are wrong twice a year. */
  timezone: string;
  alertFlaggedCheckIn: boolean;
  alertReportedPain: boolean;
  /** Local hours. Null disables quiet hours entirely. */
  quietFrom: number | null;
  quietUntil: number | null;
  channels: ChannelName[];
}

export const DEFAULT_PREFERENCES: Omit<NotificationPreferences, 'userId'> = {
  digestEnabled: true,
  digestHour: 7,
  timezone: 'Europe/Dublin',
  alertFlaggedCheckIn: true,
  alertReportedPain: true,
  quietFrom: 22,
  quietUntil: 7,
  // Email is on by default, deliberately. The point of an external channel is
  // reaching a coach who is not looking at Iron Miles — and a coach who has to
  // log in to opt into being told is exactly the coach it would never reach.
  // Every switch on this screen is theirs to turn off, and quiet hours are on
  // by default so "by default" never means "at two in the morning".
  channels: ['in_app', 'email'],
};

export type ChannelName = 'in_app' | 'email';

/**
 * `sent` and `delivered` are deliberately different states. A provider
 * accepting a message is a handoff; only a delivery webhook is evidence it
 * reached a mailbox, and a deployment without webhooks stops honestly at
 * `sent` rather than promoting itself.
 */
export type DeliveryStatus =
  | 'pending'
  | 'sent'
  | 'delivered'
  | 'failed'
  | 'failed_permanent'
  | 'unavailable';

/**
 * Structured detail travelling with a notification.
 *
 * It exists because email must not re-read an athlete's words. The in-app card
 * shows `body`, which quotes them; an email renders from this instead, which
 * carries signal *kinds* and never free text. Storing it at creation also
 * means the email says what the digest said — recomposing at delivery time
 * would produce a different digest from the one in the coach's feed.
 */
export interface AlertPayload {
  kind: 'alert';
  athleteName: string;
  signals: SignalKind[];
}

export interface DigestPayload {
  kind: 'digest';
  digest: Digest;
}

export type NotificationPayload = AlertPayload | DigestPayload;

/**
 * What each signal may be called outside a login.
 *
 * Every string here goes into an email. None of them names a body part, a
 * score, or anything an athlete wrote. "Reported a niggle" is the most a
 * subject line or an unauthenticated preview will ever say.
 */
export const EXTERNAL_SIGNAL_LABEL: Record<SignalKind, string> = {
  no_programme: 'waiting on a programme',
  no_future_sessions: 'nothing scheduled ahead',
  programme_ending: 'programme ending soon',
  checkin_flagged: 'check-in flagged for review',
  checkin_unreviewed: 'check-in not yet read',
  soreness_reported: 'reported a niggle',
  missed_repeated: 'missing sessions',
  missed_key_session: 'missed a key session',
  not_training: 'not training',
  race_approaching: 'race approaching',
  unread_message: 'unread message',
};

/**
 * A name for an external channel: first name, last initial.
 *
 * An email subject sitting in a preview pane is read by whoever is near the
 * screen. "Aoife D." is enough for the coach to know who, and less than a full
 * name to anyone else.
 */
export function externalName(fullName: string | null): string {
  if (!fullName) return 'An athlete';
  const [first, ...rest] = fullName.trim().split(/\s+/);
  const last = rest[rest.length - 1];
  return last ? `${first} ${last[0].toUpperCase()}.` : first;
}

/** What one notification says, before any channel gets hold of it. */
export interface NotificationDraft {
  userId: UUID;
  kind: NotificationKind;
  priority: Severity;
  athleteId: UUID | null;
  signalKind: SignalKind | null;
  title: string;
  body: string;
  href: string;
  /**
   * Identity of the *thing being reported*, not of this send.
   *
   * Two alerts with the same key are the same news, so the second is not sent.
   * The key changes when the underlying state genuinely changes — a new
   * check-in week, a different session — which is what makes an alert fire on
   * a transition rather than continuously while a state persists.
   */
  dedupeKey: string;
  /** Held until this moment, for quiet hours. Null sends immediately. */
  deliverAfter: ISOTimestamp | null;
  /** Structured detail for channels that cannot carry the athlete's words. */
  payload: NotificationPayload | null;
  /**
   * Where this one goes: the coach's preference, narrowed to what this
   * deployment can actually attempt. Queueing a delivery that could only ever
   * record itself unavailable is litter, not honesty — the settings screen is
   * where a coach is told a channel is not set up.
   */
  channels: ChannelName[];
}

/* ---------- local time, without lying about offsets ---------- */

/**
 * The coach's own wall clock.
 *
 * Computed through Intl rather than by adding an offset, so it stays correct
 * across daylight saving without the code knowing DST exists.
 */
export function localParts(at: Date, timezone: string): { date: ISODate; hour: number; minute: number } {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false,
    }).formatToParts(at);
  } catch {
    // an unknown timezone is a data problem, not a reason to stop sending
    return localParts(at, 'UTC');
  }

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}` as ISODate,
    // Intl renders midnight as 24 in some locales
    hour: Number(get('hour')) % 24,
    minute: Number(get('minute')),
  };
}

/** Is the coach's local clock inside their quiet hours? Handles wrapping past midnight. */
export function inQuietHours(prefs: NotificationPreferences, at: Date): boolean {
  if (prefs.quietFrom == null || prefs.quietUntil == null) return false;
  if (prefs.quietFrom === prefs.quietUntil) return false;

  const { hour } = localParts(at, prefs.timezone);
  return prefs.quietFrom < prefs.quietUntil
    ? hour >= prefs.quietFrom && hour < prefs.quietUntil
    : hour >= prefs.quietFrom || hour < prefs.quietUntil;
}

/**
 * When a held alert may go out.
 *
 * Nothing genuinely urgent breaks through by default: a coach woken at 3am by
 * a soreness score stops trusting the product, and there is nothing they could
 * do at 3am anyway.
 */
export function releaseAt(prefs: NotificationPreferences, at: Date): ISOTimestamp | null {
  if (!inQuietHours(prefs, at)) return null;

  // walk forward hour by hour to the first minute outside quiet hours; this is
  // DST-safe because every step re-reads the local clock
  const cursor = new Date(at.getTime());
  for (let i = 0; i < 24; i++) {
    cursor.setUTCHours(cursor.getUTCHours() + 1, 0, 0, 0);
    if (!inQuietHours(prefs, cursor)) return cursor.toISOString();
  }
  return null;
}

/** Has the coach's local clock reached their digest hour today? */
export function digestDue(
  prefs: NotificationPreferences,
  at: Date,
  lastDigestLocalDate: ISODate | null,
): boolean {
  if (!prefs.digestEnabled) return false;
  const { date, hour } = localParts(at, prefs.timezone);
  if (hour < prefs.digestHour) return false;
  return lastDigestLocalDate !== date;
}

/* ---------- what gets sent ---------- */

/**
 * A key that identifies the news, not the sending.
 *
 * A flagged check-in is identified by which check-in it is, so the same one
 * cannot be reported twice however many times the job runs. A different
 * check-in the following week is different news.
 */
export function dedupeKeyFor(entry: RosterEntry, signal: Signal): string {
  switch (signal.kind) {
    case 'checkin_flagged':
    case 'soreness_reported':
      return `${signal.kind}:${entry.athleteId}:${entry.checkIn?.weekStart ?? 'none'}`;
    default:
      return `${signal.kind}:${entry.athleteId}:${signal.detail}`;
  }
}

/**
 * Which alerts this roster warrants right now.
 *
 * Reads the roster's signals and nothing else. A signal that is not in
 * ALERT_SIGNALS waits for the digest however loud it is — a programme ending
 * in nine days is worth knowing about tomorrow morning, not tonight.
 */
export function alertsFor(
  roster: RosterEntry[],
  prefs: NotificationPreferences,
  at: Date,
): NotificationDraft[] {
  const held = releaseAt(prefs, at);
  const drafts: NotificationDraft[] = [];

  for (const entry of roster) {
    const raised = entry.signals.filter((signal) => {
      if (!ALERT_SIGNALS.has(signal.kind)) return false;

      // An alert interrupts someone. A signal the roster itself rated
      // 'information' is not worth interrupting anyone for, and a draft whose
      // own priority reads 'information' is a contradiction: it says "urgent
      // enough to push, not urgent enough to matter". Severity is the roster's
      // judgement and this defers to it rather than forming a second one.
      if (signal.severity === 'information') return false;

      const preference = ALERT_PREFERENCE[signal.kind];
      return !preference || prefs[preference];
    });

    if (!raised.length) continue;

    // ONE BUZZ PER ATHLETE.
    //
    // Both alertable signals come from the same weekly check-in, so an athlete
    // who scores their soreness high and writes about it raises two. Sent
    // separately that is the same news twice, and at fifty athletes on a bad
    // Monday it doubled the interruptions for no extra information. The coach
    // is told once, about a person, with everything that person said.
    const lead = raised.reduce((a, b) =>
      RANK[b.severity] < RANK[a.severity] ? b : a);

    drafts.push({
      userId: prefs.userId,
      kind: 'alert',
      priority: lead.severity,
      athleteId: entry.athleteId,
      signalKind: lead.kind,
      title: `${entry.fullName} — ${raised.map((s) => alertTitle(s.kind)).join(', ')}`,
      // the athlete's own words, unedited and undiagnosed
      body: raised.map((s) => s.detail).join(' '),
      href: lead.href,
      dedupeKey: alertKey(entry),
      deliverAfter: held,
      payload: {
        kind: 'alert',
        athleteName: entry.fullName,
        signals: raised.map((s) => s.kind),
      },
      // the coach's stated preference; the job narrows it to what this
      // deployment can actually attempt
      channels: prefs.channels,
    });
  }

  return drafts;
}

const RANK: Record<Severity, number> = { urgent: 0, attention: 1, information: 2 };

/**
 * One key per athlete per check-in.
 *
 * Keyed to the check-in rather than to which signal happened to lead, so
 * turning a preference on or off does not make an already-sent alert look
 * like news again.
 */
function alertKey(entry: RosterEntry): string {
  return `checkin:${entry.athleteId}:${entry.checkIn?.weekStart ?? 'none'}`;
}

function alertTitle(kind: SignalKind): string {
  return kind === 'checkin_flagged' ? 'check-in flagged' : 'reported a niggle';
}

/** One athlete's line in the digest. */
export interface DigestItem {
  athleteId: UUID;
  athleteName: string;
  priority: Severity;
  /** Full sentences, for the notification centre. May quote the athlete. */
  reasons: string[];
  /** The same reasons as kinds, for channels that must not quote anyone. */
  kinds: SignalKind[];
  href: string;
}

export interface Digest {
  localDate: ISODate;
  athletes: number;
  needingAttention: number;
  flaggedCheckIns: number;
  reportedPain: number;
  missedSessions: number;
  programmesEnding: number;
  items: DigestItem[];
  /** Shared problems, said once rather than once per athlete. */
  groups: { kind: SignalKind; detail: string; count: number }[];
}

/**
 * Today's picture, composed from the roster as it is at send time.
 *
 * Athletes with nothing actionable are not in it. A digest that lists everyone
 * is a digest a coach skims and stops opening.
 */
export function composeDigest(roster: RosterEntry[], localDate: ISODate): Digest {
  // The same partition the coach's screen uses. Six athletes waiting on a
  // programme is one job, not six, and a digest that opens "9 of 10 need
  // attention" has told a coach nothing except that the list is long.
  // partitionRoster keeps quiet athletes in `individual` because the coach's
  // screen shows the whole squad. A digest shows only what needs doing, so
  // the actionable filter comes first and the partition groups what is left.
  const actionable = roster.filter((e) => e.signals.some((s) => s.severity !== 'information'));
  const { individual, groups } = partitionRoster(actionable);

  const countWith = (kind: SignalKind) =>
    roster.filter((e) => e.signals.some((s) => s.kind === kind)).length;

  return {
    localDate,
    athletes: roster.length,
    needingAttention: individual.length,
    flaggedCheckIns: countWith('checkin_flagged'),
    reportedPain: roster.filter(
      (e) => e.signals.some((s) => s.kind === 'soreness_reported' && s.severity !== 'information')).length,
    missedSessions: roster.reduce(
      (sum, e) => sum + (e.signals.some((s) => s.kind === 'missed_repeated') ? e.missedFourteenDays : 0), 0),
    programmesEnding: countWith('programme_ending'),
    // already ranked by the roster; the digest keeps that order
    items: individual.map((entry) => ({
      athleteId: entry.athleteId,
      athleteName: entry.fullName,
      priority: entry.topSignal?.severity ?? 'information',
      reasons: entry.signals.filter((s) => s.severity !== 'information').map((s) => s.detail),
      kinds: entry.signals.filter((s) => s.severity !== 'information').map((s) => s.kind),
      href: `/coach/athletes/${entry.athleteId}`,
    })),
    // stated once, in the roster's own words
    groups: groups.map((g) => ({ kind: g.kind, detail: g.detail, count: g.entries.length })),
  };
}

/** The digest as a notification. Returns null when there is nothing to say. */
export function digestDraft(digest: Digest, prefs: NotificationPreferences): NotificationDraft | null {
  if (digest.items.length === 0 && digest.groups.length === 0) return null;

  const lead = [
    digest.items.length
      ? `${digest.items.length} to look at${digest.athletes ? ` of ${digest.athletes}` : ''}`
      : null,
    ...digest.groups.map((g) => g.detail.replace(/\.$/, '')),
    digest.flaggedCheckIns ? `${digest.flaggedCheckIns} flagged check-in${digest.flaggedCheckIns === 1 ? '' : 's'}` : null,
    digest.reportedPain ? `${digest.reportedPain} reported a niggle` : null,
    digest.missedSessions ? `${digest.missedSessions} missed sessions` : null,
  ]
    .filter(Boolean)
    // Four clauses. The lead's job is to answer "is this a morning I need to
    // clear time for", not to itemise the roster — which is one tap away and
    // is where the rest of it lives.
    .slice(0, 4)
    .join(' · ');

  return {
    userId: prefs.userId,
    kind: 'digest',
    priority: digest.items.some((i) => i.priority === 'urgent') ? 'urgent' : 'attention',
    athleteId: null,
    signalKind: null,
    title: "Today's picture",
    body: lead,
    href: '/coach',
    // one digest per coach per local day, whatever else happens
    dedupeKey: `digest:${digest.localDate}`,
    deliverAfter: null,
    payload: { kind: 'digest', digest },
    channels: prefs.channels,
  };
}

/**
 * What an external channel may carry.
 *
 * A subject line lands on a lock screen someone else can read. Body detail
 * about an athlete's soreness or injury does not belong there — the coach
 * opens Iron Miles for that, where the athlete's own words are behind a login.
 */
export function externalSubject(draft: NotificationDraft, athleteName: string | null): string {
  if (draft.kind === 'digest') return 'Iron Miles — today\'s picture';
  return athleteName ? `Iron Miles — ${athleteName} needs a look` : 'Iron Miles — an athlete needs a look';
}

export function externalPreview(draft: NotificationDraft): string {
  return draft.kind === 'digest'
    ? draft.body
    : 'Open Iron Miles to see what they said.';
}
