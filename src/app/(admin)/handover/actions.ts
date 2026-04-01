"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { RoleType } from "@/types/database";

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
  const { error } = await verifyPresident();
  if (error) return { error };

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("members")
    .update({ role: "exco" as RoleType })
    .eq("id", memberId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/handover");
  return { success: true };
}

export async function demoteToMember(memberId: string) {
  const { error } = await verifyPresident();
  if (error) return { error };

  const admin = createAdminClient();
  const { error: updateError } = await admin
    .from("members")
    .update({ role: "member" as RoleType })
    .eq("id", memberId);

  if (updateError) return { error: updateError.message };

  revalidatePath("/handover");
  return { success: true };
}

export async function transferPresidency(newPresidentId: string) {
  const { error, userId } = await verifyPresident();
  if (error) return { error };

  const admin = createAdminClient();

  // Demote current president to exco
  const { error: demoteError } = await admin
    .from("members")
    .update({ role: "exco" as RoleType })
    .eq("id", userId);

  if (demoteError) return { error: demoteError.message };

  // Promote new president
  const { error: promoteError } = await admin
    .from("members")
    .update({ role: "president" as RoleType })
    .eq("id", newPresidentId);

  if (promoteError) return { error: promoteError.message };

  revalidatePath("/handover");
  return { success: true };
}
