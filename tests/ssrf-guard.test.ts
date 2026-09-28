// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertSafeFetchUrl, isPrivateHostname } from "@/lib/security";
import { assertSafeFetchTarget, type LookupFn } from "@/lib/security/fetch-target";

describe("assertSafeFetchUrl", () => {
  it.each([
    "http://[::ffff:127.0.0.1]/",
    "http://[::ffff:169.254.169.254]/",
    "http://[::ffff:7f00:1]/",
    "http://[::ffff:5db8:d822]/",
    "http://[fd00::1]/",
    "http://[fe80::1]/",
    "http://[::]/",
    "http://[::1]/",
    "http://127.0.0.1/",
    "http://10.0.0.1/",
    "http://169.254.169.254/",
    "http://172.16.0.1/",
    "http://192.168.1.1/",
    "http://100.64.0.1/",
    "http://0.0.0.0/",
    "http://2130706433/",
    "http://0x7f000001/",
    "http://localhost/",
    "http://localhost./",
    "http://foo.localhost/",
    "ftp://example.com/",
    "javascript:alert(1)",
  ])("rejects %s", (raw) => {
    expect(() => assertSafeFetchUrl(raw)).toThrow();
  });

  it.each([
    "https://example.com/",
    "http://93.184.216.34/",
    "http://[2606:2800:220:1:248:1893:25c8:1946]/",
  ])("allows %s", (raw) => {
    expect(assertSafeFetchUrl(raw)).toBeInstanceOf(URL);
  });
});

describe("isPrivateHostname", () => {
  it.each([
    "[::ffff:a9fe:a9fe]",
    "::ffff:169.254.169.254",
    "fe80::1%25eth0",
    "FD00::1",
    "localhost.",
  ])("treats %s as private", (host) => {
    expect(isPrivateHostname(host)).toBe(true);
  });
});

function fakeLookup(
  table: Record<string, Array<{ address: string; family: number }>>
): LookupFn {
  return async (host) => table[host] ?? [];
}

describe("assertSafeFetchTarget", () => {
  it.each([
    ["localtest.me", "127.0.0.1"],
    ["metadata.google.internal", "169.254.169.254"],
    ["127.0.0.1.nip.io", "127.0.0.1"],
  ])("rejects %s resolving to %s", async (host, address) => {
    const lookup = fakeLookup({ [host]: [{ address, family: 4 }] });
    await expect(assertSafeFetchTarget(`http://${host}/`, lookup)).rejects.toThrow(
      "Hostname resolves to a private address"
    );
  });

  it("rejects when ANY resolved address is private", async () => {
    const lookup = fakeLookup({
      "mixed.example": [
        { address: "93.184.216.34", family: 4 },
        { address: "::ffff:10.0.0.1", family: 6 },
      ],
    });
    await expect(assertSafeFetchTarget("http://mixed.example/", lookup)).rejects.toThrow(
      "Hostname resolves to a private address"
    );
  });

  it("passes a public resolution and returns url + addresses", async () => {
    const lookup = fakeLookup({ "example.com": [{ address: "93.184.216.34", family: 4 }] });
    const target = await assertSafeFetchTarget("https://example.com/path", lookup);
    expect(target.url.href).toBe("https://example.com/path");
    expect(target.addresses).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });

  it("rejects when lookup throws", async () => {
    const lookup: LookupFn = async () => {
      throw new Error("ENOTFOUND");
    };
    await expect(assertSafeFetchTarget("http://nowhere.example/", lookup)).rejects.toThrow(
      "Hostname could not be resolved"
    );
  });

  it("rejects when lookup returns no addresses", async () => {
    await expect(assertSafeFetchTarget("http://empty.example/", fakeLookup({}))).rejects.toThrow(
      "Hostname could not be resolved"
    );
  });

  it("uses an IP literal directly without a lookup", async () => {
    const lookup: LookupFn = async () => {
      throw new Error("should not be called");
    };
    const target = await assertSafeFetchTarget("http://93.184.216.34/", lookup);
    expect(target.addresses).toEqual([{ address: "93.184.216.34", family: 4 }]);
  });
});
