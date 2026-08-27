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
