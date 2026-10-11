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
