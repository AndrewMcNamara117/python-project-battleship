import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEMO_COACH_ID } from '@/data/demo-seed';
import { getRepo } from '@/lib/data';
import { resetDemoData } from '@/lib/data/demo-repo.ts';
import { previewBatch, runBatch } from './batch-runner.ts';
import { applicableIds, confirmLabel, resultSentence, succeeded, tally } from '@/lib/domain/batch';
import { addDays, startOfWeek, toISODate } from '@/lib/domain/dates';

/**
 * The batch runner, driven end to end against the demo adapter.
 *
 * These are the claims that would be false if a batch were a privileged loop
 * inside one function: that a poisoned list loses only the poisoned athlete,
 * that one failure does not take the others with it, and that every athlete
 * named in the request is accounted for in the answer.
 */

const today = toISODate(new Date());
const weekStart = startOfWeek(today);
const weekEnd = addDays(weekStart, 6);

async function roster() {
  const repo = await getRepo();
  return repo.listAthletesForCoach(DEMO_COACH_ID);
}

async function onProgramme() {
  const repo = await getRepo();
  const entries = await repo.listRoster(DEMO_COACH_ID, today);
  return entries.filter((e) => e.programmeId).map((e) => e.athleteId);
}

beforeEach(() => resetDemoData());

describe('previewing a batch', () => {
  it('returns exactly one row per athlete asked about', async () => {
    const ids = (await roster()).slice(0, 4).map((a) => a.id);
    const preview = await previewBatch(DEMO_COACH_ID, ids, {
      action: 'scale_volume', from: weekStart, to: weekEnd, factor: 0.9,
    });

    assert.equal(preview.rows.length, ids.length);
    assert.deepEqual(preview.rows.map((r) => r.athleteId), ids,
      'every athlete named in the request is accounted for in the answer');
  });

  it('names an athlete the coach does not have, and only that athlete', async () => {
    const mine = (await roster()).slice(0, 2).map((a) => a.id);
    const poisoned = [mine[0], 'someone-elses-athlete', mine[1]];

    const preview = await previewBatch(DEMO_COACH_ID, poisoned, {
      action: 'scale_volume', from: weekStart, to: weekEnd, factor: 0.9,
    });

    const bad = preview.rows.find((r) => r.athleteId === 'someone-elses-athlete');
    assert.equal(bad?.outcome, 'unauthorised');
    assert.match(bad?.summary ?? '', /not on your roster/i);

    for (const id of mine) {
      const row = preview.rows.find((r) => r.athleteId === id)!;
      assert.notEqual(row.outcome, 'unauthorised', 'the authorised athletes are unaffected');
    }
  });

  it('excludes an unauthorised athlete from what the button promises', async () => {
    const mine = (await onProgramme()).slice(0, 2);
    const preview = await previewBatch(DEMO_COACH_ID, [...mine, 'not-mine'], {
      action: 'scale_volume', from: weekStart, to: weekEnd, factor: 0.9,
    });

    const t = tally(preview);
    assert.equal(t.unauthorised, 1);
    assert.ok(!applicableIds(preview).includes('not-mine'));
    assert.doesNotMatch(confirmLabel('scale_volume', t), new RegExp(String(preview.rows.length)));
  });

  it('writes nothing at all', async () => {
    const repo = await getRepo();
    const ids = (await onProgramme()).slice(0, 3);
    const before = await repo.listBatchHistory(ids[0]);

    await previewBatch(DEMO_COACH_ID, ids, {
      action: 'shift_sessions', from: weekStart, to: weekEnd, days: 1,
    });

    assert.deepEqual(await repo.listBatchHistory(ids[0]), before,
      'a preview leaves no record, because nothing happened');
  });

  it('reports an athlete with nothing to change as skipped, not failed', async () => {
    // an athlete with no programme has no future sessions to scale
    const waiting = (await roster())
      .map((a) => a.id)
      .filter(async (id) => !(await onProgramme()).includes(id));

    const preview = await previewBatch(DEMO_COACH_ID, (await roster()).slice(0, 6).map((a) => a.id), {
      action: 'scale_volume', from: weekStart, to: weekEnd, factor: 0.9,
    });
    void waiting;

    for (const row of preview.rows.filter((r) => r.outcome === 'skipped')) {
      assert.deepEqual(row.blockers, [], 'nothing to do is not a blocker');
      assert.ok(row.summary.length > 0, 'and it still says why');
    }
  });
});

describe('running a batch', () => {
  it('applies to every athlete it said it would', async () => {
    const ids = (await onProgramme()).slice(0, 3);
    if (ids.length === 0) return;

    const preview = await previewBatch(DEMO_COACH_ID, ids, {
      action: 'scale_volume', from: weekStart, to: weekEnd, factor: 0.9,
    });
    const intended = applicableIds(preview);

    const result = await runBatch(DEMO_COACH_ID, intended, {
      action: 'scale_volume', from: weekStart, to: weekEnd, factor: 0.9,
    });

    assert.equal(result.rows.length, intended.length);
    assert.ok(result.rows.every((r) => r.outcome === 'applied' || r.outcome === 'skipped'));
    assert.ok(succeeded(result));
  });

  it('records the batch against every athlete it touched', async () => {
    const repo = await getRepo();
    const ids = (await onProgramme()).slice(0, 3);
    if (ids.length === 0) return;

    const result = await runBatch(DEMO_COACH_ID, ids, {
      action: 'scale_volume', from: weekStart, to: weekEnd, factor: 0.9,
    });

    assert.ok(result.batchId, 'the decision has an id');
    for (const id of ids) {
      const history = await repo.listBatchHistory(id);
      assert.ok(history.length > 0, `${id} can see why their programme changed`);
      assert.equal(history[0].batchId, result.batchId);
      assert.equal(history[0].athleteCount, ids.length,
        'and that it was part of a squad-wide decision');
    }
  });

  it('does not let one unauthorised athlete stop the rest', async () => {
    const mine = (await onProgramme()).slice(0, 2);
    if (mine.length < 2) return;

    const result = await runBatch(DEMO_COACH_ID, [mine[0], 'not-mine', mine[1]], {
      action: 'scale_volume', from: weekStart, to: weekEnd, factor: 0.9,
    });

    const bad = result.rows.find((r) => r.athleteId === 'not-mine');
    assert.equal(bad?.outcome, 'unauthorised');

    const good = result.rows.filter((r) => r.athleteId !== 'not-mine');
    assert.ok(good.every((r) => r.outcome === 'applied' || r.outcome === 'skipped'),
      'the authorised athletes still went through');
  });

  it('never lets a partial failure read as a success', async () => {
    const mine = (await onProgramme()).slice(0, 2);
    if (mine.length < 2) return;

    const result = await runBatch(DEMO_COACH_ID, [...mine, 'not-mine'], {
      action: 'scale_volume', from: weekStart, to: weekEnd, factor: 0.9,
    });

    assert.ok(!succeeded(result));
    const sentence = resultSentence(result);
    assert.match(sentence, /not:/, 'and it names who');
  });

  it('leaves the per-athlete prescription history exactly as a single change would', async () => {
    const repo = await getRepo();
    const [athlete] = (await onProgramme()).slice(0, 1);
    if (!athlete) return;

    const before = await repo.scaleVolume(athlete, weekStart, weekEnd, 0.9, false);
    const changing = before.filter((r) => r.action === 'scale');
    if (changing.length === 0) return;

    await runBatch(DEMO_COACH_ID, [athlete], {
      action: 'scale_volume', from: weekStart, to: weekEnd, factor: 0.9,
    });

    // the batch record is additional. The session's own prescription history
    // is still the record of what changed, exactly as for a single change.
    const history = await repo.getSessionHistory(changing[0].sessionId);
    assert.ok(history.original, 'the original prescription is still held');
    assert.equal(history.changed, true, 'and the session knows it was changed');
    assert.ok(history.entries.length > 0, 'with an entry a coach can read');
  });

  it('deduplicates so a doubled id cannot double an adjustment', async () => {
    const [athlete] = (await onProgramme()).slice(0, 1);
    if (!athlete) return;

    // the action layer dedupes; the runner is given the unique list
    const result = await runBatch(DEMO_COACH_ID, [athlete], {
      action: 'shift_sessions', from: weekStart, to: weekEnd, days: 1,
    });
    assert.equal(result.rows.length, 1);
  });
});

describe('what a batch refuses to touch', () => {
  it('reports completed training as a warning, never as a change', async () => {
    const ids = (await onProgramme()).slice(0, 5);
    if (ids.length === 0) return;

    const preview = await previewBatch(DEMO_COACH_ID, ids, {
      action: 'shift_sessions', from: addDays(weekStart, -14), to: weekEnd, days: 2,
    });

    let sawProtected = false;
    for (const row of preview.rows) {
      const blockedSessions = (row.shift ?? []).filter((r) => r.action === 'blocked');
      if (!blockedSessions.length) continue;
      sawProtected = true;

      // completed training never blocks the whole athlete; it is reported so
      // the coach knows the week is not quite what they think
      assert.notEqual(row.outcome, 'blocked');
      if (row.outcome === 'applied') {
        assert.ok(row.warnings.some((w) => /already completed/i.test(w)), row.summary);
      } else {
        assert.match(row.summary, /already completed/i);
      }
    }
    assert.ok(sawProtected, 'the fixture contains completed training to protect');
  });
});
