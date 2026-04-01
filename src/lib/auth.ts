import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { Member } from "@/types/database";

export async function getCurrentUser(): Promise<Member> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: member, error } = await supabase
    .from("members")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error || !member) {
    redirect("/login");
  }

  return member as Member;
}

export async function requireRole(allowedRoles: string[]): Promise<Member> {
  const member = await getCurrentUser();

  if (!allowedRoles.includes(member.role)) {
    redirect("/schedule");
  }

  return member;
}
