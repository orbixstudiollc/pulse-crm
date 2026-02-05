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
  status: LeadStatus;
  source: LeadSource;
  estimatedValue: number;
  score: number;
  createdDate: string;
}

export const leads: Lead[] = [
  {
    id: "1",
    name: "John Smith",
    email: "john@example.com",
    status: "hot",
    source: "Website",
    estimatedValue: 12500,
    score: 92,
    createdDate: "Jan 15, 2025",
  },
  {
    id: "2",
    name: "Emily Davis",
    email: "emily@startup.io",
    status: "warm",
    source: "Referral",
    estimatedValue: 8200,
    score: 78,
    createdDate: "Jan 14, 2025",
  },
  {
    id: "3",
    name: "Michael Brown",
    email: "mbrown@corp.com",
    status: "hot",
    source: "LinkedIn",
    estimatedValue: 5400,
    score: 88,
    createdDate: "Jan 13, 2025",
  },
  {
    id: "4",
    name: "Sarah Wilson",
    email: "sarah@design.co",
    status: "cold",
    source: "Event",
    estimatedValue: 18000,
    score: 45,
    createdDate: "Jan 10, 2025",
  },
  {
    id: "5",
    name: "David Lee",
    email: "dlee@enterprise.com",
    status: "warm",
    source: "Website",
    estimatedValue: 18000,
    score: 72,
    createdDate: "Jan 12, 2025",
  },
  {
    id: "6",
    name: "Jennifer Taylor",
    email: "jtaylor@stars.co",
    status: "cold",
    source: "LinkedIn",
    estimatedValue: 24000,
    score: 40,
    createdDate: "Jan 11, 2025",
  },
  {
    id: "7",
    name: "Robert Martinez",
    email: "robert@globalio.com",
    status: "hot",
    source: "Google Ads",
    estimatedValue: 24000,
    score: 95,
    createdDate: "Jan 16, 2025",
  },
  {
    id: "8",
    name: "Lisa Anderson",
    email: "lisa@innovate.com",
    status: "warm",
    source: "Cold Call",
    estimatedValue: 12000,
    score: 65,
    createdDate: "Jan 15, 2025",
  },
  {
    id: "9",
    name: "James Wilson",
    email: "james@techco.io",
    status: "cold",
    source: "Event",
    estimatedValue: 4000,
    score: 35,
    createdDate: "Jan 5, 2025",
  },
  {
    id: "10",
    name: "Amanda Clark",
    email: "amanda@mediaio.com",
    status: "warm",
    source: "Referral",
    estimatedValue: 18000,
    score: 70,
    createdDate: "Jan 14, 2025",
  },
];

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
