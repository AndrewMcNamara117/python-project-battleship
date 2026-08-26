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
const shape = (row) => Object.fromEntries(
  Object.entries(row)
    .filter(([, v]) => v !== null)
    .map(([k, v]) => [camel(k), typeof v === 'string' && /^-?\d+\.\d+$/.test(v) ? Number(v) : v]),
);

const q = async (sql) => (await t.asService(sql)).rows;

const workouts = await q(`select * from workout_templates where visibility='system' order by name`);
const exercises = await q(`select * from strength_exercises where visibility='system' order by name`);
const strength = await q(`select * from strength_templates where visibility='system' order by name`);
const components = await q(`select * from template_components order by position`);

const byParent = (key, id) => components.filter((c) => c[key] === id).map((c) => {
  const { id: _i, workoutTemplateId: _w, strengthTemplateId: _s, createdAt: _c, ...rest } = shape(c);
  return rest;
});

const out = `// GENERATED FILE — do not edit.
// Regenerate with: node --experimental-strip-types scripts/generate-demo-library.mjs
//
// The demo adapter's copy of the shipped library, dumped from the migration
// that seeds the real database. Demo mode has no Postgres, and a second
// hand-written copy of these sessions would drift; this one cannot.

import type { StrengthExercise, StrengthTemplate, WorkoutTemplate } from '@/lib/domain/library';

export const DEMO_WORKOUT_TEMPLATES: WorkoutTemplate[] = ${JSON.stringify(
  workouts.map((w) => ({ ...shape(w), ownerId: null, archivedAt: null, tags: w.tags ?? [], components: byParent('workout_template_id', w.id) })), null, 2)} as unknown as WorkoutTemplate[];

export const DEMO_STRENGTH_EXERCISES: StrengthExercise[] = ${JSON.stringify(
  exercises.map((e) => ({ ...shape(e), ownerId: null, archivedAt: null, tags: e.tags ?? [] })), null, 2)} as unknown as StrengthExercise[];

export const DEMO_STRENGTH_TEMPLATES: StrengthTemplate[] = ${JSON.stringify(
  strength.map((s) => ({ ...shape(s), ownerId: null, archivedAt: null, tags: s.tags ?? [], components: byParent('strength_template_id', s.id) })), null, 2)} as unknown as StrengthTemplate[];
`;

writeFileSync(new URL('../src/data/demo-library.generated.ts', import.meta.url), out);
await t.close();
console.log(`wrote ${workouts.length} workouts, ${exercises.length} exercises, ${strength.length} strength templates`);
