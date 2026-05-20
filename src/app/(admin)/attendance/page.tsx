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

  // Batch all independent queries in parallel
  const [
    { data: sessions },
    { data: allocations },
    { data: attendanceRecords },
    { data: specialEvents },
    { data: allMembers },
  ] = await Promise.all([
    weekIds.length > 0
      ? supabase
          .from("sessions")
          .select("*")
          .in("week_id", weekIds)
          .eq("is_cancelled", false)
          .order("day")
          .order("time_start")
      : Promise.resolve({ data: [] as Session[] }),
    weekIds.length > 0
      ? supabase
          .from("allocations")
          .select("*, member:members(*)")
          .in("week_id", weekIds)
          .eq("cancelled", false)
      : Promise.resolve({ data: [] as Allocation[] }),
    weekIds.length > 0
      ? supabase
          .from("attendance")
          .select("*")
          .in("week_id", weekIds)
      : Promise.resolve({ data: [] as Attendance[] }),
    weekIds.length > 0
      ? supabase
          .from("special_events")
          .select("*")
          .in("week_id", weekIds)
          .order("event_date")
      : Promise.resolve({ data: [] as SpecialEvent[] }),
    supabase
      .from("members")
      .select("*")
      .eq("archived", false)
      .order("name", { ascending: true }),
  ]);

  const specialEventIds =
    (specialEvents as SpecialEvent[] | null)?.map((e) => e.id) ?? [];

  // Fetch special event attendance (depends on specialEventIds)
  const { data: specialEventAttendance } = specialEventIds.length > 0
    ? await supabase
        .from("special_event_attendance")
        .select("*")
        .in("special_event_id", specialEventIds)
    : { data: [] };

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
