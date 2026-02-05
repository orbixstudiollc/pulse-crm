export type LeadStatus = "hot" | "warm" | "cold";
export type LeadSource =
  | "Website"
  | "Referral"
  | "LinkedIn"
  | "Event"
  | "Google Ads"
  | "Cold Call";

export interface Lead {
  id: string;
  name: string;
  email: string;
  company: string;
  phone: string;
  linkedin: string;
  location: string;
  employees: string;
  website: string;
  industry: string;
  status: LeadStatus;
  source: LeadSource;
  estimatedValue: number;
  score: number;
  winProbability: number;
  daysInPipeline: number;
  createdDate: string;
}

export const leads: Lead[] = [
  {
    id: "1",
    name: "John Smith",
    email: "john@example.com",
    company: "Acme Corp",
    phone: "+1 (555) 123-4567",
    linkedin: "linkedin.com/in/johnsmith",
    location: "New York, NY",
    employees: "200-500",
    website: "acmecorp.com",
    industry: "SaaS / Technology",
    status: "hot",
    source: "Website",
    estimatedValue: 12500,
    score: 92,
    winProbability: 85,
    daysInPipeline: 14,
    createdDate: "Jan 15, 2025",
  },
  {
    id: "2",
    name: "Emily Davis",
    email: "emily@startup.io",
    company: "Startup.io",
    phone: "+1 (555) 234-5678",
    linkedin: "linkedin.com/in/emilydavis",
    location: "Austin, TX",
    employees: "10-50",
    website: "startup.io",
    industry: "Fintech",
    status: "warm",
    source: "Referral",
    estimatedValue: 8200,
    score: 78,
    winProbability: 60,
    daysInPipeline: 21,
    createdDate: "Jan 14, 2025",
  },
  {
    id: "3",
    name: "Michael Brown",
    email: "mbrown@corp.com",
    company: "Brown & Associates",
    phone: "+1 (555) 345-6789",
    linkedin: "linkedin.com/in/michaelbrown",
    location: "Chicago, IL",
    employees: "50-200",
    website: "brownassoc.com",
    industry: "Consulting",
    status: "hot",
    source: "LinkedIn",
    estimatedValue: 5400,
    score: 88,
    winProbability: 75,
    daysInPipeline: 7,
    createdDate: "Jan 13, 2025",
  },
  {
    id: "4",
    name: "Sarah Wilson",
    email: "sarah@design.co",
    company: "Design Co",
    phone: "+1 (555) 456-7890",
    linkedin: "linkedin.com/in/sarahwilson",
    location: "Portland, OR",
    employees: "10-50",
    website: "design.co",
    industry: "Design / Creative",
    status: "cold",
    source: "Event",
    estimatedValue: 18000,
    score: 45,
    winProbability: 20,
    daysInPipeline: 42,
    createdDate: "Jan 10, 2025",
  },
  {
    id: "5",
    name: "David Lee",
    email: "dlee@enterprise.com",
    company: "Enterprise Solutions",
    phone: "+1 (555) 567-8901",
    linkedin: "linkedin.com/in/davidlee",
    location: "Seattle, WA",
    employees: "500-1000",
    website: "enterprise-solutions.com",
    industry: "Enterprise Software",
    status: "warm",
    source: "Website",
    estimatedValue: 18000,
    score: 72,
    winProbability: 55,
    daysInPipeline: 18,
    createdDate: "Jan 12, 2025",
  },
  {
    id: "6",
    name: "Jennifer Taylor",
    email: "jtaylor@stars.co",
    company: "Stars Co",
    phone: "+1 (555) 678-9012",
    linkedin: "linkedin.com/in/jennifertaylor",
    location: "Denver, CO",
    employees: "10-50",
    website: "stars.co",
    industry: "Marketing",
    status: "cold",
    source: "LinkedIn",
    estimatedValue: 24000,
    score: 40,
    winProbability: 15,
    daysInPipeline: 35,
    createdDate: "Jan 11, 2025",
  },
  {
    id: "7",
    name: "Robert Martinez",
    email: "robert@globalio.com",
    company: "Global IO",
    phone: "+1 (555) 789-0123",
    linkedin: "linkedin.com/in/robertmartinez",
    location: "Miami, FL",
    employees: "200-500",
    website: "globalio.com",
    industry: "Logistics",
    status: "hot",
    source: "Google Ads",
    estimatedValue: 24000,
    score: 95,
    winProbability: 90,
    daysInPipeline: 5,
    createdDate: "Jan 16, 2025",
  },
  {
    id: "8",
    name: "Lisa Anderson",
    email: "lisa@innovate.com",
    company: "Innovate Inc",
    phone: "+1 (555) 890-1234",
    linkedin: "linkedin.com/in/lisaanderson",
    location: "Boston, MA",
    employees: "50-200",
    website: "innovate.com",
    industry: "Healthcare",
    status: "warm",
    source: "Cold Call",
    estimatedValue: 12000,
    score: 65,
    winProbability: 45,
    daysInPipeline: 28,
    createdDate: "Jan 15, 2025",
  },
  {
    id: "9",
    name: "James Wilson",
    email: "james@techco.io",
    company: "TechFlow Inc.",
    phone: "+1 (555) 234-5678",
    linkedin: "linkedin.com/in/jameswilson",
    location: "San Francisco, CA",
    employees: "50-200",
    website: "techflow.io",
    industry: "SaaS / Technology",
    status: "cold",
    source: "Event",
    estimatedValue: 4000,
    score: 35,
    winProbability: 10,
    daysInPipeline: 50,
    createdDate: "Jan 5, 2025",
  },
  {
    id: "10",
    name: "Amanda Clark",
    email: "amanda@mediaio.com",
    company: "Media IO",
    phone: "+1 (555) 901-2345",
    linkedin: "linkedin.com/in/amandaclark",
    location: "Los Angeles, CA",
    employees: "50-200",
    website: "mediaio.com",
    industry: "Media / Entertainment",
    status: "warm",
    source: "Referral",
    estimatedValue: 18000,
    score: 70,
    winProbability: 50,
    daysInPipeline: 22,
    createdDate: "Jan 14, 2025",
  },
];

export function getLeadById(id: string): Lead | undefined {
  return leads.find((l) => l.id === id);
}

export const leadStatusConfig: Record<
  LeadStatus,
  { label: string; variant: "red" | "amber" | "neutral" }
> = {
  hot: { label: "Hot", variant: "red" },
  warm: { label: "Warm", variant: "amber" },
  cold: { label: "Cold", variant: "neutral" },
};

export function getLeadScoreStyle(score: number) {
  if (score >= 80) {
    return "border-green-200 dark:border-green-400/30 bg-green-100 text-green-600 dark:bg-green-400/15 dark:text-green-400";
  }
  if (score >= 60) {
    return "border-amber-200 dark:border-amber-400/30 bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-400";
  }
  return "border-neutral-200 dark:border-neutral-400/30 bg-neutral-100 text-neutral-600 dark:bg-neutral-400/15 dark:text-neutral-400";
}

export const leadQualificationConfig: Record<LeadStatus, { label: string }> = {
  hot: { label: "Qualified" },
  warm: { label: "Nurturing" },
  cold: { label: "New" },
};

// Filter options
export const leadStatusOptions = [
  { label: "All Status", value: "all" },
  { label: "Hot", value: "hot" },
  { label: "Warm", value: "warm" },
  { label: "Cold", value: "cold" },
];

export const leadSourceOptions = [
  { label: "All Sources", value: "all" },
  { label: "Website", value: "Website" },
  { label: "Referral", value: "Referral" },
  { label: "LinkedIn", value: "LinkedIn" },
  { label: "Event", value: "Event" },
  { label: "Google Ads", value: "Google Ads" },
  { label: "Cold Call", value: "Cold Call" },
];

export const leadScoreOptions = [
  { label: "All Scores", value: "all" },
  { label: "High (80+)", value: "high" },
  { label: "Medium (60-79)", value: "medium" },
  { label: "Low (0-59)", value: "low" },
];

// --------------------------------------------------
// Lead Activity & Notes (mirrors customer pattern)
// --------------------------------------------------

export interface LeadActivity {
  id: string;
  type: "email" | "call" | "deal" | "meeting" | "note" | "task" | "invoice";
  title: string;
  description: string;
  badge?: {
    label: string;
    variant: "green" | "red" | "amber" | "blue" | "neutral" | "violet";
  };
  meta?: string;
}

export interface LeadNote {
  id: string;
  author: string;
  date: string;
  content: string;
}

export const activityByLeadId: Record<string, LeadActivity[]> = {
  "1": [
    {
      id: "1",
      type: "call",
      title: "Discovery call completed",
      description: "45 min call discussing their current workflow challenges",
      badge: { label: "Positive outcome", variant: "green" },
    },
    {
      id: "2",
      type: "email",
      title: "Email sent: Product Demo Follow-up",
      description: "Sent pricing details and case studies",
      badge: { label: "Opened", variant: "green" },
      meta: "3 opens",
    },
    {
      id: "3",
      type: "meeting",
      title: "Meeting scheduled: Product Demo",
      description: "Demo scheduled for Dec 18 at 3:00 PM",
    },
    {
      id: "4",
      type: "note",
      title: "Lead created from LinkedIn",
      description: "Connected via Sales Navigator outreach",
    },
    {
      id: "5",
      type: "email",
      title: "Email received: Feature Request",
      description: "Requested Salesforce integration",
      badge: { label: "Replied", variant: "green" },
      meta: "2 hr response time",
    },
  ],
  "2": [
    {
      id: "1",
      type: "email",
      title: "Email sent: Introduction",
      description: "Initial outreach with product overview",
      badge: { label: "Opened", variant: "green" },
      meta: "2 opens",
    },
    {
      id: "2",
      type: "call",
      title: "Follow-up call scheduled",
      description: "Call booked for next Tuesday at 2:00 PM",
    },
  ],
  "3": [
    {
      id: "1",
      type: "meeting",
      title: "Product demo completed",
      description: "45 min demo of core platform features",
      badge: { label: "Completed", variant: "green" },
    },
    {
      id: "2",
      type: "email",
      title: "Proposal sent",
      description: "Sent custom pricing proposal for Pro plan",
      badge: { label: "Opened", variant: "green" },
      meta: "5 opens",
    },
    {
      id: "3",
      type: "call",
      title: "Pricing discussion",
      description: "Discussed budget and timeline with decision maker",
      badge: { label: "Positive outcome", variant: "green" },
    },
  ],
  "7": [
    {
      id: "1",
      type: "email",
      title: "Inbound inquiry from Google Ads",
      description: "Requested demo after viewing landing page",
      badge: { label: "Hot lead", variant: "red" },
    },
    {
      id: "2",
      type: "call",
      title: "Qualification call completed",
      description: "30 min call, strong product fit confirmed",
      badge: { label: "Positive outcome", variant: "green" },
    },
    {
      id: "3",
      type: "meeting",
      title: "Demo scheduled",
      description: "Full platform demo for Jan 20 at 10:00 AM",
    },
  ],
  "9": [
    {
      id: "1",
      type: "call",
      title: "Discovery call completed",
      description: "45 min call discussing their current workflow challenges",
      badge: { label: "Positive outcome", variant: "green" },
    },
    {
      id: "2",
      type: "email",
      title: "Email sent: Product Demo Follow-up",
      description: "Sent pricing details and case studies",
      badge: { label: "Opened", variant: "green" },
      meta: "3 opens",
    },
    {
      id: "3",
      type: "meeting",
      title: "Meeting scheduled: Product Demo",
      description: "Demo scheduled for Dec 18 at 3:00 PM",
    },
    {
      id: "4",
      type: "note",
      title: "Lead created from LinkedIn",
      description: "Connected via Sales Navigator outreach",
    },
    {
      id: "5",
      type: "email",
      title: "Email received: Feature Request",
      description: "Requested Salesforce integration",
      badge: { label: "Replied", variant: "green" },
      meta: "2 hr response time",
    },
  ],
};

export const notesByLeadId: Record<string, LeadNote[]> = {
  "1": [
    {
      id: "1",
      author: "You",
      date: "Today",
      content:
        "Great discovery call! John mentioned they're evaluating 3 vendors. Main concerns: integration with Salesforce, onboarding time. Decision maker is their CTO. Budget approved for Q1.",
    },
    {
      id: "2",
      author: "You",
      date: "Dec 12, 2025",
      content:
        "Initial LinkedIn research: Acme Corp recently raised Series B, expanding engineering team. Perfect timing for our solution.",
    },
  ],
  "3": [
    {
      id: "1",
      author: "You",
      date: "Today",
      content:
        "Michael loved the demo. Key selling points: API flexibility and custom reporting. Wants to loop in their VP of Eng for final sign-off.",
    },
  ],
  "7": [
    {
      id: "1",
      author: "You",
      date: "Jan 16, 2025",
      content:
        "High intent lead from Google Ads campaign. Robert filled out the enterprise form and requested urgent demo. Logistics company with 300+ employees.",
    },
  ],
  "9": [
    {
      id: "1",
      author: "You",
      date: "Today",
      content:
        "Great discovery call! James mentioned they're evaluating 3 vendors. Main concerns: integration with Salesforce, onboarding time. Decision maker is their CTO. Budget approved for Q1.",
    },
    {
      id: "2",
      author: "You",
      date: "Dec 12, 2025",
      content:
        "Initial LinkedIn research: TechFlow recently raised Series B, expanding engineering team. Perfect timing for our solution.",
    },
  ],
};
