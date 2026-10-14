-- ============================================================
-- 0021 — ACTIVITIES
--
-- What the watch recorded, imported from a file today and from a provider
-- (Garmin, COROS, Strava) later — same table either way.
--
-- What is stored is numbers, never the file. The raw GPS track is not kept
-- anywhere: distance, pace, splits and a bpm histogram are computed on
-- import, and the only geometry kept is a route with the start and finish
-- trimmed away and privacy zones cut out. A track that begins at a front
-- door is an address; this table cannot leak one because it never had it.
--
-- `activity_imports` (0001) stays as the raw provider-payload ledger for
-- when a sync lands. This is the athlete-owned record.
-- ============================================================

alter type im_data_source add value if not exists 'upload';

create type im_activity_source     as enum ('upload','garmin','coros','strava');
create type im_activity_format     as enum ('fit','gpx','tcx');
create type im_activity_sport      as enum ('run','trail_run','walk','hike','ride','swim','other');
create type im_activity_visibility as enum ('coach','club');

-- per-athlete settings the importer reads
alter table profiles
  add column if not exists max_heart_rate smallint check (max_heart_rate between 100 and 240),
  add column if not exists privacy_trim_m smallint not null default 200 check (privacy_trim_m in (0, 200, 500, 1000));

create table activities (
  id                   uuid primary key default gen_random_uuid(),
  athlete_id           uuid not null references profiles(id) on delete cascade,
  source               im_activity_source not null default 'upload',
  format               im_activity_format not null,
  -- sha256 of the uploaded bytes: the same file twice is the same activity
  fingerprint          text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  name                 text not null check (char_length(name) between 1 and 120),
  sport                im_activity_sport not null,
  started_at           timestamptz not null,
  local_date           date not null,
  distance_m           integer not null check (distance_m >= 0),
  moving_s             integer not null check (moving_s >= 0),
  elapsed_s            integer not null check (elapsed_s >= 0),
  avg_pace_sec_per_km  integer,
  avg_hr               smallint,
  max_hr               smallint,
  ascent_m             integer,
  descent_m            integer,
  -- encoded polyline segments joined by ';', already trimmed for privacy
  route                text,
  privacy_trim_m       smallint not null default 200,
  splits               jsonb not null default '[]'::jsonb,
  series               jsonb not null default '[]'::jsonb,
  hr_histogram         jsonb not null default '[]'::jsonb,
  scheduled_workout_id uuid references scheduled_workouts(id) on delete set null,
  completed_workout_id uuid references completed_workouts(id) on delete set null,
  visibility           im_activity_visibility not null default 'coach',
  created_at           timestamptz not null default now(),
  unique (athlete_id, fingerprint)
);
create index on activities (athlete_id, started_at desc);
create index on activities (completed_workout_id);

-- An activity may only point at the athlete's own plan and log. RLS decides
-- who writes the row; this decides what the row may reference, so an athlete
-- cannot attach their file to somebody else's session by passing its id.
create or replace function im_activity_links_own_rows() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.scheduled_workout_id is not null and not exists (
    select 1 from scheduled_workouts s where s.id = new.scheduled_workout_id and s.athlete_id = new.athlete_id
  ) then
    raise exception 'activity may only link to the athlete''s own session';
  end if;
  if new.completed_workout_id is not null and not exists (
    select 1 from completed_workouts c where c.id = new.completed_workout_id and c.athlete_id = new.athlete_id
  ) then
    raise exception 'activity may only link to the athlete''s own log';
  end if;
  return new;
end $$;

create trigger activities_links_own_rows
  before insert or update on activities
  for each row execute function im_activity_links_own_rows();

-- ---------- RLS ----------
alter table activities enable row level security;
alter table activities force row level security;

-- the athlete and their coach read it; the club feed (when it lands) reads
-- only what the athlete chose to share, through its own policy
create policy activities_read on activities
  for select using (im_can_read_athlete(athlete_id));

-- an athlete's own record. the coach reads it and never writes it.
create policy activities_own_write on activities
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

-- ---------- GDPR export now includes activities ----------
create or replace function im_export_athlete_data(target uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (target = auth.uid() or im_is_admin()) then
    raise exception 'not permitted';
  end if;
  return jsonb_build_object(
    'profile',            (select to_jsonb(p) from profiles p where p.id = target),
    'goals',              (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) from goals g where g.athlete_id = target),
    'scheduled_workouts', (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from scheduled_workouts s where s.athlete_id = target),
    'completed_workouts', (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from completed_workouts c where c.athlete_id = target),
    'activities',         (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from activities a where a.athlete_id = target),
    'strength_sessions',  (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from strength_sessions s where s.athlete_id = target),
    'checkins',           (select coalesce(jsonb_agg(to_jsonb(k)), '[]'::jsonb) from checkins k where k.athlete_id = target),
    'forge_score_events', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from forge_score_events f where f.athlete_id = target),
    'achievements',       (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from achievements a where a.athlete_id = target),
    'messages',           (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from messages m where m.recipient_id = target or m.sender_id = target),
    'exported_at',        to_jsonb(now())
  );
end $$;
