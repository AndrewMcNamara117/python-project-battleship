-- =============================================================================
-- 0018 — an athlete cannot mark their own check-in as nothing to see
-- =============================================================================
--
-- Slice 10 closed most of `checkins_own_write` being `for all`: a trigger now
-- stops an athlete writing a coach_response, an acknowledgement, or a reply
-- timestamp. One column was left open and reported as a known limitation --
-- `attention_level`. An athlete resubmitting their week could send honest
-- scores and a hand-picked level of 'none', and the check-in that said
-- "soreness 9" would never reach the coach's flagged list.
--
-- The rules that decide the level live in TypeScript (checkin-rules.ts) and
-- that is where they belong: they read free text, they compare against last
-- week, and porting them into SQL would create a second definition of triage
-- that silently drifts from the first. So this does not recompute triage.
--
-- It enforces a FLOOR, from the part of the input that is already sitting in
-- columns on this row: the six scores the athlete chose themselves. A level
-- may be raised above the floor -- the TypeScript rules do exactly that for
-- described pain, for two bad weeks running, for missed sessions -- but it
-- can never be written below it. What an athlete typed into the scores cannot
-- be contradicted by what they claim it amounts to.
--
-- The thresholds below are a strict subset of checkin-rules.ts. That is
-- duplication, and it is deliberate; supabase/test/checkin-triage-floor.test
-- runs both over the same inputs and fails if the floor ever exceeds what the
-- canonical rules produce, so the two cannot drift apart quietly.

create or replace function im_checkin_score_floor(
  p_soreness    smallint,
  p_fatigue     smallint,
  p_sleep       smallint,
  p_motivation  smallint,
  p_stress      smallint,
  p_confidence  smallint
) returns im_attention
language sql immutable as $$
  -- the score half of the canonical reason list, counted the same way
  select case
    when (
      (p_soreness   >= 8)::int + (p_fatigue    >= 8)::int +
      (p_sleep      <= 3)::int + (p_motivation <= 3)::int +
      (p_stress     >= 8)::int + (p_confidence <= 3)::int
    ) >= 2 then 'attention'::im_attention
    when (
      (p_soreness   >= 8)::int + (p_fatigue    >= 8)::int +
      (p_sleep      <= 3)::int + (p_motivation <= 3)::int +
      (p_stress     >= 8)::int + (p_confidence <= 3)::int
    ) = 1 then 'watch'::im_attention
    else 'none'::im_attention
  end;
$$;

comment on function im_checkin_score_floor is
  'The least attention a check-in can be given, from its scores alone. A '
  'strict subset of the canonical rules in checkin-rules.ts, never the whole '
  'of them: it exists so the level cannot be written below what the athlete''s '
  'own numbers already say.';

create or replace function im_enforce_checkin_floor()
returns trigger language plpgsql as $$
declare
  floor_level im_attention;
begin
  floor_level := im_checkin_score_floor(
    new.soreness, new.fatigue, new.sleep,
    new.motivation, new.stress, new.confidence);

  -- raised, not rejected. A correct client never trips this, because the
  -- canonical rules already return at least the floor; a request that tries
  -- to go under it is simply brought back up rather than failing in the
  -- athlete's face for something they did not do wrong.
  if floor_level = 'attention' and new.attention_level <> 'attention' then
    new.attention_level := 'attention';
  elsif floor_level = 'watch' and new.attention_level = 'none' then
    new.attention_level := 'watch';
  end if;

  return new;
end $$;

drop trigger if exists checkins_triage_floor on checkins;
create trigger checkins_triage_floor
  before insert or update on checkins
  for each row execute function im_enforce_checkin_floor();
