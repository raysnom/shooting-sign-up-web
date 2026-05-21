/**
 * Shared date/time formatting helpers.
 *
 * Convention (per CLAUDE.md):
 *  - All dates render as DD/MM/YY (e.g. "21/05/26").
 *  - All times render in 12-hour format with AM/PM (e.g. "2:00 PM").
 *  - All output is in Singapore Time (SGT, UTC+8) via the "en-SG" locale.
 *
 * Important: when a date-only string ("YYYY-MM-DD") is parsed via `new Date(s)`,
 * the spec interprets it as UTC midnight. In SGT (UTC+8) that's still the same
 * calendar date, but the safer pattern is to append "T00:00:00" so the runtime
 * treats it as local-time midnight, sidestepping any timezone-edge bugs.
 */
const LOCALE = "en-SG";

/**
 * Format a date as DD/MM/YY.
 *
 * Accepts either a date-only string ("YYYY-MM-DD") or a full ISO timestamp.
 * Date-only inputs are parsed as local-time midnight to avoid UTC offset issues.
 */
export function formatDate(input: string | Date): string {
  const d = toDate(input);
  return d.toLocaleDateString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

/**
 * Format a time string ("HH:MM" or "HH:MM:SS") as a 12-hour clock with AM/PM.
 */
export function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

/**
 * Format a full timestamp as DD/MM/YY, h:mm AM/PM (SGT).
 *
 * Use for audit timestamps, "created at" labels, or any combined date+time display.
 */
export function formatDateTime(input: string | Date): string {
  const d = toDate(input);
  return d.toLocaleString(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format a submission deadline as DD/MM/YY, h:mm AM/PM (SGT).
 *
 * Identical to formatDateTime; kept as a named export so deadline call sites
 * read clearly at point of use.
 */
export function formatDeadline(input: string | Date): string {
  return formatDateTime(input);
}

// ──────────────────────────────────────────────
// Internal
// ──────────────────────────────────────────────

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function toDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  // Treat bare YYYY-MM-DD as local-time midnight, not UTC midnight.
  if (DATE_ONLY_RE.test(input)) return new Date(`${input}T00:00:00`);
  return new Date(input);
}
