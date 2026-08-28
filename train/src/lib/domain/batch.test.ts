import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  allSelected, applicableIds, availableActions, batchSizeError, confirmLabel,
  deselectAll, describeParams, EMPTY_SELECTION, isSelected, MAX_BATCH_SIZE,
  reconcile, resultSentence, selectAll, selectedEntries, selectionLabel,
  succeeded, tally, tallySentence, toggle, unavailableReason,
} from './batch.ts';
import { buildEntry } from './roster.ts';
import { reviewWarnings, warningSentence } from './batch.ts';
import type { BatchPreview, BatchPreviewRow, BatchResult } from './batch.ts';
import type { RosterFacts } from './roster.ts';

const TODAY = '2026-09-16';

const facts = (over: Partial<RosterFacts> = {}): RosterFacts => ({
  athleteId: 'a1', fullName: 'Aoife Devlin', avatarUrl: null, joinedAt: '2026-01-01T00:00:00.000Z',
  programmeId: 'p1', programmeName: 'Marathon', programmeEndDate: '2026-12-01',
  blockName: 'Build', phase: 'build', weekNo: 6, totalWeeks: 18,
  plannedThisWeek: 5, completedThisWeek: 4, plannedFourWeeks: 20, completedFourWeeks: 18,
  missedFourteenDays: 0, missedKeySession: null,
  lastCompletedDate: '2026-09-15', lastCompletedName: 'Easy Run',
  nextSessionDate: '2026-09-17', nextSessionName: 'Threshold', futureSessions: 40,
  checkIn: null, raceId: null, raceName: null, raceDate: null, eventType: 'marathon',
  conversation: null,
  unreadFromAthlete: 0, recentAdaptations: 0, ...over,
});

const entry = (id: string, over: Partial<RosterFacts> = {}) =>
  buildEntry(facts({ athleteId: id, fullName: `Athlete ${id}`, ...over }), TODAY);

const row = (over: Partial<BatchPreviewRow> = {}): BatchPreviewRow => ({
  athleteId: 'a1', athleteName: 'Aoife D.', outcome: 'applied',
  summary: 'ready', warnings: [], blockers: [], ...over,
});

const preview = (rows: BatchPreviewRow[]): BatchPreview =>
  ({ action: 'assign_template', rows });

describe('choosing athletes', () => {
  it('starts with nobody chosen', () => {
    assert.deepEqual(EMPTY_SELECTION.ids, []);
    assert.equal(selectionLabel(EMPTY_SELECTION), '0 selected');
  });

  it('toggles one athlete in and out', () => {
    const one = toggle(EMPTY_SELECTION, 'a1');
    assert.ok(isSelected(one, 'a1'));
    assert.ok(!isSelected(toggle(one, 'a1'), 'a1'));
  });

  it('adds a whole group without dropping what was already chosen', () => {
    // ticking a signal group must not throw away four individual choices
    const some = selectAll(EMPTY_SELECTION, ['a1', 'a2']);
    const more = selectAll(some, ['a2', 'a3']);
    assert.deepEqual(more.ids.sort(), ['a1', 'a2', 'a3']);
  });

  it('unticks a group without dropping the rest', () => {
    const some = selectAll(EMPTY_SELECTION, ['a1', 'a2', 'a3']);
    assert.deepEqual(deselectAll(some, ['a2', 'a3']).ids, ['a1']);
  });

  it('knows when a group is entirely chosen', () => {
    const some = selectAll(EMPTY_SELECTION, ['a1', 'a2']);
    assert.ok(allSelected(some, ['a1', 'a2']));
    assert.ok(!allSelected(some, ['a1', 'a2', 'a3']));
    assert.ok(!allSelected(EMPTY_SELECTION, []), 'an empty group is not "all selected"');
  });

  it('says how many, in words a coach reads', () => {
    assert.equal(selectionLabel({ ids: ['a1'] }), '1 selected');
    assert.equal(selectionLabel({ ids: ['a1', 'a2'] }), '2 selected');
  });

  it('survives filtering, but drops anyone who left the roster', () => {
    const roster = [entry('a1'), entry('a2')];
    const chosen = { ids: ['a1', 'a2', 'gone'] };
    assert.deepEqual(reconcile(chosen, roster).ids, ['a1', 'a2'],
      'a departed athlete is never carried silently into a batch');
  });

  it('resolves a selection to the athletes themselves', () => {
    const roster = [entry('a1'), entry('a2'), entry('a3')];
    const names = selectedEntries({ ids: ['a3', 'a1'] }, roster).map((e) => e.athleteId);
    assert.deepEqual(names, ['a1', 'a3'], 'in roster order, not click order');
  });
});

describe('which actions a selection permits', () => {
  it('offers nothing at all when nobody is selected', () => {
    assert.deepEqual(availableActions([]), []);
    assert.equal(unavailableReason('assign_template', []), 'Select an athlete first.');
  });

  it('always offers assignment', () => {
    const waiting = [entry('a1', { programmeId: null, programmeName: null })];
    assert.deepEqual(availableActions(waiting), ['assign_template']);
  });

  it('withholds the adaptations when nobody has a programme to adapt', () => {
    // the alternative is a review that is entirely "nothing to change", which
    // teaches a coach to distrust the preview
    const waiting = [entry('a1', { programmeId: null, programmeName: null })];
    assert.ok(!availableActions(waiting).includes('scale_volume'));
    assert.match(unavailableReason('scale_volume', waiting) ?? '', /nothing to adjust/);
  });

  it('offers the adaptations when at least one athlete is on a programme', () => {
    const mixed = [entry('a1', { programmeId: null }), entry('a2')];
    assert.deepEqual(availableActions(mixed).sort(),
      ['assign_template', 'scale_volume', 'shift_sessions']);
    assert.equal(unavailableReason('shift_sessions', mixed), null);
  });
});

describe('the tally under the button', () => {
  const p = preview([
    row({ athleteId: 'a1', outcome: 'applied' }),
    row({ athleteId: 'a2', outcome: 'applied', warnings: ['trains 4 days, needs 5'] }),
    row({ athleteId: 'a3', outcome: 'skipped', summary: 'already at that distance' }),
    row({ athleteId: 'a4', outcome: 'blocked', blockers: ['start date is before their last session'] }),
    row({ athleteId: 'a5', outcome: 'unauthorised' }),
  ]);

  it('counts only what will really change', () => {
    const t = tally(p);
    assert.equal(t.total, 5);
    assert.equal(t.willChange, 2);
    assert.equal(t.nothingToDo, 1);
    assert.equal(t.blocked, 1);
    assert.equal(t.unauthorised, 1);
    assert.equal(t.warnings, 1);
  });

  it('never lets the button promise more than the batch delivers', () => {
    assert.equal(confirmLabel('assign_template', tally(p)), 'Assign to 2 athletes');
    assert.doesNotMatch(confirmLabel('assign_template', tally(p)), /5/);
  });

  it('says nothing to apply rather than offering an empty action', () => {
    const none = preview([row({ outcome: 'blocked' })]);
    assert.equal(confirmLabel('scale_volume', tally(none)), 'Nothing to apply');
  });

  it('names the verb of the action the coach chose', () => {
    const one = tally(preview([row({ outcome: 'applied' })]));
    assert.equal(confirmLabel('assign_template', one), 'Assign to 1 athlete');
    assert.equal(confirmLabel('scale_volume', one), 'Adjust 1 athlete');
    assert.equal(confirmLabel('shift_sessions', one), 'Shift 1 athlete');
  });

  it('spells out the exceptions beside the button', () => {
    const s = tallySentence(tally(p));
    assert.match(s, /2 will change/);
    assert.match(s, /1 already as prescribed/);
    assert.match(s, /1 blocked/);
    assert.match(s, /1 not on your roster/);
    assert.match(s, /1 with warnings/);
  });

  it('mentions nothing that did not happen', () => {
    const clean = tallySentence(tally(preview([row({ outcome: 'applied' })])));
    assert.equal(clean, '1 will change');
  });

  it('applies only to the athletes the review said it would', () => {
    assert.deepEqual(applicableIds(p), ['a1', 'a2']);
  });
});

describe('what the coach is told afterwards', () => {
  const result = (rows: BatchResult['rows']): BatchResult =>
    ({ batchId: 'b1', action: 'assign_template', rows });

  it('reports a clean batch plainly', () => {
    const r = result([
      { athleteId: 'a1', athleteName: 'Aoife D.', outcome: 'applied', detail: '' },
      { athleteId: 'a2', athleteName: 'Cian M.', outcome: 'applied', detail: '' },
    ]);
    assert.equal(resultSentence(r), '2 athletes assigned.');
    assert.ok(succeeded(r));
  });

  it('never lets a partial failure read as a success', () => {
    const r = result([
      { athleteId: 'a1', athleteName: 'Aoife D.', outcome: 'applied', detail: '' },
      { athleteId: 'a2', athleteName: 'Cian M.', outcome: 'failed', detail: 'the database refused it' },
    ]);
    const s = resultSentence(r);
    assert.match(s, /1 athlete assigned/);
    assert.match(s, /One athlete was not: Cian M\./, 'named, so the coach knows who to go back to');
    assert.ok(!succeeded(r));
  });

  it('names the first few and counts the rest', () => {
    const r = result(['a1', 'a2', 'a3', 'a4', 'a5'].map((id) => ({
      athleteId: id, athleteName: `Athlete ${id}`, outcome: 'failed' as const, detail: 'nope',
    })));
    const s = resultSentence(r);
    assert.match(s, /Nothing was assigned/);
    assert.match(s, /5 were not/);
    assert.match(s, /and 2 more/);
  });

  it('counts an athlete who needed nothing as a success, not a failure', () => {
    const r = result([
      { athleteId: 'a1', athleteName: 'Aoife D.', outcome: 'applied', detail: '' },
      { athleteId: 'a2', athleteName: 'Cian M.', outcome: 'skipped', detail: 'already at that distance' },
    ]);
    assert.match(resultSentence(r), /1 already as prescribed/);
    assert.ok(succeeded(r), 'nothing went wrong');
  });

  it('says so when the whole batch needed nothing', () => {
    const r = result([
      { athleteId: 'a1', athleteName: 'Aoife D.', outcome: 'skipped', detail: '' },
    ]);
    assert.equal(resultSentence(r), 'Nothing needed changing.');
  });

  it('uses the verb of the action that ran', () => {
    const rows = [{ athleteId: 'a1', athleteName: 'A', outcome: 'applied' as const, detail: '' }];
    assert.match(resultSentence({ batchId: null, action: 'scale_volume', rows }), /adjusted/);
    assert.match(resultSentence({ batchId: null, action: 'shift_sessions', rows }), /shifted/);
  });
});

describe('the size of a batch', () => {
  it('refuses an empty one', () => {
    assert.match(batchSizeError([]) ?? '', /at least one athlete/);
  });

  it('allows a realistic roster', () => {
    assert.equal(batchSizeError(Array.from({ length: MAX_BATCH_SIZE }, (_, i) => `a${i}`)), null);
  });

  it('refuses more than a roster could plausibly be', () => {
    // a blast-radius limit, not a performance one
    const tooMany = Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, i) => `a${i}`);
    assert.match(batchSizeError(tooMany) ?? '', /at most 60/);
  });
});

describe('saying back what the coach chose', () => {
  it('describes an assignment by its start', () => {
    assert.equal(
      describeParams({ action: 'assign_template', templateId: 't1', startDate: '2026-09-21' }),
      'starting 2026-09-21');
  });

  it('describes a volume change as a percentage, not a factor', () => {
    assert.equal(
      describeParams({ action: 'scale_volume', from: '2026-09-16', to: '2026-09-22', factor: 0.9 }),
      '90% of prescribed distance, 2026-09-16 to 2026-09-22');
  });

  it('describes a shift by direction, not by sign', () => {
    assert.match(
      describeParams({ action: 'shift_sessions', from: '2026-09-16', to: '2026-09-22', days: 2 }),
      /2 days later/);
    assert.match(
      describeParams({ action: 'shift_sessions', from: '2026-09-16', to: '2026-09-22', days: -1 }),
      /1 day earlier/);
  });
});

describe('marking check-ins read', () => {
  const unread = (id: string) => buildEntry(facts({
    athleteId: id, fullName: `Athlete ${id}`,
    checkIn: {
      id: `ci-${id}`, weekStart: '2026-09-14', submittedAt: `${TODAY}T08:00:00Z`,
      attention: 'none', reasons: [], acknowledgedAt: null, respondedAt: null,
      fatigue: 4, soreness: 3, painOrNiggles: 'Nothing to report.',
    },
  }), TODAY);

  const alreadyRead = (id: string) => buildEntry(facts({
    athleteId: id, fullName: `Athlete ${id}`,
    checkIn: {
      id: `ci-${id}`, weekStart: '2026-09-14', submittedAt: `${TODAY}T08:00:00Z`,
      attention: 'none', reasons: [], acknowledgedAt: `${TODAY}T09:00:00Z`, respondedAt: null,
      fatigue: 4, soreness: 3, painOrNiggles: null,
    },
  }), TODAY);

  it('is offered when something is unread', () => {
    assert.ok(availableActions([unread('a1')]).includes('acknowledge_checkin'));
    assert.equal(unavailableReason('acknowledge_checkin', [unread('a1')]), null);
  });

  it('is withheld when everything selected has been read', () => {
    const read = [alreadyRead('a1')];
    assert.ok(!availableActions(read).includes('acknowledge_checkin'));
    assert.match(unavailableReason('acknowledge_checkin', read) ?? '', /already been read/);
  });

  it('is withheld when nobody selected has a check-in at all', () => {
    assert.ok(!availableActions([entry('a1')]).includes('acknowledge_checkin'));
  });

  it('says how many will be marked, never how many were selected', () => {
    const p: BatchPreview = {
      action: 'acknowledge_checkin',
      rows: [
        row({ athleteId: 'a1', outcome: 'applied' }),
        row({ athleteId: 'a2', outcome: 'applied' }),
        row({ athleteId: 'a3', outcome: 'skipped', summary: 'Already read.' }),
      ],
    };
    assert.equal(confirmLabel('acknowledge_checkin', tally(p)), 'Mark 2 read');
    assert.deepEqual(applicableIds(p), ['a1', 'a2']);
  });

  it('reports afterwards in the language of reading, not answering', () => {
    const result = {
      batchId: 'b1',
      action: 'acknowledge_checkin' as const,
      rows: [
        { athleteId: 'a1', athleteName: 'Aoife D.', outcome: 'applied' as const, detail: 'Marked read.' },
        { athleteId: 'a2', athleteName: 'Cian M.', outcome: 'applied' as const, detail: 'Marked read.' },
      ],
    };
    assert.match(resultSentence(result), /2 athletes marked read/);
    assert.doesNotMatch(resultSentence(result), /replied|sent|answered/i);
  });

  it('takes no parameters, so there is nothing to configure wrongly', () => {
    assert.equal(describeParams({ action: 'acknowledge_checkin' }), 'read, not answered');
  });
});


describe('the review says each warning once', () => {
  const AVAIL = 'The athlete is available on Monday, Tuesday; the programme only uses Tuesday.';
  const KIT = "The programme's strength work uses Trap bar, which is not on the athlete's equipment list.";
  const ARCHIVE = 'Assigning this will archive the athlete\'s current programme, "Connemara Ultra".';

  const row = (
    name: string,
    warnings: string[],
    outcome: BatchPreviewRow['outcome'] = 'applied',
    blockers: string[] = [],
  ): BatchPreviewRow => ({
    athleteId: name.toLowerCase().replace(/\s+/g, '-'),
    athleteName: name,
    outcome,
    summary: outcome === 'applied' ? '10 weeks' : 'nothing',
    warnings,
    blockers,
  });

  const preview = (rows: BatchPreviewRow[]): BatchPreview => ({ action: 'assign_template', rows });

  it('collapses a warning every athlete carries into one line', () => {
    const w = reviewWarnings(preview([
      row('Squad 01', [AVAIL, KIT]),
      row('Squad 02', [AVAIL, KIT]),
      row('Squad 03', [AVAIL, KIT]),
    ]));
    assert.equal(w.cohort, 3);
    assert.deepEqual(w.shared.map((g) => g.detail), [AVAIL, KIT]);
    assert.deepEqual(w.differences, []);
    assert.deepEqual(w.exceptions, [], 'nobody differs');
    assert.equal(w.shared[0].athleteIds.length, 3, 'and it truthfully names all three');
  });

  it('never calls a warning shared when one athlete lacks it', () => {
    // the failure that would turn a safety screen into a rubber stamp
    const w = reviewWarnings(preview([
      row('Squad 01', [AVAIL]),
      row('Squad 02', [AVAIL]),
      row('Squad 03', []),
    ]));
    assert.deepEqual(w.shared, [], 'two of three is not shared');
    assert.equal(w.differences.length, 1);
    assert.deepEqual(w.differences[0].athleteNames, ['Squad 01', 'Squad 02']);
  });

  it('makes the single exceptional athlete impossible to miss', () => {
    const w = reviewWarnings(preview([
      ...['Squad 01', 'Squad 02', 'Squad 03', 'Squad 04'].map((n) => row(n, [AVAIL, KIT])),
      row('Squad 05', [AVAIL, KIT, ARCHIVE]),
    ]));
    assert.deepEqual(w.shared.map((g) => g.detail), [AVAIL, KIT]);
    assert.equal(w.differences.length, 1);
    assert.deepEqual(w.differences[0].athleteNames, ['Squad 05']);
    assert.deepEqual(w.exceptions, [{
      athleteId: 'squad-05', athleteName: 'Squad 05', only: [ARCHIVE],
    }], 'and only what makes them different');
    assert.match(warningSentence(w)!, /Squad 05 has 1 the others do not/);
  });

  it('puts the rarest difference first, not the most common', () => {
    const w = reviewWarnings(preview([
      row('Squad 01', [AVAIL, KIT]),
      row('Squad 02', [AVAIL, KIT]),
      row('Squad 03', [AVAIL, ARCHIVE]),
      row('Squad 04', [AVAIL]),
    ]));
    assert.deepEqual(w.shared.map((g) => g.detail), [AVAIL]);
    assert.deepEqual(
      w.differences.map((g) => [g.detail, g.athleteIds.length]),
      [[ARCHIVE, 1], [KIT, 2]],
      'the one only Squad 03 has leads');
  });

  it('handles several kinds of exception at once', () => {
    const w = reviewWarnings(preview([
      row('Squad 01', [AVAIL]),
      row('Squad 02', [AVAIL, KIT]),
      row('Squad 03', [AVAIL, ARCHIVE]),
    ]));
    assert.deepEqual(w.shared.map((g) => g.detail), [AVAIL]);
    assert.equal(w.differences.length, 2);
    assert.deepEqual(w.exceptions.map((e) => [e.athleteName, e.only]), [
      ['Squad 02', [KIT]],
      ['Squad 03', [ARCHIVE]],
    ]);
    assert.match(warningSentence(w)!, /2 athletes differ/);
  });

  it('says nothing when there is nothing to warn about', () => {
    const w = reviewWarnings(preview([row('Squad 01', []), row('Squad 02', [])]));
    assert.deepEqual(w.shared, []);
    assert.deepEqual(w.differences, []);
    assert.deepEqual(w.exceptions, []);
    assert.equal(warningSentence(w), null, 'a clean review says so by staying quiet');
  });

  it('works for a batch of one', () => {
    const w = reviewWarnings(preview([row('Squad 01', [AVAIL, KIT])]));
    assert.equal(w.cohort, 1);
    assert.deepEqual(w.shared.map((g) => g.detail), [AVAIL, KIT],
      'one athlete carrying both means both are shared by everyone being changed');
    assert.deepEqual(w.exceptions, []);
  });

  it('keeps a warning belonging to an athlete who will not change', () => {
    // a blocked athlete is not in the cohort, but their warning is still theirs
    const w = reviewWarnings(preview([
      row('Squad 01', [AVAIL]),
      row('Squad 02', [AVAIL]),
      row('Blocked One', [KIT], 'blocked', ['Their week is already complete.']),
    ]));
    assert.equal(w.cohort, 2, 'two will change');
    assert.deepEqual(w.shared.map((g) => g.detail), [AVAIL]);
    assert.deepEqual(w.differences.map((g) => g.athleteNames), [['Blocked One']],
      'the blocked athlete\'s warning is not swallowed');
  });

  it('does not let an unauthorised athlete make a warning look shared', () => {
    const w = reviewWarnings(preview([
      row('Squad 01', [AVAIL]),
      row('Not Yours', [], 'unauthorised', ['This athlete is not on your roster.']),
    ]));
    assert.equal(w.cohort, 1);
    assert.deepEqual(w.shared.map((g) => g.detail), [AVAIL]);
    assert.equal(w.exceptions.length, 0);
  });

  it('counts an athlete who repeats themselves once', () => {
    const w = reviewWarnings(preview([row('Squad 01', [AVAIL, AVAIL])]));
    assert.equal(w.shared.length, 1);
    assert.equal(w.shared[0].athleteIds.length, 1);
  });

  it('says nothing rather than something wrong when nobody will change', () => {
    const w = reviewWarnings(preview([
      row('Blocked One', [AVAIL], 'blocked', ['Their week is already complete.']),
    ]));
    assert.equal(w.cohort, 0);
    assert.deepEqual(w.shared, [], 'shared-by-all is meaningless when nobody is changing');
    assert.deepEqual(w.differences.map((g) => g.athleteNames), [['Blocked One']]);
  });

  it('never loses a warning, wherever it is put', () => {
    const rows = [
      row('Squad 01', [AVAIL, KIT]),
      row('Squad 02', [AVAIL]),
      row('Squad 03', [AVAIL, ARCHIVE]),
    ];
    const w = reviewWarnings(preview(rows));
    const said = new Set([...w.shared, ...w.differences].map((g) => g.detail));
    const all = new Set(rows.flatMap((r) => r.warnings));
    assert.deepEqual([...said].sort(), [...all].sort(),
      'every sentence the preview produced is stated exactly once');
  });
});

describe('who does not match the group', () => {
  const A = 'Available Monday to Sunday; the programme only uses six days.';
  const B = "Strength work uses a trap bar, which is not on the athlete's list.";
  const ODD = 'The heaviest week trains 6 days; the athlete is available 3.';

  const row = (name: string, warnings: string[]): BatchPreviewRow => ({
    athleteId: name.toLowerCase().replace(/\s+/g, '-'),
    athleteName: name, outcome: 'applied', summary: '10 weeks', warnings, blockers: [],
  });

  it('names the one athlete, not the thirteen who are normal', () => {
    // The failure this replaced: with one athlete missing the common pair,
    // "carries something not shared by all" was true of all fourteen, and the
    // screen announced that fourteen athletes were unusual.
    const rows = [
      ...Array.from({ length: 13 }, (_, i) => row(`Squad ${String(i + 1).padStart(2, '0')}`, [A, B])),
      row('Squad 14', [ODD]),
    ];
    const w = reviewWarnings({ action: 'assign_template', rows });

    assert.deepEqual(w.shared, [], 'nothing is true of all fourteen');
    assert.deepEqual(w.exceptions.map((e) => e.athleteName), ['Squad 14']);
    assert.deepEqual(w.exceptions[0].only, [ODD]);
    assert.match(warningSentence(w)!, /Squad 14 has 1 the others do not/);
  });

  it('leads with the rarest, so the odd one is read first', () => {
    const rows = [
      ...Array.from({ length: 13 }, (_, i) => row(`Squad ${String(i + 1).padStart(2, '0')}`, [A, B])),
      row('Squad 14', [ODD]),
    ];
    const w = reviewWarnings({ action: 'assign_template', rows });
    assert.equal(w.differences[0].detail, ODD, 'the one-athlete warning is first');
    assert.equal(w.differences[0].athleteIds.length, 1);
    assert.equal(w.differences.at(-1)!.athleteIds.length, 13);
  });

  it('treats an athlete with FEWER warnings as unremarkable, not as an exception', () => {
    const rows = [row('Squad 01', [A]), row('Squad 02', [A]), row('Squad 03', [])];
    const w = reviewWarnings({ action: 'assign_template', rows });
    assert.deepEqual(w.exceptions, [],
      'there is nothing to warn a coach about on an athlete with no warnings');
  });
});
