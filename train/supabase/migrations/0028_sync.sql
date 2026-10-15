-- ============================================================
-- 0028 — WATCH SYNC
--
-- The pipeline for providers that push activities: Garmin and COROS once
-- partner access is granted (see src/lib/sync/providers.ts).
--
-- integration_secrets holds each connection's tokens, encrypted by the
-- application (AES-256-GCM, key from SYNC_SECRET) before they arrive. RLS is
-- on and there is no policy at all: no athlete, coach or admin session can
-- read or write it. Only the service role — the webhook and the OAuth
-- callback, after they have authorised the request — touches it. That is
-- what 0001's "tokens live in Vault, never in a client-readable column"
-- promised.
--
-- activity_imports (0001) becomes the ledger of pushes: one row per provider
-- activity, claimed before the file is fetched, so a provider retrying a
-- push cannot import the same run twice.
-- ============================================================

create table integration_secrets (
  athlete_id       uuid not null references profiles(id) on delete cascade,
  provider         im_provider not null,
  external_user_id text not null,
  token_ciphertext text not null check (token_ciphertext like 'v1.%'),
  expires_at       timestamptz,
  updated_at       timestamptz not null default now(),
  primary key (athlete_id, provider),
  unique (provider, external_user_id)
);

alter table integration_secrets enable row level security;
alter table integration_secrets force row level security;
-- (no policies: service role only)

alter table activity_imports
  add column if not exists activity_id uuid references activities(id) on delete set null,
  add column if not exists outcome     text not null default 'claimed'
    check (outcome in ('claimed', 'imported', 'duplicate', 'failed')),
  add column if not exists detail      text;

-- the athlete may see that a connection exists and when it last synced, but
-- the row is now the server's to write: a client could otherwise mark itself
-- connected
drop policy if exists integrations_rw on integrations;
create policy integrations_read on integrations
  for select using (athlete_id = auth.uid() or im_is_admin());
create policy integrations_admin_write on integrations
  for all using (im_is_admin()) with check (im_is_admin());
