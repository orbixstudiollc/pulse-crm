/**
 * Pure merge-variable substitution (no Supabase or Next.js imports).
 */

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Replace {{key}} tokens with context values in a single pass, so inserted
 * values are never re-interpreted as template syntax. With `html: true`, each
 * substituted value is HTML-escaped; the authored template markup is untouched.
 */
export function substituteVariables(
  template: string,
  context: Record<string, unknown>,
  opts?: { html?: boolean },
): string {
  return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_match, key: string) => {
    const value = context[key];
    if (value == null || value === "") return "";
    return opts?.html ? escapeHtml(String(value)) : String(value);
  });
}
