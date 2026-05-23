/**
 * Assign EXCO duty for each session.
 *
 * For each session, pick one EXCO on duty from the EXCO members allocated to
 * that session (live or dry).
 *
 * Fairness: instead of picking independently at random per session (which lets
 * one unlucky EXCO pile up many duties while another gets none), we balance the
 * *total* duty load across the week. Sessions are processed in order, and each
 * one is given to the eligible EXCO with the fewest duties so far. Ties are
 * broken randomly so the assignment isn't biased toward whoever appears first.
 *
 * This caps everyone at roughly ceil(totalDutySessions / numEligibleExcos)
 * duties — i.e. "once or twice a week" when there are enough EXCOs to go round.
 *
 * Constraint: the EXCO on duty for the *first session of a given day* opens
 * the range, so they cannot be running late. If every EXCO allocated to the
 * day's first session has flagged themselves late, the session is left
 * without an EXCO on duty (the UI then surfaces "TIC opens range").
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

  // Running count of duties assigned to each EXCO this week. Used to always
  // hand the next duty to whoever is currently least loaded.
  const dutyCount = new Map<string, number>();

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

    // Pick the candidate with the fewest duties so far. Among those tied for
    // the minimum, pick one at random to avoid biasing by allocation order.
    let minDuties = Infinity;
    for (const c of candidates) {
      const count = dutyCount.get(c.member_id) ?? 0;
      if (count < minDuties) minDuties = count;
    }
    const leastLoaded = candidates.filter(
      (c) => (dutyCount.get(c.member_id) ?? 0) === minDuties
    );

    const pick = leastLoaded[Math.floor(Math.random() * leastLoaded.length)];
    duties.push({ session_id: session.id, member_id: pick.member_id });
    dutyCount.set(pick.member_id, (dutyCount.get(pick.member_id) ?? 0) + 1);
  }

  return duties;
}
