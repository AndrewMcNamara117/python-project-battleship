-- ============================================================
-- 0025 — BEST EFFORTS
--
-- The fastest 1K, mile, 5K, 10K, half and marathon inside each run, found
-- at import from the full track (which is never stored). Kept on the
-- activity as [{key, elapsedS, startM}]; personal records are the minimum
-- per key across an athlete's activities, so deleting an activity takes its
-- records with it and nothing goes stale.
--
-- Readable exactly as the activity is: by the athlete and their coach.
-- im_club_feed and im_feed_item do not return it, so the club does not see
-- anyone's records unless the athlete tells them.
-- ============================================================

alter table activities
  add column if not exists best_efforts jsonb not null default '[]'::jsonb;
