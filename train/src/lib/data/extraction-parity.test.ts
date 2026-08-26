import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEMO_ATHLETE_ID } from '@/data/demo-seed';
import { DemoRepo } from './demo-repo.ts';

/**
 * Saving a programme as a template, in demo mode.
 *
 * The Postgres side lives in supabase/test/programme-extraction.test.mjs.
 * These hold the demo adapter to the same rules, because a preview that
 * differs between the two is a preview nobody could trust.
 */

const nextMonday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 7);
  return d.toISOString().slice(0, 10);
};

/** A repo with the demo athlete on a freshly assigned programme. */
async function onProgramme() {
  const repo = new DemoRepo();
  const general = (await repo.listProgramTemplates()).find((t) => t.name === 'General Endurance')!;
  const programId = await repo.assignProgramTemplate(general.id, DEMO_ATHLETE_ID, nextMonday());
  return { repo, programId, general };
}

describe('demo extraction — parity', () => {
  it('previews the shape that will be saved', async () => {
    const { repo, programId } = await onProgramme();
    const preview = await repo.previewProgrammeExtraction(programId);

    assert.equal(preview.blocks, 2);
    assert.equal(preview.weeks, 12);
    assert.ok(preview.sessions > 0);
    assert.ok(preview.restDays > 0, 'prescribed rest days are counted separately');
    assert.ok(preview.notes.some((n) => n.kind === 'structure' && n.severity === 'info'));
  });

  it('counts training sessions and rest days apart', async () => {
    const { repo, programId } = await onProgramme();
    const preview = await repo.previewProgrammeExtraction(programId);
    const structure = preview.notes.find((n) => n.kind === 'structure');
    const rest = preview.notes.find((n) => n.kind === 'rest');

    assert.equal(structure!.count, preview.sessions, 'the session count is training sessions');
    assert.equal(rest!.count, preview.restDays, 'rest days are their own number');
  });

  it('reads the training frequency off what was built', async () => {
    const { repo, programId } = await onProgramme();
    const preview = await repo.previewProgrammeExtraction(programId);
    assert.equal(preview.minDaysPerWeek, 4);
    assert.equal(preview.maxDaysPerWeek, 4);
    assert.equal(preview.suggested.minDaysPerWeek, 4);
  });

  it('does not put the athlete\'s name in the suggested template name', async () => {
    const { repo, programId } = await onProgramme();
    const preview = await repo.previewProgrammeExtraction(programId);
    assert.doesNotMatch(preview.suggested.name, /Andrew/i);
  });

  it('warns about a session the library does not hold', async () => {
    const { repo, programId } = await onProgramme();
    const [session] = (await repo.listScheduled(DEMO_ATHLETE_ID, nextMonday(), '2099-01-01'))
      .filter((w) => w.type !== 'rest');
    await repo.saveScheduled({ ...session, name: 'Hand Written', sourceWorkoutTemplateId: null });

    const preview = await repo.previewProgrammeExtraction(programId);
    const promote = preview.notes.find((n) => n.kind === 'promote');
    assert.ok(promote, 'a session with no library origin should be flagged');
    assert.equal(promote.severity, 'warn');
  });

  it('warns that coach notes will not travel', async () => {
    const { repo, programId } = await onProgramme();
    const [session] = (await repo.listScheduled(DEMO_ATHLETE_ID, nextMonday(), '2099-01-01'))
      .filter((w) => w.type !== 'rest');
    await repo.saveScheduled({ ...session, coachNote: 'Mind that calf' });

    const preview = await repo.previewProgrammeExtraction(programId);
    assert.ok(preview.notes.some((n) => n.kind === 'notes' && n.severity === 'warn'));
  });

  it('saves the structure faithfully', async () => {
    const { repo, programId } = await onProgramme();
    const preview = await repo.previewProgrammeExtraction(programId);
    const templateId = await repo.extractProgrammeTemplate(programId, {
      ...preview.suggested,
      name: 'Saved From Andrew',
    });

    const detail = await repo.getProgramTemplateDetail(templateId);
    assert.ok(detail);
    assert.equal(detail.blocks.length, preview.blocks);
    const weeks = detail.blocks.flatMap((b) => b.weeks);
    assert.equal(weeks.length, preview.weeks);
    const slots = weeks.flatMap((w) => w.slots);
    assert.equal(slots.length, preview.sessions + preview.restDays);
    assert.equal(slots.filter((s) => s.isRest).length, preview.restDays);
  });

  it('keeps recovery weeks and intended volume', async () => {
    const { repo, programId } = await onProgramme();
    const preview = await repo.previewProgrammeExtraction(programId);
    const templateId = await repo.extractProgrammeTemplate(programId, { ...preview.suggested, name: 'Volume' });

    const detail = await repo.getProgramTemplateDetail(templateId);
    const weeks = detail!.blocks.flatMap((b) => b.weeks);
    assert.ok(weeks.some((w) => w.isRecoveryWeek), 'step-back weeks survive');
    assert.ok(weeks.every((w) => w.targetVolumeKm != null), 'so does the coach\'s intent');
  });

  it('points sessions back at the library rather than cloning it', async () => {
    const { repo, programId } = await onProgramme();
    const before = (await repo.listWorkoutTemplates()).length;

    const preview = await repo.previewProgrammeExtraction(programId);
    const templateId = await repo.extractProgrammeTemplate(programId, { ...preview.suggested, name: 'Provenance' });

    assert.equal((await repo.listWorkoutTemplates()).length, before,
      'a clean programme adds nothing to the library');

    const detail = await repo.getProgramTemplateDetail(templateId);
    const slots = detail!.blocks.flatMap((b) => b.weeks).flatMap((w) => w.slots).filter((s) => !s.isRest);
    assert.ok(slots.every((s) => s.workoutTemplateId || s.strengthTemplateId),
      'every session points at a library item');
  });

  it('promotes a hand-written session once, and only that one', async () => {
    const { repo, programId } = await onProgramme();
    const before = (await repo.listWorkoutTemplates()).length;

    const sessions = (await repo.listScheduled(DEMO_ATHLETE_ID, nextMonday(), '2099-01-01'))
      .filter((w) => w.type !== 'rest')
      .slice(0, 2);
    for (const s of sessions) {
      await repo.saveScheduled({ ...s, name: 'Hand Written', mainSet: 'the same thing', sourceWorkoutTemplateId: null });
    }

    const preview = await repo.previewProgrammeExtraction(programId);
    await repo.extractProgrammeTemplate(programId, { ...preview.suggested, name: 'Promotion' });

    const after = await repo.listWorkoutTemplates();
    assert.equal(after.length, before + 1, 'two identical sessions become one library item');
    assert.ok(after.some((w) => w.name === 'Hand Written'));
  });

  it('records a slot override only where the session actually differs', async () => {
    const { repo, programId } = await onProgramme();
    const [session] = (await repo.listScheduled(DEMO_ATHLETE_ID, nextMonday(), '2099-01-01'))
      .filter((w) => w.type !== 'rest' && w.sourceWorkoutTemplateId);
    await repo.saveScheduled({ ...session, distanceKm: 99 });

    const preview = await repo.previewProgrammeExtraction(programId);
    const templateId = await repo.extractProgrammeTemplate(programId, { ...preview.suggested, name: 'Overrides' });

    const detail = await repo.getProgramTemplateDetail(templateId);
    const slots = detail!.blocks.flatMap((b) => b.weeks).flatMap((w) => w.slots);
    assert.ok(slots.some((s) => s.distanceKm === 99), 'the changed one carries an override');
    assert.ok(slots.some((s) => !s.isRest && s.distanceKm == null), 'the unchanged ones do not');
  });

  it('carries nothing the athlete did or was told', async () => {
    const { repo, programId } = await onProgramme();
    const sessions = (await repo.listScheduled(DEMO_ATHLETE_ID, nextMonday(), '2099-01-01'))
      .filter((w) => w.type !== 'rest');
    await repo.saveScheduled({ ...sessions[0], status: 'completed', coachNote: 'Andrew, ease off' });

    const preview = await repo.previewProgrammeExtraction(programId);
    const templateId = await repo.extractProgrammeTemplate(programId, { ...preview.suggested, name: 'No Leak' });

    const detail = await repo.getProgramTemplateDetail(templateId);
    const blob = JSON.stringify(detail);
    assert.doesNotMatch(blob, /Andrew/i, 'nothing about this athlete belongs in a reusable template');
    assert.doesNotMatch(blob, /ease off/i);
    assert.doesNotMatch(blob, /"completed"/);
  });

  it('leaves the template alone when the programme changes afterwards', async () => {
    const { repo, programId } = await onProgramme();
    const preview = await repo.previewProgrammeExtraction(programId);
    const templateId = await repo.extractProgrammeTemplate(programId, { ...preview.suggested, name: 'Independent' });

    const before = await repo.getProgramTemplateDetail(templateId);
    const beforeSlots = before!.blocks.flatMap((b) => b.weeks).flatMap((w) => w.slots).length;

    const sessions = await repo.listScheduled(DEMO_ATHLETE_ID, nextMonday(), '2099-01-01');
    for (const s of sessions.slice(0, 5)) await repo.deleteScheduled(s.id);

    const after = await repo.getProgramTemplateDetail(templateId);
    assert.equal(after!.blocks.flatMap((b) => b.weeks).flatMap((w) => w.slots).length, beforeSlots);
  });

  it('refuses an empty name and refuses to make shipped content', async () => {
    const { repo, programId } = await onProgramme();
    const preview = await repo.previewProgrammeExtraction(programId);

    await assert.rejects(
      () => repo.extractProgrammeTemplate(programId, { ...preview.suggested, name: '  ' }), /name/i);
    await assert.rejects(
      () => repo.extractProgrammeTemplate(programId, {
        ...preview.suggested, name: 'Shipped', visibility: 'system' as never,
      }), /belongs to the coach/i);
  });

  it('can be assigned straight back out through the Slice 4 flow', async () => {
    const { repo, programId } = await onProgramme();
    const preview = await repo.previewProgrammeExtraction(programId);
    const templateId = await repo.extractProgrammeTemplate(programId, { ...preview.suggested, name: 'Round Trip' });

    const conflicts = await repo.getAssignmentConflicts(templateId, DEMO_ATHLETE_ID, nextMonday());
    assert.ok(conflicts.every((c) => c.severity !== 'block'), 'a saved programme is assignable');

    const again = await repo.assignProgramTemplate(templateId, DEMO_ATHLETE_ID, nextMonday());
    const blocks = await repo.listBlocks(again);
    assert.equal(blocks.length, preview.blocks);
    assert.equal(blocks.flatMap((b) => b.weeks).length, preview.weeks);
  });
});
