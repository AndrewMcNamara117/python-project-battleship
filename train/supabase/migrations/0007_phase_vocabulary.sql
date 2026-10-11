-- ============================================================
-- 0007 — PHASE VOCABULARY
--
-- Programme templates need the phases coaches actually name: a specific
-- block, a peak, a taper, a return-to-running progression, and a custom
-- escape hatch for the ones that fit no standard shape.
--
-- This sits in its own migration because Postgres will not let a newly
-- added enum value be used in the transaction that adds it. 0008 consumes
-- these; adding them here is what makes that legal.
-- ============================================================

alter type im_phase add value if not exists 'specific' after 'build';
alter type im_phase add value if not exists 'peak';
alter type im_phase add value if not exists 'taper';
alter type im_phase add value if not exists 'return';
alter type im_phase add value if not exists 'custom';
