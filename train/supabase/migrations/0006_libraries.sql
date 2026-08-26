-- ============================================================
-- IRON MILES TRAINING — reusable libraries
--
-- Workouts and S&C become real, coach-editable, database-backed content.
-- The TypeScript constants that held this material are migrated in and then
-- deleted: a parallel "real database" and "hard-coded list" would drift, and
-- the drift would be silent.
--
--   CREATE ONCE → SAVE TO LIBRARY → REUSE → ADAPT → PRESCRIBE
--
-- A template is a distinct coach-owned thing, never an athlete programme with
-- a null athlete. Inserting one into a programme COPIES it; the athlete's
-- session is independent from that moment on, and a later template edit can
-- never reach back into prescribed history.
-- ============================================================

-- ---------- who may see a library item ----------
create type im_visibility as enum (
  'private',  -- the owning coach only
  'shared',   -- any coach in the organisation
  'system'    -- shipped with the product; immutable, no owner
);

-- ---------- endurance categories ----------
-- How a coach files a session, which is broader than what it technically is:
-- a bike hour and a swim are both cross-training however differently they run.
-- 'custom' is for genuinely bespoke work, not a bucket for anything unmapped.
create type im_workout_category as enum (
  'easy', 'recovery', 'long_run', 'threshold', 'intervals', 'hills',
  'tempo', 'progression', 'race_specific', 'race',
  'cross_training', 'mobility', 'rest', 'custom'
);

-- Movement pattern is a checked text column rather than an enum. A training
-- taxonomy grows, and `alter type ... add value` cannot be used in the same
-- transaction that adds it — which would make every future addition a
-- two-migration dance for no benefit.
create or replace function im_movement_patterns() returns text[]
language sql immutable as $$
  select array[
    'squat','hinge','push','pull','lunge','calf','core',
    'plyometric','mobility','stability','carry','rehab','other'
  ];
$$;

-- ============================================================
-- SHARED LIBRARY COLUMNS
-- Every library table carries the same ownership, visibility, tagging and
-- archive vocabulary, so one set of rules governs all of them.
-- ============================================================

alter table workout_templates
  add column if not exists visibility  im_visibility not null default 'private',
  add column if not exists category    im_workout_category not null default 'custom',
  add column if not exists purpose     text,
  add column if not exists coach_notes text,
  add column if not exists tags        text[] not null default '{}',
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at  timestamptz not null default now();

alter table strength_exercises
  add column if not exists visibility        im_visibility not null default 'private',
  add column if not exists movement_pattern  text,
  add column if not exists description       text,
  add column if not exists default_sets      smallint,
  add column if not exists default_reps      text,
  add column if not exists load_guidance     text,
  add column if not exists default_tempo     text,
  add column if not exists default_rest_seconds integer,
  add column if not exists default_rpe       smallint,
  add column if not exists is_unilateral     boolean not null default false,
  add column if not exists tags              text[] not null default '{}',
  add column if not exists archived_at       timestamptz,
  add column if not exists updated_at        timestamptz not null default now();

alter table strength_exercises
  add constraint strength_exercises_movement_valid
  check (movement_pattern is null or movement_pattern = any (im_movement_patterns()));

alter table strength_templates
  add column if not exists visibility  im_visibility not null default 'private',
  add column if not exists purpose      text,
  add column if not exists coach_notes  text,
  add column if not exists tags         text[] not null default '{}',
  add column if not exists archived_at  timestamptz,
  add column if not exists updated_at   timestamptz not null default now();

alter table program_templates
  add column if not exists visibility  im_visibility not null default 'private',
  add column if not exists tags        text[] not null default '{}',
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at  timestamptz not null default now();

-- the old boolean becomes the enum, then stops being the source of truth
update workout_templates  set visibility = (case when is_shared then 'shared' else 'private' end)::im_visibility;
update strength_exercises set visibility = (case when is_shared then 'shared' else 'private' end)::im_visibility;
update strength_templates set visibility = (case when is_shared then 'shared' else 'private' end)::im_visibility;
update program_templates  set visibility = (case when is_shared then 'shared' else 'private' end)::im_visibility;

-- the 0002 policies read is_shared, so they go first and are rebuilt below
drop policy if exists workout_templates_read  on workout_templates;
drop policy if exists workout_templates_write on workout_templates;
drop policy if exists strength_ex_read        on strength_exercises;
drop policy if exists strength_ex_write       on strength_exercises;
drop policy if exists strength_tpl_read       on strength_templates;
drop policy if exists strength_tpl_write      on strength_templates;
drop policy if exists program_templates_read  on program_templates;
drop policy if exists program_templates_write on program_templates;
drop policy if exists pts_read                on program_template_slots;
drop policy if exists pts_write               on program_template_slots;
drop policy if exists strength_blocks_read    on strength_template_blocks;
drop policy if exists strength_blocks_write   on strength_template_blocks;

alter table workout_templates  drop column if exists is_shared;
alter table strength_exercises drop column if exists is_shared;
alter table strength_templates drop column if exists is_shared;
alter table program_templates  drop column if exists is_shared;

-- ownership rules: system content has no owner, everything else must have one
alter table workout_templates add constraint workout_templates_owner_rule
  check ((visibility = 'system' and owner_id is null) or (visibility <> 'system' and owner_id is not null));
alter table strength_exercises add constraint strength_exercises_owner_rule
  check ((visibility = 'system' and owner_id is null) or (visibility <> 'system' and owner_id is not null));
alter table strength_templates add constraint strength_templates_owner_rule
  check ((visibility = 'system' and owner_id is null) or (visibility <> 'system' and owner_id is not null));

create index on workout_templates  (visibility, category) where archived_at is null;
create index on workout_templates  (owner_id) where archived_at is null;
create index on strength_exercises (visibility, movement_pattern) where archived_at is null;
create index on strength_templates (visibility, category) where archived_at is null;

-- ============================================================
-- TEMPLATE COMPONENTS
--
-- One table for both libraries, mirroring session_components column for column
-- so inserting a template into a programme is a straight copy rather than a
-- translation. Exactly one parent, enforced.
-- ============================================================

create table template_components (
  id                   uuid primary key default gen_random_uuid(),
  workout_template_id  uuid references workout_templates(id) on delete cascade,
  strength_template_id uuid references strength_templates(id) on delete cascade,
  position             smallint not null check (position >= 0),
  kind                 im_component_kind not null,
  label                text,
  notes                text,

  repeats              smallint check (repeats is null or repeats > 0),
  rpe_target           smallint check (rpe_target is null or rpe_target between 1 and 10),

  distance_km          numeric(6,2) check (distance_km is null or distance_km >= 0),
  duration_seconds     integer check (duration_seconds is null or duration_seconds >= 0),
  pace_min_sec_km      integer,
  pace_max_sec_km      integer,
  hr_zone              smallint check (hr_zone is null or hr_zone between 1 and 5),
  recovery_seconds     integer check (recovery_seconds is null or recovery_seconds >= 0),
  recovery_description text,

  strength_exercise_id uuid references strength_exercises(id) on delete restrict,
  sets                 smallint check (sets is null or sets > 0),
  reps                 text,
  load_prescription    text,
  tempo                text,
  rest_seconds         integer check (rest_seconds is null or rest_seconds >= 0),

  created_at           timestamptz not null default now(),

  constraint template_components_one_parent check (
    (workout_template_id is not null and strength_template_id is null)
    or (workout_template_id is null and strength_template_id is not null)
  ),
  constraint template_components_pace_ordered check (
    pace_min_sec_km is null or pace_max_sec_km is null or pace_min_sec_km <= pace_max_sec_km
  ),
  constraint template_components_exercise_identified check (
    kind <> 'exercise' or strength_exercise_id is not null or label is not null
  )
);

create unique index template_components_workout_position
  on template_components (workout_template_id, position) where workout_template_id is not null;
create unique index template_components_strength_position
  on template_components (strength_template_id, position) where strength_template_id is not null;
create index on template_components (strength_exercise_id) where strength_exercise_id is not null;

comment on table template_components is
  'Ordered parts of a reusable template. Same shape as session_components so insertion into a programme is a copy, not a translation.';

-- strength_template_blocks is superseded. It was never read or written by any
-- code path, so this drops an unused table rather than data.
drop table if exists strength_template_blocks;

-- ============================================================
-- BLOCK DELETION GUARD
--
-- A coach must never remove prescribed athlete history by deleting a parent
-- block. A populated block archives; only an empty one deletes.
-- ============================================================

alter table program_blocks add column if not exists archived_at timestamptz;

create or replace function im_guard_block_delete() returns trigger
language plpgsql as $$
declare
  v_weeks integer;
  v_sessions integer;
begin
  select count(*) into v_weeks from program_weeks where block_id = old.id;
  select count(*) into v_sessions
    from scheduled_workouts s
    join program_weeks w on w.id = s.program_week_id
   where w.block_id = old.id;

  if v_weeks > 0 or v_sessions > 0 then
    raise exception
      'This block still holds % week(s) and % prescribed session(s). Archive it instead, or empty it first — deleting it would erase prescribed athlete history.',
      v_weeks, v_sessions
      using errcode = 'restrict_violation';
  end if;
  return old;
end $$;

create trigger t_guard_block_delete
  before delete on program_blocks
  for each row execute function im_guard_block_delete();


-- ============================================================
-- LIBRARY ACCESS
--
--   private  the owning coach, and nobody else
--   shared   any coach or admin
--   system   any coach or admin; immutable, enforced by trigger below
--
-- Templates are never public and never visible to athletes: the prescription
-- reaches an athlete by being copied into their session, not by them reading
-- the coach's library.
--
-- Exercises are the one exception. An athlete running a prescribed strength
-- session needs the movement's name and cues, so they may read exactly the
-- exercises referenced by their own sessions — and no others.
-- ============================================================

create or replace function im_can_read_library(p_visibility im_visibility, p_owner uuid)
returns boolean language sql stable as $$
  select case
    when not im_is_staff() then false
    when p_visibility = 'system' then true
    when p_visibility = 'shared' then true
    else p_owner = auth.uid()
  end;
$$;

-- a coach may only change their own; system content is immutable to everyone
create or replace function im_can_write_library(p_visibility im_visibility, p_owner uuid)
returns boolean language sql stable as $$
  select p_visibility <> 'system' and (p_owner = auth.uid() or im_is_admin());
$$;

create policy workout_templates_read on workout_templates
  for select using (im_can_read_library(visibility, owner_id));
create policy workout_templates_write on workout_templates
  for all using (im_can_write_library(visibility, owner_id))
  with check (im_can_write_library(visibility, owner_id));

create policy strength_tpl_read on strength_templates
  for select using (im_can_read_library(visibility, owner_id));
create policy strength_tpl_write on strength_templates
  for all using (im_can_write_library(visibility, owner_id))
  with check (im_can_write_library(visibility, owner_id));

create policy program_templates_read on program_templates
  for select using (im_can_read_library(visibility, owner_id));
create policy program_templates_write on program_templates
  for all using (im_can_write_library(visibility, owner_id))
  with check (im_can_write_library(visibility, owner_id));

create policy pts_read on program_template_slots
  for select using (exists (
    select 1 from program_templates t
     where t.id = program_template_id and im_can_read_library(t.visibility, t.owner_id)));
create policy pts_write on program_template_slots
  for all using (exists (
    select 1 from program_templates t
     where t.id = program_template_id and im_can_write_library(t.visibility, t.owner_id)))
  with check (exists (
    select 1 from program_templates t
     where t.id = program_template_id and im_can_write_library(t.visibility, t.owner_id)));

-- exercises: coaches by the usual rules, athletes only where prescribed to them
create policy strength_ex_read on strength_exercises
  for select using (
    im_can_read_library(visibility, owner_id)
    or exists (
      select 1 from session_components c
       where c.strength_exercise_id = strength_exercises.id
         and c.athlete_id = auth.uid()
    )
  );
create policy strength_ex_write on strength_exercises
  for all using (im_can_write_library(visibility, owner_id))
  with check (im_can_write_library(visibility, owner_id));

-- template components follow their parent
alter table template_components enable row level security;
alter table template_components force row level security;

create policy template_components_read on template_components
  for select using (
    (workout_template_id is not null and exists (
      select 1 from workout_templates t
       where t.id = workout_template_id and im_can_read_library(t.visibility, t.owner_id)))
    or (strength_template_id is not null and exists (
      select 1 from strength_templates t
       where t.id = strength_template_id and im_can_read_library(t.visibility, t.owner_id)))
  );
create policy template_components_write on template_components
  for all using (
    (workout_template_id is not null and exists (
      select 1 from workout_templates t
       where t.id = workout_template_id and im_can_write_library(t.visibility, t.owner_id)))
    or (strength_template_id is not null and exists (
      select 1 from strength_templates t
       where t.id = strength_template_id and im_can_write_library(t.visibility, t.owner_id)))
  )
  with check (
    (workout_template_id is not null and exists (
      select 1 from workout_templates t
       where t.id = workout_template_id and im_can_write_library(t.visibility, t.owner_id)))
    or (strength_template_id is not null and exists (
      select 1 from strength_templates t
       where t.id = strength_template_id and im_can_write_library(t.visibility, t.owner_id)))
  );

-- ---------- system content is immutable ----------
-- The policies already refuse it, but a security-definer function or a future
-- admin path could slip past them. This makes it structural.
create or replace function im_guard_system_content() returns trigger
language plpgsql as $$
begin
  -- Migrations run as the service role, where auth.uid() is null: they are how
  -- system content is seeded and how it would be corrected later. Everyone
  -- else is locked out of it in both directions.
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if old.visibility = 'system' then
    raise exception 'System library content cannot be %. Duplicate it and edit your copy.',
      case when tg_op = 'DELETE' then 'deleted' else 'edited' end
      using errcode = 'restrict_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger t_guard_system_workout before update or delete on workout_templates
  for each row execute function im_guard_system_content();
create trigger t_guard_system_exercise before update or delete on strength_exercises
  for each row execute function im_guard_system_content();
create trigger t_guard_system_strength before update or delete on strength_templates
  for each row execute function im_guard_system_content();


-- ============================================================
-- SYSTEM SEED
--
-- The content that shipped as TypeScript constants, migrated in as immutable
-- system library items. Those constants are deleted in the same change: two
-- sources of the same material would drift, and the drift would be silent.
--
-- System items have no owner and cannot be edited or deleted by anyone. A
-- coach who wants a variation duplicates one; the copy is theirs.
-- ============================================================

-- Generated from the shipped TypeScript libraries. Do not hand-edit;
-- regenerate if the seed content ever needs to change.

insert into workout_templates (id, owner_id, visibility, name, category, type, basis, intensity,
  distance_km, duration_minutes, pace_min_sec_km, pace_max_sec_km, hr_zone, rpe_target,
  warm_up, main_set, cool_down, purpose, tags) values
  ('00000000-0000-4000-8000-000000000001', null, 'system', 'Easy Run', 'easy', 'easy_run', 'distance', 'easy', 8, 50, null, null, 2, 3, null, 'Continuous easy running. Conversational the whole way.', null, 'If you cannot speak in full sentences, you are going too hard.', array['easy','distance']),
  ('00000000-0000-4000-8000-000000000002', null, 'system', 'Recovery Run', 'recovery', 'recovery_run', 'time', 'recovery', 6, 35, null, null, 1, 2, null, 'Very easy. Flat route. Shorter than it feels like it should be.', null, 'The point is blood flow, not fitness.', array['recovery','time']),
  ('00000000-0000-4000-8000-000000000003', null, 'system', 'Long Run', 'long_run', 'long_run', 'distance', 'easy', 22, 135, null, null, 2, 4, 'First 15 minutes deliberately slower than target.', 'Steady, controlled effort. Practise race-day fuelling.', '10 minutes easy walking.', 'Fuel early. Start controlled. Finish stronger than you started.', array['easy','distance']),
  ('00000000-0000-4000-8000-000000000004', null, 'system', 'Progression Run', 'progression', 'progression_run', 'distance', 'steady', 14, 75, null, null, null, 6, null, 'Three equal thirds: easy, steady, then marathon effort.', null, 'Negative split or it does not count.', array['steady','distance']),
  ('00000000-0000-4000-8000-000000000005', null, 'system', 'Tempo', 'tempo', 'tempo', 'time', 'hard', 12, 60, null, null, 4, 7, '15 min easy + 4 x 20s strides.', '25 minutes continuous at comfortably hard. You could hold it for an hour on race day.', '12 min easy.', null, array['hard','time']),
  ('00000000-0000-4000-8000-000000000006', null, 'system', 'Threshold Intervals', 'threshold', 'threshold', 'time', 'hard', 13, 65, null, null, 4, 8, '15 min easy + drills + 4 x 20s strides.', '6 x 5 min at threshold, 90s easy jog between.', '12 min easy.', 'Controlled discomfort, not a race. Same pace on the last rep as the first.', array['hard','time']),
  ('00000000-0000-4000-8000-000000000007', null, 'system', 'VO2 Intervals', 'intervals', 'intervals', 'time', 'max', 12, 60, null, null, 5, 9, '15 min easy + drills + 4 x 100m strides.', '5 x 3 min hard, 3 min easy jog recovery.', '12 min easy.', null, array['max','time']),
  ('00000000-0000-4000-8000-000000000008', null, 'system', 'Hill Repeats', 'hills', 'hills', 'time', 'hard', 11, 55, null, null, null, 8, '15 min easy to the hill.', '8 x 60s uphill at hard effort. Jog down as recovery.', '12 min easy.', 'Strength in disguise. Tall posture, quick feet.', array['hard','time']),
  ('00000000-0000-4000-8000-000000000009', null, 'system', 'Race Pace', 'race_specific', 'race_pace', 'pace', 'steady', 16, 85, null, null, null, 6, '15 min easy.', '3 x 15 min at goal race pace, 3 min float between.', '10 min easy.', 'Rehearsal, not a test.', array['steady','pace']),
  ('00000000-0000-4000-8000-000000000010', null, 'system', 'Brick Session', 'race_specific', 'brick', 'time', 'steady', null, 90, null, null, null, 6, null, '60 min bike at steady effort, straight into 25 min run off the bike.', null, 'The first 10 minutes off the bike always feel wrong. Run through it.', array['steady','time']),
  ('00000000-0000-4000-8000-000000000011', null, 'system', 'Bike — Endurance', 'cross_training', 'bike', 'time', 'easy', null, 90, null, null, 2, 4, null, 'Steady aerobic riding. Smooth cadence, 85–95rpm.', null, null, array['easy','time']),
  ('00000000-0000-4000-8000-000000000012', null, 'system', 'Swim — Technique + Endurance', 'cross_training', 'swim', 'time', 'steady', null, 45, null, null, null, 5, '400m mixed.', '8 x 100m steady, 20s rest. Focus on catch.', '200m easy.', null, array['steady','time']),
  ('00000000-0000-4000-8000-000000000013', null, 'system', 'Cross Training', 'cross_training', 'cross_training', 'time', 'easy', null, 45, null, null, 2, 4, null, 'Low-impact aerobic work — bike, row, elliptical or pool.', null, 'Aerobic stimulus without the pounding.', array['easy','time']),
  ('00000000-0000-4000-8000-000000000014', null, 'system', 'Mobility', 'mobility', 'mobility', 'time', 'recovery', null, 20, null, null, null, 1, null, 'Hips, ankles, thoracic spine. Slow and unhurried.', null, null, array['recovery','time']),
  ('00000000-0000-4000-8000-000000000015', null, 'system', 'Rest', 'rest', 'rest', 'time', 'rest', null, null, null, null, null, null, null, 'Complete rest. This is a session — treat it like one.', null, 'Adaptation happens here, not in the session you skipped it for.', array['rest','time']),
  ('00000000-0000-4000-8000-000000000016', null, 'system', 'Race Day', 'race', 'race', 'distance', 'max', null, null, null, null, null, 10, null, 'Execute the plan. Nothing new on race day.', null, 'The work is done. Trust it.', array['max','distance']);

insert into strength_exercises (id, owner_id, visibility, name, category, movement_pattern,
  muscle_groups, video_url, cues, regressions, progressions, equipment, is_unilateral, tags) values
  ('00000000-0000-4000-8001-000000000001', null, 'system', 'Rear-Foot Elevated Split Squat', 'lunge', 'lunge', array['Quads','Glutes','Adductors'], null, array['Front shin vertical at the bottom','Ribs down, do not arch','Drive through the whole front foot'], array['Split squat, both feet on the floor','Hold a rail for balance'], array['Add dumbbells','Slow 3-second lower','Deficit front foot'], array['Bench','Dumbbells'], true, array['lunge']),
  ('00000000-0000-4000-8001-000000000002', null, 'system', 'Single-Leg Romanian Deadlift', 'hinge', 'hinge', array['Hamstrings','Glutes','Spinal erectors'], null, array['Hinge from the hip, not the spine','Hips stay square to the floor','Stop when the hamstring tightens'], array['Hold a wall','Kickstand stance'], array['Single dumbbell contralateral','Add a pause at the bottom'], array['Dumbbell'], true, array['hinge']),
  ('00000000-0000-4000-8001-000000000003', null, 'system', 'Trap-Bar Deadlift', 'hinge', 'hinge', array['Glutes','Hamstrings','Quads','Back'], null, array['Push the floor away','Lats tight, chest proud','Same bar path down as up'], array['Elevated blocks','Kettlebell deadlift'], array['Add load','Tempo eccentric'], array['Trap bar','Plates'], false, array['hinge']),
  ('00000000-0000-4000-8001-000000000004', null, 'system', 'Straight-Leg Calf Raise', 'push', 'push', array['Gastrocnemius','Achilles'], null, array['Full range — heel below the step','Two seconds down','No bouncing out of the bottom'], array['Both legs','Floor instead of a step'], array['Single leg','Add a dumbbell','Add a 3s isometric at the top'], array['Step'], false, array['push']),
  ('00000000-0000-4000-8001-000000000005', null, 'system', 'Bent-Knee Calf Raise', 'push', 'push', array['Soleus','Achilles'], null, array['Knee bent to about 30 degrees','Slow and honest','This is the one runners skip'], array['Seated, bodyweight'], array['Seated with load across the knee'], array['Step','Dumbbell'], false, array['push']),
  ('00000000-0000-4000-8001-000000000006', null, 'system', 'Copenhagen Plank', 'core', 'core', array['Adductors','Obliques'], null, array['Top leg drives down into the bench','Body in one line','Stop before it shakes'], array['Short lever — knee on the bench'], array['Full length','Add reps of top-leg raises'], array['Bench'], true, array['core']),
  ('00000000-0000-4000-8001-000000000007', null, 'system', 'Side Plank with Top-Leg Raise', 'core', 'core', array['Glute medius','Obliques'], null, array['Stack the hips','Lift from the glute, not the hip flexor'], array['Knees bent','No leg raise'], array['Add a hold at the top','Feet elevated'], '{}', true, array['core']),
  ('00000000-0000-4000-8001-000000000008', null, 'system', 'Dead Bug', 'core', 'core', array['Deep core','Hip flexors'], null, array['Lower back stays flat to the floor','Exhale as the limbs extend','Slow beats far'], array['Arms only','Legs only'], array['Add a band','Extend the tempo'], '{}', false, array['core']),
  ('00000000-0000-4000-8001-000000000009', null, 'system', 'Loaded Step-Up', 'lunge', 'lunge', array['Glutes','Quads'], null, array['No push off the trailing foot','Control the way down','Knee tracks over the second toe'], array['Lower box','Bodyweight'], array['Higher box','Dumbbells','Slow eccentric'], array['Box','Dumbbells'], true, array['lunge']),
  ('00000000-0000-4000-8001-000000000010', null, 'system', 'Barbell Hip Thrust', 'hinge', 'hinge', array['Glutes','Hamstrings'], null, array['Chin tucked, ribs down','Finish with the glutes, not the lower back','Pause at the top'], array['Bodyweight glute bridge','Single-leg bridge'], array['Add load','Pause reps'], array['Barbell','Bench'], false, array['hinge']),
  ('00000000-0000-4000-8001-000000000011', null, 'system', 'Pogo Hops', 'plyometric', 'plyometric', array['Calves','Achilles','Foot'], null, array['Stiff ankle, quiet landing','Minimal knee bend','Off the ground fast'], array['Two feet, low amplitude'], array['Single leg','Lateral pogos'], '{}', false, array['plyometric']),
  ('00000000-0000-4000-8001-000000000012', null, 'system', 'Box Jump (step down)', 'plyometric', 'plyometric', array['Glutes','Quads','Calves'], null, array['Land soft and tall','Always step down, never jump down','Quality over height'], array['Low box','Squat jump to the floor'], array['Higher box','Single-leg landings'], array['Box'], false, array['plyometric']),
  ('00000000-0000-4000-8001-000000000013', null, 'system', 'Pull-Up', 'pull', 'pull', array['Lats','Biceps','Mid-back'], null, array['Start from a dead hang','Chest to the bar','No kipping'], array['Band assisted','Inverted row'], array['Weighted','Slow eccentric'], array['Pull-up bar'], false, array['pull']),
  ('00000000-0000-4000-8001-000000000014', null, 'system', 'Single-Arm Dumbbell Row', 'pull', 'pull', array['Lats','Rhomboids'], null, array['Pull to the hip, not the armpit','Torso stays still','Full stretch at the bottom'], array['Chest-supported row'], array['Add load','Pause at the top'], array['Dumbbell','Bench'], false, array['pull']),
  ('00000000-0000-4000-8001-000000000015', null, 'system', 'Push-Up', 'push', 'push', array['Chest','Triceps','Core'], null, array['Body in one line','Elbows at 45 degrees','Full lockout'], array['Hands elevated'], array['Feet elevated','Weighted','Tempo'], '{}', false, array['push']),
  ('00000000-0000-4000-8001-000000000016', null, 'system', 'Farmer Carry', 'carry', 'carry', array['Grip','Core','Traps'], null, array['Tall posture, shoulders down','Walk normally','Do not lean away from the load'], array['Lighter load, shorter distance'], array['Suitcase carry (one side)','Longer carries'], array['Dumbbells','Kettlebells'], false, array['carry']),
  ('00000000-0000-4000-8001-000000000017', null, 'system', 'Hip Airplane', 'mobility', 'mobility', array['Glutes','Hip rotators'], null, array['Rotate from the hip, not the spine','Slow through the whole range','Balance is the point'], array['Hold a wall'], array['No support','Pause at end range'], '{}', true, array['mobility']),
  ('00000000-0000-4000-8001-000000000018', null, 'system', 'Half-Kneeling Ankle Rocks', 'mobility', 'mobility', array['Ankle','Calf'], null, array['Heel stays down','Knee travels over the second toe','Small, repeated, painless'], array['Reduce the range'], array['Elevate the toes'], '{}', false, array['mobility']),
  ('00000000-0000-4000-8001-000000000019', null, 'system', 'Nordic Hamstring Curl (eccentric)', 'hinge', 'hinge', array['Hamstrings'], null, array['Hips stay extended — no piking','Resist as long as you can','Push back up with the hands'], array['Band assisted','Short range'], array['Full range','Slow the descent further'], array['Partner or anchor'], false, array['hinge']),
  ('00000000-0000-4000-8001-000000000020', null, 'system', 'Goblet Squat', 'squat', 'squat', array['Quads','Glutes','Core'], null, array['Elbows inside the knees','Sit between the hips','Heels stay down'], array['Box squat','Bodyweight'], array['Front squat','Tempo','Add load'], array['Kettlebell','Dumbbell'], false, array['squat']);

insert into strength_templates (id, owner_id, visibility, name, category, description, estimated_minutes, tags) values
  ('00000000-0000-4000-8002-000000000001', null, 'system', 'Foundation A', 'foundation', 'Bilateral strength and posterior chain. The base everything else is built on. Leave two reps in reserve on every set.', 45, array['foundation']),
  ('00000000-0000-4000-8002-000000000002', null, 'system', 'Foundation B', 'foundation', 'Single-leg strength and lateral control. This is the session that keeps you on the road.', 45, array['foundation']),
  ('00000000-0000-4000-8002-000000000003', null, 'system', 'Performance A', 'performance', 'Heavier, faster, lower volume. Run this in a build block when the legs can take it.', 55, array['performance']),
  ('00000000-0000-4000-8002-000000000004', null, 'system', 'Maintenance', 'maintenance', 'Race week and heavy running weeks. Enough to hold what you built, light enough to leave no trace.', 25, array['maintenance']),
  ('00000000-0000-4000-8002-000000000005', null, 'system', 'Ultra Prep', 'ultra_prep', 'Durability for long time on feet — carries, calves and hip stability at volume. Built for the back half of an ultra.', 50, array['ultra_prep']),
  ('00000000-0000-4000-8002-000000000006', null, 'system', 'Triathlon Support', 'triathlon_support', 'Upper-body pulling for the swim, hip strength for the bike, and enough legs to run off it.', 45, array['triathlon_support']);

insert into template_components (strength_template_id, position, kind, label,
  strength_exercise_id, sets, reps, tempo, rest_seconds, rpe_target, notes) values
  ('00000000-0000-4000-8002-000000000001', 0, 'exercise', 'Half-Kneeling Ankle Rocks', '00000000-0000-4000-8001-000000000018', 2, '10 each', null, 30, null, 'Warm-up'),
  ('00000000-0000-4000-8002-000000000001', 1, 'exercise', 'Trap-Bar Deadlift', '00000000-0000-4000-8001-000000000003', 4, '6', '2-0-1', 150, 7, 'Leave two in the tank.'),
  ('00000000-0000-4000-8002-000000000001', 2, 'exercise', 'Goblet Squat', '00000000-0000-4000-8001-000000000020', 3, '8', '3-1-1', 120, 7, null),
  ('00000000-0000-4000-8002-000000000001', 3, 'exercise', 'Straight-Leg Calf Raise', '00000000-0000-4000-8001-000000000004', 3, '12 each', '2-1-2', 75, 7, 'Full range below the step.'),
  ('00000000-0000-4000-8002-000000000001', 4, 'exercise', 'Single-Arm Dumbbell Row', '00000000-0000-4000-8001-000000000014', 3, '10 each', null, 75, 7, null),
  ('00000000-0000-4000-8002-000000000001', 5, 'exercise', 'Dead Bug', '00000000-0000-4000-8001-000000000008', 3, '8 each', 'slow', 45, null, 'Lower back flat throughout.'),
  ('00000000-0000-4000-8002-000000000002', 0, 'exercise', 'Hip Airplane', '00000000-0000-4000-8001-000000000017', 2, '6 each', null, 30, null, 'Warm-up'),
  ('00000000-0000-4000-8002-000000000002', 1, 'exercise', 'Rear-Foot Elevated Split Squat', '00000000-0000-4000-8001-000000000001', 3, '8 each', '3-0-1', 120, 7, null),
  ('00000000-0000-4000-8002-000000000002', 2, 'exercise', 'Single-Leg Romanian Deadlift', '00000000-0000-4000-8001-000000000002', 3, '8 each', '3-1-1', 90, 7, 'Hips square. Stop where control stops.'),
  ('00000000-0000-4000-8002-000000000002', 3, 'exercise', 'Copenhagen Plank', '00000000-0000-4000-8001-000000000006', 3, '20s each', null, 60, null, 'Short lever if the long one shakes.'),
  ('00000000-0000-4000-8002-000000000002', 4, 'exercise', 'Bent-Knee Calf Raise', '00000000-0000-4000-8001-000000000005', 3, '15 each', '2-0-2', 60, 7, 'Soleus. Do not skip this.'),
  ('00000000-0000-4000-8002-000000000002', 5, 'exercise', 'Side Plank with Top-Leg Raise', '00000000-0000-4000-8001-000000000007', 2, '8 each', null, 45, null, null),
  ('00000000-0000-4000-8002-000000000003', 0, 'exercise', 'Pogo Hops', '00000000-0000-4000-8001-000000000011', 3, '20', null, 60, null, 'Quiet and stiff.'),
  ('00000000-0000-4000-8002-000000000003', 1, 'exercise', 'Trap-Bar Deadlift', '00000000-0000-4000-8001-000000000003', 5, '3', '2-0-X', 180, 8, 'Intent on the way up.'),
  ('00000000-0000-4000-8002-000000000003', 2, 'exercise', 'Box Jump (step down)', '00000000-0000-4000-8001-000000000012', 4, '4', null, 120, null, 'Step down every rep.'),
  ('00000000-0000-4000-8002-000000000003', 3, 'exercise', 'Barbell Hip Thrust', '00000000-0000-4000-8001-000000000010', 3, '8', '2-1-1', 120, 8, null),
  ('00000000-0000-4000-8002-000000000003', 4, 'exercise', 'Nordic Hamstring Curl (eccentric)', '00000000-0000-4000-8001-000000000019', 3, '5', 'slow eccentric', 120, 8, 'Expect soreness the first few weeks.'),
  ('00000000-0000-4000-8002-000000000003', 5, 'exercise', 'Farmer Carry', '00000000-0000-4000-8001-000000000016', 3, '40m', null, 90, 7, null),
  ('00000000-0000-4000-8002-000000000004', 0, 'exercise', 'Goblet Squat', '00000000-0000-4000-8001-000000000020', 2, '8', null, 60, 5, 'Light.'),
  ('00000000-0000-4000-8002-000000000004', 1, 'exercise', 'Single-Leg Romanian Deadlift', '00000000-0000-4000-8001-000000000002', 2, '8 each', null, 60, 5, null),
  ('00000000-0000-4000-8002-000000000004', 2, 'exercise', 'Straight-Leg Calf Raise', '00000000-0000-4000-8001-000000000004', 2, '12 each', null, 60, 5, null),
  ('00000000-0000-4000-8002-000000000004', 3, 'exercise', 'Dead Bug', '00000000-0000-4000-8001-000000000008', 2, '8 each', null, 45, null, null),
  ('00000000-0000-4000-8002-000000000005', 0, 'exercise', 'Loaded Step-Up', '00000000-0000-4000-8001-000000000009', 4, '10 each', '2-0-2', 90, 7, 'Downhill legs.'),
  ('00000000-0000-4000-8002-000000000005', 1, 'exercise', 'Single-Leg Romanian Deadlift', '00000000-0000-4000-8001-000000000002', 3, '10 each', '3-0-1', 90, 7, null),
  ('00000000-0000-4000-8002-000000000005', 2, 'exercise', 'Bent-Knee Calf Raise', '00000000-0000-4000-8001-000000000005', 4, '20 each', '2-0-2', 75, 7, 'Volume matters more than load here.'),
  ('00000000-0000-4000-8002-000000000005', 3, 'exercise', 'Farmer Carry', '00000000-0000-4000-8001-000000000016', 4, '60m', null, 90, 7, 'Posture under fatigue.'),
  ('00000000-0000-4000-8002-000000000005', 4, 'exercise', 'Copenhagen Plank', '00000000-0000-4000-8001-000000000006', 3, '25s each', null, 60, null, null),
  ('00000000-0000-4000-8002-000000000005', 5, 'exercise', 'Side Plank with Top-Leg Raise', '00000000-0000-4000-8001-000000000007', 3, '10 each', null, 45, null, null),
  ('00000000-0000-4000-8002-000000000006', 0, 'exercise', 'Pull-Up', '00000000-0000-4000-8001-000000000013', 4, '5', '2-1-1', 120, 8, 'Band assist if needed.'),
  ('00000000-0000-4000-8002-000000000006', 1, 'exercise', 'Single-Arm Dumbbell Row', '00000000-0000-4000-8001-000000000014', 3, '10 each', null, 75, 7, null),
  ('00000000-0000-4000-8002-000000000006', 2, 'exercise', 'Barbell Hip Thrust', '00000000-0000-4000-8001-000000000010', 3, '10', '2-1-1', 90, 7, 'Bike power.'),
  ('00000000-0000-4000-8002-000000000006', 3, 'exercise', 'Push-Up', '00000000-0000-4000-8001-000000000015', 3, '12', null, 60, 7, null),
  ('00000000-0000-4000-8002-000000000006', 4, 'exercise', 'Rear-Foot Elevated Split Squat', '00000000-0000-4000-8001-000000000001', 3, '8 each', null, 90, 7, null),
  ('00000000-0000-4000-8002-000000000006', 5, 'exercise', 'Dead Bug', '00000000-0000-4000-8001-000000000008', 2, '10 each', null, 45, null, null);

-- ============================================================
-- TEMPLATE → LIVE ATHLETE SESSION
--
-- The critical workflow, and the one place a mistake would be expensive.
--
-- Insertion COPIES. The new session records where it came from
-- (source_workout_template_id / source_strength_template_id) so provenance can
-- always be answered, but it holds no live link: editing the template later
-- cannot reach into a prescription an athlete has already been given, and
-- editing the athlete's session never writes back to the library.
--
-- Both functions re-check authorisation themselves — they are security definer
-- and must not assume the caller was vetted.
-- ============================================================

create or replace function im_insert_workout_template(
  p_template uuid,
  p_athlete  uuid,
  p_date     date,
  p_slot     smallint default 0
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  tpl     workout_templates;
  v_week  uuid;
  v_prog  uuid;
  v_id    uuid;
begin
  select * into tpl from workout_templates where id = p_template;
  if tpl is null then raise exception 'template not found'; end if;
  if not im_can_read_library(tpl.visibility, tpl.owner_id) then
    raise exception 'not authorised to use that template';
  end if;
  if tpl.archived_at is not null then
    raise exception 'that template is archived — restore it before prescribing from it';
  end if;
  if not (im_is_coach_of(p_athlete) or im_is_admin()) then
    raise exception 'not authorised for this athlete';
  end if;

  select w.id, w.program_id into v_week, v_prog
    from program_weeks w
   where w.athlete_id = p_athlete
     and p_date >= w.start_date and p_date < w.start_date + 7
   limit 1;

  insert into scheduled_workouts (
    program_id, program_week_id, athlete_id, date, slot, status,
    name, type, basis, intensity, distance_km, duration_minutes,
    pace_min_sec_km, pace_max_sec_km, hr_zone, rpe_target,
    warm_up, main_set, cool_down, notes, coach_note,
    source_workout_template_id, prescribed_by
  )
  values (
    v_prog, v_week, p_athlete, p_date, p_slot, 'scheduled',
    tpl.name, tpl.type, tpl.basis, tpl.intensity, tpl.distance_km, tpl.duration_minutes,
    tpl.pace_min_sec_km, tpl.pace_max_sec_km, tpl.hr_zone, tpl.rpe_target,
    tpl.warm_up, tpl.main_set, tpl.cool_down, tpl.purpose, tpl.coach_notes,
    tpl.id, auth.uid()
  )
  on conflict (athlete_id, date, slot) do update
    set name = excluded.name, type = excluded.type, basis = excluded.basis,
        intensity = excluded.intensity, distance_km = excluded.distance_km,
        duration_minutes = excluded.duration_minutes,
        pace_min_sec_km = excluded.pace_min_sec_km, pace_max_sec_km = excluded.pace_max_sec_km,
        hr_zone = excluded.hr_zone, rpe_target = excluded.rpe_target,
        warm_up = excluded.warm_up, main_set = excluded.main_set, cool_down = excluded.cool_down,
        notes = excluded.notes, coach_note = excluded.coach_note,
        source_workout_template_id = excluded.source_workout_template_id,
        program_week_id = excluded.program_week_id
  returning id into v_id;

  -- components are copied, not referenced
  delete from session_components where scheduled_workout_id = v_id;
  insert into session_components (
    scheduled_workout_id, athlete_id, position, kind, label, notes, repeats, rpe_target,
    distance_km, duration_seconds, pace_min_sec_km, pace_max_sec_km, hr_zone,
    recovery_seconds, recovery_description,
    strength_exercise_id, sets, reps, load_prescription, tempo, rest_seconds
  )
  select
    v_id, p_athlete, c.position, c.kind, c.label, c.notes, c.repeats, c.rpe_target,
    c.distance_km, c.duration_seconds, c.pace_min_sec_km, c.pace_max_sec_km, c.hr_zone,
    c.recovery_seconds, c.recovery_description,
    c.strength_exercise_id, c.sets, c.reps, c.load_prescription, c.tempo, c.rest_seconds
  from template_components c
  where c.workout_template_id = p_template
  order by c.position;

  return v_id;
end $$;

create or replace function im_insert_strength_template(
  p_template uuid,
  p_athlete  uuid,
  p_date     date,
  p_slot     smallint default 1
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  tpl    strength_templates;
  v_week uuid;
  v_prog uuid;
  v_id   uuid;
begin
  select * into tpl from strength_templates where id = p_template;
  if tpl is null then raise exception 'template not found'; end if;
  if not im_can_read_library(tpl.visibility, tpl.owner_id) then
    raise exception 'not authorised to use that template';
  end if;
  if tpl.archived_at is not null then
    raise exception 'that template is archived — restore it before prescribing from it';
  end if;
  if not (im_is_coach_of(p_athlete) or im_is_admin()) then
    raise exception 'not authorised for this athlete';
  end if;

  select w.id, w.program_id into v_week, v_prog
    from program_weeks w
   where w.athlete_id = p_athlete
     and p_date >= w.start_date and p_date < w.start_date + 7
   limit 1;

  insert into scheduled_workouts (
    program_id, program_week_id, athlete_id, date, slot, status,
    name, type, basis, intensity, duration_minutes, notes,
    strength_template_id, source_strength_template_id, prescribed_by
  )
  values (
    v_prog, v_week, p_athlete, p_date, p_slot, 'scheduled',
    tpl.name, 'strength', 'time', 'steady', tpl.estimated_minutes, tpl.description,
    tpl.id, tpl.id, auth.uid()
  )
  on conflict (athlete_id, date, slot) do update
    set name = excluded.name, type = excluded.type, basis = excluded.basis,
        intensity = excluded.intensity, duration_minutes = excluded.duration_minutes,
        notes = excluded.notes, strength_template_id = excluded.strength_template_id,
        source_strength_template_id = excluded.source_strength_template_id,
        program_week_id = excluded.program_week_id
  returning id into v_id;

  delete from session_components where scheduled_workout_id = v_id;
  insert into session_components (
    scheduled_workout_id, athlete_id, position, kind, label, notes, repeats, rpe_target,
    strength_exercise_id, sets, reps, load_prescription, tempo, rest_seconds
  )
  select
    v_id, p_athlete, c.position, c.kind, c.label, c.notes, c.repeats, c.rpe_target,
    c.strength_exercise_id, c.sets, c.reps, c.load_prescription, c.tempo, c.rest_seconds
  from template_components c
  where c.strength_template_id = p_template
  order by c.position;

  return v_id;
end $$;

-- ---------- duplicate a library item ----------
-- Duplication is how a coach adapts anything, including system content: the
-- copy is theirs, private by default, and unlinked from the original.
create or replace function im_duplicate_workout_template(p_template uuid, p_name text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  tpl workout_templates;
  v_id uuid;
begin
  select * into tpl from workout_templates where id = p_template;
  if tpl is null then raise exception 'template not found'; end if;
  if not im_can_read_library(tpl.visibility, tpl.owner_id) then
    raise exception 'not authorised to use that template';
  end if;

  insert into workout_templates (
    owner_id, visibility, name, category, type, basis, intensity,
    distance_km, duration_minutes, pace_min_sec_km, pace_max_sec_km, hr_zone, rpe_target,
    warm_up, main_set, cool_down, notes, purpose, coach_notes, tags
  )
  values (
    auth.uid(), 'private', coalesce(p_name, tpl.name || ' (copy)'), tpl.category, tpl.type,
    tpl.basis, tpl.intensity, tpl.distance_km, tpl.duration_minutes,
    tpl.pace_min_sec_km, tpl.pace_max_sec_km, tpl.hr_zone, tpl.rpe_target,
    tpl.warm_up, tpl.main_set, tpl.cool_down, tpl.notes, tpl.purpose, tpl.coach_notes, tpl.tags
  )
  returning id into v_id;

  insert into template_components (
    workout_template_id, position, kind, label, notes, repeats, rpe_target,
    distance_km, duration_seconds, pace_min_sec_km, pace_max_sec_km, hr_zone,
    recovery_seconds, recovery_description, strength_exercise_id, sets, reps,
    load_prescription, tempo, rest_seconds
  )
  select
    v_id, c.position, c.kind, c.label, c.notes, c.repeats, c.rpe_target,
    c.distance_km, c.duration_seconds, c.pace_min_sec_km, c.pace_max_sec_km, c.hr_zone,
    c.recovery_seconds, c.recovery_description, c.strength_exercise_id, c.sets, c.reps,
    c.load_prescription, c.tempo, c.rest_seconds
  from template_components c where c.workout_template_id = p_template;

  return v_id;
end $$;

create or replace function im_duplicate_strength_template(p_template uuid, p_name text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  tpl strength_templates;
  v_id uuid;
begin
  select * into tpl from strength_templates where id = p_template;
  if tpl is null then raise exception 'template not found'; end if;
  if not im_can_read_library(tpl.visibility, tpl.owner_id) then
    raise exception 'not authorised to use that template';
  end if;

  insert into strength_templates (
    owner_id, visibility, name, category, description, estimated_minutes, purpose, coach_notes, tags
  )
  values (
    auth.uid(), 'private', coalesce(p_name, tpl.name || ' (copy)'), tpl.category,
    tpl.description, tpl.estimated_minutes, tpl.purpose, tpl.coach_notes, tpl.tags
  )
  returning id into v_id;

  insert into template_components (
    strength_template_id, position, kind, label, notes, repeats, rpe_target,
    strength_exercise_id, sets, reps, load_prescription, tempo, rest_seconds
  )
  select
    v_id, c.position, c.kind, c.label, c.notes, c.repeats, c.rpe_target,
    c.strength_exercise_id, c.sets, c.reps, c.load_prescription, c.tempo, c.rest_seconds
  from template_components c where c.strength_template_id = p_template;

  return v_id;
end $$;

-- ---------- what a week actually prescribes ----------
-- target_volume_km is the coach's intent; this is what they in fact wrote.
-- The gap between the two is information, so it is surfaced and never blocks a
-- save.
create or replace function im_week_volume(p_week uuid)
returns table (prescribed_km numeric, target_km numeric, session_count integer)
language sql stable security definer set search_path = public as $$
  select
    coalesce(sum(s.distance_km), 0)::numeric as prescribed_km,
    max(w.target_volume_km)::numeric          as target_km,
    count(s.id)::integer                      as session_count
  from program_weeks w
  left join scheduled_workouts s on s.program_week_id = w.id
  where w.id = p_week
    and im_can_read_athlete(w.athlete_id);
$$;


-- Programme templates: the frames a coach starts a new athlete from. Seeded as
-- system content for the same reason the sessions are — one source, not two.
insert into program_templates (id, owner_id, visibility, name, goal_type, weeks, description) values
  ('00000000-0000-4000-8001-000000000001', null, 'system', '5K — Sharpen', '5k', 8, 'Eight weeks around one hard session and one sharpening session per week. Built for someone who already runs three or four times a week.'),
  ('00000000-0000-4000-8001-000000000002', null, 'system', '10K — Build', '10k', 10, 'Threshold-led ten-week block. Enough volume to hold the pace, enough speed to find it.'),
  ('00000000-0000-4000-8001-000000000003', null, 'system', 'Half Marathon — Foundation to Start Line', 'half_marathon', 14, 'Fourteen weeks. Long run progression, one quality session, two strength sessions a week throughout.'),
  ('00000000-0000-4000-8001-000000000004', null, 'system', 'Marathon — The Long Way', 'marathon', 18, 'Eighteen weeks with three build blocks and a three-week taper. Race-pace work lives in the long run, where it belongs.'),
  ('00000000-0000-4000-8001-000000000005', null, 'system', 'Ultra — Time on Feet', 'ultra', 24, 'Twenty-four weeks built around back-to-back long runs, terrain specificity and durability work. Volume rises slowly and steps back every fourth week.'),
  ('00000000-0000-4000-8001-000000000006', null, 'system', '70.3 — Three Disciplines', 'triathlon_70_3', 20, 'Twenty weeks balancing swim, bike and run with weekly brick work and triathlon-specific strength.'),
  ('00000000-0000-4000-8001-000000000007', null, 'system', 'General Endurance', 'general_endurance', 12, 'No start line yet. Aerobic base, consistent strength, and the habit of showing up. The best place to begin.')
on conflict (id) do nothing;
