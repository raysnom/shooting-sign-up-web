# Shooting Sign-Up System — Project Specification

## Problem Statement

**Current system:** Presidents create a Google Sheet every Saturday at 12pm and release it to the club. Students fill in their names on a first-come-first-serve basis. This leads to several issues:

- Live firing slots fill up within minutes — members who are late or have slow internet miss out.
- Simultaneous edits cause earlier entries to be overwritten by later ones.
- Members who train equally hard get unequal access to live firing slots.

**Revised system:** A web-based platform where members submit slot preferences during a weekly window. An algorithm then assigns live fire and dry fire slots based on attendance, past allocations, and training requirements — replacing "fastest-finger-first" with fair, transparent, algorithmic allocation.

---

## Club Structure

### Teams

| Code | Team              |
|------|-------------------|
| APW  | Air Pistol Women  |
| APM  | Air Pistol Men    |
| ARM  | Air Rifle Men     |
| ARW  | Air Rifle Women   |

### Member Levels

| Level | Description    |
|-------|----------------|
| JH1   | Junior High 1  |
| JH2   | Junior High 2  |
| JH3   | Junior High 3  |
| JH4   | Junior High 4  |
| SH1   | Senior High 1  |
| SH2   | Senior High 2  |

---

## Lane Inventory

Each training session has a fixed default capacity:

| Type     | Lanes |
|----------|-------|
| Live Fire | 12   |
| Dry Fire  | 16   |
| **Total** | **28** |

Presidents can adjust these numbers per-session via the Admin Dashboard (see [Dynamic Session Inventory](#dynamic-session-inventory)).

### Default Weekly Schedule Template

Each session is **1.5 hours**. The standard template (12 sessions/week):

| Day       | Session 1         | Session 2         |
|-----------|-------------------|-------------------|
| Monday    | 3:00 PM – 4:30 PM | 4:30 PM – 6:00 PM |
| Tuesday   | 3:00 PM – 4:30 PM | 4:30 PM – 6:00 PM |
| Wednesday | 3:00 PM – 4:30 PM | 4:30 PM – 6:00 PM |
| Thursday  | 3:00 PM – 4:30 PM | 4:30 PM – 6:00 PM |
| Friday    | 3:00 PM – 4:30 PM | 4:30 PM – 6:00 PM |
| Saturday  | 9:00 AM – 10:30 AM | 10:30 AM – 12:00 PM |

The President creates this template once. Each week, sessions are auto-generated from the template. The President can then tweak individual sessions (adjust times, remove sessions, modify lane counts) before the draft.

**Cancelling sessions:** If there is no school on a particular day or no Saturday training, the President can mark that day's sessions as **cancelled**. Cancelled sessions are hidden from the preference picker and excluded from the draft entirely. Members will not see them as an option.

**Back-to-back sessions** are two consecutive sessions on the same day (e.g. Monday 3:00–4:30 and Monday 4:30–6:00). The `B` (Back-to-Back Bonus) applies when a member wins live fire in one and requests the next.

---

## The Allocation Algorithm

### Weekly Flow

1. **Preference Submission** — Members log in and **rank the sessions they want live fire for**, in order of preference (e.g. #1 Tue Afternoon, #2 Thu Afternoon, #3 Sat Morning). If they don't win live fire for a session, they are auto-assigned dry fire for that session instead. Members can optionally set a **Maximum live fire sessions** cap (e.g. rank 6 sessions but only want live fire 4 times) — the draft will give them live fire on their top N by score and fall back to dry for the rest. Members who do not submit preferences are excluded from the priority-score draft but can claim leftover slots after publication — see [Post-Draft Leftover Claiming](#post-draft-leftover-claiming).
2. **Deadline** — Submission window closes at **5:00 PM on Saturday**.
3. **Draft Execution** — The algorithm calculates a priority score for every member who requested each slot and assigns lanes from highest score to lowest.
4. **Automatic Dry Fire Fallback** — If a member's score is not high enough for a live fire lane (or they've hit their personal/admin live fire cap), they are automatically assigned a dry fire lane for that session.
5. **Schedule Publication** — Results are published by **8:00 PM on Saturday**. The system sends every member a single, clean schedule with their confirmed slots for the week.

### Priority Score Formula

```
Priority_Score = (W1 × A) − (W2 × L_past) − (W4 × L_current) + (W3 × R) + (W6 × B) − (W5 × N)
```

### Variables & Weights

| Symbol       | Name                        | Description | Weight | Value |
|--------------|-----------------------------|-------------|--------|-------|
| `A`          | Attendance                  | Overall attendance percentage (e.g. 85) | `W1` | **1** |
| `L_past`     | Past Live Fires             | Live fire slots won within a **4-week rolling window**. Only the last 4 weeks count — older history drops off automatically. Ensures long-term rotation without scores becoming inflated over a full semester. | `W2` | **25** |
| `L_current`  | Current Draft Live Fires    | Live fire slots already won in *this* draft round. Prevents slot-hogging within a single week. | `W4` | **200** |
| `R`          | Requirements                | `1` if the member has an upcoming competition, `0` otherwise. **Set by President** — can be applied per individual, per team, or per level. Gives priority to competitive shooters. | `W3` | **50** |
| `B`          | Back-to-Back Bonus          | `1` if the requested session is immediately after a session they just won. Cancels out the `L_current` penalty to encourage double sessions. | `W6` | **200** |
| `N`          | No-Shows                    | Number of unexcused absences on record. **Resets to 0 at the start of each semester.** Severely punishes missing a booked slot. | `W5` | **100** |

### Why This Works

- **Rotation is guaranteed** — The `−(W2 × L_past)` term means every live fire slot a member wins *lowers* their score for the following weeks, naturally cycling others in.
- **Attendance is rewarded** — Weighting attendance gives members a tangible incentive to show up for dry fire and general training.
- **Transparency** — Members can see exactly how their score is calculated.

> **Note:** Historical attendance data can be bulk-uploaded into the system.

---

## Gun Allocation

The system tracks which gun is assigned to each member. During the draft, the algorithm attempts to **avoid gun clashes** (two members sharing the same gun in the same session), but this is a **soft rule** — it will never deny a member a live fire slot solely because of a clash.

### Tolerance Threshold Logic

The algorithm limits how far it will drop a member down their preference list to resolve a gun clash:

1. **Clash detected** — Member A's #1 choice conflicts with Member B's gun.
2. **Check next preference** — If their #2 choice is free and clash-free, assign it. Still a highly ranked choice.
3. **Threshold reached** — If fixing the clash would require dropping the member **more than one preference level**, the algorithm **stops trying**.
4. **Spare Gun Protocol** — The member keeps their original top-choice session. Both affected members receive a warning in their schedule:

   > ⚠️ **Shared Gun Clash:** You are sharing Gun_Club4 with [Other Member] during this session. Please coordinate.

---

## Live Fire Caps

Two independent caps limit how many live fire slots a single member can win in a week. The draft uses the **lower** of the two for each member:

- **Admin-set cap (`weeks.max_live_per_member`)** — Optional, global for the week, set by the President from the Sessions admin page. Useful when the club wants to enforce rotation uniformly (e.g. "no one gets more than 3 live fire slots this week").
- **Member-set cap (`preferences.max_live_count`)** — Optional, per-member, set by each member at preference-submission time. Lets a member rank a flexible spread of sessions but limit how many live fire allocations they actually want (e.g. rank 6 sessions, cap live fire at 4). Setting it to `0` means "I only want dry fire this week — skip me for all live fire even on my ranked sessions."

When a member hits their effective cap during the draft, they don't disappear from their other ranked sessions — they simply fall through to the dry fire allocation pass for those sessions (subject to dry fire capacity).

---

## Post-Draft Leftover Claiming

After the draft is published, sessions sometimes have unfilled lanes — either because not enough members ranked them, or because no-pref-submitters and late joiners haven't been accounted for. **Members who did not submit any preferences for the week** can claim these leftover slots from their Schedule page:

- A new **Available Leftover Slots** section appears on the schedule for eligible members during a `published` week (not visible during `drafted` admin-review).
- Each session with leftover capacity shows its remaining live/dry counts and a **Claim this slot** button.
- The system **auto-prefers live fire** — if there's a live fire lane open, that's what the claimer gets; otherwise they get dry fire.
- Live fire claims still respect `weeks.max_live_per_member` (admin-set cap); dry fire is uncapped for leftover-claimers since they didn't engage with the priority-score system.
- Claimed slots are normal allocations — the 24-hour cancellation flow and the cancel→dry-promote auto-upgrade work the same way.

Members who **did** submit preferences (even if they only got 0 allocations) are **not eligible** to claim leftovers — they've already been considered by the priority-score draft. This keeps the system fair: people who engaged with the draft are committed to it, and people who skipped the draft entirely take whatever's still going.

---

## Cancellations & No-Shows

### Cancellations (≥ 24 hours before session)

- Members can cancel **either a live fire or a dry fire** allocation. Cancelling is a full withdrawal from that session — the member is removed entirely, not downgraded to dry fire.
- No penalty applied.
- When a **live fire** lane is vacated, it is immediately offered to the **highest-scoring dry fire member** in that same session, who is auto-upgraded. Cancelling a **dry fire** slot simply frees that dry lane (no auto-upgrade).

### No-Shows

- EXCO marks absent members as either **Absent** (unexcused) or **VR** (Valid Reason).
- **VR (Valid Reason):** No penalty. The `N` counter is **not** incremented. Members can also proactively submit a reason for missing a session.
- **Absent (unexcused):** The `N` (No-Show) counter on the member's record increments by 1. Because `W5 = 100`, even a single unexcused no-show tanks their priority score, pushing them to the bottom of the draft for the following week(s).

---

## User Roles & Permissions

### Member

- View their own schedule, attendance percentage, and priority score.
- Sign up for training sessions (submit slot preferences).
- Cancel training sessions.
- Provide a valid reason for missing a training session.

### TIC / EXCO (Teacher-in-Charge / Executive Committee)

- Mark members as **Absent** or **VR** (Valid Reason).
- Edit gun allocations.

### President

Everything EXCO can do, plus:

- **Create the weekly training schedule** (define available sessions).
- **Set minimum training requirements** per team per week, with individual overrides for competition season.
- **Set structured training slots.**
- **Cancel sessions** — mark a day's sessions as unavailable (e.g. no school, no Saturday training). Cancelled sessions are hidden from members.
- **Dynamic Session Inventory** — adjust the number of live/dry fire tokens per session before the draft runs (e.g. remove a lane that is broken, reserve lanes for a coach).
- **Member management:**
  - Create new member profiles.
  - Promote members to EXCO.
  - Hand over presidency to another member.
  - Archive seniors who have graduated.

---

## Dynamic Session Inventory

Before the Saturday draft, the system generates the default token pool for every session (12 Live, 16 Dry). Presidents can override this:

- **Remove tokens** — e.g. a broken lane on Tuesday, or 2 lanes reserved for a coach on Wednesday.
- Changes are reflected in the draft so members are only allocated into available lanes.

---

## Attendance Tracking

- Presidents set **minimum training requirements** each week at the **team level** (e.g. APW must train 3x/week, ARM must train 4x/week).
- During **competition season**, the President can set **individual overrides** for competitive shooters with a higher requirement (e.g. a specific member must train 5x/week). Individual overrides take precedence over the team-level baseline.
- At the end of each week, the system calculates which members did not meet their requirement (individual override if set, otherwise their team's baseline).

---

## EXCO on Duty

For each training session, the system **selects one EXCO member who is already training during that session** to be responsible for opening and closing the range.

### Fair Distribution

Selection is **load-balanced across the week** rather than independently random per session. Sessions are processed in order, and each one's duty goes to the eligible EXCO who has the fewest duties so far that week; ties are broken randomly. This keeps the spread between the busiest and least-busy EXCO to at most one, so with `N` duty-sessions and `K` eligible EXCOs each member ends up with either `floor(N/K)` or `ceil(N/K)` duties — i.e. everyone opens/closes roughly once or twice a week instead of one unlucky EXCO piling up many duties. Because ties are random, re-running the draft won't always reproduce the identical assignment.

### Running-Late Constraint

Members can declare they will arrive ~30 min late for a session — either at preference-submission time (via a per-session checkbox) or post-draft from their schedule. This flag is stored on the preference and propagated onto the resulting allocation.

For the **first session of each day** (the range opener), the draft excludes any allocated EXCO whose flag is set from the selection pool (the load-balancing then runs over the remaining non-late candidates). If every allocated EXCO for the day's first session is running late, no EXCO is assigned and the schedule UI surfaces a "↑ TIC opens range" row at the top of that day's column so the TIC (Teacher-in-Charge) knows their physical presence is required. For all other sessions, the late flag is informational only — late EXCOs can still be selected, since closing the range and mid-session duty are unaffected by a late arrival.

If a member toggles the flag from their schedule **after** the draft has run and they happen to be the assigned opener, the schedule action automatically reassigns duty to another non-late EXCO at the same session (or clears it if no replacement exists and surfaces a warning).

EXCO members see a "~30 min late" badge next to a late member's name on the attendance page so they know not to mark the member absent prematurely.

---

## Authentication & Member Onboarding

- Each member has a unique **loginID** (e.g. school student ID) that links their account to their profile.
- **President bulk-uploads** the member list (name, loginID, email, class, team) via CSV — the system creates Supabase Auth accounts via `supabase.auth.admin.createUser({ email_confirm: true })` with a shared **default temp password** (currently `njcsc26!`). **No invite email is sent** — accounts are auto-confirmed and ready to use immediately.
- Login is via **email + password**. Each session is authenticated through Supabase.
- Members CAN change their password by visiting `/set-password` directly, but there is no link to this route from the dashboard sidebar, so in practice all members share the same default password. Acceptable for this club's threat model; revisit if multi-tenant or external use is ever needed.

### Member Onboarding Flow

1. **President uploads CSV** — system creates auto-confirmed accounts with the default temp password.
2. **President broadcasts credentials** in a single WhatsApp message to the club group (email = each member's address, password = the shared default — same for everyone).
3. **Member logs in** with their email + default password — works immediately, no email confirmation step.
4. **(Optional)** Member visits `/set-password` directly to change their password — not advertised in-app, so this rarely happens in practice.

### Adding Members After Initial Upload

- President can also **create individual member profiles** from the admin Members page.
- New accounts also get the default temp password.

### Recovering a Lost Password

- President clicks **Reset Password** on any member's row in the admin Members page.
- The member's password is reset to the current default temp password.
- President shares that password with the member, who can then change it.

### Teacher / Oversight Accounts

- A shared **TIC (Teacher In Charge)** account exists with role `exco`.
- TIC can view schedules, view attendance, and mark attendance — but cannot run drafts, manage members, or modify configuration.

---

## Handover & Administration

| Action | Who Can Do It |
|--------|---------------|
| Create new member profiles | President |
| Bulk-upload member list | President |
| Promote a member to EXCO | President |
| Transfer presidency | President |
| Archive graduated seniors | President |

---

## Permissions Summary

| Feature | Member | EXCO | President |
|---------|--------|------|-----------|
| View Schedule | ✅ | ✅ | ✅ |
| Submit Preferences | ✅ | ✅ | ✅ |
| View Profile | ✅ | ✅ | ✅ |
| Cancel Slots | ✅ | ✅ | ✅ |
| Mark Attendance | ❌ | ✅ | ✅ |
| Manage Guns | ❌ | ✅ | ✅ |
| Manage Sessions | ❌ | ❌ | ✅ |
| Run Draft | ❌ | ❌ | ✅ |
| Manage Members | ❌ | ❌ | ✅ |
| Set Competition Flags | ❌ | ❌ | ✅ |
| Set Requirements | ❌ | ❌ | ✅ |
| Create Semesters | ❌ | ❌ | ✅ |
| Handover Roles | ❌ | ❌ | ✅ |

---

## 📖 Documentation

- **For users:** See **[FEATURES.md](FEATURES.md)** for a detailed guide on what each page does and how to use the system.
- **For developers:** See **[CLAUDE.md](CLAUDE.md)** for technical implementation details (database schema, architecture, coding conventions).
