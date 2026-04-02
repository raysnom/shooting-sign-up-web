const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidUUID(value: string): boolean {
  return UUID_REGEX.test(value);
}

export function requireUUID(value: string, label = "ID"): string | null {
  if (!isValidUUID(value)) return `Invalid ${label}.`;
  return null;
}

export function requireUUIDs(
  values: Record<string, string>,
): string | null {
  for (const [label, value] of Object.entries(values)) {
    const err = requireUUID(value, label);
    if (err) return err;
  }
  return null;
}

export function sanitizeDbError(error: { message: string }): string {
  const msg = error.message;
  if (msg.includes("duplicate key")) return "A record with that value already exists.";
  if (msg.includes("violates foreign key")) return "Referenced record does not exist.";
  if (msg.includes("violates not-null")) return "A required field is missing.";
  if (msg.includes("violates check")) return "A field value is out of range.";
  return "An unexpected error occurred. Please try again.";
}
