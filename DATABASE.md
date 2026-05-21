# Database Schema & Policies

> This document defines the complete database schema for the Shooting Sign-Up System. For project specification, see [PROJECT_SPEC.md](PROJECT_SPEC.md). For implementation details, see [CLAUDE.md](CLAUDE.md).

---

## Database Tables

### `members`
| Column            | Type      | Notes |
|-------------------|-----------|-------|
| id                | uuid (PK) | Supabase Auth UID |
| login_id          | text      | Unique school ID |
| name              | text      | |
| email             | text      | Unique |
| team              | enum      | APW, APM, ARM, ARW |
| level             | enum      | JH1, JH2, JH3, JH4, SH1, SH2 |
| role              | enum      | member, exco, president |
| gun_id            | uuid (FK) | Nullable — references `guns.id` |
| no_show_count     | int       | `N` in formula. **Resets to 0 each semester.** |
| archived          | boolean   | Default false |
| created_at        | timestamp | |

---

### `guns`
| Column | Type      | Notes |
|--------|-----------|-------|
| id     | uuid (PK) | |
| name   | text      | e.g. "Gun_Club4" |
| type   | enum      | air_pistol, air_rifle |

---

### `competition_flags`
| Column      | Type      | Notes |
|-------------|-----------|-------|
| id          | uuid (PK) | |
| week_id     | uuid (FK) | Which week this applies to |
| target_type | enum      | individual, team, level |
| target_value| text      | member UUID, team code (e.g. "APW"), or level (e.g. "SH1") |
| set_by      | uuid (FK) | President who set it |
| created_at  | timestamp | |

> The algorithm resolves `R` for each member by checking if any `competition_flags` row matches them (by member ID, team, or level) for the current week.

---

### `session_templates`
| Column     | Type      | Notes |
|------------|-----------|-------|
| id         | uuid (PK) | |
| name       | text      | e.g. "Monday Session 1" |
| day        | enum      | mon, tue, wed, thu, fri, sat |
| time_start | time      | e.g. 15:00 |
| time_end   | time      | e.g. 16:30 |
| live_lanes | int       | Default 12 |
| dry_lanes  | int       | Default 16 |

> President creates templates once. Each week, sessions are auto-generated from templates. Individual sessions can be tweaked after generation.

---

### `semesters`
| Column     | Type      | Notes |
|------------|-----------|-------|
| id         | uuid (PK) | |
| name       | text      | e.g. "Semester 1 2026" |
| start_date | date      | |
| end_date   | date      | |
| created_by | uuid (FK) | |

> When a new semester starts, all members' `no_show_count` is reset to 0.

---

### `weeks`
| Column              | Type      | Notes |
|---------------------|-----------|-------|
| id                  | uuid (PK) | |
| semester_id         | uuid (FK) | References `semesters.id` |
| start_date          | date      | Monday of the training week |
| end_date            | date      | Sunday of the training week |
| submission_deadline  | timestamp | Saturday 5:00 PM |
| results_published_at | timestamp | Null until draft completes |
| status              | enum      | open, closed, drafted, published |
| max_live_per_member | int       | Nullable — optional cap on live fire slots per member for this week |
| created_by          | uuid (FK) | President who created it |

---

### `sessions`
| Column      | Type      | Notes |
|-------------|-----------|-------|
| id          | uuid (PK) | |
| week_id     | uuid (FK) | |
| template_id | uuid (FK) | Nullable — references `session_templates.id` (null if manually created) |
| name        | text      | e.g. "Tuesday Afternoon" |
| day         | enum      | mon, tue, wed, thu, fri, sat |
| time_start  | time      | |
| time_end    | time      | |
| live_lanes  | int       | Default 12, president-adjustable |
| dry_lanes   | int       | Default 16, president-adjustable |
| is_cancelled| boolean   | Default false. President sets to true to mark session as not available (e.g. no school, no Saturday training). Cancelled sessions are hidden from preference picker and excluded from the draft. |

---

### `preferences`
| Column         | Type      | Notes |
|----------------|-----------|-------|
| id             | uuid (PK) | |
| member_id      | uuid (FK) | |
| week_id        | uuid (FK) | |
| session_id     | uuid (FK) | |
| rank           | int       | 1 = top choice |
| running_late   | boolean   | Default false. Member declares they will arrive ~30 min late (typically a lesson running over). Carried onto the resulting `allocations.running_late`. Used by the draft to skip late EXCOs when picking the day's first-session duty. |
| max_live_count | int       | Nullable. Member-set cap on live fire slots for the week (e.g. rank 6 sessions but only want live fire 4 times → set to 4). NULL = no member cap (effectively the number of ranked sessions). Stored redundantly on every row of a (member, week) batch since prefs are deleted+inserted as a batch and all rows share the same value. Distinct from `weeks.max_live_per_member` (admin-set, global). Draft engine uses MIN of both. Migration `014`. |
| created_at     | timestamp | |
| **Unique**     | | (member_id, week_id, session_id) |

---

### `allocations`
| Column            | Type      | Notes |
|-------------------|-----------|-------|
| id                | uuid (PK) | |
| member_id         | uuid (FK) | |
| session_id        | uuid (FK) | |
| week_id           | uuid (FK) | |
| type              | enum      | live, dry |
| gun_id            | uuid (FK) | Nullable |
| gun_clash_warning | text      | Nullable — name of clashing member |
| priority_score    | float     | Score at time of allocation |
| cancelled         | boolean   | Default false |
| cancelled_at      | timestamp | Nullable |
| running_late      | boolean   | Default false. Set from `preferences.running_late` at draft time, and toggle-able by the member from `/schedule` after the draft. EXCO sees a "~30 min late" badge next to the member's name on the attendance page. When toggled post-draft for the day's first session, the schedule action reassigns EXCO duty to a non-late EXCO if the member was the opener. |
| running_late_at   | timestamp | Nullable. Set when `running_late` flips to true, cleared otherwise. |

---

### `attendance`
| Column     | Type      | Notes |
|------------|-----------|-------|
| id         | uuid (PK) | |
| member_id  | uuid (FK) | |
| session_id | uuid (FK) | |
| week_id    | uuid (FK) | |
| status     | enum      | present, absent, vr (valid reason), no_show |
| reason     | text      | Nullable — for VR or member-provided reason |
| marked_by  | uuid (FK) | EXCO/President who marked it |

---

### `training_requirements`
| Column       | Type      | Notes |
|--------------|-----------|-------|
| id           | uuid (PK) | |
| week_id      | uuid (FK) | |
| target_type  | enum      | team, individual |
| target_value | text      | Team code (e.g. "APW") or member UUID |
| min_sessions | int       | Minimum sessions required that week |

> **Team-level** requirements are the baseline (e.g. APW must train 3x/week). During competition season, the President can add **individual overrides** for competitive shooters with a higher requirement (e.g. John must train 5x/week). Individual overrides take precedence over team-level requirements.

---

### `exco_duty`
| Column     | Type      | Notes |
|------------|-----------|-------|
| id         | uuid (PK) | |
| session_id | uuid (FK) | |
| week_id    | uuid (FK) | |
| member_id  | uuid (FK) | Randomly selected EXCO allocated to the session. For the **first session of each day** (the range opener), EXCOs with `allocations.running_late = true` are excluded from the random pool. If every allocated EXCO for that opener session is late, no row is written and the schedule UI shows "⚠ Teacher opens range". |

---

## Row-Level Security (RLS) Policies

> All tables have RLS enabled. Policies are defined in `supabase/migrations/002_rls_policies.sql`.

### Policy Summary

| Table                | Member                  | EXCO                           | President        |
|----------------------|-------------------------|--------------------------------|------------------|
| members              | Read own row            | Read all non-archived          | Full CRUD        |
| preferences          | CRUD own rows           | Read all                       | Read all         |
| allocations          | Read own rows           | Read all                       | Full CRUD        |
| attendance           | Read own rows           | Read/Write all                 | Full CRUD        |
| sessions             | Read all                | Read all                       | Full CRUD        |
| session_templates    | Read all                | Read all                       | Full CRUD        |
| weeks                | Read all                | Read all                       | Full CRUD        |
| semesters            | Read all                | Read all                       | Full CRUD        |
| guns                 | Read own gun            | Full CRUD                      | Full CRUD        |
| competition_flags    | Read own (resolved)     | Read all                       | Full CRUD        |
| training_requirements| Read own team           | Read all                       | Full CRUD        |
| exco_duty            | Read own rows           | Read all                       | Full CRUD        |

### Helper Functions

Three security-definer functions support RLS policies:

```sql
-- Returns the current user's role (member, exco, president)
public.get_user_role() RETURNS role_type

-- Returns true if current user is EXCO or President
public.is_exco_or_above() RETURNS boolean

-- Returns true if current user is President
public.is_president() RETURNS boolean
```

These functions are used throughout RLS policies to enforce role-based access control.

---

## Migrations

Database migrations are located in `supabase/migrations/`:

1. **001_initial_schema.sql** — Creates all tables, enums, and relationships
2. **002_rls_policies.sql** — Enables RLS and defines all security policies
3. **003_add_max_live_per_member.sql** — Adds optional per-week (admin-set) live fire cap
4. **004_divisions_groups_special_events.sql** — Adds division enum, competition groups, and special events tables
5. **005_drop_competition_flags.sql** — Removes the unused `competition_flags` table (replaced by competition groups)
6. **006_gun_data.sql** — Seeds the initial gun inventory
7. **007_add_individual_gun_type.sql** — Adds `individual` to the `gun_type` enum
8. **008_atomic_no_show_count.sql** — Replaces ad-hoc no-show increments with an atomic SQL function
9. **009_audit_log.sql** — Adds the `audit_log` table for tracking admin actions
10. **010_add_drafting_week_status.sql** — Adds `drafting` to the `week_status` enum (atomic draft lock)
11. **011_add_running_late_to_allocations.sql** — Adds `running_late`/`running_late_at` columns to `allocations`
12. **012_add_running_late_to_preferences.sql** — Adds `running_late` column to `preferences`
13. **013_reenable_rls_members.sql** — Re-enables RLS on the `members` table with documented policies
14. **014_add_max_live_count_to_preferences.sql** — Adds member-set live fire cap (`max_live_count`) to `preferences`

Run migrations in order using the Supabase SQL Editor or CLI.

---

## Enums

### `role_type`
- `member` — Regular club member
- `exco` — Executive committee (can mark attendance, manage guns)
- `president` — Full admin access

### `team_type`
- `APW` — Air Pistol Women
- `APM` — Air Pistol Men
- `ARM` — Air Rifle Men
- `ARW` — Air Rifle Women

### `level_type`
- `JH1`, `JH2`, `JH3`, `JH4` — Junior High 1-4
- `SH1`, `SH2` — Senior High 1-2

### `day_type`
- `mon`, `tue`, `wed`, `thu`, `fri`, `sat`

### `week_status_type`
- `open` — Preference submission window is open
- `closed` — Deadline passed, draft not yet run
- `drafting` — Draft is currently running (atomic lock; prevents concurrent runs)
- `drafted` — Draft completed, awaiting publication
- `published` — Schedule visible to members

> The `drafting` value is added by migration `010_add_drafting_week_status.sql`. Older Supabase projects created from `001_initial_schema.sql` alone will be missing it — apply migration 010 before running the draft.

### `allocation_type`
- `live` — Live fire slot
- `dry` — Dry fire slot

### `attendance_status_type`
- `present` — Member attended
- `absent` — Unexcused absence (increments no-show count)
- `vr` — Valid reason (excused, no penalty)
- `no_show` — Default status for allocated but not marked

### `gun_type`
- `air_pistol`
- `air_rifle`

### `target_type`
- `individual` — Applies to a specific member
- `team` — Applies to all members of a team
- `level` — Applies to all members of a level

### `requirement_target_type`
- `team` — Team-level training requirement
- `individual` — Individual override requirement

---

## Indexes

Key indexes for performance:

```sql
-- Foreign keys are automatically indexed in PostgreSQL

-- Additional indexes for common queries:
CREATE INDEX idx_allocations_week_member ON allocations(week_id, member_id);
CREATE INDEX idx_preferences_week_member ON preferences(week_id, member_id);
CREATE INDEX idx_sessions_week ON sessions(week_id);
CREATE INDEX idx_attendance_week_session ON attendance(week_id, session_id);
```

These are included in the migration files.

---

## Relationships

```
members
  ├─ gun_id → guns.id
  └─ id ← allocations.member_id
     └─ id ← preferences.member_id
     └─ id ← attendance.member_id
     └─ id ← exco_duty.member_id

semesters
  └─ id ← weeks.semester_id

weeks
  ├─ id ← sessions.week_id
  ├─ id ← preferences.week_id
  ├─ id ← allocations.week_id
  ├─ id ← attendance.week_id
  ├─ id ← competition_flags.week_id
  ├─ id ← training_requirements.week_id
  └─ id ← exco_duty.week_id

session_templates
  └─ id ← sessions.template_id (nullable)

sessions
  ├─ id ← preferences.session_id
  ├─ id ← allocations.session_id
  ├─ id ← attendance.session_id
  └─ id ← exco_duty.session_id
```
