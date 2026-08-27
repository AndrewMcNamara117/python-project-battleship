-- ============================================================
-- 0017 — READ IS NOT REPLIED, AND NEITHER IS RESOLVED
--
-- A check-in had two conditions: unanswered, or answered with typed text.
-- The only way out of the coach's queue was to type something, so at forty
-- athletes a coach either wrote thirty-one replies a week or watched the
-- counter climb until they stopped believing it. Twenty-five of those
-- thirty-one are athletes reporting an ordinary week.
--
-- This migration gives a check-in three distinguishable states:
--
--   unread      nobody has looked at it
--   read        a coach deliberately marked it read; no reply was sent
--   replied     a coach wrote something back
--
-- and keeps a fourth thing separate from all of them: whether the check-in
-- still represents a coaching concern. A coach reading "my Achilles is sore"
-- has not made the Achilles better. Communication state and attention state
-- are different facts about the same check-in, and conflating them is how a
-- product quietly loses an injury.
--
-- WHAT READS WHAT, AFTER THIS:
--
--   checkin_unreviewed signal, the queue, "check-ins to read"
--       -> acknowledged_at.       Marking read clears these. That is the point.
--   checkin_flagged signal
--       -> responded_at.          Acknowledging does NOT clear it; a flagged
--                                 check-in is dealt with by answering it.
--   soreness_reported signal
--       -> unchanged, and never depended on read state. Reported pain stays
--          on the roster whatever the coach has clicked.
-- ============================================================

alter table checkins
  add column if not exists acknowledged_at timestamptz,
  add column if not exists acknowledged_by uuid references profiles(id) on delete set null,
  add column if not exists responded_at    timestamptz;

comment on column checkins.acknowledged_at is
  'When a coach deliberately marked this read. Never set by viewing a page.';
comment on column checkins.acknowledged_by is
  'Which coach read it. Answering "who has seen this" without inference.';
comment on column checkins.responded_at is
  'When a coach wrote back. A reply implies a read; a read implies nothing.';

-- Everything already reviewed was reviewed by replying — that was the only
-- route that existed — so it is both acknowledged and responded.
update checkins
   set acknowledged_at = coalesce(acknowledged_at, reviewed_by_coach_at),
       responded_at    = coalesce(responded_at,
                                  case when coach_response is not null
                                       then reviewed_by_coach_at end)
 where reviewed_by_coach_at is not null;

-- The queue asks "what has nobody looked at", which is now a different
-- question from the one the old index answered.
drop index if exists checkins_attention_level_idx;
create index if not exists checkins_unacknowledged
  on checkins (athlete_id, attention_level)
  where acknowledged_at is null;

create index if not exists checkins_unanswered
  on checkins (athlete_id)
  where responded_at is null;


-- ------------------------------------------------------------
-- MARKING ONE CHECK-IN READ
--
-- Deliberately its own function rather than an argument to the responder:
-- the two are different acts and the record should not have to be
-- reverse-engineered from whether a text field happens to be empty.
--
-- Idempotent. Marking a check-in read twice keeps the first timestamp, so a
-- batch retried after a failure does not rewrite when the coach actually
-- looked.
-- ------------------------------------------------------------

create or replace function im_acknowledge_checkin(p_checkin uuid)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_athlete uuid;
  v_already timestamptz;
begin
  select athlete_id, acknowledged_at into v_athlete, v_already
    from checkins where id = p_checkin;

  if v_athlete is null then
    raise exception 'No such check-in.';
  end if;

  -- per check-in, every time. A coach acknowledging thirty of their own
  -- athletes never earns the right to acknowledge someone else's.
  if not (im_is_coach_of(v_athlete) or im_is_admin()) then
    raise exception 'That athlete is not on your roster.';
  end if;

  if v_already is not null then
    return false;                       -- already read; nothing to record
  end if;

  update checkins
     set acknowledged_at = now(),
         acknowledged_by = auth.uid(),
         -- kept in step for anything still reading the original column;
         -- acknowledged_at is the one this product now believes
         reviewed_by_coach_at = coalesce(reviewed_by_coach_at, now())
   where id = p_checkin;

  return true;
end $$;

comment on function im_acknowledge_checkin is
  'A coach states they have read a check-in. Never called by rendering a page.';


-- ------------------------------------------------------------
-- REPLYING
--
-- A reply is also a read — you cannot answer something you have not looked
-- at — but the record keeps them apart so "did my coach write back" and "has
-- my coach seen this" stay different questions with different answers.
-- ------------------------------------------------------------

create or replace function im_respond_to_checkin(p_checkin uuid, p_response text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_athlete uuid;
begin
  select athlete_id into v_athlete from checkins where id = p_checkin;
  if v_athlete is null then
    raise exception 'No such check-in.';
  end if;
  if not (im_is_coach_of(v_athlete) or im_is_admin()) then
    raise exception 'That athlete is not on your roster.';
  end if;
  if coalesce(length(btrim(p_response)), 0) < 2 then
    raise exception 'Write a response first.';
  end if;

  update checkins
     set coach_response      = p_response,
         responded_at        = now(),
         -- an unread check-in that gets a reply was, necessarily, read
         acknowledged_at     = coalesce(acknowledged_at, now()),
         acknowledged_by     = coalesce(acknowledged_by, auth.uid()),
         reviewed_by_coach_at = coalesce(reviewed_by_coach_at, now())
   where id = p_checkin;
end $$;

comment on function im_respond_to_checkin is
  'A coach writes back. Implies a read; the two timestamps stay distinct.';


-- ------------------------------------------------------------
-- WHOSE COLUMNS ARE WHOSE
--
-- Found by probing this migration, and older than it: the athlete's own-write
-- policy is `for all`, so an athlete could update any column on their own
-- check-in. In practice that meant they could write a coach_response their
-- coach never said, and set reviewed_by_coach_at so it left the coach's queue
-- without the coach ever seeing it.
--
-- Slice 10 would have made that worse by adding three more coach-owned
-- columns to the same row. RLS cannot restrict columns, so this does:
-- an athlete may rewrite their own answers — check-ins are upserted, and
-- resubmitting a week is a legitimate thing to do — but the five columns that
-- record what a coach did are not theirs to touch.
-- ------------------------------------------------------------

create or replace function im_guard_checkin_coach_fields()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- migrations, the service role and the coach themselves
  if auth.uid() is null or im_is_coach_of(new.athlete_id) or im_is_admin() then
    return new;
  end if;

  if new.coach_response       is distinct from old.coach_response
     or new.acknowledged_at   is distinct from old.acknowledged_at
     or new.acknowledged_by   is distinct from old.acknowledged_by
     or new.responded_at      is distinct from old.responded_at
     or new.reviewed_by_coach_at is distinct from old.reviewed_by_coach_at then
    raise exception 'What a coach said, and whether they have read this, is not yours to write.';
  end if;

  return new;
end $$;

drop trigger if exists t_checkin_coach_fields on checkins;
create trigger t_checkin_coach_fields
  before update on checkins
  for each row execute function im_guard_checkin_coach_fields();

comment on function im_guard_checkin_coach_fields is
  'An athlete owns their answers. A coach owns the record of having read and replied.';


-- ------------------------------------------------------------
-- THE ROSTER CARRIES BOTH FACTS
--
-- Redefined rather than replaced: identical to 0014 except that it returns
-- acknowledged_at and responded_at where it used to return one merged
-- column. The domain then decides which signal reads which — and it is that
-- separation, not this function, that keeps a flagged check-in on the roster
-- after a coach has read it.
-- ------------------------------------------------------------

drop function if exists im_coach_roster(uuid, date);

create or replace function im_coach_roster(
  p_coach uuid default null,
  p_today date default current_date
)
returns table (
  athlete_id            uuid,
  full_name             text,
  avatar_url            text,
  joined_at             timestamptz,

  programme_id          uuid,
  programme_name        text,
  programme_end_date    date,
  block_name            text,
  phase                 im_phase,
  week_no               integer,
  total_weeks           integer,

  planned_this_week     integer,
  completed_this_week   integer,
  planned_four_weeks    integer,
  completed_four_weeks  integer,

  missed_fourteen_days  integer,
  missed_key_name       text,
  missed_key_date       date,

  last_completed_date   date,
  last_completed_name   text,
  next_session_date     date,
  next_session_name     text,
  future_sessions       integer,

  checkin_id            uuid,
  checkin_week_start    date,
  checkin_submitted_at  timestamptz,
  checkin_attention     im_attention,
  checkin_reasons       text[],
  checkin_acknowledged_at timestamptz,
  checkin_responded_at    timestamptz,
  checkin_fatigue       smallint,
  checkin_soreness      smallint,
  checkin_pain          text,

  race_id               uuid,
  race_name             text,
  race_date             date,
  goal_event_type       im_event_type,

  unread_from_athlete   integer,
  recent_adaptations    integer
)
language sql stable security definer set search_path = public as $$
with
  -- who the caller may see. A coach passing another coach's id gets their
  -- own roster, not that coach's: the link table is the authority, never
  -- the argument.
  me as (
    select case
             when (im_is_admin() or im_is_service()) and p_coach is not null then p_coach
             else auth.uid()
           end as coach_id
  ),
  roster as (
    select l.athlete_id, l.started_at
      from coach_athlete_links l, me
     where l.coach_id = me.coach_id
       and l.status = 'active'
       and (im_is_staff() or im_is_service())
  ),
  -- the athlete's live programme, and where they are in it
  prog as (
    select p.athlete_id, p.id, p.name, p.end_date,
           (select count(*)::integer from program_weeks w where w.program_id = p.id) total_weeks
      from programs p
      join roster r on r.athlete_id = p.athlete_id
     where p.status = 'active'
  ),
  this_week as (
    select w.program_id, w.id week_id, w.program_week_no, b.name block_name, b.phase
      from program_weeks w
      join program_blocks b on b.id = w.block_id
      join prog on prog.id = w.program_id
     where p_today >= w.start_date and p_today < w.start_date + 7
  ),
  -- every count over sessions comes from one pass, not one query each
  sessions as (
    select
      s.athlete_id,
      count(*) filter (
        where s.date >= date_trunc('week', p_today)::date
          and s.date <= p_today and s.type <> 'rest')::integer planned_week,
      count(*) filter (
        where s.date >= date_trunc('week', p_today)::date
          and s.date <= p_today and s.type <> 'rest' and s.status = 'completed')::integer done_week,
      count(*) filter (
        where s.date >= p_today - 27 and s.date <= p_today and s.type <> 'rest')::integer planned_month,
      count(*) filter (
        where s.date >= p_today - 27 and s.date <= p_today
          and s.type <> 'rest' and s.status = 'completed')::integer done_month,
      count(*) filter (
        where s.date >= p_today - 13 and s.date <= p_today
          and s.type <> 'rest' and s.status = 'missed')::integer missed_fortnight,
      count(*) filter (where s.date >= p_today and s.status = 'scheduled')::integer future_count
    from scheduled_workouts s
    join roster r on r.athlete_id = s.athlete_id
    group by s.athlete_id
  )
select
  pr.id,
  pr.full_name,
  pr.avatar_url,
  r.started_at,

  prog.id,
  prog.name,
  prog.end_date,
  tw.block_name,
  tw.phase,
  tw.program_week_no::integer,
  prog.total_weeks,

  coalesce(sess.planned_week, 0),
  coalesce(sess.done_week, 0),
  coalesce(sess.planned_month, 0),
  coalesce(sess.done_month, 0),

  coalesce(sess.missed_fortnight, 0),
  key_missed.name,
  key_missed.date,

  last_done.date,
  last_done.name,
  next_up.date,
  next_up.name,
  coalesce(sess.future_count, 0),

  ci.id,
  ci.week_start,
  ci.submitted_at,
  ci.attention_level,
  ci.attention_reasons,
  ci.acknowledged_at,
  ci.responded_at,
  ci.fatigue,
  ci.soreness,
  nullif(btrim(coalesce(ci.pain_or_niggles, '')), ''),

  race.id,
  race.name,
  race.date,
  race.event_type,

  coalesce(msg.unread, 0)::integer,
  coalesce(adapt.recent, 0)::integer

from roster r
join profiles pr on pr.id = r.athlete_id
left join prog on prog.athlete_id = r.athlete_id
left join this_week tw on tw.program_id = prog.id
left join sessions sess on sess.athlete_id = r.athlete_id

-- a missed session worth naming: the hard ones, most recent first
left join lateral (
  select s.name, s.date
    from scheduled_workouts s
   where s.athlete_id = r.athlete_id
     and s.status = 'missed'
     and s.date >= p_today - 13
     and s.type in ('long_run','threshold','intervals','race_pace','hills','tempo','brick','race')
   order by s.date desc
   limit 1
) key_missed on true

left join lateral (
  select s.date, s.name
    from scheduled_workouts s
   where s.athlete_id = r.athlete_id and s.status = 'completed'
   order by s.date desc
   limit 1
) last_done on true

left join lateral (
  select s.date, s.name
    from scheduled_workouts s
   where s.athlete_id = r.athlete_id and s.status = 'scheduled' and s.date >= p_today
     and s.type <> 'rest'
   order by s.date, s.slot
   limit 1
) next_up on true

left join lateral (
  select c.* from checkins c
   where c.athlete_id = r.athlete_id
   order by c.week_start desc
   limit 1
) ci on true

left join lateral (
  select ra.id, ra.name, ra.date, g.event_type
    from goals g join races ra on ra.id = g.race_id
   where g.athlete_id = r.athlete_id and ra.date >= p_today
   order by ra.date
   limit 1
) race on true

-- messages reach an athlete through their thread with this coach
left join lateral (
  select count(*)::integer unread
    from messages m
    join message_threads th on th.id = m.thread_id
    cross join me
   where th.athlete_id = r.athlete_id
     and m.recipient_id = me.coach_id
     and m.read_at is null
) msg on true

-- what this coach changed for them lately, so the roster does not report a
-- deliberate adaptation as if it were a surprise
left join lateral (
  select count(*)::integer recent
    from session_revisions sr, me
   where sr.athlete_id = r.athlete_id
     and sr.changed_by = me.coach_id
     and sr.changed_at >= (p_today - 6)::timestamptz
     and sr.kind <> 'created'
) adapt on true

order by pr.full_name;
$$;

comment on function im_coach_roster is
  'One row of facts per athlete on the caller''s roster. Judgement lives in the domain layer.';
