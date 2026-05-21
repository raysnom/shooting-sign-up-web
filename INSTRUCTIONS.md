# Member Instructions

> The message below is the **WhatsApp broadcast** sent to club members to onboard them to the sign-up system. WhatsApp uses single-asterisk `*bold*` formatting, so the source is kept verbatim inside a code block — copy the contents of the block and paste into WhatsApp as-is.

## Before sending

Fill in these placeholders in the message:

| Placeholder | Replace with |
|-------------|--------------|
| `[LINK]` | Deployed app URL (e.g. `https://shooting-signup.vercel.app`) |
| `[PRESIDENT NAME]` | Current president's name (used in "message X if stuck") |
| `njcscmember2026!` | The current default member temp password — verify it matches `MEMBER_TEMP_PASSWORD` in [src/app/(admin)/members/actions.ts](src/app/(admin)/members/actions.ts). EXCOs, the president, and TIC use a different password (`STAFF_TEMP_PASSWORD`, currently `njcsc26!`) — see [INSTRUCTIONS_EXCO.md](INSTRUCTIONS_EXCO.md). |
| *Saturday 5 PM* | The actual weekly preference deadline configured in the system |

## WhatsApp message (copy this block)

```
🎯 *New sign-up system is live!*

We're moving off the Google Sheet. Everything happens at [LINK] now.

📌 *How it works*
The system runs on a weekly cycle. You rank the sessions you want, it fairly allocates live fire lanes by priority score, and unranked spots fall back to dry fire automatically.

🔐 *Logging in*
Go to [LINK]
📧 *Login:* the email/ID I'll send you separately
🔑 *Password:* `njcscmember2026!`

(No invite link, no email confirmation, no emails of any kind. The "email" is just a login placeholder — it may or may not be your real email, doesn't matter.)

📝 *Submit your preferences (every week)*
1. Go to *Preferences*
2. Click a session to add it
3. Use the arrows to rank them — your top choice gets live fire first
4. (Optional) Set a *Maximum live fire sessions* cap — e.g. rank 6 but only want live fire 4 times this week, set it to 4. Leave blank for no cap. Set to 0 if you only want dry fire.
⏰ Deadline: *Saturday 5 PM* — miss it and you're out of the draft, but see below for leftover slots.

👀 *Check your schedule*
After the draft runs (Sat night), open *Schedule* to see your allocated slots.
🟡 Yellow banner = gun clash warning — look out for those.

🆕 *Missed the deadline? Claim a leftover slot*
If you didn't submit preferences for the week, open *Schedule* once the draft is published. You'll see an *Available Leftover Slots* section listing sessions with empty lanes. Click *Claim this slot* and you'll be given a live fire lane if there's one open, otherwise a dry fire spot. First come, first served. (If you submitted preferences, you don't get this — you're already in the allocation.)

❌ *Cancel a slot*
1. Open *Schedule*
2. Click *Cancel My Slot*
3. Must be at least *24 hours* before the session
A dry-fire member gets auto-promoted to your lane.

🚫 *Last-minute can't make it?*
If you're allocated but can't attend:
1. Open *Schedule*
2. Click *Provide Reason*
3. Explain (medical, academic, etc.) — EXCO will mark VR (Valid Reason)
⚠️ No reason = no-show, which hurts your priority score next week.

━━━━━━━━━━━━━

❓ *FAQ*

*Q: I can't log in.*
Double-check your email is the one I have on file, and the password is `njcscmember2026!` exactly (lowercase, with the exclamation mark). Still stuck? Message [PRESIDENT NAME].

*Q: What if I miss the deadline / don't sign up in time?*
The draft only considers preferences submitted before Saturday 5 PM. If you missed it, you're out of the draft — no priority-score allocation. *But*: once the draft is published, open *Schedule* and look for the *Available Leftover Slots* section. Any session that didn't fill up is yours to claim, first come first served, live fire preferred. So missing the deadline isn't fatal — you just lose the priority-score guarantee and have to grab whatever's left.

*Q: What's the "Maximum live fire sessions" cap for?*
It lets you rank a bunch of sessions but limit how many live fire allocations you actually want. Example: you rank 6 sessions (so you're willing to train on any of those 6 days), but you only want to do live fire 4 times this week — set the cap to 4. The draft gives you live fire on your top 4 by priority score, and the rest fall back to dry fire (or get skipped entirely if dry is full). Leave it blank for no cap (default behaviour). Set it to 0 if you only want dry fire — useful for resting weeks where you still want to show up and practice.

*Q: Is the "email" I use to log in a real email address?*
No — it's just a login placeholder. We don't send any emails through this system (no confirmations, no notifications, no resets sent by email). [PRESIDENT NAME] sets one for you when your account is created; that string is what you log in with. If you've forgotten yours, ask in the group.

*Q: Can I edit my preferences after submitting?*
Yes, anytime before Saturday 5 PM. After that, it locks.

*Q: I ranked live fire but got dry fire — why?*
Live lanes are limited. Allocation goes by priority score (attendance, fairness rotation, no-shows, training requirements). Your *Profile* page shows your full score breakdown.

*Q: What counts as a Valid Reason (VR)?*
Medical, academic exams, family emergencies, etc. EXCO has final say. "Forgot" or "didn't feel like it" ≠ VR.

*Q: What happens if I no-show without a reason?*
Your priority score drops the following week, so you're less likely to get live fire. Repeated no-shows hurt your standing for the rest of the semester.

*Q: My email or info is wrong.*
Message [PRESIDENT NAME] — only the president can edit member info.

*Q: When does the draft actually run?*
Saturday after 5 PM — exact time depends on when the president runs it. Your schedule shows up shortly after.

✅ *That's it*
Submit prefs by Saturday 5 PM, check your schedule, show up. Questions? Drop them here 💬
```
