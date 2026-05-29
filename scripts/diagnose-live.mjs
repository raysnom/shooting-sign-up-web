import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

// Load .env.local manually
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Active (non-cancelled) sessions with their live_lanes, plus their week status
const { data: sessions, error: sErr } = await supabase
  .from("sessions")
  .select("id, day, time_start, live_lanes, week_id, is_cancelled, weeks(status, start_date)")
  .eq("is_cancelled", false);
if (sErr) throw sErr;

const { data: allocs, error: aErr } = await supabase
  .from("allocations")
  .select("id, member_id, session_id, type, cancelled, week_id");
if (aErr) throw aErr;

const bySession = new Map();
for (const a of allocs) {
  if (a.cancelled || a.type !== "live") continue;
  const arr = bySession.get(a.session_id) ?? [];
  arr.push(a);
  bySession.set(a.session_id, arr);
}

let problems = 0;
for (const s of sessions) {
  const live = bySession.get(s.id) ?? [];
  if (live.length <= s.live_lanes) continue;
  problems++;
  const memberCounts = new Map();
  for (const a of live) memberCounts.set(a.member_id, (memberCounts.get(a.member_id) ?? 0) + 1);
  const dupMembers = [...memberCounts.entries()].filter(([, n]) => n > 1);
  console.log(
    `\nSESSION ${s.id}  ${s.weeks?.start_date ?? "?"} ${s.day} ${s.time_start}` +
    `  [week status: ${s.weeks?.status}]`
  );
  console.log(`  live_lanes cap = ${s.live_lanes}, active live rows = ${live.length}, distinct members = ${memberCounts.size}`);
  if (dupMembers.length) {
    console.log(`  >> DUPLICATE member rows (same member multiple live allocations):`);
    for (const [m, n] of dupMembers) console.log(`     member ${m}: ${n} live rows`);
  } else {
    console.log(`  >> No duplicate members — ${memberCounts.size} distinct members exceed the ${s.live_lanes}-lane cap.`);
  }
}

console.log(`\n${problems === 0 ? "No over-capacity live sessions found." : `${problems} session(s) over the live cap.`}`);
