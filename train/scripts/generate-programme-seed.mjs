/**
 * Generate the shipped programme templates.
 *
 * Each is a real structure — blocks with phases, weeks that progress and step
 * back, and days that point at library sessions — rather than a name and a
 * week count. Written as a spec here and emitted as SQL, because hand-writing
 * roughly nine hundred slot rows is how a seed acquires a typo nobody notices.
 *
 *   node scripts/generate-programme-seed.mjs
 */
import { writeFileSync } from 'node:fs';
import { createTestDatabase } from '../supabase/test/harness.mjs';

/* ---------- the library, by the names the seed uses ---------- */

const EASY = 'Easy Run', REC = 'Recovery Run', LONG = 'Long Run';
const THR = 'Threshold Intervals', VO2 = 'VO2 Intervals', HILLS = 'Hill Repeats';
const TEMPO = 'Tempo', PROG = 'Progression Run', RACEPACE = 'Race Pace';
const BIKE = 'Bike — Endurance', SWIM = 'Swim — Technique + Endurance';
const CROSS = 'Cross Training', MOB = 'Mobility', BRICK = 'Brick Session';
const FA = 'Foundation A', FB = 'Foundation B', MAINT = 'Maintenance';
const PERF = 'Performance A', ULTRA = 'Ultra Prep', TRI = 'Triathlon Support';

const run = (name, extra = {}) => ({ kind: 'workout', name, ...extra });
const str = (name, extra = {}) => ({ kind: 'strength', name, ...extra });
const REST = { kind: 'rest' };

/**
 * A week pattern maps ISO weekday (1 = Monday) to what happens that day.
 * A day with nothing is simply absent — an athlete training four days a week
 * gets four sessions, not seven, and the rest days that matter are stated.
 */
const TEMPLATES = [
  {
    name: 'General Endurance',
    discipline: 'running',
    experience: 'beginner',
    purpose: 'No start line yet. Aerobic base, consistent strength, and the habit of showing up.',
    blocks: [
      {
        name: 'Foundation', phase: 'base', weeks: 6,
        focus: 'Build the habit before building the volume.',
        pattern: { 1: REST, 2: [run(EASY)], 3: [str(FA)], 5: REST, 6: [run(EASY)], 7: [run(LONG, { scale: 0.5 })] },
      },
      {
        name: 'Steady Build', phase: 'build', weeks: 6,
        focus: 'One session with some quality in it. Everything else stays easy.',
        pattern: { 1: REST, 2: [run(TEMPO, { scale: 0.75 })], 3: [str(FA)], 5: REST, 6: [run(EASY)], 7: [run(LONG, { scale: 0.65 })] },
      },
    ],
  },
  {
    name: '5K — Sharpen',
    discipline: 'running', experience: 'developing', days: [4, 5], distance: 5,
    purpose: 'Eight weeks around one hard session and one sharpening session per week.',
    blocks: [
      {
        name: 'Base', phase: 'base', weeks: 3,
        pattern: { 2: [run(EASY)], 3: [run(THR, { scale: 0.8 })], 4: [str(FA)], 6: [run(EASY)], 7: [run(LONG, { scale: 0.6 })] },
      },
      {
        name: 'Sharpen', phase: 'sharpen', weeks: 4,
        focus: 'Race-pace speed on tired legs.',
        pattern: { 2: [run(EASY)], 3: [run(VO2)], 4: [str(MAINT)], 5: [run(REC)], 6: [run(RACEPACE, { scale: 0.5 })], 7: [run(LONG, { scale: 0.6 })] },
      },
      {
        name: 'Race Week', phase: 'taper', weeks: 1,
        focus: 'Sharp, not tired.',
        pattern: { 2: [run(REC)], 3: [run(RACEPACE, { scale: 0.3 })], 5: REST, 6: REST, 7: [run(EASY, { label: 'Race — 5K', scale: 0.7 })] },
      },
    ],
  },
  {
    name: '10K — Build',
    discipline: 'running', experience: 'developing', days: [4, 5], distance: 10,
    purpose: 'Threshold-led ten-week block. Enough volume to hold the pace, enough speed to find it.',
    blocks: [
      {
        name: 'Base', phase: 'base', weeks: 4,
        pattern: { 2: [run(EASY)], 3: [run(THR, { scale: 0.85 })], 4: [str(FA)], 6: [run(EASY)], 7: [run(LONG, { scale: 0.7 })] },
      },
      {
        name: 'Build', phase: 'build', weeks: 4,
        focus: 'Hold threshold pace for longer, week on week.',
        pattern: { 2: [run(EASY)], 3: [run(THR)], 4: [str(MAINT)], 5: [run(REC)], 6: [run(TEMPO, { scale: 0.7 })], 7: [run(LONG, { scale: 0.75 })] },
      },
      {
        name: 'Taper', phase: 'taper', weeks: 2,
        pattern: { 2: [run(EASY, { scale: 0.7 })], 3: [run(RACEPACE, { scale: 0.5 })], 5: REST, 6: [run(REC)], 7: [run(LONG, { scale: 0.45 })] },
      },
    ],
  },
  {
    name: 'Half Marathon — Foundation to Start Line',
    discipline: 'running', experience: 'developing', days: [4, 6], distance: 21.1,
    purpose: 'Fourteen weeks. Long run progression, one quality session, two strength sessions a week throughout.',
    blocks: [
      {
        name: 'Foundation', phase: 'base', weeks: 5,
        pattern: { 2: [run(EASY)], 3: [str(FA)], 4: [run(THR, { scale: 0.8 })], 6: [run(EASY)], 7: [run(LONG, { scale: 0.65 })] },
      },
      {
        name: 'Build', phase: 'build', weeks: 5,
        focus: 'Volume rises. Quality holds.',
        pattern: { 2: [run(EASY)], 3: [str(FA)], 4: [run(THR)], 5: [run(REC)], 6: [str(FB)], 7: [run(LONG, { scale: 0.85 })] },
      },
      {
        name: 'Race Specific', phase: 'specific', weeks: 2,
        focus: 'Race pace inside the long run, where it belongs.',
        pattern: { 2: [run(EASY)], 3: [str(MAINT)], 4: [run(RACEPACE)], 6: [run(REC)], 7: [run(LONG, { scale: 0.95 })] },
      },
      {
        name: 'Taper', phase: 'taper', weeks: 2,
        pattern: { 2: [run(EASY, { scale: 0.7 })], 4: [run(RACEPACE, { scale: 0.5 })], 6: REST, 7: [run(LONG, { scale: 0.4 })] },
      },
    ],
  },
  {
    name: 'Marathon — The Long Way',
    discipline: 'running', experience: 'experienced', days: [5, 6], distance: 42.2,
    purpose: 'Eighteen weeks with three build blocks and a three-week taper. Race-pace work lives in the long run.',
    blocks: [
      {
        name: 'Base', phase: 'base', weeks: 6,
        pattern: { 2: [run(EASY)], 3: [str(FA)], 4: [run(THR, { scale: 0.85 })], 5: [run(REC)], 6: [run(EASY)], 7: [run(LONG, { scale: 0.7 })] },
      },
      {
        name: 'Build', phase: 'build', weeks: 5,
        focus: 'The long run grows. Everything else holds steady.',
        pattern: { 2: [run(EASY)], 3: [str(FA)], 4: [run(THR)], 5: [run(REC)], 6: [str(FB)], 7: [run(LONG, { scale: 0.9 })] },
      },
      {
        name: 'Race Specific', phase: 'specific', weeks: 4,
        focus: 'Marathon pace on tired legs, inside the long run.',
        pattern: { 2: [run(EASY)], 3: [str(MAINT)], 4: [run(RACEPACE)], 5: [run(REC)], 6: [run(EASY)], 7: [run(LONG, { scale: 1.15 })] },
      },
      {
        name: 'Taper', phase: 'taper', weeks: 3,
        focus: 'Do less. Trust the work.',
        pattern: { 2: [run(EASY, { scale: 0.7 })], 4: [run(RACEPACE, { scale: 0.5 })], 5: REST, 6: [run(REC)], 7: [run(LONG, { scale: 0.4 })] },
      },
    ],
  },
  {
    name: 'Ultra — Time on Feet',
    discipline: 'trail', experience: 'experienced', days: [5, 6], distance: 50,
    purpose: 'Back-to-back long runs, terrain specificity and durability work. Volume rises slowly and steps back every fourth week.',
    blocks: [
      {
        name: 'Base', phase: 'base', weeks: 8,
        pattern: { 2: [run(EASY)], 3: [str(ULTRA)], 4: [run(HILLS, { scale: 0.8 })], 6: [run(LONG, { scale: 0.6 })], 7: [run(LONG, { scale: 0.5, label: 'Back-to-Back Long Run' })] },
      },
      {
        name: 'Build', phase: 'build', weeks: 8,
        focus: 'Back-to-back weekends. Practise eating on the move.',
        pattern: { 2: [run(EASY)], 3: [str(ULTRA)], 4: [run(HILLS)], 5: [run(REC)], 6: [run(LONG, { scale: 0.9 })], 7: [run(LONG, { scale: 0.7, label: 'Back-to-Back Long Run' })] },
      },
      {
        name: 'Specific', phase: 'specific', weeks: 5,
        focus: 'Terrain, night running, and the kit you will race in.',
        pattern: { 2: [run(EASY)], 3: [str(MAINT)], 4: [run(HILLS)], 6: [run(LONG, { scale: 1.3 })], 7: [run(LONG, { scale: 0.6, label: 'Back-to-Back Long Run' })] },
      },
      {
        name: 'Taper', phase: 'taper', weeks: 3,
        pattern: { 2: [run(EASY, { scale: 0.7 })], 4: [run(HILLS, { scale: 0.5 })], 5: REST, 6: [run(REC)], 7: [run(LONG, { scale: 0.35 })] },
      },
    ],
  },
  {
    name: '70.3 — Three Disciplines',
    discipline: 'triathlon', experience: 'experienced', days: [6, 6], distance: 113,
    purpose: 'Twenty weeks balancing swim, bike and run with weekly brick work and triathlon-specific strength.',
    blocks: [
      {
        name: 'Base', phase: 'base', weeks: 8,
        focus: 'Three disciplines, one rest day. Even a triathlete stops.',
        pattern: { 1: REST, 2: [run(BIKE)], 3: [run(SWIM)], 4: [run(EASY)], 5: [str(TRI)], 6: [run(BIKE, { label: 'Long Ride' })], 7: [run(LONG, { scale: 0.55 })] },
      },
      {
        name: 'Build', phase: 'build', weeks: 7,
        focus: 'Brick work every week. Get used to running off the bike.',
        pattern: { 1: REST, 2: [run(THR, { scale: 0.8 })], 3: [str(TRI)], 4: [run(SWIM)], 5: [run(REC)], 6: [run(BRICK)], 7: [run(LONG, { scale: 0.7 })] },
      },
      {
        name: 'Race Specific', phase: 'specific', weeks: 3,
        pattern: { 1: [run(SWIM)], 2: [run(RACEPACE, { scale: 0.7 })], 3: [str(MAINT)], 4: [run(SWIM)], 6: [run(BRICK)], 7: [run(LONG, { scale: 0.8 })] },
      },
      {
        name: 'Taper', phase: 'taper', weeks: 2,
        pattern: { 1: [run(SWIM)], 2: [run(EASY, { scale: 0.7 })], 4: [run(BIKE, { scale: 0.6 })], 5: REST, 6: [run(BRICK, { scale: 0.4 })], 7: [run(REC)] },
      },
    ],
  },
];

/* ---------- emit ---------- */

const t = await createTestDatabase();
const q = async (s) => (await t.asService(s)).rows;

const workouts = new Map((await q(`select id, name, distance_km from workout_templates where visibility='system'`))
  .map((r) => [r.name, r]));
const strength = new Map((await q(`select id, name from strength_templates where visibility='system'`))
  .map((r) => [r.name, r]));
const templates = new Map((await q(`select id, name from program_templates where visibility='system'`))
  .map((r) => [r.name, r]));

const lit = (v) => (v == null ? 'null' : typeof v === 'number' ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
const uuid = (a, b, c) => `'00000000-0000-4000-${a}-${String(b).padStart(4, '0')}${String(c).padStart(8, '0')}'`;

const out = [];
let blockRows = [], weekRows = [], slotRows = [], templateUpdates = [];
let blockN = 0, weekN = 0, slotN = 0;

for (const spec of TEMPLATES) {
  const tpl = templates.get(spec.name);
  if (!tpl) throw new Error(`no seeded programme template named ${spec.name}`);

  const totalWeeks = spec.blocks.reduce((a, b) => a + b.weeks, 0);

  // The declared frequency is read off the structure rather than asserted
  // beside it. A programme that says "4-5 days" and trains six is exactly the
  // mismatch a coach would rely on and be misled by.
  const daysPerBlock = spec.blocks.map((b) =>
    Object.values(b.pattern).filter((entry) => entry !== REST).length);
  const [minDays, maxDays] = [Math.min(...daysPerBlock), Math.max(...daysPerBlock)];

  templateUpdates.push(
    `update program_templates set discipline = ${lit(spec.discipline)}, ` +
    `experience_level = ${lit(spec.experience)}::im_experience, ` +
    `min_days_per_week = ${minDays}, max_days_per_week = ${maxDays}, ` +
    `target_distance_km = ${lit(spec.distance ?? null)}, purpose = ${lit(spec.purpose)}, ` +
    `weeks = ${totalWeeks} where id = '${tpl.id}';`);

  let weekNo = 0;
  spec.blocks.forEach((block, blockIndex) => {
    const blockId = uuid('8002', blockN, ++blockN);
    blockRows.push(`  (${blockId}, '${tpl.id}', ${blockIndex}, ${lit(block.name)}, ` +
      `${lit(block.phase)}::im_phase, ${lit(block.focus ?? null)}, null)`);

    for (let w = 0; w < block.weeks; w++) {
      weekNo++;
      const weekId = uuid('8003', weekN, ++weekN);
      // every fourth week steps back — a coaching decision, stated as one
      const recovery = weekNo % 4 === 0 && w > 0;
      // and the weeks in between progress, which is what the slot overrides are for
      const factor = recovery ? 0.72 : 1 + 0.05 * w;

      let prescribed = 0;
      const slots = [];
      for (const [weekday, entry] of Object.entries(block.pattern)) {
        const items = entry === REST ? [REST] : entry;
        items.forEach((item, slotIndex) => {
          if (item.kind === 'rest') {
            slots.push(`  (${uuid('8004', slotN, ++slotN)}, '${tpl.id}', ${weekId}, ${weekday}, ${slotIndex}, ` +
              `null, null, true, false, null, null, null, null, null)`);
            return;
          }
          if (item.kind === 'strength') {
            const s = strength.get(item.name);
            if (!s) throw new Error(`no strength template named ${item.name}`);
            slots.push(`  (${uuid('8004', slotN, ++slotN)}, '${tpl.id}', ${weekId}, ${weekday}, ${slotIndex + 1}, ` +
              `null, '${s.id}', false, false, ${lit(item.label ?? null)}, null, null, null, null)`);
            return;
          }
          const base = workouts.get(item.name);
          if (!base) throw new Error(`no workout template named ${item.name}`);
          const km = base.distance_km == null ? null
            : Math.round(Number(base.distance_km) * (item.scale ?? 1) * factor * 2) / 2;
          if (km) prescribed += km;
          slots.push(`  (${uuid('8004', slotN, ++slotN)}, '${tpl.id}', ${weekId}, ${weekday}, ${slotIndex}, ` +
            `'${base.id}', null, false, false, ${lit(item.label ?? null)}, null, ${lit(km)}, null, null)`);
        });
      }

      weekRows.push(`  (${weekId}, '${tpl.id}', ${blockId}, ${w}, ${weekNo}, ` +
        `${lit(prescribed ? Math.round(prescribed) : null)}, ${recovery}, ${lit(block.focus ?? null)}, null)`);
      slotRows.push(...slots);
    }
  });
}

out.push(`-- Generated by scripts/generate-programme-seed.mjs — do not hand-edit.
--
-- The shipped programme templates, as real structures. Each states the
-- training frequency it was written for, so "this is a four-day programme"
-- is a fact about the template rather than something a coach counts.

${templateUpdates.join('\n')}

insert into program_template_blocks (id, program_template_id, block_index, name, phase, focus, description) values
${blockRows.join(',\n')}
on conflict (id) do nothing;

insert into program_template_weeks (id, program_template_id, block_id, week_index, template_week_no, target_volume_km, is_recovery_week, focus, notes) values
${weekRows.join(',\n')}
on conflict (id) do nothing;

insert into program_template_slots (id, program_template_id, template_week_id, weekday, slot, workout_template_id, strength_template_id, is_rest, is_optional, label, notes, distance_km, duration_minutes, rpe_target) values
${slotRows.join(',\n')}
on conflict (id) do nothing;
`);

writeFileSync(new URL('../supabase/migrations/0009_programme_seed.sql', import.meta.url), out.join('\n'));
await t.close();
console.log(`wrote ${TEMPLATES.length} programmes · ${blockN} blocks · ${weekN} weeks · ${slotN} slots`);
