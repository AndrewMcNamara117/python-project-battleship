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
