export interface DealContact {
  name: string;
  email: string;
  avatar: string;
}

export interface DealActivity {
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

export interface DealNote {
  id: string;
  author: string;
  date: string;
  content: string;
}

export interface PipelineDeal {
  id: string;
  name: string;
  company: string;
  value: number;
  probability: number;
  closeDate: string;
  ownerAvatar: string;
  stage: PipelineStage;
  createdDate: string;
  lastActivity: string;
  contact: DealContact;
  notes: string;
  daysInStage: number;
  daysToClose: number;
  owner: string;
  activities: DealActivity[];
  dealNotes: DealNote[];
}

export type PipelineStage =
  | "discovery"
  | "proposal"
  | "negotiation"
  | "closed_won"
  | "closed_lost";

export interface StageColumn {
  id: PipelineStage;
  label: string;
  deals: PipelineDeal[];
}

export const pipelineStages: { id: PipelineStage; label: string }[] = [
  { id: "discovery", label: "Discovery" },
  { id: "proposal", label: "Proposal" },
  { id: "negotiation", label: "Negotiation" },
  { id: "closed_won", label: "Closed Won" },
  { id: "closed_lost", label: "Closed Lost" },
];

export const activeStageOrder: PipelineStage[] = [
  "discovery",
  "proposal",
  "negotiation",
  "closed_won",
];

export function formatDealCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function getStageLabel(stage: PipelineStage): string {
  return pipelineStages.find((s) => s.id === stage)?.label ?? stage;
}
