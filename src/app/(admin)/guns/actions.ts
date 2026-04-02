"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { GunTypeEnum } from "@/types/database";
import { isValidUUID, sanitizeDbError } from "@/lib/utils/validation";

// ──────────────────────────────────────────────
// Auth helper
// ──────────────────────────────────────────────

async function verifyExcoOrAbove() {
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

  if (caller?.role !== "exco" && caller?.role !== "president")
    return { error: "Not authorized" };
  return { error: null };
}

// ──────────────────────────────────────────────
// Create a gun
// ──────────────────────────────────────────────

type GunInput = {
  name: string;
  type: GunTypeEnum;
};

export async function createGun(input: GunInput) {
  const { error: authError } = await verifyExcoOrAbove();
  if (authError) return { error: authError };

  const admin = createAdminClient();
  const { error } = await admin.from("guns").insert({
    name: input.name,
    type: input.type,
  });

  if (error) return { error: sanitizeDbError(error) };

  revalidatePath("/guns");
  return {};
}

// ──────────────────────────────────────────────
// Update a gun
// ──────────────────────────────────────────────

export async function updateGun(id: string, data: GunInput) {
  const { error: authError } = await verifyExcoOrAbove();
  if (authError) return { error: authError };
  if (!isValidUUID(id)) return { error: "Invalid gun ID." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("guns")
    .update({ name: data.name, type: data.type })
    .eq("id", id);

  if (error) return { error: sanitizeDbError(error) };

  revalidatePath("/guns");
  return {};
}

// ──────────────────────────────────────────────
// Delete a gun
// ──────────────────────────────────────────────

export async function deleteGun(id: string) {
  const { error: authError } = await verifyExcoOrAbove();
  if (authError) return { error: authError };
  if (!isValidUUID(id)) return { error: "Invalid gun ID." };

  const admin = createAdminClient();
  const { error } = await admin.from("guns").delete().eq("id", id);

  if (error) return { error: sanitizeDbError(error) };

  revalidatePath("/guns");
  return {};
}

// ──────────────────────────────────────────────
// Assign a gun to a member (or unassign with null)
// ──────────────────────────────────────────────

export async function assignGunToMember(
  memberId: string,
  gunId: string | null
) {
  const { error: authError } = await verifyExcoOrAbove();
  if (authError) return { error: authError };
  if (!isValidUUID(memberId)) return { error: "Invalid member ID." };
  if (gunId !== null && !isValidUUID(gunId)) return { error: "Invalid gun ID." };

  const admin = createAdminClient();

  // Verify member exists
  const { data: member } = await admin
    .from("members")
    .select("id")
    .eq("id", memberId)
    .single();
  if (!member) return { error: "Member not found." };

  // Verify gun exists (if assigning)
  if (gunId) {
    const { data: gun } = await admin
      .from("guns")
      .select("id")
      .eq("id", gunId)
      .single();
    if (!gun) return { error: "Gun not found." };
  }

  const { error } = await admin
    .from("members")
    .update({ gun_id: gunId })
    .eq("id", memberId);

  if (error) return { error: sanitizeDbError(error) };

  revalidatePath("/guns");
  return {};
}

// ──────────────────────────────────────────────
// Bulk import guns from pasted tab-separated data
// ──────────────────────────────────────────────

type BulkImportMemberResult = {
  name: string;
  matched: string | null;
  error?: string;
};

type BulkImportGunResult = {
  gun: string;
  members: BulkImportMemberResult[];
};

/** Strip parenthetical notes and clean up a raw member name */
function cleanMemberName(raw: string): string {
  let name = raw.replace(/^"|"$/g, "");
  // Remove parenthetical info: (C, M), (ARM), (ARW), (TBC), (ANGELINA), etc.
  name = name.replace(/\([^)]*\)/g, "").trim();
  // Remove stray notes
  name = name.replace(/NEED\s+FIND\s+GRIP/gi, "").trim();
  // "x" means empty
  if (name.toLowerCase() === "x" || name === "") return "";
  return name;
}

export async function bulkImportGuns(
  rawText: string,
  gunType: GunTypeEnum
): Promise<{ error: string | null; results: BulkImportGunResult[] }> {
  const { error: authError } = await verifyExcoOrAbove();
  if (authError) return { error: authError, results: [] };

  const admin = createAdminClient();

  // Fetch all active members for name matching
  const { data: allMembers } = await admin
    .from("members")
    .select("id, name")
    .eq("archived", false);

  if (!allMembers) return { error: "Failed to fetch members", results: [] };

  // Parse tab-separated lines
  const rawLines = rawText.split("\n");

  // Reassemble lines: if a line doesn't start with a gun-number-like value
  // in the first tab column, treat it as a continuation of the previous line
  const assembledLines: string[] = [];
  for (const line of rawLines) {
    const trimmed = line.trimEnd();
    if (!trimmed) continue;
    const firstCol = trimmed.split("\t")[0]?.trim();
    // A gun number is alphanumeric (e.g. 749268, KHA9258, 16808435)
    if (firstCol && /^[A-Za-z0-9]+$/.test(firstCol)) {
      assembledLines.push(trimmed);
    } else if (assembledLines.length > 0) {
      // Continuation of previous line (multi-name cell with newlines)
      assembledLines[assembledLines.length - 1] += "\n" + trimmed;
    }
  }

  // Skip header row if present
  let startIdx = 0;
  const firstLine = assembledLines[0]?.toLowerCase() ?? "";
  if (
    firstLine.includes("gun") ||
    firstLine.includes("name") ||
    firstLine.includes("div")
  ) {
    startIdx = 1;
  }

  const results: BulkImportGunResult[] = [];

  for (let i = startIdx; i < assembledLines.length; i++) {
    const cols = assembledLines[i].split("\t");
    const gunName = cols[0]?.trim();

    if (!gunName) continue;

    // Create the gun
    const { data: gun, error: gunError } = await admin
      .from("guns")
      .insert({ name: gunName, type: gunType })
      .select("id")
      .single();

    if (gunError) {
      results.push({
        gun: gunName,
        members: [{ name: "", matched: null, error: gunError.message }],
      });
      continue;
    }

    const memberResults: BulkImportMemberResult[] = [];

    // Process member names from remaining columns
    for (let c = 1; c < cols.length; c++) {
      const rawCell = cols[c]?.trim();
      if (!rawCell) continue;

      // Split cell by newlines (handles multi-name cells from Excel)
      const nameEntries = rawCell
        .split(/\n/)
        .map((n) => n.trim())
        .filter((n) => n.length > 0);

      for (const rawName of nameEntries) {
        const cleaned = cleanMemberName(rawName);
        if (!cleaned) continue;

        // Match by name: case-insensitive starts-with
        const searchUpper = cleaned.toUpperCase();
        const matches = allMembers.filter((m) =>
          (m.name as string).toUpperCase().startsWith(searchUpper)
        );

        if (matches.length === 1) {
          const { error: assignError } = await admin
            .from("members")
            .update({ gun_id: gun.id })
            .eq("id", matches[0].id);

          memberResults.push({
            name: cleaned,
            matched: assignError ? null : (matches[0].name as string),
            error: assignError?.message,
          });
        } else if (matches.length === 0) {
          memberResults.push({
            name: cleaned,
            matched: null,
            error: "No match found",
          });
        } else {
          memberResults.push({
            name: cleaned,
            matched: null,
            error: `Multiple matches: ${matches.map((m) => m.name).join(", ")}`,
          });
        }
      }
    }

    results.push({ gun: gunName, members: memberResults });
  }

  revalidatePath("/guns");
  return { error: null, results };
}
