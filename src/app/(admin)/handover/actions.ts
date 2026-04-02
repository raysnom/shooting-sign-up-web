"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { RoleType } from "@/types/database";
import { isValidUUID, sanitizeDbError } from "@/lib/utils/validation";
import { logAudit } from "@/lib/utils/audit";

async function verifyPresident() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", userId: "" };

  const { data: caller } = await supabase
    .from("members")
    .select("role")
    .eq("id", user.id)
    .single();

  if (caller?.role !== "president") return { error: "Not authorized", userId: "" };
  return { error: null, userId: user.id };
}

export async function promoteToExco(memberId: string) {
  const { error, userId } = await verifyPresident();
  if (error) return { error };
  if (!isValidUUID(memberId)) return { error: "Invalid member ID." };

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("members")
    .update({ role: "exco" as RoleType })
    .eq("id", memberId);

  if (updateError) return { error: sanitizeDbError(updateError) };

  await logAudit("role.promote", userId, memberId);

  revalidatePath("/handover");
  return { success: true };
}

export async function demoteToMember(memberId: string) {
  const { error, userId } = await verifyPresident();
  if (error) return { error };
  if (!isValidUUID(memberId)) return { error: "Invalid member ID." };

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("members")
    .update({ role: "member" as RoleType })
    .eq("id", memberId);

  if (updateError) return { error: sanitizeDbError(updateError) };

  await logAudit("role.demote", userId, memberId);

  revalidatePath("/handover");
  return { success: true };
}

export async function transferPresidency(newPresidentId: string) {
  const { error, userId } = await verifyPresident();
  if (error) return { error };
  if (!isValidUUID(newPresidentId)) return { error: "Invalid member ID." };

  const admin = createAdminClient();

  // Promote new president FIRST — if this fails, current president is still intact
  const { error: promoteError } = await admin
    .from("members")
    .update({ role: "president" as RoleType })
    .eq("id", newPresidentId);

  if (promoteError) return { error: sanitizeDbError(promoteError) };

  // Demote current president to exco — safe now since new president exists
  const { error: demoteError } = await admin
    .from("members")
    .update({ role: "exco" as RoleType })
    .eq("id", userId);

  if (demoteError) {
    // Rollback: restore new president back to their previous role
    await admin
      .from("members")
      .update({ role: "exco" as RoleType })
      .eq("id", newPresidentId);
    return { error: "Transfer failed. No changes were made." };
  }

  await logAudit("presidency.transfer", userId, newPresidentId);

  revalidatePath("/handover");
  return { success: true };
}
