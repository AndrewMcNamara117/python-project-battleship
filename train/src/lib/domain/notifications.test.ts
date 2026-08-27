import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  alertsFor, composeDigest, DEFAULT_PREFERENCES, dedupeKeyFor, digestDraft, digestDue,
  externalPreview, externalSubject, inQuietHours, localParts, releaseAt,
} from './notifications.ts';
import type { NotificationPreferences } from './notifications.ts';
import { buildEntry } from './roster.ts';
import type { RosterFacts } from './roster.ts';

/**
 * The rules that decide whether a coach is interrupted. Getting these wrong is
 * worse than not sending at all: a coach who is woken at 3am, or who gets the
 * same alert nine times, stops reading them — and then the one that mattered
 * goes unread with the rest.
 */

const TODAY = '2026-09-16';

const prefs = (over: Partial<NotificationPreferences> = {}): NotificationPreferences => ({
  userId: 'coach-1',
  ...DEFAULT_PREFERENCES,
  ...over,
});

const facts = (over: Partial<RosterFacts> = {}): RosterFacts => ({
  athleteId: 'a1', fullName: 'Andrew', avatarUrl: null, joinedAt: '2026-01-01T00:00:00.000Z',
  programmeId: 'p1', programmeName: 'Marathon', programmeEndDate: '2026-12-01',
  blockName: 'Build', phase: 'build', weekNo: 6, totalWeeks: 18,
  plannedThisWeek: 5, completedThisWeek: 4, plannedFourWeeks: 20, completedFourWeeks: 18,
  missedFourteenDays: 0, missedKeySession: null,
  lastCompletedDate: '2026-09-15', lastCompletedName: 'Easy Run',
  nextSessionDate: '2026-09-17', nextSessionName: 'Threshold', futureSessions: 40,
  checkIn: null, raceId: null, raceName: null, raceDate: null, eventType: 'marathon',
  unreadFromAthlete: 0, recentAdaptations: 0,
  ...over,
});

const flagged = (over: Partial<RosterFacts> = {}) => facts({
  checkIn: {
    weekStart: '2026-09-14', submittedAt: `${TODAY}T08:00:00Z`, attention: 'attention',
    reasons: ['fatigue up', 'soreness reported'], reviewedAt: null,
    fatigue: 8, soreness: 7, painOrNiggles: null,
  },
  ...over,
});

describe('local time', () => {
  it('reads the coach\'s own clock, not the server\'s', () => {
    const at = new Date('2026-09-16T23:30:00Z');
    assert.equal(localParts(at, 'UTC').hour, 23);
    assert.equal(localParts(at, 'Australia/Sydney').hour, 9, 'the next morning in Sydney');
    assert.equal(localParts(at, 'Australia/Sydney').date, '2026-09-17');
    assert.equal(localParts(at, 'America/Los_Angeles').hour, 16);
  });

  it('survives a daylight-saving change without knowing DST exists', () => {
    // Ireland leaves summer time at 02:00 on 25 October 2026
    const before = new Date('2026-10-24T23:30:00Z');
    const after = new Date('2026-10-25T23:30:00Z');
    assert.equal(localParts(before, 'Europe/Dublin').hour, 0, 'IST, one hour ahead');
    assert.equal(localParts(after, 'Europe/Dublin').hour, 23, 'GMT, back in line');
  });

  it('falls back to UTC rather than failing on a bad timezone', () => {
    const at = new Date('2026-09-16T12:00:00Z');
    assert.equal(localParts(at, 'Mars/Olympus_Mons').hour, 12);
  });
});

describe('quiet hours', () => {
  it('holds an alert at night and releases it in the morning', () => {
    const p = prefs({ timezone: 'UTC', quietFrom: 22, quietUntil: 7 });

    assert.equal(inQuietHours(p, new Date('2026-09-16T23:00:00Z')), true);
    assert.equal(inQuietHours(p, new Date('2026-09-17T03:00:00Z')), true);
    assert.equal(inQuietHours(p, new Date('2026-09-17T08:00:00Z')), false);
    assert.equal(inQuietHours(p, new Date('2026-09-16T21:00:00Z')), false);
  });

  it('releases at the end of quiet hours, not immediately', () => {
    const p = prefs({ timezone: 'UTC', quietFrom: 22, quietUntil: 7 });
    const held = releaseAt(p, new Date('2026-09-17T02:15:00Z'));
    assert.ok(held);
    assert.equal(localParts(new Date(held), 'UTC').hour, 7);
  });

  it('does not hold anything outside quiet hours', () => {
    const p = prefs({ timezone: 'UTC', quietFrom: 22, quietUntil: 7 });
    assert.equal(releaseAt(p, new Date('2026-09-16T14:00:00Z')), null);
  });

  it('can be turned off entirely', () => {
    const p = prefs({ timezone: 'UTC', quietFrom: null, quietUntil: null });
    assert.equal(inQuietHours(p, new Date('2026-09-17T03:00:00Z')), false);
    assert.equal(releaseAt(p, new Date('2026-09-17T03:00:00Z')), null);
  });

  it('respects the coach\'s timezone, not the server\'s', () => {
    // 03:00 UTC is 13:00 in Sydney — the middle of their working day
    const sydney = prefs({ timezone: 'Australia/Sydney', quietFrom: 22, quietUntil: 7 });
    assert.equal(inQuietHours(sydney, new Date('2026-09-17T03:00:00Z')), false);
  });
});

describe('the digest schedule', () => {
  it('waits for the coach\'s chosen hour', () => {
    const p = prefs({ timezone: 'UTC', digestHour: 7 });
    assert.equal(digestDue(p, new Date('2026-09-16T06:00:00Z'), null), false);
    assert.equal(digestDue(p, new Date('2026-09-16T07:01:00Z'), null), true);
  });

  it('sends once a day, by the coach\'s local date', () => {
    const p = prefs({ timezone: 'UTC', digestHour: 7 });
    assert.equal(digestDue(p, new Date('2026-09-16T09:00:00Z'), '2026-09-16'), false,
      'already sent today');
    assert.equal(digestDue(p, new Date('2026-09-17T09:00:00Z'), '2026-09-16'), true,
      'a new day is a new digest');
  });

  it('does not send when the coach turned it off', () => {
    const p = prefs({ timezone: 'UTC', digestEnabled: false });
    assert.equal(digestDue(p, new Date('2026-09-16T09:00:00Z'), null), false);
  });

  it('follows a timezone change immediately', () => {
    const at = new Date('2026-09-16T20:00:00Z');
    assert.equal(digestDue(prefs({ timezone: 'UTC', digestHour: 7 }), at, null), true);
    assert.equal(
      digestDue(prefs({ timezone: 'Australia/Sydney', digestHour: 7 }), at, null), false,
      'in Sydney it is 6am the next day, before their digest hour');
  });
});

describe('which signals interrupt a coach', () => {
  it('alerts on a flagged check-in', () => {
    const roster = [buildEntry(flagged(), TODAY)];
    const drafts = alertsFor(roster, prefs({ timezone: 'UTC' }), new Date('2026-09-16T10:00:00Z'));
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].signalKind, 'checkin_flagged');
    assert.equal(drafts[0].title, 'Andrew — check-in flagged');
    assert.match(drafts[0].body, /fatigue up/);
  });

  it('alerts on a reported niggle, in the athlete\'s own words', () => {
    const roster = [buildEntry(facts({
      checkIn: {
        weekStart: '2026-09-14', submittedAt: `${TODAY}T08:00:00Z`, attention: 'none',
        reasons: [], reviewedAt: `${TODAY}T09:00:00Z`,
        fatigue: 4, soreness: 8, painOrNiggles: 'Left calf tight after the long run',
      },
    }), TODAY)];

    const drafts = alertsFor(roster, prefs({ timezone: 'UTC' }), new Date('2026-09-16T10:00:00Z'));
    const pain = drafts.find((d) => d.signalKind === 'soreness_reported');
    assert.ok(pain);
    assert.equal(pain.body, 'Reported: Left calf tight after the long run',
      'quoted, not interpreted');
    assert.doesNotMatch(pain.body, /injur|strain|rest|stop/i, 'and never diagnosed');
  });

  it('does not interrupt because the niggles box was not left blank', () => {
    // an athlete typing "nothing much" is not a reason to wake anyone. The
    // severity is theirs, from the score they set; the words are carried
    // through untouched either way.
    const roster = [buildEntry(facts({
      checkIn: {
        weekStart: '2026-09-14', submittedAt: `${TODAY}T08:00:00Z`, attention: 'none',
        reasons: [], reviewedAt: `${TODAY}T09:00:00Z`,
        fatigue: 3, soreness: 2, painOrNiggles: 'Nothing to report.',
      },
    }), TODAY)];

    const drafts = alertsFor(roster, prefs({ timezone: 'UTC' }), new Date('2026-09-16T10:00:00Z'));
    assert.deepEqual(drafts, []);

    // but the coach can still read it when they look
    const [entry] = roster;
    const signal = entry.signals.find((s) => s.kind === 'soreness_reported');
    assert.ok(signal, 'the report is kept');
    assert.equal(signal.detail, 'Reported: Nothing to report.');
    assert.equal(signal.severity, 'information');
  });

  it('does not interrupt for anything a coach can read tomorrow', () => {
    const roster = [
      buildEntry(facts({ missedFourteenDays: 4 }), TODAY),
      buildEntry(facts({ athleteId: 'a2', programmeEndDate: '2026-09-20' }), TODAY),
      buildEntry(facts({ athleteId: 'a3', unreadFromAthlete: 3 }), TODAY),
      buildEntry(facts({ athleteId: 'a4', futureSessions: 0 }), TODAY),
    ];
    const drafts = alertsFor(roster, prefs({ timezone: 'UTC' }), new Date('2026-09-16T10:00:00Z'));
    assert.deepEqual(drafts, [], 'missed sessions and endings wait for the morning');
  });

  it('obeys the coach turning an alert type off', () => {
    const roster = [buildEntry(flagged(), TODAY)];
    const off = alertsFor(roster, prefs({ timezone: 'UTC', alertFlaggedCheckIn: false }),
      new Date('2026-09-16T10:00:00Z'));
    assert.equal(off.length, 0);
  });

  it('holds alerts raised during quiet hours', () => {
    const roster = [buildEntry(flagged(), TODAY)];
    const drafts = alertsFor(roster, prefs({ timezone: 'UTC', quietFrom: 22, quietUntil: 7 }),
      new Date('2026-09-17T02:00:00Z'));
    assert.equal(drafts.length, 1);
    assert.ok(drafts[0].deliverAfter, 'held rather than dropped');
    assert.equal(localParts(new Date(drafts[0].deliverAfter), 'UTC').hour, 7);
  });
});

describe('not sending the same news twice', () => {
  it('gives the same check-in the same key however often the job runs', () => {
    const entry = buildEntry(flagged(), TODAY);
    const signal = entry.signals.find((s) => s.kind === 'checkin_flagged')!;
    const first = dedupeKeyFor(entry, signal);
    const second = dedupeKeyFor(buildEntry(flagged(), TODAY), signal);
    assert.equal(first, second);
  });

  it('gives next week\'s check-in a different key', () => {
    const thisWeek = buildEntry(flagged(), TODAY);
    const nextWeek = buildEntry(flagged({
      checkIn: {
        weekStart: '2026-09-21', submittedAt: '2026-09-23T08:00:00Z', attention: 'attention',
        reasons: ['fatigue up'], reviewedAt: null, fatigue: 8, soreness: 7, painOrNiggles: null,
      },
    }), TODAY);

    const kind = (e: typeof thisWeek) => e.signals.find((s) => s.kind === 'checkin_flagged')!;
    assert.notEqual(dedupeKeyFor(thisWeek, kind(thisWeek)), dedupeKeyFor(nextWeek, kind(nextWeek)),
      'resolved then flagged again is new news');
  });

  it('keys by the athlete, so two athletes never collide', () => {
    const a = buildEntry(flagged(), TODAY);
    const b = buildEntry(flagged({ athleteId: 'a2', fullName: 'Ciara' }), TODAY);
    const kind = (e: typeof a) => e.signals.find((s) => s.kind === 'checkin_flagged')!;
    assert.notEqual(dedupeKeyFor(a, kind(a)), dedupeKeyFor(b, kind(b)));
  });
});

describe('the digest', () => {
  const roster = [
    buildEntry(flagged({ athleteId: 'a1', fullName: 'Aoife' }), TODAY),
    buildEntry(facts({ athleteId: 'a2', fullName: 'Andrew', missedFourteenDays: 4 }), TODAY),
    buildEntry(facts({ athleteId: 'a3', fullName: 'Ciara', programmeEndDate: '2026-09-21' }), TODAY),
    buildEntry(facts({ athleteId: 'a4', fullName: 'Fine' }), TODAY),
  ];

  it('leaves out athletes with nothing actionable', () => {
    const digest = composeDigest(roster, TODAY);
    assert.equal(digest.athletes, 4);
    assert.equal(digest.items.length, 3);
    assert.ok(!digest.items.some((i) => i.athleteName === 'Fine'),
      'an athlete who is fine is not news');
  });

  it('states a shared problem once instead of once per athlete', () => {
    const waiting = ['w1', 'w2', 'w3', 'w4', 'w5'].map((id) =>
      buildEntry(facts({ athleteId: id, fullName: id, programmeId: null, programmeName: null }), TODAY));
    const digest = composeDigest([...roster, ...waiting], TODAY);

    const group = digest.groups.find((g) => g.kind === 'no_programme');
    assert.ok(group, 'five athletes waiting on a programme is one job');
    assert.equal(group.count, 5);
    for (const id of ['w1', 'w5']) {
      assert.ok(!digest.items.some((i) => i.athleteId === id),
        `${id} is in the group, not listed again on their own`);
    }

    const body = digestDraft(digest, prefs())!.body;
    assert.match(body, /5 athletes are waiting on a programme/);
    assert.doesNotMatch(body, /8 of 9/, 'a count of everyone is not a summary');
  });

  it('counts what the coach is walking into', () => {
    const digest = composeDigest(roster, TODAY);
    assert.equal(digest.flaggedCheckIns, 1);
    assert.equal(digest.missedSessions, 4);
    assert.equal(digest.programmesEnding, 1);
  });

  it('gives each athlete their reasons in plain language', () => {
    const digest = composeDigest(roster, TODAY);
    const andrew = digest.items.find((i) => i.athleteName === 'Andrew')!;
    assert.deepEqual(andrew.reasons, ['4 sessions missed in the last two weeks.']);
    assert.equal(andrew.href, '/coach/athletes/a2');
  });

  it('says nothing when there is nothing to say', () => {
    const quiet = [buildEntry(facts({ fullName: 'Fine' }), TODAY)];
    assert.equal(digestDraft(composeDigest(quiet, TODAY), prefs()), null,
      'a digest saying "all fine" is a digest a coach stops opening');
  });

  it('sends once per local day', () => {
    const draft = digestDraft(composeDigest(roster, TODAY), prefs())!;
    assert.equal(draft.dedupeKey, `digest:${TODAY}`);
    assert.equal(draft.kind, 'digest');
    assert.equal(draft.href, '/coach');
  });

  it('leads with the numbers', () => {
    const draft = digestDraft(composeDigest(roster, TODAY), prefs())!;
    assert.match(draft.body, /3 to look at of 4/);
    assert.match(draft.body, /1 flagged check-in/);
  });
});

describe('what leaves the building', () => {
  it('keeps an athlete\'s health detail out of an external subject line', () => {
    const roster = [buildEntry(facts({
      checkIn: {
        weekStart: '2026-09-14', submittedAt: `${TODAY}T08:00:00Z`, attention: 'none',
        reasons: [], reviewedAt: `${TODAY}T09:00:00Z`,
        fatigue: 9, soreness: 9, painOrNiggles: 'Sharp pain in my left Achilles',
      },
    }), TODAY)];
    const [draft] = alertsFor(roster, prefs({ timezone: 'UTC' }), new Date('2026-09-16T10:00:00Z'));

    const subject = externalSubject(draft, 'Andrew');
    const preview = externalPreview(draft);

    for (const text of [subject, preview]) {
      assert.doesNotMatch(text, /Achilles|pain|soreness|9/i,
        'a lock screen is not the place for an athlete\'s injury');
    }
    assert.match(subject, /Andrew/, 'but the coach still knows who to open');
  });

  it('lets the digest carry its own summary, which names nobody', () => {
    const digest = composeDigest([buildEntry(flagged(), TODAY)], TODAY);
    const draft = digestDraft(digest, prefs())!;
    const preview = externalPreview(draft);
    assert.match(preview, /to look at/);
    assert.doesNotMatch(preview, /Andrew/, 'a summary line names nobody');
  });
});
