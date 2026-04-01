import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Week, TrainingRequirement, Member, CompetitionGroup } from "@/types/database";
import { RequirementsClient } from "./requirements-client";

export default async function RequirementsPage() {
  await requireRole(["president"]);

  const supabase = await createClient();

  const { data: weeks } = await supabase
    .from("weeks")
    .select("*")
    .in("status", ["open", "published"])
    .order("start_date", { ascending: false });

  const { data: requirements } = await supabase
    .from("training_requirements")
    .select("*")
    .order("created_at", { ascending: false });

  const { data: members } = await supabase
    .from("members")
    .select("*")
    .eq("archived", false)
    .order("name", { ascending: true });

  const { data: groups } = await supabase
    .from("competition_groups")
    .select("*")
    .order("name", { ascending: true });

  return (
    <RequirementsClient
      weeks={(weeks as Week[]) || []}
      requirements={(requirements as TrainingRequirement[]) || []}
      members={(members as Member[]) || []}
      groups={(groups as CompetitionGroup[]) || []}
    />
  );
}
