// ──────────────────────────────────────────────
// Algorithm weights
// ──────────────────────────────────────────────

export const WEIGHTS = {
  W1_ATTENDANCE: 1,
  W2_PAST_LIVE_FIRES: 25,
  W3_REQUIREMENTS: 50,
  W4_CURRENT_LIVE_FIRES: 200,
  W5_NO_SHOWS: 100,
  W6_BACK_TO_BACK: 200,
} as const;

// Rolling window for L_past (in weeks)
export const ROLLING_WINDOW_WEEKS = 4;

// ──────────────────────────────────────────────
// Default lane counts
// ──────────────────────────────────────────────

export const DEFAULT_LIVE_LANES = 12;
export const DEFAULT_DRY_LANES = 16;

// ──────────────────────────────────────────────
// Session timing
// ──────────────────────────────────────────────

// Session duration in minutes
export const SESSION_DURATION_MINUTES = 90;

// Submission deadline: Saturday 5:00 PM
export const SUBMISSION_DEADLINE_DAY = 6; // Saturday (0=Sun, 6=Sat)
export const SUBMISSION_DEADLINE_HOUR = 17; // 5 PM

// Results publication: Saturday 8:00 PM
export const RESULTS_PUBLISH_HOUR = 20; // 8 PM

// ──────────────────────────────────────────────
// Gun clash & cancellation
// ──────────────────────────────────────────────

// Gun clash tolerance: max preference levels to drop
export const GUN_CLASH_MAX_DROP = 1;

// Cancellation window (hours before session)
export const CANCELLATION_WINDOW_HOURS = 24;

// ──────────────────────────────────────────────
// Default session templates
// ──────────────────────────────────────────────

export const DEFAULT_WEEKDAY_SESSIONS = [
  { name: "Session 1", time_start: "15:00", time_end: "16:30" },
  { name: "Session 2", time_start: "16:30", time_end: "18:00" },
] as const;

export const DEFAULT_SATURDAY_SESSIONS = [
  { name: "Session 1", time_start: "09:00", time_end: "10:30" },
  { name: "Session 2", time_start: "10:30", time_end: "12:00" },
] as const;

// ──────────────────────────────────────────────
// Display labels
// ──────────────────────────────────────────────

export const DAY_LABELS: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
};

export const TEAM_LABELS: Record<string, string> = {
  APW: "Air Pistol Women",
  APM: "Air Pistol Men",
  ARM: "Air Rifle Men",
  ARW: "Air Rifle Women",
};

// ──────────────────────────────────────────────
// Divisions (derived from member level)
// ──────────────────────────────────────────────

import type { LevelType, DivisionType } from "@/types/database";

export const DIVISION_MAP: Record<LevelType, DivisionType> = {
  JH1: "C",
  JH2: "C",
  JH3: "B",
  JH4: "B",
  SH1: "A",
  SH2: "A",
};

export const DIVISION_LABELS: Record<DivisionType, string> = {
  A: "A Division (SH1-2)",
  B: "B Division (JH3-4)",
  C: "C Division (JH1-2)",
};

export const DIVISIONS: DivisionType[] = ["A", "B", "C"];
