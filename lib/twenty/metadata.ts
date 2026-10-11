import type { TwentyObject } from "./types";
export type { TwentyObject } from "./types";

type ObjectPolicy = { plural: string; fields: readonly string[]; writable: readonly string[]; search: string[] };
const base = ["id", "createdAt", "updatedAt", "createdBy", "updatedBy"];
function policy(plural: string, fields: string[], writable: string[], search = ["name"]): ObjectPolicy {
  return { plural, fields: [...base, ...fields], writable, search };
}

/** The deployed schema can narrow these policies, never broaden them. */
export const TWENTY_OBJECTS: Record<TwentyObject, ObjectPolicy> = {
  person: policy("people", ["name", "emails", "phones", "jobTitle", "linkedinLink", "location", "companyId", "leadScore", "leadStatus", "icpGrade", "aiSummary", "qualificationStatus", "qualificationNotes", "qualificationVersion", "emailVerificationStatus", "titleClassification", "titleConfidence", "titleCategory", "titleClassificationReason", "leadSource"], ["name", "emails", "jobTitle", "companyId", "leadScore", "leadStatus", "icpGrade", "aiSummary", "qualificationStatus", "qualificationNotes", "qualificationVersion", "titleClassification", "titleConfidence", "titleCategory", "titleClassificationReason"], ["name", "emails"]),
  company: policy("companies", ["name", "domainName", "industry", "headcountRange", "agencyClassification", "agencyConfidence", "agencyType", "websiteResearch", "websiteResearchAt", "classificationModel", "classificationReason"], ["name", "domainName", "industry", "headcountRange", "agencyClassification", "agencyConfidence", "agencyType", "websiteResearch", "websiteResearchAt", "classificationModel", "classificationReason"]),
  opportunity: policy("opportunities", ["name", "amount", "closeDate", "stage", "personId", "companyId"], ["name", "amount", "closeDate", "stage", "personId", "companyId"]),
  task: policy("tasks", ["title", "bodyV2", "dueAt", "status"], ["title", "bodyV2", "dueAt", "status"], ["title"]),
  note: policy("notes", ["title", "bodyV2"], ["title", "bodyV2"], ["title"]),
  icpProfile: policy("icpProfiles", ["name", "description", "jobTitles", "industries", "locations", "headcount", "isActive"], []),
  inboxItem: policy("inboxItems", ["subject", "snippet", "fromEmail", "receivedAt", "status", "mailboxEmail", "kind", "messageId", "triagedAt", "replyIntent", "draftReply", "aiSummary"], ["status", "triagedAt", "replyIntent", "draftReply", "aiSummary"], ["subject", "fromEmail"]),
  proposal: policy("proposals", ["name", "status", "summary", "body", "amount", "services", "personId", "companyId", "sentAt", "viewedAt", "respondedAt"], ["name", "summary", "body", "amount", "services", "personId", "companyId"]),
  agencyService: policy("agencyServices", ["name", "category", "description", "priceFrom", "priceTo", "deliveryWeeks", "deliverables", "taskChecklist", "isActive"], []),
  mailbox: policy("mailboxes", ["email", "displayName", "provider", "status", "healthScore", "spamPlacementRate", "bounceRate", "dailySendLimit"], [], ["email", "displayName"]),
  sequence: policy("sequences", ["name", "description", "status", "businessDaysOnly", "requireApprovedOpener"], []),
  sequenceStep: policy("sequenceSteps", ["name", "stepOrder", "delayDays", "stepType", "instructions"], []),
  sequenceEnrollment: policy("sequenceEnrollments", ["status", "currentStep", "nextSendAt", "lastSentAt", "repliedAt", "mailboxEmail", "stopReason", "lastError", "personalizedOpener", "openerStatus", "customFirstLine", "customPs"], ["personalizedOpener", "customFirstLine", "customPs"], []),
  campaign: policy("campaigns", ["name", "status", "enrolled", "sent", "replied", "meetings"], []),
  emailTemplate: policy("emailTemplates", ["name", "subject", "body", "category"], []),
  clientEmail: policy("clientEmails", ["subject", "kind", "status", "toEmail", "body", "sentAt", "error", "proposalId", "personId", "projectId"], [], ["subject", "toEmail"]),
};

export function assertTwentyObject(value: string): asserts value is TwentyObject {
  if (!Object.prototype.hasOwnProperty.call(TWENTY_OBJECTS, value)) throw new Error("Twenty object is not allowed");
}

/** Reject unknown keys and nested relation operations before building any request. */
export function validateTwentyPatch(object: TwentyObject, data: Record<string, unknown>): void {
  assertTwentyObject(object);
  if (Object.keys(data).length === 0) throw new Error("At least one field is required");
  for (const [key, value] of Object.entries(data)) {
    if (!TWENTY_OBJECTS[object].writable.includes(key)) throw new Error(`Twenty field ${key} is not writable`);
    if (key.endsWith("Id") && value !== null && (typeof value !== "string" || !/^[0-9a-f-]{36}$/i.test(value))) {
      throw new Error("Relations require an explicit record ID");
    }
    if (value && typeof value === "object" && /"(?:connect|create|connectOrCreate|update|delete|disconnect)"\s*:/.test(JSON.stringify(value))) {
      throw new Error("Nested record operations are not allowed");
    }
  }
  if (JSON.stringify(data).length > 32_768) throw new Error("Twenty changes are too large");
}
