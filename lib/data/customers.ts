import type { BadgeVariant } from "@/components/ui";

export interface Customer {
  id: string;
  firstName?: string;
  lastName?: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  status: "active" | "pending" | "inactive";
  plan: "enterprise" | "pro" | "starter" | "free";
  mrr: number;
  healthScore: number;
  lifetimeValue?: number;
  tenure?: number;
  lastContact?: string;
  company?: string;
  jobTitle?: string;
  industry?: string;
  companySize?: string;
  website?: string;
  streetAddress?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  location?: string;
  timezone?: string;
  customerSince?: string;
  renewalDate?: string;
  tags?: string[];
  notes?: string;
  customFields?: { id: string; name: string; value: string }[];
}

export interface ActivityItem {
  id: string;
  type: "email" | "call" | "deal" | "meeting" | "note" | "task" | "invoice";
  title: string;
  description: string;
  badge?: {
    label: string;
    variant: BadgeVariant;
  };
  meta?: string;
}

export interface Note {
  id: string;
  author: string;
  date: string;
  content: string;
}

export type DealStage =
  | "prospecting"
  | "qualification"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export interface Deal {
  id: string;
  name: string;
  company: string;
  value: string;
  valuePeriod: "mo" | "yr";
  stage: DealStage;
  probability: number;
  createdDate: string;
  expectedCloseDate: string;
}

export const stageConfig: Record<
  DealStage,
  {
    label: string;
    variant: BadgeVariant;
  }
> = {
  prospecting: { label: "Prospecting", variant: "neutral" },
  qualification: { label: "Qualification", variant: "info" },
  proposal: { label: "Proposal", variant: "primary" },
  negotiation: { label: "Negotiation", variant: "warning" },
  closed_won: { label: "Closed Won", variant: "success" },
  closed_lost: { label: "Closed Lost", variant: "error" },
};
