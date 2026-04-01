import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Semester } from "@/types/database";
import { SemestersClient } from "./semesters-client";

export default async function SemestersPage() {
  await requireRole(["president"]);

  const supabase = await createClient();
  const { data: semesters } = await supabase
    .from("semesters")
    .select("*")
    .order("start_date", { ascending: false });

  return <SemestersClient semesters={(semesters as Semester[]) || []} />;
}
