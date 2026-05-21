-- ============================================================================
-- 013_reenable_rls_members.sql
-- Re-enable Row Level Security on public.members.
--
-- Context: RLS was temporarily disabled on the members table during testing
-- (see CLAUDE.md > Troubleshooting > "ERR_TOO_MANY_REDIRECTS"). This was
-- flagged in ROADMAP.md as a High-Priority security blocker before production.
--
-- Disabling RLS does NOT drop existing policies — the policies from
-- 002_rls_policies.sql are still attached to the table. So in the common case
-- this migration just flips the flag back on.
--
-- As a safety net, this script also recreates the documented policies if any
-- of them are missing (e.g. someone manually dropped them in the SQL editor).
-- The policy set must match DATABASE.md > "members":
--   Member:    SELECT own row
--   EXCO:      SELECT all non-archived
--   President: Full CRUD (SELECT all, INSERT, UPDATE, DELETE)
-- ============================================================================

-- 1. Re-enable RLS on the members table.
ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

-- 2. Recreate the documented policies if any of them are missing.
--    Using DROP ... IF EXISTS + CREATE keeps the script idempotent: if the
--    policies were never dropped, this is a clean no-op rebuild; if they were,
--    we restore them to match 002_rls_policies.sql exactly.

DROP POLICY IF EXISTS members_select_own        ON public.members;
DROP POLICY IF EXISTS members_select_exco       ON public.members;
DROP POLICY IF EXISTS members_select_president  ON public.members;
DROP POLICY IF EXISTS members_insert_president  ON public.members;
DROP POLICY IF EXISTS members_update_president  ON public.members;
DROP POLICY IF EXISTS members_delete_president  ON public.members;

CREATE POLICY members_select_own
  ON public.members FOR SELECT
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY members_select_exco
  ON public.members FOR SELECT
  TO authenticated
  USING (is_exco_or_above() AND archived = false);

CREATE POLICY members_select_president
  ON public.members FOR SELECT
  TO authenticated
  USING (is_president());

CREATE POLICY members_insert_president
  ON public.members FOR INSERT
  TO authenticated
  WITH CHECK (is_president());

CREATE POLICY members_update_president
  ON public.members FOR UPDATE
  TO authenticated
  USING (is_president())
  WITH CHECK (is_president());

CREATE POLICY members_delete_president
  ON public.members FOR DELETE
  TO authenticated
  USING (is_president());
