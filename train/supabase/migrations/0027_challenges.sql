-- ============================================================
-- 0027 — CLUB CHALLENGES
--
-- A coach sets a target over a window — "October: 20 sessions as written",
-- "four club runs this month" — and athletes opt in.
--
-- Shaped by the same rule as the Forge Score: a challenge is finished, not
-- won. There is no ranking. The club sees how many joined and who finished;
-- an athlete's own progress is theirs and their coach's, because a running
-- total of kilometres is training data like any other.
--
-- Progress is computed from the athlete's own rows, never submitted:
--   sessions     prescribed sessions completed (rest days excluded)
--   club_runs    community_run awards in the Forge ledger
--   checkins     weekly check-ins submitted
--   distance_km  kilometres logged
-- ============================================================

create type im_challenge_metric as enum ('sessions', 'club_runs', 'checkins', 'distance_km');

create table challenges (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(btrim(name)) between 3 and 80),
  description text not null default '' check (char_length(description) <= 400),
  metric      im_challenge_metric not null,
  target      numeric(8,1) not null check (target > 0 and target <= 10000),
  starts_on   date not null,
  ends_on     date not null,
  created_by  uuid references profiles(id) on delete set null,
  archived    boolean not null default false,
  created_at  timestamptz not null default now(),
  check (ends_on >= starts_on and ends_on - starts_on <= 366)
);

create table challenge_participants (
  challenge_id uuid not null references challenges(id) on delete cascade,
  athlete_id   uuid not null references profiles(id) on delete cascade,
  joined_at    timestamptz not null default now(),
  primary key (challenge_id, athlete_id)
);
create index on challenge_participants (athlete_id);

alter table challenges enable row level security;
alter table challenges force row level security;
alter table challenge_participants enable row level security;
alter table challenge_participants force row level security;

create policy challenges_read on challenges for select using (auth.uid() is not null);
create policy challenges_staff_write on challenges for all using (im_is_staff()) with check (im_is_staff());

-- join and leave for yourself, and only while the challenge is still open
create or replace function im_challenge_open(p_challenge uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from challenges c where c.id = p_challenge and not c.archived and c.ends_on >= current_date);
$$;

create policy participants_own_read on challenge_participants for select
  using (athlete_id = auth.uid() or im_can_read_athlete(athlete_id));
create policy participants_join on challenge_participants for insert
  with check (athlete_id = auth.uid() and im_challenge_open(challenge_id));
create policy participants_leave on challenge_participants for delete
  using (athlete_id = auth.uid() and im_challenge_open(challenge_id));

-- (Parameters are p_challenge, not target: challenges has a column called
-- target, and inside these functions the column would win.)

-- Progress, for the athlete themselves or their coach. Anyone else gets null:
-- this function is callable, so it checks its caller like a policy would.
create or replace function im_challenge_progress(p_challenge uuid, who uuid)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  c challenges%rowtype;
begin
  if auth.uid() is null or not (who = auth.uid() or im_can_read_athlete(who)) then
    return null;
  end if;
  select * into c from challenges where id = p_challenge;
  if not found then return null; end if;
  return case c.metric
    when 'sessions' then (
      select count(*) from scheduled_workouts s
      where s.athlete_id = who and s.status = 'completed' and s.type <> 'rest'
        and s.date between c.starts_on and c.ends_on)
    when 'club_runs' then (
      select count(*) from forge_score_events f
      where f.athlete_id = who and f.kind = 'community_run' and f.date between c.starts_on and c.ends_on)
    when 'checkins' then (
      select count(*) from checkins k
      where k.athlete_id = who and k.week_start between c.starts_on and c.ends_on)
    when 'distance_km' then (
      select coalesce(round(sum(w.actual_distance_km), 1), 0) from completed_workouts w
      where w.athlete_id = who and w.date between c.starts_on and c.ends_on)
  end;
end $$;

-- What any member may know about a challenge: how many joined, and who has
-- finished. Never anyone's numbers but the caller's own.
create or replace function im_challenge_summary(p_challenge uuid)
returns table (participants integer, finishers text[], viewer_joined boolean, viewer_progress numeric)
language plpgsql stable security definer set search_path = public as $$
declare
  c challenges%rowtype;
begin
  if auth.uid() is null then return; end if;
  select * into c from challenges where id = p_challenge;
  if not found then return; end if;
  return query
  with progress as (
    select p.athlete_id, pr.full_name,
      case c.metric
        when 'sessions' then (select count(*)::numeric from scheduled_workouts s
          where s.athlete_id = p.athlete_id and s.status = 'completed' and s.type <> 'rest'
            and s.date between c.starts_on and c.ends_on)
        when 'club_runs' then (select count(*)::numeric from forge_score_events f
          where f.athlete_id = p.athlete_id and f.kind = 'community_run' and f.date between c.starts_on and c.ends_on)
        when 'checkins' then (select count(*)::numeric from checkins k
          where k.athlete_id = p.athlete_id and k.week_start between c.starts_on and c.ends_on)
        when 'distance_km' then (select coalesce(sum(w.actual_distance_km), 0) from completed_workouts w
          where w.athlete_id = p.athlete_id and w.date between c.starts_on and c.ends_on)
      end as done
    from challenge_participants p
    join profiles pr on pr.id = p.athlete_id
    where p.challenge_id = p_challenge
  )
  select
    (select count(*)::int from progress),
    coalesce((select array_agg(full_name order by full_name) from progress where done >= c.target), '{}'),
    exists (select 1 from progress where athlete_id = auth.uid()),
    (select done from progress where athlete_id = auth.uid());
end $$;

-- ---------- GDPR export ----------
create or replace function im_export_athlete_data(target uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (target = auth.uid() or im_is_admin()) then
    raise exception 'not permitted';
  end if;
  return jsonb_build_object(
    'profile',                (select to_jsonb(p) from profiles p where p.id = target),
    'goals',                  (select coalesce(jsonb_agg(to_jsonb(g)), '[]'::jsonb) from goals g where g.athlete_id = target),
    'scheduled_workouts',     (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from scheduled_workouts s where s.athlete_id = target),
    'completed_workouts',     (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from completed_workouts c where c.athlete_id = target),
    'activities',             (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from activities a where a.athlete_id = target),
    'segment_efforts',        (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from segment_efforts e where e.athlete_id = target),
    'activity_comments',      (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from activity_comments c where c.author_id = target),
    'activity_kudos',         (select coalesce(jsonb_agg(to_jsonb(k)), '[]'::jsonb) from activity_kudos k where k.athlete_id = target),
    'challenge_participants', (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from challenge_participants p where p.athlete_id = target),
    'strength_sessions',      (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from strength_sessions s where s.athlete_id = target),
    'checkins',               (select coalesce(jsonb_agg(to_jsonb(k)), '[]'::jsonb) from checkins k where k.athlete_id = target),
    'forge_score_events',     (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from forge_score_events f where f.athlete_id = target),
    'achievements',           (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from achievements a where a.athlete_id = target),
    'messages',               (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from messages m where m.recipient_id = target or m.sender_id = target),
    'exported_at',            to_jsonb(now())
  );
end $$;
