import { requireRole } from "@/lib/auth";
import { getCachedSemesters } from "@/lib/cache";
import { SemestersClient } from "./semesters-client";

export default async function SemestersPage() {
  await requireRole(["president"]);

  const semesters = await getCachedSemesters();

  return <SemestersClient semesters={semesters} />;
}
