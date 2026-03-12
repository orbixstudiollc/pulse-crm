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
  scoreBreakdown?: unknown;
  winProbability: number;
  daysInPipeline: number;
  createdDate: string;
  qualificationData?: unknown;
  qualificationGrade?: string | null;
  qualificationScore?: number | null;
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
