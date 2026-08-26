import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { DEMO_ATHLETE_ID } from '@/data/demo-seed';
import { DemoRepo } from './demo-repo.ts';

/**
 * Demo mode is the fallback when there is no database, so it has to enforce the
 * same rules Postgres does. Where the two adapters disagree, the disagreement
 * is invisible until someone relies on it — these tests are what keeps them
 * honest. The Postgres side of each guarantee lives in
 * supabase/test/libraries.test.mjs.
 */

const anyRepo = () => new DemoRepo();

describe('demo library — parity with the database', () => {
  it('ships the same system content the migration seeds', async () => {
    const repo = anyRepo();
    assert.equal((await repo.listWorkoutTemplates()).length, 16);
    assert.equal((await repo.listStrengthExercises()).length, 20);
    assert.equal((await repo.listStrengthTemplates()).length, 6);
  });

  it('refuses to edit system content', async () => {
    const repo = anyRepo();
    const [tpl] = await repo.listWorkoutTemplates();
    await assert.rejects(
      () => repo.saveWorkoutTemplate({ ...tpl, name: 'mine' }),
      /System library content cannot be edited/,
    );
    await assert.rejects(() => repo.setLibraryArchived('workout', tpl.id, true), /cannot be edited/);
  });

  it('duplicates into a private copy the coach owns', async () => {
    const repo = anyRepo();
    const [tpl] = await repo.listWorkoutTemplates();
    const copyId = await repo.duplicateLibraryItem('workout', tpl.id, 'My version');
    const copy = await repo.getWorkoutTemplate(copyId);
    assert.equal(copy?.name, 'My version');
    assert.equal(copy?.visibility, 'private');
    assert.ok(copy?.ownerId, 'a copy is always owned');
  });

  it('archives and restores rather than deleting', async () => {
    const repo = anyRepo();
    const [tpl] = await repo.listWorkoutTemplates();
    const id = await repo.duplicateLibraryItem('workout', tpl.id);

    await repo.setLibraryArchived('workout', id, true);
    const listed = await repo.listWorkoutTemplates();
    assert.ok(!listed.some((t) => t.id === id), 'archived items leave the picker');
    assert.ok(
      (await repo.listWorkoutTemplates({ includeArchived: true })).some((t) => t.id === id),
      'but are still there',
    );

    await assert.rejects(
      () => repo.insertTemplateIntoProgramme('workout', id, DEMO_ATHLETE_ID, '2026-08-31'),
      /archived/i,
    );

    await repo.setLibraryArchived('workout', id, false);
    assert.ok(await repo.insertTemplateIntoProgramme('workout', id, DEMO_ATHLETE_ID, '2026-08-31'));
  });

  it('copies a template into a session that the template can no longer reach', async () => {
    const repo = anyRepo();
    const source = (await repo.listWorkoutTemplates()).find((t) => (t.components?.length ?? 0) > 0)
      ?? (await repo.listWorkoutTemplates())[0];
    const mine = await repo.duplicateLibraryItem('workout', source.id);

    const sessionId = await repo.insertTemplateIntoProgramme('workout', mine, DEMO_ATHLETE_ID, '2026-09-07');
    const before = await repo.getScheduled(sessionId);
    assert.ok(before);
    assert.equal(before.sourceWorkoutTemplateId, mine, 'provenance is recorded');

    const template = await repo.getWorkoutTemplate(mine);
    await repo.saveWorkoutTemplate({ ...template!, name: 'Rewritten', distanceKm: 99 });

    const after = await repo.getScheduled(sessionId);
    assert.equal(after?.name, before.name, 'the prescribed session is untouched');
    assert.equal(after?.distanceKm, before.distanceKm);
    assert.equal(after?.sourceWorkoutTemplateId, mine, 'and still records where it came from');
  });

  it('copies strength components in order', async () => {
    const repo = anyRepo();
    const tpl = (await repo.listStrengthTemplates()).find((t) => (t.components?.length ?? 0) > 1);
    assert.ok(tpl, 'a seeded strength template should carry exercises');
    const sessionId = await repo.insertTemplateIntoProgramme('strength', tpl.id, DEMO_ATHLETE_ID, '2026-09-14');
    const components = await repo.listComponents(sessionId);
    assert.equal(components.length, tpl.components!.length);
    assert.deepEqual(components.map((c) => c.position), components.map((_, i) => i));
    assert.deepEqual(
      components.map((c) => c.label),
      tpl.components!.map((c) => c.label),
      'order is the prescription',
    );
  });

  it('filters by search, category and tag the way the query does', async () => {
    const repo = anyRepo();
    const all = await repo.listWorkoutTemplates();
    const target = all[0];

    const found = await repo.listWorkoutTemplates({ search: target.name.slice(0, 6) });
    assert.ok(found.some((t) => t.id === target.id));

    const byCategory = await repo.listWorkoutTemplates({ category: target.category });
    assert.ok(byCategory.every((t) => t.category === target.category));
    assert.ok(byCategory.length > 0);
  });

  it('reports week volume against the coach intent', async () => {
    const repo = anyRepo();
    const program = await repo.getProgram(DEMO_ATHLETE_ID);
    assert.ok(program, 'the demo athlete has a programme');
    const blocks = await repo.listBlocks(program.id);
    const week = blocks.flatMap((b) => b.weeks)[0];
    assert.ok(week);

    const volume = await repo.getWeekVolume(week.id);
    assert.equal(volume.targetKm, week.targetVolumeKm);
    assert.ok(volume.prescribedKm >= 0);
    assert.equal(typeof volume.sessionCount, 'number');
  });

  it('refuses to delete a block that still holds weeks or sessions', async () => {
    const repo = anyRepo();
    const program = await repo.getProgram(DEMO_ATHLETE_ID);
    const blocks = await repo.listBlocks(program!.id);
    const populated = blocks.find((b) => b.weeks.length > 0);
    assert.ok(populated, 'the demo programme has a populated block');

    await assert.rejects(() => repo.deleteBlock(populated.id), /Archive it instead|still holds/);
    assert.ok((await repo.listBlocks(program!.id)).some((b) => b.id === populated.id), 'it survives');
  });
});
