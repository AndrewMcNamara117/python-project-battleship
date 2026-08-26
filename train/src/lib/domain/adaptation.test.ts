import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildSessionHistory, describeHistory, summarise } from './adaptation.ts';
import type { SessionRevisionRow } from './adaptation.ts';

/**
 * History is the part a coach reads, so the wording is the product. These
 * tests are about what it says, not that it says something.
 */

const rev = (
  revision: number,
  kind: SessionRevisionRow['kind'],
  session: Record<string, unknown>,
  changedByName: string | null = 'R. Doyle',
): SessionRevisionRow => ({
  revision,
  kind,
  changedAt: `2026-09-0${revision}T10:00:00.000Z`,
  changedBy: changedByName ? 'coach-1' : null,
  changedByName,
  session,
  note: null,
});

describe('session history', () => {
  it('opens with what was prescribed, and says nothing changed yet', () => {
    const history = buildSessionHistory([
      rev(1, 'created', { name: 'Easy Run', date: '2026-09-01', distance_km: 8 }),
    ]);
    assert.equal(history.entries.length, 1);
    assert.equal(history.entries[0].headline, 'Prescribed');
    assert.deepEqual(history.entries[0].changes, []);
    assert.equal(history.changed, false);
  });

  it('names the fields that changed, in coach language', () => {
    const entries = describeHistory([
      rev(1, 'created', { name: 'Easy Run', date: '2026-09-01', distance_km: 8, rpe_target: 3 }),
      rev(2, 'edited', { name: 'Easy Run', date: '2026-09-01', distance_km: 10, rpe_target: 4 }),
    ]);
    assert.equal(entries[1].headline, 'Changed');
    assert.deepEqual(entries[1].changes, ['Distance: 8 km → 10 km', 'RPE: 3 → 4']);
  });

  it('reads a move as a move, with readable dates', () => {
    const entries = describeHistory([
      rev(1, 'created', { name: 'Long Run', date: '2026-09-06' }),
      rev(2, 'moved', { name: 'Long Run', date: '2026-09-05' }),
    ]);
    assert.equal(entries[1].headline, 'Moved');
    assert.deepEqual(entries[1].changes, ['Date: 6 Sept → 5 Sept'],
      'dates read the way they do everywhere else in the app');
  });

  it('says "nothing" rather than null when a field is cleared', () => {
    const entries = describeHistory([
      rev(1, 'created', { name: 'Threshold', coach_note: 'Ease into it' }),
      rev(2, 'edited', { name: 'Threshold', coach_note: null }),
    ]);
    assert.deepEqual(entries[1].changes, ['Note to athlete: Ease into it → nothing']);
  });

  it('ignores database noise a coach would not care about', () => {
    const entries = describeHistory([
      rev(1, 'created', { name: 'Easy Run', updated_at: '2026-09-01', prescription_revision: 1, id: 'x' }),
      rev(2, 'edited', { name: 'Easy Run', updated_at: '2026-09-02', prescription_revision: 2, id: 'x' }),
    ]);
    assert.deepEqual(entries[1].changes, [], 'nothing here is worth a coach reading');
  });

  it('attributes a change to a person, and the system when there is none', () => {
    const entries = describeHistory([
      rev(1, 'created', { name: 'Easy Run' }, null),
      rev(2, 'edited', { name: 'Steady Run' }, 'R. Doyle'),
    ]);
    assert.equal(entries[0].by, 'Iron Miles');
    assert.equal(entries[1].by, 'R. Doyle');
  });

  it('keeps the original prescription whatever happens after it', () => {
    const history = buildSessionHistory([
      rev(1, 'created', { name: 'Easy Run', date: '2026-09-01', distance_km: 8 }),
      rev(2, 'moved', { name: 'Easy Run', date: '2026-09-03', distance_km: 8 }),
      rev(3, 'edited', { name: 'Recovery Run', date: '2026-09-03', distance_km: 6 }),
    ]);
    assert.equal(history.original?.name, 'Easy Run');
    assert.equal(history.original?.date, '2026-09-01');
    assert.equal(history.changed, true);
  });

  it('does not call a session changed when only its status moved', () => {
    const history = buildSessionHistory([
      rev(1, 'created', { name: 'Easy Run', status: 'scheduled' }),
      rev(2, 'status_changed', { name: 'Easy Run', status: 'completed' }),
    ]);
    assert.equal(history.entries[1].headline, 'Status changed');
    assert.deepEqual(history.entries[1].changes, ['Status: scheduled → completed']);
    assert.equal(history.changed, false, 'the athlete completing it is not a coach changing it');
  });
});

describe('adaptation summary', () => {
  it('counts what changes, what does not, and what is refused', () => {
    const summary = summarise([
      { action: 'move' }, { action: 'move' }, { action: 'scale' },
      { action: 'keep' },
      { action: 'blocked' }, { action: 'blocked' },
    ]);
    assert.deepEqual(summary, { changing: 3, untouched: 1, blocked: 2 });
  });

  it('is all zeroes for an empty range', () => {
    assert.deepEqual(summarise([]), { changing: 0, untouched: 0, blocked: 0 });
  });
});
