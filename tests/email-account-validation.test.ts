// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  assertSafeMailHost,
  isAllowedImapPort,
  isAllowedSmtpPort,
  isSafeMailEndpoint,
  isValidMailHostname,
  sanitizeMailConfig,
} from "@/lib/email/account-validation";
import type { LookupFn } from "@/lib/security/fetch-target";

function lookupTo(address: string): LookupFn {
  return async () => [{ address, family: 4 }];
}

describe("mail port allowlists", () => {
  it("accepts allowed SMTP ports and rejects others", () => {
    expect(isAllowedSmtpPort(587)).toBe(true);
    expect(isAllowedSmtpPort(8080)).toBe(false);
    expect(isAllowedSmtpPort("587")).toBe(false);
  });

  it("accepts allowed IMAP ports and rejects others", () => {
    expect(isAllowedImapPort(993)).toBe(true);
    expect(isAllowedImapPort(25)).toBe(false);
  });
});

describe("isValidMailHostname", () => {
  it("accepts a public mail hostname", () => {
    expect(isValidMailHostname("smtp.gmail.com")).toBe(true);
  });

  it.each(["localhost", "127.0.0.1", "169.254.169.254", "10.1.2.3", "mail.local", "127.1", ""])(
    "rejects %s",
    (host) => {
      expect(isValidMailHostname(host)).toBe(false);
    }
  );
});

describe("assertSafeMailHost", () => {
  it("rejects a hostname resolving to loopback", async () => {
    await expect(assertSafeMailHost("smtp.example.com", lookupTo("127.0.0.1"))).rejects.toThrow();
  });

  it("resolves for a hostname resolving to a public address", async () => {
    await expect(
      assertSafeMailHost("smtp.example.com", lookupTo("142.250.1.1"))
    ).resolves.toBeUndefined();
  });

  it("rejects an invalid hostname without resolving it", async () => {
    await expect(assertSafeMailHost("localhost", lookupTo("142.250.1.1"))).rejects.toThrow();
  });
});

describe("sanitizeMailConfig", () => {
  it("strips password_encrypted and unknown keys", () => {
    const out = sanitizeMailConfig({
      host: "smtp.gmail.com",
      port: 587,
      secure: false,
      username: "me@example.com",
      password_encrypted: "secret",
      extra: 1,
    });
    expect(out).toEqual({ host: "smtp.gmail.com", port: 587, secure: false, username: "me@example.com" });
    expect(out).not.toHaveProperty("password_encrypted");
  });

  it.each([null, undefined, "str", 42, []])("returns null for %s", (cfg) => {
    expect(sanitizeMailConfig(cfg)).toBeNull();
  });
});

describe("isSafeMailEndpoint", () => {
  it("accepts a public host on an allowed port", () => {
    expect(isSafeMailEndpoint("smtp.gmail.com", 587, "smtp")).toBe(true);
  });

  it("rejects a private host", () => {
    expect(isSafeMailEndpoint("10.0.0.5", 587, "smtp")).toBe(false);
  });

  it("rejects a port not allowed for the kind", () => {
    expect(isSafeMailEndpoint("imap.gmail.com", 587, "imap")).toBe(false);
  });
});
