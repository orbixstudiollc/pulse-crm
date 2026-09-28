/**
 * Centralized environment-variable accessors with consistent naming and
 * graceful fallbacks for legacy var names.
 *
 * Preferred names (document in `.env.example`):
 *   - APIFY_API_TOKEN    ← primary
 *   - CRON_SECRET
 *   - OPENROUTER_API_KEY
 *   - ANTHROPIC_API_KEY
 *   - PULSE_CRM_API_KEY
 *   - EMAIL_WEBHOOK_SECRET
 *   - WHATSAPP_APP_SECRET / WHATSAPP_VERIFY_TOKEN
 *
 * Legacy fallbacks kept for backward compatibility only. Remove once all
 * environments are migrated.
 */

// Re-exported from the canonical Lead Finder helper so that there is exactly
// one implementation of the Apify env-var fallback chain in the codebase.
// New code should import from "@/lib/lead-finder/apify/token" directly.
export { getApifyTokenFromEnv } from "@/lib/lead-finder/apify/token";

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}
