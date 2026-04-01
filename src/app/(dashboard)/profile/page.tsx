import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TEAM_LABELS, WEIGHTS, ROLLING_WINDOW_WEEKS, DIVISION_MAP } from "@/lib/constants";
import type { Allocation, Attendance, Week, TrainingRequirement } from "@/types/database";

// ──────────────────────────────────────────────
// Score computation helper
// ──────────────────────────────────────────────

function computeBaseScore({
  attendancePct,
  pastLiveFires,
  noShowCount,
  requirementGap,
}: {
  attendancePct: number;
  pastLiveFires: number;
  noShowCount: number;
  requirementGap: number;
}) {
  // S = W1*A - W2*L_past + W3*P - W5*N
  // (L_current and B are draft-time only — excluded from base)
  const P = Math.max(0, requirementGap);
  const score =
    WEIGHTS.W1_ATTENDANCE * attendancePct -
    WEIGHTS.W2_PAST_LIVE_FIRES * pastLiveFires +
    WEIGHTS.W3_REQUIREMENTS * P -
    WEIGHTS.W5_NO_SHOWS * noShowCount;

  return score;
}

// ──────────────────────────────────────────────
// Page
// ──────────────────────────────────────────────

export default async function ProfilePage() {
  const member = await getCurrentUser();
  const supabase = await createClient();

  // ── Fetch latest open or drafted week for requirement check ──
  const { data: latestWeek } = await supabase
    .from("weeks")
    .select("*")
    .in("status", ["open", "closed", "drafted"])
    .order("start_date", { ascending: false })
    .limit(1)
    .single();

  const typedLatestWeek = latestWeek as Week | null;

  // ── Attendance percentage ──
  // Count total attendance records and "present" ones for this member
  const { data: attendanceRecords } = await supabase
    .from("attendance")
    .select("status")
    .eq("member_id", member.id);

  const typedAttendance = (attendanceRecords as Pick<Attendance, "status">[]) || [];
  const totalAttendanceRecords = typedAttendance.length;
  const presentCount = typedAttendance.filter(
    (a) => a.status === "present"
  ).length;
  const attendancePct =
    totalAttendanceRecords > 0
      ? (presentCount / totalAttendanceRecords) * 100
      : 100; // Default to 100% if no records

  // ── Past live fires in rolling window ──
  // Get weeks within the rolling window (last N weeks before the latest week)
  let pastLiveFires = 0;

  if (typedLatestWeek) {
    const { data: recentWeeks } = await supabase
      .from("weeks")
      .select("id")
      .lt("start_date", typedLatestWeek.start_date)
      .order("start_date", { ascending: false })
      .limit(ROLLING_WINDOW_WEEKS);

    const rollingWindowWeekIds = ((recentWeeks as { id: string }[]) || []).map(
      (w) => w.id
    );

    if (rollingWindowWeekIds.length > 0) {
      const { data: pastAllocations } = await supabase
        .from("allocations")
        .select("id")
        .eq("member_id", member.id)
        .eq("type", "live")
        .eq("cancelled", false)
        .in("week_id", rollingWindowWeekIds);

      pastLiveFires = ((pastAllocations as Pick<Allocation, "id">[]) || []).length;
    }
  }

  // ── Training requirement gap ──
  let requirementGap = 0;
  let requiredSessions = 0;
  let attendedSessions = 0;

  if (typedLatestWeek) {
    // Fetch training requirements for this week
    const { data: requirementsRaw } = await supabase
      .from("training_requirements")
      .select("*")
      .eq("week_id", typedLatestWeek.id);

    const requirements = (requirementsRaw as TrainingRequirement[]) ?? [];
    const division = DIVISION_MAP[member.level as keyof typeof DIVISION_MAP];

    // Resolve requirement: individual > group > division > team
    const individualReq = requirements.find(
      (r) => r.target_type === "individual" && r.target_value === member.id
    );
    if (individualReq) {
      requiredSessions = individualReq.min_sessions;
    } else {
      // Check group requirements
      const groupReqs = requirements.filter((r) => r.target_type === "group");
      if (groupReqs.length > 0) {
        const groupIds = groupReqs.map((r) => r.target_value);
        const { data: memberGroups } = await supabase
          .from("competition_group_members")
          .select("group_id")
          .eq("member_id", member.id)
          .in("group_id", groupIds);

        if (memberGroups && memberGroups.length > 0) {
          const matchedGroupId = (memberGroups[0] as { group_id: string }).group_id;
          const groupReq = groupReqs.find((r) => r.target_value === matchedGroupId);
          if (groupReq) {
            requiredSessions = groupReq.min_sessions;
          }
        }
      }

      if (requiredSessions === 0) {
        // Check division requirement
        const divisionReq = requirements.find(
          (r) => r.target_type === "division" && r.target_value === division
        );
        if (divisionReq) {
          requiredSessions = divisionReq.min_sessions;
        } else {
          // Check team requirement
          const teamReq = requirements.find(
            (r) => r.target_type === "team" && r.target_value === member.team
          );
          if (teamReq) {
            requiredSessions = teamReq.min_sessions;
          }
        }
      }
    }

    if (requiredSessions > 0) {
      // Count this week's attended sessions
      const { data: weekAttendance } = await supabase
        .from("attendance")
        .select("status")
        .eq("member_id", member.id)
        .eq("week_id", typedLatestWeek.id);

      const regularAttended = ((weekAttendance as Pick<Attendance, "status">[]) ?? [])
        .filter((a) => a.status === "present" || a.status === "vr").length;

      // Count special event attendance
      const { data: specialEventsRaw } = await supabase
        .from("special_events")
        .select("id")
        .eq("week_id", typedLatestWeek.id);

      const seIds = ((specialEventsRaw as { id: string }[]) ?? []).map((e) => e.id);
      let specialAttended = 0;

      if (seIds.length > 0) {
        const { data: seAttendance } = await supabase
          .from("special_event_attendance")
          .select("id")
          .eq("member_id", member.id)
          .in("special_event_id", seIds);

        specialAttended = ((seAttendance as { id: string }[]) ?? []).length;
      }

      attendedSessions = regularAttended + specialAttended;
      requirementGap = requiredSessions - attendedSessions;
    }
  }

  const effectiveGap = Math.max(0, requirementGap);

  const baseScore = computeBaseScore({
    attendancePct,
    pastLiveFires,
    noShowCount: member.no_show_count,
    requirementGap,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My Profile</h1>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>{member.name}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Login ID</span>
            <span className="text-sm font-medium">{member.login_id}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Email</span>
            <span className="text-sm font-medium">{member.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Team</span>
            <Badge variant="secondary">
              {TEAM_LABELS[member.team] || member.team}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Level</span>
            <span className="text-sm font-medium">{member.level}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Role</span>
            <Badge variant="outline" className="capitalize">
              {member.role}
            </Badge>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">No-Show Count</span>
            <span className="text-sm font-medium">{member.no_show_count}</span>
          </div>
        </CardContent>
      </Card>

      <Card className="max-w-lg">
        <CardHeader>
          <CardTitle>Priority Score Breakdown</CardTitle>
          <CardDescription>
            Your current base priority score used in the draft allocation
            algorithm. Higher scores increase your chance of getting live fire
            slots.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* ── Factor values ── */}
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">
                Attendance % (A)
              </span>
              <span className="text-sm font-medium">
                {attendancePct.toFixed(1)}%
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">
                Past Live Fires in {ROLLING_WINDOW_WEEKS}-week window (L_past)
              </span>
              <span className="text-sm font-medium">{pastLiveFires}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">
                No-Show Count (N)
              </span>
              <span className="text-sm font-medium">
                {member.no_show_count}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">
                Requirement Gap (P)
              </span>
              <span className="text-sm font-medium">
                {requiredSessions > 0
                  ? `${effectiveGap} (${attendedSessions}/${requiredSessions} attended)`
                  : "No requirement"}
              </span>
            </div>
          </div>

          <Separator />

          {/* ── Formula breakdown ── */}
          <div className="rounded-md bg-gray-50 p-3 text-sm font-mono space-y-1">
            <p className="font-semibold text-gray-700">
              Base Score = W1*A - W2*L_past + W3*P - W5*N
            </p>
            <p className="text-gray-500">
              = {WEIGHTS.W1_ATTENDANCE} * {attendancePct.toFixed(1)} - {WEIGHTS.W2_PAST_LIVE_FIRES} * {pastLiveFires} + {WEIGHTS.W3_REQUIREMENTS} * {effectiveGap} - {WEIGHTS.W5_NO_SHOWS} * {member.no_show_count}
            </p>
            <p className="text-gray-500">
              = {(WEIGHTS.W1_ATTENDANCE * attendancePct).toFixed(1)} - {WEIGHTS.W2_PAST_LIVE_FIRES * pastLiveFires} + {WEIGHTS.W3_REQUIREMENTS * effectiveGap} - {WEIGHTS.W5_NO_SHOWS * member.no_show_count}
            </p>
            <Separator />
            <p className="font-bold text-gray-900">
              = {baseScore.toFixed(1)}
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            Note: The final draft score also includes L_current (current week
            live fire count, W4={WEIGHTS.W4_CURRENT_LIVE_FIRES}) and B
            (back-to-back bonus, W6={WEIGHTS.W6_BACK_TO_BACK}), which are
            calculated during the draft run and are not shown here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
