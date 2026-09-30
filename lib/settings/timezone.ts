const LEGACY_TIMEZONE_CODES: Record<string, string> = {
  pt: "America/Los_Angeles",
  mt: "America/Denver",
  ct: "America/Chicago",
  et: "America/New_York",
  utc: "UTC",
  gmt: "UTC",
};

/** Maps legacy short timezone codes to IANA zones; blank values use the fallback. */
export function normalizeTimezone(
  value: string | null | undefined,
  fallback: string,
): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  return LEGACY_TIMEZONE_CODES[trimmed.toLowerCase()] ?? trimmed;
}
