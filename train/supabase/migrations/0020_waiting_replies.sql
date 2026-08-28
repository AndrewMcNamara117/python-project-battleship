-- =============================================================================
-- 0020 - waiting for a reply is workload
-- =============================================================================
--
-- The roster carried one communication signal, `unread_message`, counting
-- messages to the coach with a null `read_at`. Two things were wrong with it.
--
-- Nothing on the coach's side has ever set `read_at`. `markMessagesRead` is
-- called from exactly one place in the product -- the ATHLETE's view of their
-- coach -- so for a coach the count only ever went up. It was not "unread".
-- It was "this athlete has written to you at some point, ever".
--
-- And it did not clear when the coach answered. Replying left "1 unread
-- message" on the roster the next morning, so the one signal the product had
-- about communication could neither be trusted nor discharged.
--
-- Waiting is a fact about the conversation: the athlete is waiting when the
-- last human message in the thread is theirs. That is derived here, in the
-- same single roster query, so there is no second definition to disagree with
-- the first and no per-athlete query added to the page.

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
  waiting_since         timestamptz,
  waiting_messages      integer,
  waiting_latest        text,
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
  wait.waiting_since,
  coalesce(wait.waiting_messages, 0)::integer,
  wait.waiting_latest,
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

-- WHO IS WAITING ON WHOM.
--
-- Not a flag and not a count of unread: the athlete is waiting when the last
-- human message in their thread with this coach is theirs. `read_at` says
-- nothing about it -- a coach can read something and still owe an answer, and
-- on this side nothing has ever written read_at anyway.
--
-- `waiting_since` is the FIRST message of the unanswered run, not the last.
-- Someone who wrote three times yesterday morning has been waiting since
-- yesterday morning; dating them from their most recent message would reward
-- the athlete who gave up and stopped writing.
--
-- FORGE messages are ignored on both sides. An automated note is not the
-- coach answering, and FORGE never writes as the athlete.
left join lateral (
  select
    min(m.created_at)                                        as waiting_since,
    count(*)::integer                                        as waiting_messages,
    (array_agg(m.body order by m.created_at desc))[1]        as waiting_latest
  from messages m
  join message_threads th on th.id = m.thread_id
  cross join me
  where th.athlete_id = r.athlete_id
    and th.coach_id   = me.coach_id
    and m.sender_id   = r.athlete_id
    and m.author_kind = 'human'
    and m.created_at > coalesce(
      (select max(c.created_at)
         from messages c
         join message_threads t2 on t2.id = c.thread_id
        where t2.athlete_id = r.athlete_id
          and t2.coach_id   = me.coach_id
          and c.sender_id   = me.coach_id
          and c.author_kind = 'human'),
      '-infinity'::timestamptz)
) wait on true

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
