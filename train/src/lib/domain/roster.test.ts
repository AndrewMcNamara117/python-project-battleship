import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyFilter, attentionRoster, buildEntry, classify, concernsFor, filterCounts,
  rankEntries, rosterWorkload, summariseToday,
} from './roster.ts';
import type { RosterFacts } from './roster.ts';

/**
 * The signals are the product here. A coach reads these sentences and decides
 * whether to open someone, so the wording and the thresholds are what these
 * tests are about — not that classification returns something.
 */

const TODAY = '2026-09-16';

const facts = (over: Partial<RosterFacts> = {}): RosterFacts => ({
  athleteId: 'a1',
  fullName: 'Andrew',
  avatarUrl: null,
  joinedAt: '2026-01-01T00:00:00.000Z',
  programmeId: 'p1',
  programmeName: 'Marathon',
  programmeEndDate: '2026-12-01',
  blockName: 'Build',
  phase: 'build',
  weekNo: 6,
  totalWeeks: 18,
  plannedThisWeek: 5,
  completedThisWeek: 4,
  plannedFourWeeks: 20,
  completedFourWeeks: 18,
  missedFourteenDays: 0,
  missedKeySession: null,
  lastCompletedDate: '2026-09-15',
  lastCompletedName: 'Easy Run',
  nextSessionDate: '2026-09-17',
  nextSessionName: 'Threshold Intervals',
  futureSessions: 40,
  checkIn: null,
  raceId: null,
  raceName: null,
  raceDate: null,
  eventType: 'marathon',
  unreadFromAthlete: 0,
  recentAdaptations: 0,
  ...over,
});

const kinds = (f: RosterFacts) => classify(f, TODAY).map((s) => s.kind);

describe('signals', () => {
  it('says nothing about an athlete who is fine', () => {
    assert.deepEqual(kinds(facts()), []);
  });

  it('raises an athlete left without a programme', () => {
    const [signal] = classify(facts({ programmeId: null }), TODAY);
    assert.equal(signal.kind, 'no_programme');
    assert.equal(signal.severity, 'attention');
    assert.equal(signal.detail, 'No programme assigned.');
  });

  it('does not raise one who joined this week — that is onboarding', () => {
    const [signal] = classify(
      facts({ programmeId: null, joinedAt: '2026-09-14T10:00:00.000Z' }), TODAY);
    assert.equal(signal.severity, 'information',
      'a signal that fires for every new athlete is not a signal');
    assert.equal(signal.detail, 'Joined 2 days ago, no programme yet.');
  });

  it('calls a programme that ran out urgent, because that one is broken', () => {
    const [signal] = classify(facts({ futureSessions: 0 }), TODAY);
    assert.equal(signal.kind, 'no_future_sessions');
    assert.equal(signal.severity, 'urgent');
    assert.equal(signal.detail, 'On a programme with nothing scheduled from today.');
  });

  it('does not call one missed session anything at all', () => {
    assert.deepEqual(kinds(facts({ missedFourteenDays: 1 })), [],
      'an athlete who missed a Tuesday had a Tuesday');
    assert.deepEqual(kinds(facts({ missedFourteenDays: 2 })), []);
  });

  it('raises three missed sessions, and counts them out loud', () => {
    const [signal] = classify(facts({ missedFourteenDays: 3 }), TODAY);
    assert.equal(signal.kind, 'missed_repeated');
    assert.equal(signal.severity, 'attention');
    assert.equal(signal.detail, '3 sessions missed in the last two weeks.');
  });

  it('names a missed key session', () => {
    const [signal] = classify(
      facts({ missedKeySession: { name: 'Long Run', date: '2026-09-13' } }), TODAY);
    assert.equal(signal.kind, 'missed_key_session');
    assert.equal(signal.detail, 'Missed Long Run.');
  });

  it('raises a flagged check-in with the reasons the athlete gave', () => {
    const [signal] = classify(facts({
      checkIn: {
        id: 'ci-fixture',
        weekStart: '2026-09-14', submittedAt: `${TODAY}T08:00:00Z`, attention: 'attention',
        reasons: ['fatigue up', 'soreness reported'], acknowledgedAt: null, respondedAt: null,
        fatigue: 8, soreness: 7, painOrNiggles: null,
      },
    }), TODAY);
    assert.equal(signal.kind, 'checkin_flagged');
    assert.equal(signal.detail, 'Check-in flagged: fatigue up, soreness reported.');
    assert.match(signal.href, /#checkins$/, 'and it leads to the check-in');
  });

  it('does not raise a flagged check-in the coach has already read', () => {
    const result = kinds(facts({
      checkIn: {
        id: 'ci-fixture',
        weekStart: '2026-09-14', submittedAt: `${TODAY}T08:00:00Z`, attention: 'attention',
        reasons: ['fatigue up'], acknowledgedAt: `${TODAY}T09:00:00Z`, respondedAt: `${TODAY}T09:00:00Z`,
        fatigue: 8, soreness: 7, painOrNiggles: null,
      },
    }));
    assert.deepEqual(result, []);
  });

  it('shows an unread ordinary check-in as information, not attention', () => {
    const [signal] = classify(facts({
      checkIn: {
        id: 'ci-fixture',
        weekStart: '2026-09-14', submittedAt: `${TODAY}T08:00:00Z`, attention: 'none',
        reasons: [], acknowledgedAt: null, respondedAt: null, fatigue: 3, soreness: 2, painOrNiggles: null,
      },
    }), TODAY);
    assert.equal(signal.kind, 'checkin_unreviewed');
    assert.equal(signal.severity, 'information');
  });

  it('quotes what the athlete said about a niggle rather than scoring it', () => {
    const signals = classify(facts({
      checkIn: {
        id: 'ci-fixture',
        weekStart: '2026-09-14', submittedAt: `${TODAY}T08:00:00Z`, attention: 'none',
        reasons: [], acknowledgedAt: `${TODAY}T09:00:00Z`, respondedAt: `${TODAY}T09:00:00Z`,
        fatigue: 4, soreness: 6, painOrNiggles: 'Left calf tight after the long run',
      },
    }), TODAY);
    const soreness = signals.find((s) => s.kind === 'soreness_reported');
    assert.ok(soreness);
    assert.equal(soreness.detail, 'Reported: Left calf tight after the long run');
    assert.equal(soreness.severity, 'information');
  });

  it('raises an athlete who has stopped training, but not one who trained yesterday', () => {
    assert.deepEqual(kinds(facts({ lastCompletedDate: '2026-09-15' })), []);
    assert.deepEqual(kinds(facts({ lastCompletedDate: '2026-09-09' })), [],
      'a week off is not yet a signal');

    const [signal] = classify(facts({ lastCompletedDate: '2026-09-06' }), TODAY);
    assert.equal(signal.kind, 'not_training');
    assert.equal(signal.detail, 'Nothing logged in 10 days.');
  });

  it('counts a race down, and raises it inside a fortnight', () => {
    const soon = classify(facts({ raceName: 'Dublin Marathon', raceDate: '2026-09-26' }), TODAY);
    assert.equal(soon[0].kind, 'race_approaching');
    assert.equal(soon[0].severity, 'attention');
    assert.equal(soon[0].detail, 'Dublin Marathon in 10 days.');

    const later = classify(facts({ raceName: 'Dublin Marathon', raceDate: '2026-10-14' }), TODAY);
    assert.equal(later[0].severity, 'information', 'a month out is context, not a call to action');

    assert.deepEqual(kinds(facts({ raceName: 'Dublin', raceDate: '2026-12-01' })), [],
      'and further out is nothing yet');
  });

  it('raises a programme ending, more loudly as it approaches', () => {
    const near = classify(facts({ programmeEndDate: '2026-09-25' }), TODAY);
    assert.equal(near[0].kind, 'programme_ending');
    assert.equal(near[0].severity, 'attention');
    assert.equal(near[0].detail, 'Programme ends in 9 days.');

    const further = classify(facts({ programmeEndDate: '2026-10-10' }), TODAY);
    assert.equal(further[0].severity, 'information');
  });

  it('puts the loudest signal first', () => {
    const signals = classify(facts({
      futureSessions: 0,
      missedFourteenDays: 4,
      raceName: 'Dublin', raceDate: '2026-10-14',
    }), TODAY);
    assert.equal(signals[0].severity, 'urgent');
    assert.equal(signals.at(-1)!.severity, 'information');
  });

  it('gives every signal somewhere to go', () => {
    const signals = classify(facts({
      futureSessions: 0, missedFourteenDays: 3, unreadFromAthlete: 2,
      raceName: 'Dublin', raceDate: '2026-09-20',
    }), TODAY);
    assert.ok(signals.length >= 4);
    assert.ok(signals.every((s) => s.href.startsWith('/coach/')), 'no dead ends');
  });
});

describe('adherence', () => {
  it('is measured against what is prescribed now', () => {
    // a coach who moved two sessions out of the window leaves 18 planned,
    // and an athlete who did all 18 is at 100 rather than being punished
    const entry = buildEntry(facts({ plannedFourWeeks: 18, completedFourWeeks: 18 }), TODAY);
    assert.equal(entry.adherencePct, 100);
  });

  it('is null rather than zero when nothing is prescribed', () => {
    const entry = buildEntry(facts({ plannedFourWeeks: 0, completedFourWeeks: 0 }), TODAY);
    assert.equal(entry.adherencePct, null, 'no prescription is not nought per cent');
  });
});

describe('ordering', () => {
  const entry = (name: string, over: Partial<RosterFacts>) =>
    buildEntry(facts({ fullName: name, athleteId: name, ...over }), TODAY);

  it('puts urgent above attention above quiet', () => {
    const ranked = rankEntries([
      entry('Quiet', {}),
      entry('Missed', { missedFourteenDays: 4 }),
      entry('Stranded', { futureSessions: 0 }),
    ]);
    assert.deepEqual(ranked.map((e) => e.fullName), ['Stranded', 'Missed', 'Quiet']);
  });

  it('puts the athlete carrying more signals first, at the same severity', () => {
    const ranked = rankEntries([
      entry('One', { missedFourteenDays: 4 }),
      entry('Two', { missedFourteenDays: 4, unreadFromAthlete: 1 }),
    ]);
    assert.deepEqual(ranked.map((e) => e.fullName), ['Two', 'One']);
  });

  it('is stable and alphabetical between two athletes in the same state', () => {
    const input = [entry('Brenda', {}), entry('Aoife', {}), entry('Cian', {})];
    assert.deepEqual(rankEntries(input).map((e) => e.fullName), ['Aoife', 'Brenda', 'Cian']);
    assert.deepEqual(
      rankEntries([...input].reverse()).map((e) => e.fullName), ['Aoife', 'Brenda', 'Cian'],
      'the same roster orders the same way whatever order it arrives in');
  });
});

describe('filters', () => {
  const roster = [
    buildEntry(facts({ athleteId: '1', fullName: 'Quiet One' }), TODAY),
    buildEntry(facts({ athleteId: '2', fullName: 'Missed Three', missedFourteenDays: 3 }), TODAY),
    buildEntry(facts({ athleteId: '3', fullName: 'No Programme', futureSessions: 0 }), TODAY),
    buildEntry(facts({
      athleteId: '4', fullName: 'Checked In',
      checkIn: {
        id: 'ci-fixture',
        weekStart: '2026-09-14', submittedAt: `${TODAY}T08:00:00Z`, attention: 'none',
        reasons: [], acknowledgedAt: null, respondedAt: null, fatigue: 3, soreness: 2, painOrNiggles: null,
      },
    }), TODAY),
  ];

  it('shows everyone', () => {
    assert.equal(applyFilter(roster, 'all').length, 4);
  });

  it('needs-attention leaves out the merely informative', () => {
    const names = applyFilter(roster, 'attention').map((e) => e.fullName);
    assert.deepEqual(names.sort(), ['Missed Three', 'No Programme']);
  });

  it('finds check-ins to read', () => {
    assert.deepEqual(applyFilter(roster, 'checkins').map((e) => e.fullName), ['Checked In']);
  });

  it('searches by name within a filter', () => {
    assert.deepEqual(applyFilter(roster, 'all', 'missed').map((e) => e.fullName), ['Missed Three']);
    assert.equal(applyFilter(roster, 'attention', 'quiet').length, 0);
  });

  it('counts each filter for the chips', () => {
    const counts = filterCounts(roster);
    assert.equal(counts.all, 4);
    assert.equal(counts.attention, 2);
    assert.equal(counts.checkins, 1);
    assert.equal(counts.no_training, 1);
  });
});

describe('today', () => {
  it('summarises the day from the roster already loaded', () => {
    const roster = [
      buildEntry(facts({ athleteId: '1', fullName: 'A', nextSessionDate: TODAY, nextSessionName: 'Threshold' }), TODAY),
      buildEntry(facts({ athleteId: '2', fullName: 'B', nextSessionDate: '2026-09-18' }), TODAY),
      buildEntry(facts({
        athleteId: '3', fullName: 'C', raceName: 'Dublin', raceDate: '2026-09-20',
        checkIn: {
          id: 'ci-fixture',
          weekStart: '2026-09-14', submittedAt: `${TODAY}T08:00:00Z`, attention: 'none',
          reasons: [], acknowledgedAt: null, respondedAt: null, fatigue: 3, soreness: 2, painOrNiggles: null,
        },
      }), TODAY),
    ];

    const today = summariseToday(roster, TODAY);
    assert.equal(today.trainingToday, 1);
    assert.deepEqual(today.keySessionsToday, [{ athleteId: '1', athleteName: 'A', sessionName: 'Threshold' }]);
    assert.equal(today.checkInsToRead, 1);
    assert.equal(today.racesWithin.length, 1);
    assert.equal(today.racesWithin[0].days, 4);
  });
});

describe('the workload, by the thing that needs doing', () => {
  const withNoProgramme = (id: string) =>
    buildEntry(facts({ athleteId: id, fullName: `Athlete ${id}`, programmeId: null }), TODAY);

  const sore = (id: string, over: Partial<RosterFacts> = {}) => buildEntry(facts({
    athleteId: id,
    fullName: `Sore ${id}`,
    checkIn: {
      id: `ci-${id}`, weekStart: '2026-09-14', submittedAt: `${TODAY}T08:00:00Z`,
      attention: 'attention', reasons: ['Soreness reported at 8 or above'],
      acknowledgedAt: null, respondedAt: null,
      fatigue: 8, soreness: 9, painOrNiggles: 'Achilles.',
    },
    ...over,
  }), TODAY);

  it('says nothing about a concern only a couple of athletes share', () => {
    const rows = rosterWorkload([withNoProgramme('1'), withNoProgramme('2')]);
    assert.equal(rows.length, 0, 'two is not a backlog');
  });

  it('states a shared concern once, with everyone in it', () => {
    const rows = rosterWorkload(['1', '2', '3', '4', '5'].map(withNoProgramme));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].kind, 'no_training');
    assert.equal(rows[0].count, 5);
    assert.equal(rows[0].detail, '5 athletes with nothing scheduled.');
    assert.equal(rows[0].athleteIds.length, 5);
  });

  it('counts an athlete in every concern they carry', () => {
    // Sarah has missed training, has a programme ending, and flagged her
    // check-in. The old model filed her under one of those and deleted her
    // from the other two counts; a coach planning their week was then reading
    // numbers that were quietly wrong.
    const sarah = buildEntry(facts({
      athleteId: 'sarah',
      fullName: 'Sarah',
      missedFourteenDays: 4,
      programmeEndDate: '2026-09-24',
      checkIn: {
        id: 'ci-s', weekStart: '2026-09-14', submittedAt: `${TODAY}T08:00:00Z`,
        attention: 'attention', reasons: ['Soreness reported at 8 or above'],
        acknowledgedAt: null, respondedAt: null,
        fatigue: 8, soreness: 9, painOrNiggles: 'Achilles.',
      },
    }), TODAY);

    const others = [
      ...['1', '2'].map((id) => buildEntry(facts({
        athleteId: id, fullName: `Missed ${id}`, missedFourteenDays: 4,
      }), TODAY)),
      ...['3', '4'].map((id) => buildEntry(facts({
        athleteId: id, fullName: `Ending ${id}`, programmeEndDate: '2026-09-24',
      }), TODAY)),
      ...['5', '6'].map((id) => sore(id)),
    ];

    const roster = [sarah, ...others];
    const rows = rosterWorkload(roster);
    const row = (kind: string) => rows.find((r) => r.kind === kind)!;

    assert.equal(row('missed').count, 3, 'Sarah counts among the missing');
    assert.equal(row('ending').count, 3, 'and among the programmes ending');
    assert.equal(row('checkins').count, 3, 'and among the check-ins');
    assert.equal(row('pain').count, 3, 'and among the athletes reporting pain');

    for (const kind of ['missed', 'ending', 'checkins', 'pain']) {
      assert.ok(row(kind).athleteIds.includes('sarah'),
        `Sarah belongs in ${kind} and is not deducted from it to avoid repeating her`);
    }
  });

  it('never removes an athlete from the list because a row counted them', () => {
    const roster = ['1', '2', '3', '4', '5'].map(withNoProgramme);
    const rows = rosterWorkload(roster);

    assert.equal(rows[0].count, 5);
    assert.equal(attentionRoster(roster).length, 5,
      'a count is a count, not a place to put people');
  });

  it('every count equals the list that row opens', () => {
    const roster = [
      ...['1', '2', '3'].map((id) => buildEntry(facts({
        athleteId: id, fullName: `M${id}`, missedFourteenDays: 4, programmeEndDate: '2026-09-20',
      }), TODAY)),
      ...['4', '5', '6'].map((id) => sore(id, { missedFourteenDays: 4 })),
    ];

    // the promise the screen makes: the number on the row is the number of
    // rows you get when you tap it
    for (const row of rosterWorkload(roster)) {
      assert.equal(row.count, applyFilter(roster, row.kind).length,
        `the ${row.kind} row and the ${row.kind} filter must not disagree`);
      assert.equal(row.count, filterCounts(roster)[row.kind]);
    }
  });

  it('says how many of a group also need the coach elsewhere', () => {
    const roster = [
      ...['1', '2', '3'].map((id) => buildEntry(facts({
        athleteId: id, fullName: `Only missed ${id}`, missedFourteenDays: 4,
      }), TODAY)),
      ...['4', '5'].map((id) => sore(id, { missedFourteenDays: 4 })),
    ];
    const missed = rosterWorkload(roster).find((r) => r.kind === 'missed')!;
    assert.equal(missed.count, 5);
    assert.equal(missed.alsoElsewhere, 2, 'two of the five have a check-in as well');
  });

  it('an athlete belongs to exactly the rows their own card shows', () => {
    const sarah = buildEntry(facts({
      athleteId: 'sarah', fullName: 'Sarah', missedFourteenDays: 4, programmeEndDate: '2026-09-24',
    }), TODAY);
    assert.deepEqual(concernsFor(sarah).sort(), ['ending', 'missed']);
  });

  it('does not bury pain under paperwork', () => {
    // both are `attention`; the classifier used to push the renewal date first
    // purely because that code came earlier in the file
    const both = sore('x', { programmeEndDate: '2026-09-24' });
    assert.equal(both.topSignal?.kind, 'soreness_reported',
      'an ending programme never outranks what the athlete said about their body');

    const ordered = rosterWorkload([
      ...['1', '2', '3'].map((id) => sore(id)),
      ...['4', '5', '6'].map((id) => buildEntry(facts({
        athleteId: id, fullName: `E${id}`, programmeEndDate: '2026-09-24',
      }), TODAY)),
    ]).map((r) => r.kind);
    assert.ok(ordered.indexOf('pain') < ordered.indexOf('ending'),
      'and the band reads in the same order');
  });
});

describe('read is not resolved', () => {
  const flagged = (over: Partial<NonNullable<RosterFacts['checkIn']>> = {}) => buildEntry(facts({
    checkIn: {
      id: 'ci-1', weekStart: '2026-09-14', submittedAt: `${TODAY}T08:00:00Z`,
      attention: 'attention', reasons: ['Soreness reported at 8 or above'],
      acknowledgedAt: null, respondedAt: null,
      fatigue: 8, soreness: 9, painOrNiggles: 'Left Achilles sore on hills.',
      ...over,
    },
  }), TODAY);

  const kinds = (e: ReturnType<typeof buildEntry>) => e.signals.map((s) => s.kind);

  it('flags an unread, unanswered check-in', () => {
    const e = flagged();
    assert.ok(kinds(e).includes('checkin_flagged'));
    assert.ok(!kinds(e).includes('checkin_unreviewed'), 'flagged supersedes unread');
  });

  it('keeps the flag after the coach marks it read', () => {
    // reading "my Achilles is sore" has not made the Achilles better
    const e = flagged({ acknowledgedAt: `${TODAY}T09:00:00Z` });
    assert.ok(kinds(e).includes('checkin_flagged'),
      'a flagged check-in is settled by answering it, not by reading it');
  });

  it('clears the flag once the coach has replied', () => {
    const e = flagged({
      acknowledgedAt: `${TODAY}T09:00:00Z`,
      respondedAt: `${TODAY}T09:05:00Z`,
    });
    assert.ok(!kinds(e).includes('checkin_flagged'));
  });

  it('keeps reported pain visible whatever the coach clicked', () => {
    // soreness is read from the athlete's own score, never from read state
    for (const state of [
      {},
      { acknowledgedAt: `${TODAY}T09:00:00Z` },
      { acknowledgedAt: `${TODAY}T09:00:00Z`, respondedAt: `${TODAY}T09:05:00Z` },
    ]) {
      const e = flagged(state);
      assert.ok(kinds(e).includes('soreness_reported'),
        `pain disappeared for ${JSON.stringify(state)}`);
    }
  });

  it('clears only the "to read" signal when a routine check-in is read', () => {
    const routine = (acknowledgedAt: string | null) => buildEntry(facts({
      checkIn: {
        id: 'ci-2', weekStart: '2026-09-14', submittedAt: `${TODAY}T08:00:00Z`,
        attention: 'none', reasons: [], acknowledgedAt, respondedAt: null,
        fatigue: 4, soreness: 3, painOrNiggles: null,
      },
    }), TODAY);

    assert.ok(kinds(routine(null)).includes('checkin_unreviewed'));
    assert.ok(!kinds(routine(`${TODAY}T09:00:00Z`)).includes('checkin_unreviewed'),
      'which is the whole point: the queue can be emptied');
  });

  it('counts check-ins to read by acknowledgement, not by reply', () => {
    const roster = [
      flagged({ acknowledgedAt: `${TODAY}T09:00:00Z` }),
      buildEntry(facts({ athleteId: 'a2', checkIn: {
        id: 'ci-3', weekStart: '2026-09-14', submittedAt: `${TODAY}T08:00:00Z`,
        attention: 'none', reasons: [], acknowledgedAt: null, respondedAt: null,
        fatigue: 4, soreness: 3, painOrNiggles: null,
      } }), TODAY),
    ];
    assert.equal(summariseToday(roster, TODAY).checkInsToRead, 1,
      'the one nobody has looked at');
  });
});
