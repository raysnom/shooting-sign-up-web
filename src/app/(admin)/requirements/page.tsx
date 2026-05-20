import { requireRole } from "@/lib/auth";
import {
  getCachedActiveWeeks,
  getCachedRequirements,
  getCachedActiveMembers,
  getCachedGroups,
} from "@/lib/cache";
import { RequirementsClient } from "./requirements-client";

export default async function RequirementsPage() {
  await requireRole(["president"]);

  const [weeks, requirements, members, groups] = await Promise.all([
    getCachedActiveWeeks(),
    getCachedRequirements(),
    getCachedActiveMembers(),
    getCachedGroups(),
  ]);

  return (
    <RequirementsClient
      weeks={weeks}
      requirements={requirements}
      members={members}
      groups={groups}
    />
  );
}
