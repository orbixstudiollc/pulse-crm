export const WORKFLOW_KINDS = ["company_link", "mailbox_ready", "qualification"] as const;
export type WorkflowKind = (typeof WORKFLOW_KINDS)[number];
export type JobKind = WorkflowKind | "quick_lead";
export type JobStatus = "queued" | "running" | "awaiting_approval" | "applied" | "denied" | "stale" | "failed" | "unknown_outcome" | "partial" | "skipped";
export type Checkpoint = {
  initialized?: boolean;
  baselineStartedAt?: string;
  updatedAfter?: string;
  after?: string | null;
  highWater?: string;
};
export type TwentyWorkflow = {
  id: string;
  organization_id: string;
  connection_id: string;
  connection_revision: number;
  owner_id: string;
  kind: WorkflowKind;
  enabled: boolean;
  config: Record<string, unknown>;
  checkpoint: Checkpoint;
  lease_token: string | null;
  lease_until: string | null;
};
export type TwentyJob = {
  id: string;
  organization_id: string;
  connection_id: string;
  connection_revision: number;
  workflow_id: string | null;
  owner_id: string;
  kind: JobKind;
  record_id: string | null;
  record_version: string | null;
  payload: Record<string, unknown>;
  status: JobStatus;
  attempts: number;
  lease_token: string | null;
  lease_until: string | null;
  approval_id: string | null;
};

const PERSONAL_DOMAINS = new Set(["gmail.com", "googlemail.com", "outlook.com", "hotmail.com", "live.com", "yahoo.com", "icloud.com", "aol.com", "proton.me", "protonmail.com", "mail.com"]);
export function businessEmailDomain(email: unknown): string | null {
  if (typeof email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const domain = email.split("@")[1].toLowerCase();
  return PERSONAL_DOMAINS.has(domain) || isFreemailDomain(email) ? null : domain;
}
export function mailboxIsReady(record: Record<string, unknown>): boolean {
  return record.status === "ACTIVE" && typeof record.healthScore === "number" && record.healthScore >= 90
    && typeof record.spamPlacementRate === "number" && record.spamPlacementRate <= 0.1;
}
export function retryDelay(attempt: number): number {
  return Math.min(3_600_000, 30_000 * 2 ** Math.max(0, attempt - 1));
}
export function normalizeQuickLeadInput(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid Quick Lead input");
  const normalized: Record<string, unknown> = { ...value };
  for (const key of ["jobTitle", "companyName", "companyDomain"]) {
    if (typeof normalized[key] === "string" && !normalized[key].trim()) delete normalized[key];
  }
  return normalized;
}
export function recordVersion(record: Record<string, unknown>): string {
  if (typeof record.id !== "string" || typeof record.updatedAt !== "string" || !Number.isFinite(Date.parse(record.updatedAt))) {
    throw new Error("Twenty record has no valid version");
  }
  const fraction = /\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/.exec(record.updatedAt)?.[1] ?? "";
  return new Date(record.updatedAt).toISOString().replace(/\.\d{3}Z$/, `.${fraction.padEnd(3, "0")}Z`);
}
/** PostgREST and GraphQL use different timezone/fraction formatting. Preserve sub-ms precision. */
export function sameRecordVersion(left: unknown, right: unknown): boolean {
  if (typeof left !== "string" || typeof right !== "string") return false;
  const key = (value: string) => {
    if (!Number.isFinite(Date.parse(value))) return null;
    const fraction = /\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/.exec(value)?.[1] ?? "";
    return new Date(value).toISOString().slice(0, 19) + "." + fraction.padEnd(6, "0");
  };
  const a = key(left); return a !== null && a === key(right);
}
import { isFreemailDomain } from "@/lib/lead-finder/utils/email";
