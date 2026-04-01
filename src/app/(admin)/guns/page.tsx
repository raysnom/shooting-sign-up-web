import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Gun, Member } from "@/types/database";
import { GunsClient } from "./guns-client";

export default async function GunsPage() {
  await requireRole(["exco", "president"]);

  const supabase = await createClient();

  const { data: guns } = await supabase
    .from("guns")
    .select("*")
    .order("type", { ascending: true })
    .order("name", { ascending: true });

  const { data: members } = await supabase
    .from("members")
    .select("*")
    .eq("archived", false)
    .order("name", { ascending: true });

  return (
    <GunsClient
      guns={(guns as Gun[]) || []}
      members={(members as Member[]) || []}
    />
  );
}
