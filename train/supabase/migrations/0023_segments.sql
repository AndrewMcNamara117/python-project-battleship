-- ============================================================
-- 0023 — SEGMENTS
--
-- Named stretches around Limerick, drawn by coaches, timed on every run
-- that covers them.
--
-- Two rules shape this file:
--
--   * Efforts are written by the server, never by a client. A time is
--     computed from the uploaded file at import; there is no insert policy
--     for any user, so nobody can post a time by calling the API directly.
--
--   * The club sees an effort only when its activity is shared with the
--     club. An effort is a person at a place at a time; it follows the
--     athlete's choice about the run it came from. The athlete and their
--     coach always see it.
-- ============================================================

create table segments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 2 and 80),
  description text not null default '' check (char_length(description) <= 300),
  -- encoded polyline, start to finish
  route       text not null,
  distance_m  integer not null check (distance_m between 100 and 50000),
  created_by  uuid references profiles(id) on delete set null,
  archived    boolean not null default false,
  created_at  timestamptz not null default now()
);

create table segment_efforts (
  id          uuid primary key default gen_random_uuid(),
  segment_id  uuid not null references segments(id) on delete cascade,
  activity_id uuid not null references activities(id) on delete cascade,
  athlete_id  uuid not null references profiles(id) on delete cascade,
  started_at  timestamptz not null,
  elapsed_s   integer not null check (elapsed_s > 0),
  created_at  timestamptz not null default now(),
  unique (segment_id, activity_id)
);
create index on segment_efforts (segment_id, elapsed_s);
create index on segment_efforts (athlete_id, segment_id);

alter table segments enable row level security;
alter table segments force row level security;
alter table segment_efforts enable row level security;
alter table segment_efforts force row level security;

-- every member may see the segments; staff draw and retire them
create policy segments_read on segments for select using (auth.uid() is not null);
create policy segments_staff_write on segments for all using (im_is_staff()) with check (im_is_staff());

-- the athlete and their coach read efforts directly. No insert, update or
-- delete policy at all: only the service role writes, after computing the
-- time from the file itself.
create policy efforts_read on segment_efforts for select using (im_can_read_athlete(athlete_id));

-- The club board: each athlete's best effort, from shared activities only.
create or replace function im_segment_leaders(target uuid, p_limit integer default 20)
returns table (athlete_id uuid, athlete_name text, activity_id uuid, elapsed_s integer, started_at timestamptz)
language sql stable security definer set search_path = public as $$
  select * from (
    select distinct on (e.athlete_id) e.athlete_id, p.full_name, e.activity_id, e.elapsed_s, e.started_at
    from segment_efforts e
    join activities a on a.id = e.activity_id
    join profiles p on p.id = e.athlete_id
    where e.segment_id = target
      and auth.uid() is not null
      and a.visibility = 'club'
    order by e.athlete_id, e.elapsed_s, e.started_at
  ) best
  order by best.elapsed_s, best.started_at
  limit least(greatest(coalesce(p_limit, 20), 1), 100);
$$;

-- ---------- GDPR export ----------
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
    'segment_efforts',    (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from segment_efforts e where e.athlete_id = target),
    'activity_comments',  (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from activity_comments c where c.author_id = target),
    'activity_kudos',     (select coalesce(jsonb_agg(to_jsonb(k)), '[]'::jsonb) from activity_kudos k where k.athlete_id = target),
    'strength_sessions',  (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from strength_sessions s where s.athlete_id = target),
    'checkins',           (select coalesce(jsonb_agg(to_jsonb(k)), '[]'::jsonb) from checkins k where k.athlete_id = target),
    'forge_score_events', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from forge_score_events f where f.athlete_id = target),
    'achievements',       (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from achievements a where a.athlete_id = target),
    'messages',           (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from messages m where m.recipient_id = target or m.sender_id = target),
    'exported_at',        to_jsonb(now())
  );
end $$;
