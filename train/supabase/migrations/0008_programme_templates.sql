-- ============================================================
-- 0008 — PROGRAMME TEMPLATES
--
-- Slice 3 made a session reusable. This makes a whole programme reusable:
--
--   PROGRAMME TEMPLATE → BLOCK → WEEK → SLOT → library template → components
--
-- and assignment copies that into the athlete domain:
--
--   PROGRAMME → PROGRAM BLOCK → PROGRAM WEEK → SCHEDULED WORKOUT → COMPONENTS
--
-- A template week is relative: it knows it is week 7, not that it is the
-- week of March 9th. Dates are decided once, at assignment.
--
-- The guarantee from Slice 3 holds one level up: assignment copies, and
-- there is no live coupling afterwards. A coach can rewrite a template
-- next season without touching an athlete who is running it now.
-- ============================================================


-- ------------------------------------------------------------
-- WEEKDAYS
--
-- The domain counts weekdays ISO: Monday is 1, Sunday is 7. So do the
-- athlete availability arrays, and so does the Monday check on
-- program_weeks. This column was written 0-6 and never used — nothing has
-- ever read or written program_template_slots. Correcting it now, while
-- the table is empty, avoids an off-by-one at exactly the point this
-- slice joins template slots to athlete availability.
-- ------------------------------------------------------------

alter table program_template_slots drop constraint if exists program_template_slots_weekday_check;
alter table program_template_slots
  add constraint program_template_slots_weekday_check check (weekday between 1 and 7);


-- ------------------------------------------------------------
-- WHAT A PROGRAMME TEMPLATE IS
-- ------------------------------------------------------------

-- The disciplines a template can be written for. A checked column rather
-- than an enum: adding one should not be a two-migration job.
create or replace function im_disciplines() returns text[]
language sql immutable as $$
  select array['running','trail','triathlon','duathlon','hybrid','strength','other'];
$$;

alter table program_templates
  add column if not exists discipline        text    not null default 'running',
  add column if not exists target_distance_km numeric,
  add column if not exists experience_level  im_experience,
  add column if not exists min_days_per_week smallint,
  add column if not exists max_days_per_week smallint,
  add column if not exists purpose           text,
  add column if not exists coach_notes       text;

alter table program_templates
  drop constraint if exists program_templates_discipline_check,
  drop constraint if exists program_templates_frequency_check;

alter table program_templates
  add constraint program_templates_discipline_check
    check (discipline = any (im_disciplines())),
  -- the intended training frequency: how many days a week this programme is
  -- written for. It is what makes "this is a three-day programme" a fact
  -- about the template rather than something a coach infers by counting.
  add constraint program_templates_frequency_check check (
    (min_days_per_week is null or min_days_per_week between 1 and 7)
    and (max_days_per_week is null or max_days_per_week between 1 and 7)
    and (min_days_per_week is null or max_days_per_week is null
         or min_days_per_week <= max_days_per_week)
  );


-- ------------------------------------------------------------
-- BLOCKS AND WEEKS
--
-- Blocks and weeks are rows here for the same reason they are rows in the
-- athlete domain: so "duplicate this block" is one statement, and so a
-- week can carry a coach's intent rather than being inferred from what
-- happens to sit in it.
-- ------------------------------------------------------------

create table if not exists program_template_blocks (
  id                  uuid primary key default gen_random_uuid(),
  program_template_id uuid not null references program_templates(id) on delete cascade,
  block_index         smallint not null check (block_index >= 0),
  name                text not null,
  phase               im_phase,
  focus               text,
  description         text,
  created_at          timestamptz not null default now(),
  unique (program_template_id, block_index)
);

create table if not exists program_template_weeks (
  id                  uuid primary key default gen_random_uuid(),
  program_template_id uuid not null references program_templates(id) on delete cascade,
  block_id            uuid not null references program_template_blocks(id) on delete cascade,
  -- position within the block
  week_index          smallint not null check (week_index >= 0),
  -- position within the whole template, from one: what a coach calls "week 7"
  template_week_no    smallint not null check (template_week_no >= 1),
  -- the coach's intent for the week. Prescribed volume is computed from the
  -- sessions; this is what they meant to prescribe, and the difference is
  -- the thing worth showing them.
  target_volume_km    numeric,
  is_recovery_week    boolean not null default false,
  focus               text,
  notes               text,
  created_at          timestamptz not null default now(),
  unique (program_template_id, template_week_no),
  unique (block_id, week_index)
);

create index if not exists ptw_block_idx on program_template_weeks (block_id, week_index);


-- ------------------------------------------------------------
-- SLOTS
--
-- One row per session in the template week. Slots point at library items
-- rather than restating a prescription, which is what stops a coach
-- rewriting the same threshold session in every programme they own.
--
-- A rest day is a slot too. Making it explicit is the difference between
-- "the coach intends you to rest on Wednesday" and "nothing was written
-- for Wednesday" — and it never counts as training the athlete skipped.
-- ------------------------------------------------------------

alter table program_template_slots
  add column if not exists template_week_id uuid references program_template_weeks(id) on delete cascade,
  add column if not exists is_rest      boolean not null default false,
  add column if not exists is_optional  boolean not null default false,
  add column if not exists label        text,
  add column if not exists notes        text,
  -- narrow, deliberate overrides: "the long run is 26km in this programme"
  -- without recreating the session. Anything more belongs in its own template.
  add column if not exists distance_km      numeric,
  add column if not exists duration_minutes integer,
  add column if not exists rpe_target       smallint check (rpe_target between 1 and 10);

alter table program_template_slots
  drop constraint if exists program_template_slots_one_source,
  drop constraint if exists program_template_slots_program_template_id_week_index_weekd_key;

alter table program_template_slots
  add constraint program_template_slots_one_source check (
    case
      when is_rest then workout_template_id is null and strength_template_id is null
      else (workout_template_id is not null) <> (strength_template_id is not null)
    end
  );

create unique index if not exists pts_week_day_slot
  on program_template_slots (template_week_id, weekday, slot);


-- ------------------------------------------------------------
-- NOMINAL DURATION FOLLOWS THE STRUCTURE
--
-- program_templates.weeks was the advertised length. Once a template has
-- weeks of its own, two numbers that can disagree is one too many, so the
-- structure wins and the column follows it.
-- ------------------------------------------------------------

create or replace function im_sync_template_weeks() returns trigger
language plpgsql as $$
declare v_template uuid; v_count integer;
begin
  v_template := coalesce(new.program_template_id, old.program_template_id);
  select count(*) into v_count from program_template_weeks where program_template_id = v_template;
  if v_count > 0 then
    update program_templates set weeks = v_count, updated_at = now()
     where id = v_template and weeks is distinct from v_count;
  end if;
  return null;
end $$;

drop trigger if exists t_sync_template_weeks on program_template_weeks;
create trigger t_sync_template_weeks
  after insert or delete on program_template_weeks
  for each row execute function im_sync_template_weeks();


-- week_index on the slot was how a slot found its week before weeks were
-- rows. The week owns that now; two sources of truth is one too many.
alter table program_template_slots drop column if exists week_index;
alter table program_template_slots alter column template_week_id set not null;


-- ------------------------------------------------------------
-- ROW-LEVEL SECURITY
--
-- Blocks, weeks and slots inherit their template's visibility. There is
-- no separate ownership concept: if you can read the template you can read
-- its structure, and if you can write the template you can write it.
-- ------------------------------------------------------------

alter table program_template_blocks enable row level security;
alter table program_template_weeks  enable row level security;

drop policy if exists ptb_read  on program_template_blocks;
drop policy if exists ptb_write on program_template_blocks;
drop policy if exists ptw_read  on program_template_weeks;
drop policy if exists ptw_write on program_template_weeks;

create policy ptb_read on program_template_blocks
  for select using (exists (
    select 1 from program_templates t
     where t.id = program_template_id and im_can_read_library(t.visibility, t.owner_id)));
create policy ptb_write on program_template_blocks
  for all using (exists (
    select 1 from program_templates t
     where t.id = program_template_id and im_can_write_library(t.visibility, t.owner_id)))
  with check (exists (
    select 1 from program_templates t
     where t.id = program_template_id and im_can_write_library(t.visibility, t.owner_id)));

create policy ptw_read on program_template_weeks
  for select using (exists (
    select 1 from program_templates t
     where t.id = program_template_id and im_can_read_library(t.visibility, t.owner_id)));
create policy ptw_write on program_template_weeks
  for all using (exists (
    select 1 from program_templates t
     where t.id = program_template_id and im_can_write_library(t.visibility, t.owner_id)))
  with check (exists (
    select 1 from program_templates t
     where t.id = program_template_id and im_can_write_library(t.visibility, t.owner_id)));

-- system programme templates are immutable for the same reason system
-- sessions are: duplicate one to get a version you own
drop trigger if exists t_guard_system_program_template on program_templates;
create trigger t_guard_system_program_template before update or delete on program_templates
  for each row execute function im_guard_system_content();


-- ------------------------------------------------------------
-- WHAT A TEMPLATE WEEK ACTUALLY PRESCRIBES
--
-- The same rule im_week_volume applies to a live week — sum the distances
-- of the sessions in it — applied to a week that has no sessions yet.
-- target_volume_km stays the coach's intent; this is what they wrote.
-- ------------------------------------------------------------

create or replace function im_template_week_volume(p_template uuid)
returns table (
  template_week_no smallint,
  block_name       text,
  phase            im_phase,
  is_recovery_week boolean,
  target_km        numeric,
  prescribed_km    numeric,
  session_count    integer,
  rest_days        integer,
  training_days    integer
)
language sql stable security definer set search_path = public as $$
  select
    w.template_week_no,
    b.name,
    b.phase,
    w.is_recovery_week,
    w.target_volume_km,
    coalesce(sum(coalesce(s.distance_km, wt.distance_km)) filter (where not s.is_rest), 0)::numeric,
    count(*) filter (where not s.is_rest)::integer,
    count(*) filter (where s.is_rest)::integer,
    count(distinct s.weekday) filter (where not s.is_rest)::integer
  from program_template_weeks w
  join program_template_blocks b on b.id = w.block_id
  left join program_template_slots s on s.template_week_id = w.id
  left join workout_templates wt on wt.id = s.workout_template_id
  where w.program_template_id = p_template
    and exists (select 1 from program_templates t
                 where t.id = p_template and im_can_read_library(t.visibility, t.owner_id))
  group by w.template_week_no, b.name, b.phase, w.is_recovery_week, w.target_volume_km
  order by w.template_week_no;
$$;


-- Weekday numbers are ISO here as everywhere else. Coaches read names.
create or replace function im_weekday_list(p_days smallint[]) returns text
language sql immutable as $$
  select string_agg(
    case d
      when 1 then 'Monday'  when 2 then 'Tuesday' when 3 then 'Wednesday'
      when 4 then 'Thursday' when 5 then 'Friday' when 6 then 'Saturday'
      when 7 then 'Sunday' else d::text
    end, ', ' order by d)
  from unnest(p_days) d;
$$;


-- ------------------------------------------------------------
-- THE PRE-ASSIGNMENT CONFLICT REPORT
--
-- Two severities, and the difference matters:
--
--   'block' — proceeding would produce something invalid or unauthorised.
--             A programme with no weeks. An athlete who is not on this
--             coach's roster. A start date that is not a Monday.
--
--   'warn'  — a coaching conflict. The athlete trains four days and the
--             programme wants five. They have no gym. The prescribed
--             volume does not match what the coach intended.
--
-- Warnings are shown, never acted on. The system does not quietly move a
-- session to a day the athlete said they were free, and it does not
-- refuse the assignment because a coach knows something it does not.
-- The coach decides.
-- ------------------------------------------------------------

create or replace function im_template_conflicts(
  p_template uuid,
  p_athlete  uuid,
  p_start    date default null
)
returns table (severity text, kind text, detail text)
language plpgsql stable security definer set search_path = public as $$
declare
  v_t         program_templates;
  v_p         profiles;
  v_weeks     integer;
  v_sessions  integer;
  v_available smallint[];
  v_preferred smallint[];
  v_needed    smallint[];
  v_unmet     smallint[];
  v_days      integer;
  v_equipment text[];
  v_missing   text[];
  v_active    text;
  v_clearing  integer;
  v_keeping   integer;
begin
  select * into v_t from program_templates where id = p_template;
  select * into v_p from profiles where id = p_athlete;

  ------------------------------------------------------------------
  -- blocking: authorisation and structural integrity
  ------------------------------------------------------------------

  if v_t is null or not im_can_read_library(v_t.visibility, v_t.owner_id) then
    return query select 'block', 'template', 'That programme template is not available to you.';
    return;
  end if;

  if v_p is null then
    return query select 'block', 'athlete', 'That athlete no longer exists.';
    return;
  end if;

  if not im_is_staff() then
    return query select 'block', 'authorisation', 'Only a coach can assign a programme.';
    return;
  end if;

  if not (im_is_coach_of(p_athlete) or im_is_admin()) then
    return query select 'block', 'authorisation', 'That athlete is not on your roster.';
    return;
  end if;

  if v_t.archived_at is not null then
    return query select 'block', 'archived',
      'This template is archived. Restore it before assigning it.';
  end if;

  select count(*) into v_weeks from program_template_weeks where program_template_id = p_template;
  if v_weeks = 0 then
    return query select 'block', 'structure',
      'This template has no weeks yet. Add a block and at least one week before assigning it.';
  end if;

  select count(*) into v_sessions
    from program_template_slots s
    join program_template_weeks w on w.id = s.template_week_id
   where w.program_template_id = p_template and not s.is_rest;
  if v_weeks > 0 and v_sessions = 0 then
    return query select 'block', 'structure',
      'This template prescribes no sessions — only rest days. Add sessions before assigning it.';
  end if;

  if p_start is not null and extract(isodow from p_start) <> 1 then
    return query select 'block', 'start_date', 'A programme starts on a Monday.';
  end if;

  ------------------------------------------------------------------
  -- warnings: coaching conflicts, for the coach to weigh
  ------------------------------------------------------------------

  -- which weekdays does the template actually use?
  select array_agg(distinct s.weekday order by s.weekday) into v_needed
    from program_template_slots s
    join program_template_weeks w on w.id = s.template_week_id
   where w.program_template_id = p_template and not s.is_rest;

  v_available := v_p.available_training_days;
  v_preferred := v_p.preferred_training_days;

  if v_available is null or cardinality(v_available) = 0 then
    return query select 'warn', 'availability',
      'This athlete has not told us which days they can train, so nothing can be checked against.';
  elsif v_needed is not null then
    select array_agg(d order by d) into v_unmet
      from unnest(v_needed) d where not (d = any (v_available));

    if v_unmet is not null then
      return query select 'warn', 'availability', format(
        'The programme trains on %s, which the athlete has not said they are available for.',
        im_weekday_list(v_unmet));
    end if;

    -- days the athlete offered that the programme never uses: not a problem,
    -- but a coach re-reading their own template usually wants to know
    if cardinality(v_needed) < cardinality(v_available) then
      return query select 'warn', 'availability', format(
        'The athlete is available on %s; the programme only uses %s.',
        im_weekday_list(v_available), im_weekday_list(v_needed));
    end if;
  end if;

  if v_preferred is not null and cardinality(v_preferred) > 0 and v_needed is not null then
    select array_agg(d order by d) into v_unmet
      from unnest(v_needed) d where not (d = any (v_preferred));
    if v_unmet is not null then
      return query select 'warn', 'preferred_days', format(
        'The programme trains on %s, outside the athlete''s preferred days.',
        im_weekday_list(v_unmet));
    end if;
  end if;

  -- training frequency against what the athlete signed up for
  select max(training_days) into v_days from im_template_week_volume(p_template);
  if v_days is not null and v_available is not null and cardinality(v_available) > 0
     and v_days > cardinality(v_available) then
    return query select 'warn', 'frequency', format(
      'The heaviest week trains %s days; the athlete is available %s.',
      v_days, cardinality(v_available));
  end if;

  -- intent against prescription, week by week
  return query
    select 'warn', 'volume', format(
      'Week %s: %s km prescribed against a %s km target (%s%s km).',
      v.template_week_no, round(v.prescribed_km, 1), round(v.target_km, 1),
      case when v.prescribed_km >= v.target_km then '+' else '' end,
      round(v.prescribed_km - v.target_km, 1))
      from im_template_week_volume(p_template) v
     where v.target_km is not null
       and abs(v.prescribed_km - v.target_km) > greatest(v.target_km * 0.15, 5);

  -- equipment and gym access, where the programme actually asks for it
  select array_agg(distinct e) into v_equipment
    from program_template_slots s
    join program_template_weeks w on w.id = s.template_week_id
    join template_components c on c.strength_template_id = s.strength_template_id
    join strength_exercises x on x.id = c.strength_exercise_id
    cross join lateral unnest(x.equipment) e
   where w.program_template_id = p_template;

  if v_equipment is not null and cardinality(v_equipment) > 0 then
    if v_p.gym_access is null then
      return query select 'warn', 'gym',
        'The programme includes strength work, and the athlete has not told us what access they have.';
    elsif v_p.gym_access = 'none' then
      return query select 'warn', 'gym', format(
        'The programme''s strength work needs %s, and the athlete has no gym access.',
        array_to_string(v_equipment, ', '));
    elsif coalesce(v_p.equipment, '{}'::text[]) <> '{}'::text[] then
      select array_agg(e order by e) into v_missing
        from unnest(v_equipment) e
       where not (e = any (v_p.equipment));
      if v_missing is not null then
        return query select 'warn', 'equipment', format(
          'The programme''s strength work uses %s, which is not on the athlete''s equipment list.',
          array_to_string(v_missing, ', '));
      end if;
    end if;
  end if;

  -- an existing programme is not a conflict, but it is about to be archived
  select name into v_active from programs
   where athlete_id = p_athlete and status = 'active' limit 1;
  if v_active is not null then
    return query select 'warn', 'active_programme', format(
      'Assigning this will archive the athlete''s current programme, "%s".',
      v_active);
  end if;

  -- and what that costs them, stated plainly and separately: the sessions
  -- that go, and the training that stays because it already happened
  if p_start is not null then
    select count(*) filter (where status = 'scheduled'),
           count(*) filter (where status <> 'scheduled')
      into v_clearing, v_keeping
      from scheduled_workouts
     where athlete_id = p_athlete and date >= p_start;

    if v_clearing > 0 then
      return query select 'warn', 'replacing', format(
        '%s session(s) already scheduled from %s will be replaced by this programme.',
        v_clearing, to_char(p_start, 'FMDD Mon YYYY'));
    end if;
    if v_keeping > 0 then
      return query select 'warn', 'history_kept', format(
        '%s session(s) on or after that date are already completed or logged. Those are kept, and the programme works around them.',
        v_keeping);
    end if;
  end if;

  return;
end $$;


-- ------------------------------------------------------------
-- ASSIGNMENT
--
-- Copies the template into the athlete domain and returns the new
-- programme. Everything is copied: blocks, weeks, sessions, components.
-- The athlete's programme records which template it came from and holds
-- no live link to it, exactly as a prescribed session relates to the
-- session template it came from.
--
-- Refuses only what im_template_conflicts calls a block. Coaching
-- conflicts are the coach's to weigh, and this function never resolves
-- one on its own — no session is moved, dropped or rescheduled to fit an
-- athlete's stated availability.
-- ------------------------------------------------------------

create or replace function im_instantiate_program_template(
  p_template uuid,
  p_athlete  uuid,
  p_start    date,
  p_name     text default null,
  p_goal     uuid default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_t       program_templates;
  v_prog    uuid;
  v_block   uuid;
  v_week    uuid;
  v_weeks   integer;
  v_blocked text;
  b         record;
  w         record;
  s         record;
  v_session uuid;
  v_date    date;
begin
  -- one gate for both: whatever would refuse the assignment is refused here,
  -- in the same words the coach was shown before they pressed the button
  select detail into v_blocked
    from im_template_conflicts(p_template, p_athlete, p_start)
   where severity = 'block' limit 1;
  if v_blocked is not null then
    raise exception '%', v_blocked using errcode = 'raise_exception';
  end if;

  select * into v_t from program_templates where id = p_template;
  select count(*) into v_weeks from program_template_weeks where program_template_id = p_template;

  -- one active programme at a time; the old one is archived, never deleted,
  -- and everything the athlete completed under it stays exactly where it is
  update programs set status = 'archived'
   where athlete_id = p_athlete and status = 'active';

  -- A day holds one session per slot, so the new programme needs the old
  -- one's future days back. Only sessions that are still merely scheduled
  -- are cleared: anything the athlete completed, missed, skipped or had
  -- moved is what actually happened to them, and survives untouched. The
  -- delete trigger snapshots each one first, so the prescription history
  -- outlives the row.
  delete from scheduled_workouts
   where athlete_id = p_athlete
     and date >= p_start
     and status = 'scheduled';

  insert into programs (athlete_id, coach_id, template_id, goal_id, name, start_date, end_date, status)
  values (p_athlete, auth.uid(), p_template, p_goal,
          coalesce(p_name, v_t.name),
          p_start, (p_start + (v_weeks * 7) - 1)::date, 'active')
  returning id into v_prog;

  for b in
    select * from program_template_blocks
     where program_template_id = p_template order by block_index
  loop
    insert into program_blocks (program_id, athlete_id, block_index, name, phase, focus, notes)
    values (v_prog, p_athlete, b.block_index, b.name, b.phase, b.focus, b.description)
    returning id into v_block;

    for w in
      select * from program_template_weeks
       where block_id = b.id order by week_index
    loop
      insert into program_weeks (
        block_id, program_id, athlete_id, week_index, program_week_no,
        start_date, target_volume_km, focus, notes, is_recovery_week)
      values (
        v_block, v_prog, p_athlete, w.week_index, w.template_week_no,
        (p_start + ((w.template_week_no - 1) * 7))::date,
        w.target_volume_km, w.focus, w.notes, w.is_recovery_week)
      returning id into v_week;

      for s in
        select * from program_template_slots
         where template_week_id = w.id order by weekday, slot
      loop
        -- weekday is ISO: 1 is the Monday the week starts on
        v_date := (p_start + ((w.template_week_no - 1) * 7) + (s.weekday - 1))::date;

        if s.is_rest then
          -- an explicit rest day. It is prescribed, so the athlete sees the
          -- coach's intent; it is type 'rest', so it never counts as training
          -- they failed to do.
          insert into scheduled_workouts (
            program_id, program_week_id, athlete_id, date, slot, status,
            name, type, basis, intensity, duration_minutes, notes)
          values (
            v_prog, v_week, p_athlete, v_date, s.slot, 'scheduled',
            coalesce(s.label, 'Rest'), 'rest', 'time', 'rest', null, s.notes)
          on conflict (athlete_id, date, slot) do nothing;

        elsif s.workout_template_id is not null then
          insert into scheduled_workouts (
            program_id, program_week_id, athlete_id, date, slot, status,
            name, type, basis, intensity,
            distance_km, duration_minutes, pace_min_sec_km, pace_max_sec_km,
            hr_zone, rpe_target, warm_up, main_set, cool_down, notes,
            source_workout_template_id)
          select
            v_prog, v_week, p_athlete, v_date, s.slot, 'scheduled',
            coalesce(s.label, t.name), t.type, t.basis, t.intensity,
            coalesce(s.distance_km, t.distance_km),
            coalesce(s.duration_minutes, t.duration_minutes),
            t.pace_min_sec_km, t.pace_max_sec_km, t.hr_zone,
            coalesce(s.rpe_target, t.rpe_target),
            t.warm_up, t.main_set, t.cool_down,
            coalesce(s.notes, t.purpose),
            t.id
          from workout_templates t where t.id = s.workout_template_id
          on conflict (athlete_id, date, slot) do nothing
          returning id into v_session;

          -- the slot was held by something that already happened; leave it
          continue when v_session is null;

          insert into session_components (
            scheduled_workout_id, athlete_id, position, kind, label, notes,
            repeats, rpe_target, distance_km, duration_seconds,
            pace_min_sec_km, pace_max_sec_km, hr_zone,
            recovery_seconds, recovery_description,
            strength_exercise_id, sets, reps, load_prescription, tempo, rest_seconds)
          select
            v_session, p_athlete, c.position, c.kind, c.label, c.notes,
            c.repeats, c.rpe_target, c.distance_km, c.duration_seconds,
            c.pace_min_sec_km, c.pace_max_sec_km, c.hr_zone,
            c.recovery_seconds, c.recovery_description,
            c.strength_exercise_id, c.sets, c.reps, c.load_prescription, c.tempo, c.rest_seconds
          from template_components c
          where c.workout_template_id = s.workout_template_id
          order by c.position;

        else
          insert into scheduled_workouts (
            program_id, program_week_id, athlete_id, date, slot, status,
            name, type, basis, intensity, duration_minutes, notes,
            strength_template_id, source_strength_template_id)
          select
            v_prog, v_week, p_athlete, v_date, s.slot, 'scheduled',
            coalesce(s.label, t.name), 'strength', 'time', 'steady',
            coalesce(s.duration_minutes, t.estimated_minutes),
            coalesce(s.notes, t.purpose, t.description),
            t.id, t.id
          from strength_templates t where t.id = s.strength_template_id
          on conflict (athlete_id, date, slot) do nothing
          returning id into v_session;

          continue when v_session is null;

          insert into session_components (
            scheduled_workout_id, athlete_id, position, kind, label, notes,
            repeats, rpe_target, distance_km, duration_seconds,
            pace_min_sec_km, pace_max_sec_km, hr_zone,
            recovery_seconds, recovery_description,
            strength_exercise_id, sets, reps, load_prescription, tempo, rest_seconds)
          select
            v_session, p_athlete, c.position, c.kind, c.label, c.notes,
            c.repeats, c.rpe_target, c.distance_km, c.duration_seconds,
            c.pace_min_sec_km, c.pace_max_sec_km, c.hr_zone,
            c.recovery_seconds, c.recovery_description,
            c.strength_exercise_id, c.sets, c.reps, c.load_prescription, c.tempo, c.rest_seconds
          from template_components c
          where c.strength_template_id = s.strength_template_id
          order by c.position;
        end if;
      end loop;
    end loop;
  end loop;

  return v_prog;
end $$;


-- ------------------------------------------------------------
-- DUPLICATION
--
-- "16 Week Marathon — Intermediate" into "16 Week Marathon — High Volume",
-- then edit the copy. The whole structure comes with it; the original is
-- untouched, and the copy belongs to whoever made it.
-- ------------------------------------------------------------

create or replace function im_duplicate_program_template(
  p_source uuid,
  p_name   text default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_new   uuid;
  v_block uuid;
  v_week  uuid;
  b       record;
  w       record;
begin
  if not im_is_staff() then
    raise exception 'Only a coach can duplicate a programme template.';
  end if;
  if not exists (select 1 from program_templates t
                  where t.id = p_source and im_can_read_library(t.visibility, t.owner_id)) then
    raise exception 'That programme template is not available to you.';
  end if;

  insert into program_templates (
    owner_id, visibility, name, goal_type, weeks, description, tags,
    discipline, target_distance_km, experience_level,
    min_days_per_week, max_days_per_week, purpose, coach_notes)
  select auth.uid(), 'private', coalesce(p_name, t.name || ' (copy)'),
         t.goal_type, t.weeks, t.description, t.tags,
         t.discipline, t.target_distance_km, t.experience_level,
         t.min_days_per_week, t.max_days_per_week, t.purpose, t.coach_notes
    from program_templates t where t.id = p_source
  returning id into v_new;

  for b in select * from program_template_blocks
            where program_template_id = p_source order by block_index
  loop
    insert into program_template_blocks (program_template_id, block_index, name, phase, focus, description)
    values (v_new, b.block_index, b.name, b.phase, b.focus, b.description)
    returning id into v_block;

    for w in select * from program_template_weeks where block_id = b.id order by week_index
    loop
      insert into program_template_weeks (
        program_template_id, block_id, week_index, template_week_no,
        target_volume_km, is_recovery_week, focus, notes)
      values (v_new, v_block, w.week_index, w.template_week_no,
              w.target_volume_km, w.is_recovery_week, w.focus, w.notes)
      returning id into v_week;

      insert into program_template_slots (
        program_template_id, template_week_id, weekday, slot,
        workout_template_id, strength_template_id,
        is_rest, is_optional, label, notes, distance_km, duration_minutes, rpe_target)
      select v_new, v_week, s.weekday, s.slot,
             s.workout_template_id, s.strength_template_id,
             s.is_rest, s.is_optional, s.label, s.notes, s.distance_km, s.duration_minutes, s.rpe_target
        from program_template_slots s where s.template_week_id = w.id;
    end loop;
  end loop;

  return v_new;
end $$;
