-- ============================================================
-- 0029 — HARDENING: INTAKE, THREADS, MESSAGES
--
-- Found by a security review of the coaching core, each proven against
-- these migrations in supabase/test/hardening.test.mjs.
--
-- 1. Anyone could make themselves a future athlete's coach. The public
--    apply form's insert policy was `with check (true)`, so a signed-in user
--    could insert an application already "accepted", by themselves, for
--    somebody else's email. When that person signed up, im_handle_new_user
--    trusted the row: it linked them to the "coach", who could then read
--    their profile, check-ins and health answers. A submission can now only
--    be new, and sign-up only honours an acceptance made by a coach.
--
-- 2. Anyone could open a thread with any athlete. threads_write let a user
--    insert (athlete = victim, coach = self); the victim then had two
--    threads, the app's single-thread lookup found neither, and their real
--    conversation vanished. A thread is now opened by the athlete's own
--    coach (or the athlete, with their own coach), or by the definer
--    functions that link them.
--
-- 3. A recipient could rewrite a message sent to them: the mark-read
--    policy covered every column. Only read_at may change now, and a
--    message's recipient must be the other person in its thread.
-- ============================================================

-- ---------- 1. intake ----------
drop policy if exists applications_insert on coaching_applications;
create policy applications_insert on coaching_applications
  for insert with check (
    status = 'new'
    and accepted_by is null
    and accepted_at is null
    and joined_athlete_id is null
    and decided_note is null
  );

create or replace function im_handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  app record;
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;

  -- an accepted application for this address means a coach already said yes —
  -- and only a coach's (or an admin's) acceptance counts
  select a.* into app
  from public.coaching_applications a
  join public.profiles p on p.id = a.accepted_by and p.role in ('coach', 'admin')
  where lower(a.email) = lower(new.email)
    and a.status = 'accepted'
    and a.joined_athlete_id is null
  order by a.accepted_at desc
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

    if coalesce(new.raw_user_meta_data->>'full_name', '') = '' and app.full_name <> '' then
      update public.profiles set full_name = app.full_name where id = new.id;
    end if;
  end if;

  return new;
end $$;

-- ---------- 2. threads ----------
drop policy if exists threads_write on message_threads;
-- opened only between an athlete and their own coach; never moved or edited
-- by a client (updated_at is kept by a trigger on messages, below)
create policy threads_open on message_threads
  for insert with check (
    im_is_admin()
    or (coach_id = auth.uid() and im_is_coach_of(athlete_id))
    or (athlete_id = auth.uid() and exists (
          select 1 from coach_athlete_links l
          where l.coach_id = message_threads.coach_id and l.athlete_id = auth.uid() and l.status = 'active'))
  );
create policy threads_admin_change on message_threads
  for update using (im_is_admin()) with check (im_is_admin());
create policy threads_admin_delete on message_threads
  for delete using (im_is_admin());

-- ---------- 3. messages ----------
create or replace function im_guard_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  t message_threads%rowtype;
begin
  if tg_op = 'INSERT' then
    select * into t from message_threads where id = new.thread_id;
    -- the recipient is the other person in the thread, whoever sends
    if not found or new.recipient_id not in (t.athlete_id, t.coach_id) or new.recipient_id = new.sender_id then
      raise exception 'A message goes to the other person in its thread.';
    end if;
    update message_threads set updated_at = now() where id = new.thread_id;
    return new;
  end if;
  -- an update by a client marks read and nothing else
  if auth.uid() is not null and not im_is_admin()
     and (to_jsonb(new) - 'read_at') is distinct from (to_jsonb(old) - 'read_at') then
    raise exception 'Only read_at may change on a message.';
  end if;
  return new;
end $$;

drop trigger if exists messages_guard on messages;
create trigger messages_guard
  before insert or update on messages
  for each row execute function im_guard_message();
