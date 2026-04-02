import { createAdminClient } from "@/lib/supabase/admin";

type AuditAction =
  | "member.create"
  | "member.archive"
  | "member.bulk_upload"
  | "role.promote"
  | "role.demote"
  | "presidency.transfer"
  | "draft.run"
  | "draft.rerun"
  | "week.publish"
  | "week.delete"
  | "week.status_change"
  | "semester.create"
  | "semester.delete"
  | "no_show.reset"
  | "test_data.generate"
  | "test_data.clear";

export async function logAudit(
  action: AuditAction,
  actorId: string,
  targetId?: string,
  details?: Record<string, unknown>,
) {
  try {
    const admin = createAdminClient();
    await admin.from("audit_log").insert({
      action,
      actor_id: actorId,
      target_id: targetId ?? null,
      details: details ?? {},
    });
  } catch {
    // Audit logging should never block the main operation
    console.error(`Audit log failed: ${action}`);
  }
}
