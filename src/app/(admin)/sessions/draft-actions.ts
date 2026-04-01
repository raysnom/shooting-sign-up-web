"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { ROLLING_WINDOW_WEEKS } from "@/lib/constants";
import { runDraftEngine } from "@/lib/algorithm/draft-engine";
import type {
  DraftSession,
  DraftPreference,
  DraftMember,
} from "@/lib/algorithm/draft-engine";
import type {
  AttendanceStatus,
  TrainingRequirement,
  TrainingTargetType,
} from "@/types/database";
import { DIVISION_MAP } from "@/lib/constants";

// ──────────────────────────────────────────────
// Auth helper
// ──────────────────────────────────────────────

async function verifyPresident() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", userId: null };

  const { data: member } = await supabase
    .from("members")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!member || member.role !== "president")
    return {
      error: "Only the President can perform this action.",
      userId: null,
    };
  return { error: null, userId: user.id };
}

// ──────────────────────────────────────────────
// Run the draft
// ──────────────────────────────────────────────

export async function runDraft(weekId: string) {
  // 1. Verify caller is president
  const { error: authError, userId } = await verifyPresident();
  if (authError || !userId) return { error: authError };

  const admin = createAdminClient();

  // 2. Fetch the week (must be status "closed")
  const { data: week, error: weekError } = await admin
    .from("weeks")
    .select("*")
    .eq("id", weekId)
    .single();

  if (weekError || !week) return { error: weekError?.message ?? "Week not found" };
  if (week.status !== "closed") {
    return { error: "Draft can only run on weeks with status 'closed'." };
  }

  // 3. Fetch all non-cancelled sessions for the week
  const { data: sessionsRaw, error: sessionsError } = await admin
    .from("sessions")
    .select("id, day, time_start, time_end, live_lanes, dry_lanes")
    .eq("week_id", weekId)
    .eq("is_cancelled", false);

  if (sessionsError) return { error: sessionsError.message };
  if (!sessionsRaw || sessionsRaw.length === 0) {
    return { error: "No active sessions found for this week." };
  }

  const sessions: DraftSession[] = sessionsRaw.map((s) => ({
    id: s.id as string,
    day: s.day as DraftSession["day"],
    time_start: s.time_start as string,
    time_end: s.time_end as string,
    live_lanes: s.live_lanes as number,
    dry_lanes: s.dry_lanes as number,
  }));

  const sessionIds = sessions.map((s) => s.id);

  // 4. Fetch all preferences for these sessions (split on-time vs late)
  const { data: prefsRaw, error: prefsError } = await admin
    .from("preferences")
    .select("member_id, session_id, rank, created_at")
    .eq("week_id", weekId)
    .in("session_id", sessionIds);

  if (prefsError) return { error: prefsError.message };
  if (!prefsRaw || prefsRaw.length === 0) {
    return { error: "No preferences submitted for this week." };
  }

  // Split preferences into on-time vs late based on submission deadline
  const deadline = new Date(week.submission_deadline);
  const onTimePrefsRaw = prefsRaw.filter((p) => new Date(p.created_at as string) <= deadline);
  const latePrefsRaw = prefsRaw.filter((p) => new Date(p.created_at as string) > deadline);

  const preferences: DraftPreference[] = onTimePrefsRaw.map((p) => ({
    member_id: p.member_id as string,
    session_id: p.session_id as string,
    rank: p.rank as number,
  }));

  const latePreferences: DraftPreference[] = latePrefsRaw.map((p) => ({
    member_id: p.member_id as string,
    session_id: p.session_id as string,
    rank: p.rank as number,
  }));

  // Collect unique member IDs who have preferences
  const memberIdsWithPrefs = [...new Set(preferences.map((p) => p.member_id))];

  // 5. Fetch all active, non-archived members who have preferences
  const { data: membersRaw, error: membersError } = await admin
    .from("members")
    .select("id, name, no_show_count, gun_id, team, level, role")
    .in("id", memberIdsWithPrefs)
    .eq("archived", false);

  if (membersError) return { error: membersError.message };
  if (!membersRaw || membersRaw.length === 0) {
    return { error: "No active members found with preferences." };
  }

  const draftMembers: DraftMember[] = membersRaw.map((m) => ({
    id: m.id as string,
    no_show_count: (m.no_show_count as number) ?? 0,
    gun_id: (m.gun_id as string | null) ?? null,
  }));

  // Build memberGunMap and memberNames
  const memberGunMap = new Map<string, string | null>();
  const memberNames = new Map<string, string>();
  for (const m of membersRaw) {
    memberGunMap.set(m.id as string, (m.gun_id as string | null) ?? null);
    memberNames.set(m.id as string, m.name as string);
  }

  // Build EXCO member IDs (role = "exco" or "president")
  const excoMemberIds = new Set<string>();
  for (const m of membersRaw) {
    if (m.role === "exco" || m.role === "president") {
      excoMemberIds.add(m.id as string);
    }
  }

  // 6. Training requirements -> compute requirement gap per member
  const { data: requirementsRaw, error: requirementsError } = await admin
    .from("training_requirements")
    .select("*")
    .eq("week_id", weekId);

  if (requirementsError) return { error: requirementsError.message };

  const typedRequirements = (requirementsRaw as TrainingRequirement[]) ?? [];

  // Fetch competition group memberships for group-type requirements
  const groupRequirements = typedRequirements.filter(
    (r) => r.target_type === "group"
  );
  const groupIds = groupRequirements.map((r) => r.target_value);
  let groupMembershipMap = new Map<string, Set<string>>(); // groupId -> Set<memberId>

  if (groupIds.length > 0) {
    const { data: groupMembersRaw } = await admin
      .from("competition_group_members")
      .select("group_id, member_id")
      .in("group_id", groupIds);

    if (groupMembersRaw) {
      for (const gm of groupMembersRaw) {
        const gid = gm.group_id as string;
        const mid = gm.member_id as string;
        if (!groupMembershipMap.has(gid)) {
          groupMembershipMap.set(gid, new Set());
        }
        groupMembershipMap.get(gid)!.add(mid);
      }
    }
  }

  // Fetch this week's attendance to compute attended sessions per member
  const { data: weekAttendanceRaw } = await admin
    .from("attendance")
    .select("member_id, status")
    .eq("week_id", weekId);

  // Also fetch special event attendance for this week
  const { data: specialEventsRaw } = await admin
    .from("special_events")
    .select("id")
    .eq("week_id", weekId);

  const specialEventIds = ((specialEventsRaw as { id: string }[]) ?? []).map(
    (e) => e.id
  );

  let specialEventAttendanceByMember = new Map<string, number>();
  if (specialEventIds.length > 0) {
    const { data: seAttendanceRaw } = await admin
      .from("special_event_attendance")
      .select("member_id")
      .in("special_event_id", specialEventIds);

    if (seAttendanceRaw) {
      for (const sa of seAttendanceRaw) {
        const mid = sa.member_id as string;
        specialEventAttendanceByMember.set(
          mid,
          (specialEventAttendanceByMember.get(mid) ?? 0) + 1
        );
      }
    }
  }

  // Count attended sessions per member this week (present or vr)
  const weekAttendedByMember = new Map<string, number>();
  if (weekAttendanceRaw) {
    for (const a of weekAttendanceRaw) {
      const mid = a.member_id as string;
      const status = a.status as string;
      if (status === "present" || status === "vr") {
        weekAttendedByMember.set(mid, (weekAttendedByMember.get(mid) ?? 0) + 1);
      }
    }
  }

  // Resolve requirement for each member (individual > group > division > team)
  const memberRequirementGaps = new Map<string, number>();

  for (const m of membersRaw) {
    const memberId = m.id as string;
    const team = m.team as string;
    const level = m.level as string;
    const division = DIVISION_MAP[level as keyof typeof DIVISION_MAP];

    // Find the highest-priority requirement for this member
    let requiredSessions = 0;

    // 1. Individual override (highest priority)
    const individualReq = typedRequirements.find(
      (r) => r.target_type === "individual" && r.target_value === memberId
    );
    if (individualReq) {
      requiredSessions = individualReq.min_sessions;
    } else {
      // 2. Group requirement
      const groupReq = typedRequirements.find(
        (r) =>
          r.target_type === "group" &&
          groupMembershipMap.get(r.target_value)?.has(memberId)
      );
      if (groupReq) {
        requiredSessions = groupReq.min_sessions;
      } else {
        // 3. Division requirement
        const divisionReq = typedRequirements.find(
          (r) => r.target_type === "division" && r.target_value === division
        );
        if (divisionReq) {
          requiredSessions = divisionReq.min_sessions;
        } else {
          // 4. Team requirement
          const teamReq = typedRequirements.find(
            (r) => r.target_type === "team" && r.target_value === team
          );
          if (teamReq) {
            requiredSessions = teamReq.min_sessions;
          }
        }
      }
    }

    if (requiredSessions > 0) {
      const attended =
        (weekAttendedByMember.get(memberId) ?? 0) +
        (specialEventAttendanceByMember.get(memberId) ?? 0);
      const gap = requiredSessions - attended;
      memberRequirementGaps.set(memberId, gap);
    }
  }

  // 7. Past allocations (4-week rolling window) -> count live fire per member
  const weekStartDate = new Date(week.start_date + "T00:00:00");
  const rollingStartDate = new Date(weekStartDate);
  rollingStartDate.setDate(
    rollingStartDate.getDate() - ROLLING_WINDOW_WEEKS * 7
  );
  const rollingStartStr = rollingStartDate.toISOString().split("T")[0];

  // Find weeks in the rolling window
  const { data: rollingWeeks, error: rollingWeeksError } = await admin
    .from("weeks")
    .select("id")
    .gte("start_date", rollingStartStr)
    .lt("start_date", week.start_date);

  if (rollingWeeksError) return { error: rollingWeeksError.message };

  const pastLiveFireCounts = new Map<string, number>();

  if (rollingWeeks && rollingWeeks.length > 0) {
    const rollingWeekIds = rollingWeeks.map((w) => w.id as string);

    const { data: pastAllocations, error: pastAllocError } = await admin
      .from("allocations")
      .select("member_id")
      .in("week_id", rollingWeekIds)
      .eq("type", "live")
      .eq("cancelled", false);

    if (pastAllocError) return { error: pastAllocError.message };

    if (pastAllocations) {
      for (const alloc of pastAllocations) {
        const memberId = alloc.member_id as string;
        pastLiveFireCounts.set(
          memberId,
          (pastLiveFireCounts.get(memberId) ?? 0) + 1
        );
      }
    }
  }

  // 8. Attendance data -> calculate attendance percentage per member
  const attendanceRates = new Map<string, number>();

  const { data: attendanceRaw, error: attendanceError } = await admin
    .from("attendance")
    .select("member_id, status")
    .in("member_id", memberIdsWithPrefs);

  if (attendanceError) return { error: attendanceError.message };

  if (attendanceRaw && attendanceRaw.length > 0) {
    // Group by member_id
    const attendanceByMember = new Map<string, AttendanceStatus[]>();
    for (const a of attendanceRaw) {
      const memberId = a.member_id as string;
      const status = a.status as AttendanceStatus;
      const list = attendanceByMember.get(memberId) ?? [];
      list.push(status);
      attendanceByMember.set(memberId, list);
    }

    for (const [memberId, statuses] of attendanceByMember) {
      const attended = statuses.filter(
        (s) => s === "present" || s === "vr"
      ).length;
      const total = statuses.length;
      const rate = total > 0 ? (attended / total) * 100 : 85;
      attendanceRates.set(memberId, rate);
    }
  }

  // For members with no attendance records, default to 85%
  for (const memberId of memberIdsWithPrefs) {
    if (!attendanceRates.has(memberId)) {
      attendanceRates.set(memberId, 85);
    }
  }

  // 9. Run the draft engine
  const draftResult = runDraftEngine({
    sessions,
    preferences,
    latePreferences,
    members: draftMembers,
    memberRequirementGaps,
    pastLiveFireCounts,
    attendanceRates,
    memberGunMap,
    memberNames,
    excoMemberIds,
    maxLivePerMember: week.max_live_per_member,
  });

  // 10. Write allocations to the database (bulk insert)
  if (draftResult.allocations.length > 0) {
    const allocationRows = draftResult.allocations.map((a) => ({
      member_id: a.member_id,
      session_id: a.session_id,
      week_id: weekId,
      type: a.type,
      gun_id: a.gun_id,
      gun_clash_warning: a.gun_clash_warning,
      priority_score: a.priority_score,
      cancelled: false,
    }));

    const { error: insertAllocError } = await admin
      .from("allocations")
      .insert(allocationRows);

    if (insertAllocError) return { error: insertAllocError.message };
  }

  // 11. Write exco_duty rows (bulk insert)
  if (draftResult.excoDuties.length > 0) {
    const excoDutyRows = draftResult.excoDuties.map((d) => ({
      session_id: d.session_id,
      week_id: weekId,
      member_id: d.member_id,
    }));

    const { error: insertExcoError } = await admin
      .from("exco_duty")
      .insert(excoDutyRows);

    if (insertExcoError) return { error: insertExcoError.message };
  }

  // 12. Update week status to "drafted"
  const { error: updateError } = await admin
    .from("weeks")
    .update({ status: "drafted" })
    .eq("id", weekId);

  if (updateError) return { error: updateError.message };

  // 13. Revalidate
  revalidatePath("/sessions");

  return {
    success: true,
    allocations: draftResult.allocations.length,
    excoDuties: draftResult.excoDuties.length,
  };
}
