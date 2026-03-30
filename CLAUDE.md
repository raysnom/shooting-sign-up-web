# Shooting Sign-Up System — CLAUDE.md

> Full project specification lives in `PROJECT_SPEC.md`. This file defines the tech stack, architecture, database schema, and phased execution plan.

---

## Tech Stack

| Layer        | Technology                     |
|--------------|--------------------------------|
| Framework    | Next.js 14+ (App Router)       |
| Language     | TypeScript                     |
| Database     | Supabase (hosted PostgreSQL)   |
| Auth         | Supabase Auth (email/password) |
| ORM / Client | Supabase JS SDK (`@supabase/supabase-js`) |
| Styling      | Tailwind CSS + shadcn/ui       |
| Deployment   | Vercel                         |
| Notifications| Supabase Edge Functions + email (Resend or Supabase built-in) |

---

## Project Structure

```
shooting-sign-up-web/
├── CLAUDE.md                      # This file — project plan & conventions
├── PROJECT_SPEC.md                # Full feature specification
├── src/
│   ├── app/                       # Next.js App Router pages
│   │   ├── (auth)/                # Login / invite / password reset
│   │   │   ├── login/
│   │   │   └── set-password/
│   │   ├── (dashboard)/           # Authenticated routes
│   │   │   ├── schedule/          # Member: view weekly schedule
│   │   │   ├── preferences/       # Member: submit slot preferences
│   │   │   ├── profile/           # Member: view attendance & score
│   │   │   └── cancel/            # Member: cancel a slot
│   │   ├── (admin)/               # EXCO & President routes
│   │   │   ├── attendance/        # EXCO: mark attendance
│   │   │   ├── guns/              # EXCO: edit gun allocations
│   │   │   ├── sessions/          # President: manage weekly sessions
│   │   │   ├── members/           # President: manage members, bulk upload
│   │   │   ├── requirements/      # President: set training requirements
│   │   │   └── inventory/         # President: dynamic session inventory
│   │   ├── layout.tsx
│   │   └── page.tsx               # Landing / redirect to login or dashboard
│   ├── components/
│   │   ├── ui/                    # shadcn/ui primitives
│   │   ├── schedule-table.tsx
│   │   ├── preference-picker.tsx
│   │   ├── score-breakdown.tsx
│   │   ├── member-table.tsx
│   │   └── nav/
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts          # Browser Supabase client
│   │   │   ├── server.ts          # Server-side Supabase client
│   │   │   └── admin.ts           # Service-role client (for bulk ops)
│   │   ├── algorithm/
│   │   │   ├── priority-score.ts  # Score calculation
│   │   │   ├── draft-engine.ts    # Slot allocation logic
│   │   │   ├── gun-clash.ts       # Gun clash resolution
│   │   │   └── exco-duty.ts       # Random EXCO duty assignment
│   │   ├── utils.ts
│   │   └── constants.ts           # Weights, lane counts, deadlines
│   ├── hooks/                     # Custom React hooks
│   └── types/                     # TypeScript type definitions
├── supabase/
│   ├── migrations/                # SQL migration files
│   ├── seed.sql                   # Seed data for development
│   └── functions/                 # Supabase Edge Functions
│       ├── run-draft/             # Triggered at 5pm Saturday
│       └── send-schedule/         # Sends results at 8pm Saturday
├── public/
├── tailwind.config.ts
├── next.config.ts
├── tsconfig.json
├── package.json
└── .env.local                     # NEXT_PUBLIC_SUPABASE_URL, SUPABASE_ANON_KEY, etc.
```

---

## Database Schema

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

### `guns`
| Column | Type      | Notes |
|--------|-----------|-------|
| id     | uuid (PK) | |
| name   | text      | e.g. "Gun_Club4" |
| type   | enum      | air_pistol, air_rifle |

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

### `semesters`
| Column     | Type      | Notes |
|------------|-----------|-------|
| id         | uuid (PK) | |
| name       | text      | e.g. "Semester 1 2026" |
| start_date | date      | |
| end_date   | date      | |
| created_by | uuid (FK) | |

> When a new semester starts, all members' `no_show_count` is reset to 0.

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
| created_by          | uuid (FK) | President who created it |

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

### `preferences`
| Column     | Type      | Notes |
|------------|-----------|-------|
| id         | uuid (PK) | |
| member_id  | uuid (FK) | |
| week_id    | uuid (FK) | |
| session_id | uuid (FK) | |
| rank       | int       | 1 = top choice |
| created_at | timestamp | |
| **Unique** | | (member_id, week_id, session_id) |

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

### `training_requirements`
| Column       | Type      | Notes |
|--------------|-----------|-------|
| id           | uuid (PK) | |
| week_id      | uuid (FK) | |
| target_type  | enum      | team, individual |
| target_value | text      | Team code (e.g. "APW") or member UUID |
| min_sessions | int       | Minimum sessions required that week |

> **Team-level** requirements are the baseline (e.g. APW must train 3x/week). During competition season, the President can add **individual overrides** for competitive shooters with a higher requirement (e.g. John must train 5x/week). Individual overrides take precedence over team-level requirements.

### `exco_duty`
| Column     | Type      | Notes |
|------------|-----------|-------|
| id         | uuid (PK) | |
| session_id | uuid (FK) | |
| week_id    | uuid (FK) | |
| member_id  | uuid (FK) | Randomly selected EXCO |

---

## Row-Level Security (RLS) Policy Summary

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

---

## Execution Plan — Phases

### Phase 1: Project Setup & Auth
> Goal: Runnable app with login, role-based routing, and member management.

- [ ] Initialize Next.js project with TypeScript + Tailwind + shadcn/ui
- [ ] Set up Supabase project (database, auth, env variables)
- [ ] Run database migrations — create all tables and enums
- [ ] Configure RLS policies for all tables
- [ ] Build login page (`/login`) — email + password via Supabase Auth
- [ ] Build set-password page (`/set-password`) — handles invite link redirect, member sets their own password
- [ ] Implement auth middleware — redirect unauthenticated users
- [ ] Build role-based layout — Member vs EXCO vs President nav
- [ ] Build member management page — create individual profiles, bulk-upload CSV, edit, archive
- [ ] Implement bulk-upload flow — parse CSV, call `supabase.auth.admin.inviteUserByEmail()` per member, link auth UID to member profile
- [ ] Build handover page — promote to EXCO, transfer presidency

### Phase 2: Session & Schedule Management
> Goal: Presidents can define the weekly training schedule. Members can view sessions.

- [ ] Build session template management page (President) — create/edit the recurring weekly template (12 default sessions)
- [ ] Build "Generate Week" flow — auto-create sessions from template, President tweaks as needed
- [ ] Build session cancellation UI — President marks sessions as cancelled (no school / no Saturday training), hidden from members
- [ ] Build dynamic session inventory UI — adjust live/dry lane counts per session
- [ ] Build semester management page (President) — create semesters, triggers no-show count reset
- [ ] Build competition flags page (President) — set `R` flag per individual, team, or level for a given week
- [ ] Build training requirements page — set team-level baseline per week + individual overrides for competition season
- [ ] Build member schedule view — "My Week" dashboard showing allocated slots
- [ ] Build gun management page (EXCO) — assign/edit guns per member

### Phase 3: Preference Submission
> Goal: Members can submit and edit ranked session preferences (for live fire) before the deadline.

- [ ] Build preference picker UI — drag-to-rank sessions for live fire (e.g. #1 Tue Afternoon, #2 Thu Afternoon)
- [ ] Enforce submission deadline (Saturday 5:00 PM) — disable form after cutoff
- [ ] Show submission status — "Ranked 4 sessions" or "Not yet submitted"
- [ ] Allow editing preferences before deadline
- [ ] Exclude members who haven't submitted from draft

### Phase 4: The Draft Algorithm
> Goal: The core allocation engine runs and assigns slots fairly.

- [ ] Implement `priority-score.ts` — calculate score from formula with all 6 variables
- [ ] Implement 4-week rolling window for `L_past` — query live fire history within window
- [ ] Implement `draft-engine.ts`:
  - Process all sessions in the week
  - For each session, rank requesting members by priority score
  - Assign live fire lanes to top N members (N = available live lanes)
  - Assign remaining members to dry fire lanes
  - Update `L_current` after each live fire assignment
  - Apply back-to-back bonus logic
- [ ] Implement `gun-clash.ts`:
  - Detect clashes during assignment
  - Attempt to move member to next preference (max 1 level drop)
  - If threshold exceeded, keep original slot and flag clash warning
- [ ] Implement `exco-duty.ts` — randomly select training EXCO per session
- [ ] Write allocations + exco_duty rows to database
- [ ] Build draft results review page (President) — verify before publishing

### Phase 5: Schedule Publication & Notifications
> Goal: Members receive their confirmed weekly schedule.

- [ ] Build Supabase Edge Function `run-draft` — triggered at deadline or manually by President
- [ ] Build Supabase Edge Function `send-schedule` — emails each member their slots
- [ ] Build member schedule view with gun clash warnings (yellow icon)
- [ ] Show priority score breakdown on member profile page

### Phase 6: Cancellations, Attendance & No-Shows
> Goal: Handle real-world operations during the training week.

- [ ] Build cancellation flow — member cancels ≥24hrs before session
- [ ] Implement auto-upgrade — find highest-scoring dry fire member, promote to live
- [ ] Build attendance marking page (EXCO) — mark present/absent/VR per session
- [ ] Implement no-show detection — if member was allocated but marked absent without VR, increment `N`
- [ ] Build "provide reason" flow — member submits reason for absence
- [ ] Build end-of-week compliance report — flag members below min training requirement

### Phase 7: Polish & Deploy
> Goal: Production-ready, deployed to Vercel.

- [ ] Responsive design pass — ensure mobile-friendly for students on phones
- [ ] Error handling and loading states across all pages
- [ ] Bulk attendance upload (historical data)
- [ ] Set up Vercel project, connect GitHub repo, configure env vars
- [ ] Set up Supabase cron job for Saturday 5pm draft trigger
- [ ] End-to-end testing with sample data
- [ ] Deploy to production

---

## Coding Conventions

- **TypeScript strict mode** — no `any` types.
- **Server Components by default** — only use `"use client"` when interactivity is needed.
- **Supabase calls on the server** where possible (using `server.ts` client) — avoid exposing queries to the browser.
- **Service-role client** (`admin.ts`) only in server actions / Edge Functions for privileged operations (bulk user creation, running the draft).
- **shadcn/ui** for all UI components — do not install additional component libraries.
- **One feature per file** — keep components focused and small.
- **Naming**: `kebab-case` for files, `PascalCase` for components, `camelCase` for functions/variables.
- **Algorithm code** lives in `src/lib/algorithm/` and must be **pure functions** with no database calls — data is fetched separately and passed in. This makes the algorithm testable.

---

## Key Design Decisions

1. **Algorithm runs server-side only** — never in the browser. Triggered by Supabase Edge Function or Next.js server action.
2. **Weights are stored in `constants.ts`** — if Presidents want to tune weights in the future, this is the single place to change them (could be promoted to a DB config table later).
3. **4-week rolling window** — `L_past` is computed at draft time by querying allocations from the last 4 weeks. No separate counter to maintain.
4. **Soft gun clash rule** — the algorithm never blocks a live fire allocation. It only tries one preference-level drop, then flags the clash.
5. **Members excluded if no preferences submitted** — no auto-assignment. You don't submit, you don't get a slot.
6. **President never handles passwords** — bulk-upload triggers `inviteUserByEmail()`. Members set their own password via invite link. Individual member creation follows the same flow.
7. **Preferences are for live fire ranking** — members rank which sessions they want live fire for. If they don't win live fire for a session, they auto-get dry fire. No separate dry fire preference needed.
8. **No-show count resets per semester** — a `semesters` table defines term boundaries. When a new semester is created, all `no_show_count` values reset to 0.
9. **Competition flag (R) is flexible** — President can set it per individual member, per team (e.g. all APW), or per level (e.g. all SH2). Stored in `competition_flags` table and resolved per-member at draft time.
10. **Template-based scheduling** — President defines session templates once (12 slots/week). Each week auto-generates sessions from templates. President can then tweak individual sessions before the draft.
11. **Back-to-back = consecutive sessions on the same day** — e.g. Mon 3:00–4:30 and Mon 4:30–6:00.
12. **Sessions can be cancelled** — President marks sessions as cancelled (no school, no Saturday training). Cancelled sessions have `is_cancelled = true`, are hidden from the preference picker, and skipped by the draft.
13. **Training requirements: team baseline + individual override** — Team-level requirements are the default. During competition season, President can set higher individual requirements for competitive shooters. The system checks individual override first, falls back to team baseline.
