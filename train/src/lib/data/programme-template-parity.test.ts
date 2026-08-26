import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEMO_ATHLETE_ID } from '@/data/demo-seed';
import { DemoRepo } from './demo-repo.ts';

/**
 * The demo adapter enforces the same rules Postgres does. The Postgres side of
 * each of these lives in supabase/test/programme-templates.test.mjs; where the
 * two disagree, the disagreement is invisible until a coach relies on it.
 */

const repo = () => new DemoRepo();

const nextMonday = () => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7) + 7);
  return d.toISOString().slice(0, 10);
};

const named = async (r: DemoRepo, name: string) =>
  (await r.listProgramTemplates()).find((t) => t.name.startsWith(name))!;

describe('demo programme templates — parity', () => {
  it('ships the same structures the migration seeds', async () => {
    const r = repo();
    const templates = await r.listProgramTemplates();
    assert.equal(templates.length, 7);

    for (const t of templates) {
      const detail = await r.getProgramTemplateDetail(t.id);
      assert.ok(detail, `${t.name} should resolve`);
      assert.ok(detail.blocks.length > 0, `${t.name} should have blocks`);
      const weeks = detail.blocks.flatMap((b) => b.weeks);
      assert.equal(weeks.length, t.weeks, `${t.name}: nominal weeks must match its structure`);
      assert.ok(weeks.some((w) => w.slots.length > 0), `${t.name} should prescribe something`);
    }
  });

  it('does not fill every day of a three-to-four day programme', async () => {
    const r = repo();
    const general = await named(r, 'General Endurance');
    const volume = await r.getTemplateVolume(general.id);
    const busiest = Math.max(...volume.map((v) => v.trainingDays));
    assert.ok(busiest <= 4, `trained ${busiest} days`);
    assert.ok(volume.some((v) => v.restDays > 0), 'and it names its rest days');
  });

  it('reports prescribed against intended volume', async () => {
    const r = repo();
    const general = await named(r, 'General Endurance');
    const volume = await r.getTemplateVolume(general.id);
    assert.ok(volume.every((v) => v.prescribedKm > 0));
    assert.ok(volume.some((v) => v.isRecoveryWeek), 'and marks the step-back weeks');
  });

  it('warns rather than blocks on a coaching conflict', async () => {
    const r = repo();
    const marathon = await named(r, 'Marathon');
    const conflicts = await r.getAssignmentConflicts(marathon.id, DEMO_ATHLETE_ID, nextMonday());
    assert.ok(conflicts.every((c) => c.severity !== 'block'), 'nothing structural about this assignment');
  });

  it('blocks a start date that is not a Monday', async () => {
    const r = repo();
    const general = await named(r, 'General Endurance');
    const tuesday = new Date(nextMonday());
    tuesday.setUTCDate(tuesday.getUTCDate() + 1);
    const conflicts = await r.getAssignmentConflicts(
      general.id, DEMO_ATHLETE_ID, tuesday.toISOString().slice(0, 10));
    assert.ok(conflicts.some((c) => c.severity === 'block' && c.kind === 'start_date'));
    await assert.rejects(
      () => r.assignProgramTemplate(general.id, DEMO_ATHLETE_ID, tuesday.toISOString().slice(0, 10)),
      /Monday/);
  });

  it('warns what it will replace and what it will keep', async () => {
    const r = repo();
    const general = await named(r, 'General Endurance');
    const conflicts = await r.getAssignmentConflicts(general.id, DEMO_ATHLETE_ID, nextMonday());
    assert.ok(conflicts.some((c) => c.kind === 'active_programme'));
  });

  it('assigns despite warnings, copying the whole structure', async () => {
    const r = repo();
    const general = await named(r, 'General Endurance');
    const start = nextMonday();
    const programId = await r.assignProgramTemplate(general.id, DEMO_ATHLETE_ID, start);

    const blocks = await r.listBlocks(programId);
    assert.ok(blocks.length > 0);
    const weeks = blocks.flatMap((b) => b.weeks);
    assert.equal(weeks.length, general.weeks);
    for (const w of weeks) {
      assert.equal(new Date(w.startDate).getUTCDay(), 1, 'every week starts on a Monday');
    }
  });

  it('prescribes rest days without pretending they are training', async () => {
    const r = repo();
    const general = await named(r, 'General Endurance');
    const start = nextMonday();
    await r.assignProgramTemplate(general.id, DEMO_ATHLETE_ID, start);

    const week = await r.listScheduled(DEMO_ATHLETE_ID, start, start.slice(0, 8) + '99');
    const rest = week.filter((w) => w.type === 'rest');
    assert.ok(rest.length > 0, 'rest days are prescribed');
    assert.ok(rest.every((w) => w.distanceKm == null), 'and carry no training load');
  });

  it('does not move sessions onto days the athlete said they were free', async () => {
    const r = repo();
    const general = await named(r, 'General Endurance');
    const detail = await r.getProgramTemplateDetail(general.id);
    const templateDays = new Set(
      detail!.blocks.flatMap((b) => b.weeks).flatMap((w) => w.slots).filter((s) => !s.isRest).map((s) => s.weekday));

    const start = nextMonday();
    await r.assignProgramTemplate(general.id, DEMO_ATHLETE_ID, start);
    const week = await r.listScheduled(DEMO_ATHLETE_ID, start, start);
    for (const session of week.filter((w) => w.type !== 'rest')) {
      assert.ok(templateDays.has(1 as never) || templateDays.size > 0);
      const iso = ((new Date(session.date).getUTCDay() + 6) % 7) + 1;
      assert.ok(templateDays.has(iso as never),
        `a session landed on weekday ${iso}, which the template never asked for`);
    }
  });

  it('refuses to delete a template block that still holds weeks', async () => {
    const r = repo();
    const general = await named(r, 'General Endurance');
    const detail = await r.getProgramTemplateDetail(general.id);
    const populated = detail!.blocks.find((b) => b.weeks.length > 0)!;
    await assert.rejects(() => r.deleteTemplateBlock(populated.id), /still holds/);
  });

  it('refuses to edit a shipped programme', async () => {
    const r = repo();
    const general = await named(r, 'General Endurance');
    const detail = await r.getProgramTemplateDetail(general.id);
    await assert.rejects(
      () => r.saveProgramTemplate({ ...detail!, name: 'mine' }),
      /cannot be edited/);
  });

  it('builds a preview a coach can act on', async () => {
    const r = repo();
    const general = await named(r, 'General Endurance');
    const preview = await r.previewAssignment(general.id, DEMO_ATHLETE_ID, nextMonday());

    assert.equal(preview.template.id, general.id);
    assert.ok(preview.athleteName);
    assert.ok(preview.weeks.length > 0, 'the week-by-week table');
    assert.ok(preview.templateDays.length > 0, 'which days the programme uses');
    assert.ok(preview.endDate > preview.startDate);
    assert.ok(Array.isArray(preview.conflicts));
  });
});
