"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { AttendanceStatus } from "@/types/database";

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

    if (error) return { error: error.message };
  } else {
    const { error } = await admin.from("attendance").insert({
      member_id: input.memberId,
      session_id: input.sessionId,
      week_id: input.weekId,
      status: newStatus,
      reason: input.reason ?? null,
      marked_by: userId,
    });

    if (error) return { error: error.message };
  }

  // Update no_show_count on the member
  // Only increment if newly marking as absent/no_show and wasn't already
  if (isNewNoShow && !isOldNoShow) {
    // Increment no_show_count by 1
    const { data: member } = await admin
      .from("members")
      .select("no_show_count")
      .eq("id", input.memberId)
      .single();

    if (member) {
      await admin
        .from("members")
        .update({ no_show_count: member.no_show_count + 1 })
        .eq("id", input.memberId);
    }
  }

  // Decrement if changing FROM absent/no_show TO present/vr
  if (isOldNoShow && !isNewNoShow) {
    const { data: member } = await admin
      .from("members")
      .select("no_show_count")
      .eq("id", input.memberId)
      .single();

    if (member && member.no_show_count > 0) {
      await admin
        .from("members")
        .update({ no_show_count: member.no_show_count - 1 })
        .eq("id", input.memberId);
    }
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

  const admin = createAdminClient();

  const { error } = await admin.from("special_events").insert({
    week_id: input.weekId,
    name: input.name,
    event_date: input.eventDate,
    created_by: userId,
  });

  if (error) return { error: error.message };

  revalidatePath("/attendance");
  return { success: true };
}

export async function deleteSpecialEvent(id: string) {
  const { error: authError, userId } = await verifyExcoOrAbove();
  if (authError || !userId) return { error: authError };

  const admin = createAdminClient();

  const { error } = await admin
    .from("special_events")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

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

    if (error) return { error: error.message };
  } else {
    // Toggle on: insert
    const { error } = await admin.from("special_event_attendance").insert({
      special_event_id: input.specialEventId,
      member_id: input.memberId,
    });

    if (error) return { error: error.message };
  }

  revalidatePath("/attendance");
  return { success: true };
}
