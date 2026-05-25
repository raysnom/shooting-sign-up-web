"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { isValidUUID, sanitizeDbError } from "@/lib/utils/validation";
import { rateLimit } from "@/lib/utils/rate-limit";

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
// Claim a leftover slot
// ──────────────────────────────────────────────
// Any member can claim leftover capacity in a published week — including those
// who submitted preferences but cancelled an allocation and want back in.
// System auto-prefers live fire and falls back to dry. The week cap
// (max_live_per_member) still applies to live claims, and a member cannot
// double-book a session they already hold an active allocation for.
// Supabase has no full transactions; we accept that a race could cause a
// 1-slot oversubscription. We mitigate by re-checking counts immediately
// before insert.

export async function claimLeftoverSlot(
  sessionId: string
): Promise<
  | { error: string; success?: undefined; type?: undefined }
  | { success: true; type: "live" | "dry"; error?: undefined }
> {
  const { error: authError, userId } = await verifyMember();
  if (authError || !userId) return { error: authError ?? "Not authenticated" };

  // Rate limit: 10 claims per minute per user
  const { allowed } = rateLimit(`claim:${userId}`, 10, 60_000);
  if (!allowed) return { error: "Too many requests. Please wait a minute." };

  if (!isValidUUID(sessionId)) return { error: "Invalid session ID." };

  const supabase = await createClient();

  // Fetch the session + its week
  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("*, weeks(*)")
    .eq("id", sessionId)
    .single<{
      id: string;
      week_id: string;
      live_lanes: number;
      dry_lanes: number;
      is_cancelled: boolean;
      weeks: { id: string; status: string; max_live_per_member: number | null } | null;
    }>();

  if (sessionError || !session) return { error: "Session not found." };
  if (session.is_cancelled) return { error: "This session has been cancelled." };

  const week = session.weeks;
  if (!week) return { error: "Week not found for this session." };
  if (week.status !== "published") {
    return { error: "Leftover slots can only be claimed once the week is published." };
  }

  const weekId = week.id;

  // IMPORTANT: capacity and ownership counts MUST run on the admin (service-role)
  // client. The RLS policy `allocations_select_own` only lets a regular member
  // SELECT their own allocation rows, so counting session usage with the
  // user-scoped client would return ~0 and every claim would be granted live
  // fire — blowing past the live-lane cap. The admin client sees all rows.
  const admin = createAdminClient();

  // Caller must not already hold an active allocation for this session
  const { data: existingAlloc } = await admin
    .from("allocations")
    .select("id")
    .eq("member_id", userId)
    .eq("session_id", sessionId)
    .eq("cancelled", false)
    .limit(1);
  if (existingAlloc && existingAlloc.length > 0) {
    return { error: "You already have an allocation for this session." };
  }

  // Decide type by counting current usage (admin client — see note above)
  const decideType = async (): Promise<"live" | "dry" | null> => {
    const { count: liveUsed } = await admin
      .from("allocations")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("type", "live")
      .eq("cancelled", false);
    if ((liveUsed ?? 0) < session.live_lanes) return "live";

    const { count: dryUsed } = await admin
      .from("allocations")
      .select("id", { count: "exact", head: true })
      .eq("session_id", sessionId)
      .eq("type", "dry")
      .eq("cancelled", false);
    if ((dryUsed ?? 0) < session.dry_lanes) return "dry";

    return null;
  };

  // First decision (used only to short-circuit before fetching gun_id).
  const initialType = await decideType();
  if (!initialType) return { error: "No leftover slots available for this session." };

  // Fetch the member's gun_id up front so the live-cap check + insert can
  // both rely on it without a second roundtrip.
  let memberGunId: string | null = null;
  if (initialType === "live") {
    const { data: memberRow } = await supabase
      .from("members")
      .select("gun_id")
      .eq("id", userId)
      .single<{ gun_id: string | null }>();
    memberGunId = memberRow?.gun_id ?? null;
  }

  // Re-check capacity right before insert to narrow the race window.
  const recheckType = await decideType();
  if (!recheckType) return { error: "No leftover slots available for this session." };

  const finalType: "live" | "dry" = recheckType;

  // Enforce the week-level live cap — checked against finalType so a recheck
  // that flips dry -> live (e.g. someone cancelled live) still respects the cap.
  if (finalType === "live" && week.max_live_per_member !== null) {
    const { count: memberLiveCount } = await admin
      .from("allocations")
      .select("id", { count: "exact", head: true })
      .eq("member_id", userId)
      .eq("week_id", weekId)
      .eq("type", "live")
      .eq("cancelled", false);
    if ((memberLiveCount ?? 0) >= week.max_live_per_member) {
      return {
        error: `You have already reached this week's live fire cap (${week.max_live_per_member}).`,
      };
    }
  }

  // If finalType is "live" but we didn't fetch gun_id (initialType was "dry"),
  // grab it now.
  if (finalType === "live" && memberGunId === null && initialType !== "live") {
    const { data: memberRow } = await supabase
      .from("members")
      .select("gun_id")
      .eq("id", userId)
      .single<{ gun_id: string | null }>();
    memberGunId = memberRow?.gun_id ?? null;
  }

  const { error: insertError } = await admin.from("allocations").insert({
    member_id: userId,
    session_id: sessionId,
    week_id: weekId,
    type: finalType,
    gun_id: finalType === "live" ? memberGunId : null,
    gun_clash_warning: null,
    priority_score: 0,
    cancelled: false,
    running_late: false,
  });

  if (insertError) return { error: sanitizeDbError(insertError) };

  revalidatePath("/schedule");
  return { success: true, type: finalType };
}

// ──────────────────────────────────────────────
// Mark allocation as running late (or clear it)
// ──────────────────────────────────────────────
// Members indicate they will arrive ~30 min late (usually because a lesson
// ends late). EXCO marking attendance can see the flag and avoid marking
// absent. Constraint: a late member cannot be the EXCO on duty for the
// first session of their day (the range opener). If they were, we reassign
// duty to another EXCO allocated to that session — or clear the duty and
// surface a warning if no replacement exists.

export async function setRunningLate(
  allocationId: string,
  runningLate: boolean
) {
  const { error: authError, userId } = await verifyMember();
  if (authError || !userId) return { error: authError ?? "Not authenticated" };
  if (!isValidUUID(allocationId)) return { error: "Invalid allocation ID." };

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: allocation, error: fetchError } = await supabase
    .from("allocations")
    .select("id, member_id, session_id, week_id, cancelled, sessions(day, time_start)")
    .eq("id", allocationId)
    .single<{
      id: string;
      member_id: string;
      session_id: string;
      week_id: string;
      cancelled: boolean;
      sessions: { day: string; time_start: string } | null;
    }>();

  if (fetchError || !allocation) {
    return { error: "Allocation not found." };
  }

  if (allocation.member_id !== userId) {
    return { error: "You do not own this allocation." };
  }

  if (allocation.cancelled) {
    return { error: "This allocation is already cancelled." };
  }

  const { error: updateError } = await supabase
    .from("allocations")
    .update({
      running_late: runningLate,
      running_late_at: runningLate ? new Date().toISOString() : null,
    })
    .eq("id", allocationId);

  if (updateError) {
    return { error: sanitizeDbError(updateError) };
  }

  // If marking late, enforce the "no late EXCO on the day's first session" rule.
  let warning: string | null = null;
  if (runningLate && allocation.sessions) {
    const { data: duty } = await admin
      .from("exco_duty")
      .select("id, session_id, week_id, member_id")
      .eq("session_id", allocation.session_id)
      .eq("week_id", allocation.week_id)
      .eq("member_id", userId)
      .maybeSingle();

    if (duty) {
      // Is this the first (earliest) session of its day for this week?
      const { data: daySessions } = await admin
        .from("sessions")
        .select("id, time_start")
        .eq("week_id", allocation.week_id)
        .eq("day", allocation.sessions.day)
        .eq("is_cancelled", false)
        .order("time_start", { ascending: true })
        .limit(1);

      const isFirstOfDay =
        daySessions && daySessions.length > 0 && daySessions[0].id === allocation.session_id;

      if (isFirstOfDay) {
        // Find a replacement: another EXCO allocated to the same session who
        // isn't running late and hasn't cancelled.
        const { data: candidates } = await admin
          .from("allocations")
          .select("member_id, members!inner(id, role)")
          .eq("session_id", allocation.session_id)
          .eq("week_id", allocation.week_id)
          .eq("cancelled", false)
          .eq("running_late", false)
          .neq("member_id", userId)
          .in("members.role", ["exco", "president"]);

        const replacement = candidates && candidates.length > 0
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : null;

        if (replacement) {
          await admin
            .from("exco_duty")
            .update({ member_id: replacement.member_id })
            .eq("id", duty.id);
          warning =
            "EXCO duty for this session was reassigned because a late member can't open the range.";
        } else {
          await admin.from("exco_duty").delete().eq("id", duty.id);
          warning =
            "You were EXCO on duty for this session and no other EXCO is allocated to cover it. The range opener slot is now uncovered — please find a replacement.";
        }
      }
    }
  }

  revalidatePath("/schedule");
  return { success: true, warning };
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
