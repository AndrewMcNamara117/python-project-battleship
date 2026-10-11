-- ============================================================
-- IRON MILES TRAINING — full database install
--
-- Every migration, in order, in one file. Paste the whole thing into the
-- Supabase SQL Editor and press Run once.
--
-- GENERATED from the 20 files in supabase/migrations/, which remain the
-- source of truth. Rebuild with `npm run db:install`; a test fails if this
-- has drifted from them. It lives outside migrations/ on purpose — the PGlite
-- harness applies every .sql in that folder, and a combined copy there would
-- run the whole schema twice.
--
-- One transaction: if any statement fails, nothing is left behind, so a
-- failed run can be fixed and repeated on the same project.
-- ============================================================

begin;

-- ======================= 0001_schema.sql =======================

-- ============================================================
-- IRON MILES TRAINING — core schema
-- Postgres / Supabase. Every athlete-owned table carries athlete_id
-- so row-level security can be expressed as a single ownership check.
-- ============================================================

-- gen_random_uuid() is Postgres core from 13 onward, so no extension is needed.
-- (pgcrypto used to be required for it; depending on it now only adds a
-- privilege the migration does not otherwise need.)

-- ---------- enums ----------
create type im_role            as enum ('athlete','coach','admin');
create type im_units           as enum ('metric','imperial');
create type im_link_status     as enum ('pending','active','paused','ended');
create type im_event_type      as enum ('5k','10k','half_marathon','marathon','ultra','triathlon_70_3','triathlon_olympic','general_endurance');
create type im_goal_outcome    as enum ('time','completion','placing','process');
create type im_workout_type    as enum ('easy_run','recovery_run','long_run','progression_run','tempo','threshold','intervals','hills','race_pace','brick','bike','swim','cross_training','strength','mobility','rest','race');
create type im_basis           as enum ('distance','time','pace','heart_rate','rpe');
create type im_intensity       as enum ('recovery','easy','steady','hard','max','rest');
create type im_session_status  as enum ('scheduled','completed','missed','rescheduled','skipped');
create type im_program_status  as enum ('draft','active','complete','archived');
create type im_movement        as enum ('squat','hinge','lunge','push','pull','carry','core','plyometric','mobility','rehab');
create type im_strength_cat    as enum ('foundation','performance','maintenance','ultra_prep','triathlon_support');
create type im_attention       as enum ('none','watch','attention');
create type im_note_visibility as enum ('private','shared');
create type im_author_kind     as enum ('human','forge');
create type im_forge_event     as enum ('run_completed','strength_completed','checkin_completed','community_run','full_week_adherence','race_completed','volunteered','milestone','streak_week');
create type im_sub_status      as enum ('trialing','active','past_due','paused','canceled','incomplete');
create type im_provider        as enum ('strava','garmin','coros','apple_health','google_fit');
create type im_data_source     as enum ('manual','strava','garmin','coros','apple_health','google_fit');
create type im_community_kind  as enum ('club_run','race','session','social','volunteer');
create type im_post_kind       as enum ('announcement','milestone','shoutout');
create type im_application_status as enum ('new','reviewing','accepted','declined');

-- ---------- identity ----------
-- profiles extends auth.users 1:1. auth.users holds credentials; nothing else does.
create table profiles (
  id                      uuid primary key references auth.users(id) on delete cascade,
  role                    im_role     not null default 'athlete',
  full_name               text        not null default '',
  email                   text        not null,
  avatar_url              text,
  date_of_birth           date,
  location                text,
  timezone                text        not null default 'Europe/Dublin',
  units                   im_units    not null default 'metric',
  onboarded_at            timestamptz,
  health_data_consent_at  timestamptz,
  leaderboard_opt_in      boolean     not null default false,
  forge_assistant_enabled boolean     not null default true,
  training_group          text,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index on profiles (role);

create table coach_athlete_links (
  id         uuid primary key default gen_random_uuid(),
  coach_id   uuid not null references profiles(id) on delete cascade,
  athlete_id uuid not null references profiles(id) on delete cascade,
  status     im_link_status not null default 'active',
  started_at timestamptz not null default now(),
  ended_at   timestamptz,
  unique (coach_id, athlete_id)
);
create index on coach_athlete_links (athlete_id) where status = 'active';
create index on coach_athlete_links (coach_id)   where status = 'active';

-- ---------- goals + races ----------
create table races (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  date         date not null,
  location     text,
  event_type   im_event_type not null,
  distance_km  numeric(6,2),
  elevation_m  integer,
  url          text,
  -- null => an Iron Miles shared race on the club calendar
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index on races (date);

create table goals (
  id                  uuid primary key default gen_random_uuid(),
  athlete_id          uuid not null references profiles(id) on delete cascade,
  race_id             uuid references races(id) on delete set null,
  event_type          im_event_type not null,
  target_date         date not null,
  outcome             im_goal_outcome not null default 'completion',
  target_time_seconds integer check (target_time_seconds is null or target_time_seconds > 0),
  why                 text not null default '',
  is_primary          boolean not null default true,
  created_at          timestamptz not null default now()
);
create index on goals (athlete_id, is_primary);

-- ---------- workout + programme library ----------
create table workout_templates (
  id               uuid primary key default gen_random_uuid(),
  owner_id         uuid references profiles(id) on delete cascade,
  is_shared        boolean not null default false,
  name             text not null,
  type             im_workout_type not null,
  basis            im_basis not null default 'distance',
  intensity        im_intensity not null default 'easy',
  distance_km      numeric(6,2),
  duration_minutes integer,
  pace_min_sec_km  integer,
  pace_max_sec_km  integer,
  hr_zone          smallint check (hr_zone between 1 and 5),
  rpe_target       smallint check (rpe_target between 1 and 10),
  warm_up          text,
  main_set         text,
  cool_down        text,
  notes            text,
  created_at       timestamptz not null default now(),
  -- a shared library row has no owner; a private row must have one
  constraint owner_or_shared check (is_shared or owner_id is not null)
);

create table program_templates (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid references profiles(id) on delete cascade,
  is_shared   boolean not null default false,
  name        text not null,
  goal_type   im_event_type not null,
  weeks       smallint not null check (weeks between 1 and 104),
  description text not null default '',
  created_at  timestamptz not null default now()
);

-- one row per (week, weekday) slot in a template
create table program_template_slots (
  id                  uuid primary key default gen_random_uuid(),
  program_template_id uuid not null references program_templates(id) on delete cascade,
  week_index          smallint not null check (week_index >= 0),
  weekday             smallint not null check (weekday between 0 and 6),
  slot                smallint not null default 0,
  workout_template_id uuid references workout_templates(id) on delete set null,
  strength_template_id uuid,
  unique (program_template_id, week_index, weekday, slot)
);

create table programs (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references profiles(id) on delete cascade,
  coach_id    uuid not null references profiles(id) on delete cascade,
  template_id uuid references program_templates(id) on delete set null,
  goal_id     uuid references goals(id) on delete set null,
  name        text not null,
  start_date  date not null,
  end_date    date not null,
  status      im_program_status not null default 'draft',
  created_at  timestamptz not null default now(),
  check (end_date >= start_date)
);
create index on programs (athlete_id, status);

-- ---------- strength ----------
create table strength_exercises (
  id            uuid primary key default gen_random_uuid(),
  owner_id      uuid references profiles(id) on delete cascade,
  is_shared     boolean not null default true,
  name          text not null,
  category      im_movement not null,
  muscle_groups text[] not null default '{}',
  video_url     text,
  cues          text[] not null default '{}',
  regressions   text[] not null default '{}',
  progressions  text[] not null default '{}',
  equipment     text[] not null default '{}',
  created_at    timestamptz not null default now()
);

create table strength_templates (
  id                uuid primary key default gen_random_uuid(),
  owner_id          uuid references profiles(id) on delete cascade,
  is_shared         boolean not null default true,
  name              text not null,
  category          im_strength_cat not null,
  description       text not null default '',
  estimated_minutes integer not null default 45,
  created_at        timestamptz not null default now()
);

alter table program_template_slots
  add constraint program_template_slots_strength_fk
  foreign key (strength_template_id) references strength_templates(id) on delete set null;

create table strength_template_blocks (
  id                   uuid primary key default gen_random_uuid(),
  strength_template_id uuid not null references strength_templates(id) on delete cascade,
  exercise_id          uuid not null references strength_exercises(id) on delete restrict,
  "order"              smallint not null,
  sets                 smallint not null check (sets > 0),
  reps                 text not null,
  tempo                text,
  rest_seconds         integer,
  rpe_target           smallint check (rpe_target between 1 and 10),
  notes                text,
  unique (strength_template_id, "order")
);

-- ---------- scheduled + completed training ----------
create table scheduled_workouts (
  id                   uuid primary key default gen_random_uuid(),
  program_id           uuid references programs(id) on delete cascade,
  athlete_id           uuid not null references profiles(id) on delete cascade,
  date                 date not null,
  slot                 smallint not null default 0,
  status               im_session_status not null default 'scheduled',
  name                 text not null,
  type                 im_workout_type not null,
  basis                im_basis not null default 'distance',
  intensity            im_intensity not null default 'easy',
  distance_km          numeric(6,2),
  duration_minutes     integer,
  pace_min_sec_km      integer,
  pace_max_sec_km      integer,
  hr_zone              smallint check (hr_zone between 1 and 5),
  rpe_target           smallint check (rpe_target between 1 and 10),
  warm_up              text,
  main_set             text,
  cool_down            text,
  notes                text,
  coach_note           text,
  strength_template_id uuid references strength_templates(id) on delete set null,
  race_id              uuid references races(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (athlete_id, date, slot)
);
create index on scheduled_workouts (athlete_id, date);
create index on scheduled_workouts (athlete_id, status);

create table completed_workouts (
  id                      uuid primary key default gen_random_uuid(),
  scheduled_workout_id    uuid unique references scheduled_workouts(id) on delete set null,
  athlete_id              uuid not null references profiles(id) on delete cascade,
  date                    date not null,
  type                    im_workout_type not null,
  actual_distance_km      numeric(6,2),
  actual_duration_minutes integer,
  average_pace_sec_per_km integer,
  average_heart_rate      smallint,
  max_heart_rate          smallint,
  rpe                     smallint check (rpe between 1 and 10),
  session_rating          smallint check (session_rating between 1 and 5),
  soreness                smallint check (soreness between 1 and 10),
  athlete_notes           text,
  source                  im_data_source not null default 'manual',
  created_at              timestamptz not null default now()
);
create index on completed_workouts (athlete_id, date desc);

create table strength_sessions (
  id                   uuid primary key default gen_random_uuid(),
  athlete_id           uuid not null references profiles(id) on delete cascade,
  scheduled_workout_id uuid references scheduled_workouts(id) on delete set null,
  template_id          uuid not null references strength_templates(id) on delete restrict,
  date                 date not null,
  status               im_session_status not null default 'scheduled',
  -- [{exerciseId,setIndex,reps,weightKg,rpe,completed}]
  logs                 jsonb not null default '[]'::jsonb,
  duration_minutes     integer,
  notes                text,
  completed_at         timestamptz,
  created_at           timestamptz not null default now()
);
create index on strength_sessions (athlete_id, date desc);

-- ---------- check-ins ----------
create table checkins (
  id                    uuid primary key default gen_random_uuid(),
  athlete_id            uuid not null references profiles(id) on delete cascade,
  week_start            date not null,
  fatigue               smallint not null check (fatigue between 1 and 10),
  sleep                 smallint not null check (sleep between 1 and 10),
  soreness              smallint not null check (soreness between 1 and 10),
  stress                smallint not null check (stress between 1 and 10),
  motivation            smallint not null check (motivation between 1 and 10),
  confidence            smallint not null check (confidence between 1 and 10),
  training_difficulty   smallint not null check (training_difficulty between 1 and 10),
  went_well             text not null default '',
  felt_difficult        text not null default '',
  pain_or_niggles       text not null default '',
  affecting_training    text not null default '',
  confidence_next_week  text not null default '',
  for_coach             text not null default '',
  -- rule-based triage only. never a diagnosis.
  attention_level       im_attention not null default 'none',
  attention_reasons     text[] not null default '{}',
  reviewed_by_coach_at  timestamptz,
  coach_response        text,
  submitted_at          timestamptz not null default now(),
  unique (athlete_id, week_start)
);
create index on checkins (attention_level) where reviewed_by_coach_at is null;

-- ---------- coaching comms ----------
create table coach_notes (
  id         uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references profiles(id) on delete cascade,
  coach_id   uuid not null references profiles(id) on delete cascade,
  body       text not null,
  visibility im_note_visibility not null default 'private',
  created_at timestamptz not null default now()
);
create index on coach_notes (athlete_id, created_at desc);

create table message_threads (
  id         uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references profiles(id) on delete cascade,
  coach_id   uuid not null references profiles(id) on delete cascade,
  updated_at timestamptz not null default now(),
  unique (athlete_id, coach_id)
);

create table messages (
  id           uuid primary key default gen_random_uuid(),
  thread_id    uuid not null references message_threads(id) on delete cascade,
  sender_id    uuid references profiles(id) on delete set null,
  recipient_id uuid not null references profiles(id) on delete cascade,
  body         text not null,
  author_kind  im_author_kind not null default 'human',
  read_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index on messages (thread_id, created_at desc);
create index on messages (recipient_id) where read_at is null;

-- ---------- forge score, achievements, community ----------
create table forge_score_events (
  id         uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references profiles(id) on delete cascade,
  kind       im_forge_event not null,
  points     integer not null default 0,
  date       date not null,
  label      text not null default '',
  source_id  uuid,
  created_at timestamptz not null default now(),
  -- one award per source row per kind: makes the ledger idempotent
  unique (athlete_id, kind, source_id)
);
create index on forge_score_events (athlete_id, date desc);

create table achievements (
  id          uuid primary key default gen_random_uuid(),
  athlete_id  uuid not null references profiles(id) on delete cascade,
  code        text not null,
  title       text not null,
  description text not null default '',
  earned_at   timestamptz not null default now(),
  unique (athlete_id, code)
);

create table community_events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  kind        im_community_kind not null default 'club_run',
  starts_at   timestamptz not null,
  location    text not null default '',
  description text not null default '',
  capacity    integer,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index on community_events (starts_at);

create table event_attendance (
  id         uuid primary key default gen_random_uuid(),
  event_id   uuid not null references community_events(id) on delete cascade,
  athlete_id uuid not null references profiles(id) on delete cascade,
  status     text not null default 'going',
  attended   boolean not null default false,
  volunteered boolean not null default false,
  unique (event_id, athlete_id)
);

create table community_posts (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid references profiles(id) on delete set null,
  kind       im_post_kind not null default 'announcement',
  body       text not null,
  reactions  jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on community_posts (created_at desc);

-- ---------- billing ----------
create table subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  athlete_id             uuid not null references profiles(id) on delete cascade,
  package_code           text not null default 'event_ready',
  status                 im_sub_status not null default 'incomplete',
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  price_cents            integer not null default 12900,
  currency               text not null default 'eur',
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index on subscriptions (athlete_id);

create table payments (
  id                 uuid primary key default gen_random_uuid(),
  athlete_id         uuid not null references profiles(id) on delete cascade,
  subscription_id    uuid references subscriptions(id) on delete set null,
  stripe_invoice_id  text unique,
  amount_cents       integer not null,
  currency           text not null default 'eur',
  status             text not null,
  invoice_url        text,
  paid_at            timestamptz,
  created_at         timestamptz not null default now()
);

-- ---------- integrations (architected now, connected later) ----------
create table integrations (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references profiles(id) on delete cascade,
  provider     im_provider not null,
  status       text not null default 'available',
  -- tokens live in Vault, never in a client-readable column
  connected_at timestamptz,
  last_sync_at timestamptz,
  unique (athlete_id, provider)
);

create table activity_imports (
  id           uuid primary key default gen_random_uuid(),
  athlete_id   uuid not null references profiles(id) on delete cascade,
  provider     im_provider not null,
  external_id  text not null,
  raw          jsonb not null default '{}'::jsonb,
  matched_workout_id uuid references completed_workouts(id) on delete set null,
  imported_at  timestamptz not null default now(),
  unique (provider, external_id)
);

-- ---------- notifications + applications ----------
create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text not null default '',
  href       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index on notifications (user_id, created_at desc);

create table coaching_applications (
  id                uuid primary key default gen_random_uuid(),
  full_name         text not null,
  email             text not null,
  phone             text,
  goal              text not null,
  target_race       text,
  target_date       date,
  current_weekly_km numeric(6,2),
  experience        text not null default '',
  injuries          text,
  start_when        text not null default '',
  status            im_application_status not null default 'new',
  created_at        timestamptz not null default now()
);

-- ---------- onboarding payload ----------
create table athlete_onboarding (
  athlete_id  uuid primary key references profiles(id) on delete cascade,
  data        jsonb not null default '{}'::jsonb,
  step        smallint not null default 1,
  completed_at timestamptz,
  updated_at  timestamptz not null default now()
);

-- ---------- triggers ----------
create or replace function im_touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger t_profiles_touch  before update on profiles
  for each row execute function im_touch_updated_at();
create trigger t_scheduled_touch before update on scheduled_workouts
  for each row execute function im_touch_updated_at();
create trigger t_subs_touch      before update on subscriptions
  for each row execute function im_touch_updated_at();

-- new auth user => profile row, athlete by default
create or replace function im_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end $$;

create trigger t_on_auth_user_created
  after insert on auth.users
  for each row execute function im_handle_new_user();

-- ======================= 0002_rls.sql =======================

-- ============================================================
-- IRON MILES TRAINING — row-level security
-- Default deny. Training and wellbeing data is treated as sensitive
-- health data: an athlete sees their own rows, their coach sees rows
-- for athletes actively linked to them, and nobody else sees anything.
-- ============================================================

-- ---------- helpers ----------
-- security definer so the policy can read links without recursing through RLS
create or replace function im_is_coach_of(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from coach_athlete_links l
    where l.athlete_id = target
      and l.coach_id = auth.uid()
      and l.status = 'active'
  );
$$;

create or replace function im_is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin');
$$;

create or replace function im_is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('coach','admin'));
$$;

-- true when the caller may read this athlete's training data
create or replace function im_can_read_athlete(target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select target = auth.uid() or im_is_coach_of(target) or im_is_admin();
$$;

-- ---------- enable RLS everywhere ----------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','coach_athlete_links','races','goals','workout_templates','program_templates',
    'program_template_slots','programs','strength_exercises','strength_templates',
    'strength_template_blocks','scheduled_workouts','completed_workouts','strength_sessions',
    'checkins','coach_notes','message_threads','messages','forge_score_events','achievements',
    'community_events','event_attendance','community_posts','subscriptions','payments',
    'integrations','activity_imports','notifications','coaching_applications','athlete_onboarding'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
  end loop;
end $$;

-- ---------- profiles ----------
create policy profiles_self_read on profiles
  for select using (id = auth.uid() or im_is_coach_of(id) or im_is_admin());

-- an athlete on a leaderboard has consented to being seen there
create policy profiles_leaderboard_read on profiles
  for select using (leaderboard_opt_in and auth.uid() is not null);

create policy profiles_self_update on profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- only an admin may change roles; enforced by a column-level trigger below
create policy profiles_admin_all on profiles
  for all using (im_is_admin()) with check (im_is_admin());

create or replace function im_guard_role_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- auth.uid() is null when there is no end user behind the statement: the
  -- service role, a migration, a seed script. Those paths are already fully
  -- privileged and bypass RLS entirely, so guarding them here would only break
  -- legitimate server-side work. The escalation this prevents is an
  -- authenticated user changing their own role.
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not im_is_admin() then
    raise exception 'role changes require an administrator';
  end if;
  return new;
end $$;

create trigger t_profiles_guard_role before update on profiles
  for each row execute function im_guard_role_change();

-- ---------- coaching relationship ----------
create policy links_read on coach_athlete_links
  for select using (athlete_id = auth.uid() or coach_id = auth.uid() or im_is_admin());
create policy links_write on coach_athlete_links
  for all using (coach_id = auth.uid() or im_is_admin())
  with check (coach_id = auth.uid() or im_is_admin());

-- ---------- shared libraries ----------
-- races: the club calendar is readable by any signed-in athlete
create policy races_read on races
  for select using (auth.uid() is not null);
create policy races_staff_write on races
  for all using (im_is_staff()) with check (im_is_staff());

create policy workout_templates_read on workout_templates
  for select using (is_shared or owner_id = auth.uid() or im_is_admin());
create policy workout_templates_write on workout_templates
  for all using (owner_id = auth.uid() or im_is_admin())
  with check (owner_id = auth.uid() or im_is_admin());

create policy program_templates_read on program_templates
  for select using (is_shared or owner_id = auth.uid() or im_is_admin());
create policy program_templates_write on program_templates
  for all using (owner_id = auth.uid() or im_is_admin())
  with check (owner_id = auth.uid() or im_is_admin());

create policy pts_read on program_template_slots
  for select using (exists (
    select 1 from program_templates pt where pt.id = program_template_id
      and (pt.is_shared or pt.owner_id = auth.uid() or im_is_admin())));
create policy pts_write on program_template_slots
  for all using (exists (
    select 1 from program_templates pt where pt.id = program_template_id
      and (pt.owner_id = auth.uid() or im_is_admin())))
  with check (exists (
    select 1 from program_templates pt where pt.id = program_template_id
      and (pt.owner_id = auth.uid() or im_is_admin())));

create policy strength_ex_read on strength_exercises
  for select using (is_shared or owner_id = auth.uid() or im_is_admin());
create policy strength_ex_write on strength_exercises
  for all using (owner_id = auth.uid() or im_is_admin())
  with check (owner_id = auth.uid() or im_is_admin());

create policy strength_tpl_read on strength_templates
  for select using (is_shared or owner_id = auth.uid() or im_is_admin());
create policy strength_tpl_write on strength_templates
  for all using (owner_id = auth.uid() or im_is_admin())
  with check (owner_id = auth.uid() or im_is_admin());

create policy strength_blocks_read on strength_template_blocks
  for select using (exists (
    select 1 from strength_templates st where st.id = strength_template_id
      and (st.is_shared or st.owner_id = auth.uid() or im_is_admin())));
create policy strength_blocks_write on strength_template_blocks
  for all using (exists (
    select 1 from strength_templates st where st.id = strength_template_id
      and (st.owner_id = auth.uid() or im_is_admin())))
  with check (exists (
    select 1 from strength_templates st where st.id = strength_template_id
      and (st.owner_id = auth.uid() or im_is_admin())));

-- ---------- athlete-owned training data ----------
-- goals, programmes and the schedule: athlete reads, coach writes.
create policy goals_read on goals for select using (im_can_read_athlete(athlete_id));
create policy goals_write on goals for all
  using (athlete_id = auth.uid() or im_is_coach_of(athlete_id) or im_is_admin())
  with check (athlete_id = auth.uid() or im_is_coach_of(athlete_id) or im_is_admin());

create policy programs_read on programs for select using (im_can_read_athlete(athlete_id));
create policy programs_write on programs for all
  using (im_is_coach_of(athlete_id) or im_is_admin())
  with check (im_is_coach_of(athlete_id) or im_is_admin());

-- the athlete may read their schedule and mark sessions done; the coach prescribes it
create policy sched_read on scheduled_workouts for select using (im_can_read_athlete(athlete_id));
create policy sched_coach_write on scheduled_workouts for all
  using (im_is_coach_of(athlete_id) or im_is_admin())
  with check (im_is_coach_of(athlete_id) or im_is_admin());
create policy sched_athlete_status on scheduled_workouts for update
  using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

-- an athlete's own log of what happened. the coach reads it, never writes it.
create policy completed_read on completed_workouts for select using (im_can_read_athlete(athlete_id));
create policy completed_own_write on completed_workouts for all
  using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());

create policy strength_sessions_read on strength_sessions for select using (im_can_read_athlete(athlete_id));
create policy strength_sessions_own_write on strength_sessions for all
  using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
create policy strength_sessions_coach_write on strength_sessions for insert
  with check (im_is_coach_of(athlete_id) or im_is_admin());

-- check-ins carry wellbeing text. athlete writes; linked coach reads and responds.
create policy checkins_read on checkins for select using (im_can_read_athlete(athlete_id));
create policy checkins_own_write on checkins for all
  using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
create policy checkins_coach_respond on checkins for update
  using (im_is_coach_of(athlete_id) or im_is_admin())
  with check (im_is_coach_of(athlete_id) or im_is_admin());

-- private coach notes are invisible to the athlete, by design
create policy coach_notes_read on coach_notes for select using (
  im_is_coach_of(athlete_id) or im_is_admin()
  or (athlete_id = auth.uid() and visibility = 'shared')
);
create policy coach_notes_write on coach_notes for all
  using (coach_id = auth.uid() or im_is_admin())
  with check (coach_id = auth.uid() or im_is_admin());

create policy onboarding_rw on athlete_onboarding for all
  using (athlete_id = auth.uid() or im_is_coach_of(athlete_id) or im_is_admin())
  with check (athlete_id = auth.uid() or im_is_admin());

-- ---------- messaging ----------
create policy threads_read on message_threads
  for select using (athlete_id = auth.uid() or coach_id = auth.uid() or im_is_admin());
create policy threads_write on message_threads
  for all using (athlete_id = auth.uid() or coach_id = auth.uid() or im_is_admin())
  with check (athlete_id = auth.uid() or coach_id = auth.uid() or im_is_admin());

create policy messages_read on messages for select using (exists (
  select 1 from message_threads t where t.id = thread_id
    and (t.athlete_id = auth.uid() or t.coach_id = auth.uid() or im_is_admin())));
-- you may only send as yourself; FORGE messages are inserted server-side
create policy messages_send on messages for insert
  with check (sender_id = auth.uid() and author_kind = 'human' and exists (
    select 1 from message_threads t where t.id = thread_id
      and (t.athlete_id = auth.uid() or t.coach_id = auth.uid())));
create policy messages_mark_read on messages for update
  using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- ---------- forge score, achievements ----------
-- the ledger is append-only from the server; clients read, never write
create policy forge_read on forge_score_events for select using (
  im_can_read_athlete(athlete_id)
  or exists (select 1 from profiles p where p.id = athlete_id and p.leaderboard_opt_in)
);
create policy forge_admin_write on forge_score_events for all
  using (im_is_admin()) with check (im_is_admin());

create policy achievements_read on achievements for select using (
  im_can_read_athlete(athlete_id)
  or exists (select 1 from profiles p where p.id = athlete_id and p.leaderboard_opt_in)
);
create policy achievements_admin_write on achievements for all
  using (im_is_admin()) with check (im_is_admin());

-- ---------- community ----------
create policy community_events_read on community_events
  for select using (auth.uid() is not null);
create policy community_events_write on community_events
  for all using (im_is_staff()) with check (im_is_staff());

create policy attendance_read on event_attendance
  for select using (athlete_id = auth.uid() or im_is_staff());
create policy attendance_own_write on event_attendance
  for all using (athlete_id = auth.uid()) with check (athlete_id = auth.uid());
create policy attendance_staff_write on event_attendance
  for all using (im_is_staff()) with check (im_is_staff());

create policy posts_read on community_posts for select using (auth.uid() is not null);
create policy posts_write on community_posts
  for all using (im_is_staff()) with check (im_is_staff());

-- ---------- billing (server-writable only) ----------
create policy subs_read on subscriptions
  for select using (athlete_id = auth.uid() or im_is_admin());
create policy subs_admin_write on subscriptions
  for all using (im_is_admin()) with check (im_is_admin());

create policy payments_read on payments
  for select using (athlete_id = auth.uid() or im_is_admin());
create policy payments_admin_write on payments
  for all using (im_is_admin()) with check (im_is_admin());

-- ---------- integrations ----------
create policy integrations_rw on integrations
  for all using (athlete_id = auth.uid() or im_is_admin())
  with check (athlete_id = auth.uid() or im_is_admin());

create policy imports_read on activity_imports
  for select using (im_can_read_athlete(athlete_id));
create policy imports_admin_write on activity_imports
  for all using (im_is_admin()) with check (im_is_admin());

-- ---------- notifications ----------
create policy notifications_rw on notifications
  for all using (user_id = auth.uid() or im_is_admin())
  with check (user_id = auth.uid() or im_is_admin());

-- ---------- applications ----------
-- the public apply form posts through a server route with the anon role;
-- nobody but staff can read what was submitted
create policy applications_insert on coaching_applications
  for insert with check (true);
create policy applications_staff_read on coaching_applications
  for select using (im_is_staff());
create policy applications_staff_write on coaching_applications
  for update using (im_is_staff()) with check (im_is_staff());

-- ---------- GDPR: hard delete of an athlete's own data ----------
-- every athlete-owned table cascades from profiles, which cascades from auth.users,
-- so account deletion is a single delete on auth.users performed by the service role.
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
    'strength_sessions',  (select coalesce(jsonb_agg(to_jsonb(s)), '[]'::jsonb) from strength_sessions s where s.athlete_id = target),
    'checkins',           (select coalesce(jsonb_agg(to_jsonb(k)), '[]'::jsonb) from checkins k where k.athlete_id = target),
    'forge_score_events', (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from forge_score_events f where f.athlete_id = target),
    'achievements',       (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from achievements a where a.athlete_id = target),
    'messages',           (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from messages m where m.recipient_id = target or m.sender_id = target),
    'exported_at',        to_jsonb(now())
  );
end $$;

-- ======================= 0003_acceptance.sql =======================

-- ============================================================
-- IRON MILES TRAINING — coach acceptance and athlete intake
--
-- Closes the gap between "someone applied" and "someone is being coached".
-- A coach cannot create an athlete account directly: accounts are created by
-- the athlete signing up, because a profile row is tied to an auth.users row.
-- So acceptance records the decision, and the coach-athlete link is formed
-- automatically the moment that person registers with the email they applied
-- with. No manual linking step, and no orphaned athletes.
-- ============================================================

alter table coaching_applications
  add column if not exists accepted_by  uuid references profiles(id) on delete set null,
  add column if not exists accepted_at  timestamptz,
  add column if not exists decided_note text,
  add column if not exists joined_athlete_id uuid references profiles(id) on delete set null;

-- one accepted application per email at a time; re-applying after a decline is fine
create unique index if not exists coaching_applications_accepted_email
  on coaching_applications (lower(email))
  where status = 'accepted' and joined_athlete_id is null;

create index if not exists coaching_applications_status_idx
  on coaching_applications (status, created_at desc);

-- ---------- intake: link an accepted applicant on sign-up ----------
create or replace function im_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  app record;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;

  -- an accepted application for this address means a coach already said yes
  select * into app
  from public.coaching_applications
  where lower(email) = lower(new.email)
    and status = 'accepted'
    and joined_athlete_id is null
    and accepted_by is not null
  order by accepted_at desc
  limit 1;

  if found then
    insert into public.coach_athlete_links (coach_id, athlete_id, status)
    values (app.accepted_by, new.id, 'active')
    on conflict (coach_id, athlete_id) do update set status = 'active', ended_at = null;

    insert into public.message_threads (athlete_id, coach_id)
    values (new.id, app.accepted_by)
    on conflict (athlete_id, coach_id) do nothing;

    update public.coaching_applications
       set joined_athlete_id = new.id
     where id = app.id;

    -- carry the applicant's stated name across if they did not supply one
    if coalesce(new.raw_user_meta_data->>'full_name', '') = '' and app.full_name <> '' then
      update public.profiles set full_name = app.full_name where id = new.id;
    end if;
  end if;

  return new;
end $$;

-- ---------- acceptance, as a single auditable step ----------
create or replace function im_decide_application(
  application_id uuid,
  decision       im_application_status,
  note           text default null
) returns coaching_applications
language plpgsql security definer set search_path = public as $$
declare
  result coaching_applications;
begin
  if not im_is_staff() then
    raise exception 'only a coach may decide an application';
  end if;
  if decision not in ('accepted','declined','reviewing') then
    raise exception 'unsupported decision';
  end if;

  update coaching_applications
     set status       = decision,
         decided_note = note,
         accepted_by  = case when decision = 'accepted' then auth.uid() else null end,
         accepted_at  = case when decision = 'accepted' then now() else null end
   where id = application_id
  returning * into result;

  if result is null then
    raise exception 'application not found';
  end if;
  return result;
end $$;

-- ---------- a coach adopting an athlete who already has an account ----------
create or replace function im_link_athlete(target_athlete uuid)
returns coach_athlete_links
language plpgsql security definer set search_path = public as $$
declare
  link coach_athlete_links;
begin
  if not im_is_staff() then
    raise exception 'only a coach may link an athlete';
  end if;
  if not exists (select 1 from profiles p where p.id = target_athlete and p.role = 'athlete') then
    raise exception 'no such athlete';
  end if;

  insert into coach_athlete_links (coach_id, athlete_id, status)
  values (auth.uid(), target_athlete, 'active')
  on conflict (coach_id, athlete_id) do update set status = 'active', ended_at = null
  returning * into link;

  insert into message_threads (athlete_id, coach_id)
  values (target_athlete, auth.uid())
  on conflict (athlete_id, coach_id) do nothing;

  return link;
end $$;

-- ======================= 0004_athlete_model.sql =======================

-- ============================================================
-- IRON MILES TRAINING — athlete model, and a security fix
--
-- Two things:
--
-- 1. Closes a real hole. The coach_notes write policy checked authorship but
--    never the coaching relationship, so any coach could write a private note
--    about any athlete in the system. Verified by executing it, not by reading
--    the policy.
--
-- 2. Promotes the athlete's coaching profile out of athlete_onboarding.data.
--    That JSONB blob is unqueryable and unindexable, which means the coach
--    dashboard cannot filter, sort or flag on any of it — an athlete's
--    availability, experience and injury history were effectively invisible to
--    the person coaching them.
-- ============================================================

-- ---------- 1. the security fix ----------

drop policy if exists coach_notes_write on coach_notes;

-- Authorship AND the coaching relationship. A coach may only write notes about
-- athletes actively linked to them; an admin may write about anyone.
create policy coach_notes_write on coach_notes
  for all
  using (
    (coach_id = auth.uid() and im_is_coach_of(athlete_id))
    or im_is_admin()
  )
  with check (
    (coach_id = auth.uid() and im_is_coach_of(athlete_id))
    or im_is_admin()
  );

-- ---------- 2. the athlete model ----------

create type im_experience as enum ('beginner', 'developing', 'experienced', 'competitive');

-- Where the athlete is in their training cycle. Coach-settable for now; when
-- programme blocks land, a block carries its own phase and this becomes the
-- cached current value rather than the source of truth.
create type im_phase as enum ('base', 'build', 'sharpen', 'race', 'recover', 'off');

alter table profiles
  add column if not exists experience_level        im_experience,
  add column if not exists training_phase          im_phase,
  -- days the athlete would choose to train, and days they actually can.
  -- ISO weekday numbers, 1 = Monday.
  add column if not exists preferred_training_days smallint[] not null default '{}',
  add column if not exists available_training_days smallint[] not null default '{}',
  add column if not exists typical_session_minutes integer,
  add column if not exists current_weekly_km       numeric(6,2),
  add column if not exists gym_access              text,
  add column if not exists equipment               text[] not null default '{}',
  -- Coaching-relevant, athlete-authored. Not a medical record: this is what the
  -- athlete told their coach, in their own words.
  add column if not exists injury_notes            text,
  add column if not exists limitations_notes       text;

alter table profiles
  add constraint profiles_training_days_valid check (
    preferred_training_days <@ array[1,2,3,4,5,6,7]::smallint[]
    and available_training_days <@ array[1,2,3,4,5,6,7]::smallint[]
  );

-- the coach dashboard filters on these, so they are indexed
create index if not exists profiles_phase_idx on profiles (training_phase) where role = 'athlete';
create index if not exists profiles_experience_idx on profiles (experience_level) where role = 'athlete';

comment on column profiles.injury_notes is
  'Athlete-reported, coaching context only. Never a clinical record and never used to infer a diagnosis.';

-- ---------- 3. backfill from the onboarding blob ----------
-- Existing athletes keep what they told us. Runs once; safe to re-run.

update profiles p
   set experience_level = coalesce(p.experience_level, case
         when (o.data #>> '{history,weeklyKm}')::numeric >= 60 then 'competitive'::im_experience
         when (o.data #>> '{history,weeklyKm}')::numeric >= 35 then 'experienced'::im_experience
         when (o.data #>> '{history,weeklyKm}')::numeric >= 15 then 'developing'::im_experience
         when o.data #>> '{history,weeklyKm}' is not null      then 'beginner'::im_experience
         else null end),
       current_weekly_km = coalesce(p.current_weekly_km, (o.data #>> '{history,weeklyKm}')::numeric),
       typical_session_minutes = coalesce(
         p.typical_session_minutes, (o.data #>> '{availability,typicalSessionMinutes}')::integer),
       gym_access = coalesce(p.gym_access, o.data #>> '{availability,gymAccess}'),
       injury_notes = coalesce(p.injury_notes, nullif(o.data #>> '{health,currentInjuries}', '')),
       limitations_notes = coalesce(p.limitations_notes, nullif(o.data #>> '{health,recentInjuries}', ''))
  from athlete_onboarding o
 where o.athlete_id = p.id;

-- weekday names in the blob become ISO numbers
update profiles p
   set available_training_days = coalesce(
         nullif(p.available_training_days, '{}'),
         (select coalesce(array_agg(x.n order by x.n), '{}')
            from athlete_onboarding o,
                 lateral jsonb_array_elements_text(
                   coalesce(o.data #> '{availability,trainingDays}', '[]'::jsonb)) d(name),
                 lateral (select case lower(d.name)
                     when 'monday' then 1 when 'tuesday' then 2 when 'wednesday' then 3
                     when 'thursday' then 4 when 'friday' then 5 when 'saturday' then 6
                     when 'sunday' then 7 else null end as n) x
           where o.athlete_id = p.id and x.n is not null))
 where exists (select 1 from athlete_onboarding o where o.athlete_id = p.id);

-- an athlete who has not said otherwise prefers the days they are available
update profiles
   set preferred_training_days = available_training_days
 where preferred_training_days = '{}' and available_training_days <> '{}';

-- ---------- 4. equipment, from the same blob ----------
update profiles p
   set equipment = coalesce(
         nullif(p.equipment, '{}'),
         (select coalesce(array_agg(e.value), '{}')
            from athlete_onboarding o,
                 lateral jsonb_array_elements_text(
                   coalesce(o.data #> '{availability,equipment}', '[]'::jsonb)) e(value)
           where o.athlete_id = p.id))
 where exists (select 1 from athlete_onboarding o where o.athlete_id = p.id);

-- ======================= 0005_programme_architecture.sql =======================

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

-- ======================= 0006_libraries.sql =======================

-- ============================================================
-- IRON MILES TRAINING — reusable libraries
--
-- Workouts and S&C become real, coach-editable, database-backed content.
-- The TypeScript constants that held this material are migrated in and then
-- deleted: a parallel "real database" and "hard-coded list" would drift, and
-- the drift would be silent.
--
--   CREATE ONCE → SAVE TO LIBRARY → REUSE → ADAPT → PRESCRIBE
--
-- A template is a distinct coach-owned thing, never an athlete programme with
-- a null athlete. Inserting one into a programme COPIES it; the athlete's
-- session is independent from that moment on, and a later template edit can
-- never reach back into prescribed history.
-- ============================================================

-- ---------- who may see a library item ----------
create type im_visibility as enum (
  'private',  -- the owning coach only
  'shared',   -- any coach in the organisation
  'system'    -- shipped with the product; immutable, no owner
);

-- ---------- endurance categories ----------
-- How a coach files a session, which is broader than what it technically is:
-- a bike hour and a swim are both cross-training however differently they run.
-- 'custom' is for genuinely bespoke work, not a bucket for anything unmapped.
create type im_workout_category as enum (
  'easy', 'recovery', 'long_run', 'threshold', 'intervals', 'hills',
  'tempo', 'progression', 'race_specific', 'race',
  'cross_training', 'mobility', 'rest', 'custom'
);

-- Movement pattern is a checked text column rather than an enum. A training
-- taxonomy grows, and `alter type ... add value` cannot be used in the same
-- transaction that adds it — which would make every future addition a
-- two-migration dance for no benefit.
create or replace function im_movement_patterns() returns text[]
language sql immutable as $$
  select array[
    'squat','hinge','push','pull','lunge','calf','core',
    'plyometric','mobility','stability','carry','rehab','other'
  ];
$$;

-- ============================================================
-- SHARED LIBRARY COLUMNS
-- Every library table carries the same ownership, visibility, tagging and
-- archive vocabulary, so one set of rules governs all of them.
-- ============================================================

alter table workout_templates
  add column if not exists visibility  im_visibility not null default 'private',
  add column if not exists category    im_workout_category not null default 'custom',
  add column if not exists purpose     text,
  add column if not exists coach_notes text,
  add column if not exists tags        text[] not null default '{}',
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at  timestamptz not null default now();

alter table strength_exercises
  add column if not exists visibility        im_visibility not null default 'private',
  add column if not exists movement_pattern  text,
  add column if not exists description       text,
  add column if not exists default_sets      smallint,
  add column if not exists default_reps      text,
  add column if not exists load_guidance     text,
  add column if not exists default_tempo     text,
  add column if not exists default_rest_seconds integer,
  add column if not exists default_rpe       smallint,
  add column if not exists is_unilateral     boolean not null default false,
  add column if not exists tags              text[] not null default '{}',
  add column if not exists archived_at       timestamptz,
  add column if not exists updated_at        timestamptz not null default now();

alter table strength_exercises
  add constraint strength_exercises_movement_valid
  check (movement_pattern is null or movement_pattern = any (im_movement_patterns()));

alter table strength_templates
  add column if not exists visibility  im_visibility not null default 'private',
  add column if not exists purpose      text,
  add column if not exists coach_notes  text,
  add column if not exists tags         text[] not null default '{}',
  add column if not exists archived_at  timestamptz,
  add column if not exists updated_at   timestamptz not null default now();

alter table program_templates
  add column if not exists visibility  im_visibility not null default 'private',
  add column if not exists tags        text[] not null default '{}',
  add column if not exists archived_at timestamptz,
  add column if not exists updated_at  timestamptz not null default now();

-- the old boolean becomes the enum, then stops being the source of truth
update workout_templates  set visibility = (case when is_shared then 'shared' else 'private' end)::im_visibility;
update strength_exercises set visibility = (case when is_shared then 'shared' else 'private' end)::im_visibility;
update strength_templates set visibility = (case when is_shared then 'shared' else 'private' end)::im_visibility;
update program_templates  set visibility = (case when is_shared then 'shared' else 'private' end)::im_visibility;

-- the 0002 policies read is_shared, so they go first and are rebuilt below
drop policy if exists workout_templates_read  on workout_templates;
drop policy if exists workout_templates_write on workout_templates;
drop policy if exists strength_ex_read        on strength_exercises;
drop policy if exists strength_ex_write       on strength_exercises;
drop policy if exists strength_tpl_read       on strength_templates;
drop policy if exists strength_tpl_write      on strength_templates;
drop policy if exists program_templates_read  on program_templates;
drop policy if exists program_templates_write on program_templates;
drop policy if exists pts_read                on program_template_slots;
drop policy if exists pts_write               on program_template_slots;
drop policy if exists strength_blocks_read    on strength_template_blocks;
drop policy if exists strength_blocks_write   on strength_template_blocks;

alter table workout_templates  drop column if exists is_shared;
alter table strength_exercises drop column if exists is_shared;
alter table strength_templates drop column if exists is_shared;
alter table program_templates  drop column if exists is_shared;

-- ownership rules: system content has no owner, everything else must have one
alter table workout_templates add constraint workout_templates_owner_rule
  check ((visibility = 'system' and owner_id is null) or (visibility <> 'system' and owner_id is not null));
alter table strength_exercises add constraint strength_exercises_owner_rule
  check ((visibility = 'system' and owner_id is null) or (visibility <> 'system' and owner_id is not null));
alter table strength_templates add constraint strength_templates_owner_rule
  check ((visibility = 'system' and owner_id is null) or (visibility <> 'system' and owner_id is not null));

create index on workout_templates  (visibility, category) where archived_at is null;
create index on workout_templates  (owner_id) where archived_at is null;
create index on strength_exercises (visibility, movement_pattern) where archived_at is null;
create index on strength_templates (visibility, category) where archived_at is null;

-- ============================================================
-- TEMPLATE COMPONENTS
--
-- One table for both libraries, mirroring session_components column for column
-- so inserting a template into a programme is a straight copy rather than a
-- translation. Exactly one parent, enforced.
-- ============================================================

create table template_components (
  id                   uuid primary key default gen_random_uuid(),
  workout_template_id  uuid references workout_templates(id) on delete cascade,
  strength_template_id uuid references strength_templates(id) on delete cascade,
  position             smallint not null check (position >= 0),
  kind                 im_component_kind not null,
  label                text,
  notes                text,

  repeats              smallint check (repeats is null or repeats > 0),
  rpe_target           smallint check (rpe_target is null or rpe_target between 1 and 10),

  distance_km          numeric(6,2) check (distance_km is null or distance_km >= 0),
  duration_seconds     integer check (duration_seconds is null or duration_seconds >= 0),
  pace_min_sec_km      integer,
  pace_max_sec_km      integer,
  hr_zone              smallint check (hr_zone is null or hr_zone between 1 and 5),
  recovery_seconds     integer check (recovery_seconds is null or recovery_seconds >= 0),
  recovery_description text,

  strength_exercise_id uuid references strength_exercises(id) on delete restrict,
  sets                 smallint check (sets is null or sets > 0),
  reps                 text,
  load_prescription    text,
  tempo                text,
  rest_seconds         integer check (rest_seconds is null or rest_seconds >= 0),

  created_at           timestamptz not null default now(),

  constraint template_components_one_parent check (
    (workout_template_id is not null and strength_template_id is null)
    or (workout_template_id is null and strength_template_id is not null)
  ),
  constraint template_components_pace_ordered check (
    pace_min_sec_km is null or pace_max_sec_km is null or pace_min_sec_km <= pace_max_sec_km
  ),
  constraint template_components_exercise_identified check (
    kind <> 'exercise' or strength_exercise_id is not null or label is not null
  )
);

create unique index template_components_workout_position
  on template_components (workout_template_id, position) where workout_template_id is not null;
create unique index template_components_strength_position
  on template_components (strength_template_id, position) where strength_template_id is not null;
create index on template_components (strength_exercise_id) where strength_exercise_id is not null;

comment on table template_components is
  'Ordered parts of a reusable template. Same shape as session_components so insertion into a programme is a copy, not a translation.';

-- strength_template_blocks is superseded. It was never read or written by any
-- code path, so this drops an unused table rather than data.
drop table if exists strength_template_blocks;

-- ============================================================
-- BLOCK DELETION GUARD
--
-- A coach must never remove prescribed athlete history by deleting a parent
-- block. A populated block archives; only an empty one deletes.
-- ============================================================

alter table program_blocks add column if not exists archived_at timestamptz;

create or replace function im_guard_block_delete() returns trigger
language plpgsql as $$
declare
  v_weeks integer;
  v_sessions integer;
begin
  select count(*) into v_weeks from program_weeks where block_id = old.id;
  select count(*) into v_sessions
    from scheduled_workouts s
    join program_weeks w on w.id = s.program_week_id
   where w.block_id = old.id;

  if v_weeks > 0 or v_sessions > 0 then
    raise exception
      'This block still holds % week(s) and % prescribed session(s). Archive it instead, or empty it first — deleting it would erase prescribed athlete history.',
      v_weeks, v_sessions
      using errcode = 'restrict_violation';
  end if;
  return old;
end $$;

create trigger t_guard_block_delete
  before delete on program_blocks
  for each row execute function im_guard_block_delete();


-- ============================================================
-- LIBRARY ACCESS
--
--   private  the owning coach, and nobody else
--   shared   any coach or admin
--   system   any coach or admin; immutable, enforced by trigger below
--
-- Templates are never public and never visible to athletes: the prescription
-- reaches an athlete by being copied into their session, not by them reading
-- the coach's library.
--
-- Exercises are the one exception. An athlete running a prescribed strength
-- session needs the movement's name and cues, so they may read exactly the
-- exercises referenced by their own sessions — and no others.
-- ============================================================

create or replace function im_can_read_library(p_visibility im_visibility, p_owner uuid)
returns boolean language sql stable as $$
  select case
    when not im_is_staff() then false
    when p_visibility = 'system' then true
    when p_visibility = 'shared' then true
    else p_owner = auth.uid()
  end;
$$;

-- a coach may only change their own; system content is immutable to everyone
create or replace function im_can_write_library(p_visibility im_visibility, p_owner uuid)
returns boolean language sql stable as $$
  select p_visibility <> 'system' and (p_owner = auth.uid() or im_is_admin());
$$;

create policy workout_templates_read on workout_templates
  for select using (im_can_read_library(visibility, owner_id));
create policy workout_templates_write on workout_templates
  for all using (im_can_write_library(visibility, owner_id))
  with check (im_can_write_library(visibility, owner_id));

create policy strength_tpl_read on strength_templates
  for select using (im_can_read_library(visibility, owner_id));
create policy strength_tpl_write on strength_templates
  for all using (im_can_write_library(visibility, owner_id))
  with check (im_can_write_library(visibility, owner_id));

create policy program_templates_read on program_templates
  for select using (im_can_read_library(visibility, owner_id));
create policy program_templates_write on program_templates
  for all using (im_can_write_library(visibility, owner_id))
  with check (im_can_write_library(visibility, owner_id));

create policy pts_read on program_template_slots
  for select using (exists (
    select 1 from program_templates t
     where t.id = program_template_id and im_can_read_library(t.visibility, t.owner_id)));
create policy pts_write on program_template_slots
  for all using (exists (
    select 1 from program_templates t
     where t.id = program_template_id and im_can_write_library(t.visibility, t.owner_id)))
  with check (exists (
    select 1 from program_templates t
     where t.id = program_template_id and im_can_write_library(t.visibility, t.owner_id)));

-- exercises: coaches by the usual rules, athletes only where prescribed to them
create policy strength_ex_read on strength_exercises
  for select using (
    im_can_read_library(visibility, owner_id)
    or exists (
      select 1 from session_components c
       where c.strength_exercise_id = strength_exercises.id
         and c.athlete_id = auth.uid()
    )
  );
create policy strength_ex_write on strength_exercises
  for all using (im_can_write_library(visibility, owner_id))
  with check (im_can_write_library(visibility, owner_id));

-- template components follow their parent
alter table template_components enable row level security;
alter table template_components force row level security;

create policy template_components_read on template_components
  for select using (
    (workout_template_id is not null and exists (
      select 1 from workout_templates t
       where t.id = workout_template_id and im_can_read_library(t.visibility, t.owner_id)))
    or (strength_template_id is not null and exists (
      select 1 from strength_templates t
       where t.id = strength_template_id and im_can_read_library(t.visibility, t.owner_id)))
  );
create policy template_components_write on template_components
  for all using (
    (workout_template_id is not null and exists (
      select 1 from workout_templates t
       where t.id = workout_template_id and im_can_write_library(t.visibility, t.owner_id)))
    or (strength_template_id is not null and exists (
      select 1 from strength_templates t
       where t.id = strength_template_id and im_can_write_library(t.visibility, t.owner_id)))
  )
  with check (
    (workout_template_id is not null and exists (
      select 1 from workout_templates t
       where t.id = workout_template_id and im_can_write_library(t.visibility, t.owner_id)))
    or (strength_template_id is not null and exists (
      select 1 from strength_templates t
       where t.id = strength_template_id and im_can_write_library(t.visibility, t.owner_id)))
  );

-- ---------- system content is immutable ----------
-- The policies already refuse it, but a security-definer function or a future
-- admin path could slip past them. This makes it structural.
create or replace function im_guard_system_content() returns trigger
language plpgsql as $$
begin
  -- Migrations run as the service role, where auth.uid() is null: they are how
  -- system content is seeded and how it would be corrected later. Everyone
  -- else is locked out of it in both directions.
  if auth.uid() is null then
    return case when tg_op = 'DELETE' then old else new end;
  end if;

  if old.visibility = 'system' then
    raise exception 'System library content cannot be %. Duplicate it and edit your copy.',
      case when tg_op = 'DELETE' then 'deleted' else 'edited' end
      using errcode = 'restrict_violation';
  end if;

  return case when tg_op = 'DELETE' then old else new end;
end $$;

create trigger t_guard_system_workout before update or delete on workout_templates
  for each row execute function im_guard_system_content();
create trigger t_guard_system_exercise before update or delete on strength_exercises
  for each row execute function im_guard_system_content();
create trigger t_guard_system_strength before update or delete on strength_templates
  for each row execute function im_guard_system_content();


-- ============================================================
-- SYSTEM SEED
--
-- The content that shipped as TypeScript constants, migrated in as immutable
-- system library items. Those constants are deleted in the same change: two
-- sources of the same material would drift, and the drift would be silent.
--
-- System items have no owner and cannot be edited or deleted by anyone. A
-- coach who wants a variation duplicates one; the copy is theirs.
-- ============================================================

-- Generated from the shipped TypeScript libraries. Do not hand-edit;
-- regenerate if the seed content ever needs to change.

insert into workout_templates (id, owner_id, visibility, name, category, type, basis, intensity,
  distance_km, duration_minutes, pace_min_sec_km, pace_max_sec_km, hr_zone, rpe_target,
  warm_up, main_set, cool_down, purpose, tags) values
  ('00000000-0000-4000-8000-000000000001', null, 'system', 'Easy Run', 'easy', 'easy_run', 'distance', 'easy', 8, 50, null, null, 2, 3, null, 'Continuous easy running. Conversational the whole way.', null, 'If you cannot speak in full sentences, you are going too hard.', array['easy','distance']),
  ('00000000-0000-4000-8000-000000000002', null, 'system', 'Recovery Run', 'recovery', 'recovery_run', 'time', 'recovery', 6, 35, null, null, 1, 2, null, 'Very easy. Flat route. Shorter than it feels like it should be.', null, 'The point is blood flow, not fitness.', array['recovery','time']),
  ('00000000-0000-4000-8000-000000000003', null, 'system', 'Long Run', 'long_run', 'long_run', 'distance', 'easy', 22, 135, null, null, 2, 4, 'First 15 minutes deliberately slower than target.', 'Steady, controlled effort. Practise race-day fuelling.', '10 minutes easy walking.', 'Fuel early. Start controlled. Finish stronger than you started.', array['easy','distance']),
  ('00000000-0000-4000-8000-000000000004', null, 'system', 'Progression Run', 'progression', 'progression_run', 'distance', 'steady', 14, 75, null, null, null, 6, null, 'Three equal thirds: easy, steady, then marathon effort.', null, 'Negative split or it does not count.', array['steady','distance']),
  ('00000000-0000-4000-8000-000000000005', null, 'system', 'Tempo', 'tempo', 'tempo', 'time', 'hard', 12, 60, null, null, 4, 7, '15 min easy + 4 x 20s strides.', '25 minutes continuous at comfortably hard. You could hold it for an hour on race day.', '12 min easy.', null, array['hard','time']),
  ('00000000-0000-4000-8000-000000000006', null, 'system', 'Threshold Intervals', 'threshold', 'threshold', 'time', 'hard', 13, 65, null, null, 4, 8, '15 min easy + drills + 4 x 20s strides.', '6 x 5 min at threshold, 90s easy jog between.', '12 min easy.', 'Controlled discomfort, not a race. Same pace on the last rep as the first.', array['hard','time']),
  ('00000000-0000-4000-8000-000000000007', null, 'system', 'VO2 Intervals', 'intervals', 'intervals', 'time', 'max', 12, 60, null, null, 5, 9, '15 min easy + drills + 4 x 100m strides.', '5 x 3 min hard, 3 min easy jog recovery.', '12 min easy.', null, array['max','time']),
  ('00000000-0000-4000-8000-000000000008', null, 'system', 'Hill Repeats', 'hills', 'hills', 'time', 'hard', 11, 55, null, null, null, 8, '15 min easy to the hill.', '8 x 60s uphill at hard effort. Jog down as recovery.', '12 min easy.', 'Strength in disguise. Tall posture, quick feet.', array['hard','time']),
  ('00000000-0000-4000-8000-000000000009', null, 'system', 'Race Pace', 'race_specific', 'race_pace', 'pace', 'steady', 16, 85, null, null, null, 6, '15 min easy.', '3 x 15 min at goal race pace, 3 min float between.', '10 min easy.', 'Rehearsal, not a test.', array['steady','pace']),
  ('00000000-0000-4000-8000-000000000010', null, 'system', 'Brick Session', 'race_specific', 'brick', 'time', 'steady', null, 90, null, null, null, 6, null, '60 min bike at steady effort, straight into 25 min run off the bike.', null, 'The first 10 minutes off the bike always feel wrong. Run through it.', array['steady','time']),
  ('00000000-0000-4000-8000-000000000011', null, 'system', 'Bike — Endurance', 'cross_training', 'bike', 'time', 'easy', null, 90, null, null, 2, 4, null, 'Steady aerobic riding. Smooth cadence, 85–95rpm.', null, null, array['easy','time']),
  ('00000000-0000-4000-8000-000000000012', null, 'system', 'Swim — Technique + Endurance', 'cross_training', 'swim', 'time', 'steady', null, 45, null, null, null, 5, '400m mixed.', '8 x 100m steady, 20s rest. Focus on catch.', '200m easy.', null, array['steady','time']),
  ('00000000-0000-4000-8000-000000000013', null, 'system', 'Cross Training', 'cross_training', 'cross_training', 'time', 'easy', null, 45, null, null, 2, 4, null, 'Low-impact aerobic work — bike, row, elliptical or pool.', null, 'Aerobic stimulus without the pounding.', array['easy','time']),
  ('00000000-0000-4000-8000-000000000014', null, 'system', 'Mobility', 'mobility', 'mobility', 'time', 'recovery', null, 20, null, null, null, 1, null, 'Hips, ankles, thoracic spine. Slow and unhurried.', null, null, array['recovery','time']),
  ('00000000-0000-4000-8000-000000000015', null, 'system', 'Rest', 'rest', 'rest', 'time', 'rest', null, null, null, null, null, null, null, 'Complete rest. This is a session — treat it like one.', null, 'Adaptation happens here, not in the session you skipped it for.', array['rest','time']),
  ('00000000-0000-4000-8000-000000000016', null, 'system', 'Race Day', 'race', 'race', 'distance', 'max', null, null, null, null, null, 10, null, 'Execute the plan. Nothing new on race day.', null, 'The work is done. Trust it.', array['max','distance']);

insert into strength_exercises (id, owner_id, visibility, name, category, movement_pattern,
  muscle_groups, video_url, cues, regressions, progressions, equipment, is_unilateral, tags) values
  ('00000000-0000-4000-8001-000000000001', null, 'system', 'Rear-Foot Elevated Split Squat', 'lunge', 'lunge', array['Quads','Glutes','Adductors'], null, array['Front shin vertical at the bottom','Ribs down, do not arch','Drive through the whole front foot'], array['Split squat, both feet on the floor','Hold a rail for balance'], array['Add dumbbells','Slow 3-second lower','Deficit front foot'], array['Bench','Dumbbells'], true, array['lunge']),
  ('00000000-0000-4000-8001-000000000002', null, 'system', 'Single-Leg Romanian Deadlift', 'hinge', 'hinge', array['Hamstrings','Glutes','Spinal erectors'], null, array['Hinge from the hip, not the spine','Hips stay square to the floor','Stop when the hamstring tightens'], array['Hold a wall','Kickstand stance'], array['Single dumbbell contralateral','Add a pause at the bottom'], array['Dumbbell'], true, array['hinge']),
  ('00000000-0000-4000-8001-000000000003', null, 'system', 'Trap-Bar Deadlift', 'hinge', 'hinge', array['Glutes','Hamstrings','Quads','Back'], null, array['Push the floor away','Lats tight, chest proud','Same bar path down as up'], array['Elevated blocks','Kettlebell deadlift'], array['Add load','Tempo eccentric'], array['Trap bar','Plates'], false, array['hinge']),
  ('00000000-0000-4000-8001-000000000004', null, 'system', 'Straight-Leg Calf Raise', 'push', 'push', array['Gastrocnemius','Achilles'], null, array['Full range — heel below the step','Two seconds down','No bouncing out of the bottom'], array['Both legs','Floor instead of a step'], array['Single leg','Add a dumbbell','Add a 3s isometric at the top'], array['Step'], false, array['push']),
  ('00000000-0000-4000-8001-000000000005', null, 'system', 'Bent-Knee Calf Raise', 'push', 'push', array['Soleus','Achilles'], null, array['Knee bent to about 30 degrees','Slow and honest','This is the one runners skip'], array['Seated, bodyweight'], array['Seated with load across the knee'], array['Step','Dumbbell'], false, array['push']),
  ('00000000-0000-4000-8001-000000000006', null, 'system', 'Copenhagen Plank', 'core', 'core', array['Adductors','Obliques'], null, array['Top leg drives down into the bench','Body in one line','Stop before it shakes'], array['Short lever — knee on the bench'], array['Full length','Add reps of top-leg raises'], array['Bench'], true, array['core']),
  ('00000000-0000-4000-8001-000000000007', null, 'system', 'Side Plank with Top-Leg Raise', 'core', 'core', array['Glute medius','Obliques'], null, array['Stack the hips','Lift from the glute, not the hip flexor'], array['Knees bent','No leg raise'], array['Add a hold at the top','Feet elevated'], '{}', true, array['core']),
  ('00000000-0000-4000-8001-000000000008', null, 'system', 'Dead Bug', 'core', 'core', array['Deep core','Hip flexors'], null, array['Lower back stays flat to the floor','Exhale as the limbs extend','Slow beats far'], array['Arms only','Legs only'], array['Add a band','Extend the tempo'], '{}', false, array['core']),
  ('00000000-0000-4000-8001-000000000009', null, 'system', 'Loaded Step-Up', 'lunge', 'lunge', array['Glutes','Quads'], null, array['No push off the trailing foot','Control the way down','Knee tracks over the second toe'], array['Lower box','Bodyweight'], array['Higher box','Dumbbells','Slow eccentric'], array['Box','Dumbbells'], true, array['lunge']),
  ('00000000-0000-4000-8001-000000000010', null, 'system', 'Barbell Hip Thrust', 'hinge', 'hinge', array['Glutes','Hamstrings'], null, array['Chin tucked, ribs down','Finish with the glutes, not the lower back','Pause at the top'], array['Bodyweight glute bridge','Single-leg bridge'], array['Add load','Pause reps'], array['Barbell','Bench'], false, array['hinge']),
  ('00000000-0000-4000-8001-000000000011', null, 'system', 'Pogo Hops', 'plyometric', 'plyometric', array['Calves','Achilles','Foot'], null, array['Stiff ankle, quiet landing','Minimal knee bend','Off the ground fast'], array['Two feet, low amplitude'], array['Single leg','Lateral pogos'], '{}', false, array['plyometric']),
  ('00000000-0000-4000-8001-000000000012', null, 'system', 'Box Jump (step down)', 'plyometric', 'plyometric', array['Glutes','Quads','Calves'], null, array['Land soft and tall','Always step down, never jump down','Quality over height'], array['Low box','Squat jump to the floor'], array['Higher box','Single-leg landings'], array['Box'], false, array['plyometric']),
  ('00000000-0000-4000-8001-000000000013', null, 'system', 'Pull-Up', 'pull', 'pull', array['Lats','Biceps','Mid-back'], null, array['Start from a dead hang','Chest to the bar','No kipping'], array['Band assisted','Inverted row'], array['Weighted','Slow eccentric'], array['Pull-up bar'], false, array['pull']),
  ('00000000-0000-4000-8001-000000000014', null, 'system', 'Single-Arm Dumbbell Row', 'pull', 'pull', array['Lats','Rhomboids'], null, array['Pull to the hip, not the armpit','Torso stays still','Full stretch at the bottom'], array['Chest-supported row'], array['Add load','Pause at the top'], array['Dumbbell','Bench'], false, array['pull']),
  ('00000000-0000-4000-8001-000000000015', null, 'system', 'Push-Up', 'push', 'push', array['Chest','Triceps','Core'], null, array['Body in one line','Elbows at 45 degrees','Full lockout'], array['Hands elevated'], array['Feet elevated','Weighted','Tempo'], '{}', false, array['push']),
  ('00000000-0000-4000-8001-000000000016', null, 'system', 'Farmer Carry', 'carry', 'carry', array['Grip','Core','Traps'], null, array['Tall posture, shoulders down','Walk normally','Do not lean away from the load'], array['Lighter load, shorter distance'], array['Suitcase carry (one side)','Longer carries'], array['Dumbbells','Kettlebells'], false, array['carry']),
  ('00000000-0000-4000-8001-000000000017', null, 'system', 'Hip Airplane', 'mobility', 'mobility', array['Glutes','Hip rotators'], null, array['Rotate from the hip, not the spine','Slow through the whole range','Balance is the point'], array['Hold a wall'], array['No support','Pause at end range'], '{}', true, array['mobility']),
  ('00000000-0000-4000-8001-000000000018', null, 'system', 'Half-Kneeling Ankle Rocks', 'mobility', 'mobility', array['Ankle','Calf'], null, array['Heel stays down','Knee travels over the second toe','Small, repeated, painless'], array['Reduce the range'], array['Elevate the toes'], '{}', false, array['mobility']),
  ('00000000-0000-4000-8001-000000000019', null, 'system', 'Nordic Hamstring Curl (eccentric)', 'hinge', 'hinge', array['Hamstrings'], null, array['Hips stay extended — no piking','Resist as long as you can','Push back up with the hands'], array['Band assisted','Short range'], array['Full range','Slow the descent further'], array['Partner or anchor'], false, array['hinge']),
  ('00000000-0000-4000-8001-000000000020', null, 'system', 'Goblet Squat', 'squat', 'squat', array['Quads','Glutes','Core'], null, array['Elbows inside the knees','Sit between the hips','Heels stay down'], array['Box squat','Bodyweight'], array['Front squat','Tempo','Add load'], array['Kettlebell','Dumbbell'], false, array['squat']);

insert into strength_templates (id, owner_id, visibility, name, category, description, estimated_minutes, tags) values
  ('00000000-0000-4000-8002-000000000001', null, 'system', 'Foundation A', 'foundation', 'Bilateral strength and posterior chain. The base everything else is built on. Leave two reps in reserve on every set.', 45, array['foundation']),
  ('00000000-0000-4000-8002-000000000002', null, 'system', 'Foundation B', 'foundation', 'Single-leg strength and lateral control. This is the session that keeps you on the road.', 45, array['foundation']),
  ('00000000-0000-4000-8002-000000000003', null, 'system', 'Performance A', 'performance', 'Heavier, faster, lower volume. Run this in a build block when the legs can take it.', 55, array['performance']),
  ('00000000-0000-4000-8002-000000000004', null, 'system', 'Maintenance', 'maintenance', 'Race week and heavy running weeks. Enough to hold what you built, light enough to leave no trace.', 25, array['maintenance']),
  ('00000000-0000-4000-8002-000000000005', null, 'system', 'Ultra Prep', 'ultra_prep', 'Durability for long time on feet — carries, calves and hip stability at volume. Built for the back half of an ultra.', 50, array['ultra_prep']),
  ('00000000-0000-4000-8002-000000000006', null, 'system', 'Triathlon Support', 'triathlon_support', 'Upper-body pulling for the swim, hip strength for the bike, and enough legs to run off it.', 45, array['triathlon_support']);

insert into template_components (strength_template_id, position, kind, label,
  strength_exercise_id, sets, reps, tempo, rest_seconds, rpe_target, notes) values
  ('00000000-0000-4000-8002-000000000001', 0, 'exercise', 'Half-Kneeling Ankle Rocks', '00000000-0000-4000-8001-000000000018', 2, '10 each', null, 30, null, 'Warm-up'),
  ('00000000-0000-4000-8002-000000000001', 1, 'exercise', 'Trap-Bar Deadlift', '00000000-0000-4000-8001-000000000003', 4, '6', '2-0-1', 150, 7, 'Leave two in the tank.'),
  ('00000000-0000-4000-8002-000000000001', 2, 'exercise', 'Goblet Squat', '00000000-0000-4000-8001-000000000020', 3, '8', '3-1-1', 120, 7, null),
  ('00000000-0000-4000-8002-000000000001', 3, 'exercise', 'Straight-Leg Calf Raise', '00000000-0000-4000-8001-000000000004', 3, '12 each', '2-1-2', 75, 7, 'Full range below the step.'),
  ('00000000-0000-4000-8002-000000000001', 4, 'exercise', 'Single-Arm Dumbbell Row', '00000000-0000-4000-8001-000000000014', 3, '10 each', null, 75, 7, null),
  ('00000000-0000-4000-8002-000000000001', 5, 'exercise', 'Dead Bug', '00000000-0000-4000-8001-000000000008', 3, '8 each', 'slow', 45, null, 'Lower back flat throughout.'),
  ('00000000-0000-4000-8002-000000000002', 0, 'exercise', 'Hip Airplane', '00000000-0000-4000-8001-000000000017', 2, '6 each', null, 30, null, 'Warm-up'),
  ('00000000-0000-4000-8002-000000000002', 1, 'exercise', 'Rear-Foot Elevated Split Squat', '00000000-0000-4000-8001-000000000001', 3, '8 each', '3-0-1', 120, 7, null),
  ('00000000-0000-4000-8002-000000000002', 2, 'exercise', 'Single-Leg Romanian Deadlift', '00000000-0000-4000-8001-000000000002', 3, '8 each', '3-1-1', 90, 7, 'Hips square. Stop where control stops.'),
  ('00000000-0000-4000-8002-000000000002', 3, 'exercise', 'Copenhagen Plank', '00000000-0000-4000-8001-000000000006', 3, '20s each', null, 60, null, 'Short lever if the long one shakes.'),
  ('00000000-0000-4000-8002-000000000002', 4, 'exercise', 'Bent-Knee Calf Raise', '00000000-0000-4000-8001-000000000005', 3, '15 each', '2-0-2', 60, 7, 'Soleus. Do not skip this.'),
  ('00000000-0000-4000-8002-000000000002', 5, 'exercise', 'Side Plank with Top-Leg Raise', '00000000-0000-4000-8001-000000000007', 2, '8 each', null, 45, null, null),
  ('00000000-0000-4000-8002-000000000003', 0, 'exercise', 'Pogo Hops', '00000000-0000-4000-8001-000000000011', 3, '20', null, 60, null, 'Quiet and stiff.'),
  ('00000000-0000-4000-8002-000000000003', 1, 'exercise', 'Trap-Bar Deadlift', '00000000-0000-4000-8001-000000000003', 5, '3', '2-0-X', 180, 8, 'Intent on the way up.'),
  ('00000000-0000-4000-8002-000000000003', 2, 'exercise', 'Box Jump (step down)', '00000000-0000-4000-8001-000000000012', 4, '4', null, 120, null, 'Step down every rep.'),
  ('00000000-0000-4000-8002-000000000003', 3, 'exercise', 'Barbell Hip Thrust', '00000000-0000-4000-8001-000000000010', 3, '8', '2-1-1', 120, 8, null),
  ('00000000-0000-4000-8002-000000000003', 4, 'exercise', 'Nordic Hamstring Curl (eccentric)', '00000000-0000-4000-8001-000000000019', 3, '5', 'slow eccentric', 120, 8, 'Expect soreness the first few weeks.'),
  ('00000000-0000-4000-8002-000000000003', 5, 'exercise', 'Farmer Carry', '00000000-0000-4000-8001-000000000016', 3, '40m', null, 90, 7, null),
  ('00000000-0000-4000-8002-000000000004', 0, 'exercise', 'Goblet Squat', '00000000-0000-4000-8001-000000000020', 2, '8', null, 60, 5, 'Light.'),
  ('00000000-0000-4000-8002-000000000004', 1, 'exercise', 'Single-Leg Romanian Deadlift', '00000000-0000-4000-8001-000000000002', 2, '8 each', null, 60, 5, null),
  ('00000000-0000-4000-8002-000000000004', 2, 'exercise', 'Straight-Leg Calf Raise', '00000000-0000-4000-8001-000000000004', 2, '12 each', null, 60, 5, null),
  ('00000000-0000-4000-8002-000000000004', 3, 'exercise', 'Dead Bug', '00000000-0000-4000-8001-000000000008', 2, '8 each', null, 45, null, null),
  ('00000000-0000-4000-8002-000000000005', 0, 'exercise', 'Loaded Step-Up', '00000000-0000-4000-8001-000000000009', 4, '10 each', '2-0-2', 90, 7, 'Downhill legs.'),
  ('00000000-0000-4000-8002-000000000005', 1, 'exercise', 'Single-Leg Romanian Deadlift', '00000000-0000-4000-8001-000000000002', 3, '10 each', '3-0-1', 90, 7, null),
  ('00000000-0000-4000-8002-000000000005', 2, 'exercise', 'Bent-Knee Calf Raise', '00000000-0000-4000-8001-000000000005', 4, '20 each', '2-0-2', 75, 7, 'Volume matters more than load here.'),
  ('00000000-0000-4000-8002-000000000005', 3, 'exercise', 'Farmer Carry', '00000000-0000-4000-8001-000000000016', 4, '60m', null, 90, 7, 'Posture under fatigue.'),
  ('00000000-0000-4000-8002-000000000005', 4, 'exercise', 'Copenhagen Plank', '00000000-0000-4000-8001-000000000006', 3, '25s each', null, 60, null, null),
  ('00000000-0000-4000-8002-000000000005', 5, 'exercise', 'Side Plank with Top-Leg Raise', '00000000-0000-4000-8001-000000000007', 3, '10 each', null, 45, null, null),
  ('00000000-0000-4000-8002-000000000006', 0, 'exercise', 'Pull-Up', '00000000-0000-4000-8001-000000000013', 4, '5', '2-1-1', 120, 8, 'Band assist if needed.'),
  ('00000000-0000-4000-8002-000000000006', 1, 'exercise', 'Single-Arm Dumbbell Row', '00000000-0000-4000-8001-000000000014', 3, '10 each', null, 75, 7, null),
  ('00000000-0000-4000-8002-000000000006', 2, 'exercise', 'Barbell Hip Thrust', '00000000-0000-4000-8001-000000000010', 3, '10', '2-1-1', 90, 7, 'Bike power.'),
  ('00000000-0000-4000-8002-000000000006', 3, 'exercise', 'Push-Up', '00000000-0000-4000-8001-000000000015', 3, '12', null, 60, 7, null),
  ('00000000-0000-4000-8002-000000000006', 4, 'exercise', 'Rear-Foot Elevated Split Squat', '00000000-0000-4000-8001-000000000001', 3, '8 each', null, 90, 7, null),
  ('00000000-0000-4000-8002-000000000006', 5, 'exercise', 'Dead Bug', '00000000-0000-4000-8001-000000000008', 2, '10 each', null, 45, null, null);

-- ============================================================
-- TEMPLATE → LIVE ATHLETE SESSION
--
-- The critical workflow, and the one place a mistake would be expensive.
--
-- Insertion COPIES. The new session records where it came from
-- (source_workout_template_id / source_strength_template_id) so provenance can
-- always be answered, but it holds no live link: editing the template later
-- cannot reach into a prescription an athlete has already been given, and
-- editing the athlete's session never writes back to the library.
--
-- Both functions re-check authorisation themselves — they are security definer
-- and must not assume the caller was vetted.
-- ============================================================

create or replace function im_insert_workout_template(
  p_template uuid,
  p_athlete  uuid,
  p_date     date,
  p_slot     smallint default 0
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  tpl     workout_templates;
  v_week  uuid;
  v_prog  uuid;
  v_id    uuid;
begin
  select * into tpl from workout_templates where id = p_template;
  if tpl is null then raise exception 'template not found'; end if;
  if not im_can_read_library(tpl.visibility, tpl.owner_id) then
    raise exception 'not authorised to use that template';
  end if;
  if tpl.archived_at is not null then
    raise exception 'that template is archived — restore it before prescribing from it';
  end if;
  if not (im_is_coach_of(p_athlete) or im_is_admin()) then
    raise exception 'not authorised for this athlete';
  end if;

  select w.id, w.program_id into v_week, v_prog
    from program_weeks w
   where w.athlete_id = p_athlete
     and p_date >= w.start_date and p_date < w.start_date + 7
   limit 1;

  insert into scheduled_workouts (
    program_id, program_week_id, athlete_id, date, slot, status,
    name, type, basis, intensity, distance_km, duration_minutes,
    pace_min_sec_km, pace_max_sec_km, hr_zone, rpe_target,
    warm_up, main_set, cool_down, notes, coach_note,
    source_workout_template_id, prescribed_by
  )
  values (
    v_prog, v_week, p_athlete, p_date, p_slot, 'scheduled',
    tpl.name, tpl.type, tpl.basis, tpl.intensity, tpl.distance_km, tpl.duration_minutes,
    tpl.pace_min_sec_km, tpl.pace_max_sec_km, tpl.hr_zone, tpl.rpe_target,
    tpl.warm_up, tpl.main_set, tpl.cool_down, tpl.purpose, tpl.coach_notes,
    tpl.id, auth.uid()
  )
  on conflict (athlete_id, date, slot) do update
    set name = excluded.name, type = excluded.type, basis = excluded.basis,
        intensity = excluded.intensity, distance_km = excluded.distance_km,
        duration_minutes = excluded.duration_minutes,
        pace_min_sec_km = excluded.pace_min_sec_km, pace_max_sec_km = excluded.pace_max_sec_km,
        hr_zone = excluded.hr_zone, rpe_target = excluded.rpe_target,
        warm_up = excluded.warm_up, main_set = excluded.main_set, cool_down = excluded.cool_down,
        notes = excluded.notes, coach_note = excluded.coach_note,
        source_workout_template_id = excluded.source_workout_template_id,
        program_week_id = excluded.program_week_id
  returning id into v_id;

  -- components are copied, not referenced
  delete from session_components where scheduled_workout_id = v_id;
  insert into session_components (
    scheduled_workout_id, athlete_id, position, kind, label, notes, repeats, rpe_target,
    distance_km, duration_seconds, pace_min_sec_km, pace_max_sec_km, hr_zone,
    recovery_seconds, recovery_description,
    strength_exercise_id, sets, reps, load_prescription, tempo, rest_seconds
  )
  select
    v_id, p_athlete, c.position, c.kind, c.label, c.notes, c.repeats, c.rpe_target,
    c.distance_km, c.duration_seconds, c.pace_min_sec_km, c.pace_max_sec_km, c.hr_zone,
    c.recovery_seconds, c.recovery_description,
    c.strength_exercise_id, c.sets, c.reps, c.load_prescription, c.tempo, c.rest_seconds
  from template_components c
  where c.workout_template_id = p_template
  order by c.position;

  return v_id;
end $$;

create or replace function im_insert_strength_template(
  p_template uuid,
  p_athlete  uuid,
  p_date     date,
  p_slot     smallint default 1
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  tpl    strength_templates;
  v_week uuid;
  v_prog uuid;
  v_id   uuid;
begin
  select * into tpl from strength_templates where id = p_template;
  if tpl is null then raise exception 'template not found'; end if;
  if not im_can_read_library(tpl.visibility, tpl.owner_id) then
    raise exception 'not authorised to use that template';
  end if;
  if tpl.archived_at is not null then
    raise exception 'that template is archived — restore it before prescribing from it';
  end if;
  if not (im_is_coach_of(p_athlete) or im_is_admin()) then
    raise exception 'not authorised for this athlete';
  end if;

  select w.id, w.program_id into v_week, v_prog
    from program_weeks w
   where w.athlete_id = p_athlete
     and p_date >= w.start_date and p_date < w.start_date + 7
   limit 1;

  insert into scheduled_workouts (
    program_id, program_week_id, athlete_id, date, slot, status,
    name, type, basis, intensity, duration_minutes, notes,
    strength_template_id, source_strength_template_id, prescribed_by
  )
  values (
    v_prog, v_week, p_athlete, p_date, p_slot, 'scheduled',
    tpl.name, 'strength', 'time', 'steady', tpl.estimated_minutes, tpl.description,
    tpl.id, tpl.id, auth.uid()
  )
  on conflict (athlete_id, date, slot) do update
    set name = excluded.name, type = excluded.type, basis = excluded.basis,
        intensity = excluded.intensity, duration_minutes = excluded.duration_minutes,
        notes = excluded.notes, strength_template_id = excluded.strength_template_id,
        source_strength_template_id = excluded.source_strength_template_id,
        program_week_id = excluded.program_week_id
  returning id into v_id;

  delete from session_components where scheduled_workout_id = v_id;
  insert into session_components (
    scheduled_workout_id, athlete_id, position, kind, label, notes, repeats, rpe_target,
    strength_exercise_id, sets, reps, load_prescription, tempo, rest_seconds
  )
  select
    v_id, p_athlete, c.position, c.kind, c.label, c.notes, c.repeats, c.rpe_target,
    c.strength_exercise_id, c.sets, c.reps, c.load_prescription, c.tempo, c.rest_seconds
  from template_components c
  where c.strength_template_id = p_template
  order by c.position;

  return v_id;
end $$;

-- ---------- duplicate a library item ----------
-- Duplication is how a coach adapts anything, including system content: the
-- copy is theirs, private by default, and unlinked from the original.
create or replace function im_duplicate_workout_template(p_template uuid, p_name text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  tpl workout_templates;
  v_id uuid;
begin
  select * into tpl from workout_templates where id = p_template;
  if tpl is null then raise exception 'template not found'; end if;
  if not im_can_read_library(tpl.visibility, tpl.owner_id) then
    raise exception 'not authorised to use that template';
  end if;

  insert into workout_templates (
    owner_id, visibility, name, category, type, basis, intensity,
    distance_km, duration_minutes, pace_min_sec_km, pace_max_sec_km, hr_zone, rpe_target,
    warm_up, main_set, cool_down, notes, purpose, coach_notes, tags
  )
  values (
    auth.uid(), 'private', coalesce(p_name, tpl.name || ' (copy)'), tpl.category, tpl.type,
    tpl.basis, tpl.intensity, tpl.distance_km, tpl.duration_minutes,
    tpl.pace_min_sec_km, tpl.pace_max_sec_km, tpl.hr_zone, tpl.rpe_target,
    tpl.warm_up, tpl.main_set, tpl.cool_down, tpl.notes, tpl.purpose, tpl.coach_notes, tpl.tags
  )
  returning id into v_id;

  insert into template_components (
    workout_template_id, position, kind, label, notes, repeats, rpe_target,
    distance_km, duration_seconds, pace_min_sec_km, pace_max_sec_km, hr_zone,
    recovery_seconds, recovery_description, strength_exercise_id, sets, reps,
    load_prescription, tempo, rest_seconds
  )
  select
    v_id, c.position, c.kind, c.label, c.notes, c.repeats, c.rpe_target,
    c.distance_km, c.duration_seconds, c.pace_min_sec_km, c.pace_max_sec_km, c.hr_zone,
    c.recovery_seconds, c.recovery_description, c.strength_exercise_id, c.sets, c.reps,
    c.load_prescription, c.tempo, c.rest_seconds
  from template_components c where c.workout_template_id = p_template;

  return v_id;
end $$;

create or replace function im_duplicate_strength_template(p_template uuid, p_name text default null)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  tpl strength_templates;
  v_id uuid;
begin
  select * into tpl from strength_templates where id = p_template;
  if tpl is null then raise exception 'template not found'; end if;
  if not im_can_read_library(tpl.visibility, tpl.owner_id) then
    raise exception 'not authorised to use that template';
  end if;

  insert into strength_templates (
    owner_id, visibility, name, category, description, estimated_minutes, purpose, coach_notes, tags
  )
  values (
    auth.uid(), 'private', coalesce(p_name, tpl.name || ' (copy)'), tpl.category,
    tpl.description, tpl.estimated_minutes, tpl.purpose, tpl.coach_notes, tpl.tags
  )
  returning id into v_id;

  insert into template_components (
    strength_template_id, position, kind, label, notes, repeats, rpe_target,
    strength_exercise_id, sets, reps, load_prescription, tempo, rest_seconds
  )
  select
    v_id, c.position, c.kind, c.label, c.notes, c.repeats, c.rpe_target,
    c.strength_exercise_id, c.sets, c.reps, c.load_prescription, c.tempo, c.rest_seconds
  from template_components c where c.strength_template_id = p_template;

  return v_id;
end $$;

-- ---------- what a week actually prescribes ----------
-- target_volume_km is the coach's intent; this is what they in fact wrote.
-- The gap between the two is information, so it is surfaced and never blocks a
-- save.
create or replace function im_week_volume(p_week uuid)
returns table (prescribed_km numeric, target_km numeric, session_count integer)
language sql stable security definer set search_path = public as $$
  select
    coalesce(sum(s.distance_km), 0)::numeric as prescribed_km,
    max(w.target_volume_km)::numeric          as target_km,
    count(s.id)::integer                      as session_count
  from program_weeks w
  left join scheduled_workouts s on s.program_week_id = w.id
  where w.id = p_week
    and im_can_read_athlete(w.athlete_id);
$$;


-- Programme templates: the frames a coach starts a new athlete from. Seeded as
-- system content for the same reason the sessions are — one source, not two.
insert into program_templates (id, owner_id, visibility, name, goal_type, weeks, description) values
  ('00000000-0000-4000-8001-000000000001', null, 'system', '5K — Sharpen', '5k', 8, 'Eight weeks around one hard session and one sharpening session per week. Built for someone who already runs three or four times a week.'),
  ('00000000-0000-4000-8001-000000000002', null, 'system', '10K — Build', '10k', 10, 'Threshold-led ten-week block. Enough volume to hold the pace, enough speed to find it.'),
  ('00000000-0000-4000-8001-000000000003', null, 'system', 'Half Marathon — Foundation to Start Line', 'half_marathon', 14, 'Fourteen weeks. Long run progression, one quality session, two strength sessions a week throughout.'),
  ('00000000-0000-4000-8001-000000000004', null, 'system', 'Marathon — The Long Way', 'marathon', 18, 'Eighteen weeks with three build blocks and a three-week taper. Race-pace work lives in the long run, where it belongs.'),
  ('00000000-0000-4000-8001-000000000005', null, 'system', 'Ultra — Time on Feet', 'ultra', 24, 'Twenty-four weeks built around back-to-back long runs, terrain specificity and durability work. Volume rises slowly and steps back every fourth week.'),
  ('00000000-0000-4000-8001-000000000006', null, 'system', '70.3 — Three Disciplines', 'triathlon_70_3', 20, 'Twenty weeks balancing swim, bike and run with weekly brick work and triathlon-specific strength.'),
  ('00000000-0000-4000-8001-000000000007', null, 'system', 'General Endurance', 'general_endurance', 12, 'No start line yet. Aerobic base, consistent strength, and the habit of showing up. The best place to begin.')
on conflict (id) do nothing;

-- ======================= 0007_phase_vocabulary.sql =======================

-- ============================================================
-- 0007 — PHASE VOCABULARY
--
-- Programme templates need the phases coaches actually name: a specific
-- block, a peak, a taper, a return-to-running progression, and a custom
-- escape hatch for the ones that fit no standard shape.
--
-- This sits in its own migration because Postgres will not let a newly
-- added enum value be used in the transaction that adds it. 0008 consumes
-- these; adding them here is what makes that legal.
-- ============================================================

alter type im_phase add value if not exists 'specific' after 'build';
alter type im_phase add value if not exists 'peak';
alter type im_phase add value if not exists 'taper';
alter type im_phase add value if not exists 'return';
alter type im_phase add value if not exists 'custom';

-- ======================= 0008_programme_templates.sql =======================

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

-- ======================= 0009_programme_seed.sql =======================

-- Generated by scripts/generate-programme-seed.mjs — do not hand-edit.
--
-- The shipped programme templates, as real structures. Each states the
-- training frequency it was written for, so "this is a four-day programme"
-- is a fact about the template rather than something a coach counts.

update program_templates set discipline = 'running', experience_level = 'beginner'::im_experience, min_days_per_week = 4, max_days_per_week = 4, target_distance_km = null, purpose = 'No start line yet. Aerobic base, consistent strength, and the habit of showing up.', weeks = 12 where id = '00000000-0000-4000-8001-000000000007';
update program_templates set discipline = 'running', experience_level = 'developing'::im_experience, min_days_per_week = 3, max_days_per_week = 6, target_distance_km = 5, purpose = 'Eight weeks around one hard session and one sharpening session per week.', weeks = 8 where id = '00000000-0000-4000-8001-000000000001';
update program_templates set discipline = 'running', experience_level = 'developing'::im_experience, min_days_per_week = 4, max_days_per_week = 6, target_distance_km = 10, purpose = 'Threshold-led ten-week block. Enough volume to hold the pace, enough speed to find it.', weeks = 10 where id = '00000000-0000-4000-8001-000000000002';
update program_templates set discipline = 'running', experience_level = 'developing'::im_experience, min_days_per_week = 3, max_days_per_week = 6, target_distance_km = 21.1, purpose = 'Fourteen weeks. Long run progression, one quality session, two strength sessions a week throughout.', weeks = 14 where id = '00000000-0000-4000-8001-000000000003';
update program_templates set discipline = 'running', experience_level = 'experienced'::im_experience, min_days_per_week = 4, max_days_per_week = 6, target_distance_km = 42.2, purpose = 'Eighteen weeks with three build blocks and a three-week taper. Race-pace work lives in the long run.', weeks = 18 where id = '00000000-0000-4000-8001-000000000004';
update program_templates set discipline = 'trail', experience_level = 'experienced'::im_experience, min_days_per_week = 4, max_days_per_week = 6, target_distance_km = 50, purpose = 'Back-to-back long runs, terrain specificity and durability work. Volume rises slowly and steps back every fourth week.', weeks = 24 where id = '00000000-0000-4000-8001-000000000005';
update program_templates set discipline = 'triathlon', experience_level = 'experienced'::im_experience, min_days_per_week = 5, max_days_per_week = 6, target_distance_km = 113, purpose = 'Twenty weeks balancing swim, bike and run with weekly brick work and triathlon-specific strength.', weeks = 20 where id = '00000000-0000-4000-8001-000000000006';

insert into program_template_blocks (id, program_template_id, block_index, name, phase, focus, description) values
  ('00000000-0000-4000-8002-000000000001', '00000000-0000-4000-8001-000000000007', 0, 'Foundation', 'base'::im_phase, 'Build the habit before building the volume.', null),
  ('00000000-0000-4000-8002-000100000002', '00000000-0000-4000-8001-000000000007', 1, 'Steady Build', 'build'::im_phase, 'One session with some quality in it. Everything else stays easy.', null),
  ('00000000-0000-4000-8002-000200000003', '00000000-0000-4000-8001-000000000001', 0, 'Base', 'base'::im_phase, null, null),
  ('00000000-0000-4000-8002-000300000004', '00000000-0000-4000-8001-000000000001', 1, 'Sharpen', 'sharpen'::im_phase, 'Race-pace speed on tired legs.', null),
  ('00000000-0000-4000-8002-000400000005', '00000000-0000-4000-8001-000000000001', 2, 'Race Week', 'taper'::im_phase, 'Sharp, not tired.', null),
  ('00000000-0000-4000-8002-000500000006', '00000000-0000-4000-8001-000000000002', 0, 'Base', 'base'::im_phase, null, null),
  ('00000000-0000-4000-8002-000600000007', '00000000-0000-4000-8001-000000000002', 1, 'Build', 'build'::im_phase, 'Hold threshold pace for longer, week on week.', null),
  ('00000000-0000-4000-8002-000700000008', '00000000-0000-4000-8001-000000000002', 2, 'Taper', 'taper'::im_phase, null, null),
  ('00000000-0000-4000-8002-000800000009', '00000000-0000-4000-8001-000000000003', 0, 'Foundation', 'base'::im_phase, null, null),
  ('00000000-0000-4000-8002-000900000010', '00000000-0000-4000-8001-000000000003', 1, 'Build', 'build'::im_phase, 'Volume rises. Quality holds.', null),
  ('00000000-0000-4000-8002-001000000011', '00000000-0000-4000-8001-000000000003', 2, 'Race Specific', 'specific'::im_phase, 'Race pace inside the long run, where it belongs.', null),
  ('00000000-0000-4000-8002-001100000012', '00000000-0000-4000-8001-000000000003', 3, 'Taper', 'taper'::im_phase, null, null),
  ('00000000-0000-4000-8002-001200000013', '00000000-0000-4000-8001-000000000004', 0, 'Base', 'base'::im_phase, null, null),
  ('00000000-0000-4000-8002-001300000014', '00000000-0000-4000-8001-000000000004', 1, 'Build', 'build'::im_phase, 'The long run grows. Everything else holds steady.', null),
  ('00000000-0000-4000-8002-001400000015', '00000000-0000-4000-8001-000000000004', 2, 'Race Specific', 'specific'::im_phase, 'Marathon pace on tired legs, inside the long run.', null),
  ('00000000-0000-4000-8002-001500000016', '00000000-0000-4000-8001-000000000004', 3, 'Taper', 'taper'::im_phase, 'Do less. Trust the work.', null),
  ('00000000-0000-4000-8002-001600000017', '00000000-0000-4000-8001-000000000005', 0, 'Base', 'base'::im_phase, null, null),
  ('00000000-0000-4000-8002-001700000018', '00000000-0000-4000-8001-000000000005', 1, 'Build', 'build'::im_phase, 'Back-to-back weekends. Practise eating on the move.', null),
  ('00000000-0000-4000-8002-001800000019', '00000000-0000-4000-8001-000000000005', 2, 'Specific', 'specific'::im_phase, 'Terrain, night running, and the kit you will race in.', null),
  ('00000000-0000-4000-8002-001900000020', '00000000-0000-4000-8001-000000000005', 3, 'Taper', 'taper'::im_phase, null, null),
  ('00000000-0000-4000-8002-002000000021', '00000000-0000-4000-8001-000000000006', 0, 'Base', 'base'::im_phase, 'Three disciplines, one rest day. Even a triathlete stops.', null),
  ('00000000-0000-4000-8002-002100000022', '00000000-0000-4000-8001-000000000006', 1, 'Build', 'build'::im_phase, 'Brick work every week. Get used to running off the bike.', null),
  ('00000000-0000-4000-8002-002200000023', '00000000-0000-4000-8001-000000000006', 2, 'Race Specific', 'specific'::im_phase, null, null),
  ('00000000-0000-4000-8002-002300000024', '00000000-0000-4000-8001-000000000006', 3, 'Taper', 'taper'::im_phase, null, null)
on conflict (id) do nothing;

insert into program_template_weeks (id, program_template_id, block_id, week_index, template_week_no, target_volume_km, is_recovery_week, focus, notes) values
  ('00000000-0000-4000-8003-000000000001', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8002-000000000001', 0, 1, 27, false, 'Build the habit before building the volume.', null),
  ('00000000-0000-4000-8003-000100000002', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8002-000000000001', 1, 2, 29, false, 'Build the habit before building the volume.', null),
  ('00000000-0000-4000-8003-000200000003', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8002-000000000001', 2, 3, 30, false, 'Build the habit before building the volume.', null),
  ('00000000-0000-4000-8003-000300000004', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8002-000000000001', 3, 4, 20, true, 'Build the habit before building the volume.', null),
  ('00000000-0000-4000-8003-000400000005', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8002-000000000001', 4, 5, 32, false, 'Build the habit before building the volume.', null),
  ('00000000-0000-4000-8003-000500000006', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8002-000000000001', 5, 6, 34, false, 'Build the habit before building the volume.', null),
  ('00000000-0000-4000-8003-000600000007', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8002-000100000002', 0, 7, 32, false, 'One session with some quality in it. Everything else stays easy.', null),
  ('00000000-0000-4000-8003-000700000008', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8002-000100000002', 1, 8, 23, true, 'One session with some quality in it. Everything else stays easy.', null),
  ('00000000-0000-4000-8003-000800000009', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8002-000100000002', 2, 9, 35, false, 'One session with some quality in it. Everything else stays easy.', null),
  ('00000000-0000-4000-8003-000900000010', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8002-000100000002', 3, 10, 36, false, 'One session with some quality in it. Everything else stays easy.', null),
  ('00000000-0000-4000-8003-001000000011', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8002-000100000002', 4, 11, 38, false, 'One session with some quality in it. Everything else stays easy.', null),
  ('00000000-0000-4000-8003-001100000012', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8002-000100000002', 5, 12, 23, true, 'One session with some quality in it. Everything else stays easy.', null),
  ('00000000-0000-4000-8003-001200000013', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8002-000200000003', 0, 1, 40, false, null, null),
  ('00000000-0000-4000-8003-001300000014', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8002-000200000003', 1, 2, 42, false, null, null),
  ('00000000-0000-4000-8003-001400000015', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8002-000200000003', 2, 3, 44, false, null, null),
  ('00000000-0000-4000-8003-001500000016', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8002-000300000004', 0, 4, 47, false, 'Race-pace speed on tired legs.', null),
  ('00000000-0000-4000-8003-001600000017', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8002-000300000004', 1, 5, 50, false, 'Race-pace speed on tired legs.', null),
  ('00000000-0000-4000-8003-001700000018', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8002-000300000004', 2, 6, 52, false, 'Race-pace speed on tired legs.', null),
  ('00000000-0000-4000-8003-001800000019', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8002-000300000004', 3, 7, 54, false, 'Race-pace speed on tired legs.', null),
  ('00000000-0000-4000-8003-001900000020', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8002-000400000005', 0, 8, 17, false, 'Sharp, not tired.', null),
  ('00000000-0000-4000-8003-002000000021', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8002-000500000006', 0, 1, 43, false, null, null),
  ('00000000-0000-4000-8003-002100000022', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8002-000500000006', 1, 2, 45, false, null, null),
  ('00000000-0000-4000-8003-002200000023', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8002-000500000006', 2, 3, 47, false, null, null),
  ('00000000-0000-4000-8003-002300000024', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8002-000500000006', 3, 4, 31, true, null, null),
  ('00000000-0000-4000-8003-002400000025', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8002-000600000007', 0, 5, 52, false, 'Hold threshold pace for longer, week on week.', null),
  ('00000000-0000-4000-8003-002500000026', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8002-000600000007', 1, 6, 55, false, 'Hold threshold pace for longer, week on week.', null),
  ('00000000-0000-4000-8003-002600000027', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8002-000600000007', 2, 7, 57, false, 'Hold threshold pace for longer, week on week.', null),
  ('00000000-0000-4000-8003-002700000028', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8002-000600000007', 3, 8, 38, true, 'Hold threshold pace for longer, week on week.', null),
  ('00000000-0000-4000-8003-002800000029', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8002-000700000008', 0, 9, 30, false, null, null),
  ('00000000-0000-4000-8003-002900000030', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8002-000700000008', 1, 10, 32, false, null, null),
  ('00000000-0000-4000-8003-003000000031', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8002-000800000009', 0, 1, 41, false, null, null),
  ('00000000-0000-4000-8003-003100000032', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8002-000800000009', 1, 2, 43, false, null, null),
  ('00000000-0000-4000-8003-003200000033', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8002-000800000009', 2, 3, 45, false, null, null),
  ('00000000-0000-4000-8003-003300000034', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8002-000800000009', 3, 4, 30, true, null, null),
  ('00000000-0000-4000-8003-003400000035', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8002-000800000009', 4, 5, 49, false, null, null),
  ('00000000-0000-4000-8003-003500000036', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8002-000900000010', 0, 6, 46, false, 'Volume rises. Quality holds.', null),
  ('00000000-0000-4000-8003-003600000037', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8002-000900000010', 1, 7, 48, false, 'Volume rises. Quality holds.', null),
  ('00000000-0000-4000-8003-003700000038', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8002-000900000010', 2, 8, 34, true, 'Volume rises. Quality holds.', null),
  ('00000000-0000-4000-8003-003800000039', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8002-000900000010', 3, 9, 53, false, 'Volume rises. Quality holds.', null),
  ('00000000-0000-4000-8003-003900000040', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8002-000900000010', 4, 10, 55, false, 'Volume rises. Quality holds.', null),
  ('00000000-0000-4000-8003-004000000041', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8002-001000000011', 0, 11, 51, false, 'Race pace inside the long run, where it belongs.', null),
  ('00000000-0000-4000-8003-004100000042', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8002-001000000011', 1, 12, 37, true, 'Race pace inside the long run, where it belongs.', null),
  ('00000000-0000-4000-8003-004200000043', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8002-001100000012', 0, 13, 23, false, null, null),
  ('00000000-0000-4000-8003-004300000044', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8002-001100000012', 1, 14, 24, false, null, null),
  ('00000000-0000-4000-8003-004400000045', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001200000013', 0, 1, 49, false, null, null),
  ('00000000-0000-4000-8003-004500000046', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001200000013', 1, 2, 51, false, null, null),
  ('00000000-0000-4000-8003-004600000047', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001200000013', 2, 3, 54, false, null, null),
  ('00000000-0000-4000-8003-004700000048', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001200000013', 3, 4, 36, true, null, null),
  ('00000000-0000-4000-8003-004800000049', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001200000013', 4, 5, 58, false, null, null),
  ('00000000-0000-4000-8003-004900000050', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001200000013', 5, 6, 61, false, null, null),
  ('00000000-0000-4000-8003-005000000051', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001300000014', 0, 7, 47, false, 'The long run grows. Everything else holds steady.', null),
  ('00000000-0000-4000-8003-005100000052', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001300000014', 1, 8, 35, true, 'The long run grows. Everything else holds steady.', null),
  ('00000000-0000-4000-8003-005200000053', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001300000014', 2, 9, 52, false, 'The long run grows. Everything else holds steady.', null),
  ('00000000-0000-4000-8003-005300000054', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001300000014', 3, 10, 54, false, 'The long run grows. Everything else holds steady.', null),
  ('00000000-0000-4000-8003-005400000055', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001300000014', 4, 11, 56, false, 'The long run grows. Everything else holds steady.', null),
  ('00000000-0000-4000-8003-005500000056', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001400000015', 0, 12, 64, false, 'Marathon pace on tired legs, inside the long run.', null),
  ('00000000-0000-4000-8003-005600000057', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001400000015', 1, 13, 67, false, 'Marathon pace on tired legs, inside the long run.', null),
  ('00000000-0000-4000-8003-005700000058', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001400000015', 2, 14, 70, false, 'Marathon pace on tired legs, inside the long run.', null),
  ('00000000-0000-4000-8003-005800000059', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001400000015', 3, 15, 73, false, 'Marathon pace on tired legs, inside the long run.', null),
  ('00000000-0000-4000-8003-005900000060', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001500000016', 0, 16, 29, false, 'Do less. Trust the work.', null),
  ('00000000-0000-4000-8003-006000000061', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001500000016', 1, 17, 30, false, 'Do less. Trust the work.', null),
  ('00000000-0000-4000-8003-006100000062', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8002-001500000016', 2, 18, 31, false, 'Do less. Trust the work.', null),
  ('00000000-0000-4000-8003-006200000063', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001600000017', 0, 1, 41, false, null, null),
  ('00000000-0000-4000-8003-006300000064', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001600000017', 1, 2, 43, false, null, null),
  ('00000000-0000-4000-8003-006400000065', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001600000017', 2, 3, 45, false, null, null),
  ('00000000-0000-4000-8003-006500000066', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001600000017', 3, 4, 30, true, null, null),
  ('00000000-0000-4000-8003-006600000067', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001600000017', 4, 5, 49, false, null, null),
  ('00000000-0000-4000-8003-006700000068', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001600000017', 5, 6, 52, false, null, null),
  ('00000000-0000-4000-8003-006800000069', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001600000017', 6, 7, 54, false, null, null),
  ('00000000-0000-4000-8003-006900000070', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001600000017', 7, 8, 30, true, null, null),
  ('00000000-0000-4000-8003-007000000071', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001700000018', 0, 9, 61, false, 'Back-to-back weekends. Practise eating on the move.', null),
  ('00000000-0000-4000-8003-007100000072', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001700000018', 1, 10, 64, false, 'Back-to-back weekends. Practise eating on the move.', null),
  ('00000000-0000-4000-8003-007200000073', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001700000018', 2, 11, 67, false, 'Back-to-back weekends. Practise eating on the move.', null),
  ('00000000-0000-4000-8003-007300000074', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001700000018', 3, 12, 44, true, 'Back-to-back weekends. Practise eating on the move.', null),
  ('00000000-0000-4000-8003-007400000075', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001700000018', 4, 13, 72, false, 'Back-to-back weekends. Practise eating on the move.', null),
  ('00000000-0000-4000-8003-007500000076', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001700000018', 5, 14, 76, false, 'Back-to-back weekends. Practise eating on the move.', null),
  ('00000000-0000-4000-8003-007600000077', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001700000018', 6, 15, 79, false, 'Back-to-back weekends. Practise eating on the move.', null),
  ('00000000-0000-4000-8003-007700000078', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001700000018', 7, 16, 44, true, 'Back-to-back weekends. Practise eating on the move.', null),
  ('00000000-0000-4000-8003-007800000079', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001800000019', 0, 17, 61, false, 'Terrain, night running, and the kit you will race in.', null),
  ('00000000-0000-4000-8003-007900000080', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001800000019', 1, 18, 64, false, 'Terrain, night running, and the kit you will race in.', null),
  ('00000000-0000-4000-8003-008000000081', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001800000019', 2, 19, 67, false, 'Terrain, night running, and the kit you will race in.', null),
  ('00000000-0000-4000-8003-008100000082', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001800000019', 3, 20, 44, true, 'Terrain, night running, and the kit you will race in.', null),
  ('00000000-0000-4000-8003-008200000083', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001800000019', 4, 21, 73, false, 'Terrain, night running, and the kit you will race in.', null),
  ('00000000-0000-4000-8003-008300000084', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001900000020', 0, 22, 25, false, null, null),
  ('00000000-0000-4000-8003-008400000085', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001900000020', 1, 23, 27, false, null, null),
  ('00000000-0000-4000-8003-008500000086', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8002-001900000020', 2, 24, 18, true, null, null),
  ('00000000-0000-4000-8003-008600000087', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002000000021', 0, 1, 20, false, 'Three disciplines, one rest day. Even a triathlete stops.', null),
  ('00000000-0000-4000-8003-008700000088', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002000000021', 1, 2, 21, false, 'Three disciplines, one rest day. Even a triathlete stops.', null),
  ('00000000-0000-4000-8003-008800000089', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002000000021', 2, 3, 23, false, 'Three disciplines, one rest day. Even a triathlete stops.', null),
  ('00000000-0000-4000-8003-008900000090', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002000000021', 3, 4, 15, true, 'Three disciplines, one rest day. Even a triathlete stops.', null),
  ('00000000-0000-4000-8003-009000000091', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002000000021', 4, 5, 24, false, 'Three disciplines, one rest day. Even a triathlete stops.', null),
  ('00000000-0000-4000-8003-009100000092', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002000000021', 5, 6, 25, false, 'Three disciplines, one rest day. Even a triathlete stops.', null),
  ('00000000-0000-4000-8003-009200000093', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002000000021', 6, 7, 26, false, 'Three disciplines, one rest day. Even a triathlete stops.', null),
  ('00000000-0000-4000-8003-009300000094', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002000000021', 7, 8, 15, true, 'Three disciplines, one rest day. Even a triathlete stops.', null),
  ('00000000-0000-4000-8003-009400000095', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002100000022', 0, 9, 32, false, 'Brick work every week. Get used to running off the bike.', null),
  ('00000000-0000-4000-8003-009500000096', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002100000022', 1, 10, 34, false, 'Brick work every week. Get used to running off the bike.', null),
  ('00000000-0000-4000-8003-009600000097', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002100000022', 2, 11, 35, false, 'Brick work every week. Get used to running off the bike.', null),
  ('00000000-0000-4000-8003-009700000098', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002100000022', 3, 12, 23, true, 'Brick work every week. Get used to running off the bike.', null),
  ('00000000-0000-4000-8003-009800000099', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002100000022', 4, 13, 38, false, 'Brick work every week. Get used to running off the bike.', null),
  ('00000000-0000-4000-8003-009900000100', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002100000022', 5, 14, 40, false, 'Brick work every week. Get used to running off the bike.', null),
  ('00000000-0000-4000-8003-010000000101', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002100000022', 6, 15, 42, false, 'Brick work every week. Get used to running off the bike.', null),
  ('00000000-0000-4000-8003-010100000102', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002200000023', 0, 16, 29, false, null, null),
  ('00000000-0000-4000-8003-010200000103', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002200000023', 1, 17, 31, false, null, null),
  ('00000000-0000-4000-8003-010300000104', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002200000023', 2, 18, 32, false, null, null),
  ('00000000-0000-4000-8003-010400000105', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002300000024', 0, 19, 12, false, null, null),
  ('00000000-0000-4000-8003-010500000106', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8002-002300000024', 1, 20, 9, true, null, null)
on conflict (id) do nothing;

insert into program_template_slots (id, program_template_id, template_week_id, weekday, slot, workout_template_id, strength_template_id, is_rest, is_optional, label, notes, distance_km, duration_minutes, rpe_target) values
  ('00000000-0000-4000-8004-000000000001', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000000000001', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-000100000002', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000000000001', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-000200000003', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000000000001', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-000300000004', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000000000001', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-000400000005', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000000000001', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-000500000006', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000000000001', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 11, null, null),
  ('00000000-0000-4000-8004-000600000007', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000100000002', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-000700000008', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000100000002', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-000800000009', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000100000002', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-000900000010', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000100000002', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-001000000011', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000100000002', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-001100000012', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000100000002', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 11.5, null, null),
  ('00000000-0000-4000-8004-001200000013', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000200000003', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-001300000014', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000200000003', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-001400000015', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000200000003', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-001500000016', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000200000003', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-001600000017', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000200000003', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-001700000018', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000200000003', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 12, null, null),
  ('00000000-0000-4000-8004-001800000019', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000300000004', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-001900000020', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000300000004', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-002000000021', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000300000004', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-002100000022', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000300000004', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-002200000023', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000300000004', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-002300000024', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000300000004', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-002400000025', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000400000005', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-002500000026', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000400000005', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-002600000027', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000400000005', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-002700000028', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000400000005', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-002800000029', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000400000005', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-002900000030', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000400000005', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 13, null, null),
  ('00000000-0000-4000-8004-003000000031', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000500000006', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-003100000032', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000500000006', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 10, null, null),
  ('00000000-0000-4000-8004-003200000033', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000500000006', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-003300000034', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000500000006', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-003400000035', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000500000006', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 10, null, null),
  ('00000000-0000-4000-8004-003500000036', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000500000006', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 14, null, null),
  ('00000000-0000-4000-8004-003600000037', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000600000007', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-003700000038', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000600000007', 2, 0, '00000000-0000-4000-8000-000000000005', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-003800000039', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000600000007', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-003900000040', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000600000007', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-004000000041', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000600000007', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-004100000042', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000600000007', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 14.5, null, null),
  ('00000000-0000-4000-8004-004200000043', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000700000008', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-004300000044', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000700000008', 2, 0, '00000000-0000-4000-8000-000000000005', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-004400000045', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000700000008', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-004500000046', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000700000008', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-004600000047', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000700000008', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-004700000048', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000700000008', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 10.5, null, null),
  ('00000000-0000-4000-8004-004800000049', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000800000009', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-004900000050', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000800000009', 2, 0, '00000000-0000-4000-8000-000000000005', null, false, false, null, null, 10, null, null),
  ('00000000-0000-4000-8004-005000000051', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000800000009', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-005100000052', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000800000009', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-005200000053', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000800000009', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-005300000054', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000800000009', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 15.5, null, null),
  ('00000000-0000-4000-8004-005400000055', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000900000010', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-005500000056', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000900000010', 2, 0, '00000000-0000-4000-8000-000000000005', null, false, false, null, null, 10.5, null, null),
  ('00000000-0000-4000-8004-005600000057', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000900000010', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-005700000058', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000900000010', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-005800000059', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000900000010', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-005900000060', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-000900000010', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 16.5, null, null),
  ('00000000-0000-4000-8004-006000000061', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-001000000011', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-006100000062', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-001000000011', 2, 0, '00000000-0000-4000-8000-000000000005', null, false, false, null, null, 11, null, null),
  ('00000000-0000-4000-8004-006200000063', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-001000000011', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-006300000064', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-001000000011', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-006400000065', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-001000000011', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-006500000066', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-001000000011', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 17, null, null),
  ('00000000-0000-4000-8004-006600000067', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-001100000012', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-006700000068', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-001100000012', 2, 0, '00000000-0000-4000-8000-000000000005', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-006800000069', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-001100000012', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-006900000070', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-001100000012', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-007000000071', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-001100000012', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-007100000072', '00000000-0000-4000-8001-000000000007', '00000000-0000-4000-8003-001100000012', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 10.5, null, null),
  ('00000000-0000-4000-8004-007200000073', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001200000013', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-007300000074', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001200000013', 3, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 10.5, null, null),
  ('00000000-0000-4000-8004-007400000075', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001200000013', 4, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-007500000076', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001200000013', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-007600000077', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001200000013', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 13, null, null),
  ('00000000-0000-4000-8004-007700000078', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001300000014', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-007800000079', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001300000014', 3, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 11, null, null),
  ('00000000-0000-4000-8004-007900000080', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001300000014', 4, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-008000000081', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001300000014', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-008100000082', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001300000014', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 14, null, null),
  ('00000000-0000-4000-8004-008200000083', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001400000015', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-008300000084', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001400000015', 3, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 11.5, null, null),
  ('00000000-0000-4000-8004-008400000085', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001400000015', 4, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-008500000086', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001400000015', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-008600000087', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001400000015', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 14.5, null, null),
  ('00000000-0000-4000-8004-008700000088', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001500000016', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-008800000089', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001500000016', 3, 0, '00000000-0000-4000-8000-000000000007', null, false, false, null, null, 12, null, null),
  ('00000000-0000-4000-8004-008900000090', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001500000016', 4, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-009000000091', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001500000016', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-009100000092', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001500000016', 6, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-009200000093', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001500000016', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 13, null, null),
  ('00000000-0000-4000-8004-009300000094', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001600000017', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-009400000095', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001600000017', 3, 0, '00000000-0000-4000-8000-000000000007', null, false, false, null, null, 12.5, null, null),
  ('00000000-0000-4000-8004-009500000096', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001600000017', 4, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-009600000097', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001600000017', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-009700000098', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001600000017', 6, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-009800000099', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001600000017', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 14, null, null),
  ('00000000-0000-4000-8004-009900000100', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001700000018', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-010000000101', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001700000018', 3, 0, '00000000-0000-4000-8000-000000000007', null, false, false, null, null, 13, null, null),
  ('00000000-0000-4000-8004-010100000102', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001700000018', 4, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-010200000103', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001700000018', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-010300000104', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001700000018', 6, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-010400000105', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001700000018', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 14.5, null, null),
  ('00000000-0000-4000-8004-010500000106', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001800000019', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-010600000107', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001800000019', 3, 0, '00000000-0000-4000-8000-000000000007', null, false, false, null, null, 14, null, null),
  ('00000000-0000-4000-8004-010700000108', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001800000019', 4, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-010800000109', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001800000019', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 7, null, null),
  ('00000000-0000-4000-8004-010900000110', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001800000019', 6, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-011000000111', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001800000019', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 15, null, null),
  ('00000000-0000-4000-8004-011100000112', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001900000020', 2, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-011200000113', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001900000020', 3, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 5, null, null),
  ('00000000-0000-4000-8004-011300000114', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001900000020', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-011400000115', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001900000020', 6, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-011500000116', '00000000-0000-4000-8001-000000000001', '00000000-0000-4000-8003-001900000020', 7, 0, '00000000-0000-4000-8000-000000000001', null, false, false, 'Race — 5K', null, 5.5, null, null),
  ('00000000-0000-4000-8004-011600000117', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002000000021', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-011700000118', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002000000021', 3, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 11, null, null),
  ('00000000-0000-4000-8004-011800000119', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002000000021', 4, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-011900000120', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002000000021', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-012000000121', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002000000021', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 15.5, null, null),
  ('00000000-0000-4000-8004-012100000122', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002100000022', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-012200000123', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002100000022', 3, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 11.5, null, null),
  ('00000000-0000-4000-8004-012300000124', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002100000022', 4, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-012400000125', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002100000022', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-012500000126', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002100000022', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 16, null, null),
  ('00000000-0000-4000-8004-012600000127', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002200000023', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-012700000128', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002200000023', 3, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 12, null, null),
  ('00000000-0000-4000-8004-012800000129', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002200000023', 4, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-012900000130', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002200000023', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-013000000131', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002200000023', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 17, null, null),
  ('00000000-0000-4000-8004-013100000132', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002300000024', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-013200000133', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002300000024', 3, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-013300000134', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002300000024', 4, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-013400000135', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002300000024', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-013500000136', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002300000024', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 11, null, null),
  ('00000000-0000-4000-8004-013600000137', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002400000025', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-013700000138', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002400000025', 3, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 13, null, null),
  ('00000000-0000-4000-8004-013800000139', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002400000025', 4, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-013900000140', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002400000025', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-014000000141', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002400000025', 6, 0, '00000000-0000-4000-8000-000000000005', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-014100000142', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002400000025', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 16.5, null, null),
  ('00000000-0000-4000-8004-014200000143', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002500000026', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-014300000144', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002500000026', 3, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 13.5, null, null),
  ('00000000-0000-4000-8004-014400000145', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002500000026', 4, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-014500000146', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002500000026', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-014600000147', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002500000026', 6, 0, '00000000-0000-4000-8000-000000000005', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-014700000148', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002500000026', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 17.5, null, null),
  ('00000000-0000-4000-8004-014800000149', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002600000027', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-014900000150', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002600000027', 3, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 14.5, null, null),
  ('00000000-0000-4000-8004-015000000151', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002600000027', 4, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-015100000152', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002600000027', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-015200000153', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002600000027', 6, 0, '00000000-0000-4000-8000-000000000005', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-015300000154', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002600000027', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 18, null, null),
  ('00000000-0000-4000-8004-015400000155', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002700000028', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-015500000156', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002700000028', 3, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-015600000157', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002700000028', 4, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-015700000158', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002700000028', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 4.5, null, null),
  ('00000000-0000-4000-8004-015800000159', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002700000028', 6, 0, '00000000-0000-4000-8000-000000000005', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-015900000160', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002700000028', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 12, null, null),
  ('00000000-0000-4000-8004-016000000161', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002800000029', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 5.5, null, null),
  ('00000000-0000-4000-8004-016100000162', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002800000029', 3, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-016200000163', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002800000029', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-016300000164', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002800000029', 6, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-016400000165', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002800000029', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 10, null, null),
  ('00000000-0000-4000-8004-016500000166', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002900000030', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-016600000167', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002900000030', 3, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-016700000168', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002900000030', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-016800000169', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002900000030', 6, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-016900000170', '00000000-0000-4000-8001-000000000002', '00000000-0000-4000-8003-002900000030', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 10.5, null, null),
  ('00000000-0000-4000-8004-017000000171', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003000000031', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-017100000172', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003000000031', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-017200000173', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003000000031', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 10.5, null, null),
  ('00000000-0000-4000-8004-017300000174', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003000000031', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-017400000175', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003000000031', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 14.5, null, null),
  ('00000000-0000-4000-8004-017500000176', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003100000032', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-017600000177', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003100000032', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-017700000178', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003100000032', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 11, null, null),
  ('00000000-0000-4000-8004-017800000179', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003100000032', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-017900000180', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003100000032', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 15, null, null),
  ('00000000-0000-4000-8004-018000000181', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003200000033', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-018100000182', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003200000033', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-018200000183', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003200000033', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 11.5, null, null),
  ('00000000-0000-4000-8004-018300000184', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003200000033', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-018400000185', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003200000033', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 15.5, null, null),
  ('00000000-0000-4000-8004-018500000186', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003300000034', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-018600000187', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003300000034', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-018700000188', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003300000034', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 7.5, null, null),
  ('00000000-0000-4000-8004-018800000189', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003300000034', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-018900000190', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003300000034', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 10.5, null, null),
  ('00000000-0000-4000-8004-019000000191', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003400000035', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-019100000192', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003400000035', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-019200000193', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003400000035', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 12.5, null, null),
  ('00000000-0000-4000-8004-019300000194', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003400000035', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-019400000195', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003400000035', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 17, null, null),
  ('00000000-0000-4000-8004-019500000196', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003500000036', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-019600000197', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003500000036', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-019700000198', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003500000036', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 13, null, null),
  ('00000000-0000-4000-8004-019800000199', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003500000036', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-019900000200', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003500000036', 6, 1, null, '00000000-0000-4000-8002-000000000002', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-020000000201', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003500000036', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 18.5, null, null),
  ('00000000-0000-4000-8004-020100000202', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003600000037', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-020200000203', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003600000037', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-020300000204', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003600000037', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 13.5, null, null),
  ('00000000-0000-4000-8004-020400000205', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003600000037', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-020500000206', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003600000037', 6, 1, null, '00000000-0000-4000-8002-000000000002', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-020600000207', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003600000037', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 19.5, null, null),
  ('00000000-0000-4000-8004-020700000208', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003700000038', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-020800000209', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003700000038', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-020900000210', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003700000038', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-021000000211', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003700000038', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 4.5, null, null),
  ('00000000-0000-4000-8004-021100000212', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003700000038', 6, 1, null, '00000000-0000-4000-8002-000000000002', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-021200000213', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003700000038', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 13.5, null, null),
  ('00000000-0000-4000-8004-021300000214', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003800000039', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-021400000215', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003800000039', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-021500000216', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003800000039', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 15, null, null),
  ('00000000-0000-4000-8004-021600000217', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003800000039', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 7, null, null),
  ('00000000-0000-4000-8004-021700000218', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003800000039', 6, 1, null, '00000000-0000-4000-8002-000000000002', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-021800000219', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003800000039', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 21.5, null, null),
  ('00000000-0000-4000-8004-021900000220', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003900000040', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-022000000221', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003900000040', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-022100000222', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003900000040', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 15.5, null, null),
  ('00000000-0000-4000-8004-022200000223', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003900000040', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 7, null, null),
  ('00000000-0000-4000-8004-022300000224', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003900000040', 6, 1, null, '00000000-0000-4000-8002-000000000002', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-022400000225', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-003900000040', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 22.5, null, null),
  ('00000000-0000-4000-8004-022500000226', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004000000041', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-022600000227', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004000000041', 3, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-022700000228', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004000000041', 4, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 16, null, null),
  ('00000000-0000-4000-8004-022800000229', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004000000041', 6, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-022900000230', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004000000041', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 21, null, null),
  ('00000000-0000-4000-8004-023000000231', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004100000042', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-023100000232', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004100000042', 3, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-023200000233', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004100000042', 4, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 11.5, null, null),
  ('00000000-0000-4000-8004-023300000234', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004100000042', 6, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 4.5, null, null),
  ('00000000-0000-4000-8004-023400000235', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004100000042', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 15, null, null),
  ('00000000-0000-4000-8004-023500000236', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004200000043', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 5.5, null, null),
  ('00000000-0000-4000-8004-023600000237', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004200000043', 4, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-023700000238', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004200000043', 6, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-023800000239', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004200000043', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-023900000240', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004300000044', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-024000000241', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004300000044', 4, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-024100000242', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004300000044', 6, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-024200000243', '00000000-0000-4000-8001-000000000003', '00000000-0000-4000-8003-004300000044', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-024300000244', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004400000045', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-024400000245', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004400000045', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-024500000246', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004400000045', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 11, null, null),
  ('00000000-0000-4000-8004-024600000247', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004400000045', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-024700000248', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004400000045', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-024800000249', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004400000045', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 15.5, null, null),
  ('00000000-0000-4000-8004-024900000250', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004500000046', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-025000000251', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004500000046', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-025100000252', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004500000046', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 11.5, null, null),
  ('00000000-0000-4000-8004-025200000253', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004500000046', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-025300000254', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004500000046', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-025400000255', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004500000046', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 16, null, null),
  ('00000000-0000-4000-8004-025500000256', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004600000047', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-025600000257', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004600000047', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-025700000258', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004600000047', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 12, null, null),
  ('00000000-0000-4000-8004-025800000259', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004600000047', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-025900000260', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004600000047', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-026000000261', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004600000047', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 17, null, null),
  ('00000000-0000-4000-8004-026100000262', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004700000048', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-026200000263', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004700000048', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-026300000264', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004700000048', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-026400000265', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004700000048', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 4.5, null, null),
  ('00000000-0000-4000-8004-026500000266', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004700000048', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-026600000267', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004700000048', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 11, null, null),
  ('00000000-0000-4000-8004-026700000268', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004800000049', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-026800000269', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004800000049', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-026900000270', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004800000049', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 13.5, null, null),
  ('00000000-0000-4000-8004-027000000271', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004800000049', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 7, null, null),
  ('00000000-0000-4000-8004-027100000272', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004800000049', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-027200000273', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004800000049', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 18.5, null, null),
  ('00000000-0000-4000-8004-027300000274', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004900000050', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 10, null, null),
  ('00000000-0000-4000-8004-027400000275', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004900000050', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-027500000276', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004900000050', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 14, null, null),
  ('00000000-0000-4000-8004-027600000277', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004900000050', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 7.5, null, null),
  ('00000000-0000-4000-8004-027700000278', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004900000050', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 10, null, null),
  ('00000000-0000-4000-8004-027800000279', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-004900000050', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 19.5, null, null),
  ('00000000-0000-4000-8004-027900000280', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005000000051', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-028000000281', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005000000051', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-028100000282', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005000000051', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 13, null, null),
  ('00000000-0000-4000-8004-028200000283', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005000000051', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-028300000284', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005000000051', 6, 1, null, '00000000-0000-4000-8002-000000000002', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-028400000285', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005000000051', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 20, null, null),
  ('00000000-0000-4000-8004-028500000286', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005100000052', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-028600000287', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005100000052', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-028700000288', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005100000052', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-028800000289', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005100000052', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 4.5, null, null),
  ('00000000-0000-4000-8004-028900000290', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005100000052', 6, 1, null, '00000000-0000-4000-8002-000000000002', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-029000000291', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005100000052', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 14.5, null, null),
  ('00000000-0000-4000-8004-029100000292', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005200000053', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-029200000293', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005200000053', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-029300000294', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005200000053', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 14.5, null, null),
  ('00000000-0000-4000-8004-029400000295', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005200000053', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-029500000296', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005200000053', 6, 1, null, '00000000-0000-4000-8002-000000000002', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-029600000297', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005200000053', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 22, null, null),
  ('00000000-0000-4000-8004-029700000298', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005300000054', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-029800000299', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005300000054', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-029900000300', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005300000054', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 15, null, null),
  ('00000000-0000-4000-8004-030000000301', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005300000054', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 7, null, null),
  ('00000000-0000-4000-8004-030100000302', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005300000054', 6, 1, null, '00000000-0000-4000-8002-000000000002', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-030200000303', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005300000054', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 23, null, null),
  ('00000000-0000-4000-8004-030300000304', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005400000055', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-030400000305', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005400000055', 3, 1, null, '00000000-0000-4000-8002-000000000001', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-030500000306', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005400000055', 4, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 15.5, null, null),
  ('00000000-0000-4000-8004-030600000307', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005400000055', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 7, null, null),
  ('00000000-0000-4000-8004-030700000308', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005400000055', 6, 1, null, '00000000-0000-4000-8002-000000000002', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-030800000309', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005400000055', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 24, null, null),
  ('00000000-0000-4000-8004-030900000310', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005500000056', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-031000000311', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005500000056', 3, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-031100000312', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005500000056', 4, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 16, null, null),
  ('00000000-0000-4000-8004-031200000313', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005500000056', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-031300000314', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005500000056', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-031400000315', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005500000056', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 25.5, null, null),
  ('00000000-0000-4000-8004-031500000316', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005600000057', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-031600000317', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005600000057', 3, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-031700000318', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005600000057', 4, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 17, null, null),
  ('00000000-0000-4000-8004-031800000319', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005600000057', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-031900000320', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005600000057', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-032000000321', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005600000057', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 26.5, null, null),
  ('00000000-0000-4000-8004-032100000322', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005700000058', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-032200000323', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005700000058', 3, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-032300000324', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005700000058', 4, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 17.5, null, null),
  ('00000000-0000-4000-8004-032400000325', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005700000058', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-032500000326', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005700000058', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-032600000327', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005700000058', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 28, null, null),
  ('00000000-0000-4000-8004-032700000328', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005800000059', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-032800000329', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005800000059', 3, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-032900000330', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005800000059', 4, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 18.5, null, null),
  ('00000000-0000-4000-8004-033000000331', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005800000059', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 7, null, null),
  ('00000000-0000-4000-8004-033100000332', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005800000059', 6, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-033200000333', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005800000059', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 29, null, null),
  ('00000000-0000-4000-8004-033300000334', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005900000060', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 5.5, null, null),
  ('00000000-0000-4000-8004-033400000335', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005900000060', 4, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-033500000336', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005900000060', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-033600000337', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005900000060', 6, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-033700000338', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-005900000060', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-033800000339', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-006000000061', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-033900000340', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-006000000061', 4, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-034000000341', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-006000000061', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-034100000342', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-006000000061', 6, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-034200000343', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-006000000061', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-034300000344', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-006100000062', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-034400000345', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-006100000062', 4, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-034500000346', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-006100000062', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-034600000347', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-006100000062', 6, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-034700000348', '00000000-0000-4000-8001-000000000004', '00000000-0000-4000-8003-006100000062', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-034800000349', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006200000063', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-034900000350', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006200000063', 3, 1, null, '00000000-0000-4000-8002-000000000005', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-035000000351', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006200000063', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-035100000352', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006200000063', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 13, null, null),
  ('00000000-0000-4000-8004-035200000353', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006200000063', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 11, null, null),
  ('00000000-0000-4000-8004-035300000354', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006300000064', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-035400000355', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006300000064', 3, 1, null, '00000000-0000-4000-8002-000000000005', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-035500000356', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006300000064', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-035600000357', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006300000064', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 14, null, null),
  ('00000000-0000-4000-8004-035700000358', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006300000064', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 11.5, null, null),
  ('00000000-0000-4000-8004-035800000359', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006400000065', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-035900000360', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006400000065', 3, 1, null, '00000000-0000-4000-8002-000000000005', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-036000000361', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006400000065', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-036100000362', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006400000065', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 14.5, null, null),
  ('00000000-0000-4000-8004-036200000363', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006400000065', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 12, null, null),
  ('00000000-0000-4000-8004-036300000364', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006500000066', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-036400000365', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006500000066', 3, 1, null, '00000000-0000-4000-8002-000000000005', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-036500000366', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006500000066', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-036600000367', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006500000066', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-036700000368', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006500000066', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 8, null, null),
  ('00000000-0000-4000-8004-036800000369', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006600000067', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-036900000370', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006600000067', 3, 1, null, '00000000-0000-4000-8002-000000000005', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-037000000371', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006600000067', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 10.5, null, null),
  ('00000000-0000-4000-8004-037100000372', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006600000067', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 16, null, null),
  ('00000000-0000-4000-8004-037200000373', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006600000067', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 13, null, null),
  ('00000000-0000-4000-8004-037300000374', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006700000068', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 10, null, null),
  ('00000000-0000-4000-8004-037400000375', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006700000068', 3, 1, null, '00000000-0000-4000-8002-000000000005', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-037500000376', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006700000068', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 11, null, null),
  ('00000000-0000-4000-8004-037600000377', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006700000068', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 16.5, null, null),
  ('00000000-0000-4000-8004-037700000378', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006700000068', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 14, null, null),
  ('00000000-0000-4000-8004-037800000379', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006800000069', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 10.5, null, null),
  ('00000000-0000-4000-8004-037900000380', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006800000069', 3, 1, null, '00000000-0000-4000-8002-000000000005', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-038000000381', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006800000069', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 11.5, null, null),
  ('00000000-0000-4000-8004-038100000382', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006800000069', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 17, null, null),
  ('00000000-0000-4000-8004-038200000383', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006800000069', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 14.5, null, null),
  ('00000000-0000-4000-8004-038300000384', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006900000070', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-038400000385', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006900000070', 3, 1, null, '00000000-0000-4000-8002-000000000005', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-038500000386', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006900000070', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-038600000387', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006900000070', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-038700000388', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-006900000070', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 8, null, null),
  ('00000000-0000-4000-8004-038800000389', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007000000071', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-038900000390', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007000000071', 3, 1, null, '00000000-0000-4000-8002-000000000005', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-039000000391', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007000000071', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 11, null, null),
  ('00000000-0000-4000-8004-039100000392', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007000000071', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-039200000393', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007000000071', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 20, null, null),
  ('00000000-0000-4000-8004-039300000394', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007000000071', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 15.5, null, null),
  ('00000000-0000-4000-8004-039400000395', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007100000072', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-039500000396', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007100000072', 3, 1, null, '00000000-0000-4000-8002-000000000005', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-039600000397', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007100000072', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 11.5, null, null),
  ('00000000-0000-4000-8004-039700000398', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007100000072', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-039800000399', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007100000072', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 21, null, null),
  ('00000000-0000-4000-8004-039900000400', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007100000072', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 16, null, null),
  ('00000000-0000-4000-8004-040000000401', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007200000073', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-040100000402', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007200000073', 3, 1, null, '00000000-0000-4000-8002-000000000005', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-040200000403', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007200000073', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 12, null, null),
  ('00000000-0000-4000-8004-040300000404', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007200000073', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-040400000405', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007200000073', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 22, null, null),
  ('00000000-0000-4000-8004-040500000406', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007200000073', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 17, null, null),
  ('00000000-0000-4000-8004-040600000407', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007300000074', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-040700000408', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007300000074', 3, 1, null, '00000000-0000-4000-8002-000000000005', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-040800000409', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007300000074', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-040900000410', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007300000074', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 4.5, null, null),
  ('00000000-0000-4000-8004-041000000411', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007300000074', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 14.5, null, null),
  ('00000000-0000-4000-8004-041100000412', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007300000074', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 11, null, null),
  ('00000000-0000-4000-8004-041200000413', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007400000075', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-041300000414', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007400000075', 3, 1, null, '00000000-0000-4000-8002-000000000005', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-041400000415', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007400000075', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 13, null, null),
  ('00000000-0000-4000-8004-041500000416', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007400000075', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 7, null, null),
  ('00000000-0000-4000-8004-041600000417', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007400000075', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 24, null, null),
  ('00000000-0000-4000-8004-041700000418', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007400000075', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 18.5, null, null),
  ('00000000-0000-4000-8004-041800000419', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007500000076', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 10, null, null),
  ('00000000-0000-4000-8004-041900000420', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007500000076', 3, 1, null, '00000000-0000-4000-8002-000000000005', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-042000000421', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007500000076', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 14, null, null),
  ('00000000-0000-4000-8004-042100000422', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007500000076', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 7.5, null, null),
  ('00000000-0000-4000-8004-042200000423', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007500000076', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 25, null, null),
  ('00000000-0000-4000-8004-042300000424', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007500000076', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 19.5, null, null),
  ('00000000-0000-4000-8004-042400000425', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007600000077', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 10.5, null, null),
  ('00000000-0000-4000-8004-042500000426', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007600000077', 3, 1, null, '00000000-0000-4000-8002-000000000005', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-042600000427', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007600000077', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 14.5, null, null),
  ('00000000-0000-4000-8004-042700000428', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007600000077', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-042800000429', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007600000077', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 25.5, null, null),
  ('00000000-0000-4000-8004-042900000430', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007600000077', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 20, null, null),
  ('00000000-0000-4000-8004-043000000431', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007700000078', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-043100000432', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007700000078', 3, 1, null, '00000000-0000-4000-8002-000000000005', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-043200000433', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007700000078', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-043300000434', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007700000078', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 4.5, null, null),
  ('00000000-0000-4000-8004-043400000435', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007700000078', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 14.5, null, null),
  ('00000000-0000-4000-8004-043500000436', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007700000078', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 11, null, null),
  ('00000000-0000-4000-8004-043600000437', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007800000079', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-043700000438', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007800000079', 3, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-043800000439', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007800000079', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 11, null, null),
  ('00000000-0000-4000-8004-043900000440', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007800000079', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 28.5, null, null),
  ('00000000-0000-4000-8004-044000000441', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007800000079', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 13, null, null),
  ('00000000-0000-4000-8004-044100000442', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007900000080', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-044200000443', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007900000080', 3, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-044300000444', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007900000080', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 11.5, null, null),
  ('00000000-0000-4000-8004-044400000445', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007900000080', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 30, null, null),
  ('00000000-0000-4000-8004-044500000446', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-007900000080', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 14, null, null),
  ('00000000-0000-4000-8004-044600000447', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008000000081', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-044700000448', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008000000081', 3, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-044800000449', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008000000081', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 12, null, null),
  ('00000000-0000-4000-8004-044900000450', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008000000081', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 31.5, null, null),
  ('00000000-0000-4000-8004-045000000451', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008000000081', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 14.5, null, null),
  ('00000000-0000-4000-8004-045100000452', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008100000082', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-045200000453', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008100000082', 3, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-045300000454', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008100000082', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-045400000455', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008100000082', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 20.5, null, null),
  ('00000000-0000-4000-8004-045500000456', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008100000082', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 9.5, null, null),
  ('00000000-0000-4000-8004-045600000457', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008200000083', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-045700000458', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008200000083', 3, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-045800000459', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008200000083', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 13, null, null),
  ('00000000-0000-4000-8004-045900000460', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008200000083', 6, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 34.5, null, null),
  ('00000000-0000-4000-8004-046000000461', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008200000083', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, 'Back-to-Back Long Run', null, 16, null, null),
  ('00000000-0000-4000-8004-046100000462', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008300000084', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 5.5, null, null),
  ('00000000-0000-4000-8004-046200000463', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008300000084', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 5.5, null, null),
  ('00000000-0000-4000-8004-046300000464', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008300000084', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-046400000465', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008300000084', 6, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-046500000466', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008300000084', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 7.5, null, null),
  ('00000000-0000-4000-8004-046600000467', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008400000085', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-046700000468', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008400000085', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-046800000469', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008400000085', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-046900000470', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008400000085', 6, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-047000000471', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008400000085', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-047100000472', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008500000086', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 4, null, null),
  ('00000000-0000-4000-8004-047200000473', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008500000086', 4, 0, '00000000-0000-4000-8000-000000000008', null, false, false, null, null, 4, null, null),
  ('00000000-0000-4000-8004-047300000474', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008500000086', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-047400000475', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008500000086', 6, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 4.5, null, null),
  ('00000000-0000-4000-8004-047500000476', '00000000-0000-4000-8001-000000000005', '00000000-0000-4000-8003-008500000086', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 5.5, null, null),
  ('00000000-0000-4000-8004-047600000477', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008600000087', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-047700000478', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008600000087', 2, 0, '00000000-0000-4000-8000-000000000011', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-047800000479', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008600000087', 3, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-047900000480', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008600000087', 4, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-048000000481', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008600000087', 5, 1, null, '00000000-0000-4000-8002-000000000006', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-048100000482', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008600000087', 6, 0, '00000000-0000-4000-8000-000000000011', null, false, false, 'Long Ride', null, null, null, null),
  ('00000000-0000-4000-8004-048200000483', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008600000087', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 12, null, null),
  ('00000000-0000-4000-8004-048300000484', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008700000088', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-048400000485', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008700000088', 2, 0, '00000000-0000-4000-8000-000000000011', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-048500000486', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008700000088', 3, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-048600000487', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008700000088', 4, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-048700000488', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008700000088', 5, 1, null, '00000000-0000-4000-8002-000000000006', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-048800000489', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008700000088', 6, 0, '00000000-0000-4000-8000-000000000011', null, false, false, 'Long Ride', null, null, null, null),
  ('00000000-0000-4000-8004-048900000490', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008700000088', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 12.5, null, null),
  ('00000000-0000-4000-8004-049000000491', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008800000089', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-049100000492', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008800000089', 2, 0, '00000000-0000-4000-8000-000000000011', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-049200000493', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008800000089', 3, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-049300000494', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008800000089', 4, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9, null, null),
  ('00000000-0000-4000-8004-049400000495', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008800000089', 5, 1, null, '00000000-0000-4000-8002-000000000006', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-049500000496', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008800000089', 6, 0, '00000000-0000-4000-8000-000000000011', null, false, false, 'Long Ride', null, null, null, null),
  ('00000000-0000-4000-8004-049600000497', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008800000089', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 13.5, null, null),
  ('00000000-0000-4000-8004-049700000498', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008900000090', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-049800000499', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008900000090', 2, 0, '00000000-0000-4000-8000-000000000011', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-049900000500', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008900000090', 3, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-050000000501', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008900000090', 4, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-050100000502', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008900000090', 5, 1, null, '00000000-0000-4000-8002-000000000006', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-050200000503', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008900000090', 6, 0, '00000000-0000-4000-8000-000000000011', null, false, false, 'Long Ride', null, null, null, null),
  ('00000000-0000-4000-8004-050300000504', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-008900000090', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-050400000505', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009000000091', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-050500000506', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009000000091', 2, 0, '00000000-0000-4000-8000-000000000011', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-050600000507', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009000000091', 3, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-050700000508', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009000000091', 4, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 9.5, null, null),
  ('00000000-0000-4000-8004-050800000509', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009000000091', 5, 1, null, '00000000-0000-4000-8002-000000000006', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-050900000510', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009000000091', 6, 0, '00000000-0000-4000-8000-000000000011', null, false, false, 'Long Ride', null, null, null, null),
  ('00000000-0000-4000-8004-051000000511', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009000000091', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 14.5, null, null),
  ('00000000-0000-4000-8004-051100000512', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009100000092', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-051200000513', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009100000092', 2, 0, '00000000-0000-4000-8000-000000000011', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-051300000514', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009100000092', 3, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-051400000515', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009100000092', 4, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 10, null, null),
  ('00000000-0000-4000-8004-051500000516', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009100000092', 5, 1, null, '00000000-0000-4000-8002-000000000006', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-051600000517', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009100000092', 6, 0, '00000000-0000-4000-8000-000000000011', null, false, false, 'Long Ride', null, null, null, null),
  ('00000000-0000-4000-8004-051700000518', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009100000092', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 15, null, null),
  ('00000000-0000-4000-8004-051800000519', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009200000093', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-051900000520', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009200000093', 2, 0, '00000000-0000-4000-8000-000000000011', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-052000000521', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009200000093', 3, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-052100000522', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009200000093', 4, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 10.5, null, null),
  ('00000000-0000-4000-8004-052200000523', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009200000093', 5, 1, null, '00000000-0000-4000-8002-000000000006', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-052300000524', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009200000093', 6, 0, '00000000-0000-4000-8000-000000000011', null, false, false, 'Long Ride', null, null, null, null),
  ('00000000-0000-4000-8004-052400000525', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009200000093', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 15.5, null, null),
  ('00000000-0000-4000-8004-052500000526', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009300000094', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-052600000527', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009300000094', 2, 0, '00000000-0000-4000-8000-000000000011', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-052700000528', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009300000094', 3, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-052800000529', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009300000094', 4, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-052900000530', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009300000094', 5, 1, null, '00000000-0000-4000-8002-000000000006', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-053000000531', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009300000094', 6, 0, '00000000-0000-4000-8000-000000000011', null, false, false, 'Long Ride', null, null, null, null),
  ('00000000-0000-4000-8004-053100000532', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009300000094', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 8.5, null, null),
  ('00000000-0000-4000-8004-053200000533', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009400000095', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-053300000534', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009400000095', 2, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 10.5, null, null),
  ('00000000-0000-4000-8004-053400000535', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009400000095', 3, 1, null, '00000000-0000-4000-8002-000000000006', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-053500000536', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009400000095', 4, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-053600000537', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009400000095', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-053700000538', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009400000095', 6, 0, '00000000-0000-4000-8000-000000000010', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-053800000539', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009400000095', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 15.5, null, null),
  ('00000000-0000-4000-8004-053900000540', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009500000096', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-054000000541', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009500000096', 2, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 11, null, null),
  ('00000000-0000-4000-8004-054100000542', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009500000096', 3, 1, null, '00000000-0000-4000-8002-000000000006', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-054200000543', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009500000096', 4, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-054300000544', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009500000096', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-054400000545', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009500000096', 6, 0, '00000000-0000-4000-8000-000000000010', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-054500000546', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009500000096', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 16, null, null),
  ('00000000-0000-4000-8004-054600000547', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009600000097', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-054700000548', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009600000097', 2, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 11.5, null, null),
  ('00000000-0000-4000-8004-054800000549', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009600000097', 3, 1, null, '00000000-0000-4000-8002-000000000006', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-054900000550', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009600000097', 4, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-055000000551', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009600000097', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6.5, null, null),
  ('00000000-0000-4000-8004-055100000552', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009600000097', 6, 0, '00000000-0000-4000-8000-000000000010', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-055200000553', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009600000097', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 17, null, null),
  ('00000000-0000-4000-8004-055300000554', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009700000098', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-055400000555', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009700000098', 2, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 7.5, null, null),
  ('00000000-0000-4000-8004-055500000556', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009700000098', 3, 1, null, '00000000-0000-4000-8002-000000000006', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-055600000557', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009700000098', 4, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-055700000558', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009700000098', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 4.5, null, null),
  ('00000000-0000-4000-8004-055800000559', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009700000098', 6, 0, '00000000-0000-4000-8000-000000000010', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-055900000560', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009700000098', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 11, null, null),
  ('00000000-0000-4000-8004-056000000561', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009800000099', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-056100000562', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009800000099', 2, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 12.5, null, null),
  ('00000000-0000-4000-8004-056200000563', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009800000099', 3, 1, null, '00000000-0000-4000-8002-000000000006', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-056300000564', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009800000099', 4, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-056400000565', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009800000099', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 7, null, null),
  ('00000000-0000-4000-8004-056500000566', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009800000099', 6, 0, '00000000-0000-4000-8000-000000000010', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-056600000567', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009800000099', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 18.5, null, null),
  ('00000000-0000-4000-8004-056700000568', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009900000100', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-056800000569', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009900000100', 2, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 13, null, null),
  ('00000000-0000-4000-8004-056900000570', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009900000100', 3, 1, null, '00000000-0000-4000-8002-000000000006', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-057000000571', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009900000100', 4, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-057100000572', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009900000100', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 7.5, null, null),
  ('00000000-0000-4000-8004-057200000573', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009900000100', 6, 0, '00000000-0000-4000-8000-000000000010', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-057300000574', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-009900000100', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 19.5, null, null),
  ('00000000-0000-4000-8004-057400000575', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010000000101', 1, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-057500000576', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010000000101', 2, 0, '00000000-0000-4000-8000-000000000006', null, false, false, null, null, 13.5, null, null),
  ('00000000-0000-4000-8004-057600000577', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010000000101', 3, 1, null, '00000000-0000-4000-8002-000000000006', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-057700000578', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010000000101', 4, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-057800000579', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010000000101', 5, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 8, null, null),
  ('00000000-0000-4000-8004-057900000580', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010000000101', 6, 0, '00000000-0000-4000-8000-000000000010', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-058000000581', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010000000101', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 20, null, null),
  ('00000000-0000-4000-8004-058100000582', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010100000102', 1, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-058200000583', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010100000102', 2, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 11, null, null),
  ('00000000-0000-4000-8004-058300000584', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010100000102', 3, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-058400000585', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010100000102', 4, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-058500000586', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010100000102', 6, 0, '00000000-0000-4000-8000-000000000010', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-058600000587', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010100000102', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 17.5, null, null),
  ('00000000-0000-4000-8004-058700000588', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010200000103', 1, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-058800000589', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010200000103', 2, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 12, null, null),
  ('00000000-0000-4000-8004-058900000590', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010200000103', 3, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-059000000591', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010200000103', 4, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-059100000592', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010200000103', 6, 0, '00000000-0000-4000-8000-000000000010', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-059200000593', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010200000103', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 18.5, null, null),
  ('00000000-0000-4000-8004-059300000594', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010300000104', 1, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-059400000595', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010300000104', 2, 0, '00000000-0000-4000-8000-000000000009', null, false, false, null, null, 12.5, null, null),
  ('00000000-0000-4000-8004-059500000596', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010300000104', 3, 1, null, '00000000-0000-4000-8002-000000000004', false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-059600000597', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010300000104', 4, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-059700000598', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010300000104', 6, 0, '00000000-0000-4000-8000-000000000010', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-059800000599', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010300000104', 7, 0, '00000000-0000-4000-8000-000000000003', null, false, false, null, null, 19.5, null, null),
  ('00000000-0000-4000-8004-059900000600', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010400000105', 1, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-060000000601', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010400000105', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 5.5, null, null),
  ('00000000-0000-4000-8004-060100000602', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010400000105', 4, 0, '00000000-0000-4000-8000-000000000011', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-060200000603', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010400000105', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-060300000604', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010400000105', 6, 0, '00000000-0000-4000-8000-000000000010', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-060400000605', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010400000105', 7, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 6, null, null),
  ('00000000-0000-4000-8004-060500000606', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010500000106', 1, 0, '00000000-0000-4000-8000-000000000012', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-060600000607', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010500000106', 2, 0, '00000000-0000-4000-8000-000000000001', null, false, false, null, null, 4, null, null),
  ('00000000-0000-4000-8004-060700000608', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010500000106', 4, 0, '00000000-0000-4000-8000-000000000011', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-060800000609', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010500000106', 5, 0, null, null, true, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-060900000610', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010500000106', 6, 0, '00000000-0000-4000-8000-000000000010', null, false, false, null, null, null, null, null),
  ('00000000-0000-4000-8004-061000000611', '00000000-0000-4000-8001-000000000006', '00000000-0000-4000-8003-010500000106', 7, 0, '00000000-0000-4000-8000-000000000002', null, false, false, null, null, 4.5, null, null)
on conflict (id) do nothing;

-- ======================= 0010_programme_from_athlete.sql =======================

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
  -- training sessions and rest days are counted apart, because they read
  -- apart: a coach asking "how many sessions" does not mean the rest days
  select count(*) into v_sessions from scheduled_workouts
   where program_id = p_program and program_week_id is not null and type <> 'rest';
  select count(*) into v_rest from scheduled_workouts
   where program_id = p_program and program_week_id is not null and type = 'rest';

  if v_weeks = 0 then
    return query select 'block', 'structure',
      'This programme has no weeks, so there is no shape to save.', 0;
    return;
  end if;
  if v_sessions + v_rest = 0 then
    return query select 'block', 'structure',
      'This programme has no sessions attached to its weeks.', 0;
    return;
  end if;

  -- what travels
  return query select 'info', 'structure', format(
    '%s block(s), %s week(s) and %s session(s) will be saved.',
    v_blocks, v_weeks, v_sessions), v_sessions;

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

-- ======================= 0011_adaptation.sql =======================

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

-- ======================= 0012_roster.sql =======================

-- ============================================================
-- 0012 — THE ROSTER
--
-- A coach with forty athletes was making six database round trips per
-- athlete to find the three who needed them. This is one query.
--
-- It returns facts and no judgements. What counts as "needs attention"
-- is decided once, in the domain layer, so the two adapters cannot drift
-- into meaning different things — and so a coach can read the rule.
--
-- Adherence is measured against the *current* prescription. A session a
-- coach moved moves with it, so adapting a programme never shows up as an
-- athlete failing to follow one.
-- ============================================================

create or replace function im_coach_roster(
  p_coach uuid default null,
  p_today date default current_date
)
returns table (
  athlete_id            uuid,
  full_name             text,
  avatar_url            text,
  joined_at             timestamptz,

  programme_id          uuid,
  programme_name        text,
  programme_end_date    date,
  block_name            text,
  phase                 im_phase,
  week_no               integer,
  total_weeks           integer,

  planned_this_week     integer,
  completed_this_week   integer,
  planned_four_weeks    integer,
  completed_four_weeks  integer,

  missed_fourteen_days  integer,
  missed_key_name       text,
  missed_key_date       date,

  last_completed_date   date,
  last_completed_name   text,
  next_session_date     date,
  next_session_name     text,
  future_sessions       integer,

  checkin_week_start    date,
  checkin_submitted_at  timestamptz,
  checkin_attention     im_attention,
  checkin_reasons       text[],
  checkin_reviewed_at   timestamptz,
  checkin_fatigue       smallint,
  checkin_soreness      smallint,
  checkin_pain          text,

  race_id               uuid,
  race_name             text,
  race_date             date,
  goal_event_type       im_event_type,

  unread_from_athlete   integer,
  recent_adaptations    integer
)
language sql stable security definer set search_path = public as $$
with
  -- who the caller may see. A coach passing another coach's id gets their
  -- own roster, not that coach's: the link table is the authority, never
  -- the argument.
  me as (
    select case when im_is_admin() and p_coach is not null then p_coach else auth.uid() end as coach_id
  ),
  roster as (
    select l.athlete_id, l.started_at
      from coach_athlete_links l, me
     where l.coach_id = me.coach_id
       and l.status = 'active'
       and im_is_staff()
  ),
  -- the athlete's live programme, and where they are in it
  prog as (
    select p.athlete_id, p.id, p.name, p.end_date,
           (select count(*)::integer from program_weeks w where w.program_id = p.id) total_weeks
      from programs p
      join roster r on r.athlete_id = p.athlete_id
     where p.status = 'active'
  ),
  this_week as (
    select w.program_id, w.id week_id, w.program_week_no, b.name block_name, b.phase
      from program_weeks w
      join program_blocks b on b.id = w.block_id
      join prog on prog.id = w.program_id
     where p_today >= w.start_date and p_today < w.start_date + 7
  ),
  -- every count over sessions comes from one pass, not one query each
  sessions as (
    select
      s.athlete_id,
      count(*) filter (
        where s.date >= date_trunc('week', p_today)::date
          and s.date <= p_today and s.type <> 'rest')::integer planned_week,
      count(*) filter (
        where s.date >= date_trunc('week', p_today)::date
          and s.date <= p_today and s.type <> 'rest' and s.status = 'completed')::integer done_week,
      count(*) filter (
        where s.date >= p_today - 27 and s.date <= p_today and s.type <> 'rest')::integer planned_month,
      count(*) filter (
        where s.date >= p_today - 27 and s.date <= p_today
          and s.type <> 'rest' and s.status = 'completed')::integer done_month,
      count(*) filter (
        where s.date >= p_today - 13 and s.date <= p_today
          and s.type <> 'rest' and s.status = 'missed')::integer missed_fortnight,
      count(*) filter (where s.date >= p_today and s.status = 'scheduled')::integer future_count
    from scheduled_workouts s
    join roster r on r.athlete_id = s.athlete_id
    group by s.athlete_id
  )
select
  pr.id,
  pr.full_name,
  pr.avatar_url,
  r.started_at,

  prog.id,
  prog.name,
  prog.end_date,
  tw.block_name,
  tw.phase,
  tw.program_week_no::integer,
  prog.total_weeks,

  coalesce(sess.planned_week, 0),
  coalesce(sess.done_week, 0),
  coalesce(sess.planned_month, 0),
  coalesce(sess.done_month, 0),

  coalesce(sess.missed_fortnight, 0),
  key_missed.name,
  key_missed.date,

  last_done.date,
  last_done.name,
  next_up.date,
  next_up.name,
  coalesce(sess.future_count, 0),

  ci.week_start,
  ci.submitted_at,
  ci.attention_level,
  ci.attention_reasons,
  ci.reviewed_by_coach_at,
  ci.fatigue,
  ci.soreness,
  nullif(btrim(coalesce(ci.pain_or_niggles, '')), ''),

  race.id,
  race.name,
  race.date,
  race.event_type,

  coalesce(msg.unread, 0)::integer,
  coalesce(adapt.recent, 0)::integer

from roster r
join profiles pr on pr.id = r.athlete_id
left join prog on prog.athlete_id = r.athlete_id
left join this_week tw on tw.program_id = prog.id
left join sessions sess on sess.athlete_id = r.athlete_id

-- a missed session worth naming: the hard ones, most recent first
left join lateral (
  select s.name, s.date
    from scheduled_workouts s
   where s.athlete_id = r.athlete_id
     and s.status = 'missed'
     and s.date >= p_today - 13
     and s.type in ('long_run','threshold','intervals','race_pace','hills','tempo','brick','race')
   order by s.date desc
   limit 1
) key_missed on true

left join lateral (
  select s.date, s.name
    from scheduled_workouts s
   where s.athlete_id = r.athlete_id and s.status = 'completed'
   order by s.date desc
   limit 1
) last_done on true

left join lateral (
  select s.date, s.name
    from scheduled_workouts s
   where s.athlete_id = r.athlete_id and s.status = 'scheduled' and s.date >= p_today
     and s.type <> 'rest'
   order by s.date, s.slot
   limit 1
) next_up on true

left join lateral (
  select c.* from checkins c
   where c.athlete_id = r.athlete_id
   order by c.week_start desc
   limit 1
) ci on true

left join lateral (
  select ra.id, ra.name, ra.date, g.event_type
    from goals g join races ra on ra.id = g.race_id
   where g.athlete_id = r.athlete_id and ra.date >= p_today
   order by ra.date
   limit 1
) race on true

-- messages reach an athlete through their thread with this coach
left join lateral (
  select count(*)::integer unread
    from messages m
    join message_threads th on th.id = m.thread_id
    cross join me
   where th.athlete_id = r.athlete_id
     and m.recipient_id = me.coach_id
     and m.read_at is null
) msg on true

-- what this coach changed for them lately, so the roster does not report a
-- deliberate adaptation as if it were a surprise
left join lateral (
  select count(*)::integer recent
    from session_revisions sr, me
   where sr.athlete_id = r.athlete_id
     and sr.changed_by = me.coach_id
     and sr.changed_at >= (p_today - 6)::timestamptz
     and sr.kind <> 'created'
) adapt on true

order by pr.full_name;
$$;

comment on function im_coach_roster is
  'One row of facts per athlete on the caller''s roster. Judgement lives in the domain layer.';

-- ======================= 0013_notifications.sql =======================

-- ============================================================
-- 0013 — SIGNALS OUTSIDE THE BROWSER
--
-- The roster knows who needs a coach. This is how it reaches them when
-- they are not looking at it.
--
-- Three things are kept apart on purpose:
--
--   the signal      — the roster's, unchanged and never re-derived here
--   the notification — the decision that a coach should be told
--   the delivery     — one attempt down one channel, with its own outcome
--
-- A roster signal never calls an email provider. That separation is what
-- makes a second channel a new row rather than a rewrite.
-- ============================================================


create type im_notification_kind as enum ('digest', 'alert');
create type im_notification_state as enum ('pending', 'read', 'dismissed');
create type im_delivery_state as enum ('pending', 'delivered', 'failed', 'unavailable');
create type im_channel as enum ('in_app', 'email');


-- ------------------------------------------------------------
-- WHAT THE COACH IS TOLD
--
-- The existing table was a title and a body. A notification now knows
-- which athlete it is about, which roster signal produced it, how loud it
-- is, and — most importantly — a key identifying the *news* rather than
-- the sending, so the same thing is never reported twice.
-- ------------------------------------------------------------

alter table notifications
  add column if not exists notification_kind im_notification_kind not null default 'alert',
  add column if not exists priority          text not null default 'attention',
  add column if not exists athlete_id        uuid references profiles(id) on delete cascade,
  add column if not exists signal_kind       text,
  add column if not exists state             im_notification_state not null default 'pending',
  add column if not exists dedupe_key        text,
  add column if not exists deliver_after     timestamptz,
  add column if not exists payload           jsonb;

alter table notifications
  drop constraint if exists notifications_priority_check;
alter table notifications
  add constraint notifications_priority_check
    check (priority in ('urgent', 'attention', 'information'));

-- The whole of deduplication, in one index. A second attempt to tell a
-- coach the same news simply cannot be written.
create unique index if not exists notifications_dedupe
  on notifications (user_id, dedupe_key)
  where dedupe_key is not null;

create index if not exists notifications_user_state
  on notifications (user_id, state, created_at desc);


-- ------------------------------------------------------------
-- ONE ATTEMPT DOWN ONE CHANNEL
--
-- Separate from the notification because a notification is a decision and
-- a delivery is a thing that can fail. Keeping them apart is what lets a
-- coach be told once and reached twice, and what makes "why did this not
-- arrive" answerable.
-- ------------------------------------------------------------

create table if not exists notification_deliveries (
  id              uuid primary key default gen_random_uuid(),
  notification_id uuid not null references notifications(id) on delete cascade,
  user_id         uuid not null references profiles(id) on delete cascade,
  channel         im_channel not null,
  state           im_delivery_state not null default 'pending',
  attempts        smallint not null default 0,
  -- why it failed, in words, so nobody has to guess later
  detail          text,
  attempted_at    timestamptz,
  delivered_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (notification_id, channel)
);

create index if not exists notification_deliveries_pending
  on notification_deliveries (state, created_at)
  where state = 'pending';


-- ------------------------------------------------------------
-- HOW A COACH WANTS TO BE INTERRUPTED
--
-- Timezone is an IANA name, never an offset: an offset is wrong twice a
-- year, and a coach woken an hour early in October will not report it as
-- a bug, they will just turn the digest off.
-- ------------------------------------------------------------

create table if not exists notification_preferences (
  user_id                uuid primary key references profiles(id) on delete cascade,
  digest_enabled         boolean not null default true,
  digest_hour            smallint not null default 7 check (digest_hour between 0 and 23),
  timezone               text not null default 'Europe/Dublin',
  alert_flagged_checkin  boolean not null default true,
  alert_reported_pain    boolean not null default true,
  quiet_from             smallint check (quiet_from between 0 and 23),
  quiet_until            smallint check (quiet_until between 0 and 23),
  channels               text[] not null default array['in_app'],
  -- the coach's own local date of the last digest, so one goes out a day
  -- wherever they are and however the clocks move
  last_digest_local_date date,
  updated_at             timestamptz not null default now()
);


-- ------------------------------------------------------------
-- ROW-LEVEL SECURITY
--
-- A notification carries what an athlete said about their own body. Only
-- the coach it was addressed to may read it, and nobody may write one for
-- themselves — notifications are produced by the system, from signals,
-- and a user who can write their own can write one about anybody.
-- ------------------------------------------------------------

drop policy if exists notifications_rw on notifications;

create policy notifications_read on notifications
  for select using (user_id = auth.uid() or im_is_admin());

-- the coach may mark their own read or dismissed, and nothing else
create policy notifications_update on notifications
  for update using (user_id = auth.uid() or im_is_admin())
  with check (user_id = auth.uid() or im_is_admin());

create policy notifications_admin_write on notifications
  for insert with check (im_is_admin());

create policy notifications_admin_delete on notifications
  for delete using (user_id = auth.uid() or im_is_admin());

alter table notification_deliveries enable row level security;
create policy deliveries_read on notification_deliveries
  for select using (user_id = auth.uid() or im_is_admin());
create policy deliveries_admin_write on notification_deliveries
  for all using (im_is_admin()) with check (im_is_admin());

alter table notification_preferences enable row level security;
create policy preferences_rw on notification_preferences
  for all using (user_id = auth.uid() or im_is_admin())
  with check (user_id = auth.uid() or im_is_admin());


-- ------------------------------------------------------------
-- CREATING ONE
--
-- Security definer, because the coach cannot write their own. Returns the
-- id, or null when this news has already been sent — the caller does not
-- need to know which, only that the coach has been told once.
-- ------------------------------------------------------------

create or replace function im_notify(
  p_user          uuid,
  p_kind          im_notification_kind,
  p_priority      text,
  p_title         text,
  p_body          text,
  p_href          text,
  p_dedupe_key    text,
  p_athlete       uuid default null,
  p_signal_kind   text default null,
  p_deliver_after timestamptz default null,
  p_payload       jsonb default null,
  p_channels      text[] default array['in_app']
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_channel text;
begin
  -- an athlete-specific notification only ever goes to that athlete's coach
  if p_athlete is not null and not exists (
    select 1 from coach_athlete_links l
     where l.athlete_id = p_athlete and l.coach_id = p_user and l.status = 'active'
  ) then
    raise exception 'That athlete is not on that coach''s roster.';
  end if;

  insert into notifications (
    user_id, notification_kind, priority, athlete_id, signal_kind,
    kind, title, body, href, dedupe_key, deliver_after, payload)
  values (
    p_user, p_kind, p_priority, p_athlete, p_signal_kind,
    coalesce(p_signal_kind, p_kind::text), p_title, p_body, p_href,
    p_dedupe_key, p_deliver_after, p_payload)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;

  -- already told them; not an error, just nothing to do
  if v_id is null then return null; end if;

  foreach v_channel in array p_channels loop
    insert into notification_deliveries (notification_id, user_id, channel)
    values (v_id, p_user, v_channel::im_channel)
    on conflict (notification_id, channel) do nothing;
  end loop;

  return v_id;
end $$;


-- ------------------------------------------------------------
-- READING AND CLEARING
-- ------------------------------------------------------------

create or replace function im_notification_state(p_notification uuid, p_state im_notification_state)
returns void
language plpgsql security definer set search_path = public as $$
begin
  update notifications
     set state = p_state,
         read_at = case when p_state = 'pending' then null else coalesce(read_at, now()) end
   where id = p_notification
     and (user_id = auth.uid() or im_is_admin());
end $$;


-- ------------------------------------------------------------
-- WHAT HAPPENED TO A DELIVERY
--
-- Called by the delivery worker. 'unavailable' is its own outcome and not
-- a failure: a channel nobody configured has not gone wrong, and a coach
-- reading their delivery log deserves to see the difference.
-- ------------------------------------------------------------

create or replace function im_record_delivery(
  p_delivery uuid,
  p_state    im_delivery_state,
  p_detail   text default null
) returns void
language sql security definer set search_path = public as $$
  update notification_deliveries
     set state = p_state,
         detail = p_detail,
         attempts = attempts + 1,
         attempted_at = now(),
         delivered_at = case when p_state = 'delivered' then now() else delivered_at end
   where id = p_delivery;
$$;

-- ======================= 0014_notification_authority.sql =======================

-- ============================================================
-- 0014 — WHO IS ALLOWED TO SAY SOMETHING HAPPENED
--
-- Three holes found by probing 0013 against real Postgres, not by reading it:
--
--   1. im_notify is security definer and only checked that the athlete was on
--      the coach's roster. An athlete could therefore call it directly and
--      write any title and body they liked into their own coach's feed —
--      "Coach, call me now" with a phone number that is not theirs. The roster
--      check answers "is this about someone you coach"; nothing answered "are
--      you allowed to speak at all".
--   2. im_record_delivery had no authorisation check whatsoever. Any signed-in
--      user could mark any delivery on any notification as delivered, which
--      would make the delivery log — the thing this slice uses to avoid
--      claiming success it cannot prove — lie.
--   3. The digest and alert jobs run as the service role, which has no
--      auth.uid(). im_coach_roster resolved the caller to auth.uid() and
--      required im_is_staff(), so a job asking for a coach's roster got zero
--      rows and every digest would have been silently empty. The job would
--      have reported success and sent nothing.
--
-- The fix for all three is the same idea: name the service role explicitly
-- rather than leaving it to fall through a check meant for people.
-- ============================================================


-- The server-side identity: cron jobs, webhooks, migrations. It has no
-- auth.uid() because no person is asking. Deliberately narrow — it is true
-- only when there is no signed-in subject AND the JWT says service_role, so a
-- signed-in user cannot reach it by clearing a claim.
create or replace function im_is_service()
returns boolean language sql stable set search_path = public as $$
  select auth.uid() is null and coalesce(auth.role(), '') = 'service_role';
$$;

comment on function im_is_service is
  'True for the server-side service role only. Never true for a signed-in user.';


-- ------------------------------------------------------------
-- 1. Only the server may put words in a coach's feed.
-- ------------------------------------------------------------

create or replace function im_notify(
  p_user          uuid,
  p_kind          im_notification_kind,
  p_priority      text,
  p_title         text,
  p_body          text,
  p_href          text,
  p_dedupe_key    text,
  p_athlete       uuid default null,
  p_signal_kind   text default null,
  p_deliver_after timestamptz default null,
  p_payload       jsonb default null,
  p_channels      text[] default array['in_app']
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
  v_channel text;
begin
  -- notifications are generated by jobs from canonical roster signals; they
  -- are never composed by a person, so nobody signed in may call this
  if not (im_is_service() or im_is_admin() or auth.uid() is null) then
    raise exception 'Notifications are generated by Iron Miles, not sent by users.';
  end if;

  -- an athlete-specific notification only ever goes to that athlete's coach
  if p_athlete is not null and not exists (
    select 1 from coach_athlete_links l
     where l.athlete_id = p_athlete and l.coach_id = p_user and l.status = 'active'
  ) then
    raise exception 'That athlete is not on that coach''s roster.';
  end if;

  insert into notifications (
    user_id, notification_kind, priority, athlete_id, signal_kind,
    kind, title, body, href, dedupe_key, deliver_after, payload)
  values (
    p_user, p_kind, p_priority, p_athlete, p_signal_kind,
    coalesce(p_signal_kind, p_kind::text), p_title, p_body, p_href,
    p_dedupe_key, p_deliver_after, p_payload)
  on conflict (user_id, dedupe_key) where dedupe_key is not null do nothing
  returning id into v_id;

  -- already told them; not an error, just nothing to do
  if v_id is null then return null; end if;

  foreach v_channel in array p_channels loop
    insert into notification_deliveries (notification_id, user_id, channel)
    values (v_id, p_user, v_channel::im_channel)
    on conflict (notification_id, channel) do nothing;
  end loop;

  return v_id;
end $$;


-- ------------------------------------------------------------
-- 2. Only the delivery worker may say a delivery happened.
--
-- This function is the only evidence the product has that anything actually
-- left the building. If a user can write to it, "delivered" means nothing.
-- ------------------------------------------------------------

create or replace function im_record_delivery(
  p_delivery uuid,
  p_state    im_delivery_state,
  p_detail   text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (im_is_service() or im_is_admin() or auth.uid() is null) then
    raise exception 'Delivery outcomes are recorded by the delivery worker.';
  end if;

  update notification_deliveries
     set state = p_state,
         detail = p_detail,
         attempts = attempts + 1,
         attempted_at = now(),
         delivered_at = case when p_state = 'delivered' then now() else delivered_at end
   where id = p_delivery;
end $$;


-- ------------------------------------------------------------
-- 3. The digest job must be able to read the roster it is summarising.
--
-- Unchanged in every other respect: a coach passing another coach's id still
-- gets their own roster. The only new caller is the service role, which must
-- name the coach explicitly because it has no identity of its own.
-- ------------------------------------------------------------

create or replace function im_coach_roster(
  p_coach uuid default null,
  p_today date default current_date
)
returns table (
  athlete_id            uuid,
  full_name             text,
  avatar_url            text,
  joined_at             timestamptz,

  programme_id          uuid,
  programme_name        text,
  programme_end_date    date,
  block_name            text,
  phase                 im_phase,
  week_no               integer,
  total_weeks           integer,

  planned_this_week     integer,
  completed_this_week   integer,
  planned_four_weeks    integer,
  completed_four_weeks  integer,

  missed_fourteen_days  integer,
  missed_key_name       text,
  missed_key_date       date,

  last_completed_date   date,
  last_completed_name   text,
  next_session_date     date,
  next_session_name     text,
  future_sessions       integer,

  checkin_week_start    date,
  checkin_submitted_at  timestamptz,
  checkin_attention     im_attention,
  checkin_reasons       text[],
  checkin_reviewed_at   timestamptz,
  checkin_fatigue       smallint,
  checkin_soreness      smallint,
  checkin_pain          text,

  race_id               uuid,
  race_name             text,
  race_date             date,
  goal_event_type       im_event_type,

  unread_from_athlete   integer,
  recent_adaptations    integer
)
language sql stable security definer set search_path = public as $$
with
  -- who the caller may see. A coach passing another coach's id gets their
  -- own roster, not that coach's: the link table is the authority, never
  -- the argument.
  me as (
    select case
             when (im_is_admin() or im_is_service()) and p_coach is not null then p_coach
             else auth.uid()
           end as coach_id
  ),
  roster as (
    select l.athlete_id, l.started_at
      from coach_athlete_links l, me
     where l.coach_id = me.coach_id
       and l.status = 'active'
       and (im_is_staff() or im_is_service())
  ),
  -- the athlete's live programme, and where they are in it
  prog as (
    select p.athlete_id, p.id, p.name, p.end_date,
           (select count(*)::integer from program_weeks w where w.program_id = p.id) total_weeks
      from programs p
      join roster r on r.athlete_id = p.athlete_id
     where p.status = 'active'
  ),
  this_week as (
    select w.program_id, w.id week_id, w.program_week_no, b.name block_name, b.phase
      from program_weeks w
      join program_blocks b on b.id = w.block_id
      join prog on prog.id = w.program_id
     where p_today >= w.start_date and p_today < w.start_date + 7
  ),
  -- every count over sessions comes from one pass, not one query each
  sessions as (
    select
      s.athlete_id,
      count(*) filter (
        where s.date >= date_trunc('week', p_today)::date
          and s.date <= p_today and s.type <> 'rest')::integer planned_week,
      count(*) filter (
        where s.date >= date_trunc('week', p_today)::date
          and s.date <= p_today and s.type <> 'rest' and s.status = 'completed')::integer done_week,
      count(*) filter (
        where s.date >= p_today - 27 and s.date <= p_today and s.type <> 'rest')::integer planned_month,
      count(*) filter (
        where s.date >= p_today - 27 and s.date <= p_today
          and s.type <> 'rest' and s.status = 'completed')::integer done_month,
      count(*) filter (
        where s.date >= p_today - 13 and s.date <= p_today
          and s.type <> 'rest' and s.status = 'missed')::integer missed_fortnight,
      count(*) filter (where s.date >= p_today and s.status = 'scheduled')::integer future_count
    from scheduled_workouts s
    join roster r on r.athlete_id = s.athlete_id
    group by s.athlete_id
  )
select
  pr.id,
  pr.full_name,
  pr.avatar_url,
  r.started_at,

  prog.id,
  prog.name,
  prog.end_date,
  tw.block_name,
  tw.phase,
  tw.program_week_no::integer,
  prog.total_weeks,

  coalesce(sess.planned_week, 0),
  coalesce(sess.done_week, 0),
  coalesce(sess.planned_month, 0),
  coalesce(sess.done_month, 0),

  coalesce(sess.missed_fortnight, 0),
  key_missed.name,
  key_missed.date,

  last_done.date,
  last_done.name,
  next_up.date,
  next_up.name,
  coalesce(sess.future_count, 0),

  ci.week_start,
  ci.submitted_at,
  ci.attention_level,
  ci.attention_reasons,
  ci.reviewed_by_coach_at,
  ci.fatigue,
  ci.soreness,
  nullif(btrim(coalesce(ci.pain_or_niggles, '')), ''),

  race.id,
  race.name,
  race.date,
  race.event_type,

  coalesce(msg.unread, 0)::integer,
  coalesce(adapt.recent, 0)::integer

from roster r
join profiles pr on pr.id = r.athlete_id
left join prog on prog.athlete_id = r.athlete_id
left join this_week tw on tw.program_id = prog.id
left join sessions sess on sess.athlete_id = r.athlete_id

-- a missed session worth naming: the hard ones, most recent first
left join lateral (
  select s.name, s.date
    from scheduled_workouts s
   where s.athlete_id = r.athlete_id
     and s.status = 'missed'
     and s.date >= p_today - 13
     and s.type in ('long_run','threshold','intervals','race_pace','hills','tempo','brick','race')
   order by s.date desc
   limit 1
) key_missed on true

left join lateral (
  select s.date, s.name
    from scheduled_workouts s
   where s.athlete_id = r.athlete_id and s.status = 'completed'
   order by s.date desc
   limit 1
) last_done on true

left join lateral (
  select s.date, s.name
    from scheduled_workouts s
   where s.athlete_id = r.athlete_id and s.status = 'scheduled' and s.date >= p_today
     and s.type <> 'rest'
   order by s.date, s.slot
   limit 1
) next_up on true

left join lateral (
  select c.* from checkins c
   where c.athlete_id = r.athlete_id
   order by c.week_start desc
   limit 1
) ci on true

left join lateral (
  select ra.id, ra.name, ra.date, g.event_type
    from goals g join races ra on ra.id = g.race_id
   where g.athlete_id = r.athlete_id and ra.date >= p_today
   order by ra.date
   limit 1
) race on true

-- messages reach an athlete through their thread with this coach
left join lateral (
  select count(*)::integer unread
    from messages m
    join message_threads th on th.id = m.thread_id
    cross join me
   where th.athlete_id = r.athlete_id
     and m.recipient_id = me.coach_id
     and m.read_at is null
) msg on true

-- what this coach changed for them lately, so the roster does not report a
-- deliberate adaptation as if it were a surprise
left join lateral (
  select count(*)::integer recent
    from session_revisions sr, me
   where sr.athlete_id = r.athlete_id
     and sr.changed_by = me.coach_id
     and sr.changed_at >= (p_today - 6)::timestamptz
     and sr.kind <> 'created'
) adapt on true

order by pr.full_name;
$$;

comment on function im_coach_roster is
  'One row of facts per athlete on the caller''s roster. Judgement lives in the domain layer.';

-- ======================= 0015_email_delivery.sql =======================

-- ============================================================
-- 0015 — REAL EXTERNAL DELIVERY
--
-- Slice 8 could say "we told your coach" and mean only that a row existed.
-- With a real provider in the loop that is no longer good enough: an accepted
-- API call and a message landing in a mailbox are different events, minutes
-- apart, and either can fail without the other.
--
-- So the delivery record grows the four things needed to answer "what
-- actually happened to this email":
--
--   * which provider handled it, by name
--   * the provider's own message id, so a webhook can find its way back
--   * whether the failure was worth retrying, or final
--   * when the next attempt is due, so retries back off instead of hammering
--
-- NOTE ON THE ENUM. Postgres will not let a new enum value be used in DDL in
-- the same transaction that adds it — an index predicate or a default naming
-- 'sent' here would fail with "unsafe use of new value". Function bodies are
-- parsed at call time, so they are fine, and every use below is inside one.
-- ============================================================

alter type im_delivery_state add value if not exists 'sent'             after 'pending';
alter type im_delivery_state add value if not exists 'failed_permanent' after 'failed';


alter table notification_deliveries
  -- 'resend', or 'demo' when the environment simulates. Recorded on every row
  -- so nobody has to infer from dates which provider was live at the time.
  add column if not exists provider            text,
  add column if not exists provider_message_id text,
  -- null means "attemptable now". Set into the future by the retry backoff.
  add column if not exists next_attempt_at     timestamptz,
  -- webhooks arrive out of order and more than once; this is what the last one
  -- said, and it is only ever allowed to move a delivery forwards.
  add column if not exists provider_status     text,
  add column if not exists provider_status_at  timestamptz;

-- the webhook's only way in: it knows the provider's id and nothing else
create index if not exists notification_deliveries_provider_message
  on notification_deliveries (provider_message_id)
  where provider_message_id is not null;

create index if not exists notification_deliveries_due
  on notification_deliveries (next_attempt_at);

comment on column notification_deliveries.provider_message_id is
  'The provider''s id for this message. The only handle a delivery webhook has.';


-- ------------------------------------------------------------
-- RECORDING AN ATTEMPT
--
-- Replaces the 0014 version. Same authorisation rule — only the worker may
-- say what happened — with the provider detail the old signature had no room
-- for. Kept as a separate name rather than more optional arguments so the two
-- callers cannot be confused: this one is an *attempt*, the webhook below is
-- someone else's later report about it.
-- ------------------------------------------------------------

create or replace function im_record_attempt(
  p_delivery   uuid,
  p_state      im_delivery_state,
  p_detail     text default null,
  p_provider   text default null,
  p_message_id text default null,
  p_retry_at   timestamptz default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (im_is_service() or im_is_admin() or auth.uid() is null) then
    raise exception 'Delivery outcomes are recorded by the delivery worker.';
  end if;

  update notification_deliveries
     set state        = p_state,
         detail       = p_detail,
         attempts     = attempts + 1,
         attempted_at = now(),
         provider     = coalesce(p_provider, provider),
         -- never overwrite a real id with a null from a later failed attempt
         provider_message_id = coalesce(p_message_id, provider_message_id),
         next_attempt_at = case
                             when p_state = 'failed' then p_retry_at
                             else null
                           end,
         delivered_at = case when p_state = 'delivered' then now() else delivered_at end
   where id = p_delivery;
end $$;

comment on function im_record_attempt is
  'One send attempt and what became of it. Worker-only.';


-- ------------------------------------------------------------
-- WHAT THE PROVIDER SAID AFTERWARDS
--
-- A delivery webhook is a different kind of claim from an attempt: it arrives
-- later, out of order, sometimes twice, and it must never resurrect a delivery
-- into being retried. So it only moves state forwards along
--
--     sent → delivered
--     sent → failed_permanent   (a hard bounce or a complaint)
--
-- and is ignored entirely for anything else, including a second copy of an
-- event already applied.
-- ------------------------------------------------------------

create or replace function im_record_provider_status(
  p_message_id text,
  p_status     text,
  p_detail     text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_row notification_deliveries;
begin
  if not (im_is_service() or im_is_admin() or auth.uid() is null) then
    raise exception 'Provider status is recorded by the webhook endpoint.';
  end if;

  select * into v_row from notification_deliveries
   where provider_message_id = p_message_id
   limit 1;

  -- an event for a message this deployment never sent; nothing to do, and not
  -- an error — a webhook may well be replayed at a rebuilt environment
  if v_row.id is null then return false; end if;

  if p_status = 'delivered' and v_row.state = 'sent' then
    update notification_deliveries
       set state = 'delivered', delivered_at = now(),
           detail = coalesce(p_detail, 'Delivered to the mailbox.'),
           provider_status = p_status, provider_status_at = now(),
           next_attempt_at = null
     where id = v_row.id;
    return true;
  end if;

  if p_status in ('bounced', 'complained') and v_row.state in ('sent', 'failed') then
    update notification_deliveries
       set state = 'failed_permanent',
           detail = coalesce(p_detail, 'The provider reported a permanent failure.'),
           provider_status = p_status, provider_status_at = now(),
           next_attempt_at = null
     where id = v_row.id;
    return true;
  end if;

  -- record that it arrived even when it changes nothing, so a duplicate or a
  -- late event is visible rather than silently discarded
  update notification_deliveries
     set provider_status = p_status, provider_status_at = now()
   where id = v_row.id;
  return false;
end $$;

comment on function im_record_provider_status is
  'A provider''s later report about a message. Only ever moves a delivery forwards.';

-- ======================= 0016_batch_operations.sql =======================

-- ============================================================
-- 0016 — ONE COACHING DECISION, SEVERAL ATHLETES
--
-- What this migration deliberately does NOT do is as important as what it
-- does. There is no im_batch_assign_template, no im_batch_scale_volume, no
-- privileged function that takes uuid[] and loops inside the database.
--
-- Every one of the three batch actions is already a secure, authorised,
-- preview-then-apply function that operates on one athlete:
--
--   im_instantiate_program_template(p_template, p_athlete, ...)
--   im_scale_volume(p_athlete, p_from, p_to, p_factor, p_apply)
--   im_shift_sessions(p_athlete, p_from, p_to, p_days, p_apply)
--
-- Each already refuses an athlete the caller does not coach, refuses to touch
-- completed training, refuses to move a session into the past or outside its
-- programme, and reports per session what it did. A batch is those functions
-- called once per athlete, from the application, each in its own statement.
--
-- That choice buys three things a loop inside one big function would not:
--
--   * authorisation is re-checked per athlete by the existing guard, so a
--     poisoned list cannot ride in on one authorised id
--   * one athlete failing cannot roll back the others, because they were
--     never in the same transaction
--   * there is exactly one definition of "assign a programme", so a batch and
--     a single assignment can never drift apart
--
-- What is genuinely missing, and all this migration adds, is the record that
-- says several individual changes were one decision. It sits BESIDE the
-- per-session history from 0005 and replaces none of it: session_revisions
-- still holds what changed, who changed it and when, per athlete, exactly as
-- before. This adds why several of them changed at once.
-- ============================================================

create type im_batch_action as enum (
  'assign_template',
  'scale_volume',
  'shift_sessions'
);

-- 'skipped' is not a failure: the athlete for whom the action would change
-- nothing. Recording it as applied would overstate the batch.
create type im_batch_outcome as enum (
  'applied',
  'skipped',
  'blocked',
  'failed',
  'unauthorised'
);


create table if not exists coach_batches (
  id          uuid primary key default gen_random_uuid(),
  coach_id    uuid not null references profiles(id) on delete cascade,
  action      im_batch_action not null,
  -- what the coach chose: template id, factor, days, date range. Kept as
  -- given so the record can be read back years later without joining to a
  -- template that may since have been edited or archived.
  params      jsonb not null default '{}'::jsonb,
  -- what the coach was told before they confirmed, so a surprising outcome
  -- can be compared against the preview they approved
  intended    integer not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists coach_batches_by_coach
  on coach_batches (coach_id, created_at desc);


create table if not exists coach_batch_items (
  id          uuid primary key default gen_random_uuid(),
  batch_id    uuid not null references coach_batches(id) on delete cascade,
  athlete_id  uuid not null references profiles(id) on delete cascade,
  outcome     im_batch_outcome not null,
  -- in the coach's language. "Start date is before their last completed
  -- session", not a constraint name.
  detail      text,
  -- what the action produced, so the record leads somewhere
  program_id  uuid references programs(id) on delete set null,
  session_ids uuid[] not null default '{}',
  created_at  timestamptz not null default now(),
  unique (batch_id, athlete_id)
);

create index if not exists coach_batch_items_by_athlete
  on coach_batch_items (athlete_id, created_at desc);

comment on table coach_batches is
  'One coaching decision applied to several athletes. The per-session history in session_revisions is unchanged and remains the record of what changed.';
comment on column coach_batch_items.session_ids is
  'The sessions this athlete''s part of the batch touched, as reported by the single-athlete function that touched them.';


-- ------------------------------------------------------------
-- WHO MAY READ AND WRITE A BATCH RECORD
--
-- A coach reads their own. An athlete reads the items about themselves —
-- they are entitled to know their programme changed as part of a squad-wide
-- decision rather than something aimed at them.
-- ------------------------------------------------------------

alter table coach_batches enable row level security;
alter table coach_batch_items enable row level security;

create policy coach_batches_read on coach_batches
  for select using (coach_id = auth.uid() or im_is_admin());

create policy coach_batch_items_read on coach_batch_items
  for select using (
    athlete_id = auth.uid()
    or exists (select 1 from coach_batches b
                where b.id = batch_id and (b.coach_id = auth.uid() or im_is_admin()))
  );

-- No insert or update policy at all: the two functions below are the only way
-- in, and both are security definer with their own checks. A coach cannot
-- hand-write a record of something they did not do.


-- ------------------------------------------------------------
-- OPENING A BATCH
-- ------------------------------------------------------------

create or replace function im_open_batch(
  p_action   im_batch_action,
  p_params   jsonb default '{}'::jsonb,
  p_intended integer default 0
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_id uuid;
begin
  -- the batch belongs to whoever is asking, never to an id they supply
  if not im_is_staff() then
    raise exception 'Only a coach runs a batch.';
  end if;

  insert into coach_batches (coach_id, action, params, intended)
  values (auth.uid(), p_action, coalesce(p_params, '{}'::jsonb), greatest(p_intended, 0))
  returning id into v_id;

  return v_id;
end $$;

comment on function im_open_batch is
  'Starts a batch record for the calling coach. The athletes are recorded one at a time as each single-athlete operation returns.';


-- ------------------------------------------------------------
-- RECORDING WHAT HAPPENED TO ONE ATHLETE
--
-- Called once per athlete, after that athlete's own operation has already
-- succeeded or failed. It re-checks the roster rather than trusting that the
-- batch's owner coaches this athlete: the whole point of the per-athlete
-- design is that one authorised id never vouches for the rest of a list.
--
-- The one deliberate exception is 'unauthorised' itself, which must be
-- recordable precisely because the athlete is not on the roster — otherwise a
-- poisoned list would vanish from the record instead of being reported.
-- ------------------------------------------------------------

create or replace function im_record_batch_item(
  p_batch    uuid,
  p_athlete  uuid,
  p_outcome  im_batch_outcome,
  p_detail   text default null,
  p_program  uuid default null,
  p_sessions uuid[] default '{}'
) returns void
language plpgsql security definer set search_path = public as $$
declare
  v_owner uuid;
begin
  select coach_id into v_owner from coach_batches where id = p_batch;
  if v_owner is null then
    raise exception 'No such batch.';
  end if;
  if v_owner <> auth.uid() and not im_is_admin() then
    raise exception 'That is not your batch.';
  end if;

  if p_outcome <> 'unauthorised'
     and not (im_is_coach_of(p_athlete) or im_is_admin()) then
    raise exception 'That athlete is not on your roster.';
  end if;

  insert into coach_batch_items
    (batch_id, athlete_id, outcome, detail, program_id, session_ids)
  values
    (p_batch, p_athlete, p_outcome, p_detail, p_program, coalesce(p_sessions, '{}'))
  -- a retried batch reports the same athlete once, with the latest outcome
  on conflict (batch_id, athlete_id) do update
    set outcome     = excluded.outcome,
        detail      = excluded.detail,
        program_id  = coalesce(excluded.program_id, coach_batch_items.program_id),
        session_ids = excluded.session_ids;
end $$;

comment on function im_record_batch_item is
  'Records one athlete''s outcome within a batch. Re-checks the roster per athlete; one authorised id never vouches for a list.';


-- ------------------------------------------------------------
-- READING A BATCH BACK
--
-- Answers the question a coach asks a week later: "why did four athletes all
-- get an easier week on the 16th?"
-- ------------------------------------------------------------

create or replace function im_batch_history(p_athlete uuid, p_limit integer default 20)
returns table (
  batch_id     uuid,
  action       im_batch_action,
  params       jsonb,
  outcome      im_batch_outcome,
  detail       text,
  athlete_count integer,
  created_at   timestamptz
)
language sql stable security definer set search_path = public as $$
  select b.id, b.action, b.params, i.outcome, i.detail,
         (select count(*)::integer from coach_batch_items x where x.batch_id = b.id),
         b.created_at
    from coach_batch_items i
    join coach_batches b on b.id = i.batch_id
   where i.athlete_id = p_athlete
     and (im_can_read_athlete(p_athlete) or p_athlete = auth.uid())
   order by b.created_at desc
   limit greatest(p_limit, 1);
$$;

comment on function im_batch_history is
  'The batches that touched this athlete, so a coach can see that a change was part of a squad-wide decision.';

-- ======================= 0017_checkin_acknowledgement.sql =======================

-- ============================================================
-- 0017 — READ IS NOT REPLIED, AND NEITHER IS RESOLVED
--
-- A check-in had two conditions: unanswered, or answered with typed text.
-- The only way out of the coach's queue was to type something, so at forty
-- athletes a coach either wrote thirty-one replies a week or watched the
-- counter climb until they stopped believing it. Twenty-five of those
-- thirty-one are athletes reporting an ordinary week.
--
-- This migration gives a check-in three distinguishable states:
--
--   unread      nobody has looked at it
--   read        a coach deliberately marked it read; no reply was sent
--   replied     a coach wrote something back
--
-- and keeps a fourth thing separate from all of them: whether the check-in
-- still represents a coaching concern. A coach reading "my Achilles is sore"
-- has not made the Achilles better. Communication state and attention state
-- are different facts about the same check-in, and conflating them is how a
-- product quietly loses an injury.
--
-- WHAT READS WHAT, AFTER THIS:
--
--   checkin_unreviewed signal, the queue, "check-ins to read"
--       -> acknowledged_at.       Marking read clears these. That is the point.
--   checkin_flagged signal
--       -> responded_at.          Acknowledging does NOT clear it; a flagged
--                                 check-in is dealt with by answering it.
--   soreness_reported signal
--       -> unchanged, and never depended on read state. Reported pain stays
--          on the roster whatever the coach has clicked.
-- ============================================================

alter table checkins
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid references profiles(id) on delete set null,
  add column if not exists responded_at    timestamptz;

comment on column checkins.acknowledged_at is
  'When a coach deliberately marked this read. Never set by viewing a page.';
comment on column checkins.acknowledged_by is
  'Which coach read it. Answering "who has seen this" without inference.';
comment on column checkins.responded_at is
  'When a coach wrote back. A reply implies a read; a read implies nothing.';

-- Everything already reviewed was reviewed by replying — that was the only
-- route that existed — so it is both acknowledged and responded.
update checkins
   set acknowledged_at = coalesce(acknowledged_at, reviewed_by_coach_at),
       responded_at    = coalesce(responded_at,
                                  case when coach_response is not null
                                       then reviewed_by_coach_at end)
 where reviewed_by_coach_at is not null;

-- The queue asks "what has nobody looked at", which is now a different
-- question from the one the old index answered.
drop index if exists checkins_attention_level_idx;
create index if not exists checkins_unacknowledged
  on checkins (athlete_id, attention_level)
  where acknowledged_at is null;

create index if not exists checkins_unanswered
  on checkins (athlete_id)
  where responded_at is null;


-- ------------------------------------------------------------
-- MARKING ONE CHECK-IN READ
--
-- Deliberately its own function rather than an argument to the responder:
-- the two are different acts and the record should not have to be
-- reverse-engineered from whether a text field happens to be empty.
--
-- Idempotent. Marking a check-in read twice keeps the first timestamp, so a
-- batch retried after a failure does not rewrite when the coach actually
-- looked.
-- ------------------------------------------------------------

create or replace function im_acknowledge_checkin(p_checkin uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_athlete uuid;
  v_already timestamptz;
begin
  select athlete_id, acknowledged_at into v_athlete, v_already
    from checkins where id = p_checkin;

  if v_athlete is null then
    raise exception 'No such check-in.';
  end if;

  -- per check-in, every time. A coach acknowledging thirty of their own
  -- athletes never earns the right to acknowledge someone else's.
  if not (im_is_coach_of(v_athlete) or im_is_admin()) then
    raise exception 'That athlete is not on your roster.';
  end if;

  if v_already is not null then
    return false;                       -- already read; nothing to record
  end if;

  update checkins
     set acknowledged_at = now(),
         acknowledged_by = auth.uid(),
         -- kept in step for anything still reading the original column;
         -- acknowledged_at is the one this product now believes
         reviewed_by_coach_at = coalesce(reviewed_by_coach_at, now())
   where id = p_checkin;

  return true;
end $$;

comment on function im_acknowledge_checkin is
  'A coach states they have read a check-in. Never called by rendering a page.';


-- ------------------------------------------------------------
-- REPLYING
--
-- A reply is also a read — you cannot answer something you have not looked
-- at — but the record keeps them apart so "did my coach write back" and "has
-- my coach seen this" stay different questions with different answers.
-- ------------------------------------------------------------

create or replace function im_respond_to_checkin(p_checkin uuid, p_response text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_athlete uuid;
begin
  select athlete_id into v_athlete from checkins where id = p_checkin;
  if v_athlete is null then
    raise exception 'No such check-in.';
  end if;
  if not (im_is_coach_of(v_athlete) or im_is_admin()) then
    raise exception 'That athlete is not on your roster.';
  end if;
  if coalesce(length(btrim(p_response)), 0) < 2 then
    raise exception 'Write a response first.';
  end if;

  update checkins
     set coach_response      = p_response,
         responded_at        = now(),
         -- an unread check-in that gets a reply was, necessarily, read
         acknowledged_at     = coalesce(acknowledged_at, now()),
         acknowledged_by     = coalesce(acknowledged_by, auth.uid()),
         reviewed_by_coach_at = coalesce(reviewed_by_coach_at, now())
   where id = p_checkin;
end $$;

comment on function im_respond_to_checkin is
  'A coach writes back. Implies a read; the two timestamps stay distinct.';


-- ------------------------------------------------------------
-- WHOSE COLUMNS ARE WHOSE
--
-- Found by probing this migration, and older than it: the athlete's own-write
-- policy is `for all`, so an athlete could update any column on their own
-- check-in. In practice that meant they could write a coach_response their
-- coach never said, and set reviewed_by_coach_at so it left the coach's queue
-- without the coach ever seeing it.
--
-- Slice 10 would have made that worse by adding three more coach-owned
-- columns to the same row. RLS cannot restrict columns, so this does:
-- an athlete may rewrite their own answers — check-ins are upserted, and
-- resubmitting a week is a legitimate thing to do — but the five columns that
-- record what a coach did are not theirs to touch.
-- ------------------------------------------------------------

create or replace function im_guard_checkin_coach_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- migrations, the service role and the coach themselves
  if auth.uid() is null or im_is_coach_of(new.athlete_id) or im_is_admin() then
    return new;
  end if;

  if new.coach_response       is distinct from old.coach_response
     or new.acknowledged_at   is distinct from old.acknowledged_at
     or new.acknowledged_by   is distinct from old.acknowledged_by
     or new.responded_at      is distinct from old.responded_at
     or new.reviewed_by_coach_at is distinct from old.reviewed_by_coach_at then
    raise exception 'What a coach said, and whether they have read this, is not yours to write.';
  end if;

  return new;
end $$;

drop trigger if exists t_checkin_coach_fields on checkins;
create trigger t_checkin_coach_fields
  before update on checkins
  for each row execute function im_guard_checkin_coach_fields();

comment on function im_guard_checkin_coach_fields is
  'An athlete owns their answers. A coach owns the record of having read and replied.';


-- ------------------------------------------------------------
-- THE ROSTER CARRIES BOTH FACTS
--
-- Redefined rather than replaced: identical to 0014 except that it returns
-- acknowledged_at and responded_at where it used to return one merged
-- column. The domain then decides which signal reads which — and it is that
-- separation, not this function, that keeps a flagged check-in on the roster
-- after a coach has read it.
-- ------------------------------------------------------------

drop function if exists im_coach_roster(uuid, date);

create or replace function im_coach_roster(
  p_coach uuid default null,
  p_today date default current_date
)
returns table (
  athlete_id            uuid,
  full_name             text,
  avatar_url            text,
  joined_at             timestamptz,

  programme_id          uuid,
  programme_name        text,
  programme_end_date    date,
  block_name            text,
  phase                 im_phase,
  week_no               integer,
  total_weeks           integer,

  planned_this_week     integer,
  completed_this_week   integer,
  planned_four_weeks    integer,
  completed_four_weeks  integer,

  missed_fourteen_days  integer,
  missed_key_name       text,
  missed_key_date       date,

  last_completed_date   date,
  last_completed_name   text,
  next_session_date     date,
  next_session_name     text,
  future_sessions       integer,

  checkin_id            uuid,
  checkin_week_start    date,
  checkin_submitted_at  timestamptz,
  checkin_attention     im_attention,
  checkin_reasons       text[],
  checkin_acknowledged_at timestamptz,
  checkin_responded_at    timestamptz,
  checkin_fatigue       smallint,
  checkin_soreness      smallint,
  checkin_pain          text,

  race_id               uuid,
  race_name             text,
  race_date             date,
  goal_event_type       im_event_type,

  unread_from_athlete   integer,
  recent_adaptations    integer
)
language sql stable security definer set search_path = public as $$
with
  -- who the caller may see. A coach passing another coach's id gets their
  -- own roster, not that coach's: the link table is the authority, never
  -- the argument.
  me as (
    select case
             when (im_is_admin() or im_is_service()) and p_coach is not null then p_coach
             else auth.uid()
           end as coach_id
  ),
  roster as (
    select l.athlete_id, l.started_at
      from coach_athlete_links l, me
     where l.coach_id = me.coach_id
       and l.status = 'active'
       and (im_is_staff() or im_is_service())
  ),
  -- the athlete's live programme, and where they are in it
  prog as (
    select p.athlete_id, p.id, p.name, p.end_date,
           (select count(*)::integer from program_weeks w where w.program_id = p.id) total_weeks
      from programs p
      join roster r on r.athlete_id = p.athlete_id
     where p.status = 'active'
  ),
  this_week as (
    select w.program_id, w.id week_id, w.program_week_no, b.name block_name, b.phase
      from program_weeks w
      join program_blocks b on b.id = w.block_id
      join prog on prog.id = w.program_id
     where p_today >= w.start_date and p_today < w.start_date + 7
  ),
  -- every count over sessions comes from one pass, not one query each
  sessions as (
    select
      s.athlete_id,
      count(*) filter (
        where s.date >= date_trunc('week', p_today)::date
          and s.date <= p_today and s.type <> 'rest')::integer planned_week,
      count(*) filter (
        where s.date >= date_trunc('week', p_today)::date
          and s.date <= p_today and s.type <> 'rest' and s.status = 'completed')::integer done_week,
      count(*) filter (
        where s.date >= p_today - 27 and s.date <= p_today and s.type <> 'rest')::integer planned_month,
      count(*) filter (
        where s.date >= p_today - 27 and s.date <= p_today
          and s.type <> 'rest' and s.status = 'completed')::integer done_month,
      count(*) filter (
        where s.date >= p_today - 13 and s.date <= p_today
          and s.type <> 'rest' and s.status = 'missed')::integer missed_fortnight,
      count(*) filter (where s.date >= p_today and s.status = 'scheduled')::integer future_count
    from scheduled_workouts s
    join roster r on r.athlete_id = s.athlete_id
    group by s.athlete_id
  )
select
  pr.id,
  pr.full_name,
  pr.avatar_url,
  r.started_at,

  prog.id,
  prog.name,
  prog.end_date,
  tw.block_name,
  tw.phase,
  tw.program_week_no::integer,
  prog.total_weeks,

  coalesce(sess.planned_week, 0),
  coalesce(sess.done_week, 0),
  coalesce(sess.planned_month, 0),
  coalesce(sess.done_month, 0),

  coalesce(sess.missed_fortnight, 0),
  key_missed.name,
  key_missed.date,

  last_done.date,
  last_done.name,
  next_up.date,
  next_up.name,
  coalesce(sess.future_count, 0),

  ci.id,
  ci.week_start,
  ci.submitted_at,
  ci.attention_level,
  ci.attention_reasons,
  ci.acknowledged_at,
  ci.responded_at,
  ci.fatigue,
  ci.soreness,
  nullif(btrim(coalesce(ci.pain_or_niggles, '')), ''),

  race.id,
  race.name,
  race.date,
  race.event_type,

  coalesce(msg.unread, 0)::integer,
  coalesce(adapt.recent, 0)::integer

from roster r
join profiles pr on pr.id = r.athlete_id
left join prog on prog.athlete_id = r.athlete_id
left join this_week tw on tw.program_id = prog.id
left join sessions sess on sess.athlete_id = r.athlete_id

-- a missed session worth naming: the hard ones, most recent first
left join lateral (
  select s.name, s.date
    from scheduled_workouts s
   where s.athlete_id = r.athlete_id
     and s.status = 'missed'
     and s.date >= p_today - 13
     and s.type in ('long_run','threshold','intervals','race_pace','hills','tempo','brick','race')
   order by s.date desc
   limit 1
) key_missed on true

left join lateral (
  select s.date, s.name
    from scheduled_workouts s
   where s.athlete_id = r.athlete_id and s.status = 'completed'
   order by s.date desc
   limit 1
) last_done on true

left join lateral (
  select s.date, s.name
    from scheduled_workouts s
   where s.athlete_id = r.athlete_id and s.status = 'scheduled' and s.date >= p_today
     and s.type <> 'rest'
   order by s.date, s.slot
   limit 1
) next_up on true

left join lateral (
  select c.* from checkins c
   where c.athlete_id = r.athlete_id
   order by c.week_start desc
   limit 1
) ci on true

left join lateral (
  select ra.id, ra.name, ra.date, g.event_type
    from goals g join races ra on ra.id = g.race_id
   where g.athlete_id = r.athlete_id and ra.date >= p_today
   order by ra.date
   limit 1
) race on true

-- messages reach an athlete through their thread with this coach
left join lateral (
  select count(*)::integer unread
    from messages m
    join message_threads th on th.id = m.thread_id
    cross join me
   where th.athlete_id = r.athlete_id
     and m.recipient_id = me.coach_id
     and m.read_at is null
) msg on true

-- what this coach changed for them lately, so the roster does not report a
-- deliberate adaptation as if it were a surprise
left join lateral (
  select count(*)::integer recent
    from session_revisions sr, me
   where sr.athlete_id = r.athlete_id
     and sr.changed_by = me.coach_id
     and sr.changed_at >= (p_today - 6)::timestamptz
     and sr.kind <> 'created'
) adapt on true

order by pr.full_name;
$$;

comment on function im_coach_roster is
  'One row of facts per athlete on the caller''s roster. Judgement lives in the domain layer.';

-- ======================= 0018_checkin_triage_floor.sql =======================

-- =============================================================================
-- 0018 — an athlete cannot mark their own check-in as nothing to see
-- =============================================================================
--
-- Slice 10 closed most of `checkins_own_write` being `for all`: a trigger now
-- stops an athlete writing a coach_response, an acknowledgement, or a reply
-- timestamp. One column was left open and reported as a known limitation --
-- `attention_level`. An athlete resubmitting their week could send honest
-- scores and a hand-picked level of 'none', and the check-in that said
-- "soreness 9" would never reach the coach's flagged list.
--
-- The rules that decide the level live in TypeScript (checkin-rules.ts) and
-- that is where they belong: they read free text, they compare against last
-- week, and porting them into SQL would create a second definition of triage
-- that silently drifts from the first. So this does not recompute triage.
--
-- It enforces a FLOOR, from the part of the input that is already sitting in
-- columns on this row: the six scores the athlete chose themselves. A level
-- may be raised above the floor -- the TypeScript rules do exactly that for
-- described pain, for two bad weeks running, for missed sessions -- but it
-- can never be written below it. What an athlete typed into the scores cannot
-- be contradicted by what they claim it amounts to.
--
-- The thresholds below are a strict subset of checkin-rules.ts. That is
-- duplication, and it is deliberate; supabase/test/checkin-triage-floor.test
-- runs both over the same inputs and fails if the floor ever exceeds what the
-- canonical rules produce, so the two cannot drift apart quietly.

create or replace function im_checkin_score_floor(
  p_soreness    smallint,
  p_fatigue     smallint,
  p_sleep       smallint,
  p_motivation  smallint,
  p_stress      smallint,
  p_confidence  smallint
) returns im_attention
language sql immutable as $$
  -- the score half of the canonical reason list, counted the same way
  select case
    when (
      (p_soreness   >= 8)::int + (p_fatigue    >= 8)::int +
      (p_sleep      <= 3)::int + (p_motivation <= 3)::int +
      (p_stress     >= 8)::int + (p_confidence <= 3)::int
    ) >= 2 then 'attention'::im_attention
    when (
      (p_soreness   >= 8)::int + (p_fatigue    >= 8)::int +
      (p_sleep      <= 3)::int + (p_motivation <= 3)::int +
      (p_stress     >= 8)::int + (p_confidence <= 3)::int
    ) = 1 then 'watch'::im_attention
    else 'none'::im_attention
  end;
$$;

comment on function im_checkin_score_floor is
  'The least attention a check-in can be given, from its scores alone. A '
  'strict subset of the canonical rules in checkin-rules.ts, never the whole '
  'of them: it exists so the level cannot be written below what the athlete''s '
  'own numbers already say.';

create or replace function im_enforce_checkin_floor()
returns trigger language plpgsql as $$
declare
  floor_level im_attention;
begin
  floor_level := im_checkin_score_floor(
    new.soreness, new.fatigue, new.sleep,
    new.motivation, new.stress, new.confidence);

  -- raised, not rejected. A correct client never trips this, because the
  -- canonical rules already return at least the floor; a request that tries
  -- to go under it is simply brought back up rather than failing in the
  -- athlete's face for something they did not do wrong.
  if floor_level = 'attention' and new.attention_level <> 'attention' then
    new.attention_level := 'attention';
  elsif floor_level = 'watch' and new.attention_level = 'none' then
    new.attention_level := 'watch';
  end if;

  return new;
end $$;

drop trigger if exists checkins_triage_floor on checkins;
create trigger checkins_triage_floor
  before insert or update on checkins
  for each row execute function im_enforce_checkin_floor();

-- ======================= 0019_batch_action_acknowledge.sql =======================

-- =============================================================================
-- 0019 — the batch action Slice 10 shipped but never told Postgres about
-- =============================================================================
--
-- Slice 10 added 'acknowledge_checkin' to the BatchAction union in TypeScript
-- and wired "mark these read" into the roster's batch bar. It did not add the
-- value to `im_batch_action`, so every one of those batches would have failed
-- against a real database with
--
--   invalid input value for enum im_batch_action: "acknowledge_checkin"
--
-- while passing against the demo adapter, whose actions are plain strings.
-- The Slice 10 Postgres tests exercised im_acknowledge_checkin directly and
-- never through im_open_batch, which is how a whole feature came to be green
-- in tests and broken in production.
--
-- supabase/test/roster-workload.test.mjs now checks the enum against the
-- TypeScript union itself, so a fourth action cannot be added to one and
-- forgotten in the other.

alter type im_batch_action add value if not exists 'acknowledge_checkin';

-- ======================= 0020_waiting_replies.sql =======================

-- =============================================================================
-- 0020 - waiting for a reply is workload
-- =============================================================================
--
-- The roster carried one communication signal, `unread_message`, counting
-- messages to the coach with a null `read_at`. Two things were wrong with it.
--
-- Nothing on the coach's side has ever set `read_at`. `markMessagesRead` is
-- called from exactly one place in the product -- the ATHLETE's view of their
-- coach -- so for a coach the count only ever went up. It was not "unread".
-- It was "this athlete has written to you at some point, ever".
--
-- And it did not clear when the coach answered. Replying left "1 unread
-- message" on the roster the next morning, so the one signal the product had
-- about communication could neither be trusted nor discharged.
--
-- Waiting is a fact about the conversation: the athlete is waiting when the
-- last human message in the thread is theirs. That is derived here, in the
-- same single roster query, so there is no second definition to disagree with
-- the first and no per-athlete query added to the page.

drop function if exists im_coach_roster(uuid, date);

create or replace function im_coach_roster(
  p_coach uuid default null,
  p_today date default current_date
)
returns table (
  athlete_id            uuid,
  full_name             text,
  avatar_url            text,
  joined_at             timestamptz,

  programme_id          uuid,
  programme_name        text,
  programme_end_date    date,
  block_name            text,
  phase                 im_phase,
  week_no               integer,
  total_weeks           integer,

  planned_this_week     integer,
  completed_this_week   integer,
  planned_four_weeks    integer,
  completed_four_weeks  integer,

  missed_fourteen_days  integer,
  missed_key_name       text,
  missed_key_date       date,

  last_completed_date   date,
  last_completed_name   text,
  next_session_date     date,
  next_session_name     text,
  future_sessions       integer,

  checkin_id            uuid,
  checkin_week_start    date,
  checkin_submitted_at  timestamptz,
  checkin_attention     im_attention,
  checkin_reasons       text[],
  checkin_acknowledged_at timestamptz,
  checkin_responded_at    timestamptz,
  checkin_fatigue       smallint,
  checkin_soreness      smallint,
  checkin_pain          text,

  race_id               uuid,
  race_name             text,
  race_date             date,
  goal_event_type       im_event_type,

  unread_from_athlete   integer,
  waiting_since         timestamptz,
  waiting_messages      integer,
  waiting_latest        text,
  recent_adaptations    integer
)
language sql stable security definer set search_path = public as $$
with
  -- who the caller may see. A coach passing another coach's id gets their
  -- own roster, not that coach's: the link table is the authority, never
  -- the argument.
  me as (
    select case
             when (im_is_admin() or im_is_service()) and p_coach is not null then p_coach
             else auth.uid()
           end as coach_id
  ),
  roster as (
    select l.athlete_id, l.started_at
      from coach_athlete_links l, me
     where l.coach_id = me.coach_id
       and l.status = 'active'
       and (im_is_staff() or im_is_service())
  ),
  -- the athlete's live programme, and where they are in it
  prog as (
    select p.athlete_id, p.id, p.name, p.end_date,
           (select count(*)::integer from program_weeks w where w.program_id = p.id) total_weeks
      from programs p
      join roster r on r.athlete_id = p.athlete_id
     where p.status = 'active'
  ),
  this_week as (
    select w.program_id, w.id week_id, w.program_week_no, b.name block_name, b.phase
      from program_weeks w
      join program_blocks b on b.id = w.block_id
      join prog on prog.id = w.program_id
     where p_today >= w.start_date and p_today < w.start_date + 7
  ),
  -- every count over sessions comes from one pass, not one query each
  sessions as (
    select
      s.athlete_id,
      count(*) filter (
        where s.date >= date_trunc('week', p_today)::date
          and s.date <= p_today and s.type <> 'rest')::integer planned_week,
      count(*) filter (
        where s.date >= date_trunc('week', p_today)::date
          and s.date <= p_today and s.type <> 'rest' and s.status = 'completed')::integer done_week,
      count(*) filter (
        where s.date >= p_today - 27 and s.date <= p_today and s.type <> 'rest')::integer planned_month,
      count(*) filter (
        where s.date >= p_today - 27 and s.date <= p_today
          and s.type <> 'rest' and s.status = 'completed')::integer done_month,
      count(*) filter (
        where s.date >= p_today - 13 and s.date <= p_today
          and s.type <> 'rest' and s.status = 'missed')::integer missed_fortnight,
      count(*) filter (where s.date >= p_today and s.status = 'scheduled')::integer future_count
    from scheduled_workouts s
    join roster r on r.athlete_id = s.athlete_id
    group by s.athlete_id
  )
select
  pr.id,
  pr.full_name,
  pr.avatar_url,
  r.started_at,

  prog.id,
  prog.name,
  prog.end_date,
  tw.block_name,
  tw.phase,
  tw.program_week_no::integer,
  prog.total_weeks,

  coalesce(sess.planned_week, 0),
  coalesce(sess.done_week, 0),
  coalesce(sess.planned_month, 0),
  coalesce(sess.done_month, 0),

  coalesce(sess.missed_fortnight, 0),
  key_missed.name,
  key_missed.date,

  last_done.date,
  last_done.name,
  next_up.date,
  next_up.name,
  coalesce(sess.future_count, 0),

  ci.id,
  ci.week_start,
  ci.submitted_at,
  ci.attention_level,
  ci.attention_reasons,
  ci.acknowledged_at,
  ci.responded_at,
  ci.fatigue,
  ci.soreness,
  nullif(btrim(coalesce(ci.pain_or_niggles, '')), ''),

  race.id,
  race.name,
  race.date,
  race.event_type,

  coalesce(msg.unread, 0)::integer,
  wait.waiting_since,
  coalesce(wait.waiting_messages, 0)::integer,
  wait.waiting_latest,
  coalesce(adapt.recent, 0)::integer

from roster r
join profiles pr on pr.id = r.athlete_id
left join prog on prog.athlete_id = r.athlete_id
left join this_week tw on tw.program_id = prog.id
left join sessions sess on sess.athlete_id = r.athlete_id

-- a missed session worth naming: the hard ones, most recent first
left join lateral (
  select s.name, s.date
    from scheduled_workouts s
   where s.athlete_id = r.athlete_id
     and s.status = 'missed'
     and s.date >= p_today - 13
     and s.type in ('long_run','threshold','intervals','race_pace','hills','tempo','brick','race')
   order by s.date desc
   limit 1
) key_missed on true

left join lateral (
  select s.date, s.name
    from scheduled_workouts s
   where s.athlete_id = r.athlete_id and s.status = 'completed'
   order by s.date desc
   limit 1
) last_done on true

left join lateral (
  select s.date, s.name
    from scheduled_workouts s
   where s.athlete_id = r.athlete_id and s.status = 'scheduled' and s.date >= p_today
     and s.type <> 'rest'
   order by s.date, s.slot
   limit 1
) next_up on true

left join lateral (
  select c.* from checkins c
   where c.athlete_id = r.athlete_id
   order by c.week_start desc
   limit 1
) ci on true

left join lateral (
  select ra.id, ra.name, ra.date, g.event_type
    from goals g join races ra on ra.id = g.race_id
   where g.athlete_id = r.athlete_id and ra.date >= p_today
   order by ra.date
   limit 1
) race on true

-- messages reach an athlete through their thread with this coach
left join lateral (
  select count(*)::integer unread
    from messages m
    join message_threads th on th.id = m.thread_id
    cross join me
   where th.athlete_id = r.athlete_id
     and m.recipient_id = me.coach_id
     and m.read_at is null
) msg on true

-- WHO IS WAITING ON WHOM.
--
-- Not a flag and not a count of unread: the athlete is waiting when the last
-- human message in their thread with this coach is theirs. `read_at` says
-- nothing about it -- a coach can read something and still owe an answer, and
-- on this side nothing has ever written read_at anyway.
--
-- `waiting_since` is the FIRST message of the unanswered run, not the last.
-- Someone who wrote three times yesterday morning has been waiting since
-- yesterday morning; dating them from their most recent message would reward
-- the athlete who gave up and stopped writing.
--
-- FORGE messages are ignored on both sides. An automated note is not the
-- coach answering, and FORGE never writes as the athlete.
left join lateral (
  select
    min(m.created_at)                                        as waiting_since,
    count(*)::integer                                        as waiting_messages,
    (array_agg(m.body order by m.created_at desc))[1]        as waiting_latest
  from messages m
  join message_threads th on th.id = m.thread_id
  cross join me
  where th.athlete_id = r.athlete_id
    and th.coach_id   = me.coach_id
    and m.sender_id   = r.athlete_id
    and m.author_kind = 'human'
    and m.created_at > coalesce(
      (select max(c.created_at)
         from messages c
         join message_threads t2 on t2.id = c.thread_id
        where t2.athlete_id = r.athlete_id
          and t2.coach_id   = me.coach_id
          and c.sender_id   = me.coach_id
          and c.author_kind = 'human'),
      '-infinity'::timestamptz)
) wait on true

-- what this coach changed for them lately, so the roster does not report a
-- deliberate adaptation as if it were a surprise
left join lateral (
  select count(*)::integer recent
    from session_revisions sr, me
   where sr.athlete_id = r.athlete_id
     and sr.changed_by = me.coach_id
     and sr.changed_at >= (p_today - 6)::timestamptz
     and sr.kind <> 'created'
) adapt on true

order by pr.full_name;
$$;

commit;
