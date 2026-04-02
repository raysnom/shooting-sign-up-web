"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import type { TeamType, LevelType, RoleType } from "@/types/database";
import { isValidUUID, sanitizeDbError } from "@/lib/utils/validation";
import { logAudit } from "@/lib/utils/audit";

const VALID_TEAMS: readonly string[] = ["APW", "APM", "ARM", "ARW"];
const VALID_LEVELS: readonly string[] = ["JH1", "JH2", "JH3", "JH4", "SH1", "SH2"];
const VALID_ROLES: readonly string[] = ["member", "exco", "president"];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FIELD_LENGTH = 255;

function sanitizeCell(value: string): string {
  // Strip leading formula trigger characters and wrap in single quote if still suspicious
  let cleaned = value.replace(/^[=+\-@\t\r\x00]+/, "");
  // Also strip DDE payloads like |cmd, |MSEXCEL
  cleaned = cleaned.replace(/^\|/g, "");
  // Escape embedded quotes for CSV safety
  cleaned = cleaned.replace(/"/g, '""');
  return cleaned;
}

function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= MAX_FIELD_LENGTH;
}

async function verifyPresidentRole() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { error: "Not authenticated" };

  const { data: caller } = await supabase
    .from("members")
    .select("role")
    .eq("id", user.id)
    .single();

  if (caller?.role !== "president") return { error: "Not authorized" };

  return { user };
}

function generateTempPassword(name: string): string {
  const firstName = name.split(" ")[0];
  return `${firstName}2026!`;
}

type CreateMemberInput = {
  login_id: string;
  name: string;
  email: string;
  team: TeamType;
  level: LevelType;
  role: RoleType;
};

export async function createMember(input: CreateMemberInput) {
  const authResult = await verifyPresidentRole();
  if ("error" in authResult) return authResult;

  if (!input.name || input.name.length > MAX_FIELD_LENGTH)
    return { error: "Name is required and must be under 255 characters" };
  if (!input.login_id || input.login_id.length > MAX_FIELD_LENGTH)
    return { error: "Login ID is required and must be under 255 characters" };
  if (!validateEmail(input.email))
    return { error: "Invalid email format" };
  if (!VALID_TEAMS.includes(input.team))
    return { error: `Invalid team. Must be one of: ${VALID_TEAMS.join(", ")}` };
  if (!VALID_LEVELS.includes(input.level))
    return { error: `Invalid level. Must be one of: ${VALID_LEVELS.join(", ")}` };

  const admin = createAdminClient();
  const tempPassword = generateTempPassword(input.name);

  const { data: authUser, error: authError } =
    await admin.auth.admin.createUser({
      email: input.email,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { login_id: input.login_id, name: input.name },
    });

  if (authError) return { error: sanitizeDbError(authError) };

  const { error: memberError } = await admin.from("members").insert({
    id: authUser.user.id,
    login_id: input.login_id,
    name: input.name,
    email: input.email,
    team: input.team,
    level: input.level,
    role: input.role,
  });

  if (memberError) return { error: sanitizeDbError(memberError) };

  await logAudit("member.create", authResult.user.id, authUser.user.id, { email: input.email });

  revalidatePath("/members");
  return { success: true };
}

export async function bulkUploadMembers(csvData: string) {
  const authResult = await verifyPresidentRole();
  if ("error" in authResult) return { error: authResult.error, results: [] };

  const lines = csvData
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length < 2) {
    return { error: "CSV must have a header row and at least one data row", results: [] };
  }

  if (lines.length > 501) {
    return { error: "CSV must not exceed 500 data rows", results: [] };
  }

  const admin = createAdminClient();

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const requiredColumns = ["login_id", "name", "email", "team", "level"];
  const missing = requiredColumns.filter((col) => !header.includes(col));

  if (missing.length > 0) {
    return { error: `Missing columns: ${missing.join(", ")}`, results: [] };
  }

  const results: { email: string; success: boolean; error?: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => sanitizeCell(v.trim()));
    const row: Record<string, string> = {};
    header.forEach((col, idx) => {
      row[col] = (values[idx] || "").substring(0, MAX_FIELD_LENGTH);
    });

    const rowLabel = row.email || `Row ${i + 1}`;

    // Validate required fields
    if (!row.name) {
      results.push({ email: rowLabel, success: false, error: "Missing name" });
      continue;
    }
    if (!row.login_id) {
      results.push({ email: rowLabel, success: false, error: "Missing login_id" });
      continue;
    }
    if (!validateEmail(row.email)) {
      results.push({ email: rowLabel, success: false, error: "Invalid or missing email" });
      continue;
    }
    if (!VALID_TEAMS.includes(row.team.toUpperCase())) {
      results.push({ email: rowLabel, success: false, error: `Invalid team "${row.team}"` });
      continue;
    }
    if (!VALID_LEVELS.includes(row.level.toUpperCase())) {
      results.push({ email: rowLabel, success: false, error: `Invalid level "${row.level}"` });
      continue;
    }

    // Normalize case for enums
    row.team = row.team.toUpperCase();
    row.level = row.level.toUpperCase();
    if (row.role && !VALID_ROLES.includes(row.role.toLowerCase())) {
      results.push({ email: rowLabel, success: false, error: `Invalid role "${row.role}"` });
      continue;
    }
    row.role = row.role ? row.role.toLowerCase() : "member";

    const tempPassword = generateTempPassword(row.name);

    const { data: authUser, error: authError } =
      await admin.auth.admin.createUser({
        email: row.email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: { login_id: row.login_id, name: row.name },
      });

    if (authError) {
      results.push({ email: row.email, success: false, error: authError.message });
      continue;
    }

    // Create member profile
    const { error: memberError } = await admin.from("members").insert({
      id: authUser.user.id,
      login_id: row.login_id,
      name: row.name,
      email: row.email,
      team: row.team as TeamType,
      level: row.level as LevelType,
      role: (row.role as RoleType) || "member",
    });

    if (memberError) {
      results.push({ email: row.email, success: false, error: memberError.message });
      continue;
    }

    results.push({ email: row.email, success: true });
  }

  await logAudit("member.bulk_upload", authResult.user.id, undefined, { count: results.filter(r => r.success).length });

  revalidatePath("/members");
  return {
    error: null,
    results,
    summary: `${results.filter((r) => r.success).length}/${results.length} members created`,
  };
}

export async function archiveMember(memberId: string) {
  const authResult = await verifyPresidentRole();
  if ("error" in authResult) return authResult;

  if (!isValidUUID(memberId)) return { error: "Invalid member ID." };

  // Prevent president from archiving themselves
  if (authResult.user.id === memberId) {
    return { error: "You cannot archive yourself. Transfer presidency first." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("members")
    .update({ archived: true })
    .eq("id", memberId);

  if (error) return { error: sanitizeDbError(error) };

  await logAudit("member.archive", authResult.user.id, memberId);

  revalidatePath("/members");
  return { success: true };
}
