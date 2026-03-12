import { z } from "zod";

export interface ActionDefinition {
  id: string;
  label: string;
  description: string;
  confirmMessage: string;
  schema: z.ZodType;
}

export const ACTION_DEFINITIONS: Record<string, ActionDefinition> = {
  createDeal: {
    id: "createDeal",
    label: "Create Deal",
    description: "Create a new deal in the pipeline",
    confirmMessage: "Create a new deal with the following details?",
    schema: z.object({
      name: z.string().describe("Deal name"),
      value: z.number().optional().describe("Deal value in dollars"),
      stage: z.string().optional().describe("Pipeline stage").default("qualification"),
      contact_name: z.string().optional().describe("Contact name"),
      contact_email: z.string().optional().describe("Contact email"),
      notes: z.string().optional().describe("Deal notes"),
    }),
  },
  updateDealStage: {
    id: "updateDealStage",
    label: "Update Deal Stage",
    description: "Move a deal to a different pipeline stage",
    confirmMessage: "Move this deal to a new stage?",
    schema: z.object({
      dealId: z.string().describe("ID of the deal to update"),
      dealName: z.string().describe("Name of the deal (for confirmation display)"),
      newStage: z.string().describe("New pipeline stage"),
    }),
  },
  createActivity: {
    id: "createActivity",
    label: "Log Activity",
    description: "Log an activity for a deal or lead",
    confirmMessage: "Log this activity?",
    schema: z.object({
      dealId: z.string().describe("Deal ID to log activity for"),
      type: z.enum(["call", "email", "meeting", "note", "task"]).describe("Activity type"),
      title: z.string().describe("Activity title"),
      description: z.string().optional().describe("Activity description"),
    }),
  },
  generateEmail: {
    id: "generateEmail",
    label: "Draft Email",
    description: "Generate a draft email (not sent automatically)",
    confirmMessage: "Generate this email draft?",
    schema: z.object({
      to: z.string().describe("Recipient name or email"),
      subject: z.string().describe("Email subject"),
      body: z.string().describe("Email body content"),
      tone: z.enum(["professional", "friendly", "urgent"]).optional().default("professional"),
    }),
  },
};

export function getActionConfirmDetails(actionId: string, params: Record<string, unknown>): Record<string, string> {
  switch (actionId) {
    case "createDeal":
      return {
        Name: String(params.name || ""),
        Value: params.value ? `$${Number(params.value).toLocaleString()}` : "Not set",
        Stage: String(params.stage || "qualification"),
        Contact: String(params.contact_name || "N/A"),
      };
    case "updateDealStage":
      return {
        Deal: String(params.dealName || params.dealId || ""),
        "New Stage": String(params.newStage || "").replace(/_/g, " "),
      };
    case "createActivity":
      return {
        Type: String(params.type || ""),
        Title: String(params.title || ""),
        Description: String(params.description || "N/A"),
      };
    case "generateEmail":
      return {
        To: String(params.to || ""),
        Subject: String(params.subject || ""),
        Tone: String(params.tone || "professional"),
      };
    default:
      return params as Record<string, string>;
  }
}
