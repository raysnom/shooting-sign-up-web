import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Soft-cancel a single member's active allocation in a specific session.
// Dry-run by default; pass --apply to write. Mirrors fix-live-overcap.mjs.
//
//   node --env-file=.env.local scripts/remove-allocation.mjs            (dry run)
//   node --env-file=.env.local scripts/remove-allocation.mjs --apply    (perform)
//
// Hardcoded target: member matching "isaac", Tuesday "Session 2", most recent
// published week. Edit NAME_QUERY / DAY / SESSION_NAME below to retarget.

const APPLY = process.argv.includes("--apply");

const NAME_QUERY = "isaac";
const DAY = "tue";
const SESSION_NAME = "Tuesday Session 2";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

function abort(msg) {
  console.error(`\nABORTED: ${msg}\nNo changes made.`);
  process.exit(1);
}

// 1. Most recent published week.
const { data: weeks } = await supabase
  .from("weeks")
  .select("id, start_date, status")
  .eq("status", "published")
  .order("start_date", { ascending: false })
  .limit(1);

if (!weeks || weeks.length === 0) abort("No published week found.");
const week = weeks[0];
console.log(`Target week: ${week.start_date} (id ${week.id}, status ${week.status})`);

// 2. Tuesday Session 2 in that week.
const { data: sessions } = await supabase
  .from("sessions")
  .select("id, name, day, time_start, time_end")
  .eq("week_id", week.id)
  .eq("day", DAY)
  .ilike("name", SESSION_NAME);

if (!sessions || sessions.length === 0)
  abort(`No ${DAY} session named "${SESSION_NAME}" in this week.`);
if (sessions.length > 1)
  abort(`${sessions.length} sessions matched ${DAY} "${SESSION_NAME}" — ambiguous.`);
const session = sessions[0];
console.log(
  `Target session: ${session.name} (${session.day} ${session.time_start}–${session.time_end}, id ${session.id})`
);

// 3. Member(s) matching the name query.
const { data: members } = await supabase
  .from("members")
  .select("id, name, email")
  .ilike("name", `%${NAME_QUERY}%`);

if (!members || members.length === 0) abort(`No member matching "${NAME_QUERY}".`);
console.log(`\nMembers matching "${NAME_QUERY}":`);
for (const m of members) console.log(`   ${m.name}  <${m.email}>  (id ${m.id})`);
if (members.length > 1)
  abort(`${members.length} members matched "${NAME_QUERY}" — narrow the query before applying.`);
const member = members[0];

// 4. Active allocation for that member in that session.
const { data: allocs } = await supabase
  .from("allocations")
  .select("id, type, cancelled")
  .eq("member_id", member.id)
  .eq("session_id", session.id)
  .eq("cancelled", false);

if (!allocs || allocs.length === 0)
  abort(`${member.name} has no active allocation in ${session.name}.`);
if (allocs.length > 1)
  abort(`${member.name} has ${allocs.length} active allocations in this session — unexpected.`);
const alloc = allocs[0];

// Plan assumes a dry-fire slot (no auto-promotion). Refuse a live slot so we
// don't silently leave a live lane short without explicit confirmation.
if (alloc.type !== "dry")
  abort(
    `Matched allocation is type="${alloc.type}", expected "dry". A live removal frees a lane and would need the dry->live auto-upgrade — re-confirm before proceeding.`
  );

console.log(
  `\nWill remove: ${member.name} from ${session.name} (${session.day} ${session.time_start}) — type=${alloc.type}, allocation id ${alloc.id}`
);

if (!APPLY) {
  console.log("\nDRY RUN. Re-run with --apply to soft-cancel this allocation.");
  process.exit(0);
}

const { error } = await supabase
  .from("allocations")
  .update({ cancelled: true, cancelled_at: new Date().toISOString() })
  .eq("id", alloc.id)
  .eq("cancelled", false);

if (error) abort(`Update failed: ${error.message}`);
console.log("\nDone. Allocation soft-cancelled.");
