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

  const [groupsResult, groupMembersResult, allMembersResult] = await Promise.all([
    supabase
      .from("competition_groups")
      .select("*")
      .order("name", { ascending: true }),
    supabase
      .from("competition_group_members")
      .select("*, member:members(*)"),
    supabase
      .from("members")
      .select("*")
      .eq("archived", false)
      .order("name", { ascending: true }),
  ]);

  return (
    <GroupsClient
      groups={(groupsResult.data as CompetitionGroup[]) ?? []}
      groupMembers={
        (groupMembersResult.data as (CompetitionGroupMember & { member: Member })[]) ?? []
      }
      allMembers={(allMembersResult.data as Member[]) ?? []}
    />
  );
}
