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
  if not found then return new; end if;

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
create or replace function im_forge_on_strength() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and (tg_op = 'INSERT' or old.status is distinct from 'completed') then
    insert into forge_score_events (athlete_id, kind, points, date, label, source_id)
    values (new.athlete_id, 'strength_completed', 8, new.date, 'Strength session', new.id)
    on conflict (athlete_id, kind, source_id) do nothing;
  end if;
  return new;
end $$;

create trigger strength_sessions_forge
  after insert or update of status on strength_sessions
  for each row execute function im_forge_on_strength();

-- ---------- a weekly check-in ----------
create or replace function im_forge_on_checkin() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into forge_score_events (athlete_id, kind, points, date, label, source_id)
  values (new.athlete_id, 'checkin_completed', 5, new.week_start, 'Weekly check-in', new.id)
  on conflict (athlete_id, kind, source_id) do nothing;
  return new;
end $$;

create trigger checkins_forge
  after insert on checkins
  for each row execute function im_forge_on_checkin();
