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
  // Extended fields for drawer
  createdDate: string;
  lastActivity: string;
  contact: DealContact;
  notes: string;
  // Extended fields for detail page
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
    daysInStage: 8,
    daysToClose: 25,
    owner: "Sarah Chen",
    activities: [
      {
        id: "a1",
        type: "task",
        title: "Deal created",
        description: "New deal added to Discovery stage.",
      },
      {
        id: "a2",
        type: "call",
        title: "Discovery call with James",
        description: "Discussed current pain points and requirements.",
        badge: { label: "Sarah Chen", variant: "green" },
        meta: "45 min",
      },
      {
        id: "a3",
        type: "email",
        title: "Follow-up email sent",
        description: "Sent product overview and pricing information.",
        badge: { label: "Opened", variant: "green" },
        meta: "Clicked 2 links",
      },
    ],
    dealNotes: [
      {
        id: "n1",
        author: "Sarah Chen",
        date: "2 days ago",
        content:
          "Initial discovery call completed. They're interested in enterprise features, particularly SSO and advanced reporting.",
      },
    ],
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
    daysInStage: 5,
    daysToClose: 30,
    owner: "Michael Torres",
    activities: [
      {
        id: "a1",
        type: "task",
        title: "Deal created",
        description: "New deal added to Discovery stage.",
      },
      {
        id: "a2",
        type: "email",
        title: "Initial outreach",
        description: "Sent introduction email with annual plan options.",
        badge: { label: "Replied", variant: "green" },
        meta: "1 hr response",
      },
    ],
    dealNotes: [
      {
        id: "n1",
        author: "Michael Torres",
        date: "1 day ago",
        content:
          "They need SSO and audit logs for compliance. Evaluating annual vs monthly options.",
      },
    ],
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
    daysInStage: 10,
    daysToClose: 33,
    owner: "Emily Richards",
    activities: [
      {
        id: "a1",
        type: "task",
        title: "Deal created",
        description: "New deal added to Discovery stage.",
      },
      {
        id: "a2",
        type: "meeting",
        title: "Product demo scheduled",
        description: "Demo scheduled for next week.",
        badge: { label: "Confirmed", variant: "green" },
      },
    ],
    dealNotes: [
      {
        id: "n1",
        author: "Emily Richards",
        date: "3 days ago",
        content:
          "Small team of 15 looking to scale. Budget approved for Q1. Demo scheduled.",
      },
    ],
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
    daysInStage: 6,
    daysToClose: 37,
    owner: "Sarah Chen",
    activities: [
      {
        id: "a1",
        type: "task",
        title: "Deal created",
        description: "New deal added to Discovery stage.",
      },
      {
        id: "a2",
        type: "email",
        title: "Pricing inquiry",
        description: "Requested startup pricing options.",
        badge: { label: "Replied", variant: "green" },
      },
    ],
    dealNotes: [
      {
        id: "n1",
        author: "Sarah Chen",
        date: "5 days ago",
        content:
          "Early-stage startup, seed funded. Looking for starter tier with upgrade path.",
      },
    ],
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
    daysInStage: 14,
    daysToClose: 3,
    owner: "Sarah Chen",
    activities: [
      {
        id: "a1",
        type: "task",
        title: "Stage changed to Proposal",
        description: "Deal moved from Discovery to Proposal stage.",
      },
      {
        id: "a2",
        type: "email",
        title: "Proposal sent",
        description: "Sent full migration proposal with custom pricing.",
        badge: { label: "David Kim", variant: "green" },
        meta: "Viewed 5 times",
      },
      {
        id: "a3",
        type: "call",
        title: "Proposal review call",
        description: "Walked through proposal details with stakeholders.",
        badge: { label: "Sarah Chen", variant: "green" },
        meta: "60 min",
      },
    ],
    dealNotes: [
      {
        id: "n1",
        author: "Sarah Chen",
        date: "1 day ago",
        content:
          "Proposal well received. Decision expected by end of year. Main stakeholder is CFO.",
      },
    ],
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
    daysInStage: 12,
    daysToClose: 8,
    owner: "Michael Torres",
    activities: [
      {
        id: "a1",
        type: "task",
        title: "Stage changed to Proposal",
        description: "Deal moved from Discovery to Proposal stage.",
      },
      {
        id: "a2",
        type: "email",
        title: "Technical proposal sent",
        description: "Sent API integration proposal with technical specs.",
        badge: { label: "Opened", variant: "green" },
        meta: "Clicked 4 links",
      },
      {
        id: "a3",
        type: "note",
        title: "Note added",
        description: "Technical team reviewing integration requirements.",
      },
    ],
    dealNotes: [
      {
        id: "n1",
        author: "Michael Torres",
        date: "4 days ago",
        content:
          "Custom API integration proposal sent. Their technical team is reviewing. Follow up next week.",
      },
    ],
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
    daysInStage: 10,
    daysToClose: 20,
    owner: "Emily Richards",
    activities: [
      {
        id: "a1",
        type: "task",
        title: "Stage changed to Proposal",
        description: "Deal moved from Discovery to Proposal stage.",
      },
      {
        id: "a2",
        type: "email",
        title: "Custom solution proposal",
        description: "Sent proposal for custom reporting module.",
        badge: { label: "Robert Hayes", variant: "green" },
      },
    ],
    dealNotes: [
      {
        id: "n1",
        author: "Emily Richards",
        date: "6 days ago",
        content:
          "Custom reporting module requested. Proposal sent, under internal review.",
      },
    ],
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
    daysInStage: 12,
    daysToClose: 5,
    owner: "Sarah Chen",
    activities: [
      {
        id: "a1",
        type: "task",
        title: "Stage changed to Negotiation",
        description: "Deal moved from Proposal to Negotiation stage.",
      },
      {
        id: "a2",
        type: "call",
        title: "Call with Michael Chen",
        description: "Discussed final pricing and implementation timeline.",
        badge: { label: "Sarah Chen", variant: "green" },
        meta: "25 min",
      },
      {
        id: "a3",
        type: "email",
        title: "Proposal sent",
        description:
          "Sent revised proposal with enterprise pricing and custom SLA terms.",
        badge: { label: "Sarah Chen", variant: "green" },
        meta: "Clicked 2 links",
      },
      {
        id: "a4",
        type: "note",
        title: "Note added",
        description: "Initial contact from MegaCorp.",
      },
      {
        id: "a5",
        type: "email",
        title: "Email received: Feature Request",
        description: "Requested Salesforce integration",
        badge: { label: "Replied", variant: "green" },
        meta: "2 hr response time",
      },
    ],
    dealNotes: [
      {
        id: "n1",
        author: "You",
        date: "Today",
        content:
          "Initial contact from MegaCorp. They're looking to replace their current CRM with something more modern. Budget approved for Q4.",
      },
    ],
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
    daysInStage: 8,
    daysToClose: 4,
    owner: "Michael Torres",
    activities: [
      {
        id: "a1",
        type: "task",
        title: "Stage changed to Negotiation",
        description: "Deal moved from Proposal to Negotiation stage.",
      },
      {
        id: "a2",
        type: "call",
        title: "Pricing negotiation call",
        description: "Discussed multi-year discount options.",
        badge: { label: "Michael Torres", variant: "green" },
        meta: "40 min",
      },
      {
        id: "a3",
        type: "email",
        title: "Updated pricing sent",
        description: "Sent revised pricing with 15% multi-year discount.",
        badge: { label: "Opened", variant: "green" },
      },
    ],
    dealNotes: [
      {
        id: "n1",
        author: "Michael Torres",
        date: "1 day ago",
        content:
          "VP of Engineering is our champion. Negotiating 2-year deal with 15% discount.",
      },
    ],
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
    daysInStage: 0,
    daysToClose: 0,
    owner: "Sarah Chen",
    activities: [
      {
        id: "a1",
        type: "task",
        title: "Deal Won! 🎉",
        description: "Deal closed successfully.",
        badge: { label: "Won", variant: "green" },
      },
      {
        id: "a2",
        type: "email",
        title: "Contract signed",
        description: "Received signed contract for Pro plan upgrade.",
        badge: { label: "Nina Patel", variant: "green" },
      },
    ],
    dealNotes: [
      {
        id: "n1",
        author: "Sarah Chen",
        date: "Dec 20",
        content:
          "Deal closed! Upgraded from starter to pro. Great relationship, potential for expansion.",
      },
    ],
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
    daysInStage: 0,
    daysToClose: 0,
    owner: "Michael Torres",
    activities: [
      {
        id: "a1",
        type: "task",
        title: "Deal Won! 🎉",
        description: "Annual renewal closed with expansion.",
        badge: { label: "Won", variant: "green" },
      },
    ],
    dealNotes: [
      {
        id: "n1",
        author: "Michael Torres",
        date: "Dec 18",
        content:
          "Renewal closed with 15% increase. Expanded to 3 additional departments.",
      },
    ],
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
    daysInStage: 0,
    daysToClose: 0,
    owner: "Emily Richards",
    activities: [
      {
        id: "a1",
        type: "task",
        title: "Deal Won! 🎉",
        description: "Annual contract signed after pilot.",
        badge: { label: "Won", variant: "green" },
      },
    ],
    dealNotes: [
      {
        id: "n1",
        author: "Emily Richards",
        date: "Dec 15",
        content: "Pilot converted to annual contract. Very happy customer.",
      },
    ],
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
    daysInStage: 0,
    daysToClose: 0,
    owner: "Sarah Chen",
    activities: [
      {
        id: "a1",
        type: "task",
        title: "Deal Lost",
        description: "Lost to competitor on pricing.",
        badge: { label: "Lost", variant: "red" },
      },
    ],
    dealNotes: [
      {
        id: "n1",
        author: "Sarah Chen",
        date: "Dec 22",
        content:
          "Lost to competitor. They offered better legacy system support and lower pricing.",
      },
    ],
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
    daysInStage: 0,
    daysToClose: 0,
    owner: "Michael Torres",
    activities: [
      {
        id: "a1",
        type: "task",
        title: "Deal Lost",
        description: "Budget reallocated internally.",
        badge: { label: "Lost", variant: "red" },
      },
    ],
    dealNotes: [
      {
        id: "n1",
        author: "Michael Torres",
        date: "Dec 19",
        content:
          "Budget was reallocated to other projects. They may revisit in Q2.",
      },
    ],
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

export function getDealById(id: string): PipelineDeal | undefined {
  return pipelineDeals.find((deal) => deal.id === id);
}

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
