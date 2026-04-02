"use server";

import { createClient } from "@/lib/supabase/server";
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
// Submit preferences
// ──────────────────────────────────────────────

type RankingInput = {
  session_id: string;
  rank: number;
};

export async function submitPreferences(
  weekId: string,
  rankings: RankingInput[]
) {
  const { error: authError, userId } = await verifyMember();
  if (authError || !userId) return { error: authError ?? "Not authenticated" };

  // Rate limiting: 10 submissions per minute per user
  const { allowed } = rateLimit(`prefs:${userId}`, 10, 60_000);
  if (!allowed) return { error: "Too many submissions. Please wait a minute." };

  if (!isValidUUID(weekId)) return { error: "Invalid week ID." };

  // Validate rankings
  if (rankings.length > 10) return { error: "Too many preferences." };
  for (const r of rankings) {
    if (!isValidUUID(r.session_id)) return { error: "Invalid session ID in rankings." };
    if (r.rank < 1 || r.rank > 10 || !Number.isInteger(r.rank)) return { error: "Invalid rank value." };
  }

  // Check for duplicate session IDs
  const sessionIdSet = new Set(rankings.map((r) => r.session_id));
  if (sessionIdSet.size !== rankings.length) return { error: "Duplicate sessions in rankings." };

  const supabase = await createClient();

  // Verify the week exists and is open (no deadline check - late submissions allowed)
  const { data: week, error: weekError } = await supabase
    .from("weeks")
    .select("id, status")
    .eq("id", weekId)
    .single();

  if (weekError || !week) {
    return { error: "Week not found." };
  }

  if (week.status !== "open") {
    return { error: "This week is not open for submissions." };
  }

  // Delete existing preferences for this member + week
  const { error: deleteError } = await supabase
    .from("preferences")
    .delete()
    .eq("member_id", userId)
    .eq("week_id", weekId);

  if (deleteError) {
    return { error: sanitizeDbError(deleteError) };
  }

  // Insert new preferences (if any rankings provided)
  if (rankings.length > 0) {
    const rows = rankings.map((r) => ({
      member_id: userId,
      week_id: weekId,
      session_id: r.session_id,
      rank: r.rank,
    }));

    const { error: insertError } = await supabase
      .from("preferences")
      .insert(rows);

    if (insertError) {
      return { error: sanitizeDbError(insertError) };
    }
  }

  revalidatePath("/preferences");
  return { success: true };
}
