import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { DEMO_ATHLETE_ID } from '@/data/demo-seed';
import { DemoRepo, resetDemoData } from './demo-repo.ts';
import { summarise } from '@/lib/domain/adaptation';

/**
 * The demo adapter enforces the same adaptation rules Postgres does. The
 * Postgres side is supabase/test/adaptation.test.mjs; these keep the two from
 * drifting, which is the only way the difference would ever be noticed.
 */

const iso = (d: Date) => d.toISOString().slice(0, 10);
const nextMonday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 7);
  return iso(d);
};
const plus = (date: string, days: number) => {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
};

// demo state lives in the module, so each case starts from the seed
beforeEach(() => resetDemoData());

async function onProgramme() {
  const repo = new DemoRepo();
  const general = (await repo.listProgramTemplates()).find((t) => t.name === 'General Endurance')!;
  const start = nextMonday();
  const programId = await repo.assignProgramTemplate(general.id, DEMO_ATHLETE_ID, start);
  const sessions = (await repo.listScheduled(DEMO_ATHLETE_ID, start, plus(start, 6)))
    .filter((w) => w.type !== 'rest');
  return { repo, programId, start, sessions };
}

describe('demo adaptation — parity', () => {
  it('moves a session and re-homes it in the week it lands in', async () => {
    const { repo, programId, sessions } = await onProgramme();
    const s = sessions[0];
    const target = plus(s.date, 9);

    await repo.moveSession(s.id, target, 9);

    const moved = await repo.getScheduled(s.id);
    assert.equal(moved?.date, target);

    const blocks = await repo.listBlocks(programId);
    const week = blocks.flatMap((b) => b.weeks).find((w) => w.id === moved?.programWeekId);
    assert.ok(week, 'it belongs to a week');
    assert.ok(target >= week.startDate && target < plus(week.startDate, 7),
      'and that week actually contains it');
  });

  it('refuses to move onto an occupied slot', async () => {
    const { repo, sessions } = await onProgramme();
    const [a, b] = sessions;
    await assert.rejects(() => repo.moveSession(a.id, b.date, b.slot), /already a session in that slot/i);
  });

  it('refuses to move completed training', async () => {
    const { repo, sessions } = await onProgramme();
    const s = sessions[0];
    await repo.saveScheduled({ ...s, status: 'completed' });
    await assert.rejects(() => repo.moveSession(s.id, plus(s.date, 1), 9), /already completed/i);
  });

  it('refuses to move outside the programme', async () => {
    const { repo, sessions } = await onProgramme();
    const s = sessions[0];
    await assert.rejects(() => repo.moveSession(s.id, plus(s.date, 400), 9), /outside the programme/i);
  });

  it('swaps two sessions', async () => {
    const { repo, sessions } = await onProgramme();
    const [a, b] = sessions;
    await repo.swapSessions(a.id, b.id);
    assert.equal((await repo.getScheduled(a.id))?.date, b.date);
    assert.equal((await repo.getScheduled(b.id))?.date, a.date);
  });

  it('previews a shift without writing anything', async () => {
    const { repo, start, sessions } = await onProgramme();
    const before = sessions.map((s) => [s.id, s.date]);

    const rows = await repo.shiftSessions(DEMO_ATHLETE_ID, start, plus(start, 6), 2, false);
    assert.ok(rows.length > 0);
    assert.ok(rows.some((r) => r.action === 'move'));

    for (const [id, date] of before) {
      assert.equal((await repo.getScheduled(id as string))?.date, date, 'preview writes nothing');
    }
  });

  it('applies exactly what it previewed', async () => {
    const { repo, start } = await onProgramme();
    const preview = await repo.shiftSessions(DEMO_ATHLETE_ID, start, plus(start, 6), 2, false);
    const applied = await repo.shiftSessions(DEMO_ATHLETE_ID, start, plus(start, 6), 2, true);

    assert.deepEqual(
      applied.map((r) => [r.sessionId, r.action]),
      preview.map((r) => [r.sessionId, r.action]));

    for (const row of applied.filter((r) => r.action === 'move')) {
      assert.equal((await repo.getScheduled(row.sessionId))?.date, row.toDate);
    }
  });

  it('never shifts completed training, and says why', async () => {
    const { repo, start, sessions } = await onProgramme();
    const s = sessions[0];
    await repo.saveScheduled({ ...s, status: 'completed' });

    const rows = await repo.shiftSessions(DEMO_ATHLETE_ID, start, plus(start, 6), 3, true);
    const blocked = rows.find((r) => r.sessionId === s.id);
    assert.equal(blocked?.action, 'blocked');
    assert.match(blocked!.detail, /already completed/i);
    assert.equal((await repo.getScheduled(s.id))?.date, s.date);
  });

  it('refuses a zero shift and a backwards range', async () => {
    const { repo, start } = await onProgramme();
    await assert.rejects(() => repo.shiftSessions(DEMO_ATHLETE_ID, start, plus(start, 6), 0, false), /zero/i);
    await assert.rejects(
      () => repo.shiftSessions(DEMO_ATHLETE_ID, plus(start, 6), start, 1, false), /backwards/i);
  });

  it('scales volume and reports what it will not touch', async () => {
    const { repo, start } = await onProgramme();
    const rows = await repo.scaleVolume(DEMO_ATHLETE_ID, start, plus(start, 6), 0.8, false);

    const scaled = rows.filter((r) => r.action === 'scale');
    assert.ok(scaled.length > 0);
    assert.ok(scaled.every((r) => r.toKm! < r.fromKm!));

    const kept = rows.filter((r) => r.action === 'keep');
    assert.ok(kept.some((r) => /rest day|by time/i.test(r.detail)),
      'a coach should see what will not change');
  });

  it('applies the volume change', async () => {
    const { repo, start } = await onProgramme();
    const total = async () =>
      (await repo.listScheduled(DEMO_ATHLETE_ID, start, plus(start, 6)))
        .reduce((sum, w) => sum + (w.distanceKm ?? 0), 0);

    const before = await total();
    await repo.scaleVolume(DEMO_ATHLETE_ID, start, plus(start, 6), 0.8, true);
    assert.ok((await total()) < before);
  });

  it('refuses an absurd adjustment', async () => {
    const { repo, start } = await onProgramme();
    await assert.rejects(() => repo.scaleVolume(DEMO_ATHLETE_ID, start, plus(start, 6), 5, false), /Tripling/i);
    await assert.rejects(() => repo.scaleVolume(DEMO_ATHLETE_ID, start, plus(start, 6), 0, false), /not a volume/i);
  });

  it('summarises a preview the way the confirmation reads it', async () => {
    const { repo, start, sessions } = await onProgramme();
    await repo.saveScheduled({ ...sessions[0], status: 'completed' });

    const rows = await repo.shiftSessions(DEMO_ATHLETE_ID, start, plus(start, 6), 2, false);
    const summary = summarise(rows);
    assert.ok(summary.changing > 0);
    assert.ok(summary.blocked > 0, 'the completed session is counted as refused');
    assert.equal(summary.changing + summary.untouched + summary.blocked, rows.length);
  });

  it('keeps the original prescription after a move', async () => {
    const { repo, sessions } = await onProgramme();
    const s = sessions[0];
    await repo.moveSession(s.id, plus(s.date, 1), 9);

    const history = await repo.getSessionHistory(s.id);
    assert.ok(history.entries.length >= 2);
    assert.equal((history.original as { date?: string })?.date, s.date,
      'revision one still holds the date it was first given');
    assert.equal(history.changed, true);
    assert.equal(history.entries.at(-1)!.headline, 'Moved');
  });

  it('gives the coach the week with what is protected and what has moved', async () => {
    const { repo, programId, sessions } = await onProgramme();
    const s = sessions[0];
    await repo.moveSession(s.id, plus(s.date, 1), 9);
    await repo.saveScheduled({ ...sessions[1], status: 'completed' });

    const blocks = await repo.listBlocks(programId);
    const week = blocks.flatMap((b) => b.weeks)[0];
    const rows = await repo.getWeekAdaptationContext(week.id);

    assert.ok(rows.length > 0);
    const done = rows.find((r) => r.sessionId === sessions[1].id);
    assert.ok(done?.blocker, 'completed training is marked protected');
  });

  it('surfaces the latest check-in as context', async () => {
    const repo = new DemoRepo();
    const context = await repo.getCheckInContext(DEMO_ATHLETE_ID);
    if (context) {
      assert.ok(['none', 'watch', 'attention'].includes(context.attention));
      assert.ok(context.weekStart);
    }
  });
});
