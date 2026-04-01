# Feature Guide — User Manual

> This guide explains what each page in the Shooting Sign-Up System does and how to use it. For technical details about the algorithm and system architecture, see [PROJECT_SPEC.md](PROJECT_SPEC.md).

---

## 📱 Member Dashboard (All Users)

### **Schedule**
**Purpose:** View your weekly allocated training slots.

- Shows all your confirmed live fire and dry fire sessions for the current week
- Displays session times, types (live/dry), and gun assignments
- **Gun clash warnings** appear as yellow banners if you share a gun with another member
- Shows EXCO duty assignments (if you're selected to open/close the range)
- **Empty state:** If no schedule is published yet, shows "Schedule not yet available" message

**When to use:** Check this every Saturday evening after 8pm to see your training schedule for the upcoming week.

---

### **Preferences**
**Purpose:** Submit ranked session preferences for live fire slots.

- **Preference picker:** Click sessions to rank them in order (1 = top choice, 2 = second choice, etc.)
- **Arrow buttons:** Reorder your preferences by moving them up/down
- **Deadline countdown:** Shows time remaining until Saturday 5:00 PM cutoff
- **Read-only after deadline:** Once the deadline passes, you can view but not edit your preferences
- **Important:** If you don't submit preferences, you are **excluded entirely** from that week's draft

**When to use:** Every week before Saturday 5pm. Rank the sessions you want live fire for. If you don't win live fire for a session you ranked, you'll automatically get dry fire instead.

**How it works:**
1. Click on sessions you want to train in (for live fire)
2. Drag to reorder by priority (#1 = most wanted)
3. Submit before Saturday 5pm
4. Wait for schedule publication (Saturday 8pm)

---

### **Profile**
**Purpose:** View your attendance history and priority score breakdown.

- **Current semester stats:** Overall attendance percentage, no-show count
- **Priority score breakdown:** See exactly how your score is calculated for the next draft
  - Shows each component: `A` (attendance), `L_past` (past live fires), `R` (competition flag), `N` (no-shows)
  - Displays your current score with formula breakdown
- **Attendance history:** Past sessions marked as present/absent/VR
- **Live fire history:** Recent live fire allocations (used for `L_past` calculation)

**When to use:** Check this to understand why you got certain slots in the draft, or to track your attendance percentage.

---

### **Cancel**
**Purpose:** Cancel an allocated slot (≥24 hours before the session).

- **View upcoming allocations:** See all your confirmed sessions for the week
- **Cancel a slot:** Click "Cancel" next to a session to remove it from your schedule
- **24-hour rule:** You can only cancel if there's ≥24 hours until the session starts
- **No penalty:** Cancelling with ≥24hrs notice does **not** affect your priority score
- **Auto-upgrade:** When you cancel a live fire slot, the highest-scoring dry fire member in that session is automatically upgraded

**When to use:** If you can't make a training session due to illness, family emergency, school event, etc. Always cancel as soon as you know you can't attend!

**⚠️ Warning:** If you don't cancel and just don't show up, you'll get a no-show penalty (`N` increments by 1) unless EXCO marks it as VR (Valid Reason).

---

## 🛠️ EXCO Dashboard (EXCO + President)

### **Attendance**
**Purpose:** Mark attendance (present/absent/VR/no-show) for training sessions.

- **Select a week and session:** Dropdown to pick which session you're marking
- **Member list:** Shows all members who were allocated to that session
- **Status options:**
  - **Present:** Member attended
  - **Absent:** Unexcused absence — increments `N` (no-show count) by 1
  - **VR (Valid Reason):** Excused absence — no penalty
  - **No-Show:** Default for members who were allocated but didn't show up
- **Bulk actions:** Mark multiple members at once
- **Compliance report:** At the end of the week, see which members didn't meet their minimum training requirement

**When to use:** After each training session, mark who showed up. This is critical for calculating attendance percentages and no-show penalties.

**Important:** If a member provides a valid reason (sick, family emergency), mark them as **VR** instead of Absent to avoid penalizing them.

---

### **Guns**
**Purpose:** Manage gun inventory and assign guns to members.

- **Gun inventory:** List of all air pistols and air rifles in the club
- **Add new guns:** Create gun records (e.g. "Gun_Club1", "Gun_Club2")
- **Edit guns:** Rename or change gun type (air pistol / air rifle)
- **Assign guns to members:** Each member gets assigned one gun
- **Gun clash tracking:** System uses these assignments to detect clashes during the draft

**When to use:**
- **Initial setup:** Add all your club's guns when first setting up the system
- **Member onboarding:** Assign a gun to each new member
- **Equipment changes:** Update if a member switches to a different gun

**How gun clashes work:** If two members with the same gun both win live fire in the same session, the system tries to move one of them to their next preference. If it can't (without dropping them >1 preference level), both keep their original slot and get a warning banner in their schedule.

---

## 👑 President Dashboard (President Only)

### **Sessions**
**Purpose:** Manage session templates, create weekly schedules, run the draft, and review results.

This page has **three tabs:**

#### **Tab 1: Manage Templates**
- **Create session templates:** Define the recurring weekly schedule (12 default sessions)
- **Edit templates:** Modify session times, days, live/dry lane counts
- **Delete templates:** Remove templates that are no longer needed

**Example template:**
- Name: "Monday Afternoon Session 1"
- Day: Monday
- Time: 3:00 PM – 4:30 PM
- Live lanes: 12, Dry lanes: 16

**When to use:** Set this up **once** at the start of the semester. These templates are used to auto-generate sessions each week.

#### **Tab 2: Create Week**
- **Generate week from templates:** Auto-create sessions for a specific week based on your templates
- **Select semester and week:** Choose which Monday-Sunday week you're creating
- **Preview sessions:** See all 12 sessions before confirming
- **Tweak individual sessions:**
  - Adjust session times
  - Change live/dry lane counts (dynamic inventory)
  - **Cancel sessions** — mark sessions as unavailable (e.g. no school that day)
- **Submission deadline:** Automatically set to Saturday 5:00 PM

**When to use:** Every week before the draft. Usually done on Monday or Tuesday for the upcoming week.

**Important:** Cancelled sessions are **hidden** from members and excluded from the draft entirely.

#### **Tab 3: Draft & Results**
- **Run Draft:** Manually trigger the draft algorithm (Saturday after 5pm deadline)
- **Review Results:** See allocation results before publishing
  - Who got live fire vs dry fire
  - Gun clash warnings
  - Priority scores used for allocation
- **Re-run Draft:** If something looks wrong, you can re-run the draft before publishing
- **Publish Schedule:** Make results visible to all members (sends them their schedules)

**When to use:** Saturday evening after 5pm. Run the draft, review the results, then publish.

---

### **Semesters**
**Purpose:** Define academic term boundaries and trigger no-show count resets.

- **Create semesters:** Define start and end dates for each academic term
  - Example: "Semester 1 2026" — 13 Jan to 22 May
- **Organize weeks:** Each training week belongs to a semester
- **Reset no-show counts:** When a new semester starts, all members' `N` (no-show count) resets to 0
- **Historical tracking:** View past semesters and archived data

**When to use:**
- **Start of term:** Create a new semester at the beginning of each academic term
- **Long-term planning:** Set up future semesters in advance

**Why this matters:** No-show penalties don't accumulate forever. Each semester is a fresh start, so members aren't permanently penalized for mistakes from previous terms.

---

### **Members**
**Purpose:** Manage member accounts, bulk upload members, and edit profiles.

This page has **two tabs:**

#### **Tab 1: Member List**
- **View all members:** See everyone in the club (name, team, level, role, gun)
- **Search and filter:** Find specific members by name, team, or level
- **Edit member profiles:** Change team, level, gun assignment
- **Archive members:** Mark graduated seniors as archived (hides them from active lists)
- **Delete members:** Permanently remove member records (use with caution!)
- **Create individual member:** Add one new member at a time
  - Triggers invite email — they set their own password

#### **Tab 2: Bulk Upload**
- **Upload CSV:** Import multiple members at once
- **CSV format:**
  ```
  login_id,name,email,team,level,role
  JOHNAPW4,John Tan,john_tan@students.edu.sg,APW,JH4,member
  MARIAPM2,Maria Lim,maria_lim@students.edu.sg,APM,SH2,exco
  ```
- **Automatic invite emails:** System sends each member an invite link
- **Password security:** President never handles passwords — members set their own

**When to use:**
- **Start of semester:** Bulk upload all new members
- **Throughout the year:** Add individual new members as they join

**Important:** Use `login_id` format: First 5 letters of name + team code + level number (e.g. RAYSOAPM6 for Rayson Tan, APM, SH2).

---

### **Competition**
**Purpose:** Set competition flags (`R` variable) to give priority to members with upcoming competitions.

- **Flag upcoming competitions:** Mark members who need extra training before competitions
- **Three granularity levels:**
  1. **Individual:** Flag a specific shooter (e.g. "John has National Championships next week")
  2. **Team:** Flag an entire team (e.g. "APW has IVP this week")
  3. **Level:** Flag a year group (e.g. "All SH2 students have a competition")
- **Select week:** Choose which training week the flag applies to
- **Priority boost:** Flagged members get `R = 1` in the draft, adding **+50** to their priority score

**When to use:**
- **Competition week:** Set flags for the week leading up to a competition
- **Example:** Week of 20-26 Jan → APW competes in IVP → Set "Team: APW" flag for that week

**How it works:**
1. Go to Competition page
2. Select the training week
3. Choose flag type (individual/team/level)
4. Select target (e.g. "Team: APW" or "Individual: John Tan")
5. Save — all matching members get `R = 1` for that week's draft

---

### **Requirements**
**Purpose:** Set minimum training requirements per team or individual per week.

- **Team-level baseline:** Set default minimum sessions per week for each team
  - Example: APW must train 3x/week, ARM must train 4x/week
- **Individual overrides:** During competition season, set higher requirements for competitive shooters
  - Example: John (APW) must train 5x/week (overrides APW's 3x/week baseline)
- **Compliance tracking:** At the end of each week, system flags members who didn't meet their requirement
- **Priority:** Individual overrides take precedence over team-level requirements

**When to use:**
- **Start of semester:** Set team-level baselines
- **Competition season:** Add individual overrides for competitive shooters
- **Weekly:** Review compliance report to see who missed their requirement

**How it works:**
1. Select a training week
2. Set team-level requirements (e.g. APW: 3 sessions, ARM: 4 sessions)
3. Optionally add individual overrides (e.g. John Tan: 5 sessions)
4. At week's end, EXCO checks compliance report and follows up with members who fell short

---

### **Handover**
**Purpose:** Promote members to EXCO and transfer presidency.

- **Promote to EXCO:** Upgrade a member to EXCO role
  - Grants access to Attendance and Guns pages
  - Can mark attendance and manage gun assignments
- **Transfer Presidency:** Hand over president role to another member
  - New president gets full admin access
  - You are demoted to EXCO or member (your choice)
- **Role management:** View current EXCO and President

**When to use:**
- **End of school year:** Transfer presidency to next year's leader
- **New EXCO members:** Promote trusted members to help with admin tasks

**Important:** Presidency transfer is **irreversible** — make sure you're ready before confirming!

---

## Quick Reference — Who Can Do What

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

## Getting Started Checklist

### For Presidents (First-Time Setup):

1. ✅ **Create Semester** — Define your academic term dates
2. ✅ **Create Session Templates** — Set up your 12 recurring weekly sessions
3. ✅ **Add Guns** — Import all club air pistols and air rifles
4. ✅ **Bulk Upload Members** — Import all club members via CSV
5. ✅ **Assign Guns** — Link each member to their gun
6. ✅ **Set Training Requirements** — Define team-level minimums
7. ✅ **Generate First Week** — Create sessions from templates
8. ✅ **Communicate Deadline** — Tell members to submit preferences by Saturday 5pm

### For Members (Weekly Routine):

1. **Monday-Friday:** Log in and submit your preferences (rank sessions you want live fire for)
2. **Saturday 5pm:** Deadline! Make sure you've submitted.
3. **Saturday 8pm:** Check your schedule — see which slots you got
4. **Throughout the week:** Train! If you can't make a session, cancel it ≥24hrs in advance
5. **Repeat next week**

### For EXCO (Weekly Tasks):

1. **After each session:** Mark attendance (present/absent/VR)
2. **End of week:** Review compliance report
3. **As needed:** Update gun assignments for new members

### For Presidents (Weekly Tasks):

1. **Monday/Tuesday:** Generate next week's sessions from templates
2. **Tuesday-Friday:** Tweak session times/lanes if needed, cancel sessions for no-school days
3. **Saturday 5pm:** Deadline passes
4. **Saturday 5-8pm:** Run draft → Review results → Publish schedule
5. **Throughout week:** Handle edge cases (late submissions, member issues, etc.)
