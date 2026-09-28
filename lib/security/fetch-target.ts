/**
 * DNS-resolving SSRF guard: validates the URL, resolves its hostname and
 * rejects it if ANY resolved address is private. The returned addresses are
 * meant to be pinned for the actual connection (see safe-fetch.ts) so the
 * check and the connect cannot see different DNS answers.
 */

import dns from "node:dns/promises";
import { isIP } from "node:net";
import { assertSafeFetchUrl, isPrivateHostname } from "./index";

export type ResolvedAddress = { address: string; family: 4 | 6 };
export type LookupFn = (
  host: string,
  opts: { all: true }
) => Promise<Array<{ address: string; family: number }>>;
export type SafeFetchTarget = { url: URL; addresses: ResolvedAddress[] };

function stripBrackets(hostname: string): string {
  return hostname.startsWith("[") && hostname.endsWith("]")
    ? hostname.slice(1, -1)
    : hostname;
}

export async function assertSafeFetchTarget(
  raw: string,
  lookup: LookupFn = dns.lookup
): Promise<SafeFetchTarget> {
  const url = assertSafeFetchUrl(raw);
  const host = stripBrackets(url.hostname);

  const literalFamily = isIP(host);
  if (literalFamily) {
    return { url, addresses: [{ address: host, family: literalFamily as 4 | 6 }] };
  }

  let results: Array<{ address: string; family: number }>;
  try {
    results = await lookup(host, { all: true });
  } catch {
    throw new Error("Hostname could not be resolved");
  }
  if (!Array.isArray(results) || results.length === 0) {
    throw new Error("Hostname could not be resolved");
  }
  if (results.some((r) => isPrivateHostname(r.address))) {
    throw new Error("Hostname resolves to a private address");
  }

  const addresses: ResolvedAddress[] = results.map((r) => ({
    address: r.address,
    family: r.family === 6 ? 6 : 4,
  }));
  return { url, addresses };
}
