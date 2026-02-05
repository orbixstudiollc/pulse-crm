export interface PipelineDeal {
  id: string;
  name: string;
  company: string;
  value: number;
  probability: number;
  closeDate: string;
  ownerAvatar: string;
  stage: PipelineStage;
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

export const pipelineDeals: PipelineDeal[] = [
  // Discovery
  {
    id: "d1",
    name: "Enterprise",
    company: "TechFlow Inc.",
    value: 24000,
    probability: 20,
    closeDate: "Dec 30",
    ownerAvatar: "/images/avatars/avatar-1.jpg",
    stage: "discovery",
  },
  {
    id: "d2",
    name: "Annual Subscription",
    company: "DataSync Pro",
    value: 18000,
    probability: 25,
    closeDate: "Jan 5",
    ownerAvatar: "/images/avatars/avatar-2.jpg",
    stage: "discovery",
  },
  {
    id: "d3",
    name: "Team Plan",
    company: "InnovateTech",
    value: 13000,
    probability: 20,
    closeDate: "Jan 8",
    ownerAvatar: "/images/avatars/avatar-3.jpg",
    stage: "discovery",
  },
  {
    id: "d4",
    name: "Starter Package",
    company: "CloudBase",
    value: 12500,
    probability: 15,
    closeDate: "Jan 12",
    ownerAvatar: "/images/avatars/avatar-4.jpg",
    stage: "discovery",
  },

  // Proposal
  {
    id: "p1",
    name: "Platform Migration",
    company: "Acme Corp",
    value: 32000,
    probability: 50,
    closeDate: "Dec 28",
    ownerAvatar: "/images/avatars/avatar-5.jpg",
    stage: "proposal",
  },
  {
    id: "p2",
    name: "API Integration",
    company: "Startup Labs",
    value: 15000,
    probability: 45,
    closeDate: "Jan 3",
    ownerAvatar: "/images/avatars/avatar-6.jpg",
    stage: "proposal",
  },
  {
    id: "p3",
    name: "Custom Solution",
    company: "Global Systems",
    value: 11000,
    probability: 40,
    closeDate: "Jan 15",
    ownerAvatar: "/images/avatars/avatar-1.jpg",
    stage: "proposal",
  },

  // Negotiation
  {
    id: "n1",
    name: "Enterprise Suite",
    company: "MegaCorp",
    value: 45000,
    probability: 75,
    closeDate: "Dec 26",
    ownerAvatar: "/images/avatars/avatar-2.jpg",
    stage: "negotiation",
  },
  {
    id: "n2",
    name: "Growth Plan",
    company: "FastScale",
    value: 18000,
    probability: 70,
    closeDate: "Dec 29",
    ownerAvatar: "/images/avatars/avatar-3.jpg",
    stage: "negotiation",
  },

  // Closed Won
  {
    id: "w1",
    name: "Pro Upgrade",
    company: "BrightPath",
    value: 28000,
    probability: 100,
    closeDate: "Dec 20",
    ownerAvatar: "/images/avatars/avatar-4.jpg",
    stage: "closed_won",
  },
  {
    id: "w2",
    name: "Enterprise Renewal",
    company: "NextGen Solutions",
    value: 52000,
    probability: 100,
    closeDate: "Dec 18",
    ownerAvatar: "/images/avatars/avatar-5.jpg",
    stage: "closed_won",
  },
  {
    id: "w3",
    name: "Annual Contract",
    company: "Summit Group",
    value: 36000,
    probability: 100,
    closeDate: "Dec 15",
    ownerAvatar: "/images/avatars/avatar-6.jpg",
    stage: "closed_won",
  },

  // Closed Lost
  {
    id: "l1",
    name: "Custom Integration",
    company: "RetroTech",
    value: 19000,
    probability: 0,
    closeDate: "Dec 22",
    ownerAvatar: "/images/avatars/avatar-1.jpg",
    stage: "closed_lost",
  },
  {
    id: "l2",
    name: "Starter Plan",
    company: "NovaLabs",
    value: 8500,
    probability: 0,
    closeDate: "Dec 19",
    ownerAvatar: "/images/avatars/avatar-2.jpg",
    stage: "closed_lost",
  },
];

export const pipelineStages: { id: PipelineStage; label: string }[] = [
  { id: "discovery", label: "Discovery" },
  { id: "proposal", label: "Proposal" },
  { id: "negotiation", label: "Negotiation" },
  { id: "closed_won", label: "Closed Won" },
  { id: "closed_lost", label: "Closed Lost" },
];

export function getDealsByStage(stage: PipelineStage): PipelineDeal[] {
  return pipelineDeals.filter((deal) => deal.stage === stage);
}

export function getStageTotalValue(stage: PipelineStage): number {
  return getDealsByStage(stage).reduce((sum, deal) => sum + deal.value, 0);
}

export function getStageCount(stage: PipelineStage): number {
  return getDealsByStage(stage).length;
}

export function formatDealCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
