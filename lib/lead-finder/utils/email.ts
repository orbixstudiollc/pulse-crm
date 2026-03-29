// =============================================================================
// Email utilities – pure functions, no DB calls
// =============================================================================

const EMAIL_REGEX =
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

/** Generic / role-based prefixes that are usually not useful as lead emails. */
const GENERIC_PREFIXES = new Set([
  "info",
  "contact",
  "hello",
  "support",
  "admin",
  "noreply",
  "no-reply",
  "webmaster",
  "postmaster",
  "sales",
  "marketing",
  "help",
  "service",
  "team",
  "office",
  "mail",
  "enquiries",
  "inquiries",
  "feedback",
  "billing",
  "abuse",
  "privacy",
  "security",
  "legal",
  "hr",
  "jobs",
  "careers",
  "press",
  "media",
]);

/** Throwaway / temporary email domains. */
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "tempmail.com",
  "throwaway.email",
  "yopmail.com",
  "sharklasers.com",
  "maildrop.cc",
  "dispostable.com",
  "10minutemail.com",
  "trashmail.com",
  "temp-mail.org",
  "fakeinbox.com",
]);

/**
 * Extract all email addresses from a block of text.
 */
export function extractEmailsFromText(text: string): string[] {
  if (!text) return [];
  const matches = text.match(EMAIL_REGEX);
  if (!matches) return [];

  // Deduplicate and lowercase
  return [...new Set(matches.map((e) => e.toLowerCase()))];
}

/**
 * Check if an email looks like a real, personal/business email.
 * Returns false for generic role addresses and disposable domains.
 */
export function isQualityEmail(email: string): boolean {
  if (!email) return false;

  const lower = email.toLowerCase().trim();
  const atIndex = lower.indexOf("@");
  if (atIndex === -1) return false;

  const prefix = lower.slice(0, atIndex);
  const domain = lower.slice(atIndex + 1);

  // Reject generic prefixes
  if (GENERIC_PREFIXES.has(prefix)) return false;

  // Reject disposable domains
  if (DISPOSABLE_DOMAINS.has(domain)) return false;

  // Reject obviously fake patterns
  if (prefix.includes("test") || prefix.includes("example")) return false;

  // Check for common freemail (not necessarily bad, but lower quality for B2B)
  // We don't reject these outright, but they can be used for scoring

  return true;
}

/**
 * Check if an email is from a free email provider (gmail, yahoo, etc.).
 */
export function isFreemailDomain(email: string): boolean {
  if (!email) return false;

  const domain = email.toLowerCase().split("@")[1];
  if (!domain) return false;

  const freemailDomains = new Set([
    "gmail.com",
    "yahoo.com",
    "yahoo.co.uk",
    "hotmail.com",
    "outlook.com",
    "live.com",
    "aol.com",
    "icloud.com",
    "me.com",
    "mac.com",
    "protonmail.com",
    "proton.me",
    "zoho.com",
    "mail.com",
    "yandex.com",
    "gmx.com",
    "gmx.net",
    "fastmail.com",
    "tutanota.com",
  ]);

  return freemailDomains.has(domain);
}

/**
 * Extract the domain from an email address.
 */
export function getEmailDomain(email: string): string | null {
  if (!email) return null;
  const parts = email.toLowerCase().split("@");
  return parts.length === 2 ? parts[1] : null;
}

/**
 * Validate basic email format.
 */
export function isValidEmailFormat(email: string): boolean {
  if (!email) return false;
  // Simple but effective validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
