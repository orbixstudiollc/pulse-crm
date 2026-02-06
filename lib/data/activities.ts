// Activity types
export type ActivityType = "call" | "meeting" | "task" | "email" | "note";
export type ActivityStatus =
  | "completed"
  | "scheduled"
  | "pending"
  | "cancelled";

export interface Activity {
  id: string;
  type: ActivityType;
  title: string;
  description: string;
  status: ActivityStatus;
  date: string;
  time?: string;
  relatedTo: {
    type: "deal" | "customer" | "lead";
    name: string;
    id: string;
  };
  assignee?: string;
}

// Status configuration for badges
export const statusConfig: Record<
  ActivityStatus,
  { label: string; variant: "green" | "amber" | "red" | "neutral" }
> = {
  completed: { label: "Completed", variant: "green" },
  scheduled: { label: "Scheduled", variant: "green" },
  pending: { label: "Pending", variant: "amber" },
  cancelled: { label: "Cancelled", variant: "neutral" },
};

// Type labels
export const typeLabels: Record<ActivityType, string> = {
  call: "Call",
  meeting: "Meeting",
  task: "Task",
  email: "Email",
  note: "Note",
};

// Mock activities data
export const activities: Activity[] = [
  {
    id: "act-1",
    type: "call",
    title: "Call with Michael Chen",
    description:
      "Discussed final pricing and implementation timeline. Client is comparing with two other vendors.",
    status: "completed",
    date: "Today",
    time: "10:30 AM",
    relatedTo: { type: "deal", name: "Enterprise Suite", id: "n1" },
  },
  {
    id: "act-2",
    type: "meeting",
    title: "Product Demo Meeting",
    description:
      "Product demo with TechFlow's engineering team. Focus on API integrations.",
    status: "scheduled",
    date: "Tomorrow",
    time: "2:00 PM",
    relatedTo: { type: "customer", name: "TechFlow Inc.", id: "c1" },
  },
  {
    id: "act-3",
    type: "task",
    title: "Prepare renewal proposal",
    description:
      "Prepare Q1 contract renewal proposal with updated pricing and additional services.",
    status: "pending",
    date: "In 2 days",
    relatedTo: { type: "deal", name: "MegaCorp", id: "n1" },
  },
  {
    id: "act-4",
    type: "email",
    title: "Introduction email sent",
    description:
      "Sent introduction email with case studies and pricing overview to the team.",
    status: "completed",
    date: "Yesterday",
    relatedTo: { type: "lead", name: "StartupX", id: "l1" },
  },
  {
    id: "act-5",
    type: "call",
    title: "Discovery call with Sarah",
    description:
      "Initial discovery call to understand requirements and pain points.",
    status: "completed",
    date: "Yesterday",
    time: "3:00 PM",
    relatedTo: { type: "lead", name: "DataSync Pro", id: "l2" },
  },
  {
    id: "act-6",
    type: "meeting",
    title: "Quarterly Business Review",
    description:
      "QBR with key stakeholders to review progress and plan next quarter.",
    status: "scheduled",
    date: "Dec 28",
    time: "10:00 AM",
    relatedTo: { type: "customer", name: "Acme Corp", id: "c2" },
  },
  {
    id: "act-7",
    type: "task",
    title: "Send contract for review",
    description: "Send final contract to legal team for review before signing.",
    status: "pending",
    date: "In 3 days",
    relatedTo: { type: "deal", name: "Growth Plan", id: "n2" },
  },
  {
    id: "act-8",
    type: "email",
    title: "Follow-up email",
    description:
      "Follow-up on proposal sent last week. Check if they have any questions.",
    status: "completed",
    date: "2 days ago",
    relatedTo: { type: "deal", name: "Platform Migration", id: "p1" },
  },
  {
    id: "act-9",
    type: "call",
    title: "Technical consultation",
    description:
      "Technical deep-dive with their IT team about integration requirements.",
    status: "completed",
    date: "3 days ago",
    time: "11:00 AM",
    relatedTo: { type: "customer", name: "Global Systems", id: "c3" },
  },
  {
    id: "act-10",
    type: "meeting",
    title: "Contract negotiation",
    description: "Final contract negotiation with procurement team.",
    status: "scheduled",
    date: "Dec 30",
    time: "3:30 PM",
    relatedTo: { type: "deal", name: "Enterprise Suite", id: "n1" },
  },
  {
    id: "act-11",
    type: "task",
    title: "Update CRM records",
    description: "Update all contact information and deal stages in the CRM.",
    status: "completed",
    date: "4 days ago",
    relatedTo: { type: "customer", name: "BrightPath", id: "c4" },
  },
  {
    id: "act-12",
    type: "email",
    title: "Pricing proposal sent",
    description: "Sent custom pricing proposal based on their requirements.",
    status: "completed",
    date: "5 days ago",
    relatedTo: { type: "deal", name: "API Integration", id: "p2" },
  },
  {
    id: "act-13",
    type: "call",
    title: "Check-in call",
    description:
      "Monthly check-in call to ensure satisfaction and gather feedback.",
    status: "scheduled",
    date: "Jan 2",
    time: "9:00 AM",
    relatedTo: { type: "customer", name: "NextGen Solutions", id: "c5" },
  },
  {
    id: "act-14",
    type: "meeting",
    title: "Onboarding kickoff",
    description: "Kickoff meeting for new customer onboarding process.",
    status: "pending",
    date: "Jan 3",
    time: "1:00 PM",
    relatedTo: { type: "customer", name: "Summit Group", id: "c6" },
  },
  {
    id: "act-15",
    type: "task",
    title: "Prepare demo environment",
    description: "Set up sandbox environment for product demonstration.",
    status: "pending",
    date: "Tomorrow",
    relatedTo: { type: "lead", name: "InnovateTech", id: "l3" },
  },
  {
    id: "act-16",
    type: "email",
    title: "Meeting notes shared",
    description: "Shared meeting notes and action items from yesterday's call.",
    status: "completed",
    date: "Today",
    relatedTo: { type: "deal", name: "Custom Solution", id: "p3" },
  },
  {
    id: "act-17",
    type: "call",
    title: "Pricing discussion",
    description: "Discuss volume discounts and multi-year pricing options.",
    status: "completed",
    date: "1 week ago",
    time: "2:30 PM",
    relatedTo: { type: "deal", name: "Annual Subscription", id: "d2" },
  },
  {
    id: "act-18",
    type: "meeting",
    title: "Executive presentation",
    description: "Present solution overview to C-level executives.",
    status: "scheduled",
    date: "Jan 5",
    time: "11:00 AM",
    relatedTo: { type: "deal", name: "Enterprise", id: "d1" },
  },
  {
    id: "act-19",
    type: "task",
    title: "Create case study",
    description: "Draft case study based on successful implementation.",
    status: "pending",
    date: "In 1 week",
    relatedTo: { type: "customer", name: "FastScale", id: "c7" },
  },
  {
    id: "act-20",
    type: "email",
    title: "Welcome email",
    description: "Send welcome email with onboarding resources and next steps.",
    status: "completed",
    date: "Yesterday",
    relatedTo: { type: "customer", name: "CloudBase", id: "c8" },
  },
];

// Stats
export const activityStats = {
  totalActivities: 847,
  totalChange: "+12%",
  totalChangeLabel: "vs last month",
  callsThisWeek: 23,
  callsChange: "+5",
  callsChangeLabel: "from yesterday",
  meetingsThisWeek: 18,
  meetingsUpcoming: 3,
  meetingsLabel: "upcoming",
};

// Helper functions
export function getActivitiesByType(type: ActivityType): Activity[] {
  return activities.filter((a) => a.type === type);
}

export function getActivitiesByStatus(status: ActivityStatus): Activity[] {
  return activities.filter((a) => a.status === status);
}

export function getActivityById(id: string): Activity | undefined {
  return activities.find((a) => a.id === id);
}
