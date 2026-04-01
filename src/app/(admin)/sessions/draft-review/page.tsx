import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type {
  Week,
  Session,
  Allocation,
  ExcoDuty,
  DayType,
} from "@/types/database";
import { DraftReviewClient } from "./draft-review-client";

// ──────────────────────────────────────────────
// Types for joined data passed to client
// ──────────────────────────────────────────────

export type AllocationWithDetails = Allocation & {
  member_name: string;
  session_name: string;
  session_day: DayType;
  session_time_start: string;
  session_time_end: string;
};

export type ExcoDutyWithDetails = ExcoDuty & {
  member_name: string;
  session_name: string;
  session_day: DayType;
};

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────

export default async function DraftReviewPage({
  searchParams,
}: {
  searchParams: Promise<{ weekId?: string }>;
}) {
  await requireRole(["president"]);

  const params = await searchParams;
  const weekId = params.weekId;

  if (!weekId) {
    redirect("/sessions");
  }

  const supabase = await createClient();

  // Fetch the week — must be "drafted" status
  const { data: week, error: weekError } = await supabase
    .from("weeks")
    .select("*")
    .eq("id", weekId)
    .single();

  if (weekError || !week) {
    redirect("/sessions");
  }

  const typedWeek = week as Week;

  if (typedWeek.status !== "drafted") {
    redirect("/sessions");
  }

  // Fetch all sessions for this week
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("week_id", weekId)
    .order("day", { ascending: true })
    .order("time_start", { ascending: true });

  const typedSessions = (sessions as Session[]) || [];

  // Fetch all allocations for this week, joined with member names
  const { data: allocations } = await supabase
    .from("allocations")
    .select("*, members(name), sessions(name, day, time_start, time_end)")
    .eq("week_id", weekId)
    .eq("cancelled", false)
    .order("priority_score", { ascending: false });

  const typedAllocations: AllocationWithDetails[] = (allocations || []).map(
    (a: Record<string, unknown>) => {
      const members = a.members as { name: string } | null;
      const sessionsJoin = a.sessions as {
        name: string;
        day: DayType;
        time_start: string;
        time_end: string;
      } | null;
      return {
        id: a.id as string,
        member_id: a.member_id as string,
        session_id: a.session_id as string,
        week_id: a.week_id as string,
        type: a.type as "live" | "dry",
        gun_id: a.gun_id as string | null,
        gun_clash_warning: a.gun_clash_warning as string | null,
        priority_score: a.priority_score as number,
        cancelled: a.cancelled as boolean,
        cancelled_at: a.cancelled_at as string | null,
        created_at: a.created_at as string,
        member_name: members?.name || "Unknown",
        session_name: sessionsJoin?.name || "Unknown",
        session_day: sessionsJoin?.day || "mon",
        session_time_start: sessionsJoin?.time_start || "",
        session_time_end: sessionsJoin?.time_end || "",
      };
    }
  );

  // Fetch exco_duty assignments for this week, joined with member names
  const { data: excoDuties } = await supabase
    .from("exco_duty")
    .select("*, members(name), sessions(name, day)")
    .eq("week_id", weekId);

  const typedExcoDuties: ExcoDutyWithDetails[] = (excoDuties || []).map(
    (e: Record<string, unknown>) => {
      const members = e.members as { name: string } | null;
      const sessionsJoin = e.sessions as { name: string; day: DayType } | null;
      return {
        id: e.id as string,
        session_id: e.session_id as string,
        week_id: e.week_id as string,
        member_id: e.member_id as string,
        created_at: e.created_at as string,
        member_name: members?.name || "Unknown",
        session_name: sessionsJoin?.name || "Unknown",
        session_day: sessionsJoin?.day || "mon",
      };
    }
  );

  return (
    <DraftReviewClient
      week={typedWeek}
      sessions={typedSessions}
      allocations={typedAllocations}
      excoDuties={typedExcoDuties}
    />
  );
}
