import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/types/database";
import { MembersClient } from "./members-client";

export default async function MembersPage() {
  await requireRole(["president"]);

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("members")
    .select("*")
    .order("archived", { ascending: true })
    .order("name", { ascending: true });

  return <MembersClient members={(members as Member[]) || []} />;
}
