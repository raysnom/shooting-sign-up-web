"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { DayType } from "@/types/database";
import {
  DEFAULT_WEEKDAY_SESSIONS,
  DEFAULT_SATURDAY_SESSIONS,
  DEFAULT_LIVE_LANES,
  DEFAULT_DRY_LANES,
  DAY_LABELS,
} from "@/lib/constants";
import { isValidUUID, sanitizeDbError } from "@/lib/utils/validation";

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
// Create a single template
// ──────────────────────────────────────────────

type CreateTemplateInput = {
  name: string;
  day: DayType;
  time_start: string;
  time_end: string;
  live_lanes: number;
  dry_lanes: number;
};

export async function createTemplate(input: CreateTemplateInput) {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin.from("session_templates").insert({
    name: input.name,
    day: input.day,
    time_start: input.time_start,
    time_end: input.time_end,
    live_lanes: input.live_lanes,
    dry_lanes: input.dry_lanes,
  });

  if (error) return { error: sanitizeDbError(error) };

  revalidatePath("/templates");
  return { success: true };
}

// ──────────────────────────────────────────────
// Update a template
// ──────────────────────────────────────────────

type UpdateTemplateInput = Partial<{
  name: string;
  day: DayType;
  time_start: string;
  time_end: string;
  live_lanes: number;
  dry_lanes: number;
}>;

export async function updateTemplate(id: string, updates: UpdateTemplateInput) {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "Invalid template ID." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("session_templates")
    .update(updates)
    .eq("id", id);

  if (error) return { error: sanitizeDbError(error) };

  revalidatePath("/templates");
  return { success: true };
}

// ──────────────────────────────────────────────
// Delete a template
// ──────────────────────────────────────────────

export async function deleteTemplate(id: string) {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  if (!isValidUUID(id)) return { error: "Invalid template ID." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("session_templates")
    .delete()
    .eq("id", id);

  if (error) return { error: sanitizeDbError(error) };

  revalidatePath("/templates");
  return { success: true };
}

// ──────────────────────────────────────────────
// Seed all 12 default templates
// ──────────────────────────────────────────────

export async function seedDefaultTemplates() {
  const { error: authError } = await verifyPresident();
  if (authError) return { error: authError };

  const weekdays: DayType[] = ["mon", "tue", "wed", "thu", "fri"];
  const templates = [];

  for (const day of weekdays) {
    for (const session of DEFAULT_WEEKDAY_SESSIONS) {
      templates.push({
        name: `${DAY_LABELS[day]} ${session.name}`,
        day,
        time_start: session.time_start,
        time_end: session.time_end,
        live_lanes: DEFAULT_LIVE_LANES,
        dry_lanes: DEFAULT_DRY_LANES,
      });
    }
  }

  for (const session of DEFAULT_SATURDAY_SESSIONS) {
    templates.push({
      name: `${DAY_LABELS["sat"]} ${session.name}`,
      day: "sat",
      time_start: session.time_start,
      time_end: session.time_end,
      live_lanes: DEFAULT_LIVE_LANES,
      dry_lanes: DEFAULT_DRY_LANES,
    });
  }

  const admin = createAdminClient();
  const { error } = await admin.from("session_templates").insert(templates);

  if (error) return { error: sanitizeDbError(error) };

  revalidatePath("/templates");
  return { success: true, count: templates.length };
}
