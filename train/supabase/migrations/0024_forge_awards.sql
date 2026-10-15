-- ============================================================
-- 0024 — FORGE POINTS ARE AWARDED BY THE DATABASE
--
-- Until now the Forge ledger was only ever written by the demo adapter.
-- Against Postgres nothing awarded a run, a strength session or a check-in,
-- and the weekly-adherence bonus was written from the athlete's own
-- session — which `forge_admin_write` (0002) refuses, so completing a full
-- week made the log action throw. (Its source id, 'week-<date>', was not a
-- uuid either.)
--
-- Awards now happen here, in triggers on the rows that earn them. A trigger
-- function cannot be called directly, so an athlete still cannot award
-- themselves anything: points follow from a log, a completed strength
-- session or a check-in, once each, by the same rules as the demo:
--
--   run_completed 10 · community_run 10 · race_completed 25
--   strength_completed 8 · checkin_completed 5 · full_week_adherence 20
--
-- The week bonus is given when every prescribed session of a week is
-- complete. It no longer waits for the week to end: a week with nothing left
-- to do cannot get less complete, and waiting meant the bonus only arrived if
-- something was logged after Sunday.
-- ============================================================

-- Every write below is inside a trigger function, and Postgres refuses to run
-- a trigger function any other way. There is deliberately no callable
-- "award" helper: Supabase grants clients execute on new functions by
-- default, so a helper would be a way to award yourself points.

-- a stable id for "this athlete's week", so the bonus is once per week
create or replace function im_week_source(p_athlete uuid, p_week date)
returns uuid language sql immutable as $$
  select md5(p_athlete::text || ':week:' || p_week::text)::uuid;
$$;

-- ---------- a logged session ----------
create or replace function im_forge_on_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  s scheduled_workouts%rowtype;
  k im_forge_event;
  wk date;
begin
  if new.scheduled_workout_id is null then return new; end if;
  select * into s from scheduled_workouts where id = new.scheduled_workout_id and athlete_id = new.athlete_id;
  -- a session logged before its day earns nothing (a day's grace for time zones)
  if not found or s.date > current_date + 1 then return new; end if;

  -- the session that actually happened: a Saturday club run is community
  -- attendance, not just another prescribed run (the demo's forgeKindFor)
  k := case
         when s.name ~* '(club run|iron miles)' then 'community_run'
         when s.type = 'race' then 'race_completed'
         when s.type = 'strength' then 'strength_completed'
         else 'run_completed'
       end;
  insert into forge_score_events (athlete_id, kind, points, date, label, source_id)
  values (new.athlete_id, k, case k when 'race_completed' then 25 when 'strength_completed' then 8 else 10 end,
          new.date, s.name, s.id)
  on conflict (athlete_id, kind, source_id) do nothing;

  -- the app marks the session completed straight after; count it as done now
  wk := date_trunc('week', s.date)::date;
  insert into forge_score_events (athlete_id, kind, points, date, label, source_id)
  select new.athlete_id, 'full_week_adherence', 20, wk + 6, '100% weekly adherence', im_week_source(new.athlete_id, wk)
  where not exists (
    select 1 from scheduled_workouts w
    where w.athlete_id = new.athlete_id and w.date between wk and wk + 6 and w.type <> 'rest'
      and w.status <> 'completed' and w.id <> s.id
  )
  on conflict (athlete_id, kind, source_id) do nothing;
  return new;
end $$;

create trigger completed_workouts_forge
  after insert or update of scheduled_workout_id on completed_workouts
  for each row execute function im_forge_on_log();

-- a log deleted (the wrong file imported, then deleted) takes its points
-- back, and the week's bonus with them: the week is no longer complete.
-- Logging it again earns them again, once.
create or replace function im_forge_on_unlog() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  wk date;
begin
  if old.scheduled_workout_id is null then return old; end if;
  delete from forge_score_events
   where athlete_id = old.athlete_id and source_id = old.scheduled_workout_id
     and kind in ('run_completed', 'community_run', 'race_completed');
  select date_trunc('week', s.date)::date into wk from scheduled_workouts s where s.id = old.scheduled_workout_id;
  if wk is not null then
    delete from forge_score_events
     where athlete_id = old.athlete_id and kind = 'full_week_adherence' and source_id = im_week_source(old.athlete_id, wk);
  end if;
  return old;
end $$;

create trigger completed_workouts_forge_unlog
  after delete on completed_workouts
  for each row execute function im_forge_on_unlog();

-- a session becoming complete any other way (strength player, coach) also
-- completes the week
create or replace function im_forge_on_session_complete() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  wk date := date_trunc('week', new.date)::date;
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    insert into forge_score_events (athlete_id, kind, points, date, label, source_id)
    select new.athlete_id, 'full_week_adherence', 20, wk + 6, '100% weekly adherence', im_week_source(new.athlete_id, wk)
    where not exists (
      select 1 from scheduled_workouts w
      where w.athlete_id = new.athlete_id and w.date between wk and wk + 6 and w.type <> 'rest' and w.status <> 'completed'
    )
    on conflict (athlete_id, kind, source_id) do nothing;
  end if;
  return new;
end $$;

create trigger scheduled_workouts_forge_week
  after update of status on scheduled_workouts
  for each row execute function im_forge_on_session_complete();

-- ---------- a completed strength session ----------
-- Keyed on the prescribed session, not the strength row: an athlete may
-- create and delete their own strength rows freely, so a row id would be a
-- new award every time. An unplanned session earns nothing — the score
-- rewards doing the plan, and the plan is the coach's.
create or replace function im_forge_on_strength() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed')
     and new.scheduled_workout_id is not null
     and exists (
       select 1 from scheduled_workouts s
       where s.id = new.scheduled_workout_id and s.athlete_id = new.athlete_id
         and s.type = 'strength' and s.date <= current_date + 1
     ) then
    insert into forge_score_events (athlete_id, kind, points, date, label, source_id)
    values (new.athlete_id, 'strength_completed', 8, new.date, 'Strength session', new.scheduled_workout_id)
    on conflict (athlete_id, kind, source_id) do nothing;
  end if;
  return new;
end $$;

create trigger strength_sessions_forge
  after insert or update of status on strength_sessions
  for each row execute function im_forge_on_strength();

-- ---------- a weekly check-in ----------
-- Keyed on the week, not the row: deleting and resubmitting a check-in is
-- a new row id, and must not be a new five points.
-- And keyed on the *week* the date falls in, never the raw value: a
-- client chooses week_start, so a check-in "for" every day of the year
-- would otherwise be 365 weeks. A future week earns nothing.
create or replace function im_forge_on_checkin() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  wk date := date_trunc('week', new.week_start)::date;
begin
  if wk > current_date then return new; end if;
  insert into forge_score_events (athlete_id, kind, points, date, label, source_id)
  values (new.athlete_id, 'checkin_completed', 5, wk, 'Weekly check-in',
          md5(new.athlete_id::text || ':checkin:' || wk::text)::uuid)
  on conflict (athlete_id, kind, source_id) do nothing;
  return new;
end $$;

create trigger checkins_forge
  after insert on checkins
  for each row execute function im_forge_on_checkin();

-- ---------- what an athlete may change on their own plan ----------
--
-- sched_athlete_status (0002) lets an athlete update their own sessions so
-- they can mark them done — but as written it allowed any column. With
-- points now following from the plan, that would let an athlete rename a
-- session "club run", or move one session through week after week for a
-- fresh full-week bonus each time. The plan is the coach's; an athlete may
-- change its status, and move a session within its own week (the rule the
-- reschedule action already enforces in the app).
create or replace function im_guard_athlete_session_edit() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  changed boolean;
begin
  -- The server, coaches and admins edit plans as before; RLS (sched_coach_write)
  -- still limits a coach's own writes to their roster. Staff are exempt here,
  -- not just the athlete's coach, because ON DELETE SET NULL (a coach deleting
  -- a race or a shared template) updates other coaches' athletes' sessions
  -- as the deleting coach, and refusing that would refuse the delete.
  if auth.uid() is null or im_is_staff() then
    return new;
  end if;

  -- An allow-list, so a column added later is protected by default. This
  -- trigger sorts first among the BEFORE triggers, so it sees only what the
  -- client sent, before updated_at or the revision are touched.
  changed := (to_jsonb(new) - array['status', 'date', 'slot', 'updated_at']::text[])
           <> (to_jsonb(old) - array['status', 'date', 'slot', 'updated_at']::text[]);
  if changed then
    raise exception 'An athlete can change a session''s status, or move it within its week. The rest is the coach''s.';
  end if;
  -- a completed session stays on the day it was done: moving it would move
  -- what it counts for (a challenge window that has closed, say)
  if old.status = 'completed' and new.date is distinct from old.date then
    raise exception 'A completed session stays on the day it was done.';
  end if;
  if date_trunc('week', new.date) is distinct from date_trunc('week', old.date) then
    raise exception 'Sessions move within their own week. Ask your coach to change the week itself.';
  end if;
  -- completed means logged: a log or a finished strength session must exist,
  -- and not for a day that has not come yet (a day's grace for time zones)
  if new.status = 'completed' and old.status is distinct from 'completed' then
    if new.date > current_date + 1 then
      raise exception 'A session cannot be completed before its day.';
    end if;
    if not exists (select 1 from completed_workouts c where c.scheduled_workout_id = new.id)
       and not exists (select 1 from strength_sessions x where x.scheduled_workout_id = new.id and x.status = 'completed') then
      raise exception 'Log the session to complete it.';
    end if;
  end if;
  return new;
end $$;

create trigger scheduled_workouts_athlete_guard
  before update on scheduled_workouts
  for each row execute function im_guard_athlete_session_edit();
