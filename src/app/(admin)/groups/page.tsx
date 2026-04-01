import { requireRole } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type {
  CompetitionGroup,
  CompetitionGroupMember,
  Member,
} from "@/types/database";
import { GroupsClient } from "./groups-client";

export default async function GroupsPage() {
  await requireRole(["president"]);

  const supabase = await createClient();

  const { data: groups } = await supabase
    .from("competition_groups")
    .select("*")
    .order("name", { ascending: true });

  const { data: groupMembers } = await supabase
    .from("competition_group_members")
    .select("*, member:members(*)");

  const { data: allMembers } = await supabase
    .from("members")
    .select("*")
    .eq("archived", false)
    .order("name", { ascending: true });

  return (
    <GroupsClient
      groups={(groups as CompetitionGroup[]) || []}
      groupMembers={
        (groupMembers as (CompetitionGroupMember & { member: Member })[]) || []
      }
      allMembers={(allMembers as Member[]) || []}
    />
  );
}
