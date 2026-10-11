import type { SupabaseClient } from "@supabase/supabase-js";

export type TwentyDB = SupabaseClient;
export type TwentyObject =
  | "person" | "company" | "opportunity" | "task" | "note" | "icpProfile"
  | "inboxItem" | "proposal" | "agencyService" | "mailbox" | "sequence"
  | "sequenceStep" | "sequenceEnrollment" | "campaign" | "emailTemplate" | "clientEmail";

export type TwentyRecord = { id: string; updatedAt: string; [key: string]: unknown };
export type TwentyListResult = { records: TwentyRecord[]; endCursor: string | null; hasNextPage: boolean };
export type TwentyCutoverAudit = {
  reviewedAt: string;
  reviewedBy: string;
  coveredObjects: TwentyObject[];
  nativeTriggers: { id: string; name: string; resolution: "paused" | "non_overlapping"; evidence: string }[];
  verifiedNoUnexpectedEffects: boolean;
  coverageEvidence: string;
  conditionalUpdateEvidence: { recordId: string; returnedOne: boolean; staleRejected: boolean; evidence: string };
};
export type TwentyConnectionMetadata = {
  id: string;
  organization_id: string;
  owner_id: string;
  workspace_url: string;
  workspace_id: string;
  revision: number;
  status: "verified" | "revoked";
  cas_verified: boolean;
  writes_enabled: boolean;
  cutover_audit: TwentyCutoverAudit | null;
  monthly_token_cap: number | null;
  verified_at: string;
  created_at?: string;
  updated_at?: string;
};
/** Never serialize a runtime connection to a browser or model. */
export type TwentyConnection = TwentyConnectionMetadata & { apiKey: string };
export type TwentyEmailInput = {
  connectedAccountId: string;
  fromHandle: string;
  recipients: string[];
  subject: string;
  body: string;
};
