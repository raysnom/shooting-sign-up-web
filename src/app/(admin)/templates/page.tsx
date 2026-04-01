import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { SessionTemplate } from "@/types/database";
import { TemplatesClient } from "./templates-client";

export default async function TemplatesPage() {
  await requireRole(["president"]);

  const supabase = await createClient();
  const { data: templates } = await supabase
    .from("session_templates")
    .select("*")
    .order("day", { ascending: true })
    .order("time_start", { ascending: true });

  return <TemplatesClient templates={(templates as SessionTemplate[]) || []} />;
}
