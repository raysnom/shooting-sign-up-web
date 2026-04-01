-- ============================================
-- Migration 004: Divisions, Competition Groups, Special Events
-- ============================================

-- ──────────────────────────────────────────────
-- 1. Extend training_target_type enum
-- ──────────────────────────────────────────────

ALTER TYPE training_target_type ADD VALUE IF NOT EXISTS 'division';
ALTER TYPE training_target_type ADD VALUE IF NOT EXISTS 'group';

-- ──────────────────────────────────────────────
-- 2. Competition Groups
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS competition_groups (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL,
    created_by  uuid        REFERENCES auth.users(id),
    created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS competition_group_members (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id    uuid        NOT NULL REFERENCES competition_groups(id) ON DELETE CASCADE,
    member_id   uuid        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at  timestamptz DEFAULT now(),
    UNIQUE(group_id, member_id)
);

-- ──────────────────────────────────────────────
-- 3. Special Events (for manual attendance)
-- ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS special_events (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id     uuid        NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
    name        text        NOT NULL,
    event_date  date        NOT NULL,
    created_by  uuid        REFERENCES auth.users(id),
    created_at  timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS special_event_attendance (
    id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    special_event_id    uuid        NOT NULL REFERENCES special_events(id) ON DELETE CASCADE,
    member_id           uuid        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at          timestamptz DEFAULT now(),
    UNIQUE(special_event_id, member_id)
);

-- ──────────────────────────────────────────────
-- 4. RLS Policies
-- ──────────────────────────────────────────────

ALTER TABLE competition_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE competition_group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE special_event_attendance ENABLE ROW LEVEL SECURITY;

-- Competition groups: everyone can read, president can manage
CREATE POLICY competition_groups_select
    ON competition_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY competition_groups_insert
    ON competition_groups FOR INSERT TO authenticated
    WITH CHECK (is_president());
CREATE POLICY competition_groups_update
    ON competition_groups FOR UPDATE TO authenticated
    USING (is_president());
CREATE POLICY competition_groups_delete
    ON competition_groups FOR DELETE TO authenticated
    USING (is_president());

-- Competition group members: everyone can read, president can manage
CREATE POLICY competition_group_members_select
    ON competition_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY competition_group_members_insert
    ON competition_group_members FOR INSERT TO authenticated
    WITH CHECK (is_president());
CREATE POLICY competition_group_members_delete
    ON competition_group_members FOR DELETE TO authenticated
    USING (is_president());

-- Special events: everyone can read, EXCO+ can manage
CREATE POLICY special_events_select
    ON special_events FOR SELECT TO authenticated USING (true);
CREATE POLICY special_events_insert
    ON special_events FOR INSERT TO authenticated
    WITH CHECK (is_exco_or_above());
CREATE POLICY special_events_update
    ON special_events FOR UPDATE TO authenticated
    USING (is_exco_or_above());
CREATE POLICY special_events_delete
    ON special_events FOR DELETE TO authenticated
    USING (is_exco_or_above());

-- Special event attendance: everyone can read, EXCO+ can manage
CREATE POLICY special_event_attendance_select
    ON special_event_attendance FOR SELECT TO authenticated USING (true);
CREATE POLICY special_event_attendance_insert
    ON special_event_attendance FOR INSERT TO authenticated
    WITH CHECK (is_exco_or_above());
CREATE POLICY special_event_attendance_delete
    ON special_event_attendance FOR DELETE TO authenticated
    USING (is_exco_or_above());
