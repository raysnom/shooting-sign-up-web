import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  Week,
  TrainingRequirement,
  Attendance,
  Member,
  SpecialEvent,
  SpecialEventAttendance,
} from "@/types/database";
import { ComplianceClient } from "./compliance-client";

type ComplianceMember = {
  id: string;
  name: string;
  team: Member["team"];
  level: Member["level"];
  requiredSessions: number;
  attendedSessions: number;
};

export default async function CompliancePage({
  searchParams,
}: {
  searchParams: Promise<{ weekId?: string }>;
}) {
  await requireRole(["president"]);

  const params = await searchParams;
  const weekId = params.weekId;

  if (!weekId) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Compliance Report</h1>
        <p className="text-sm text-muted-foreground">
          No week selected. Go back to the attendance page and select a week.
        </p>
      </div>
    );
  }

  const supabase = await createClient();

  // Fetch the week
  const { data: week } = await supabase
    .from("weeks")
    .select("*")
    .eq("id", weekId)
    .single();

  if (!week) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Compliance Report</h1>
        <p className="text-sm text-muted-foreground">
          Week not found.
        </p>
      </div>
    );
  }

  // Fetch training requirements for this week
  const { data: requirements } = await supabase
    .from("training_requirements")
    .select("*")
    .eq("week_id", weekId);

  // Fetch all attendance records for this week
  const { data: attendanceRecords } = await supabase
    .from("attendance")
    .select("*")
    .eq("week_id", weekId);

  // Fetch all non-archived members
  const { data: members } = await supabase
    .from("members")
    .select("*")
    .eq("archived", false)
    .order("name", { ascending: true });

  // Fetch special events for this week
  const { data: specialEventsData } = await supabase
    .from("special_events")
    .select("*")
    .eq("week_id", weekId);

  const typedSpecialEvents = (specialEventsData as SpecialEvent[]) ?? [];
  const specialEventIds = new Set(typedSpecialEvents.map((e) => e.id));

  // Fetch special event attendance for those events
  const seIds = typedSpecialEvents.map((e) => e.id);
  const { data: specialEventAttendanceData } = seIds.length > 0
    ? await supabase
        .from("special_event_attendance")
        .select("*")
        .in("special_event_id", seIds)
    : { data: [] };

  const typedSpecialEventAttendance =
    (specialEventAttendanceData as SpecialEventAttendance[]) ?? [];

  const typedRequirements = (requirements as TrainingRequirement[]) ?? [];
  const typedAttendance = (attendanceRecords as Attendance[]) ?? [];
  const typedMembers = (members as Member[]) ?? [];

  // Build compliance data per member
  const complianceMembers: ComplianceMember[] = typedMembers.map((member) => {
    // Determine requirement for this member
    // 1. Check individual override
    const individualReq = typedRequirements.find(
      (r) => r.target_type === "individual" && r.target_value === member.id
    );
    let requiredSessions = 0;

    if (individualReq) {
      requiredSessions = individualReq.min_sessions;
    } else {
      // 2. Check team requirement
      const teamReq = typedRequirements.find(
        (r) => r.target_type === "team" && r.target_value === member.team
      );
      if (teamReq) {
        requiredSessions = teamReq.min_sessions;
      }
    }

    // Count attended regular sessions: "present" or "vr"
    const regularAttendanceCount = typedAttendance.filter(
      (a) =>
        a.member_id === member.id &&
        (a.status === "present" || a.status === "vr")
    ).length;

    // Count special event attendance for this member
    const specialEventCount = typedSpecialEventAttendance.filter(
      (sea) =>
        sea.member_id === member.id && specialEventIds.has(sea.special_event_id)
    ).length;

    const attendedSessions = regularAttendanceCount + specialEventCount;

    return {
      id: member.id,
      name: member.name,
      team: member.team,
      level: member.level,
      requiredSessions,
      attendedSessions,
    };
  });

  // Only include members who have a requirement > 0
  const membersWithRequirements = complianceMembers.filter(
    (m) => m.requiredSessions > 0
  );

  return (
    <ComplianceClient
      week={week as Week}
      members={membersWithRequirements}
    />
  );
}
