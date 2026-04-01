-- ============================================================================
-- 002_rls_policies.sql
-- Row Level Security policies for the Shooting Club Sign-Up System
-- ============================================================================

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Returns the current authenticated user's role
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS role_type AS $$
  SELECT role FROM public.members WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns true if the current user is exco or president
CREATE OR REPLACE FUNCTION public.is_exco_or_above()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE id = auth.uid() AND role IN ('exco', 'president')
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns true if the current user is president
CREATE OR REPLACE FUNCTION public.is_president()
RETURNS boolean AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.members
    WHERE id = auth.uid() AND role = 'president'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ============================================================================
-- ENABLE RLS ON ALL TABLES
-- ============================================================================

ALTER TABLE public.members              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guns                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_templates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.semesters            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.weeks                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competition_flags    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preferences          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.allocations          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_requirements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exco_duty            ENABLE ROW LEVEL SECURITY;


-- ============================================================================
-- members
-- ============================================================================
-- Member: SELECT own row
-- EXCO: SELECT all non-archived
-- President: Full CRUD

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


-- ============================================================================
-- guns
-- ============================================================================
-- Member: SELECT own gun (the gun assigned to them via members.gun_id)
-- EXCO: Full CRUD
-- President: Full CRUD

CREATE POLICY guns_select_own
  ON public.guns FOR SELECT
  TO authenticated
  USING (
    id = (SELECT gun_id FROM public.members WHERE members.id = auth.uid())
  );

CREATE POLICY guns_select_exco
  ON public.guns FOR SELECT
  TO authenticated
  USING (is_exco_or_above());

CREATE POLICY guns_insert_exco
  ON public.guns FOR INSERT
  TO authenticated
  WITH CHECK (is_exco_or_above());

CREATE POLICY guns_update_exco
  ON public.guns FOR UPDATE
  TO authenticated
  USING (is_exco_or_above())
  WITH CHECK (is_exco_or_above());

CREATE POLICY guns_delete_exco
  ON public.guns FOR DELETE
  TO authenticated
  USING (is_exco_or_above());


-- ============================================================================
-- session_templates
-- ============================================================================
-- All authenticated: SELECT
-- President: INSERT, UPDATE, DELETE

CREATE POLICY session_templates_select_authenticated
  ON public.session_templates FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY session_templates_insert_president
  ON public.session_templates FOR INSERT
  TO authenticated
  WITH CHECK (is_president());

CREATE POLICY session_templates_update_president
  ON public.session_templates FOR UPDATE
  TO authenticated
  USING (is_president())
  WITH CHECK (is_president());

CREATE POLICY session_templates_delete_president
  ON public.session_templates FOR DELETE
  TO authenticated
  USING (is_president());


-- ============================================================================
-- semesters
-- ============================================================================
-- All authenticated: SELECT
-- President: INSERT, UPDATE, DELETE

CREATE POLICY semesters_select_authenticated
  ON public.semesters FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY semesters_insert_president
  ON public.semesters FOR INSERT
  TO authenticated
  WITH CHECK (is_president());

CREATE POLICY semesters_update_president
  ON public.semesters FOR UPDATE
  TO authenticated
  USING (is_president())
  WITH CHECK (is_president());

CREATE POLICY semesters_delete_president
  ON public.semesters FOR DELETE
  TO authenticated
  USING (is_president());


-- ============================================================================
-- weeks
-- ============================================================================
-- All authenticated: SELECT
-- President: INSERT, UPDATE, DELETE

CREATE POLICY weeks_select_authenticated
  ON public.weeks FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY weeks_insert_president
  ON public.weeks FOR INSERT
  TO authenticated
  WITH CHECK (is_president());

CREATE POLICY weeks_update_president
  ON public.weeks FOR UPDATE
  TO authenticated
  USING (is_president())
  WITH CHECK (is_president());

CREATE POLICY weeks_delete_president
  ON public.weeks FOR DELETE
  TO authenticated
  USING (is_president());


-- ============================================================================
-- sessions
-- ============================================================================
-- Member: SELECT non-cancelled sessions only
-- EXCO/President: SELECT all sessions (including cancelled)
-- President: INSERT, UPDATE, DELETE

CREATE POLICY sessions_select_member
  ON public.sessions FOR SELECT
  TO authenticated
  USING (
    is_cancelled = false
    OR is_exco_or_above()
  );

CREATE POLICY sessions_insert_president
  ON public.sessions FOR INSERT
  TO authenticated
  WITH CHECK (is_president());

CREATE POLICY sessions_update_president
  ON public.sessions FOR UPDATE
  TO authenticated
  USING (is_president())
  WITH CHECK (is_president());

CREATE POLICY sessions_delete_president
  ON public.sessions FOR DELETE
  TO authenticated
  USING (is_president());


-- ============================================================================
-- competition_flags
-- ============================================================================
-- All authenticated: SELECT
-- President: INSERT, UPDATE, DELETE

CREATE POLICY competition_flags_select_authenticated
  ON public.competition_flags FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY competition_flags_insert_president
  ON public.competition_flags FOR INSERT
  TO authenticated
  WITH CHECK (is_president());

CREATE POLICY competition_flags_update_president
  ON public.competition_flags FOR UPDATE
  TO authenticated
  USING (is_president())
  WITH CHECK (is_president());

CREATE POLICY competition_flags_delete_president
  ON public.competition_flags FOR DELETE
  TO authenticated
  USING (is_president());


-- ============================================================================
-- preferences
-- ============================================================================
-- Member: SELECT, INSERT, UPDATE, DELETE own rows
-- EXCO/President: SELECT all

CREATE POLICY preferences_select_own
  ON public.preferences FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY preferences_select_exco
  ON public.preferences FOR SELECT
  TO authenticated
  USING (is_exco_or_above());

CREATE POLICY preferences_insert_own
  ON public.preferences FOR INSERT
  TO authenticated
  WITH CHECK (member_id = auth.uid());

CREATE POLICY preferences_update_own
  ON public.preferences FOR UPDATE
  TO authenticated
  USING (member_id = auth.uid())
  WITH CHECK (member_id = auth.uid());

CREATE POLICY preferences_delete_own
  ON public.preferences FOR DELETE
  TO authenticated
  USING (member_id = auth.uid());


-- ============================================================================
-- allocations
-- ============================================================================
-- Member: SELECT own rows
-- EXCO: SELECT all
-- President: Full CRUD

CREATE POLICY allocations_select_own
  ON public.allocations FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY allocations_select_exco
  ON public.allocations FOR SELECT
  TO authenticated
  USING (is_exco_or_above());

CREATE POLICY allocations_insert_president
  ON public.allocations FOR INSERT
  TO authenticated
  WITH CHECK (is_president());

CREATE POLICY allocations_update_president
  ON public.allocations FOR UPDATE
  TO authenticated
  USING (is_president())
  WITH CHECK (is_president());

CREATE POLICY allocations_delete_president
  ON public.allocations FOR DELETE
  TO authenticated
  USING (is_president());


-- ============================================================================
-- attendance
-- ============================================================================
-- Member: SELECT own rows
-- EXCO: SELECT all, INSERT, UPDATE
-- President: Full CRUD

CREATE POLICY attendance_select_own
  ON public.attendance FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY attendance_select_exco
  ON public.attendance FOR SELECT
  TO authenticated
  USING (is_exco_or_above());

CREATE POLICY attendance_insert_exco
  ON public.attendance FOR INSERT
  TO authenticated
  WITH CHECK (is_exco_or_above());

CREATE POLICY attendance_update_exco
  ON public.attendance FOR UPDATE
  TO authenticated
  USING (is_exco_or_above())
  WITH CHECK (is_exco_or_above());

CREATE POLICY attendance_delete_president
  ON public.attendance FOR DELETE
  TO authenticated
  USING (is_president());


-- ============================================================================
-- training_requirements
-- ============================================================================
-- All authenticated: SELECT
-- President: INSERT, UPDATE, DELETE

CREATE POLICY training_requirements_select_authenticated
  ON public.training_requirements FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY training_requirements_insert_president
  ON public.training_requirements FOR INSERT
  TO authenticated
  WITH CHECK (is_president());

CREATE POLICY training_requirements_update_president
  ON public.training_requirements FOR UPDATE
  TO authenticated
  USING (is_president())
  WITH CHECK (is_president());

CREATE POLICY training_requirements_delete_president
  ON public.training_requirements FOR DELETE
  TO authenticated
  USING (is_president());


-- ============================================================================
-- exco_duty
-- ============================================================================
-- Member: SELECT own rows
-- EXCO/President: SELECT all
-- President: INSERT, UPDATE, DELETE

CREATE POLICY exco_duty_select_own
  ON public.exco_duty FOR SELECT
  TO authenticated
  USING (member_id = auth.uid());

CREATE POLICY exco_duty_select_exco
  ON public.exco_duty FOR SELECT
  TO authenticated
  USING (is_exco_or_above());

CREATE POLICY exco_duty_insert_president
  ON public.exco_duty FOR INSERT
  TO authenticated
  WITH CHECK (is_president());

CREATE POLICY exco_duty_update_president
  ON public.exco_duty FOR UPDATE
  TO authenticated
  USING (is_president())
  WITH CHECK (is_president());

CREATE POLICY exco_duty_delete_president
  ON public.exco_duty FOR DELETE
  TO authenticated
  USING (is_president());
