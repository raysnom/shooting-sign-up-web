/**
 * Assign EXCO duty for each session.
 *
 * For each session, from the EXCO members who are allocated to that session
 * (live or dry), randomly pick one for duty.
 */
export function assignExcoDuties(params: {
  sessions: { id: string }[];
  allocations: {
    member_id: string;
    session_id: string;
    type: "live" | "dry";
  }[];
  excoMemberIds: Set<string>;
}): { session_id: string; member_id: string }[] {
  const { sessions, allocations, excoMemberIds } = params;

  const duties: { session_id: string; member_id: string }[] = [];

  for (const session of sessions) {
    // Find EXCO members allocated to this session
    const excoInSession = allocations
      .filter(
        (a) => a.session_id === session.id && excoMemberIds.has(a.member_id)
      )
      .map((a) => a.member_id);

    if (excoInSession.length === 0) continue;

    // Randomly pick one
    const randomIndex = Math.floor(Math.random() * excoInSession.length);
    duties.push({
      session_id: session.id,
      member_id: excoInSession[randomIndex],
    });
  }

  return duties;
}
