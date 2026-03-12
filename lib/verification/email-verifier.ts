/**
 * Email Verification Engine
 * MX-record-based verification + disposable domain detection.
 * Pluggable for external providers (ZeroBounce, MillionVerifier, etc.)
 */

import dns from "dns";
import { promisify } from "util";

const resolveMx = promisify(dns.resolveMx);

// ─── Types ───────────────────────────────────────────────────────────────────

export type VerificationStatus = "valid" | "invalid" | "catch_all" | "unknown";

export interface VerificationResult {
  email: string;
  status: VerificationStatus;
  confidence: number; // 0-1
  provider: string;
  details: {
    format_valid: boolean;
    mx_found: boolean;
    is_disposable: boolean;
    is_role_address: boolean;
    domain: string;
  };
}

// ─── Disposable Email Domains ────────────────────────────────────────────────

const DISPOSABLE_DOMAINS = new Set([
  "guerrillamail.com", "mailinator.com", "tempmail.com", "throwaway.email",
  "yopmail.com", "10minutemail.com", "trashmail.com", "sharklasers.com",
  "guerrillamailblock.com", "grr.la", "guerrillamail.info", "guerrillamail.net",
  "spam4.me", "dispostable.com", "temp-mail.org", "fakeinbox.com",
  "mailnesia.com", "maildrop.cc", "discard.email", "tempail.com",
  "mailcatch.com", "harakirimail.com", "jetable.org", "trash-mail.com",
  "getairmail.com", "mytemp.email", "mohmal.com", "emailondeck.com",
  "33mail.com", "mailnull.com", "spamgourmet.com", "safetymail.info",
]);

// ─── Role-Based Addresses ────────────────────────────────────────────────────

const ROLE_PREFIXES = new Set([
  "info", "admin", "support", "help", "contact", "sales", "billing",
  "noreply", "no-reply", "webmaster", "postmaster", "abuse", "security",
  "team", "office", "hello", "general", "enquiries", "feedback",
]);

// ─── Email Format Validation ─────────────────────────────────────────────────

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

function isValidFormat(email: string): boolean {
  if (!email || email.length > 254) return false;
  return EMAIL_REGEX.test(email);
}

// ─── Basic MX Verifier ───────────────────────────────────────────────────────

export async function verifyEmail(email: string): Promise<VerificationResult> {
  const normalized = email.trim().toLowerCase();
  const domain = normalized.split("@")[1] || "";
  const localPart = normalized.split("@")[0] || "";

  const baseResult: VerificationResult = {
    email: normalized,
    status: "unknown",
    confidence: 0,
    provider: "basic_mx",
    details: {
      format_valid: false,
      mx_found: false,
      is_disposable: false,
      is_role_address: false,
      domain,
    },
  };

  // Step 1: Format check
  if (!isValidFormat(normalized)) {
    return { ...baseResult, status: "invalid", confidence: 1.0, details: { ...baseResult.details, format_valid: false } };
  }
  baseResult.details.format_valid = true;

  // Step 2: Disposable domain check
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return {
      ...baseResult,
      status: "invalid",
      confidence: 0.95,
      details: { ...baseResult.details, is_disposable: true },
    };
  }

  // Step 3: Role-based address check
  if (ROLE_PREFIXES.has(localPart)) {
    baseResult.details.is_role_address = true;
    // Role addresses are valid but lower quality
  }

  // Step 4: MX record check
  try {
    const mxRecords = await resolveMx(domain);
    if (mxRecords && mxRecords.length > 0) {
      baseResult.details.mx_found = true;

      // Known catch-all providers
      const catchAllProviders = ["outlook.com", "hotmail.com", "live.com"];
      const isCatchAll = catchAllProviders.some((p) => domain.endsWith(p));

      if (isCatchAll) {
        return {
          ...baseResult,
          status: "catch_all",
          confidence: 0.7,
        };
      }

      // Valid with MX records
      const confidence = baseResult.details.is_role_address ? 0.75 : 0.9;
      return {
        ...baseResult,
        status: "valid",
        confidence,
      };
    }
  } catch {
    // MX lookup failed — domain might not exist
  }

  // No MX records found
  return {
    ...baseResult,
    status: "invalid",
    confidence: 0.8,
    details: { ...baseResult.details, mx_found: false },
  };
}

// ─── Bulk Verification ───────────────────────────────────────────────────────

export async function verifyBulk(
  emails: string[],
  options?: { concurrency?: number },
): Promise<VerificationResult[]> {
  const concurrency = options?.concurrency ?? 10;
  const results: VerificationResult[] = [];

  // Process in batches
  for (let i = 0; i < emails.length; i += concurrency) {
    const batch = emails.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(verifyEmail));

    for (const result of batchResults) {
      if (result.status === "fulfilled") {
        results.push(result.value);
      } else {
        results.push({
          email: batch[results.length - (i > 0 ? i : 0)] || "unknown",
          status: "unknown",
          confidence: 0,
          provider: "basic_mx",
          details: {
            format_valid: false,
            mx_found: false,
            is_disposable: false,
            is_role_address: false,
            domain: "",
          },
        });
      }
    }
  }

  return results;
}

// ─── Stats Helper ────────────────────────────────────────────────────────────

export function summarizeResults(results: VerificationResult[]) {
  return {
    total: results.length,
    valid: results.filter((r) => r.status === "valid").length,
    invalid: results.filter((r) => r.status === "invalid").length,
    catch_all: results.filter((r) => r.status === "catch_all").length,
    unknown: results.filter((r) => r.status === "unknown").length,
    avg_confidence: results.reduce((sum, r) => sum + r.confidence, 0) / (results.length || 1),
  };
}
