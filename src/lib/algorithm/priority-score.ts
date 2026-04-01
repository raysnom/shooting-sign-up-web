import { WEIGHTS } from "@/lib/constants";

/**
 * Calculate the priority score for a member requesting a session slot.
 *
 * Formula:
 *   Priority_Score = (W1 * A) - (W2 * L_past) - (W4 * L_current)
 *                  + (W3 * P) + (W6 * B) - (W5 * N)
 *
 * Where P = max(0, required_sessions - attended_sessions)
 * (the "requirement gap" — how many more sessions the member needs)
 *
 * Higher score = higher priority for live fire allocation.
 */
export function calculatePriorityScore(params: {
  attendance: number;
  pastLiveFires: number;
  currentLiveFires: number;
  requirementGap: number;
  isBackToBack: boolean;
  noShowCount: number;
}): number {
  const {
    attendance,
    pastLiveFires,
    currentLiveFires,
    requirementGap,
    isBackToBack,
    noShowCount,
  } = params;

  const A = attendance;
  const L_past = pastLiveFires;
  const L_current = currentLiveFires;
  const P = Math.max(0, requirementGap);
  const B = isBackToBack ? 1 : 0;
  const N = noShowCount;

  return (
    WEIGHTS.W1_ATTENDANCE * A -
    WEIGHTS.W2_PAST_LIVE_FIRES * L_past -
    WEIGHTS.W4_CURRENT_LIVE_FIRES * L_current +
    WEIGHTS.W3_REQUIREMENTS * P +
    WEIGHTS.W6_BACK_TO_BACK * B -
    WEIGHTS.W5_NO_SHOWS * N
  );
}
