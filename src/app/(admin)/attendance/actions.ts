"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AttendanceStatus } from "@/types/database";
import { isValidUUID, sanitizeDbError } from "@/lib/utils/validation";

// ──────────────────────────────────────────────
// Auth helper
// ──────────────────────────────────────────────

async function verifyExcoOrAbove() {
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

  if (!member || (member.role !== "exco" && member.role !== "president"))
    return {
      error: "Only EXCO or President can perform this action.",
      userId: null,
    };

  return { error: null, userId: user.id };
}

// ──────────────────────────────────────────────
// Mark attendance
// ──────────────────────────────────────────────

type MarkAttendanceInput = {
  memberId: string;
  sessionId: string;
  weekId: string;
  status: AttendanceStatus;
  reason?: string;
};

export async function markAttendance(input: MarkAttendanceInput) {
  const { error: authError, userId } = await verifyExcoOrAbove();
  if (authError || !userId) return { error: authError };

  if (!isValidUUID(input.memberId) || !isValidUUID(input.sessionId) || !isValidUUID(input.weekId)) {
    return { error: "Invalid ID provided." };
  }

  const admin = createAdminClient();

  // Check if an attendance record already exists for this allocation
  const { data: existing } = await admin
    .from("attendance")
    .select("id, status")
    .eq("member_id", input.memberId)
    .eq("session_id", input.sessionId)
    .eq("week_id", input.weekId)
    .maybeSingle();

  const oldStatus = existing?.status as AttendanceStatus | null;
  const newStatus = input.status;

  const isOldNoShow = oldStatus === "absent" || oldStatus === "no_show";
  const isNewNoShow = newStatus === "absent" || newStatus === "no_show";

  // Upsert the attendance record
  if (existing) {
    const { error } = await admin
      .from("attendance")
      .update({
        status: newStatus,
        reason: input.reason ?? null,
        marked_by: userId,
      })
      .eq("id", existing.id);

    if (error) return { error: sanitizeDbError(error) };
  } else {
    const { error } = await admin.from("attendance").insert({
      member_id: input.memberId,
      session_id: input.sessionId,
      week_id: input.weekId,
      status: newStatus,
      reason: input.reason ?? null,
      marked_by: userId,
    });

    if (error) return { error: sanitizeDbError(error) };
  }

  // Update no_show_count atomically to prevent race conditions
  if (isNewNoShow && !isOldNoShow) {
    await admin.rpc("increment_no_show_count", { member_id_input: input.memberId });
  }
  if (isOldNoShow && !isNewNoShow) {
    await admin.rpc("decrement_no_show_count", { member_id_input: input.memberId });
  }

  revalidatePath("/attendance");
  return { success: true };
}

// ──────────────────────────────────────────────
// Special Events
// ──────────────────────────────────────────────

type CreateSpecialEventInput = {
  weekId: string;
  name: string;
  eventDate: string;
};

export async function createSpecialEvent(input: CreateSpecialEventInput) {
  const { error: authError, userId } = await verifyExcoOrAbove();
  if (authError || !userId) return { error: authError };
  if (!isValidUUID(input.weekId)) return { error: "Invalid week ID." };

  const admin = createAdminClient();

  const { error } = await admin.from("special_events").insert({
    week_id: input.weekId,
    name: input.name,
    event_date: input.eventDate,
    created_by: userId,
  });

  if (error) return { error: sanitizeDbError(error) };

  revalidatePath("/attendance");
  return { success: true };
}

export async function deleteSpecialEvent(id: string) {
  const { error: authError, userId } = await verifyExcoOrAbove();
  if (authError || !userId) return { error: authError };
  if (!isValidUUID(id)) return { error: "Invalid event ID." };

  const admin = createAdminClient();

  const { error } = await admin
    .from("special_events")
    .delete()
    .eq("id", id);

  if (error) return { error: sanitizeDbError(error) };

  revalidatePath("/attendance");
  return { success: true };
}

type ToggleSpecialEventAttendanceInput = {
  specialEventId: string;
  memberId: string;
};

export async function toggleSpecialEventAttendance(
  input: ToggleSpecialEventAttendanceInput
) {
  const { error: authError, userId } = await verifyExcoOrAbove();
  if (authError || !userId) return { error: authError };
  if (!isValidUUID(input.specialEventId) || !isValidUUID(input.memberId)) {
    return { error: "Invalid ID provided." };
  }

  const admin = createAdminClient();

  // Check if record already exists
  const { data: existing } = await admin
    .from("special_event_attendance")
    .select("id")
    .eq("special_event_id", input.specialEventId)
    .eq("member_id", input.memberId)
    .maybeSingle();

  if (existing) {
    // Toggle off: delete the record
    const { error } = await admin
      .from("special_event_attendance")
      .delete()
      .eq("id", existing.id);

    if (error) return { error: sanitizeDbError(error) };
  } else {
    // Toggle on: insert
    const { error } = await admin.from("special_event_attendance").insert({
      special_event_id: input.specialEventId,
      member_id: input.memberId,
    });

    if (error) return { error: sanitizeDbError(error) };
  }

  revalidatePath("/attendance");
  return { success: true };
}
