-- ============================================================
-- IRON MILES TRAINING — programme architecture
--
--   PROGRAMME → BLOCK → WEEK → SESSION → COMPONENT
--
-- Blocks and weeks become first-class rows rather than something inferred from
-- dates. That is what makes "duplicate this block onto that athlete" a single
-- statement instead of a loop over dates, which is the difference between a
-- coach handling five athletes and a coach handling fifty.
--
-- `scheduled_workouts` is the SESSION entity. It keeps its name: renaming it
-- would churn every policy, adapter and test for no behavioural gain.
--
-- Coach prescription and athlete reality stay separate, as before:
--   scheduled_workouts + session_components   what the coach asked for
--   completed_workouts + strength_sessions    what the athlete actually did
-- ============================================================

-- ---------- component kinds ----------
-- One vocabulary for endurance and strength. Two parallel systems would mean
-- every consumer branches on session type forever.
create type im_component_kind as enum (
  'warm_up',
  'main_set',
  'interval',    -- a repeated effort with a recovery
  'exercise',    -- a strength movement
  'circuit',
  'cool_down',
  'note'
);

-- ---------- BLOCK ----------
create table program_blocks (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references programs(id) on delete cascade,
  -- denormalised so row-level security is a direct check, not a two-table join
  athlete_id  uuid not null references profiles(id) on delete cascade,
  block_index smallint not null check (block_index >= 0),
  name        text not null,
  phase       im_phase,
  focus       text,
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (program_id, block_index)
);
create index on program_blocks (program_id, block_index);
create index on program_blocks (athlete_id);

-- ---------- WEEK ----------
create table program_weeks (
  id               uuid primary key default gen_random_uuid(),
  block_id         uuid not null references program_blocks(id) on delete cascade,
  program_id       uuid not null references programs(id) on delete cascade,
  athlete_id       uuid not null references profiles(id) on delete cascade,
  -- position within the block, and within the whole programme
  week_index       smallint not null check (week_index >= 0),
  program_week_no  smallint not null check (program_week_no >= 1),
  -- always a Monday; enforced below
  start_date       date not null,
  target_volume_km numeric(6,2),
  focus            text,
  notes            text,
  -- a step-back week is a real coaching concept, not a smaller number
  is_recovery_week boolean not null default false,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (block_id, week_index),
  unique (program_id, start_date),
  constraint program_weeks_starts_monday check (extract(isodow from start_date) = 1)
);
create index on program_weeks (program_id, start_date);
create index on program_weeks (block_id, week_index);
create index on program_weeks (athlete_id, start_date);

-- ---------- SESSION ----------
-- The session gains real membership of a week, plus room for a library origin
-- so Slice 3 can attach reusable workouts without another migration.
alter table scheduled_workouts
  add column if not exists program_week_id uuid references program_weeks(id) on delete set null,
  add column if not exists source_workout_template_id uuid references workout_templates(id) on delete set null,
  add column if not exists source_strength_template_id uuid references strength_templates(id) on delete set null,
  -- who last changed the prescription, and when. The full history is in
  -- session_revisions; these two answer "is this still what I wrote?" cheaply.
  add column if not exists prescribed_by uuid references profiles(id) on delete set null,
  add column if not exists prescription_revision integer not null default 1;

create index if not exists scheduled_workouts_week_idx on scheduled_workouts (program_week_id, date);

-- ---------- COMPONENT ----------
-- The structured replacement for free-text warm-up / main set / cool-down.
-- Endurance and strength share one table; a component uses the columns its kind
-- needs and leaves the rest null.
create table session_components (
  id                   uuid primary key default gen_random_uuid(),
  scheduled_workout_id uuid not null references scheduled_workouts(id) on delete cascade,
  athlete_id           uuid not null references profiles(id) on delete cascade,
  position             smallint not null check (position >= 0),
  kind                 im_component_kind not null,
  label                text,
  notes                text,

  -- shared
  repeats              smallint check (repeats is null or repeats > 0),
  rpe_target           smallint check (rpe_target is null or rpe_target between 1 and 10),

  -- endurance
  distance_km          numeric(6,2) check (distance_km is null or distance_km >= 0),
  duration_seconds     integer check (duration_seconds is null or duration_seconds >= 0),
  pace_min_sec_km      integer,
  pace_max_sec_km      integer,
  hr_zone              smallint check (hr_zone is null or hr_zone between 1 and 5),
  recovery_seconds     integer check (recovery_seconds is null or recovery_seconds >= 0),
  recovery_description text,

  -- strength
  strength_exercise_id uuid references strength_exercises(id) on delete set null,
  sets                 smallint check (sets is null or sets > 0),
  reps                 text,
  load_prescription    text,
  tempo                text,
  rest_seconds         integer check (rest_seconds is null or rest_seconds >= 0),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  unique (scheduled_workout_id, position),

  -- a pace range must be a range
  constraint session_components_pace_ordered check (
    pace_min_sec_km is null or pace_max_sec_km is null or pace_min_sec_km <= pace_max_sec_km
  ),
  -- an exercise names something: a library movement, or free text
  constraint session_components_exercise_identified check (
    kind <> 'exercise' or strength_exercise_id is not null or label is not null
  ),
  -- a prescribed effort says how much of it: distance, time, or reps
  constraint session_components_prescribes_something check (
    kind in ('note', 'circuit')
    or distance_km is not null
    or duration_seconds is not null
    or reps is not null
    or label is not null
  )
);
create index on session_components (scheduled_workout_id, position);
create index on session_components (athlete_id);
create index on session_components (strength_exercise_id) where strength_exercise_id is not null;

comment on table session_components is
  'Ordered parts of a prescribed session. One vocabulary for endurance and strength so downstream code never branches into two programme systems.';

-- ============================================================
-- PRESCRIPTION AUDIT TRAIL
--
-- The original prescription must survive every edit, move, status change and
-- delete. Enforced by trigger rather than by convention, because a guarantee
-- that depends on every future code path remembering to call something is not
-- a guarantee.
--
-- One revision per session per transaction. A coach editing a session and its
-- six components in one save produces one revision, not seven — the unique
-- index on (session, xact) collapses them, and the snapshot is rewritten as the
-- transaction proceeds so the final state is what lands.
-- ============================================================

create type im_revision_kind as enum (
  'created',
  'edited',        -- prescription changed
  'moved',         -- date changed
  'reassigned',    -- moved to a different week
  'status_changed',-- athlete or coach changed completion status
  'deleted'
);

create table session_revisions (
  id                   uuid primary key default gen_random_uuid(),
  scheduled_workout_id uuid not null,
  athlete_id           uuid not null references profiles(id) on delete cascade,
  revision             integer not null,
  kind                 im_revision_kind not null,
  -- who caused it. Null when the change came from a server job rather than a person.
  changed_by           uuid references profiles(id) on delete set null,
  changed_at           timestamptz not null default now(),
  -- the full prescription as it stood after this change
  session              jsonb not null,
  components           jsonb not null default '[]'::jsonb,
  note                 text,
  -- collapses a multi-statement save into one revision
  xact_id              bigint not null,
  unique (scheduled_workout_id, xact_id)
);

-- deliberately NOT a foreign key to scheduled_workouts: the history of a
-- deleted session must outlive the session
create index on session_revisions (scheduled_workout_id, revision);
create index on session_revisions (athlete_id, changed_at desc);

comment on table session_revisions is
  'Append-only prescription history. Survives deletion of the session it describes, which is the point.';

-- ---------- the snapshot function ----------
create or replace function im_snapshot_session(
  p_session_id uuid,
  p_athlete_id uuid,
  p_kind       im_revision_kind,
  p_note       text default null
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_session    jsonb;
  v_components jsonb;
  v_next       integer;
begin
  -- An athlete exercising their right to erasure cascades through profiles to
  -- their sessions, which fires this trigger. Writing history for an athlete who
  -- is being deleted would both fail the foreign key and defeat the erasure, so
  -- the audit stands down. Deleting a single session still records it.
  if not exists (select 1 from profiles p where p.id = p_athlete_id) then
    return;
  end if;

  select to_jsonb(s) into v_session from scheduled_workouts s where s.id = p_session_id;

  select coalesce(jsonb_agg(to_jsonb(c) order by c.position), '[]'::jsonb)
    into v_components
    from session_components c
   where c.scheduled_workout_id = p_session_id;

  -- on delete the row is already gone; keep the last known state
  if v_session is null then
    select r.session into v_session
      from session_revisions r
     where r.scheduled_workout_id = p_session_id
     order by r.revision desc
     limit 1;
    v_session := coalesce(v_session, jsonb_build_object('id', p_session_id));
  end if;

  select coalesce(max(revision), 0) + 1 into v_next
    from session_revisions where scheduled_workout_id = p_session_id;

  insert into session_revisions (
    scheduled_workout_id, athlete_id, revision, kind, changed_by, session, components, note, xact_id
  )
  values (
    p_session_id, p_athlete_id, v_next, p_kind, auth.uid(), v_session, v_components, p_note,
    pg_current_xact_id()::text::bigint
  )
  on conflict (scheduled_workout_id, xact_id) do update
    set session    = excluded.session,
        components = excluded.components,
        -- a delete outranks anything else recorded in the same transaction
        kind       = case when excluded.kind = 'deleted' then excluded.kind else session_revisions.kind end,
        note       = coalesce(excluded.note, session_revisions.note),
        changed_at = now();
end $$;

-- ---------- triggers ----------
-- Classification is shared: the BEFORE trigger uses it to advance the
-- prescription counter, the AFTER trigger uses it to label the snapshot. It
-- must be one function so the two can never disagree about what happened.
create or replace function im_classify_session_change(
  o scheduled_workouts,
  n scheduled_workouts
) returns im_revision_kind
language sql immutable as $$
  select case
    when n.program_week_id is distinct from o.program_week_id then 'reassigned'::im_revision_kind
    when n.date is distinct from o.date then 'moved'::im_revision_kind
    when (
      n.name, n.type, n.basis, n.intensity, n.distance_km, n.duration_minutes,
      n.pace_min_sec_km, n.pace_max_sec_km, n.hr_zone, n.rpe_target,
      n.warm_up, n.main_set, n.cool_down, n.notes, n.coach_note,
      n.strength_template_id, n.race_id
    ) is distinct from (
      o.name, o.type, o.basis, o.intensity, o.distance_km, o.duration_minutes,
      o.pace_min_sec_km, o.pace_max_sec_km, o.hr_zone, o.rpe_target,
      o.warm_up, o.main_set, o.cool_down, o.notes, o.coach_note,
      o.strength_template_id, o.race_id
    ) then 'edited'::im_revision_kind
    when n.status is distinct from o.status then 'status_changed'::im_revision_kind
    else null
  end;
$$;

-- BEFORE: advance the prescription counter, so the stored row carries it.
-- Only prescription changes advance it — an athlete completing a session must
-- not look like a coach edit.
create or replace function im_session_bump() returns trigger
language plpgsql as $$
begin
  if im_classify_session_change(old, new) in ('edited', 'moved', 'reassigned') then
    new.prescription_revision := old.prescription_revision + 1;
  end if;
  return new;
end $$;

-- AFTER: snapshot. It has to be AFTER, or the snapshot records the row as it
-- was before the change and the history lags by one.
create or replace function im_session_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_kind im_revision_kind;
begin
  if tg_op = 'INSERT' then
    perform im_snapshot_session(new.id, new.athlete_id, 'created');
    return null;
  end if;

  if tg_op = 'DELETE' then
    perform im_snapshot_session(old.id, old.athlete_id, 'deleted');
    return null;
  end if;

  v_kind := im_classify_session_change(old, new);
  if v_kind is null then
    return null; -- nothing worth recording
  end if;

  perform im_snapshot_session(new.id, new.athlete_id, v_kind);
  return null;
end $$;

create trigger t_session_bump
  before update on scheduled_workouts
  for each row execute function im_session_bump();

create trigger t_session_audit
  after insert or update or delete on scheduled_workouts
  for each row execute function im_session_audit();

-- component changes are prescription changes; they fold into the same revision
create or replace function im_component_audit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_session uuid;
  v_athlete uuid;
begin
  v_session := coalesce(new.scheduled_workout_id, old.scheduled_workout_id);
  v_athlete := coalesce(new.athlete_id, old.athlete_id);
  perform im_snapshot_session(v_session, v_athlete, 'edited');
  return null;
end $$;

create trigger t_component_audit
  after insert or update or delete on session_components
  for each row execute function im_component_audit();

-- ---------- reading the history ----------
-- The question a coach actually asks: what did I originally prescribe here?
create or replace function im_original_prescription(p_session_id uuid)
returns jsonb
language sql stable security definer set search_path = public as $$
  select r.session
    from session_revisions r
   where r.scheduled_workout_id = p_session_id
     and (auth.uid() is null or im_can_read_athlete(r.athlete_id))
   order by r.revision asc
   limit 1;
$$;

-- ============================================================
-- BACKFILL
--
-- Every existing programme gets one block and a week per calendar week of its
-- range, and every existing session is attached to the week it already sits in.
-- Nothing is moved and nothing is discarded — the sessions keep their dates,
-- they simply gain the membership they were missing.
-- ============================================================

do $$
declare
  p        record;
  v_block  uuid;
  v_monday date;
  v_last   date;
  v_i      smallint;
begin
  for p in select * from programs order by created_at loop
    -- already migrated?
    continue when exists (select 1 from program_blocks b where b.program_id = p.id);

    insert into program_blocks (program_id, athlete_id, block_index, name, notes)
    values (p.id, p.athlete_id, 0, p.name,
            'Created by migration 0005 from the programme''s existing date range.')
    returning id into v_block;

    v_monday := (p.start_date - ((extract(isodow from p.start_date)::int - 1) || ' days')::interval)::date;
    v_last   := (p.end_date   - ((extract(isodow from p.end_date)::int   - 1) || ' days')::interval)::date;
    v_i := 0;

    while v_monday <= v_last loop
      insert into program_weeks (block_id, program_id, athlete_id, week_index, program_week_no, start_date)
      values (v_block, p.id, p.athlete_id, v_i, v_i + 1, v_monday)
      on conflict (program_id, start_date) do nothing;
      v_monday := v_monday + 7;
      v_i := v_i + 1;
    end loop;
  end loop;
end $$;

-- attach existing sessions to the week containing their date
update scheduled_workouts s
   set program_week_id = w.id
  from program_weeks w
 where s.program_week_id is null
   and s.program_id = w.program_id
   and s.date >= w.start_date
   and s.date <  w.start_date + 7;

-- ============================================================
-- DUPLICATION
--
-- All set-based and all inside the database. A coach copying a four-week block
-- onto an athlete is one statement, not eighty round trips — which is the
-- difference between a roster of five and a roster of fifty.
--
-- Every function re-checks authorisation itself. They are security definer, so
-- they must not assume the caller was already vetted.
-- ============================================================

-- Copy one week's prescription onto a target Monday, creating the week if needed.
create or replace function im_duplicate_week(
  p_source_week  uuid,
  p_target_start date,
  p_target_block uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  src      program_weeks;
  v_block  uuid;
  v_week   uuid;
  v_index  smallint;
  v_no     smallint;
  s        record;
  v_new    uuid;
begin
  select * into src from program_weeks where id = p_source_week;
  if src is null then raise exception 'source week not found'; end if;
  if not (im_is_coach_of(src.athlete_id) or im_is_admin()) then
    raise exception 'not authorised for this athlete';
  end if;
  if extract(isodow from p_target_start) <> 1 then
    raise exception 'a training week starts on a Monday';
  end if;

  v_block := coalesce(p_target_block, src.block_id);

  select w.id into v_week from program_weeks w
   where w.program_id = src.program_id and w.start_date = p_target_start;

  if v_week is null then
    select coalesce(max(week_index), -1) + 1 into v_index from program_weeks where block_id = v_block;
    select coalesce(max(program_week_no), 0) + 1 into v_no from program_weeks where program_id = src.program_id;

    insert into program_weeks (
      block_id, program_id, athlete_id, week_index, program_week_no, start_date,
      target_volume_km, focus, notes, is_recovery_week
    )
    values (
      v_block, src.program_id, src.athlete_id, v_index, v_no, p_target_start,
      src.target_volume_km, src.focus, src.notes, src.is_recovery_week
    )
    returning id into v_week;
  end if;

  -- copy each session, preserving its weekday offset within the week
  for s in
    select * from scheduled_workouts
     where program_week_id = p_source_week
     order by date, slot
  loop
    insert into scheduled_workouts (
      program_id, program_week_id, athlete_id, date, slot, status, name, type, basis, intensity,
      distance_km, duration_minutes, pace_min_sec_km, pace_max_sec_km, hr_zone, rpe_target,
      warm_up, main_set, cool_down, notes, coach_note, strength_template_id,
      source_workout_template_id, source_strength_template_id, prescribed_by
    )
    values (
      s.program_id, v_week, s.athlete_id,
      p_target_start + (s.date - src.start_date), s.slot,
      -- a copy is a plan again, whatever happened to the original
      'scheduled',
      s.name, s.type, s.basis, s.intensity,
      s.distance_km, s.duration_minutes, s.pace_min_sec_km, s.pace_max_sec_km, s.hr_zone, s.rpe_target,
      s.warm_up, s.main_set, s.cool_down, s.notes, s.coach_note, s.strength_template_id,
      s.source_workout_template_id, s.source_strength_template_id, auth.uid()
    )
    on conflict (athlete_id, date, slot) do update
      set name = excluded.name, type = excluded.type, basis = excluded.basis,
          intensity = excluded.intensity, distance_km = excluded.distance_km,
          duration_minutes = excluded.duration_minutes,
          pace_min_sec_km = excluded.pace_min_sec_km, pace_max_sec_km = excluded.pace_max_sec_km,
          hr_zone = excluded.hr_zone, rpe_target = excluded.rpe_target,
          warm_up = excluded.warm_up, main_set = excluded.main_set, cool_down = excluded.cool_down,
          notes = excluded.notes, coach_note = excluded.coach_note,
          strength_template_id = excluded.strength_template_id,
          program_week_id = excluded.program_week_id
    returning id into v_new;

    -- and its components
    delete from session_components where scheduled_workout_id = v_new;
    insert into session_components (
      scheduled_workout_id, athlete_id, position, kind, label, notes, repeats, rpe_target,
      distance_km, duration_seconds, pace_min_sec_km, pace_max_sec_km, hr_zone,
      recovery_seconds, recovery_description,
      strength_exercise_id, sets, reps, load_prescription, tempo, rest_seconds
    )
    select
      v_new, c.athlete_id, c.position, c.kind, c.label, c.notes, c.repeats, c.rpe_target,
      c.distance_km, c.duration_seconds, c.pace_min_sec_km, c.pace_max_sec_km, c.hr_zone,
      c.recovery_seconds, c.recovery_description,
      c.strength_exercise_id, c.sets, c.reps, c.load_prescription, c.tempo, c.rest_seconds
    from session_components c
    where c.scheduled_workout_id = s.id;
  end loop;

  return v_week;
end $$;

-- Copy an entire block — all its weeks, sessions and components.
create or replace function im_duplicate_block(
  p_source_block uuid,
  p_target_start date,
  p_name         text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  src       program_blocks;
  v_block   uuid;
  v_index   smallint;
  w         record;
  v_offset  integer;
begin
  select * into src from program_blocks where id = p_source_block;
  if src is null then raise exception 'source block not found'; end if;
  if not (im_is_coach_of(src.athlete_id) or im_is_admin()) then
    raise exception 'not authorised for this athlete';
  end if;
  if extract(isodow from p_target_start) <> 1 then
    raise exception 'a block starts on a Monday';
  end if;

  select coalesce(max(block_index), -1) + 1 into v_index
    from program_blocks where program_id = src.program_id;

  insert into program_blocks (program_id, athlete_id, block_index, name, phase, focus, notes)
  values (src.program_id, src.athlete_id, v_index,
          coalesce(p_name, src.name || ' (copy)'), src.phase, src.focus, src.notes)
  returning id into v_block;

  select p_target_start - min(start_date) into v_offset
    from program_weeks where block_id = p_source_block;

  for w in select * from program_weeks where block_id = p_source_block order by week_index loop
    perform im_duplicate_week(w.id, (w.start_date + v_offset)::date, v_block);
  end loop;

  return v_block;
end $$;

-- Assign an existing programme's whole structure to another athlete.
-- This is the lever that makes a roster of fifty tractable: a coach writes a
-- block once and hands it to everyone it suits, then edits per athlete.
create or replace function im_assign_program(
  p_source_program uuid,
  p_athlete        uuid,
  p_start          date,
  p_name           text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  src      programs;
  v_prog   uuid;
  v_offset integer;
  v_block  uuid;
  b        record;
  w        record;
begin
  select * into src from programs where id = p_source_program;
  if src is null then raise exception 'source programme not found'; end if;
  if not im_is_staff() then raise exception 'only a coach may assign a programme'; end if;
  if not (im_is_coach_of(p_athlete) or im_is_admin()) then
    raise exception 'not authorised for this athlete';
  end if;
  if not (im_is_coach_of(src.athlete_id) or im_is_admin()) then
    raise exception 'not authorised to copy that programme';
  end if;
  if extract(isodow from p_start) <> 1 then
    raise exception 'a programme starts on a Monday';
  end if;

  v_offset := p_start - src.start_date;

  -- one active programme per athlete
  update programs set status = 'archived'
   where athlete_id = p_athlete and status = 'active';

  insert into programs (athlete_id, coach_id, template_id, goal_id, name, start_date, end_date, status)
  values (p_athlete, auth.uid(), src.template_id, null,
          coalesce(p_name, src.name),
          p_start, (src.end_date + v_offset)::date, 'active')
  returning id into v_prog;

  for b in select * from program_blocks where program_id = p_source_program order by block_index loop
    insert into program_blocks (program_id, athlete_id, block_index, name, phase, focus, notes)
    values (v_prog, p_athlete, b.block_index, b.name, b.phase, b.focus, b.notes)
    returning id into v_block;

    for w in select * from program_weeks where block_id = b.id order by week_index loop
      insert into program_weeks (
        block_id, program_id, athlete_id, week_index, program_week_no, start_date,
        target_volume_km, focus, notes, is_recovery_week
      )
      values (
        v_block, v_prog, p_athlete, w.week_index, w.program_week_no,
        (w.start_date + v_offset)::date,
        w.target_volume_km, w.focus, w.notes, w.is_recovery_week
      );

      insert into scheduled_workouts (
        program_id, program_week_id, athlete_id, date, slot, status, name, type, basis, intensity,
        distance_km, duration_minutes, pace_min_sec_km, pace_max_sec_km, hr_zone, rpe_target,
        warm_up, main_set, cool_down, notes, coach_note, strength_template_id,
        source_workout_template_id, source_strength_template_id, prescribed_by
      )
      select
        v_prog,
        (select id from program_weeks pw where pw.block_id = v_block and pw.week_index = w.week_index),
        p_athlete, (s.date + v_offset)::date, s.slot, 'scheduled',
        s.name, s.type, s.basis, s.intensity,
        s.distance_km, s.duration_minutes, s.pace_min_sec_km, s.pace_max_sec_km, s.hr_zone, s.rpe_target,
        s.warm_up, s.main_set, s.cool_down, s.notes, s.coach_note, s.strength_template_id,
        s.source_workout_template_id, s.source_strength_template_id, auth.uid()
      from scheduled_workouts s
      where s.program_week_id = w.id
      on conflict (athlete_id, date, slot) do nothing;
    end loop;
  end loop;

  return v_prog;
end $$;

-- ============================================================
-- ROW-LEVEL SECURITY
--
-- Same rule as everywhere else in this schema: the athlete reads their own
-- programme, their coach reads and writes it, nobody else sees it. Blocks and
-- weeks carry athlete_id precisely so this is a direct check.
-- ============================================================

alter table program_blocks     enable row level security;
alter table program_blocks     force row level security;
alter table program_weeks      enable row level security;
alter table program_weeks      force row level security;
alter table session_components enable row level security;
alter table session_components force row level security;
alter table session_revisions  enable row level security;
alter table session_revisions  force row level security;

create policy blocks_read on program_blocks
  for select using (im_can_read_athlete(athlete_id));
create policy blocks_write on program_blocks
  for all using (im_is_coach_of(athlete_id) or im_is_admin())
  with check (im_is_coach_of(athlete_id) or im_is_admin());

create policy weeks_read on program_weeks
  for select using (im_can_read_athlete(athlete_id));
create policy weeks_write on program_weeks
  for all using (im_is_coach_of(athlete_id) or im_is_admin())
  with check (im_is_coach_of(athlete_id) or im_is_admin());

-- components are prescription: the coach writes them, the athlete reads them
create policy components_read on session_components
  for select using (im_can_read_athlete(athlete_id));
create policy components_write on session_components
  for all using (im_is_coach_of(athlete_id) or im_is_admin())
  with check (im_is_coach_of(athlete_id) or im_is_admin());

-- History is readable by both sides and writable by neither. The trigger writes
-- it as security definer; no client may insert, amend or erase it. An audit
-- trail a coach could edit would not be an audit trail.
create policy revisions_read on session_revisions
  for select using (im_can_read_athlete(athlete_id));
