import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Semester, Week, Session } from "@/types/database";
import { SessionsClient } from "./sessions-client";

export default async function SessionsPage() {
  await requireRole(["president"]);

  const supabase = await createClient();

  const { data: semesters } = await supabase
    .from("semesters")
    .select("*")
    .order("start_date", { ascending: false });

  const { data: weeks } = await supabase
    .from("weeks")
    .select("*")
    .order("start_date", { ascending: false });

  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .order("day", { ascending: true })
    .order("time_start", { ascending: true });

  return (
    <SessionsClient
      semesters={(semesters as Semester[]) ?? []}
      weeks={(weeks as Week[]) ?? []}
      sessions={(sessions as Session[]) ?? []}
    />
  );
}
