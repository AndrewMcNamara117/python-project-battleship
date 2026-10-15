-- ============================================================
-- 0026 — TELLING AN ATHLETE ABOUT KUDOS AND COMMENTS
--
-- When someone gives kudos on or comments on an athlete's activity, the
-- athlete is told in-app. Written by triggers, like the Forge ledger (0024):
-- there is no callable "notify" function for a client to misuse, and
-- im_notify (0014) stays what it is — the coach's channel, refusing users.
--
--   * Kudos fold into one notification per activity ("3 kudos on …"), raised
--     to unread again by each new one, through the dedupe index from 0013.
--   * Each comment is its own notification, with a short excerpt.
--   * Nobody is told about their own kudos or comment.
--   * An athlete can turn these off (profiles.notify_social).
--
-- These are in-app only. Email goes through notification_deliveries, which
-- only im_notify creates, so nothing here can send an email.
-- ============================================================

alter table profiles
  add column if not exists notify_social boolean not null default true;

create or replace function im_notify_on_kudos() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  a activities%rowtype;
  giver text;
  n integer;
begin
  select * into a from activities where id = new.activity_id;
  if not found or a.athlete_id = new.athlete_id then return new; end if;
  if not coalesce((select notify_social from profiles where id = a.athlete_id), true) then return new; end if;

  select full_name into giver from profiles where id = new.athlete_id;
  select count(*) into n from activity_kudos where activity_id = new.activity_id;

  insert into notifications (user_id, kind, title, body, href, notification_kind, priority, dedupe_key, state)
  values (
    a.athlete_id, 'kudos',
    case when n > 1 then n || ' kudos on ' || a.name else coalesce(giver, 'A club-mate') || ' gave kudos' end,
    -- no closing full stop: names like "Eoin C." already end in one
    case when n > 1 then 'Latest from ' || coalesce(giver, 'a club-mate') else 'On ' || a.name end,
    '/app/activities/' || a.id,
    'alert', 'information', 'kudos:' || a.id, 'pending'
  )
  -- unread again only when there is something new to say: taking kudos back
  -- and giving it again gives the same title, and must not bump the inbox
  on conflict (user_id, dedupe_key) where dedupe_key is not null do update
    set title = excluded.title, body = excluded.body, read_at = null, created_at = now()
    where notifications.title is distinct from excluded.title;
  return new;
end $$;

create trigger activity_kudos_notify
  after insert on activity_kudos
  for each row execute function im_notify_on_kudos();

create or replace function im_notify_on_comment() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  a activities%rowtype;
  author text;
  excerpt text;
begin
  select * into a from activities where id = new.activity_id;
  if not found or a.athlete_id = new.author_id then return new; end if;
  if not coalesce((select notify_social from profiles where id = a.athlete_id), true) then return new; end if;

  select full_name into author from profiles where id = new.author_id;
  excerpt := btrim(new.body);
  if char_length(excerpt) > 100 then excerpt := left(excerpt, 99) || '…'; end if;

  insert into notifications (user_id, kind, title, body, href, notification_kind, priority, state)
  values (
    a.athlete_id, 'comment',
    coalesce(author, 'A club-mate') || ' commented on ' || a.name,
    excerpt,
    '/app/activities/' || a.id || '#comments',
    'alert', 'information', 'pending'
  );
  return new;
end $$;

create trigger activity_comments_notify
  after insert on activity_comments
  for each row execute function im_notify_on_comment();
