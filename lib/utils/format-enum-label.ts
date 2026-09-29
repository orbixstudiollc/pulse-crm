const SPECIAL_LABELS: Record<string, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
  smtp: "SMTP",
  imap: "IMAP",
  custom_imap: "IMAP/SMTP",
};

export function formatEnumLabel(value: string | null | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) return "";

  const special = SPECIAL_LABELS[trimmed.toLowerCase()];
  if (special) return special;

  const spaced = trimmed.replace(/[_-]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
