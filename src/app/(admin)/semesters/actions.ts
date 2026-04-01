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
  if (!user) return { error: "Not authenticated", userId: null };

  const { data: caller } = await supabase
    .from("members")
    .select("role")
    .eq("id", user.id)
    .single();

  if (caller?.role !== "president") return { error: "Not authorized", userId: null };
  return { error: null, userId: user.id };
}

// ──────────────────────────────────────────────
// Create a semester
// ──────────────────────────────────────────────

type CreateSemesterInput = {
  name: string;
  start_date: string;
  end_date: string;
};

export async function createSemester(input: CreateSemesterInput) {
  const { error: authError, userId } = await verifyPresident();
  if (authError || !userId) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin.from("semesters").insert({
    name: input.name,
    start_date: input.start_date,
    end_date: input.end_date,
    created_by: userId,
  });

  if (error) return { error: error.message };

  revalidatePath("/semesters");
  return { success: true };
}

// ──────────────────────────────────────────────
// Delete a semester
// ──────────────────────────────────────────────

export async function deleteSemester(id: string) {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin
    .from("semesters")
    .delete()
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/semesters");
  return { success: true };
}

// ──────────────────────────────────────────────
// Reset no-show counts for all non-archived members
// ──────────────────────────────────────────────

export async function resetNoShowCounts() {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin
    .from("members")
    .update({ no_show_count: 0 })
    .eq("archived", false);

  if (error) return { error: error.message };

  revalidatePath("/semesters");
  return { success: true };
}
