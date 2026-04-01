"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

// ──────────────────────────────────────────────
// Auth helper
// ──────────────────────────────────────────────

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
  return { error: null, userId: user.id };
}

// ──────────────────────────────────────────────
// Create a competition group
// ──────────────────────────────────────────────

export async function createGroup(name: string) {
  const { error: authError, userId } = await verifyPresident();
  if (authError) return { error: authError };

  if (!name.trim()) return { error: "Group name is required" };

  const admin = createAdminClient();
  const { error } = await admin.from("competition_groups").insert({
    name: name.trim(),
    created_by: userId,
  });

  if (error) return { error: error.message };

  revalidatePath("/groups");
  return { success: true };
}

// ──────────────────────────────────────────────
// Delete a competition group
// ──────────────────────────────────────────────

export async function deleteGroup(id: string) {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin
    .from("competition_groups")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/groups");
  return { success: true };
}

// ──────────────────────────────────────────────
// Add a member to a group
// ──────────────────────────────────────────────

export async function addGroupMember(groupId: string, memberId: string) {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin.from("competition_group_members").insert({
    group_id: groupId,
    member_id: memberId,
  });

  if (error) return { error: error.message };

  revalidatePath("/groups");
  return { success: true };
}

// ──────────────────────────────────────────────
// Remove a member from a group
// ──────────────────────────────────────────────

export async function removeGroupMember(id: string) {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin
    .from("competition_group_members")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/groups");
  return { success: true };
}
