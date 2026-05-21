# EXCO + TIC Instructions

> The message below is the **WhatsApp broadcast** sent to EXCO members and the TIC (Teacher-in-Charge, who holds the `president` role in the system). It covers their admin-side responsibilities on top of the regular member workflow already documented in [INSTRUCTIONS.md](INSTRUCTIONS.md).

## Before sending

Fill in these placeholders in the message:

| Placeholder | Replace with |
|-------------|--------------|
| `[LINK]` | Deployed app URL |
| `[PRESIDENT NAME]` | Current president's name (for "message X if stuck" references) |
| *Saturday 5 PM* | The actual configured weekly preference deadline |

Note: TIC = `president` role in the system. EXCO = `exco` role. Anywhere the message says "TIC only", it refers to features locked to the president role.

## WhatsApp message (copy this block)

```
🎯 *EXCO + TIC: How the new system works for you*

You also use the system as a regular member (preferences, schedule, cancellation, VR) — see the main onboarding message for that. This is your *admin* cheat sheet on top of that.

📌 *Roles in the system*
- *Member*: Submits preferences, sees their own schedule
- *EXCO*: All of the above + admin pages below
- *TIC / President*: All EXCO duties + draft, semesters, members, compliance

━━━━━━━━━━━━━

✅ *EXCO duties (every week)*

📋 *Mark Attendance (after each session)*
1. Go to *Attendance*
2. Pick the week + session
3. For each member, tap *Present* / *Absent* / *VR*
🟡 If you see a "~30 min late" badge next to a member's name, they self-declared a lesson over-run — don't mark them absent prematurely.

🛠 *Handle VR (Valid Reason) requests*
When a member taps "Provide Reason" on their schedule, their submitted reason appears on the *Attendance* page.
- ✅ Acceptable: medical, exam clash, family emergency, school-mandated commitment
- ❌ Not acceptable: "forgot", "didn't feel like it", slept in
- If acceptable, mark *VR*. If not, mark *Absent* (= no-show, hurts their priority score next week).

🔫 *Manage gun assignments*
*Guns* page — assign/edit which gun each member uses. If two members sharing a gun end up in the same session, that's a "gun clash" (yellow banner on the schedule). The draft tries to avoid this but doesn't always succeed — coordinate at the range.

━━━━━━━━━━━━━

🏆 *TIC / President only*

🎲 *Run the weekly draft*
Every Saturday after 5 PM:
1. Go to *Sessions*
2. Pick this week → click *Close Week*
3. Click *Run Draft* → wait while the progress modal runs (~10s) → it'll auto-redirect to Draft Review
4. Review the allocations, gun clashes, and EXCO duty assignments
5. Click *Publish Schedule* — members can now see their allocations

⚠️ If the results look off, click *Re-run Draft* instead of publishing.
⚠️ Don't close the tab while the draft modal is running.

📅 *Manage weeks & sessions*
Each Monday (or whenever you plan the week):
1. *Sessions* → create the new week
2. Click *Generate from Templates* (or tweak the lineup manually)
3. Cancel sessions for no-school days using the per-session cancel button

🗒 *Session templates*
*Templates* page — define the recurring weekly session lineup (e.g. 12 default sessions per week, their times, default live/dry lane counts). Edited once at the start of the year; *Sessions* uses these when generating each week.

🎯 *Set training requirements*
*Requirements* page — set the per-team baseline (e.g. 2 sessions/week) or override individual members in competition season. EXCO can't edit this — it's TIC-only.

👥 *Member management*
*Members* page:
- *Bulk Upload*: Start of semester, upload the full CSV
- *Create*: Add individual new members as they join
- *Reset Password*: Per-row button — resets that member back to the default temp password
- *Archive*: When members leave the club permanently

🧩 *Groups*
*Groups* page — organise members into training groups / sub-teams for organisational use.

📊 *End-of-week compliance check*
*Attendance → Compliance* — see who's below their training requirement. Useful for spotting members at risk of competition ineligibility before it's too late.

🗓 *Semesters*
*Semesters* page — create a new semester at the start of each term. The *Reset No-Show Counts* button (in the red Danger Zone card at the bottom) wipes all members' no-show counts to 0 — typically run once at the start of each semester.

🤝 *Handover*
*Handover* page — promote new EXCO + transfer presidency at end of year. Once you transfer presidency, you become a regular EXCO/member.

ℹ️ *Competition flags (no UI yet)*
The `competition_flags` table exists in the database but there's no admin page built for it. If a member needs a competition boost (the `R` variable in the priority score), it must be set via SQL or the next dev iteration. Ping the maintainer.

━━━━━━━━━━━━━

❓ *Admin FAQ*

*Q: I marked the wrong attendance for someone.*
Just tap the correct button again — it overwrites. No undo confirmation needed.

*Q: Should I run the draft before or after closing the week?*
Close first, then run. The system won't draft an open week.

*Q: What if Run Draft fails or hangs?*
Wait for the progress modal to close. If it errors out, check the error message — usually it's "no preferences submitted" or "week not closed". Fix the cause and try again. If a previous attempt got stuck, the system auto-recovers from the "drafting" status on the next try.

*Q: A gun clash warning is showing on the schedule — what do I do?*
Yellow banner is informational. The allocation went through; the two members will need to share/coordinate at the range. Use EXCO judgement to decide who fires when.

*Q: One member needs more live fire than others (e.g. upcoming competition).*
The proper fix is the *competition flag* (R) — but the admin UI for that isn't built yet. For now, the workaround is either to raise their *training requirement* (Requirements page) so they need more sessions, or set the `competition_flags` row directly in the database. Talk to the dev / maintainer.

*Q: A member is leaving permanently.*
Archive them on the *Members* page. Their historical data (attendance, scores) is preserved but they can no longer log in or submit preferences.

*Q: I'm an EXCO and I tick "I'll be ~30 min late" on the first session of the day — what happens?*
The draft won't assign you opening-range duty for that session. Another EXCO gets it. Useful when you know a class will run late and you'd otherwise be the opener.

*Q: A member says they didn't submit preferences but their slot appeared on the schedule. Bug?*
Not a bug. Members who skipped the preference deadline can claim *leftover* slots from their Schedule page once the week is published — the system auto-gives them live fire if available, otherwise dry. This only works if they submitted *zero* preferences; members who submitted prefs (even badly-ranked) are locked to whatever the draft gave them.

*Q: A member set "Maximum live fire sessions = 0" and got no live fire. Bug?*
Working as intended. Members can cap their own live fire (e.g. rank 6 sessions, cap at 4 = the draft gives them live fire on their best 4 by score, dry fire on the other 2). Setting it to 0 means "dry fire only this week". This cap is independent of the admin-set `Max live per member` on the week — the draft uses whichever is lower.

*Q: Something looks broken / I don't know what a button does.*
Message [PRESIDENT NAME] or whoever maintains this. There's also a FEATURES.md file in the repo that documents every page.

━━━━━━━━━━━━━

✅ *Bottom line*

- *Every session:* mark attendance
- *Every Saturday after 5 PM (TIC only):* run the draft + publish
- *Every week:* skim compliance, review VR submissions
- *Every term:* create semester, reset no-show counts

You've got admin access — please don't accidentally delete things 🙏
```
