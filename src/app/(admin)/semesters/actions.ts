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
  const authResult = await verifyPresident();
  if (authResult.error !== null) return { error: authResult.error };
  const userId = authResult.userId;

  const admin = createAdminClient();
  const { error } = await admin.from("semesters").insert({
    name: input.name,
    start_date: input.start_date,
    end_date: input.end_date,
    created_by: userId,
  });

  if (error) return { error: sanitizeDbError(error) };

  await logAudit("semester.create", userId, undefined, { name: input.name });

  revalidatePath("/semesters");
  return { success: true };
}

// ──────────────────────────────────────────────
// Delete a semester
// ──────────────────────────────────────────────

export async function deleteSemester(id: string) {
  const authResult = await verifyPresident();
  if (authResult.error !== null) return { error: authResult.error };
  const userId = authResult.userId;

  if (!isValidUUID(id)) return { error: "Invalid semester ID." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("semesters")
    .delete()
    .eq("id", id);

  if (error) return { error: sanitizeDbError(error) };

  await logAudit("semester.delete", userId, id);

  revalidatePath("/semesters");
  return { success: true };
}

// ──────────────────────────────────────────────
// Reset no-show counts for all non-archived members
// ──────────────────────────────────────────────

export async function resetNoShowCounts() {
  const authResult = await verifyPresident();
  if (authResult.error !== null) return { error: authResult.error };
  const userId = authResult.userId;

  const admin = createAdminClient();
  const { error } = await admin
    .from("members")
    .update({ no_show_count: 0 })
    .eq("archived", false);

  if (error) return { error: sanitizeDbError(error) };

  await logAudit("no_show.reset", userId);

  revalidatePath("/semesters");
  return { success: true };
}
