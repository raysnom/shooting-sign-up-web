"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { WeekStatus } from "@/types/database";

// ──────────────────────────────────────────────
// Auth helper
// ──────────────────────────────────────────────

async function verifyPresident() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", userId: null };

  const { data: caller } = await supabase
    .from("members")
    .select("role")
    .eq("id", user.id)
    .single();

  if (caller?.role !== "president") return { error: "Not authorized", userId: null };
  return { error: null, userId: user.id };
}

// ──────────────────────────────────────────────
// Create a week
// ──────────────────────────────────────────────

type CreateWeekInput = {
  semester_id: string;
  start_date: string;
  end_date: string;
  max_live_per_member: string;
};

export async function createWeek(input: CreateWeekInput) {
  const { error: authError, userId } = await verifyPresident();
  if (authError || !userId) return { error: authError };

  // Auto-calculate submission deadline: Saturday at 5 PM of that week.
  // end_date is the Sunday, so Saturday = end_date - 1 day.
  const endDate = new Date(input.end_date + "T00:00:00");
  const saturday = new Date(endDate);
  saturday.setDate(saturday.getDate() - 1);

  // Format as ISO timestamptz: YYYY-MM-DDT17:00:00+08:00 (Singapore time)
  const year = saturday.getFullYear();
  const month = String(saturday.getMonth() + 1).padStart(2, "0");
  const day = String(saturday.getDate()).padStart(2, "0");
  const submissionDeadline = `${year}-${month}-${day}T17:00:00+08:00`;

  const admin = createAdminClient();

  // Parse max_live_per_member (empty string -> null)
  const maxLivePerMember = input.max_live_per_member.trim() === ""
    ? null
    : parseInt(input.max_live_per_member, 10);

  const { error } = await admin.from("weeks").insert({
    semester_id: input.semester_id,
    start_date: input.start_date,
    end_date: input.end_date,
    submission_deadline: submissionDeadline,
    status: "open",
    created_by: userId,
    max_live_per_member: maxLivePerMember,
  });

  if (error) return { error: error.message };

  revalidatePath("/sessions");
  return { success: true };
}

// ──────────────────────────────────────────────
// Generate sessions from templates
// ──────────────────────────────────────────────

export async function generateSessionsFromTemplates(weekId: string) {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();

  // Fetch all session templates
  const { data: templates, error: fetchError } = await admin
    .from("session_templates")
    .select("*");

  if (fetchError) return { error: fetchError.message };
  if (!templates || templates.length === 0) {
    return { error: "No session templates found. Create templates first." };
  }

  // Insert a session for each template
  const sessions = templates.map((t) => ({
    week_id: weekId,
    template_id: t.id,
    name: t.name,
    day: t.day,
    time_start: t.time_start,
    time_end: t.time_end,
    live_lanes: t.live_lanes,
    dry_lanes: t.dry_lanes,
    is_cancelled: false,
  }));

  const { error } = await admin.from("sessions").insert(sessions);

  if (error) return { error: error.message };

  revalidatePath("/sessions");
  return { success: true, count: sessions.length };
}

// ──────────────────────────────────────────────
// Update a session
// ──────────────────────────────────────────────

type UpdateSessionInput = Partial<{
  name: string;
  time_start: string;
  time_end: string;
  live_lanes: number;
  dry_lanes: number;
  is_cancelled: boolean;
}>;

export async function updateSession(sessionId: string, updates: UpdateSessionInput) {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin
    .from("sessions")
    .update(updates)
    .eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath("/sessions");
  return { success: true };
}

// ──────────────────────────────────────────────
// Cancel a session
// ──────────────────────────────────────────────

export async function cancelSession(sessionId: string) {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin
    .from("sessions")
    .update({ is_cancelled: true })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath("/sessions");
  return { success: true };
}

// ──────────────────────────────────────────────
// Uncancel (reactivate) a session
// ──────────────────────────────────────────────

export async function uncancelSession(sessionId: string) {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin
    .from("sessions")
    .update({ is_cancelled: false })
    .eq("id", sessionId);

  if (error) return { error: error.message };

  revalidatePath("/sessions");
  return { success: true };
}

// ──────────────────────────────────────────────
// Delete a week (cascades to sessions)
// ──────────────────────────────────────────────

export async function deleteWeek(weekId: string) {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin
    .from("weeks")
    .delete()
    .eq("id", weekId);

  if (error) return { error: error.message };

  revalidatePath("/sessions");
  return { success: true };
}

// ──────────────────────────────────────────────
// Update week status
// ──────────────────────────────────────────────

export async function updateWeekStatus(weekId: string, status: WeekStatus) {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin
    .from("weeks")
    .update({ status })
    .eq("id", weekId);

  if (error) return { error: error.message };

  revalidatePath("/sessions");
  return { success: true };
}
