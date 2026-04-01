/**
 * Detect gun clashes within each session and produce warnings.
 *
 * A gun clash occurs when 2+ members assigned to live fire in the same session
 * share the same gun_id (non-null). This is a SOFT rule: we never deny live fire
 * solely because of a gun clash. We flag warnings only.
 */
export function resolveGunClashes(params: {
  liveAssignments: {
    member_id: string;
    session_id: string;
    gun_id: string | null;
  }[];
  memberGunMap: Map<string, string | null>;
  memberNames: Map<string, string>;
}): {
  member_id: string;
  session_id: string;
  gun_clash_warning: string | null;
}[] {
  const { liveAssignments, memberNames } = params;

  // Group assignments by session_id
  const bySession = new Map<
    string,
    { member_id: string; session_id: string; gun_id: string | null }[]
  >();

  for (const assignment of liveAssignments) {
    const list = bySession.get(assignment.session_id) ?? [];
    list.push(assignment);
    bySession.set(assignment.session_id, list);
  }

  const results: {
    member_id: string;
    session_id: string;
    gun_clash_warning: string | null;
  }[] = [];

  for (const [sessionId, assignments] of bySession) {
    // Group members by gun_id within this session (ignore null gun_ids)
    const byGun = new Map<string, string[]>();
    for (const a of assignments) {
      if (a.gun_id) {
        const members = byGun.get(a.gun_id) ?? [];
        members.push(a.member_id);
        byGun.set(a.gun_id, members);
      }
    }

    // Build a set of clashing member_ids -> list of names they clash with
    const clashWarnings = new Map<string, string[]>();
    for (const [, memberIds] of byGun) {
      if (memberIds.length >= 2) {
        for (const memberId of memberIds) {
          const others = memberIds
            .filter((id) => id !== memberId)
            .map((id) => memberNames.get(id) ?? id);
          clashWarnings.set(memberId, others);
        }
      }
    }

    // Produce results for this session
    for (const a of assignments) {
      const others = clashWarnings.get(a.member_id);
      results.push({
        member_id: a.member_id,
        session_id: sessionId,
        gun_clash_warning: others
          ? `Sharing gun with ${others.join(", ")}`
          : null,
      });
    }
  }

  return results;
}
