/**
 * Fetch a pre-validated SafeFetchTarget with its resolved addresses pinned,
 * so DNS cannot be re-resolved to a private address between check and
 * connect. Redirects are never followed and the body is size-capped.
 */

import type { LookupFunction } from "node:net";
import { Agent, fetch as undiciFetch } from "undici";
import type { SafeFetchTarget } from "./fetch-target";

export const SAFE_FETCH_MAX_BYTES = 1_048_576;
const DEFAULT_TIMEOUT_MS = 10_000;

export async function fetchPinnedText(
  target: SafeFetchTarget,
  opts?: { headers?: Record<string, string>; timeoutMs?: number; maxBytes?: number }
): Promise<{ status: number; ok: boolean; text: string }> {
  const maxBytes = opts?.maxBytes ?? SAFE_FETCH_MAX_BYTES;

  // Node's net.connect calls lookup with `all: true` under autoSelectFamily;
  // both the list form and the single-address form must be supported.
  const lookup = ((_host, options, cb) =>
    options?.all
      ? cb(
          null,
          target.addresses.map((a) => ({ address: a.address, family: a.family }))
        )
      : cb(null, target.addresses[0].address, target.addresses[0].family)) as LookupFunction;

  const agent = new Agent({ connect: { lookup } });
  try {
    const res = await undiciFetch(target.url, {
      dispatcher: agent,
      redirect: "manual",
      signal: AbortSignal.timeout(opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS),
      headers: opts?.headers,
    });

    const chunks: Uint8Array[] = [];
    let total = 0;
    if (res.body) {
      const reader = res.body.getReader();
      while (total < maxBytes) {
        const { done, value } = await reader.read();
        if (done) break;
        const remaining = maxBytes - total;
        const chunk = value.byteLength > remaining ? value.subarray(0, remaining) : value;
        chunks.push(chunk);
        total += chunk.byteLength;
      }
      if (total >= maxBytes) await reader.cancel().catch(() => undefined);
    }

    const text = new TextDecoder("utf-8").decode(Buffer.concat(chunks, total));
    return { status: res.status, ok: res.ok, text };
  } finally {
    await agent.close();
  }
}
