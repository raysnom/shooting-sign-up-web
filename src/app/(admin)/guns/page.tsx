import { requireRole } from "@/lib/auth";
import { getCachedGuns, getCachedActiveMembers } from "@/lib/cache";
import { GunsClient } from "./guns-client";

export default async function GunsPage() {
  await requireRole(["exco", "president"]);

  const [guns, members] = await Promise.all([
    getCachedGuns(),
    getCachedActiveMembers(),
  ]);

  return <GunsClient guns={guns} members={members} />;
}
