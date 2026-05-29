import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  getCachedSemesters,
  getCachedWeeks,
  getCachedActiveMembers,
  getCachedRequirements,
  getCachedGroupMembers,
} from "@/lib/cache";
import { DIVISION_MAP } from "@/lib/constants";
import type {
  TrainingRequirement,
  Member,
  Allocation,
  Attendance,
  SpecialEvent,
  SpecialEventAttendance,
} from "@/types/database";
import { OverviewClient } from "./overview-client";

// Resolve a member's required sessions for a single week.
// Priority (highest to lowest): Individual > Group > Division > Team.
function resolveRequired(
  member: Member,
  weekReqs: TrainingRequirement[],
  memberGroupIds: Set<string>
): number {
  const individual = weekReqs.find(
    (r) => r.target_type === "individual" && r.target_value === member.id
  );
  if (individual) return individual.min_sessions;

  const groupReqs = weekReqs.filter(
    (r) => r.target_type === "group" && memberGroupIds.has(r.target_value)
  );
  if (groupReqs.length > 0) {
    return Math.max(...groupReqs.map((r) => r.min_sessions));
  }

  const division = DIVISION_MAP[member.level];
  const divisionReq = weekReqs.find(
    (r) => r.target_type === "division" && r.target_value === division
  );
  if (divisionReq) return divisionReq.min_sessions;

  const teamReq = weekReqs.find(
    (r) => r.target_type === "team" && r.target_value === member.team
  );
  if (teamReq) return teamReq.min_sessions;

  return 0;
}

export default async function AttendanceOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ semesterId?: string }>;
}) {
  await requireRole(["president"]);

  const params = await searchParams;

  const [semesters, allWeeks, members, requirements, groupMembers] =
    await Promise.all([
      getCachedSemesters(),
      getCachedWeeks(),
      getCachedActiveMembers(),
      getCachedRequirements(),
      getCachedGroupMembers(),
    ]);

  if (semesters.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Attendance Overview</h1>
        <p className="text-sm text-muted-foreground">
          No semesters yet. Create a semester first.
        </p>
      </div>
    );
  }

  const selectedSemesterId =
    params.semesterId && semesters.some((s) => s.id === params.semesterId)
      ? params.semesterId
      : semesters[0].id;

  // Weeks in this semester, oldest first (columns read left → right).
  const weeks = allWeeks
    .filter((w) => w.semester_id === selectedSemesterId)
    .sort((a, b) => a.start_date.localeCompare(b.start_date));

  const weekIds = weeks.map((w) => w.id);
  const weekIdSet = new Set(weekIds);

  // member_id → set of group ids (for group-target requirements).
  const memberGroupIds = new Map<string, Set<string>>();
  for (const gm of groupMembers) {
    const set = memberGroupIds.get(gm.member_id) ?? new Set<string>();
    set.add(gm.group_id);
    memberGroupIds.set(gm.member_id, set);
  }

  // Attendance data is live (not cached), mirroring the compliance report.
  let allocations: Pick<Allocation, "member_id" | "session_id" | "week_id">[] =
    [];
  let attendanceRecords: Pick<Attendance, "member_id" | "session_id" | "status">[] =
    [];
  let specialEvents: SpecialEvent[] = [];
  let specialEventAttendance: SpecialEventAttendance[] = [];

  if (weekIds.length > 0) {
    const supabase = await createClient();
    const [allocRes, attRes, seRes] = await Promise.all([
      supabase
        .from("allocations")
        .select("member_id, session_id, week_id")
        .in("week_id", weekIds)
        .eq("cancelled", false),
      supabase
        .from("attendance")
        .select("member_id, session_id, status")
        .in("week_id", weekIds),
      supabase.from("special_events").select("*").in("week_id", weekIds),
    ]);

    allocations =
      (allocRes.data as Pick<
        Allocation,
        "member_id" | "session_id" | "week_id"
      >[]) ?? [];
    attendanceRecords =
      (attRes.data as Pick<Attendance, "member_id" | "session_id" | "status">[]) ??
      [];
    specialEvents = (seRes.data as SpecialEvent[]) ?? [];

    const seIds = specialEvents.map((e) => e.id);
    if (seIds.length > 0) {
      const { data } = await supabase
        .from("special_event_attendance")
        .select("*")
        .in("special_event_id", seIds);
      specialEventAttendance = (data as SpecialEventAttendance[]) ?? [];
    }
  }

  // Present-by-default: an allocation counts as attended unless the member was
  // explicitly marked absent / no_show for that session.
  const absentKeys = new Set(
    attendanceRecords
      .filter((a) => a.status === "absent" || a.status === "no_show")
      .map((a) => `${a.member_id}_${a.session_id}`)
  );

  const eventWeek = new Map(specialEvents.map((e) => [e.id, e.week_id]));

  // attended: member_id → (week_id → count)
  const attended = new Map<string, Map<string, number>>();
  const bump = (memberId: string, weekId: string) => {
    let perWeek = attended.get(memberId);
    if (!perWeek) {
      perWeek = new Map();
      attended.set(memberId, perWeek);
    }
    perWeek.set(weekId, (perWeek.get(weekId) ?? 0) + 1);
  };

  for (const a of allocations) {
    if (!absentKeys.has(`${a.member_id}_${a.session_id}`)) {
      bump(a.member_id, a.week_id);
    }
  }
  for (const sea of specialEventAttendance) {
    const weekId = eventWeek.get(sea.special_event_id);
    if (weekId) bump(sea.member_id, weekId);
  }

  // Requirements grouped by week (only for weeks in this semester).
  const reqsByWeek = new Map<string, TrainingRequirement[]>();
  for (const r of requirements) {
    if (!weekIdSet.has(r.week_id)) continue;
    const list = reqsByWeek.get(r.week_id) ?? [];
    list.push(r);
    reqsByWeek.set(r.week_id, list);
  }

  const matrixMembers = members.map((m) => {
    const groupIds = memberGroupIds.get(m.id) ?? new Set<string>();
    const perWeekAttended = attended.get(m.id);
    const cells: Record<string, { required: number; attended: number }> = {};
    for (const w of weeks) {
      cells[w.id] = {
        required: resolveRequired(m, reqsByWeek.get(w.id) ?? [], groupIds),
        attended: perWeekAttended?.get(w.id) ?? 0,
      };
    }
    return {
      id: m.id,
      name: m.name,
      team: m.team,
      level: m.level,
      cells,
    };
  });

  return (
    <OverviewClient
      semesters={semesters}
      selectedSemesterId={selectedSemesterId}
      weeks={weeks.map((w) => ({ id: w.id, startDate: w.start_date }))}
      members={matrixMembers}
    />
  );
}
