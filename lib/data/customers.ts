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
    variant:
      | "green"
      | "amber"
      | "blue"
      | "red"
      | "emerald"
      | "violet"
      | "neutral";
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
    variant: "amber" | "blue" | "green" | "red" | "violet" | "neutral";
  }
> = {
  prospecting: { label: "Prospecting", variant: "neutral" },
  qualification: { label: "Qualification", variant: "blue" },
  proposal: { label: "Proposal", variant: "violet" },
  negotiation: { label: "Negotiation", variant: "amber" },
  closed_won: { label: "Closed Won", variant: "green" },
  closed_lost: { label: "Closed Lost", variant: "red" },
};
