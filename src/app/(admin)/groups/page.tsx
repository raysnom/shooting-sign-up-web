import { requireRole } from "@/lib/auth";
import {
  getCachedGroups,
  getCachedGroupMembers,
  getCachedActiveMembers,
} from "@/lib/cache";
import { GroupsClient } from "./groups-client";

export default async function GroupsPage() {
  await requireRole(["president"]);

  const [groups, groupMembers, allMembers] = await Promise.all([
    getCachedGroups(),
    getCachedGroupMembers(),
    getCachedActiveMembers(),
  ]);

  return (
    <GroupsClient
      groups={groups}
      groupMembers={groupMembers}
      allMembers={allMembers}
    />
  );
}
