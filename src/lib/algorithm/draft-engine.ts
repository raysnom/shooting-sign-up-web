import type { DayType } from "@/types/database";
import { calculatePriorityScore } from "./priority-score";
import { resolveGunClashes } from "./gun-clash";
import { assignExcoDuties } from "./exco-duty";

// ──────────────────────────────────────────────
// Input types
// ──────────────────────────────────────────────

export type DraftSession = {
  id: string;
  day: DayType;
  time_start: string;
  time_end: string;
  live_lanes: number;
  dry_lanes: number;
};

export type DraftPreference = {
  member_id: string;
  session_id: string;
  rank: number;
};

export type DraftMember = {
  id: string;
  no_show_count: number;
  gun_id: string | null;
};

export type DraftInput = {
  sessions: DraftSession[];
  preferences: DraftPreference[];
  latePreferences: DraftPreference[];
  members: DraftMember[];
  memberRequirementGaps: Map<string, number>;
  pastLiveFireCounts: Map<string, number>;
  attendanceRates: Map<string, number>;
  memberGunMap: Map<string, string | null>;
  memberNames: Map<string, string>;
  excoMemberIds: Set<string>;
  maxLivePerMember: number | null;
};

// ──────────────────────────────────────────────
// Internal types
// ──────────────────────────────────────────────

type ScoredMember = {
  member_id: string;
  score: number;
  gun_id: string | null;
};

// ──────────────────────────────────────────────
// Output types
// ──────────────────────────────────────────────

export type DraftAllocation = {
  member_id: string;
  session_id: string;
  type: "live" | "dry";
  gun_id: string | null;
  gun_clash_warning: string | null;
  priority_score: number;
};

export type DraftExcoDuty = {
  session_id: string;
  member_id: string;
};

export type DraftResult = {
  allocations: DraftAllocation[];
  excoDuties: DraftExcoDuty[];
};

// ──────────────────────────────────────────────
// Day ordering
// ──────────────────────────────────────────────

const DAY_ORDER: Record<DayType, number> = {
  mon: 0,
  tue: 1,
  wed: 2,
  thu: 3,
  fri: 4,
  sat: 5,
};

// ──────────────────────────────────────────────
// Draft engine (pure function)
// ──────────────────────────────────────────────

export function runDraftEngine(input: DraftInput): DraftResult {
  const {
    sessions,
    preferences,
    latePreferences,
    members,
    memberRequirementGaps,
    pastLiveFireCounts,
    attendanceRates,
    memberGunMap,
    memberNames,
    excoMemberIds,
    maxLivePerMember,
  } = input;

  // 1. Sort sessions by day order then time_start
  const sortedSessions = [...sessions].sort((a, b) => {
    const dayDiff = DAY_ORDER[a.day] - DAY_ORDER[b.day];
    if (dayDiff !== 0) return dayDiff;
    return a.time_start.localeCompare(b.time_start);
  });

  // Build a lookup: member_id -> DraftMember
  const memberMap = new Map<string, DraftMember>();
  for (const m of members) {
    memberMap.set(m.id, m);
  }

  // Build a lookup: session_id -> list of on-time preferences
  const prefsBySession = new Map<string, DraftPreference[]>();
  for (const pref of preferences) {
    const list = prefsBySession.get(pref.session_id) ?? [];
    list.push(pref);
    prefsBySession.set(pref.session_id, list);
  }

  // Build a lookup: session_id -> list of late preferences
  const latePrefsBySession = new Map<string, DraftPreference[]>();
  for (const pref of latePreferences) {
    const list = latePrefsBySession.get(pref.session_id) ?? [];
    list.push(pref);
    latePrefsBySession.set(pref.session_id, list);
  }

  // 2. Running trackers
  const currentLiveFires = new Map<string, number>();
  const wonLiveInSession = new Map<string, Set<string>>();
  const memberLiveCount = new Map<string, number>(); // Track live fire count per member for max limit
  const sessionLiveUsed = new Map<string, number>(); // Track live lanes used per session
  const sessionDryUsed = new Map<string, number>(); // Track dry lanes used per session

  const allAllocations: DraftAllocation[] = [];

  // 3. Process each session in order (ROUND 1: On-time preferences)
  for (let i = 0; i < sortedSessions.length; i++) {
    const session = sortedSessions[i];
    const sessionPrefs = prefsBySession.get(session.id) ?? [];

    if (sessionPrefs.length === 0) continue;

    // Determine previous session (for back-to-back detection)
    const prevSession = i > 0 ? sortedSessions[i - 1] : null;
    const hasPrevSameDay =
      prevSession !== null && prevSession.day === session.day;
    const isConsecutive =
      hasPrevSameDay && prevSession.time_end === session.time_start;

    // 4a. For each requesting member, calculate priority score
    const scored: ScoredMember[] = [];

    for (const pref of sessionPrefs) {
      const member = memberMap.get(pref.member_id);
      if (!member) continue;

      const attendance = attendanceRates.get(pref.member_id) ?? 85;
      const pastLF = pastLiveFireCounts.get(pref.member_id) ?? 0;
      const currentLF = currentLiveFires.get(pref.member_id) ?? 0;
      const reqGap = memberRequirementGaps.get(pref.member_id) ?? 0;

      // Back-to-back: member won live fire in the immediately preceding
      // consecutive session on the same day
      let isBackToBack = false;
      if (isConsecutive && prevSession) {
        const prevWinners = wonLiveInSession.get(prevSession.id);
        if (prevWinners?.has(pref.member_id)) {
          isBackToBack = true;
        }
      }

      const score = calculatePriorityScore({
        attendance,
        pastLiveFires: pastLF,
        currentLiveFires: currentLF,
        requirementGap: reqGap,
        isBackToBack,
        noShowCount: member.no_show_count,
      });

      scored.push({
        member_id: pref.member_id,
        score,
        gun_id: memberGunMap.get(pref.member_id) ?? null,
      });
    }

    // 4c. Sort by priority score descending
    scored.sort((a, b) => b.score - a.score);

    // 4d. Assign top N to live fire (respecting max live per member limit)
    const liveMembers: ScoredMember[] = [];
    const skippedMembers: ScoredMember[] = [];

    for (const member of scored) {
      // Check if member has reached the max live fire limit for the week
      if (maxLivePerMember !== null) {
        const currentCount = memberLiveCount.get(member.member_id) ?? 0;
        if (currentCount >= maxLivePerMember) {
          // Member has reached limit, skip them for live fire
          skippedMembers.push(member);
          continue;
        }
      }

      // Check if we still have live lanes available
      if (liveMembers.length < session.live_lanes) {
        liveMembers.push(member);
      } else {
        skippedMembers.push(member);
      }
    }

    const remainingMembers = skippedMembers;

    // 4e. Assign remaining to dry fire (up to dry_lanes capacity)
    const dryCount = Math.min(session.dry_lanes, remainingMembers.length);
    const dryMembers = remainingMembers.slice(0, dryCount);

    // Build live assignments for gun clash detection
    const liveAssignmentsForClash = liveMembers.map((m) => ({
      member_id: m.member_id,
      session_id: session.id,
      gun_id: m.gun_id,
    }));

    // Run gun clash detection
    const clashResults = resolveGunClashes({
      liveAssignments: liveAssignmentsForClash,
      memberGunMap,
      memberNames,
    });

    // Build a lookup for clash warnings
    const clashWarningMap = new Map<string, string | null>();
    for (const cr of clashResults) {
      clashWarningMap.set(cr.member_id, cr.gun_clash_warning);
    }

    // Create live allocations
    for (const m of liveMembers) {
      allAllocations.push({
        member_id: m.member_id,
        session_id: session.id,
        type: "live",
        gun_id: m.gun_id,
        gun_clash_warning: clashWarningMap.get(m.member_id) ?? null,
        priority_score: m.score,
      });

      // 4f. Update currentLiveFires
      currentLiveFires.set(
        m.member_id,
        (currentLiveFires.get(m.member_id) ?? 0) + 1
      );

      // Track live fire count per member (for max limit enforcement)
      memberLiveCount.set(
        m.member_id,
        (memberLiveCount.get(m.member_id) ?? 0) + 1
      );

      // Track live winners per session (for back-to-back)
      if (!wonLiveInSession.has(session.id)) {
        wonLiveInSession.set(session.id, new Set());
      }
      wonLiveInSession.get(session.id)!.add(m.member_id);
    }

    // Create dry allocations
    for (const m of dryMembers) {
      allAllocations.push({
        member_id: m.member_id,
        session_id: session.id,
        type: "dry",
        gun_id: null,
        gun_clash_warning: null,
        priority_score: m.score,
      });
    }

    // Track capacity usage for this session
    sessionLiveUsed.set(session.id, liveMembers.length);
    sessionDryUsed.set(session.id, dryMembers.length);
  }

  // ──────────────────────────────────────────────
  // ROUND 2: Process late preferences
  // ──────────────────────────────────────────────

  for (let i = 0; i < sortedSessions.length; i++) {
    const session = sortedSessions[i];
    const lateSessionPrefs = latePrefsBySession.get(session.id) ?? [];

    if (lateSessionPrefs.length === 0) continue;

    // Check remaining capacity
    const liveUsed = sessionLiveUsed.get(session.id) ?? 0;
    const dryUsed = sessionDryUsed.get(session.id) ?? 0;
    const liveRemaining = session.live_lanes - liveUsed;
    const dryRemaining = session.dry_lanes - dryUsed;

    if (liveRemaining <= 0 && dryRemaining <= 0) {
      // Session is full, skip
      continue;
    }

    // Determine previous session (for back-to-back detection)
    const prevSession = i > 0 ? sortedSessions[i - 1] : null;
    const hasPrevSameDay =
      prevSession !== null && prevSession.day === session.day;
    const isConsecutive =
      hasPrevSameDay && prevSession.time_end === session.time_start;

    // Calculate priority scores for late members
    const scored: ScoredMember[] = [];

    for (const pref of lateSessionPrefs) {
      const member = memberMap.get(pref.member_id);
      if (!member) continue;

      // Skip members who already have an allocation in this session
      const hasAllocation = allAllocations.some(
        (a) => a.member_id === pref.member_id && a.session_id === session.id
      );
      if (hasAllocation) continue;

      const attendance = attendanceRates.get(pref.member_id) ?? 85;
      const pastLF = pastLiveFireCounts.get(pref.member_id) ?? 0;
      const currentLF = currentLiveFires.get(pref.member_id) ?? 0;
      const reqGap = memberRequirementGaps.get(pref.member_id) ?? 0;

      // Back-to-back check
      let isBackToBack = false;
      if (isConsecutive && prevSession) {
        const prevWinners = wonLiveInSession.get(prevSession.id);
        if (prevWinners?.has(pref.member_id)) {
          isBackToBack = true;
        }
      }

      const score = calculatePriorityScore({
        attendance,
        pastLiveFires: pastLF,
        currentLiveFires: currentLF,
        requirementGap: reqGap,
        isBackToBack,
        noShowCount: member.no_show_count,
      });

      scored.push({
        member_id: pref.member_id,
        score,
        gun_id: memberGunMap.get(pref.member_id) ?? null,
      });
    }

    // Sort by priority score descending
    scored.sort((a, b) => b.score - a.score);

    // Assign to remaining live fire slots (respecting max live per member limit)
    const lateMembers: ScoredMember[] = [];
    const lateDryMembers: ScoredMember[] = [];

    for (const member of scored) {
      // Try to assign to live fire first
      if (liveRemaining > 0 && lateMembers.length < liveRemaining) {
        // Check if member has reached the max live fire limit
        if (maxLivePerMember !== null) {
          const currentCount = memberLiveCount.get(member.member_id) ?? 0;
          if (currentCount >= maxLivePerMember) {
            // Member has reached limit, try dry fire
            if (dryRemaining > 0 && lateDryMembers.length < dryRemaining) {
              lateDryMembers.push(member);
            }
            continue;
          }
        }

        lateMembers.push(member);
      } else if (dryRemaining > 0 && lateDryMembers.length < dryRemaining) {
        // Assign to dry fire
        lateDryMembers.push(member);
      }
      // If both full, member is not allocated
    }

    // Build live assignments for gun clash detection
    const lateLiveAssignmentsForClash = lateMembers.map((m) => ({
      member_id: m.member_id,
      session_id: session.id,
      gun_id: m.gun_id,
    }));

    // Run gun clash detection
    const clashResults = resolveGunClashes({
      liveAssignments: lateLiveAssignmentsForClash,
      memberGunMap,
      memberNames,
    });

    // Build clash warning map
    const clashWarningMap = new Map<string, string | null>();
    for (const cr of clashResults) {
      clashWarningMap.set(cr.member_id, cr.gun_clash_warning);
    }

    // Create late live allocations
    for (const m of lateMembers) {
      allAllocations.push({
        member_id: m.member_id,
        session_id: session.id,
        type: "live",
        gun_id: m.gun_id,
        gun_clash_warning: clashWarningMap.get(m.member_id) ?? null,
        priority_score: m.score,
      });

      // Update trackers
      currentLiveFires.set(
        m.member_id,
        (currentLiveFires.get(m.member_id) ?? 0) + 1
      );

      memberLiveCount.set(
        m.member_id,
        (memberLiveCount.get(m.member_id) ?? 0) + 1
      );

      if (!wonLiveInSession.has(session.id)) {
        wonLiveInSession.set(session.id, new Set());
      }
      wonLiveInSession.get(session.id)!.add(m.member_id);
    }

    // Create late dry allocations
    for (const m of lateDryMembers) {
      allAllocations.push({
        member_id: m.member_id,
        session_id: session.id,
        type: "dry",
        gun_id: null,
        gun_clash_warning: null,
        priority_score: m.score,
      });
    }
  }

  // 5. EXCO duty assignment
  const excoDuties = assignExcoDuties({
    sessions: sortedSessions,
    allocations: allAllocations,
    excoMemberIds,
  });

  return {
    allocations: allAllocations,
    excoDuties,
  };
}
