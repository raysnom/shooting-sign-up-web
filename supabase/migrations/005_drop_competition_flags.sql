-- ============================================
-- Migration 005: Drop competition_flags table
-- ============================================
-- Competition flags have been replaced by training requirement gaps
-- in the priority score formula. The R (competition flag) variable
-- is now P (requirement gap) = max(0, required_sessions - attended_sessions).
-- Training requirements (via the requirements page) now serve both purposes:
-- setting minimum training and boosting draft priority.

-- Drop RLS policies and table (only if the table exists)
DO $$ BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'competition_flags') THEN
    DROP POLICY IF EXISTS competition_flags_select ON competition_flags;
    DROP POLICY IF EXISTS competition_flags_insert ON competition_flags;
    DROP POLICY IF EXISTS competition_flags_update ON competition_flags;
    DROP POLICY IF EXISTS competition_flags_delete ON competition_flags;
    DROP TABLE competition_flags;
  END IF;
END $$;

-- Drop the enum type (if not used elsewhere)
DROP TYPE IF EXISTS competition_target_type;
