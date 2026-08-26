/**
 * Regenerate the demo-mode library fixture from the migration.
 *
 * Demo mode needs library content in memory, but a second hand-maintained copy
 * of the shipped sessions would drift from the database silently. So this runs
 * the real migrations and dumps what they seeded.
 *
 *   node --experimental-strip-types scripts/generate-demo-library.mjs
 */
import { writeFileSync } from 'node:fs';
import { createTestDatabase } from '../supabase/test/harness.mjs';

const t = await createTestDatabase();

const camel = (s) => s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());

const q = async (sql) => (await t.asService(sql)).rows;

/**
 * Postgres returns numeric as a string, to avoid the precision float would
 * lose. The fixture needs real numbers — a distance that arrives as "27" sums
 * by concatenation and nothing complains until a total reads 82712.
 *
 * Which columns those are is asked rather than guessed: a reps column holding
 * "8" is text and must stay text.
 */
const NUMERIC = new Set(
  (await q(`select table_name || '.' || column_name c from information_schema.columns
             where table_schema = 'public' and data_type = 'numeric'`)).map((r) => r.c),
);

const shape = (row, table) => Object.fromEntries(
  Object.entries(row)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => [camel(k), NUMERIC.has(`${table}.${k}`) ? Number(v) : v]),
);

const workouts = await q(`select * from workout_templates where visibility='system' order by name`);
const exercises = await q(`select * from strength_exercises where visibility='system' order by name`);
const strength = await q(`select * from strength_templates where visibility='system' order by name`);
const programs = await q(`select * from program_templates where visibility='system' order by weeks`);
const components = await q(`select * from template_components order by position`);
const tBlocks = await q(`select * from program_template_blocks order by program_template_id, block_index`);
const tWeeks = await q(`select * from program_template_weeks order by program_template_id, template_week_no`);
const tSlots = await q(`select * from program_template_slots order by template_week_id, weekday, slot`);

const byParent = (key, id) => components.filter((c) => c[key] === id).map((c) => {
  const { id: _i, workoutTemplateId: _w, strengthTemplateId: _s, createdAt: _c, ...rest } = shape(c, 'template_components');
  return rest;
});

const out = `// GENERATED FILE — do not edit.
// Regenerate with: node --experimental-strip-types scripts/generate-demo-library.mjs
//
// The demo adapter's copy of the shipped library, dumped from the migration
// that seeds the real database. Demo mode has no Postgres, and a second
// hand-written copy of these sessions would drift; this one cannot.

import type {
  ProgramTemplateItem,
  StrengthExercise,
  StrengthTemplate,
  WorkoutTemplate,
} from '@/lib/domain/library';
import type {
  ProgramTemplateBlock,
  ProgramTemplateSlot,
  ProgramTemplateWeek,
} from '@/lib/domain/programme-template';

export const DEMO_WORKOUT_TEMPLATES: WorkoutTemplate[] = ${JSON.stringify(
  workouts.map((w) => ({ ...shape(w, 'workout_templates'), ownerId: null, archivedAt: null, tags: w.tags ?? [], components: byParent('workout_template_id', w.id) })), null, 2)} as unknown as WorkoutTemplate[];

export const DEMO_STRENGTH_EXERCISES: StrengthExercise[] = ${JSON.stringify(
  exercises.map((e) => ({ ...shape(e, 'strength_exercises'), ownerId: null, archivedAt: null, tags: e.tags ?? [] })), null, 2)} as unknown as StrengthExercise[];

export const DEMO_STRENGTH_TEMPLATES: StrengthTemplate[] = ${JSON.stringify(
  strength.map((s) => ({ ...shape(s, 'strength_templates'), ownerId: null, archivedAt: null, tags: s.tags ?? [], components: byParent('strength_template_id', s.id) })), null, 2)} as unknown as StrengthTemplate[];

export const DEMO_PROGRAM_TEMPLATES: ProgramTemplateItem[] = ${JSON.stringify(
  programs.map((p) => ({ ...shape(p, 'program_templates'), ownerId: null, archivedAt: null, tags: p.tags ?? [] })), null, 2)} as unknown as ProgramTemplateItem[];

export const DEMO_TEMPLATE_BLOCKS: ProgramTemplateBlock[] = ${JSON.stringify(
  tBlocks.map((b) => shape(b, 'program_template_blocks')), null, 2)} as unknown as ProgramTemplateBlock[];

export const DEMO_TEMPLATE_WEEKS: ProgramTemplateWeek[] = ${JSON.stringify(
  tWeeks.map((w) => ({ ...shape(w, 'program_template_weeks'), isRecoveryWeek: w.is_recovery_week })), null, 2)} as unknown as ProgramTemplateWeek[];

export const DEMO_TEMPLATE_SLOTS: ProgramTemplateSlot[] = ${JSON.stringify(
  tSlots.map((s) => ({ ...shape(s, 'program_template_slots'), isRest: s.is_rest, isOptional: s.is_optional })), null, 2)} as unknown as ProgramTemplateSlot[];
`;

writeFileSync(new URL('../src/data/demo-library.generated.ts', import.meta.url), out);
await t.close();
console.log(
  `wrote ${workouts.length} workouts, ${exercises.length} exercises, ` +
    `${strength.length} strength templates, ${programs.length} programmes ` +
    `(${tBlocks.length} blocks, ${tWeeks.length} weeks, ${tSlots.length} slots)`,
);
