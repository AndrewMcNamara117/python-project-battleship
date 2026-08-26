-- ============================================================
-- 0010 — PROGRAMME FROM AN ATHLETE
--
-- The reverse of Slice 4. A coach who has adapted a programme until it
-- works can save that shape back out as a reusable template:
--
--   template → assign → adapt → save the good version back as a template
--
-- The snapshot is independent in both directions. Editing the athlete's
-- programme afterwards does not touch the template, and editing the
-- template does not touch the athlete — the same guarantee that has held
-- since Slice 3, now closing the loop.
--
-- What travels is the prescription. What the athlete actually did stays
-- with the athlete.
-- ============================================================


-- ------------------------------------------------------------
-- WRITING TO A LIBRARY IS COACH WORK
--
-- im_can_write_library checked ownership but not role, so an athlete
-- could insert programme templates and library sessions owned by
-- themselves. They could never read them back — the read side has always
-- required staff — but the rows were real, and a library an athlete can
-- write to is not a coach's library.
--
-- This matters more now: a programme becomes a template through the
-- coach's own account, and nothing about that should widen who may
-- create one.
-- ------------------------------------------------------------

create or replace function im_can_write_library(p_visibility im_visibility, p_owner uuid)
returns boolean language sql stable as $$
  select im_is_staff()
     and p_visibility <> 'system'
     and (p_owner = auth.uid() or im_is_admin());
$$;


-- ------------------------------------------------------------
-- WHAT A SESSION WOULD BECOME
--
-- A live session turns into a template slot one of three ways:
--
--   'rest'      — a prescribed rest day. Carries no load and never has.
--   'library'   — it came from a library item and still matches it, give
--                 or take the narrow overrides a slot can hold: a name,
--                 a distance, a duration, an RPE.
--   'promote'   — everything else. A session with no library origin, or
--                 one that has been changed in ways a slot override
--                 cannot express, is a workout definition. It becomes a
--                 library item the coach owns rather than being smuggled
--                 into the programme as a hidden session.
--
-- That third rule is the one worth stating out loud. Slots stay narrow
-- on purpose; the moment a session is materially different it earns its
-- own entry in the library.
-- ------------------------------------------------------------

create or replace function im_session_disposition(p_session scheduled_workouts)
returns text language plpgsql stable as $$
declare src workout_templates; s_src strength_templates;
begin
  if p_session.type = 'rest' then
    return 'rest';
  end if;

  if p_session.source_workout_template_id is not null then
    select * into src from workout_templates where id = p_session.source_workout_template_id;
    if src is null then return 'promote'; end if;

    -- anything a slot cannot say, said differently, makes this its own session
    if p_session.type is distinct from src.type
       or p_session.basis is distinct from src.basis
       or p_session.intensity is distinct from src.intensity
       or p_session.pace_min_sec_km is distinct from src.pace_min_sec_km
       or p_session.pace_max_sec_km is distinct from src.pace_max_sec_km
       or p_session.hr_zone is distinct from src.hr_zone
       or coalesce(p_session.warm_up, '') is distinct from coalesce(src.warm_up, '')
       or coalesce(p_session.main_set, '') is distinct from coalesce(src.main_set, '')
       or coalesce(p_session.cool_down, '') is distinct from coalesce(src.cool_down, '')
    then
      return 'promote';
    end if;
    return 'library';
  end if;

  if p_session.source_strength_template_id is not null then
    select * into s_src from strength_templates where id = p_session.source_strength_template_id;
    if s_src is null then return 'promote'; end if;
    return 'library';
  end if;

  return 'promote';
end $$;


-- ------------------------------------------------------------
-- THE PREVIEW
--
-- What the coach reads before saving. Two things it has to be honest
-- about: what will travel, and what will not.
-- ------------------------------------------------------------

create or replace function im_extract_preview(p_program uuid)
returns table (severity text, kind text, detail text, count integer)
language plpgsql stable security definer set search_path = public as $$
declare
  v_p        programs;
  v_blocks   integer;
  v_weeks    integer;
  v_sessions integer;
  v_promote  integer;
  v_rest     integer;
  v_notes    integer;
  v_races    integer;
  v_done     integer;
  v_novolume integer;
begin
  select * into v_p from programs where id = p_program;

  if v_p is null then
    return query select 'block', 'programme', 'That programme no longer exists.', 0;
    return;
  end if;
  if not im_is_staff() then
    return query select 'block', 'authorisation', 'Only a coach can save a programme as a template.', 0;
    return;
  end if;
  if not (im_is_coach_of(v_p.athlete_id) or im_is_admin()) then
    return query select 'block', 'authorisation', 'That athlete is not on your roster.', 0;
    return;
  end if;

  select count(*) into v_blocks from program_blocks where program_id = p_program;
  select count(*) into v_weeks  from program_weeks  where program_id = p_program;
  select count(*) into v_sessions from scheduled_workouts
   where program_id = p_program and program_week_id is not null;

  if v_weeks = 0 then
    return query select 'block', 'structure',
      'This programme has no weeks, so there is no shape to save.', 0;
    return;
  end if;
  if v_sessions = 0 then
    return query select 'block', 'structure',
      'This programme has no sessions attached to its weeks.', 0;
    return;
  end if;

  -- what travels
  return query select 'info', 'structure', format(
    '%s block(s), %s week(s) and %s session(s) will be saved.',
    v_blocks, v_weeks, v_sessions), v_sessions;

  select count(*) into v_rest from scheduled_workouts
   where program_id = p_program and program_week_id is not null and type = 'rest';
  if v_rest > 0 then
    return query select 'info', 'rest',
      format('%s prescribed rest day(s) are kept as rest days.', v_rest), v_rest;
  end if;

  select count(*) into v_promote from scheduled_workouts s
   where s.program_id = p_program and s.program_week_id is not null
     and im_session_disposition(s.*) = 'promote';
  if v_promote > 0 then
    return query select 'warn', 'promote', format(
      '%s session(s) are not in your library, or have been changed beyond what a slot can hold. '
      'Each becomes a new private session in your workout library so the template can point at it.',
      v_promote), v_promote;
  end if;

  -- what does not travel
  select count(*) into v_done from scheduled_workouts
   where program_id = p_program and status <> 'scheduled';
  if v_done > 0 then
    return query select 'info', 'execution', format(
      '%s session(s) have been completed, missed or moved. The template takes what was prescribed, '
      'never what happened.', v_done), v_done;
  end if;

  select count(*) filter (where coalesce(s.coach_note, '') <> '') into v_notes
    from scheduled_workouts s where s.program_id = p_program;
  select v_notes + count(*) filter (where coalesce(w.notes, '') <> '') into v_notes
    from program_weeks w where w.program_id = p_program;
  if v_notes > 0 then
    return query select 'warn', 'notes', format(
      '%s coach note(s) on weeks and sessions will not be copied — they usually refer to this athlete.',
      v_notes), v_notes;
  end if;

  select count(*) into v_races from scheduled_workouts
   where program_id = p_program and race_id is not null;
  if v_races > 0 then
    return query select 'warn', 'race', format(
      '%s session(s) are tied to a specific race. The session travels; the race does not.',
      v_races), v_races;
  end if;

  select count(*) into v_novolume from program_weeks
   where program_id = p_program and target_volume_km is null;
  if v_novolume > 0 then
    return query select 'info', 'volume', format(
      '%s week(s) have no intended volume set, so the template will not carry one for them.',
      v_novolume), v_novolume;
  end if;

  return;
end $$;


-- ------------------------------------------------------------
-- THE EXTRACTION
--
-- Copies the programme's prescription into a new template the coach
-- owns. Two things it deliberately does not do:
--
--   It does not clone library content. A session that came from a
--   library item and still matches it becomes a slot pointing at that
--   same item — the library does not grow a duplicate every time a
--   coach saves a programme.
--
--   It does not carry the athlete. No status, no logged result, no
--   coach note, no race, no pace or heart rate the athlete actually
--   ran. What is saved is what was prescribed.
-- ------------------------------------------------------------

create or replace function im_extract_program_template(
  p_program            uuid,
  p_name               text,
  p_visibility         im_visibility default 'private',
  p_discipline         text     default 'running',
  p_goal_type          im_event_type default null,
  p_target_distance_km numeric  default null,
  p_experience         im_experience default null,
  p_min_days           smallint default null,
  p_max_days           smallint default null,
  p_purpose            text     default null,
  p_coach_notes        text     default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_p        programs;
  v_new      uuid;
  v_block    uuid;
  v_week     uuid;
  v_blocked  text;
  v_goal     im_event_type;
  v_min      smallint;
  v_max      smallint;
  b          record;
  w          record;
  -- the row type, not a bare record: im_session_disposition takes a
  -- scheduled_workouts and a loop record will not coerce to one
  s          scheduled_workouts%rowtype;
  v_disp     text;
  v_src      workout_templates;
  v_promoted uuid;
  v_key      text;
  -- one promoted library item per distinct session, however many weeks use it
  v_seen     jsonb := '{}'::jsonb;
begin
  select detail into v_blocked
    from im_extract_preview(p_program) where severity = 'block' limit 1;
  if v_blocked is not null then
    raise exception '%', v_blocked using errcode = 'raise_exception';
  end if;

  if p_visibility = 'system' then
    raise exception 'A saved programme belongs to the coach who saved it, not to Iron Miles.';
  end if;
  if coalesce(trim(p_name), '') = '' then
    raise exception 'Give the template a name.';
  end if;

  select * into v_p from programs where id = p_program;

  -- the goal the programme was written for, unless the coach says otherwise
  v_goal := coalesce(p_goal_type, (select g.event_type from goals g
                                    where g.id = v_p.goal_id));
  if v_goal is null then
    select event_type into v_goal from goals
     where athlete_id = v_p.athlete_id and is_primary order by created_at desc limit 1;
  end if;
  v_goal := coalesce(v_goal, 'general_endurance');

  -- read the training frequency off the programme rather than asking the
  -- coach to count: it is a fact about what they built
  select min(d), max(d) into v_min, v_max from (
    select count(distinct extract(isodow from s2.date))::smallint d
      from scheduled_workouts s2
      join program_weeks w2 on w2.id = s2.program_week_id
     where w2.program_id = p_program and s2.type <> 'rest'
     group by w2.id
  ) per_week;

  insert into program_templates (
    owner_id, visibility, name, goal_type, weeks, description,
    discipline, target_distance_km, experience_level,
    min_days_per_week, max_days_per_week, purpose, coach_notes)
  values (
    auth.uid(), p_visibility, trim(p_name), v_goal,
    greatest((select count(*) from program_weeks where program_id = p_program), 1),
    coalesce(p_purpose, ''),
    p_discipline, p_target_distance_km, p_experience,
    coalesce(p_min_days, v_min), coalesce(p_max_days, v_max),
    p_purpose, p_coach_notes)
  returning id into v_new;

  for b in
    select * from program_blocks where program_id = p_program order by block_index
  loop
    -- block notes stay with the athlete; name, phase and focus are the plan
    insert into program_template_blocks (program_template_id, block_index, name, phase, focus, description)
    values (v_new, b.block_index, b.name, b.phase, b.focus, null)
    returning id into v_block;

    for w in
      select * from program_weeks where block_id = b.id order by week_index
    loop
      insert into program_template_weeks (
        program_template_id, block_id, week_index, template_week_no,
        target_volume_km, is_recovery_week, focus, notes)
      values (
        v_new, v_block, w.week_index, w.program_week_no,
        w.target_volume_km, w.is_recovery_week, w.focus, null)
      returning id into v_week;

      for s in
        select * from scheduled_workouts
         where program_week_id = w.id
         order by date, slot
      loop
        v_disp := im_session_disposition(s);

        if v_disp = 'rest' then
          insert into program_template_slots (
            program_template_id, template_week_id, weekday, slot, is_rest, label)
          values (v_new, v_week, extract(isodow from s.date)::smallint, s.slot, true,
                  nullif(s.name, 'Rest'));

        elsif v_disp = 'library' and s.source_strength_template_id is not null then
          insert into program_template_slots (
            program_template_id, template_week_id, weekday, slot,
            strength_template_id, duration_minutes, label)
          values (v_new, v_week, extract(isodow from s.date)::smallint, s.slot,
                  s.source_strength_template_id,
                  s.duration_minutes,
                  nullif(s.name, (select name from strength_templates
                                   where id = s.source_strength_template_id)));

        elsif v_disp = 'library' then
          select * into v_src from workout_templates where id = s.source_workout_template_id;
          insert into program_template_slots (
            program_template_id, template_week_id, weekday, slot,
            workout_template_id, label, distance_km, duration_minutes, rpe_target)
          values (
            v_new, v_week, extract(isodow from s.date)::smallint, s.slot,
            s.source_workout_template_id,
            -- only record an override where it actually differs
            nullif(s.name, v_src.name),
            case when s.distance_km is distinct from v_src.distance_km then s.distance_km end,
            case when s.duration_minutes is distinct from v_src.duration_minutes then s.duration_minutes end,
            case when s.rpe_target is distinct from v_src.rpe_target then s.rpe_target end);

        else
          -- a session the library does not hold. Promote it once, then reuse
          -- that library item everywhere the same session appears.
          v_key := md5(concat_ws('|', s.name, s.type, s.basis, s.intensity,
                                 s.distance_km, s.duration_minutes, s.pace_min_sec_km,
                                 s.pace_max_sec_km, s.hr_zone, s.rpe_target,
                                 s.warm_up, s.main_set, s.cool_down));

          if v_seen ? v_key then
            v_promoted := (v_seen ->> v_key)::uuid;
          elsif s.type = 'strength' then
            insert into strength_templates (owner_id, visibility, name, category,
                                            description, estimated_minutes, purpose)
            values (auth.uid(), p_visibility, s.name, 'foundation',
                    coalesce(s.main_set, ''), coalesce(s.duration_minutes, 45), s.notes)
            returning id into v_promoted;

            insert into template_components (
              strength_template_id, position, kind, label, notes, repeats, rpe_target,
              distance_km, duration_seconds, pace_min_sec_km, pace_max_sec_km, hr_zone,
              recovery_seconds, recovery_description, strength_exercise_id,
              sets, reps, load_prescription, tempo, rest_seconds)
            select v_promoted, c.position, c.kind, c.label, c.notes, c.repeats, c.rpe_target,
                   c.distance_km, c.duration_seconds, c.pace_min_sec_km, c.pace_max_sec_km, c.hr_zone,
                   c.recovery_seconds, c.recovery_description, c.strength_exercise_id,
                   c.sets, c.reps, c.load_prescription, c.tempo, c.rest_seconds
              from session_components c
             where c.scheduled_workout_id = s.id
             order by c.position;

            v_seen := v_seen || jsonb_build_object(v_key, v_promoted);
          else
            insert into workout_templates (
              owner_id, visibility, name, category, type, basis, intensity,
              distance_km, duration_minutes, pace_min_sec_km, pace_max_sec_km,
              hr_zone, rpe_target, warm_up, main_set, cool_down, purpose)
            values (
              auth.uid(), p_visibility, s.name,
              case s.type
                when 'easy_run' then 'easy' when 'recovery_run' then 'recovery'
                when 'long_run' then 'long_run' when 'threshold' then 'threshold'
                when 'intervals' then 'intervals' when 'hills' then 'hills'
                when 'tempo' then 'tempo' when 'progression_run' then 'progression'
                when 'race_pace' then 'race_specific' when 'brick' then 'race_specific'
                when 'race' then 'race' when 'mobility' then 'mobility'
                when 'bike' then 'cross_training' when 'swim' then 'cross_training'
                when 'cross_training' then 'cross_training'
                else 'custom'
              end::im_workout_category,
              s.type, s.basis, s.intensity,
              s.distance_km, s.duration_minutes, s.pace_min_sec_km, s.pace_max_sec_km,
              s.hr_zone, s.rpe_target, s.warm_up, s.main_set, s.cool_down, s.notes)
            returning id into v_promoted;

            insert into template_components (
              workout_template_id, position, kind, label, notes, repeats, rpe_target,
              distance_km, duration_seconds, pace_min_sec_km, pace_max_sec_km, hr_zone,
              recovery_seconds, recovery_description, strength_exercise_id,
              sets, reps, load_prescription, tempo, rest_seconds)
            select v_promoted, c.position, c.kind, c.label, c.notes, c.repeats, c.rpe_target,
                   c.distance_km, c.duration_seconds, c.pace_min_sec_km, c.pace_max_sec_km, c.hr_zone,
                   c.recovery_seconds, c.recovery_description, c.strength_exercise_id,
                   c.sets, c.reps, c.load_prescription, c.tempo, c.rest_seconds
              from session_components c
             where c.scheduled_workout_id = s.id
             order by c.position;

            v_seen := v_seen || jsonb_build_object(v_key, v_promoted);
          end if;

          insert into program_template_slots (
            program_template_id, template_week_id, weekday, slot,
            workout_template_id, strength_template_id)
          values (v_new, v_week, extract(isodow from s.date)::smallint, s.slot,
                  case when s.type = 'strength' then null else v_promoted end,
                  case when s.type = 'strength' then v_promoted else null end);
        end if;
      end loop;
    end loop;
  end loop;

  return v_new;
end $$;
