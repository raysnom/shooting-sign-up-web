# Project Roadmap

> This document tracks the phased implementation of the Shooting Sign-Up System. For feature specifications, see [PROJECT_SPEC.md](PROJECT_SPEC.md). For technical details, see [CLAUDE.md](CLAUDE.md).

---

## Phase 1: Project Setup & Auth ✅ COMPLETE

**Goal:** Runnable app with login, role-based routing, and member management.

- [x] Initialize Next.js project with TypeScript + Tailwind + shadcn/ui
- [x] Set up Supabase project (database, auth, env variables)
- [x] Run database migrations — create all tables and enums
- [x] Configure RLS policies for all tables
- [x] Build login page (`/login`) — email + password via Supabase Auth
- [x] Build set-password page (`/set-password`) — handles invite link redirect, member sets their own password
- [x] Implement auth middleware — redirect unauthenticated users
- [x] Build role-based layout — Member vs EXCO vs President nav
- [x] Build member management page — create individual profiles, bulk-upload CSV, edit, archive
- [x] Implement bulk-upload flow — parse CSV, call `supabase.auth.admin.createUser({ email_confirm: true })` per member with a shared default temp password, link auth UID to member profile (no invite email sent — credentials broadcast separately by the president)
- [x] Build handover page — promote to EXCO, transfer presidency

---

## Phase 2: Session & Schedule Management ✅ COMPLETE

**Goal:** Presidents can define the weekly training schedule. Members can view sessions.

- [x] Build session template management page (President) — create/edit the recurring weekly template (12 default sessions)
- [x] Build "Generate Week" flow — auto-create sessions from template, President tweaks as needed
- [x] Build session cancellation UI — President marks sessions as cancelled (no school / no Saturday training), hidden from members
- [x] Build dynamic session inventory UI — adjust live/dry lane counts per session
- [x] Build semester management page (President) — create semesters, triggers no-show count reset
- [x] Build competition flags page (President) — set `R` flag per individual, team, or level for a given week
- [x] Build training requirements page — set team-level baseline per week + individual overrides for competition season
- [x] Build member schedule view — "My Week" dashboard showing allocated slots
- [x] Build gun management page (EXCO) — assign/edit guns per member

---

## Phase 3: Preference Submission ✅ COMPLETE

**Goal:** Members can submit and edit ranked session preferences (for live fire) before the deadline.

- [x] Build preference picker UI — click-to-rank sessions for live fire with arrow reorder buttons
- [x] Enforce submission deadline (Saturday 5:00 PM) — disable form after cutoff, show read-only view
- [x] Show submission status — "X sessions ranked" or "Not yet submitted"
- [x] Allow editing preferences before deadline
- [x] Exclude members who haven't submitted from draft

---

## Phase 4: The Draft Algorithm ✅ COMPLETE

**Goal:** The core allocation engine runs and assigns slots fairly.

- [x] Implement `priority-score.ts` — calculate score from formula with all 6 variables
- [x] Implement 4-week rolling window for `L_past` — query live fire history within window
- [x] Implement `draft-engine.ts`:
  - Process all sessions in the week
  - For each session, rank requesting members by priority score
  - Assign live fire lanes to top N members (N = available live lanes)
  - Assign remaining members to dry fire lanes
  - Update `L_current` after each live fire assignment
  - Apply back-to-back bonus logic
- [x] Implement `gun-clash.ts`:
  - Detect clashes during assignment
  - Attempt to move member to next preference (max 1 level drop)
  - If threshold exceeded, keep original slot and flag clash warning
- [x] Implement `exco-duty.ts` — load-balanced (least-loaded-first) selection of training EXCO per session for fair weekly duty distribution
- [x] Write allocations + exco_duty rows to database (draft-actions.ts server action)
- [x] Build draft results review page (President) — verify before publishing

---

## Phase 5: Schedule Publication & Notifications ✅ COMPLETE

**Goal:** Members receive their confirmed weekly schedule.

- [x] Build `runDraft` server action — triggered manually by President from sessions page
- [x] Build draft review page with publish/re-run controls
- [x] Build member schedule view with gun clash warnings (yellow banner)
- [x] Show priority score breakdown on member profile page
- [~] Email notifications — **descoped** (members will check the website directly)

---

## Phase 6: Cancellations, Attendance & No-Shows ✅ COMPLETE

**Goal:** Handle real-world operations during the training week.

- [x] Build cancellation flow — member cancels ≥24hrs before session
- [x] Implement auto-upgrade — find highest-scoring dry fire member, promote to live
- [x] Build attendance marking page (EXCO) — mark present/absent/VR per session
- [x] Implement no-show detection — if member was allocated but marked absent without VR, increment `N`
- [x] Build "provide reason" flow — member submits reason for absence
- [x] Build end-of-week compliance report — flag members below min training requirement
- [x] Running-late declaration — per-session checkbox at preference time + post-draft toggle on schedule; draft excludes late EXCOs from opening the range for the day's first session, and EXCO sees a "~30 min late" badge on the attendance page. Migrations `011`, `012`.

---

## Phase 7: Polish & Deploy 🚧 IN PROGRESS

**Goal:** Production-ready, deployed to Vercel.

### Polish Tasks
- [x] Responsive design pass — sidebar collapses to off-canvas drawer below `md:` breakpoint; verified at build time, still needs hands-on testing on an actual phone
- [x] Loading states — shared `Skeleton` component, route-group `loading.tsx` files for `(auth)`, `(dashboard)`, `(admin)`, plus page-specific loaders for `/profile`, `/schedule`, `/attendance`
- [x] Caching — tagged `unstable_cache` helpers in `src/lib/cache.ts` for stable admin reads; `updateTag()` invalidation in admin server actions
- [x] Optimistic UI — `useOptimistic` on cancel allocation, attendance marking, special-event toggling, preferences submit
- [x] Tooltips — Base UI tooltip in `src/components/ui/tooltip.tsx`, applied to priority score factors and status badges
- [x] Full Schedule grid — weekly day-column × session-row table in `/schedule` showing all allocations, with per-cell highlights for shared-gun clashes (yellow), EXCO-on-duty members (amber `EXCO` pill), and top/bottom "↑ TIC opens range" / "↓ TIC closes range" rows per day when the opening/closing session has no EXCO on duty
- [ ] Error handling improvements — replace remaining technical errors with user-friendly messages
- [~] Bulk attendance upload (historical data) — **descoped**, club is starting fresh on this system
- [~] Email notifications — **descoped**, members check the website directly

### Additional polish (May 2026 session)
- [x] Shared `src/lib/utils/datetime.ts` — replaced 9 inline `formatDate`/`formatTime` helpers; fixed UTC parsing bug in attendance/compliance/semesters/requirements pages
- [x] Sessions page: "Testing Tools" block gated behind `NODE_ENV=development` (prevents accidental data wipe in prod)
- [x] Sessions page: week-status toggle disabled on `drafted`/`published` weeks with explanatory tooltip
- [x] Run Draft → Draft Review now auto-redirects on success (previously two-step manual handoff)
- [x] Schedule page: cancel-slot dialog button relabelled "Cancel My Slot" (was generic "Confirm")
- [x] Attendance page: session dropdown shows formatted 12-hour times (was raw `14:00:00`)
- [x] Compliance page: removed redundant summary sentence duplicating the stat cards
- [x] Semesters page: "Reset No-Show Counts" moved into a dedicated red-bordered Danger Zone card
- [x] Preferences page: rewrote wall-of-text card description into a 2-step numbered list with EXCO-only running-late callout (role-gated)
- [x] Page-specific loading skeletons added for `/preferences` and `/profile`

### Member-controlled allocation & leftover claiming (May 2026)
- [x] **Member-set live fire cap** — new optional `max_live_count` field on the preferences page. Members can rank 6+ sessions but cap live fire allocations at N (or set to 0 for dry-fire-only). Migration `014_add_max_live_count_to_preferences.sql`. Draft engine takes `MIN(weeks.max_live_per_member, preferences.max_live_count)` per member.
- [x] **Post-draft leftover claiming** — members who didn't submit preferences can claim unfilled slots on their Schedule page once the week is `published`. Auto-prefers live fire, falls back to dry. New `claimLeftoverSlot()` server action in `src/app/(dashboard)/schedule/actions.ts`. Member-side eligibility is "zero preferences for the week" (members who submitted but got 0 allocations are NOT eligible — they were already considered by the draft).

### Member Onboarding & Instructions
- [x] Member-facing usage instructions — drafted as a single WhatsApp broadcast message (with FAQ section) covering login credentials, weekly preference deadline, schedule check, cancellation, and VR submission. Distributed by the president directly to the club WhatsApp group; not linked from the sidebar.
- [~] First-login "verify your email address is correct" banner — **deferred** for now (members can flag wrong emails via the WhatsApp group, and the president edits via the admin Members page)
- [x] Decided format: WhatsApp broadcast message (not Notion, not in-app `/help` page)

### Deployment Tasks
- [ ] Set up Vercel project
- [ ] Connect GitHub repo to Vercel
- [ ] Configure environment variables in Vercel dashboard
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
- [ ] Set up Supabase cron job for Saturday 5pm draft trigger (optional automation)
- [ ] End-to-end testing with sample data
- [ ] Load testing with realistic member counts
- [ ] Deploy to production
- [ ] Monitor first live draft cycle
- [ ] Gather user feedback and iterate

---

## Future Enhancements (Post-Launch)

Ideas for future iterations:

- [ ] **Mobile app** — React Native or PWA for better mobile experience
- [ ] **Dashboard analytics** — President can see allocation trends, attendance patterns, no-show statistics
- [ ] **Configurable weights** — Allow President to adjust priority score weights via UI (instead of editing constants.ts)
- [ ] **Historical reporting** — Export semester reports, member attendance summaries
- [ ] **Automated draft scheduling** — Supabase cron job to auto-run draft at 5pm Saturday
- [ ] **SMS notifications** — Send schedule updates via SMS for members without email access
- [ ] **Waitlist for cancelled slots** — Auto-notify next-highest-priority member when someone cancels
- [ ] **Integration with school calendar** — Auto-cancel sessions on school holidays
- [ ] **Multi-semester planning** — Presidents can set up templates and requirements for future semesters in advance
- [ ] **Member self-service profile updates** — Members can update their own contact info (email, phone)
- [x] **EXCO duty scheduling** — Algorithm for fair rotation of EXCO duty across members (load-balanced least-loaded-first selection in `exco-duty.ts`)

---

## Known Issues & Tech Debt

### High Priority
- [x] **RLS on members table re-enabled** — migration `013_reenable_rls_members.sql` applied; all 6 documented policies (`members_select_own/_exco/_president`, `members_insert/update/delete_president`) verified in place

### Medium Priority
- [x] **No loading states** — Added shared `Skeleton` component and per-route `loading.tsx` files (incl. preferences, profile)
- [x] **Draft progress indicator** — modal dialog with spinner, expected-steps list, and elapsed-seconds counter; closes automatically on completion
- [ ] **Error messages not user-friendly** — Replace technical errors with clear user guidance
- [x] **Member list pagination** — client-side, filter-aware, 25/50/100 page sizes

### Low Priority
- [ ] **No dark mode** — Future nice-to-have
- [ ] **No keyboard shortcuts** — Could improve power user experience
- [ ] **No audit log** — Track who made what changes (useful for debugging)

---

## Development Progress Tracking

| Phase | Status | Completion Date | Notes |
|-------|--------|-----------------|-------|
| Phase 1 | ✅ Complete | 2025-01-28 | Auth and member management working |
| Phase 2 | ✅ Complete | 2025-01-28 | Session templates and schedule management |
| Phase 3 | ✅ Complete | 2025-01-28 | Preference submission flow |
| Phase 4 | ✅ Complete | 2025-01-28 | Draft algorithm implemented |
| Phase 5 | ✅ Complete | 2025-01-28 | Schedule publication (email notifications deferred) |
| Phase 6 | ✅ Complete | 2025-01-28 | Cancellations and attendance tracking |
| Phase 7 | 🚧 In Progress | TBD | Polish and deployment |

---

## Next Steps

1. **Hands-on mobile testing** — Verify the new off-canvas sidebar drawer + key member flows on an actual phone
2. **Broadcast WhatsApp onboarding message** — Includes login credentials (email + shared default temp password), weekly deadline, and a short FAQ; sent to the club WhatsApp group
3. **Set up Vercel deployment** — Project creation, GitHub connection, env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`)
4. **End-to-end testing on the deployed URL** — Full user flow from preference submission through draft to schedule publication
5. **Production launch** — Monitor the first live draft cycle and gather member feedback
