import "server-only";

import { assertSafeFetchTarget } from "@/lib/security/fetch-target";
import { fetchPinnedText } from "@/lib/security/safe-fetch";
import { toDomain } from "../prospeo/people";
import { htmlToText } from "./html-text";

const MAX_TEXT_CHARS = 8_000;

/**
 * Read a company homepage as plain text for AI personalization. Tries the bare
 * domain then www over https, through the SSRF-safe pinned fetch (no redirects,
 * private addresses refused). Returns null when nothing usable comes back.
 */
export async function fetchWebsiteText(
  website: string
): Promise<{ url: string; title: string | null; text: string } | null> {
  const domain = toDomain(website);
  if (!domain) return null;
  const candidates = domain.startsWith("www.")
    ? [`https://${domain}`]
    : [`https://${domain}`, `https://www.${domain}`];

  for (const url of candidates) {
    try {
      const target = await assertSafeFetchTarget(url);
      const res = await fetchPinnedText(target, {
        timeoutMs: 10_000,
        maxBytes: 512_000,
        headers: { "User-Agent": "PulseCRM/1.0 (+lead research)", Accept: "text/html" },
      });
      if (!res.ok) continue;
      const { title, text } = htmlToText(res.text);
      if (text.length < 50) continue;
      return { url, title, text: text.slice(0, MAX_TEXT_CHARS) };
    } catch {
      // Unsafe target, DNS failure or timeout: try the next candidate.
    }
  }
  return null;
}
