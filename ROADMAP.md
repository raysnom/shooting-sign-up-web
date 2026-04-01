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
- [x] Implement bulk-upload flow — parse CSV, call `supabase.auth.admin.inviteUserByEmail()` per member, link auth UID to member profile
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
- [x] Implement `exco-duty.ts` — randomly select training EXCO per session
- [x] Write allocations + exco_duty rows to database (draft-actions.ts server action)
- [x] Build draft results review page (President) — verify before publishing

---

## Phase 5: Schedule Publication & Notifications ✅ COMPLETE

**Goal:** Members receive their confirmed weekly schedule.

- [x] Build `runDraft` server action — triggered manually by President from sessions page
- [x] Build draft review page with publish/re-run controls
- [x] Build member schedule view with gun clash warnings (yellow banner)
- [x] Show priority score breakdown on member profile page
- [ ] Email notifications (Supabase Edge Function `send-schedule`) — **deferred to Phase 7**

---

## Phase 6: Cancellations, Attendance & No-Shows ✅ COMPLETE

**Goal:** Handle real-world operations during the training week.

- [x] Build cancellation flow — member cancels ≥24hrs before session
- [x] Implement auto-upgrade — find highest-scoring dry fire member, promote to live
- [x] Build attendance marking page (EXCO) — mark present/absent/VR per session
- [x] Implement no-show detection — if member was allocated but marked absent without VR, increment `N`
- [x] Build "provide reason" flow — member submits reason for absence
- [x] Build end-of-week compliance report — flag members below min training requirement

---

## Phase 7: Polish & Deploy 🚧 IN PROGRESS

**Goal:** Production-ready, deployed to Vercel.

### Polish Tasks
- [ ] Responsive design pass — ensure mobile-friendly for students on phones
- [ ] Error handling and loading states across all pages
- [ ] Bulk attendance upload (historical data)
- [ ] Email notifications (Supabase Edge Function `send-schedule`)
  - [ ] Build Edge Function to send schedule emails
  - [ ] Set up email service (Resend or Supabase built-in)
  - [ ] Template email with member's weekly schedule

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
- [ ] **EXCO duty scheduling** — Algorithm for fair rotation of EXCO duty across members

---

## Known Issues & Tech Debt

### High Priority
- [ ] **RLS on members table temporarily disabled** — Need to re-enable after testing. Run: `ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;`

### Medium Priority
- [ ] **No loading states on draft run** — Add skeleton loaders and progress indicators
- [ ] **Error messages not user-friendly** — Replace technical errors with clear user guidance
- [ ] **No pagination on member list** — Will be slow with >100 members

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

1. **Re-enable RLS on members table** — Critical security fix
2. **Responsive design pass** — Test on mobile devices
3. **Set up Vercel deployment** — Configure production environment
4. **End-to-end testing** — Full user flow from preference submission to schedule publication
5. **User acceptance testing** — Get feedback from actual club members
6. **Production launch** — Deploy and monitor first live draft cycle
