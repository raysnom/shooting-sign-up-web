import { requireRole } from "@/lib/auth";
import { getCachedMembers } from "@/lib/cache";
import { MembersClient } from "./members-client";

export default async function MembersPage() {
  await requireRole(["president"]);

  const members = await getCachedMembers();

  return <MembersClient members={members} />;
}
