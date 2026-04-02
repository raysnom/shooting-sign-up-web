// ──────────────────────────────────────────────
// Enum types (string literal unions)
// ──────────────────────────────────────────────

export type TeamType = "APW" | "APM" | "ARM" | "ARW";
export type LevelType = "JH1" | "JH2" | "JH3" | "JH4" | "SH1" | "SH2";
export type RoleType = "member" | "exco" | "president";
export type DayType = "mon" | "tue" | "wed" | "thu" | "fri" | "sat";
export type AttendanceStatus = "present" | "absent" | "vr" | "no_show";
export type WeekStatus = "open" | "closed" | "drafting" | "drafted" | "published";
export type AllocationType = "live" | "dry";
export type DivisionType = "A" | "B" | "C";
export type TrainingTargetType = "team" | "individual" | "division" | "group";
export type GunTypeEnum = "air_pistol" | "air_rifle" | "individual";

// ──────────────────────────────────────────────
// Row types (what you get back from a SELECT)
// ──────────────────────────────────────────────

export type Semester = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  created_by: string;
  created_at: string;
};

export type Gun = {
  id: string;
  name: string;
  type: GunTypeEnum;
  created_at: string;
};

export type Member = {
  id: string;
  login_id: string;
  name: string;
  email: string;
  team: TeamType;
  level: LevelType;
  role: RoleType;
  gun_id: string | null;
  no_show_count: number;
  archived: boolean;
  created_at: string;
};

export type SessionTemplate = {
  id: string;
  name: string;
  day: DayType;
  time_start: string;
  time_end: string;
  live_lanes: number;
  dry_lanes: number;
  created_at: string;
};

export type Week = {
  id: string;
  semester_id: string;
  start_date: string;
  end_date: string;
  submission_deadline: string;
  results_published_at: string | null;
  status: WeekStatus;
  created_by: string;
  created_at: string;
  max_live_per_member: number | null;
};

export type Session = {
  id: string;
  week_id: string;
  template_id: string | null;
  name: string;
  day: DayType;
  time_start: string;
  time_end: string;
  live_lanes: number;
  dry_lanes: number;
  is_cancelled: boolean;
  created_at: string;
};

export type Preference = {
  id: string;
  member_id: string;
  week_id: string;
  session_id: string;
  rank: number;
  created_at: string;
};

export type Allocation = {
  id: string;
  member_id: string;
  session_id: string;
  week_id: string;
  type: AllocationType;
  gun_id: string | null;
  gun_clash_warning: string | null;
  priority_score: number;
  cancelled: boolean;
  cancelled_at: string | null;
  created_at: string;
};

export type Attendance = {
  id: string;
  member_id: string;
  session_id: string;
  week_id: string;
  status: AttendanceStatus;
  reason: string | null;
  marked_by: string | null;
  created_at: string;
};

export type TrainingRequirement = {
  id: string;
  week_id: string;
  target_type: TrainingTargetType;
  target_value: string;
  min_sessions: number;
  created_at: string;
};

export type ExcoDuty = {
  id: string;
  session_id: string;
  week_id: string;
  member_id: string;
  created_at: string;
};

export type CompetitionGroup = {
  id: string;
  name: string;
  created_by: string | null;
  created_at: string;
};

export type CompetitionGroupMember = {
  id: string;
  group_id: string;
  member_id: string;
  created_at: string;
};

export type SpecialEvent = {
  id: string;
  week_id: string;
  name: string;
  event_date: string;
  created_by: string | null;
  created_at: string;
};

export type SpecialEventAttendance = {
  id: string;
  special_event_id: string;
  member_id: string;
  created_at: string;
};

// ──────────────────────────────────────────────
// Joined / extended types
// ──────────────────────────────────────────────

export type MemberWithGun = Member & {
  gun: Gun | null;
};
