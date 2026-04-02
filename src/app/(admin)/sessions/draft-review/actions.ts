"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isValidUUID, sanitizeDbError } from "@/lib/utils/validation";
import { logAudit } from "@/lib/utils/audit";

// ──────────────────────────────────────────────
// Auth helper
// ──────────────────────────────────────────────

async function verifyPresident(): Promise<
  { error: string; userId: null } | { error: null; userId: string }
> {
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
    return { error: "Only the President can perform this action.", userId: null };

  return { error: null, userId: user.id };
}

// ──────────────────────────────────────────────
// Publish week (drafted → published)
// ──────────────────────────────────────────────

export async function publishWeek(weekId: string) {
  const authResult = await verifyPresident();
  if (authResult.error !== null) return { error: authResult.error };
  const userId = authResult.userId;

  if (!isValidUUID(weekId)) return { error: "Invalid week ID." };

  const admin = createAdminClient();

  // Verify the week exists and is in "drafted" status
  const { data: week, error: fetchError } = await admin
    .from("weeks")
    .select("id, status")
    .eq("id", weekId)
    .single();

  if (fetchError || !week) return { error: "Week not found." };
  if (week.status !== "drafted")
    return { error: `Week must be in "drafted" status to publish. Current status: "${week.status}".` };

  const { error } = await admin
    .from("weeks")
    .update({
      status: "published",
      results_published_at: new Date().toISOString(),
    })
    .eq("id", weekId);

  if (error) return { error: sanitizeDbError(error) };

  await logAudit("week.publish", userId, weekId);

  revalidatePath("/sessions");
  revalidatePath("/sessions/draft-review");
  revalidatePath("/schedule");
  return { success: true };
}

// ──────────────────────────────────────────────
// Re-run draft (drafted → closed, delete allocations & exco_duty)
// ──────────────────────────────────────────────

export async function rerunDraft(weekId: string) {
  const authResult = await verifyPresident();
  if (authResult.error !== null) return { error: authResult.error };
  const userId = authResult.userId;

  if (!isValidUUID(weekId)) return { error: "Invalid week ID." };

  const admin = createAdminClient();

  // Verify the week exists and is in "drafted" status
  const { data: week, error: fetchError } = await admin
    .from("weeks")
    .select("id, status")
    .eq("id", weekId)
    .single();

  if (fetchError || !week) return { error: "Week not found." };
  if (week.status !== "drafted")
    return { error: `Week must be in "drafted" status to re-run draft. Current status: "${week.status}".` };

  // Delete all allocations for this week
  const { error: allocError } = await admin
    .from("allocations")
    .delete()
    .eq("week_id", weekId);

  if (allocError) return { error: sanitizeDbError(allocError) };

  // Delete all exco_duty assignments for this week
  const { error: excoError } = await admin
    .from("exco_duty")
    .delete()
    .eq("week_id", weekId);

  if (excoError) return { error: sanitizeDbError(excoError) };

  // Reset week status to "closed"
  const { error: updateError } = await admin
    .from("weeks")
    .update({ status: "closed", results_published_at: null })
    .eq("id", weekId);

  if (updateError) return { error: sanitizeDbError(updateError) };

  await logAudit("draft.rerun", userId, weekId);

  revalidatePath("/sessions");
  revalidatePath("/sessions/draft-review");
  return { success: true };
}
