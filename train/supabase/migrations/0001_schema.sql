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
