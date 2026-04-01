"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { TrainingTargetType } from "@/types/database";

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
  return { error: null };
}

// ──────────────────────────────────────────────
// Create a training requirement
// ──────────────────────────────────────────────

type CreateRequirementInput = {
  week_id: string;
  target_type: TrainingTargetType;
  target_value: string;
  min_sessions: number;
};

export async function createRequirement(input: CreateRequirementInput) {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin.from("training_requirements").insert({
    week_id: input.week_id,
    target_type: input.target_type,
    target_value: input.target_value,
    min_sessions: input.min_sessions,
  });

  if (error) return { error: error.message };

  revalidatePath("/requirements");
  return { success: true };
}

// ──────────────────────────────────────────────
// Update a training requirement (min_sessions only)
// ──────────────────────────────────────────────

export async function updateRequirement(
  id: string,
  data: { min_sessions: number }
) {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin
    .from("training_requirements")
    .update({ min_sessions: data.min_sessions })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/requirements");
  return { success: true };
}

// ──────────────────────────────────────────────
// Delete a training requirement
// ──────────────────────────────────────────────

export async function deleteRequirement(id: string) {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin
    .from("training_requirements")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/requirements");
  return { success: true };
}
