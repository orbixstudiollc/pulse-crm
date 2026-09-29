/**
 * SMTP/IMAP endpoint validation for user-configured mail accounts. Applied at
 * write time (DNS-checked), and at test/send time (sync host + port check) so
 * a stored config cannot be used to reach internal hosts or arbitrary ports.
 */

import { isIP } from "node:net";
import { isPrivateHostname } from "@/lib/security";
import { assertSafeFetchTarget, type LookupFn } from "@/lib/security/fetch-target";

export const SMTP_PORTS = [25, 465, 587, 2525] as const;
export const IMAP_PORTS = [143, 993] as const;

const LABEL_RE = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;

export function isAllowedSmtpPort(port: unknown): boolean {
  return typeof port === "number" && (SMTP_PORTS as readonly number[]).includes(port);
}

export function isAllowedImapPort(port: unknown): boolean {
  return typeof port === "number" && (IMAP_PORTS as readonly number[]).includes(port);
}

export function isValidMailHostname(host: string): boolean {
  if (typeof host !== "string" || host.length < 1 || host.length > 253) return false;
  const h = host.toLowerCase();
  if (isPrivateHostname(h)) return false;
  if (isIP(h)) return true;

  const labels = h.split(".");
  if (labels.length < 2 || !labels.every((l) => LABEL_RE.test(l))) return false;
  // A numeric last label is a shorthand IP ("127.1"), never a real TLD
  return !/^\d+$/.test(labels[labels.length - 1]);
}

export async function assertSafeMailHost(host: string, lookup?: LookupFn): Promise<void> {
  if (!isValidMailHostname(host)) throw new Error("Invalid mail server host");
  const urlHost = isIP(host) === 6 ? `[${host}]` : host;
  await assertSafeFetchTarget("https://" + urlHost, lookup);
}

export function sanitizeMailConfig(
  cfg: unknown
): { host: string; port: number; secure: boolean; username: string } | null {
  if (!cfg || typeof cfg !== "object" || Array.isArray(cfg)) return null;
  const { host, port, secure, username } = cfg as Record<string, unknown>;
  if (typeof host !== "string" || typeof port !== "number") return null;
  return {
    host,
    port,
    secure: secure === true,
    username: typeof username === "string" ? username : "",
  };
}

export function isSafeMailEndpoint(host: unknown, port: unknown, kind: "smtp" | "imap"): boolean {
  if (typeof host !== "string" || !isValidMailHostname(host)) return false;
  return kind === "smtp" ? isAllowedSmtpPort(port) : isAllowedImapPort(port);
}
