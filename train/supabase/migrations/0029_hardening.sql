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
-- No client inserts at all: the apply form's server action validates, rate
-- limits and writes with the service role. A public insert policy let anyone
-- with the anon key skip those checks (and, before this, pre-accept a row).
drop policy if exists applications_insert on coaching_applications;

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

-- ---------- 4. the GDPR export, complete ----------
-- The export left out what an athlete is most entitled to see: the health
-- and background answers they gave at onboarding, the notes their coach
-- shared with them, their billing records, connections, notifications and
-- community posts. (Private coach notes stay out: they are the coach's.)
create or replace function im_export_athlete_data(target uuid)
returns jsonb language plpgsql stable security definer set search_path = public as $$
begin
  if not (target = auth.uid() or im_is_admin()) then
    raise exception 'not permitted';
  end if;
  return jsonb_build_object(
    'profile',                (select to_jsonb(p) from profiles p where p.id = target),
    'onboarding',             (select to_jsonb(o) from athlete_onboarding o where o.athlete_id = target),
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
    'shared_coach_notes',     (select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) from coach_notes n where n.athlete_id = target and n.visibility = 'shared'),
    'forge_score_events',     (select coalesce(jsonb_agg(to_jsonb(f)), '[]'::jsonb) from forge_score_events f where f.athlete_id = target),
    'achievements',           (select coalesce(jsonb_agg(to_jsonb(a)), '[]'::jsonb) from achievements a where a.athlete_id = target),
    'messages',               (select coalesce(jsonb_agg(to_jsonb(m)), '[]'::jsonb) from messages m where m.recipient_id = target or m.sender_id = target),
    'notifications',          (select coalesce(jsonb_agg(to_jsonb(n)), '[]'::jsonb) from notifications n where n.user_id = target),
    'event_attendance',       (select coalesce(jsonb_agg(to_jsonb(e)), '[]'::jsonb) from event_attendance e where e.athlete_id = target),
    'community_posts',        (select coalesce(jsonb_agg(to_jsonb(c)), '[]'::jsonb) from community_posts c where c.author_id = target),
    'subscriptions',          (select coalesce(jsonb_agg(to_jsonb(s) - 'stripe_customer_id'), '[]'::jsonb) from subscriptions s where s.athlete_id = target),
    'payments',               (select coalesce(jsonb_agg(to_jsonb(p)), '[]'::jsonb) from payments p where p.athlete_id = target),
    'integrations',           (select coalesce(jsonb_agg(to_jsonb(i)), '[]'::jsonb) from integrations i where i.athlete_id = target),
    'exported_at',            to_jsonb(now())
  );
end $$;

-- ---------- 5. a check-in answered again is unread again ----------
-- The athlete's form upserts their week, so a second submission updates the
-- row — and kept the coach's "read" and "replied" from the first. A week
-- resubmitted as "sharp pain, swollen ankle" after the coach's "great week"
-- was then off the unread queue and never flagged. When the athlete changes
-- their answers, the coach's marks go; the coach's earlier reply stays, as a
-- record of what was said. (Named to run after t_checkin_coach_fields, so the
-- guard has already refused any attempt to write these fields by hand.)
create or replace function im_reopen_resubmitted_checkin() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  ignore text[] := array['id', 'submitted_at', 'attention_level', 'attention_reasons', 'reviewed_by_coach_at',
                         'coach_response', 'acknowledged_at', 'acknowledged_by', 'responded_at'];
begin
  if auth.uid() is distinct from new.athlete_id then return new; end if;
  if (to_jsonb(new) - ignore) is distinct from (to_jsonb(old) - ignore) then
    new.acknowledged_at := null;
    new.acknowledged_by := null;
    new.responded_at := null;
    new.reviewed_by_coach_at := null;
  end if;
  return new;
end $$;

drop trigger if exists u_checkin_reopen on checkins;
create trigger u_checkin_reopen
  before update on checkins
  for each row execute function im_reopen_resubmitted_checkin();

-- ---------- 6. a check-in is for a week that has begun, named by its Monday ----------
-- week_start is the client's to send, and only (athlete, week_start) was
-- unique: a Tuesday and a Monday made two check-ins for one week, and a week
-- in 2027 became the "latest", hiding the real one. Existing rows are
-- left alone (a check constraint would fail the migration on any old
-- Tuesday); new and changed ones are held to it.
create or replace function im_guard_checkin_week() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return new; end if;
  if extract(isodow from new.week_start) <> 1 then
    raise exception 'A check-in is for a week, named by its Monday.';
  end if;
  if new.week_start > current_date + 1 then
    raise exception 'A check-in is for a week that has begun.';
  end if;
  return new;
end $$;

drop trigger if exists checkins_week_guard on checkins;
create trigger checkins_week_guard
  before insert or update of week_start on checkins
  for each row execute function im_guard_checkin_week();

-- ---------- 7. copying a week never rewrites what was done ----------
-- im_duplicate_week (0005) upserted onto the target week's slots, so copying
-- week 3 onto the current Monday on a Wednesday rewrote Monday's and
-- Tuesday's completed sessions — same status, a different prescription than
-- the one logged. Locked slots (im_adaptation_blocker, 0011) are skipped.
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
    v_new := null;
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
      -- a session already done, or otherwise locked, keeps what it was: the
      -- update used to rewrite a completed session's prescription under its log
      where im_adaptation_blocker(scheduled_workouts) is null
    returning id into v_new;

    -- the slot was locked: leave it, and its components, alone
    if v_new is null then
      continue;
    end if;

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


-- ---------- 8. shifting never lands a session in the past ----------
-- im_shift_sessions (0011) kept sessions already in the past where they were
-- but would move today's back a week — into days that have gone, where they
-- read as missed. The comments in 0016 and batch-runner.ts said it refused
-- that; now it does, in the preview as well as the apply.
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
      when (s.date + p_days) < v_today then 'blocked'
      when p.id is not null and ((s.date + p_days) < p.start_date or (s.date + p_days) > p.end_date)
        then 'blocked'
      else 'move'
    end,
    s.name, s.date, (s.date + p_days)::date, s.status,
    case
      when im_adaptation_blocker(s.*) is not null then im_adaptation_blocker(s.*)
      when s.date < v_today then 'In the past. Sessions before today are left where they are.'
      when (s.date + p_days) < v_today then 'That would land in the past. A session moves to today or later.'
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


-- ---------- 9. only the server notifies ----------
-- im_notify, im_record_delivery, im_record_attempt and
-- im_record_provider_status admitted any caller whose auth.uid() was null —
-- meant for the server and migrations, but a signed-out request through the
-- public API has no uid either. With the anon key anyone could queue an
-- email to any coach from the platform's verified sender, with a link of
-- their choosing, and forge the delivery log. Now: the service role, an
-- admin, or a direct database connection carrying no request identity at all.
create or replace function im_is_backend()
returns boolean language sql stable set search_path = public as $$
  select im_is_service()
      or (auth.uid() is null
          and nullif(current_setting('request.jwt.claims', true), '') is null
          and nullif(current_setting('request.jwt.claim.role', true), '') is null);
$$;

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
  if not (im_is_backend() or im_is_admin()) then
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

create or replace function im_record_delivery(
  p_delivery uuid,
  p_state    im_delivery_state,
  p_detail   text default null
) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not (im_is_backend() or im_is_admin()) then
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
  if not (im_is_backend() or im_is_admin()) then
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

create or replace function im_record_provider_status(
  p_message_id text,
  p_status     text,
  p_detail     text default null
) returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_row notification_deliveries;
begin
  if not (im_is_backend() or im_is_admin()) then
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

-- ---------- 10. an athlete can see who their coach is ----------
-- getCoachForAthlete read the coach's profile through the link; profiles
-- are readable only by their owner, their coach, or an admin, so for every
-- athlete it came back empty: "Unassigned" on the coach page, and "You are
-- not linked to a coach yet" when they tried to message them. This returns
-- the coach's name and picture — nothing else from their profile.
create or replace function im_my_coach()
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'full_name', p.full_name, 'avatar_url', p.avatar_url, 'role', p.role)
  from coach_athlete_links l
  join profiles p on p.id = l.coach_id
  where l.athlete_id = auth.uid() and l.status = 'active'
  order by l.started_at desc
  limit 1;
$$;

-- ---------- 11. accepting someone who already has an account links them ----------
-- The app looked the applicant up in profiles as the coach — who cannot see
-- an athlete they do not coach yet — so an applicant who registered first was
-- told they would be "linked automatically when they register", and never
-- was. (It also matched email with ilike, where _ and % are wildcards.) The
-- lookup and the link happen here, with the definer's sight. And a second
-- application from the same address, or one already joined to another
-- coach, is refused with a reason instead of a unique-index error page.
create or replace function im_decide_application(
  application_id uuid,
  decision       im_application_status,
  note           text default null
) returns coaching_applications
language plpgsql security definer set search_path = public as $$
declare
  result  coaching_applications;
  current coaching_applications;
  athlete uuid;
begin
  if not im_is_staff() then
    raise exception 'only a coach may decide an application';
  end if;
  if decision not in ('accepted','declined','reviewing') then
    raise exception 'unsupported decision';
  end if;

  select * into current from coaching_applications where id = application_id;
  if current is null then
    raise exception 'application not found';
  end if;
  if current.joined_athlete_id is not null and current.accepted_by is distinct from auth.uid() and not im_is_admin() then
    raise exception 'This applicant has already joined another coach''s roster.';
  end if;
  if decision = 'accepted' and exists (
    select 1 from coaching_applications a
    where lower(a.email) = lower(current.email) and a.id <> current.id
      and a.status = 'accepted' and a.joined_athlete_id is null
  ) then
    raise exception 'Another application from this address is already accepted and waiting for them.';
  end if;

  update coaching_applications
     set status       = decision,
         decided_note = note,
         accepted_by  = case when decision = 'accepted' then auth.uid() else null end,
         accepted_at  = case when decision = 'accepted' then now() else null end
   where id = application_id
  returning * into result;

  -- already registered? link them now; sign-up has been and gone
  if decision = 'accepted' and result.joined_athlete_id is null then
    select p.id into athlete from profiles p
     where lower(p.email) = lower(result.email) and p.role = 'athlete'
     limit 1;
    if athlete is not null then
      insert into coach_athlete_links (coach_id, athlete_id, status)
      values (auth.uid(), athlete, 'active')
      on conflict (coach_id, athlete_id) do update set status = 'active', ended_at = null;
      insert into message_threads (athlete_id, coach_id)
      values (athlete, auth.uid())
      on conflict (athlete_id, coach_id) do nothing;
      update coaching_applications set joined_athlete_id = athlete where id = result.id
      returning * into result;
    end if;
  end if;

  return result;
end $$;

-- ---------- 12. a strength session need not come from the library ----------
-- strength_sessions.template_id was required, but a prescribed session can be
-- built from components with no library template behind it — and the player
-- was sending the session's own id, so every save failed on the foreign key.
alter table strength_sessions alter column template_id drop not null;

-- ---------- 13. one primary goal per athlete ----------
-- Completing onboarding twice inserted a second primary goal; the app reads
-- the primary goal as a single row and read two as none. Keep the newest of
-- any duplicates already there, then hold it to one.
update goals g set is_primary = false
 where is_primary
   and exists (select 1 from goals n where n.athlete_id = g.athlete_id and n.is_primary
                 and (n.created_at, n.id) > (g.created_at, g.id));
create unique index if not exists goals_one_primary on goals (athlete_id) where is_primary;
