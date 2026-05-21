-- ============================================================================
-- 012_add_running_late_to_preferences.sql
-- Let members declare expected lateness at preference-submission time
-- (e.g., a lecture ends ~30 min after the session starts). The draft
-- engine reads this and (a) carries it onto the resulting allocation and
-- (b) avoids assigning late EXCOs to open the range for the day's first
-- session.
-- ============================================================================

ALTER TABLE public.preferences
  ADD COLUMN IF NOT EXISTS running_late BOOLEAN NOT NULL DEFAULT false;
