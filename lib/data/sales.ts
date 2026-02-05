export interface DealContact {
  name: string;
  email: string;
  avatar: string;
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
  // Extended fields for drawer
  createdDate: string;
  lastActivity: string;
  contact: DealContact;
  notes: string;
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
    createdDate: "Nov 15, 2024",
    lastActivity: "2 days ago",
    contact: {
      name: "James Anderson",
      email: "j.anderson@techflow.io",
      avatar: "/images/avatars/avatar-1.jpg",
    },
    notes:
      "Initial discovery call completed. Interested in enterprise features.",
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
    createdDate: "Nov 20, 2024",
    lastActivity: "1 day ago",
    contact: {
      name: "Sarah Chen",
      email: "s.chen@datasyncpro.com",
      avatar: "/images/avatars/avatar-2.jpg",
    },
    notes: "Evaluating annual plan options. Needs SSO and audit logs.",
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
    createdDate: "Dec 1, 2024",
    lastActivity: "3 days ago",
    contact: {
      name: "Michael Torres",
      email: "m.torres@innovatetech.io",
      avatar: "/images/avatars/avatar-3.jpg",
    },
    notes: "Small team looking to scale. Budget approved for Q1.",
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
    createdDate: "Dec 5, 2024",
    lastActivity: "5 days ago",
    contact: {
      name: "Emily Richards",
      email: "e.richards@cloudbase.dev",
      avatar: "/images/avatars/avatar-4.jpg",
    },
    notes: "Early-stage startup. Interested in starter tier with room to grow.",
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
    createdDate: "Oct 10, 2024",
    lastActivity: "1 day ago",
    contact: {
      name: "David Kim",
      email: "d.kim@acmecorp.com",
      avatar: "/images/avatars/avatar-5.jpg",
    },
    notes:
      "Proposal sent for full platform migration. Decision expected by EOY.",
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
    createdDate: "Nov 5, 2024",
    lastActivity: "4 days ago",
    contact: {
      name: "Lisa Wang",
      email: "l.wang@startuplabs.io",
      avatar: "/images/avatars/avatar-6.jpg",
    },
    notes: "Custom API integration proposal. Waiting on technical review.",
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
    createdDate: "Nov 12, 2024",
    lastActivity: "6 days ago",
    contact: {
      name: "Robert Hayes",
      email: "r.hayes@globalsystems.net",
      avatar: "/images/avatars/avatar-1.jpg",
    },
    notes: "Needs custom reporting module. Proposal under internal review.",
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
    createdDate: "Sep 20, 2024",
    lastActivity: "Today",
    contact: {
      name: "Alexandra Foster",
      email: "a.foster@megacorp.com",
      avatar: "/images/avatars/avatar-2.jpg",
    },
    notes:
      "Final pricing negotiation. Legal review in progress. Very likely to close.",
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
    createdDate: "Oct 15, 2024",
    lastActivity: "1 day ago",
    contact: {
      name: "Chris Martinez",
      email: "c.martinez@fastscale.io",
      avatar: "/images/avatars/avatar-3.jpg",
    },
    notes: "Negotiating multi-year discount. Champion is VP of Engineering.",
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
    createdDate: "Aug 15, 2024",
    lastActivity: "Dec 20",
    contact: {
      name: "Nina Patel",
      email: "n.patel@brightpath.com",
      avatar: "/images/avatars/avatar-4.jpg",
    },
    notes:
      "Successfully upgraded from starter to pro plan. Great relationship.",
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
    createdDate: "Jul 1, 2024",
    lastActivity: "Dec 18",
    contact: {
      name: "Tom Bradley",
      email: "t.bradley@nextgensolutions.com",
      avatar: "/images/avatars/avatar-5.jpg",
    },
    notes: "Annual renewal with 15% increase. Expanded to 3 more departments.",
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
    createdDate: "Sep 1, 2024",
    lastActivity: "Dec 15",
    contact: {
      name: "Rachel Kim",
      email: "r.kim@summitgroup.co",
      avatar: "/images/avatars/avatar-6.jpg",
    },
    notes: "Signed annual contract after successful pilot program.",
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
    createdDate: "Oct 5, 2024",
    lastActivity: "Dec 22",
    contact: {
      name: "Mark Sullivan",
      email: "m.sullivan@retrotech.com",
      avatar: "/images/avatars/avatar-1.jpg",
    },
    notes:
      "Lost to competitor. Main reason: pricing and legacy system support.",
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
    createdDate: "Nov 1, 2024",
    lastActivity: "Dec 19",
    contact: {
      name: "Jenny Liu",
      email: "j.liu@novalabs.io",
      avatar: "/images/avatars/avatar-2.jpg",
    },
    notes: "Budget was reallocated internally. May revisit in Q2.",
  },
];

export const pipelineStages: { id: PipelineStage; label: string }[] = [
  { id: "discovery", label: "Discovery" },
  { id: "proposal", label: "Proposal" },
  { id: "negotiation", label: "Negotiation" },
  { id: "closed_won", label: "Closed Won" },
  { id: "closed_lost", label: "Closed Lost" },
];

// Ordered active stages for the progress indicator
export const activeStageOrder: PipelineStage[] = [
  "discovery",
  "proposal",
  "negotiation",
  "closed_won",
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

export function getStageLabel(stage: PipelineStage): string {
  return pipelineStages.find((s) => s.id === stage)?.label ?? stage;
}
