-- ============================================================
-- 0011 — THE ADAPTATION LOOP
--
-- Getting an athlete onto a good programme was Slices 3 to 5. This is
-- everything that happens afterwards: the week that moves because of a
-- work trip, the block pulled back after a bad check-in, the long run
-- that has to be a Saturday this once.
--
--   original prescription → current prescription → what they did
--
-- Three different things. A coach moving Tuesday's 10K to Thursday does
-- not erase the fact that Tuesday's 10K was prescribed, and neither does
-- this migration: every change goes through the Slice 2 audit trail,
-- which has been recording faithfully since and has never been read.
-- ============================================================


-- ------------------------------------------------------------
-- ONE SESSION PER SLOT, AND MOVING THROUGH IT
--
-- A day holds one session per slot. Shifting a week forward by two days
-- would move Tuesday onto Thursday while Thursday is still occupied by
-- the session that is itself about to move — a state that is invalid
-- halfway through and correct at the end.
--
-- The obvious answer is a deferrable constraint, checked at commit. It is
-- the wrong one here: Postgres will not accept a deferrable constraint as
-- an ON CONFLICT arbiter, and the prescribe and assign functions from
-- Slices 3 to 5 all rely on exactly that. Making bulk adaptation
-- convenient is not worth rewriting three slices of working code.
--
-- So the constraint stays as it is, and the operations move through it in
-- an order that is never invalid:
--
--   shifting forward   — the latest session moves first
--   shifting backward  — the earliest moves first
--   swapping two       — one steps aside to a free slot on its own day
--
-- The audit trail records one revision per session per transaction, so
-- the sidestep costs a coach nothing in the history they read.
-- ------------------------------------------------------------

-- A slot no prescription uses, for a session to stand in while another
-- takes its place. Only ever occupied inside a single statement.
create or replace function im_sidestep_slot() returns smallint
language sql immutable as $$ select 30000::smallint $$;


-- ------------------------------------------------------------
-- WHAT MAY BE ADAPTED
--
-- Completed training is what happened. It is not a plan any more, and no
-- adaptation may rewrite it — not a move, not an edit, not a bulk
-- operation that happens to cover its date.
--
-- Returns null when the session is adaptable, or the reason it is not.
-- ------------------------------------------------------------

create or replace function im_adaptation_blocker(p_session scheduled_workouts)
returns text language sql stable as $$
  select case
    when p_session.status = 'completed' then
      'That session is already completed. What an athlete has done is not a plan any more.'
    when exists (select 1 from completed_workouts c where c.scheduled_workout_id = p_session.id) then
      'That session has a logged result against it.'
    when exists (select 1 from strength_sessions s
                  where s.scheduled_workout_id = p_session.id and s.status = 'completed') then
      'That session has a logged strength result against it.'
    else null
  end;
$$;

comment on function im_adaptation_blocker is
  'Null when the session may be adapted, otherwise the reason it may not.';


-- ------------------------------------------------------------
-- MOVING A SESSION
--
-- Moves within the athlete's own programme and re-homes it in the week
-- that contains the new date, so a session never ends up in a week it is
-- not actually in. Refuses to move onto an occupied slot, onto a
-- completed session, or outside the programme.
-- ------------------------------------------------------------

create or replace function im_move_session(
  p_session uuid,
  p_date    date,
  p_slot    smallint default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  s        scheduled_workouts%rowtype;
  v_prog   programs;
  v_week   uuid;
  v_slot   smallint;
  v_block  text;
  v_taken  scheduled_workouts%rowtype;
begin
  select * into s from scheduled_workouts where id = p_session;
  if s is null then raise exception 'That session no longer exists.'; end if;
  if not (im_is_coach_of(s.athlete_id) or im_is_admin()) then
    raise exception 'That athlete is not on your roster.';
  end if;

  v_block := im_adaptation_blocker(s);
  if v_block is not null then raise exception '%', v_block; end if;

  v_slot := coalesce(p_slot, s.slot);

  if p_date = s.date and v_slot = s.slot then
    return s.id;
  end if;

  select * into v_taken from scheduled_workouts
   where athlete_id = s.athlete_id and date = p_date and slot = v_slot and id <> s.id;
  if v_taken.id is not null then
    raise exception 'There is already a session in that slot on %: "%". Swap them, or pick another slot.',
      to_char(p_date, 'FMDD Mon'), v_taken.name;
  end if;

  if s.program_id is not null then
    select * into v_prog from programs where id = s.program_id;
    if v_prog.id is not null and (p_date < v_prog.start_date or p_date > v_prog.end_date) then
      raise exception 'That date is outside the programme, which runs % to %.',
        to_char(v_prog.start_date, 'FMDD Mon'), to_char(v_prog.end_date, 'FMDD Mon');
    end if;

    -- a session belongs to the week that contains it; moving it across a
    -- week boundary re-homes it rather than leaving it orphaned
    select id into v_week from program_weeks
     where program_id = s.program_id
       and p_date >= start_date and p_date < start_date + 7
     limit 1;
  end if;

  update scheduled_workouts
     set date = p_date,
         slot = v_slot,
         program_week_id = coalesce(v_week, program_week_id),
         status = case when status = 'scheduled' then 'scheduled' else status end
   where id = p_session;

  return p_session;
end $$;


-- ------------------------------------------------------------
-- SWAPPING TWO SESSIONS
--
-- Exchange two sessions' dates and slots. The deferred constraint is what
-- makes this expressible in two statements rather than three.
-- ------------------------------------------------------------

create or replace function im_swap_sessions(p_a uuid, p_b uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  a scheduled_workouts%rowtype;
  b scheduled_workouts%rowtype;
  v_block text;
  v_week_a uuid;
  v_week_b uuid;
begin
  select * into a from scheduled_workouts where id = p_a;
  select * into b from scheduled_workouts where id = p_b;
  if a is null or b is null then raise exception 'One of those sessions no longer exists.'; end if;
  if a.athlete_id <> b.athlete_id then
    raise exception 'Those sessions belong to different athletes.';
  end if;
  if not (im_is_coach_of(a.athlete_id) or im_is_admin()) then
    raise exception 'That athlete is not on your roster.';
  end if;

  v_block := coalesce(im_adaptation_blocker(a), im_adaptation_blocker(b));
  if v_block is not null then raise exception '%', v_block; end if;

  select id into v_week_a from program_weeks
   where program_id = a.program_id and b.date >= start_date and b.date < start_date + 7 limit 1;
  select id into v_week_b from program_weeks
   where program_id = b.program_id and a.date >= start_date and a.date < start_date + 7 limit 1;

  -- A steps aside on its own day, B takes the place it vacated, then A takes
  -- B's. No update ever lands on an occupied slot.
  update scheduled_workouts set slot = im_sidestep_slot() where id = a.id;

  update scheduled_workouts
     set date = a.date, slot = a.slot, program_week_id = coalesce(v_week_b, b.program_week_id)
   where id = b.id;

  update scheduled_workouts
     set date = b.date, slot = b.slot, program_week_id = coalesce(v_week_a, a.program_week_id)
   where id = a.id;
end $$;


-- ------------------------------------------------------------
-- BULK ADAPTATION
--
-- One function per operation, each with a preview mode. Preview and apply
-- return the same rows from the same logic, so what the coach confirmed
-- is what runs — a preview computed separately is a preview that can lie.
--
-- Every row says what will happen to one session:
--
--   'move'    — it shifts
--   'scale'   — its distance changes
--   'keep'    — it is in range but will not be touched, and why
--   'blocked' — it cannot be touched, and why
--
-- Completed training always comes back 'blocked'. There is no argument
-- and no override.
-- ------------------------------------------------------------

create or replace function im_shift_sessions(
  p_athlete uuid,
  p_from    date,
  p_to      date,
  p_days    integer,
  p_apply   boolean default false
)
returns table (
  session_id uuid,
  action     text,
  name       text,
  from_date  date,
  to_date    date,
  status     im_session_status,
  detail     text
)
language plpgsql security definer set search_path = public as $$
declare
  r       record;
  v_today date := current_date;
  v_moved integer;
  v_week  uuid;
begin
  if not (im_is_coach_of(p_athlete) or im_is_admin()) then
    raise exception 'That athlete is not on your roster.';
  end if;
  if p_days = 0 then
    raise exception 'Shifting by zero days would change nothing.';
  end if;
  if p_from > p_to then
    raise exception 'That date range runs backwards.';
  end if;

  create temporary table if not exists im_shift_plan (
    id uuid primary key, act text, nm text, from_d date, to_d date,
    st im_session_status, why text, slot smallint, program uuid
  ) on commit drop;
  delete from im_shift_plan;

  -- First pass: what each session is, ignoring where anything else lands.
  insert into im_shift_plan (id, act, nm, from_d, to_d, st, why, slot, program)
  select
    s.id,
    case
      when im_adaptation_blocker(s.*) is not null then 'blocked'
      when s.date < v_today then 'keep'
      when p.id is not null and ((s.date + p_days) < p.start_date or (s.date + p_days) > p.end_date)
        then 'blocked'
      else 'move'
    end,
    s.name, s.date, (s.date + p_days)::date, s.status,
    case
      when im_adaptation_blocker(s.*) is not null then im_adaptation_blocker(s.*)
      when s.date < v_today then 'In the past. Sessions before today are left where they are.'
      when p.id is not null and ((s.date + p_days) < p.start_date or (s.date + p_days) > p.end_date)
        then format('That would land outside the programme, which ends %s.',
                    to_char(p.end_date, 'FMDD Mon'))
      when p_days > 0 then format('Moves forward %s day(s).', p_days)
      else format('Moves back %s day(s).', abs(p_days))
    end,
    s.slot, s.program_id
  from scheduled_workouts s
  left join programs p on p.id = s.program_id
  where s.athlete_id = p_athlete and s.date between p_from and p_to;

  -- Second pass: a session cannot move onto a slot something else is keeping.
  -- Blocking one session can strand another that was going to take its place,
  -- so this settles rather than assuming a single sweep is enough.
  loop
    update im_shift_plan m
       set act = 'blocked',
           why = 'Something is already in that slot on the day it would move to.'
     where m.act = 'move'
       and exists (
         select 1 from scheduled_workouts o
          where o.athlete_id = p_athlete
            and o.date = m.to_d
            and o.slot = m.slot
            and o.id <> m.id
            and not exists (select 1 from im_shift_plan p2 where p2.id = o.id and p2.act = 'move')
       );
    get diagnostics v_moved = row_count;
    exit when v_moved = 0;
  end loop;

  if p_apply then
    -- moving forward, the latest goes first; backwards, the earliest. Either
    -- way no update passes through an occupied slot.
    for r in
      select * from im_shift_plan where act = 'move'
       order by case when p_days > 0 then from_d end desc nulls last,
                case when p_days < 0 then from_d end asc nulls last,
                slot
    loop
      select id into v_week from program_weeks
       where program_id = r.program
         and r.to_d >= start_date and r.to_d < start_date + 7
       limit 1;

      update scheduled_workouts
         set date = r.to_d,
             program_week_id = coalesce(v_week, program_week_id)
       where id = r.id;
    end loop;
  end if;

  return query
    select m.id, m.act, m.nm, m.from_d, m.to_d, m.st, m.why
      from im_shift_plan m
     order by m.from_d, m.slot;
end $$;


-- ------------------------------------------------------------
-- ADJUSTING VOLUME
--
-- Scales the prescribed distance of future sessions in a range. Rest days
-- and sessions with no distance are reported as untouched rather than
-- silently skipped, because a coach who asked to pull a week back wants
-- to know the strength session did not move.
-- ------------------------------------------------------------

create or replace function im_scale_volume(
  p_athlete uuid,
  p_from    date,
  p_to      date,
  p_factor  numeric,
  p_apply   boolean default false
)
returns table (
  session_id uuid,
  action     text,
  name       text,
  from_km    numeric,
  to_km      numeric,
  status     im_session_status,
  detail     text
)
language plpgsql security definer set search_path = public as $$
declare
  r       record;
  v_today date := current_date;
  v_new   numeric;
begin
  if not (im_is_coach_of(p_athlete) or im_is_admin()) then
    raise exception 'That athlete is not on your roster.';
  end if;
  if p_factor is null or p_factor <= 0 then
    raise exception 'That is not a volume adjustment.';
  end if;
  if p_factor > 3 then
    raise exception 'Tripling a block is not an adjustment. Rewrite the sessions instead.';
  end if;
  if p_from > p_to then
    raise exception 'That date range runs backwards.';
  end if;

  for r in
    select s.*, im_adaptation_blocker(s.*) blocker
      from scheduled_workouts s
     where s.athlete_id = p_athlete and s.date between p_from and p_to
     order by s.date, s.slot
  loop
    if r.blocker is not null then
      return query select r.id, 'blocked', r.name, r.distance_km, r.distance_km, r.status, r.blocker;
      continue;
    end if;
    if r.date < v_today then
      return query select r.id, 'keep', r.name, r.distance_km, r.distance_km, r.status,
        'In the past. Sessions before today are left where they are.';
      continue;
    end if;
    if r.type = 'rest' then
      return query select r.id, 'keep', r.name, r.distance_km, r.distance_km, r.status,
        'A rest day. Nothing to scale.';
      continue;
    end if;
    if r.distance_km is null then
      return query select r.id, 'keep', r.name, r.distance_km, r.distance_km, r.status,
        'Prescribed by time rather than distance.';
      continue;
    end if;

    v_new := round(r.distance_km * p_factor * 2) / 2;   -- to the nearest half km
    if v_new = r.distance_km then
      return query select r.id, 'keep', r.name, r.distance_km, r.distance_km, r.status,
        'Unchanged at that adjustment.';
      continue;
    end if;

    if p_apply then
      update scheduled_workouts set distance_km = v_new where id = r.id;
    end if;

    return query select r.id, 'scale', r.name, r.distance_km, v_new, r.status,
      format('%s km → %s km', r.distance_km, v_new);
  end loop;

  return;
end $$;


-- ------------------------------------------------------------
-- WHAT HAPPENED TO THIS SESSION
--
-- The three things a coach needs held apart:
--
--   what was originally prescribed  — revision 1
--   what is prescribed now          — the row
--   what the athlete actually did   — the logged result
--
-- This returns the facts. Turning consecutive snapshots into a sentence a
-- coach would say is done once, in the domain layer, rather than twice in
-- two adapters and differently each time.
-- ------------------------------------------------------------

create or replace function im_session_history(p_session uuid)
returns table (
  revision   integer,
  kind       im_revision_kind,
  changed_at timestamptz,
  changed_by uuid,
  changed_by_name text,
  session    jsonb,
  note       text
)
language sql stable security definer set search_path = public as $$
  select r.revision, r.kind, r.changed_at, r.changed_by, p.full_name, r.session, r.note
    from session_revisions r
    left join profiles p on p.id = r.changed_by
   where r.scheduled_workout_id = p_session
     and im_can_read_athlete(r.athlete_id)
   order by r.revision;
$$;


-- ------------------------------------------------------------
-- THE WEEK A COACH IS ABOUT TO CHANGE
--
-- Everything needed to make one decision, in one call: the sessions, what
-- is protected, and the athlete's own account of how the week before
-- went. The check-in is context, not an instruction — nothing here reads
-- it and decides anything.
-- ------------------------------------------------------------

create or replace function im_week_adaptation_context(p_week uuid)
returns table (
  session_id     uuid,
  date           date,
  slot           smallint,
  name           text,
  type           im_workout_type,
  status         im_session_status,
  distance_km    numeric,
  duration_minutes integer,
  blocker        text,
  revisions      integer,
  moved_from     date
)
language sql stable security definer set search_path = public as $$
  select
    s.id, s.date, s.slot, s.name, s.type, s.status, s.distance_km, s.duration_minutes,
    im_adaptation_blocker(s.*),
    (select count(*)::integer from session_revisions r where r.scheduled_workout_id = s.id),
    -- where it was originally, when that is not where it is now
    (select (r.session ->> 'date')::date
       from session_revisions r
      where r.scheduled_workout_id = s.id and r.revision = 1
        and (r.session ->> 'date')::date is distinct from s.date)
  from scheduled_workouts s
  join program_weeks w on w.id = s.program_week_id
  where w.id = p_week and im_can_read_athlete(s.athlete_id)
  order by s.date, s.slot;
$$;
