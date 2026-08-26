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
