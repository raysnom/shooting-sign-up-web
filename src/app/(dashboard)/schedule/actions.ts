"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { isValidUUID, sanitizeDbError } from "@/lib/utils/validation";

// ──────────────────────────────────────────────
// Auth helper
// ──────────────────────────────────────────────

async function verifyMember() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", userId: null };
  return { error: null, userId: user.id };
}

// ──────────────────────────────────────────────
// Cancel allocation
// ──────────────────────────────────────────────

export async function cancelAllocation(allocationId: string) {
  const { error: authError, userId } = await verifyMember();
  if (authError || !userId) return { error: authError ?? "Not authenticated" };
  if (!isValidUUID(allocationId)) return { error: "Invalid allocation ID." };

  const supabase = await createClient();

  // Fetch the allocation and verify ownership
  const { data: allocation, error: fetchError } = await supabase
    .from("allocations")
    .select("*, sessions(*)")
    .eq("id", allocationId)
    .single();

  if (fetchError || !allocation) {
    return { error: "Allocation not found." };
  }

  if (allocation.member_id !== userId) {
    return { error: "You do not own this allocation." };
  }

  if (allocation.cancelled) {
    return { error: "This allocation is already cancelled." };
  }

  // Validate 24-hour cancellation window
  // Build the full session datetime from the week start_date + session day offset + time_start
  const session = allocation.sessions;
  if (session) {
    const { data: week } = await supabase
      .from("weeks")
      .select("start_date")
      .eq("id", allocation.week_id)
      .single();

    if (week) {
      const dayOffsets: Record<string, number> = {
        mon: 0,
        tue: 1,
        wed: 2,
        thu: 3,
        fri: 4,
        sat: 5,
      };

      const offset = dayOffsets[session.day] ?? 0;
      const weekStart = new Date(week.start_date);
      const sessionDate = new Date(weekStart);
      sessionDate.setDate(sessionDate.getDate() + offset);

      // Parse time_start (HH:MM or HH:MM:SS)
      const [hours, minutes] = session.time_start.split(":").map(Number);
      sessionDate.setHours(hours, minutes, 0, 0);

      const now = new Date();
      const hoursUntilSession =
        (sessionDate.getTime() - now.getTime()) / (1000 * 60 * 60);

      if (hoursUntilSession < 24) {
        return {
          error:
            "Cannot cancel within 24 hours of the session. Please contact an EXCO member.",
        };
      }
    }
  }

  // Perform the cancellation
  const { error: updateError } = await supabase
    .from("allocations")
    .update({
      cancelled: true,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", allocationId);

  if (updateError) {
    return { error: sanitizeDbError(updateError) };
  }

  // ── Auto-upgrade: promote the highest-priority dry-fire allocation ──
  // Use admin client for atomic upgrade to prevent race conditions
  if (allocation.type === "live") {
    const admin = createAdminClient();

    // Atomically find and promote the top dry-fire allocation
    // Only promote if it's still type='dry' (guards against concurrent cancellations)
    const { data: dryAllocations } = await admin
      .from("allocations")
      .select("*, members(gun_id)")
      .eq("session_id", allocation.session_id)
      .eq("week_id", allocation.week_id)
      .eq("type", "dry")
      .eq("cancelled", false)
      .order("priority_score", { ascending: false })
      .limit(1);

    if (dryAllocations && dryAllocations.length > 0) {
      const topDry = dryAllocations[0] as {
        id: string;
        member_id: string;
        members: { gun_id: string | null } | null;
      };

      const memberGunId = topDry.members?.gun_id ?? null;

      // Conditional update: only promote if still dry (prevents double-promote race)
      await admin
        .from("allocations")
        .update({
          type: "live" as const,
          gun_id: memberGunId,
        })
        .eq("id", topDry.id)
        .eq("type", "dry");
    }
  }

  revalidatePath("/schedule");
  return { success: true };
}

// ──────────────────────────────────────────────
// Submit absence reason (valid reason)
// ──────────────────────────────────────────────

export async function submitAbsenceReason(
  allocationId: string,
  reason: string
) {
  const { error: authError, userId } = await verifyMember();
  if (authError || !userId) return { error: authError ?? "Not authenticated" };
  if (!isValidUUID(allocationId)) return { error: "Invalid allocation ID." };

  if (!reason.trim()) {
    return { error: "Please provide a reason." };
  }

  const supabase = await createClient();

  // Fetch the allocation and verify ownership
  const { data: allocation, error: fetchError } = await supabase
    .from("allocations")
    .select("id, member_id, session_id, week_id")
    .eq("id", allocationId)
    .single();

  if (fetchError || !allocation) {
    return { error: "Allocation not found." };
  }

  if (allocation.member_id !== userId) {
    return { error: "You do not own this allocation." };
  }

  // Upsert attendance row with status "vr" (valid reason)
  const { error: upsertError } = await supabase.from("attendance").upsert(
    {
      member_id: allocation.member_id,
      session_id: allocation.session_id,
      week_id: allocation.week_id,
      status: "vr" as const,
      reason: reason.trim(),
      marked_by: userId,
    },
    {
      onConflict: "member_id,session_id,week_id",
    }
  );

  if (upsertError) {
    return { error: sanitizeDbError(upsertError) };
  }

  revalidatePath("/schedule");
  return { success: true };
}
