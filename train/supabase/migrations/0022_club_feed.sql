-- ============================================================
-- 0022 — THE MEMBER DIRECTORY, AND THE CLUB FEED
--
-- Part one closes a leak. `profiles_leaderboard_read` (0002) let any
-- signed-in member select an opted-in athlete's *row* — and row-level
-- security is row-level: that row carries email, date of birth and injury
-- notes. Opting in to a leaderboard is consent to a name and a score, so
-- the policy goes, and members are now seen only through functions that
-- return exactly that: id, name, avatar, training group.
--
-- Part two is the feed. An athlete may share an activity with the club.
-- What the club sees is the run — route (already privacy-trimmed), distance,
-- time, pace, climb — and never heart rate, which stays between the athlete
-- and their coach. Same technique: no club-wide policy on `activities`, a
-- function that returns only the shareable columns.
-- ============================================================

-- ---------- part one: the leak ----------

drop policy if exists profiles_leaderboard_read on profiles;

-- the policies that leaned on it read the flag through a definer helper
-- instead, so they no longer need the caller to see the profile row
create or replace function im_on_leaderboard(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select leaderboard_opt_in from profiles where id = target), false);
$$;

drop policy if exists forge_read on forge_score_events;
create policy forge_read on forge_score_events for select using (
  im_can_read_athlete(athlete_id) or (auth.uid() is not null and im_on_leaderboard(athlete_id))
);

drop policy if exists achievements_read on achievements;
create policy achievements_read on achievements for select using (
  im_can_read_athlete(athlete_id) or (auth.uid() is not null and im_on_leaderboard(athlete_id))
);

-- Athletes on the leaderboard, as other members are allowed to see them.
create or replace function im_leaderboard_members()
returns table (id uuid, full_name text, avatar_url text, training_group text)
language sql stable security definer set search_path = public as $$
  select p.id, p.full_name, p.avatar_url, p.training_group
  from profiles p
  where auth.uid() is not null and p.role = 'athlete' and p.leaderboard_opt_in;
$$;

-- ---------- part two: sharing ----------

alter table profiles
  add column if not exists share_activities_default boolean not null default false;

create or replace function im_activity_is_shared(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from activities a where a.id = target and a.visibility = 'club');
$$;

-- the owner of an activity, without the caller needing to read the row
create or replace function im_activity_owner(target uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select athlete_id from activities where id = target;
$$;

create table activity_kudos (
  activity_id uuid not null references activities(id) on delete cascade,
  athlete_id  uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (activity_id, athlete_id)
);
create index on activity_kudos (athlete_id);

create table activity_comments (
  id          uuid primary key default gen_random_uuid(),
  activity_id uuid not null references activities(id) on delete cascade,
  author_id   uuid not null references profiles(id) on delete cascade,
  body        text not null check (char_length(btrim(body)) between 1 and 500),
  created_at  timestamptz not null default now()
);
create index on activity_comments (activity_id, created_at);

alter table activity_kudos enable row level security;
alter table activity_kudos force row level security;
alter table activity_comments enable row level security;
alter table activity_comments force row level security;

-- Kudos: give your own, on a shared activity that is not yours.
create policy kudos_own_read on activity_kudos for select
  using (athlete_id = auth.uid() or im_activity_owner(activity_id) = auth.uid());
create policy kudos_give on activity_kudos for insert
  with check (
    athlete_id = auth.uid()
    and im_activity_is_shared(activity_id)
    and im_activity_owner(activity_id) <> auth.uid()
  );
create policy kudos_take_back on activity_kudos for delete using (athlete_id = auth.uid());

-- Comments: on a shared activity, or on your own. The athlete's coach may
-- comment too — it is their athlete's run.
create policy comments_read on activity_comments for select using (
  author_id = auth.uid()
  or im_can_read_athlete(im_activity_owner(activity_id))
);
create policy comments_write on activity_comments for insert with check (
  author_id = auth.uid()
  and (
    im_activity_is_shared(activity_id)
    or im_can_read_athlete(im_activity_owner(activity_id))
  )
);
-- the author takes back their own words; the athlete keeps their own page
-- clean; staff moderate
create policy comments_delete on activity_comments for delete using (
  author_id = auth.uid()
  or im_activity_owner(activity_id) = auth.uid()
  or im_is_staff()
);

-- ---------- the feed, as a member is allowed to see it ----------

create or replace function im_club_feed(p_limit integer default 30, p_before timestamptz default null)
returns table (
  id uuid, athlete_id uuid, athlete_name text, training_group text,
  name text, sport im_activity_sport, started_at timestamptz, local_date date,
  distance_m integer, moving_s integer, avg_pace_sec_per_km integer, ascent_m integer,
  route text, privacy_trim_m smallint,
  kudos_count integer, comment_count integer, viewer_kudos boolean
)
language sql stable security definer set search_path = public as $$
  select a.id, a.athlete_id, p.full_name, p.training_group,
         a.name, a.sport, a.started_at, a.local_date,
         a.distance_m, a.moving_s, a.avg_pace_sec_per_km, a.ascent_m,
         a.route, a.privacy_trim_m,
         (select count(*)::int from activity_kudos k where k.activity_id = a.id),
         (select count(*)::int from activity_comments c where c.activity_id = a.id),
         exists (select 1 from activity_kudos k where k.activity_id = a.id and k.athlete_id = auth.uid())
  from activities a
  join profiles p on p.id = a.athlete_id
  where auth.uid() is not null
    and a.visibility = 'club'
    and (p_before is null or a.started_at < p_before)
    -- a file dated in the future would otherwise sit at the top for ever
    and a.started_at <= now() + interval '1 day'
  order by a.started_at desc
  limit least(greatest(coalesce(p_limit, 30), 1), 100);
$$;

-- One activity in feed shape: shared with the club, or the caller's own, or
-- their athlete's. The same columns as the feed, so a page cannot ask for more.
create or replace function im_feed_item(target uuid)
returns table (
  id uuid, athlete_id uuid, athlete_name text, training_group text,
  name text, sport im_activity_sport, started_at timestamptz, local_date date,
  distance_m integer, moving_s integer, avg_pace_sec_per_km integer, ascent_m integer,
  route text, privacy_trim_m smallint,
  kudos_count integer, comment_count integer, viewer_kudos boolean
)
language sql stable security definer set search_path = public as $$
  select a.id, a.athlete_id, p.full_name, p.training_group,
         a.name, a.sport, a.started_at, a.local_date,
         a.distance_m, a.moving_s, a.avg_pace_sec_per_km, a.ascent_m,
         a.route, a.privacy_trim_m,
         (select count(*)::int from activity_kudos k where k.activity_id = a.id),
         (select count(*)::int from activity_comments c where c.activity_id = a.id),
         exists (select 1 from activity_kudos k where k.activity_id = a.id and k.athlete_id = auth.uid())
  from activities a
  join profiles p on p.id = a.athlete_id
  where a.id = target
    and auth.uid() is not null
    and (a.visibility = 'club' or im_can_read_athlete(a.athlete_id));
$$;

-- One activity's comments and kudos, with names — readable by anyone who
-- may see the activity: a member when it is shared, the athlete and their
-- coach always.
create or replace function im_activity_social(target uuid)
returns table (kind text, id uuid, person_id uuid, person_name text, body text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select 'comment', c.id, c.author_id, p.full_name, c.body, c.created_at
  from activity_comments c join profiles p on p.id = c.author_id
  where c.activity_id = target
    and auth.uid() is not null
    and (im_activity_is_shared(target) or im_can_read_athlete(im_activity_owner(target)))
  union all
  select 'kudos', null, k.athlete_id, p.full_name, null, k.created_at
  from activity_kudos k join profiles p on p.id = k.athlete_id
  where k.activity_id = target
    and auth.uid() is not null
    and (im_activity_is_shared(target) or im_can_read_athlete(im_activity_owner(target)))
  order by 6;
$$;

-- ---------- GDPR export: what you said and gave on other people's runs ----------
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
