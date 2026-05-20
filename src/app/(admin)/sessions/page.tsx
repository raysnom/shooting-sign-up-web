import { requireRole } from "@/lib/auth";
import { getCachedSemesters, getCachedWeeks, getCachedSessions } from "@/lib/cache";
import { SessionsClient } from "./sessions-client";

export default async function SessionsPage() {
  await requireRole(["president"]);

  const [semesters, weeks, sessions] = await Promise.all([
    getCachedSemesters(),
    getCachedWeeks(),
    getCachedSessions(),
  ]);

  return (
    <SessionsClient
      semesters={semesters}
      weeks={weeks}
      sessions={sessions}
    />
  );
}
