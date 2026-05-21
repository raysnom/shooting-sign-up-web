-- ============================================================================
-- 014_add_max_live_count_to_preferences.sql
-- Member-set cap on live fire allocations per week. Lets a member rank 6
-- sessions but say "I only want live fire for 4 of them — give the rest to
-- someone else." The cap is stored redundantly on every preference row for
-- the same (member_id, week_id) since preferences are inserted/deleted as
-- a batch. NULL means "no member-set cap" (defaults to number of ranked
-- preferences at draft time, i.e. effectively uncapped).
--
-- Distinct from weeks.max_live_per_member, which is an admin-set global
-- cap. The draft engine takes the MIN of both caps per member.
-- ============================================================================

ALTER TABLE public.preferences
  ADD COLUMN IF NOT EXISTS max_live_count INT;
