"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { isValidUUID, sanitizeDbError } from "@/lib/utils/validation";

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
  return { userId: user.id };
}

export async function createGroup(name: string) {
  const auth = await verifyPresident();
  if ("error" in auth) return { error: auth.error };

  if (!name.trim()) return { error: "Group name is required" };

  const admin = createAdminClient();
  const { error } = await admin.from("competition_groups").insert({
    name: name.trim(),
    created_by: auth.userId,
  });

  if (error) return { error: sanitizeDbError(error) };

  revalidatePath("/groups");
  return { success: true };
}

export async function deleteGroup(id: string) {
  const auth = await verifyPresident();
  if ("error" in auth) return { error: auth.error };

  if (!isValidUUID(id)) return { error: "Invalid group ID." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("competition_groups")
    .delete()
    .eq("id", id);

  if (error) return { error: sanitizeDbError(error) };

  revalidatePath("/groups");
  return { success: true };
}

export async function addGroupMember(groupId: string, memberId: string) {
  const auth = await verifyPresident();
  if ("error" in auth) return { error: auth.error };

  if (!isValidUUID(groupId)) return { error: "Invalid group ID." };
  if (!isValidUUID(memberId)) return { error: "Invalid member ID." };

  const admin = createAdminClient();
  const { error } = await admin.from("competition_group_members").insert({
    group_id: groupId,
    member_id: memberId,
  });

  if (error) return { error: sanitizeDbError(error) };

  revalidatePath("/groups");
  return { success: true };
}

export async function removeGroupMember(id: string) {
  const auth = await verifyPresident();
  if ("error" in auth) return { error: auth.error };

  if (!isValidUUID(id)) return { error: "Invalid group member ID." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("competition_group_members")
    .delete()
    .eq("id", id);

  if (error) return { error: sanitizeDbError(error) };

  revalidatePath("/groups");
  return { success: true };
}
