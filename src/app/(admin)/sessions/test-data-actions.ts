"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function requireDevEnvironment() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Test data functions are not available in production.");
  }
}

async function verifyPresident() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  const { data: caller } = await supabase
    .from("members")
    .select("role")
    .eq("id", user.id)
    .single();

  if (caller?.role !== "president") return { error: "Not authorized" };
  return { error: null };
}

export async function generateTestPreferences(weekId: string) {
  requireDevEnvironment();
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();

  // 1. Check week exists
  const { data: week, error: weekError } = await admin
    .from("weeks")
    .select("id, status, submission_deadline")
    .eq("id", weekId)
    .single();

  if (weekError || !week) return { error: "Week not found." };

  // 2. Get all non-cancelled sessions for this week
  const { data: sessions, error: sessionsError } = await admin
    .from("sessions")
    .select("id")
    .eq("week_id", weekId)
    .eq("is_cancelled", false);

  if (sessionsError) return { error: sessionsError.message };
  if (!sessions || sessions.length === 0) {
    return { error: "No active sessions found for this week. Generate sessions from templates first." };
  }

  // 3. Get all active, non-archived members
  const { data: members, error: membersError } = await admin
    .from("members")
    .select("id, name")
    .eq("archived", false);

  if (membersError) return { error: membersError.message };
  if (!members || members.length === 0) {
    return { error: "No active members found." };
  }

  // 4. Delete any existing preferences for this week (clean slate)
  const { error: deleteError } = await admin
    .from("preferences")
    .delete()
    .eq("week_id", weekId);

  if (deleteError) return { error: `Failed to clear existing preferences: ${deleteError.message}` };

  // 5. Generate random preferences for each member
  // Each member picks 1-3 random sessions and ranks them
  const sessionIds = sessions.map((s) => s.id as string);
  const preferences: {
    member_id: string;
    week_id: string;
    session_id: string;
    rank: number;
    created_at: string;
  }[] = [];

  // Use deadline as created_at so they count as on-time
  const onTimeTimestamp = new Date(
    new Date(week.submission_deadline as string).getTime() - 60 * 60 * 1000
  ).toISOString();

  for (const member of members) {
    // Shuffle sessions and pick 1-3
    const shuffled = [...sessionIds].sort(() => Math.random() - 0.5);
    const pickCount = Math.min(
      Math.floor(Math.random() * 3) + 1,
      shuffled.length
    );

    for (let rank = 1; rank <= pickCount; rank++) {
      preferences.push({
        member_id: member.id as string,
        week_id: weekId,
        session_id: shuffled[rank - 1],
        rank,
        created_at: onTimeTimestamp,
      });
    }
  }

  // 6. Also generate a few "late" preferences (10% of members)
  const lateCount = Math.max(1, Math.floor(members.length * 0.1));
  const lateMembers = [...members]
    .sort(() => Math.random() - 0.5)
    .slice(0, lateCount);

  const lateTimestamp = new Date(
    new Date(week.submission_deadline as string).getTime() + 2 * 60 * 60 * 1000
  ).toISOString();

  for (const member of lateMembers) {
    // Late members get 1 extra preference for a random session they haven't already picked
    const existingSessionIds = new Set(
      preferences
        .filter((p) => p.member_id === (member.id as string))
        .map((p) => p.session_id)
    );
    const available = sessionIds.filter((id) => !existingSessionIds.has(id));
    if (available.length > 0) {
      const maxRank = preferences.filter(
        (p) => p.member_id === (member.id as string)
      ).length;
      preferences.push({
        member_id: member.id as string,
        week_id: weekId,
        session_id: available[Math.floor(Math.random() * available.length)],
        rank: maxRank + 1,
        created_at: lateTimestamp,
      });
    }
  }

  // 7. Insert all preferences
  const { error: insertError } = await admin
    .from("preferences")
    .insert(preferences);

  if (insertError) return { error: insertError.message };

  revalidatePath("/sessions");

  return {
    success: true,
    totalPreferences: preferences.length,
    membersWithPreferences: members.length,
    lateSubmissions: lateMembers.length,
  };
}

export async function generateTestAttendance(weekId: string) {
  requireDevEnvironment();
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();

  // 1. Get allocations for this week
  const { data: allocations, error: allocError } = await admin
    .from("allocations")
    .select("id, member_id, session_id")
    .eq("week_id", weekId)
    .eq("cancelled", false);

  if (allocError) return { error: allocError.message };
  if (!allocations || allocations.length === 0) {
    return { error: "No allocations found. Run the draft first." };
  }

  // 2. Delete existing attendance for this week
  const { error: deleteError } = await admin
    .from("attendance")
    .delete()
    .eq("week_id", weekId);

  if (deleteError) return { error: `Failed to clear existing attendance: ${deleteError.message}` };

  // 3. Generate random attendance records
  const statuses = ["present", "present", "present", "present", "absent", "vr", "no_show"] as const;
  const attendanceRecords: {
    member_id: string;
    session_id: string;
    week_id: string;
    status: string;
  }[] = [];

  for (const alloc of allocations) {
    const status = statuses[Math.floor(Math.random() * statuses.length)];
    attendanceRecords.push({
      member_id: alloc.member_id as string,
      session_id: alloc.session_id as string,
      week_id: weekId,
      status,
    });
  }

  // 4. Insert attendance records
  const { error: insertError } = await admin
    .from("attendance")
    .insert(attendanceRecords);

  if (insertError) return { error: insertError.message };

  // 5. Update no_show_count for members who no-showed
  const noShowMembers = attendanceRecords
    .filter((a) => a.status === "no_show")
    .map((a) => a.member_id);
  const noShowCounts = new Map<string, number>();
  for (const mid of noShowMembers) {
    noShowCounts.set(mid, (noShowCounts.get(mid) ?? 0) + 1);
  }

  for (const [memberId, count] of noShowCounts) {
    const { data: memberData } = await admin
      .from("members")
      .select("no_show_count")
      .eq("id", memberId)
      .single();

    if (memberData) {
      await admin
        .from("members")
        .update({
          no_show_count: ((memberData.no_show_count as number) ?? 0) + count,
        })
        .eq("id", memberId);
    }
  }

  revalidatePath("/sessions");
  revalidatePath("/attendance");

  const presentCount = attendanceRecords.filter((a) => a.status === "present").length;
  const absentCount = attendanceRecords.filter((a) => a.status === "absent").length;
  const vrCount = attendanceRecords.filter((a) => a.status === "vr").length;
  const noShowCount = attendanceRecords.filter((a) => a.status === "no_show").length;

  return {
    success: true,
    total: attendanceRecords.length,
    present: presentCount,
    absent: absentCount,
    vr: vrCount,
    noShow: noShowCount,
  };
}

export async function clearTestData(weekId: string) {
  requireDevEnvironment();
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();

  // Delete in order: attendance, allocations, exco_duty, preferences
  await admin.from("attendance").delete().eq("week_id", weekId);
  await admin.from("exco_duty").delete().eq("week_id", weekId);
  await admin.from("allocations").delete().eq("week_id", weekId);
  await admin.from("preferences").delete().eq("week_id", weekId);

  // Reset week status back to "open"
  await admin.from("weeks").update({ status: "open" }).eq("id", weekId);

  revalidatePath("/sessions");
  revalidatePath("/attendance");

  return { success: true };
}
