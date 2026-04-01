-- ============================================================================
-- 001_initial_schema.sql
-- Full database schema for the Shooting Club Sign-Up System
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

DO $$ BEGIN
    CREATE TYPE team_type AS ENUM ('APW', 'APM', 'ARM', 'ARW');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE level_type AS ENUM ('JH1', 'JH2', 'JH3', 'JH4', 'SH1', 'SH2');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE role_type AS ENUM ('member', 'exco', 'president');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE day_type AS ENUM ('mon', 'tue', 'wed', 'thu', 'fri', 'sat');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('present', 'absent', 'vr', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE week_status AS ENUM ('open', 'closed', 'drafted', 'published');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE allocation_type AS ENUM ('live', 'dry');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE competition_target_type AS ENUM ('individual', 'team', 'level');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE training_target_type AS ENUM ('team', 'individual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE gun_type_enum AS ENUM ('air_pistol', 'air_rifle');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ============================================================================
-- TABLES (ordered by foreign-key dependencies)
-- ============================================================================

-- --------------------------------------------------------------------------
-- semesters
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS semesters (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL,                          -- e.g. "Semester 1 2026"
    start_date  date        NOT NULL,
    end_date    date        NOT NULL,
    created_by  uuid        NOT NULL REFERENCES auth.users(id),
    created_at  timestamptz DEFAULT now()
);

-- --------------------------------------------------------------------------
-- guns
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS guns (
    id          uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text            NOT NULL,                      -- e.g. "Gun_Club4"
    type        gun_type_enum   NOT NULL,
    created_at  timestamptz     DEFAULT now()
);

-- --------------------------------------------------------------------------
-- members  (PK references Supabase Auth)
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS members (
    id              uuid            PRIMARY KEY REFERENCES auth.users(id),
    login_id        text            UNIQUE NOT NULL,
    name            text            NOT NULL,
    email           text            UNIQUE NOT NULL,
    team            team_type       NOT NULL,
    level           level_type      NOT NULL,
    role            role_type       NOT NULL DEFAULT 'member',
    gun_id          uuid            REFERENCES guns(id) ON DELETE SET NULL,
    no_show_count   int             NOT NULL DEFAULT 0,
    archived        boolean         NOT NULL DEFAULT false,
    created_at      timestamptz     DEFAULT now()
);

-- --------------------------------------------------------------------------
-- session_templates
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS session_templates (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    name        text        NOT NULL,
    day         day_type    NOT NULL,
    time_start  time        NOT NULL,
    time_end    time        NOT NULL,
    live_lanes  int         NOT NULL DEFAULT 12,
    dry_lanes   int         NOT NULL DEFAULT 16,
    created_at  timestamptz DEFAULT now()
);

-- --------------------------------------------------------------------------
-- weeks
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS weeks (
    id                      uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    semester_id             uuid            NOT NULL REFERENCES semesters(id) ON DELETE CASCADE,
    start_date              date            NOT NULL,
    end_date                date            NOT NULL,
    submission_deadline     timestamptz     NOT NULL,
    results_published_at    timestamptz,
    status                  week_status     NOT NULL DEFAULT 'open',
    created_by              uuid            NOT NULL REFERENCES auth.users(id),
    created_at              timestamptz     DEFAULT now()
);

-- --------------------------------------------------------------------------
-- sessions
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sessions (
    id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id         uuid        NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
    template_id     uuid        REFERENCES session_templates(id) ON DELETE SET NULL,
    name            text        NOT NULL,
    day             day_type    NOT NULL,
    time_start      time        NOT NULL,
    time_end        time        NOT NULL,
    live_lanes      int         NOT NULL DEFAULT 12,
    dry_lanes       int         NOT NULL DEFAULT 16,
    is_cancelled    boolean     NOT NULL DEFAULT false,
    created_at      timestamptz DEFAULT now()
);

-- --------------------------------------------------------------------------
-- competition_flags
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS competition_flags (
    id              uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id         uuid                    NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
    target_type     competition_target_type  NOT NULL,
    target_value    text                    NOT NULL,          -- member UUID, team code, or level
    set_by          uuid                    NOT NULL REFERENCES auth.users(id),
    created_at      timestamptz             DEFAULT now()
);

-- --------------------------------------------------------------------------
-- preferences
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS preferences (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id   uuid        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    week_id     uuid        NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
    session_id  uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    rank        int         NOT NULL,
    created_at  timestamptz DEFAULT now(),

    CONSTRAINT uq_preferences_member_week_session
        UNIQUE (member_id, week_id, session_id)
);

-- --------------------------------------------------------------------------
-- allocations
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS allocations (
    id                  uuid            PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id           uuid            NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    session_id          uuid            NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    week_id             uuid            NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
    type                allocation_type NOT NULL,
    gun_id              uuid            REFERENCES guns(id) ON DELETE SET NULL,
    gun_clash_warning   text,
    priority_score      float           NOT NULL,
    cancelled           boolean         NOT NULL DEFAULT false,
    cancelled_at        timestamptz,
    created_at          timestamptz     DEFAULT now()
);

-- --------------------------------------------------------------------------
-- attendance
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS attendance (
    id          uuid                PRIMARY KEY DEFAULT gen_random_uuid(),
    member_id   uuid                NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    session_id  uuid                NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    week_id     uuid                NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
    status      attendance_status   NOT NULL,
    reason      text,
    marked_by   uuid                REFERENCES auth.users(id),
    created_at  timestamptz         DEFAULT now(),

    CONSTRAINT uq_attendance_member_session_week
        UNIQUE (member_id, session_id, week_id)
);

-- --------------------------------------------------------------------------
-- training_requirements
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS training_requirements (
    id              uuid                    PRIMARY KEY DEFAULT gen_random_uuid(),
    week_id         uuid                    NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
    target_type     training_target_type    NOT NULL,
    target_value    text                    NOT NULL,
    min_sessions    int                     NOT NULL,
    created_at      timestamptz             DEFAULT now()
);

-- --------------------------------------------------------------------------
-- exco_duty
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS exco_duty (
    id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id  uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    week_id     uuid        NOT NULL REFERENCES weeks(id) ON DELETE CASCADE,
    member_id   uuid        NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    created_at  timestamptz DEFAULT now()
);


-- ============================================================================
-- INDEXES
-- ============================================================================

-- members
CREATE INDEX IF NOT EXISTS idx_members_team
    ON members (team);

CREATE INDEX IF NOT EXISTS idx_members_level
    ON members (level);

CREATE INDEX IF NOT EXISTS idx_members_role
    ON members (role);

CREATE INDEX IF NOT EXISTS idx_members_archived
    ON members (archived);

-- preferences
CREATE INDEX IF NOT EXISTS idx_preferences_member_week
    ON preferences (member_id, week_id);

-- allocations
CREATE INDEX IF NOT EXISTS idx_allocations_member_week
    ON allocations (member_id, week_id);

CREATE INDEX IF NOT EXISTS idx_allocations_session_week
    ON allocations (session_id, week_id);

-- attendance
CREATE INDEX IF NOT EXISTS idx_attendance_member_week
    ON attendance (member_id, week_id);

-- sessions
CREATE INDEX IF NOT EXISTS idx_sessions_week
    ON sessions (week_id);

-- competition_flags
CREATE INDEX IF NOT EXISTS idx_competition_flags_week
    ON competition_flags (week_id);
