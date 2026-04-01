import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Week, Allocation, Session, ExcoDuty, TeamType } from "@/types/database";
import { ScheduleClient } from "./schedule-client";

// ──────────────────────────────────────────────
// Types for joined allocation data
// ──────────────────────────────────────────────

export type AllocationWithSession = Allocation & {
  sessions: Session;
};

export type AllocationWithSessionAndMember = Allocation & {
  sessions: Session;
  members: { id: string; name: string; team: TeamType };
};

export default async function SchedulePage() {
  const member = await getCurrentUser();
  const supabase = await createClient();

  // ── 1. Find the most recent published or drafted week ──
  const { data: publishedWeeks } = await supabase
    .from("weeks")
    .select("*")
    .in("status", ["published", "drafted"])
    .order("start_date", { ascending: false })
    .limit(1);

  const activeWeek =
    publishedWeeks && publishedWeeks.length > 0
      ? (publishedWeeks[0] as Week)
      : null;

  // ── 2. If no published/drafted week, check for an open week ──
  if (!activeWeek) {
    const { data: openWeeks } = await supabase
      .from("weeks")
      .select("*")
      .eq("status", "open")
      .order("start_date", { ascending: false })
      .limit(1);

    const openWeek =
      openWeeks && openWeeks.length > 0 ? (openWeeks[0] as Week) : null;

    if (openWeek) {
      return (
        <div className="space-y-4">
          <h1 className="text-2xl font-bold">My Schedule</h1>
          <div className="rounded-md border bg-white p-8 text-center text-gray-500">
            <p className="text-lg font-medium">
              Schedule not yet available
            </p>
            <p className="mt-1 text-sm">
              The current week is still open for preference submissions. Your
              schedule will appear here once the draft has been run and results
              are published.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">My Schedule</h1>
        <div className="rounded-md border bg-white p-8 text-center text-gray-500">
          <p className="text-lg font-medium">No schedule available</p>
          <p className="mt-1 text-sm">
            There is no active training week at the moment. Check back later.
          </p>
        </div>
      </div>
    );
  }

  // ── 3. Fetch allocations for this member + week (with session details) ──
  const { data: allocations } = await supabase
    .from("allocations")
    .select("*, sessions(*)")
    .eq("member_id", member.id)
    .eq("week_id", activeWeek.id)
    .eq("cancelled", false);

  // ── 4. Fetch ALL allocations for the week (with member names + session details) ──
  const { data: allAllocations } = await supabase
    .from("allocations")
    .select("*, sessions(*), members(id, name, team)")
    .eq("week_id", activeWeek.id)
    .eq("cancelled", false);

  // ── 5. Fetch all sessions for the week ──
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("week_id", activeWeek.id)
    .eq("is_cancelled", false)
    .order("time_start", { ascending: true });

  // ── 6. Fetch EXCO duty for this member + week ──
  const { data: excoDuties } = await supabase
    .from("exco_duty")
    .select("*")
    .eq("member_id", member.id)
    .eq("week_id", activeWeek.id);

  return (
    <ScheduleClient
      week={activeWeek}
      allocations={(allocations as AllocationWithSession[]) || []}
      allAllocations={(allAllocations as AllocationWithSessionAndMember[]) || []}
      sessions={(sessions as Session[]) || []}
      excoDuties={(excoDuties as ExcoDuty[]) || []}
      currentMemberId={member.id}
    />
  );
}
