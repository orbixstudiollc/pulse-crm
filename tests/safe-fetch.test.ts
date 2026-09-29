// @vitest-environment node
import http from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { fetch as undiciFetch } from "undici";
import {
  SAFE_FETCH_MAX_BYTES,
  createPinnedFetch,
  fetchPinnedText,
} from "@/lib/security/safe-fetch";

const BIG_BODY_BYTES = 3 * 1024 * 1024;

let server: http.Server;
let port: number;

beforeAll(async () => {
  server = http.createServer((req, res) => {
    if (req.url === "/big") {
      res.writeHead(200, { "content-type": "text/plain" });
      res.end("a".repeat(BIG_BODY_BYTES));
      return;
    }
    if (req.url === "/hang") return; // never respond
    if (req.url === "/redirect") {
      res.writeHead(302, { location: "/" });
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "text/plain" });
    res.end("hello pinned");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  port = (server.address() as AddressInfo).port;
});

afterAll(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

function target(path = "/") {
  return {
    url: new URL(`http://pinned.invalid:${port}${path}`),
    addresses: [{ address: "127.0.0.1", family: 4 as const }],
  };
}

describe("fetchPinnedText", () => {
  it("connects to the pinned address even though the hostname never resolves", async () => {
    const res = await fetchPinnedText(target());
    expect(res.status).toBe(200);
    expect(res.ok).toBe(true);
    expect(res.text).toBe("hello pinned");
  });

  it("control: an unpinned fetch of the same hostname fails", async () => {
    await expect(undiciFetch(`http://pinned.invalid:${port}/`)).rejects.toThrow();
  });

  it("truncates bodies to SAFE_FETCH_MAX_BYTES", async () => {
    const res = await fetchPinnedText(target("/big"));
    expect(res.status).toBe(200);
    expect(Buffer.byteLength(res.text, "utf8")).toBe(SAFE_FETCH_MAX_BYTES);
  });

  it("rejects when the server never responds within timeoutMs", async () => {
    await expect(fetchPinnedText(target("/hang"), { timeoutMs: 300 })).rejects.toThrow();
  });

  it("returns redirects as-is without following them", async () => {
    const res = await fetchPinnedText(target("/redirect"));
    expect(res.status).toBe(302);
    expect(res.text).toBe("");
  });
});

describe("createPinnedFetch", () => {
  const exampleTarget = {
    url: new URL("http://example.com"),
    addresses: [{ address: "93.184.216.34", family: 4 as const }],
  };

  it("rejects a URL on a different host without touching the network", async () => {
    const pinned = createPinnedFetch(exampleTarget);
    try {
      await expect(pinned.fetch("http://169.254.169.254/latest/meta-data")).rejects.toThrow(
        "Pinned fetch: host mismatch"
      );
    } finally {
      await pinned.close();
    }
  });

  it("close() resolves", async () => {
    const pinned = createPinnedFetch(exampleTarget);
    await expect(pinned.close()).resolves.toBeUndefined();
  });
});
