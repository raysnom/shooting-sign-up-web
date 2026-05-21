/**
 * Assign EXCO duty for each session.
 *
 * For each session, from the EXCO members who are allocated to that session
 * (live or dry), randomly pick one for duty.
 *
 * Constraint: the EXCO on duty for the *first session of a given day* opens
 * the range, so they cannot be running late. If every EXCO allocated to the
 * day's first session has flagged themselves late, the session is left
 * without an EXCO on duty (the UI then surfaces "Teacher opens range").
 *
 * Sessions must be pre-sorted by day then `time_start` (the draft engine
 * already does this). The first occurrence of each day is the day's opener.
 */
export function assignExcoDuties(params: {
  sessions: { id: string; day: string }[];
  allocations: {
    member_id: string;
    session_id: string;
    type: "live" | "dry";
    running_late: boolean;
  }[];
  excoMemberIds: Set<string>;
}): { session_id: string; member_id: string }[] {
  const { sessions, allocations, excoMemberIds } = params;

  const firstSessionIdByDay = new Map<string, string>();
  for (const s of sessions) {
    if (!firstSessionIdByDay.has(s.day)) {
      firstSessionIdByDay.set(s.day, s.id);
    }
  }

  const duties: { session_id: string; member_id: string }[] = [];

  for (const session of sessions) {
    const isDayOpener = firstSessionIdByDay.get(session.day) === session.id;

    const excoAllocs = allocations.filter(
      (a) => a.session_id === session.id && excoMemberIds.has(a.member_id)
    );

    const candidates = isDayOpener
      ? excoAllocs.filter((a) => !a.running_late)
      : excoAllocs;

    if (candidates.length === 0) continue;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    duties.push({ session_id: session.id, member_id: pick.member_id });
  }

  return duties;
}
