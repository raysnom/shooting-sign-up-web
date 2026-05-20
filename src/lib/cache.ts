import { unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  Semester,
  Week,
  Session,
  SessionTemplate,
  Member,
  Gun,
  CompetitionGroup,
  CompetitionGroupMember,
  TrainingRequirement,
} from "@/types/database";

const REVALIDATE_SECONDS = 300;

export const getCachedSemesters = unstable_cache(
  async (): Promise<Semester[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("semesters")
      .select("*")
      .order("start_date", { ascending: false });
    return (data as Semester[]) ?? [];
  },
  ["semesters"],
  { tags: ["semesters"], revalidate: REVALIDATE_SECONDS }
);

export const getCachedWeeks = unstable_cache(
  async (): Promise<Week[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("weeks")
      .select("*")
      .order("start_date", { ascending: false });
    return (data as Week[]) ?? [];
  },
  ["weeks"],
  { tags: ["weeks"], revalidate: REVALIDATE_SECONDS }
);

export const getCachedActiveWeeks = unstable_cache(
  async (): Promise<Week[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("weeks")
      .select("*")
      .in("status", ["open", "published"])
      .order("start_date", { ascending: false });
    return (data as Week[]) ?? [];
  },
  ["weeks", "active"],
  { tags: ["weeks"], revalidate: REVALIDATE_SECONDS }
);

export const getCachedSessions = unstable_cache(
  async (): Promise<Session[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("sessions")
      .select("*")
      .order("day", { ascending: true })
      .order("time_start", { ascending: true });
    return (data as Session[]) ?? [];
  },
  ["sessions"],
  { tags: ["sessions"], revalidate: REVALIDATE_SECONDS }
);

export const getCachedTemplates = unstable_cache(
  async (): Promise<SessionTemplate[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("session_templates")
      .select("*")
      .order("day", { ascending: true })
      .order("time_start", { ascending: true });
    return (data as SessionTemplate[]) ?? [];
  },
  ["templates"],
  { tags: ["templates"], revalidate: REVALIDATE_SECONDS }
);

export const getCachedMembers = unstable_cache(
  async (): Promise<Member[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("members")
      .select("*")
      .order("archived", { ascending: true })
      .order("name", { ascending: true });
    return (data as Member[]) ?? [];
  },
  ["members"],
  { tags: ["members"], revalidate: REVALIDATE_SECONDS }
);

export const getCachedActiveMembers = unstable_cache(
  async (): Promise<Member[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("members")
      .select("*")
      .eq("archived", false)
      .order("name", { ascending: true });
    return (data as Member[]) ?? [];
  },
  ["members", "active"],
  { tags: ["members"], revalidate: REVALIDATE_SECONDS }
);

export const getCachedGuns = unstable_cache(
  async (): Promise<Gun[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("guns")
      .select("*")
      .order("type", { ascending: true })
      .order("name", { ascending: true });
    return (data as Gun[]) ?? [];
  },
  ["guns"],
  { tags: ["guns"], revalidate: REVALIDATE_SECONDS }
);

export const getCachedGroups = unstable_cache(
  async (): Promise<CompetitionGroup[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("competition_groups")
      .select("*")
      .order("name", { ascending: true });
    return (data as CompetitionGroup[]) ?? [];
  },
  ["groups"],
  { tags: ["groups"], revalidate: REVALIDATE_SECONDS }
);

export const getCachedGroupMembers = unstable_cache(
  async (): Promise<(CompetitionGroupMember & { member: Member })[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("competition_group_members")
      .select("*, member:members(*)");
    return (data as (CompetitionGroupMember & { member: Member })[]) ?? [];
  },
  ["group_members"],
  { tags: ["groups", "members"], revalidate: REVALIDATE_SECONDS }
);

export const getCachedRequirements = unstable_cache(
  async (): Promise<TrainingRequirement[]> => {
    const admin = createAdminClient();
    const { data } = await admin
      .from("training_requirements")
      .select("*")
      .order("created_at", { ascending: false });
    return (data as TrainingRequirement[]) ?? [];
  },
  ["requirements"],
  { tags: ["requirements"], revalidate: REVALIDATE_SECONDS }
);
