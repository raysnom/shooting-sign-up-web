import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const APPLY = process.argv.includes("--apply"); // dry-run unless --apply passed

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

const { data: sessions } = await supabase
  .from("sessions")
  .select("id, day, time_start, live_lanes, weeks(start_date)")
  .eq("is_cancelled", false);

const { data: allocs } = await supabase
  .from("allocations")
  .select("id, member_id, session_id, type, cancelled, priority_score, created_at, members(name)")
  .eq("cancelled", false)
  .eq("type", "live");

const liveBySession = new Map();
for (const a of allocs) {
  const arr = liveBySession.get(a.session_id) ?? [];
  arr.push(a);
  liveBySession.set(a.session_id, arr);
}

const toDemote = [];
const stillOver = [];
for (const s of sessions) {
  const live = liveBySession.get(s.id) ?? [];
  const overage = live.length - s.live_lanes;
  if (overage <= 0) continue;

  // Claimed leftover slots are inserted with priority_score = 0 (and were the
  // rows the cap bug let through). Bump those first, latest claim first so the
  // earliest claimers keep their slot.
  const claimers = live
    .filter((a) => a.priority_score === 0)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

  const demoteHere = claimers.slice(0, overage);

  console.log(`\n${s.weeks?.start_date} ${s.day} ${s.time_start}  (cap ${s.live_lanes}, ${live.length} live, over by ${overage})`);
  for (const l of demoteHere) {
    console.log(`   demote -> dry: ${l.members?.name ?? l.member_id}  (claimed ${l.created_at})`);
    toDemote.push(l);
  }
  const remaining = live.length - demoteHere.length;
  if (remaining > s.live_lanes) {
    stillOver.push({ s, remaining });
    console.log(`   !! only ${claimers.length} claimer(s) here — still ${remaining} live after bumping them (needs manual review).`);
  }
}

console.log(`\nTotal claimed slots to demote live -> dry: ${toDemote.length}`);
if (stillOver.length) {
  console.log(`Sessions still over cap after bumping claimers (manual decision needed): ${stillOver.length}`);
}

if (!APPLY) {
  console.log("\nDRY RUN. Re-run with --apply to perform the demotions.");
  process.exit(0);
}

for (const l of toDemote) {
  const { error } = await supabase
    .from("allocations")
    .update({ type: "dry", gun_id: null, gun_clash_warning: null })
    .eq("id", l.id)
    .eq("type", "live");
  if (error) console.error(`  failed for ${l.id}: ${error.message}`);
}
console.log("Done. Demotions applied.");
