import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Member } from "@/types/database";
import { HandoverClient } from "./handover-client";

export default async function HandoverPage() {
  const currentUser = await requireRole(["president"]);

  const supabase = await createClient();
  const { data: members } = await supabase
    .from("members")
    .select("*")
    .eq("archived", false)
    .order("name", { ascending: true });

  return (
    <HandoverClient
      members={(members as Member[]) || []}
      currentUserId={currentUser.id}
    />
  );
}
