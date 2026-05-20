import { requireRole } from "@/lib/auth";
import { getCachedTemplates } from "@/lib/cache";
import { TemplatesClient } from "./templates-client";

export default async function TemplatesPage() {
  await requireRole(["president"]);

  const templates = await getCachedTemplates();

  return <TemplatesClient templates={templates} />;
}
