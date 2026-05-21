-- ============================================================================
-- 011_add_running_late_to_allocations.sql
-- Let members flag themselves as ~30 min late so EXCO marking attendance
-- knows not to mark absent. If the late member was EXCO on duty for the
-- first session of their day (range opener), the schedule action reassigns
-- duty to another EXCO; this migration only adds storage.
-- ============================================================================

ALTER TABLE public.allocations
  ADD COLUMN IF NOT EXISTS running_late BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS running_late_at TIMESTAMPTZ;

-- Member can update running_late on their own allocations. Mirrors the
-- de-facto pattern already used for cancellation.
DROP POLICY IF EXISTS allocations_update_running_late_own ON public.allocations;
CREATE POLICY allocations_update_running_late_own
  ON public.allocations FOR UPDATE
  TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());
