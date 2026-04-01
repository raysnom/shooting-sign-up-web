import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Week, Session, Preference } from "@/types/database";
import { PreferencesClient } from "./preferences-client";

export default async function PreferencesPage() {
  const member = await getCurrentUser();
  const supabase = await createClient();

  // Find the current open week (most recent by submission_deadline)
  const { data: weeks } = await supabase
    .from("weeks")
    .select("*")
    .eq("status", "open")
    .order("submission_deadline", { ascending: false })
    .limit(1);

  const openWeek = (weeks && weeks.length > 0 ? weeks[0] : null) as Week | null;

  if (!openWeek) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold">Preferences</h1>
        <div className="rounded-md border bg-white p-8 text-center text-gray-500">
          <p className="text-lg font-medium">No open week for submissions</p>
          <p className="mt-1 text-sm">
            Check back later when a new training week is opened.
          </p>
        </div>
      </div>
    );
  }

  // Fetch non-cancelled sessions for this week
  const { data: sessions } = await supabase
    .from("sessions")
    .select("*")
    .eq("week_id", openWeek.id)
    .eq("is_cancelled", false)
    .order("day", { ascending: true })
    .order("time_start", { ascending: true });

  // Fetch existing preferences for this member + week
  const { data: preferences } = await supabase
    .from("preferences")
    .select("*")
    .eq("member_id", member.id)
    .eq("week_id", openWeek.id)
    .order("rank", { ascending: true });

  // Check if deadline has passed (for warning banner, not blocking)
  const now = new Date();
  const deadline = new Date(openWeek.submission_deadline);
  const deadlinePassed = now >= deadline;

  return (
    <PreferencesClient
      week={openWeek}
      sessions={(sessions as Session[]) || []}
      existingPreferences={(preferences as Preference[]) || []}
      deadlinePassed={deadlinePassed}
    />
  );
}
