import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  Week,
  Session,
  Allocation,
  Member,
  Attendance,
  SpecialEvent,
  SpecialEventAttendance,
} from "@/types/database";
import { AttendanceClient } from "./attendance-client";

type AllocationWithMember = Allocation & { member: Member };

export default async function AttendancePage() {
  await requireRole(["exco", "president"]);

  const supabase = await createClient();

  // Fetch weeks with status "published" or "drafted"
  const { data: weeks } = await supabase
    .from("weeks")
    .select("*")
    .in("status", ["published", "drafted"])
    .order("start_date", { ascending: false });

  const weekIds = (weeks as Week[] | null)?.map((w) => w.id) ?? [];

  // Fetch non-cancelled sessions for those weeks
  const { data: sessions } = weekIds.length > 0
    ? await supabase
        .from("sessions")
        .select("*")
        .in("week_id", weekIds)
        .eq("is_cancelled", false)
        .order("day")
        .order("time_start")
    : { data: [] };

  // Fetch non-cancelled allocations for those weeks, joined with member info
  const { data: allocations } = weekIds.length > 0
    ? await supabase
        .from("allocations")
        .select("*, member:members(*)")
        .in("week_id", weekIds)
        .eq("cancelled", false)
    : { data: [] };

  // Fetch existing attendance records for those weeks
  const { data: attendanceRecords } = weekIds.length > 0
    ? await supabase
        .from("attendance")
        .select("*")
        .in("week_id", weekIds)
    : { data: [] };

  // Fetch special events for those weeks
  const { data: specialEvents } = weekIds.length > 0
    ? await supabase
        .from("special_events")
        .select("*")
        .in("week_id", weekIds)
        .order("event_date")
    : { data: [] };

  const specialEventIds =
    (specialEvents as SpecialEvent[] | null)?.map((e) => e.id) ?? [];

  // Fetch special event attendance records
  const { data: specialEventAttendance } = specialEventIds.length > 0
    ? await supabase
        .from("special_event_attendance")
        .select("*")
        .in("special_event_id", specialEventIds)
    : { data: [] };

  // Fetch all non-archived members (for the special event attendance checklist)
  const { data: allMembers } = await supabase
    .from("members")
    .select("*")
    .eq("archived", false)
    .order("name", { ascending: true });

  return (
    <AttendanceClient
      weeks={(weeks as Week[]) ?? []}
      sessions={(sessions as Session[]) ?? []}
      allocations={(allocations as AllocationWithMember[]) ?? []}
      attendanceRecords={(attendanceRecords as Attendance[]) ?? []}
      specialEvents={(specialEvents as SpecialEvent[]) ?? []}
      specialEventAttendance={
        (specialEventAttendance as SpecialEventAttendance[]) ?? []
      }
      allMembers={(allMembers as Member[]) ?? []}
    />
  );
}
