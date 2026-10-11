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
