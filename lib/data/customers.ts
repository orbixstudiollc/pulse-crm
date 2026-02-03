export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  phone: string;
  avatar: string;
  status: "active" | "pending" | "inactive";
  plan: "enterprise" | "pro" | "starter" | "free";
  mrr: number;
  healthScore: number;
  lifetimeValue: number;
  tenure: number;
  lastContact: string;
  // Company
  company: string;
  jobTitle: string;
  industry: string;
  companySize: string;
  website: string;
  // Address
  streetAddress: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  location: string;
  timezone: string;
  // Dates
  customerSince: string;
  renewalDate: string;
  // Extra
  tags: string[];
  notes: string;
  customFields: { id: string; name: string; value: string }[];
}

export const customers: Customer[] = [
  {
    id: "1",
    firstName: "James",
    lastName: "Anderson",
    name: "James Anderson",
    email: "j.anderson@nextgen.io",
    phone: "+1 (555) 123-4567",
    avatar: "/images/avatars/avatar-1.jpg",
    status: "active",
    plan: "enterprise",
    mrr: 2450,
    healthScore: 92,
    lifetimeValue: 58800,
    tenure: 24,
    lastContact: "2 hours ago",
    company: "NextGen Solutions",
    jobTitle: "VP of Engineering",
    industry: "Technology",
    companySize: "201-500 employees",
    website: "nextgen.io",
    streetAddress: "100 Tech Boulevard, Suite 400",
    city: "San Francisco",
    state: "California",
    postalCode: "94105",
    country: "us",
    location: "San Francisco, CA",
    timezone: "Pacific Time (PT)",
    customerSince: "Jan 15, 2023",
    renewalDate: "Jan 15, 2025",
    tags: ["VIP", "Enterprise", "Tech", "API User"],
    notes:
      "Key enterprise account. Technical team is very engaged with our API. Expansion opportunity in Q1.",
    customFields: [
      { id: "1", name: "Lead Source", value: "Conference (TechCrunch 2022)" },
      { id: "2", name: "Customer Since", value: "January 2023" },
      { id: "3", name: "Account Manager", value: "Sarah Kim" },
      { id: "4", name: "Last Contact", value: "December 18, 2024" },
    ],
  },
  {
    id: "2",
    firstName: "Sarah",
    lastName: "Chen",
    name: "Sarah Chen",
    email: "sarah.chen@acmecorp.com",
    phone: "+1 (555) 234-5678",
    avatar: "/images/avatars/avatar-2.jpg",
    status: "active",
    plan: "enterprise",
    mrr: 2450,
    healthScore: 92,
    lifetimeValue: 58800,
    tenure: 24,
    lastContact: "2 hours ago",
    company: "Acme Corp",
    jobTitle: "VP of Engineering",
    industry: "Technology",
    companySize: "201-500 employees",
    website: "acmecorp.com",
    streetAddress: "500 Market Street",
    city: "San Francisco",
    state: "California",
    postalCode: "94102",
    country: "us",
    location: "San Francisco, CA",
    timezone: "Pacific Time (PT)",
    customerSince: "Jan 15, 2023",
    renewalDate: "Jan 15, 2025",
    tags: ["VIP", "Enterprise", "Tech", "API User"],
    notes:
      "Customer interested in API access and custom integrations. They want to build a custom dashboard for their engineering team.",
    customFields: [
      { id: "1", name: "Lead Source", value: "Referral" },
      { id: "2", name: "Customer Since", value: "January 2023" },
      { id: "3", name: "Account Manager", value: "Jennifer Kim" },
      { id: "4", name: "Last Contact", value: "December 20, 2024" },
    ],
  },
  {
    id: "3",
    firstName: "Jennifer",
    lastName: "Walsh",
    name: "Jennifer Walsh",
    email: "j.walsh@globaltech.com",
    phone: "+1 (555) 345-6789",
    avatar: "/images/avatars/avatar-3.jpg",
    status: "pending",
    plan: "enterprise",
    mrr: 4200,
    healthScore: 68,
    lifetimeValue: 75600,
    tenure: 12,
    lastContact: "1 day ago",
    company: "GlobalTech Inc",
    jobTitle: "Director of Operations",
    industry: "Finance",
    companySize: "501-1000 employees",
    website: "globaltech.com",
    streetAddress: "200 LaSalle Street",
    city: "Chicago",
    state: "Illinois",
    postalCode: "60601",
    country: "us",
    location: "Chicago, IL",
    timezone: "Central Time (CT)",
    customerSince: "Dec 10, 2023",
    renewalDate: "Dec 10, 2024",
    tags: ["Enterprise", "Finance"],
    notes: "Pending contract renewal. Need to schedule a review call.",
    customFields: [
      { id: "1", name: "Lead Source", value: "Website" },
      { id: "2", name: "Customer Since", value: "December 2023" },
      { id: "3", name: "Account Manager", value: "Mike Johnson" },
    ],
  },
  {
    id: "4",
    firstName: "David",
    lastName: "Kim",
    name: "David Kim",
    email: "david.kim@innovate.co",
    phone: "+1 (555) 456-7890",
    avatar: "/images/avatars/avatar-4.jpg",
    status: "active",
    plan: "pro",
    mrr: 299,
    healthScore: 94,
    lifetimeValue: 7176,
    tenure: 24,
    lastContact: "3 hours ago",
    company: "Innovate Co",
    jobTitle: "Product Manager",
    industry: "Healthcare",
    companySize: "51-200 employees",
    website: "innovate.co",
    streetAddress: "400 Pine Street",
    city: "Seattle",
    state: "Washington",
    postalCode: "98101",
    country: "us",
    location: "Seattle, WA",
    timezone: "Pacific Time (PT)",
    customerSince: "Jan 5, 2023",
    renewalDate: "Jan 5, 2025",
    tags: ["Pro", "Healthcare", "Active"],
    notes: "Very engaged user. Provides great product feedback.",
    customFields: [
      { id: "1", name: "Lead Source", value: "Product Hunt" },
      { id: "2", name: "Customer Since", value: "January 2023" },
    ],
  },
  {
    id: "5",
    firstName: "Emily",
    lastName: "Rodriguez",
    name: "Emily Rodriguez",
    email: "emily@designstudio.com",
    phone: "+1 (555) 567-8901",
    avatar: "/images/avatars/avatar-5.jpg",
    status: "inactive",
    plan: "starter",
    mrr: 49,
    healthScore: 32,
    lifetimeValue: 588,
    tenure: 6,
    lastContact: "2 weeks ago",
    company: "Design Studio",
    jobTitle: "Creative Director",
    industry: "Creative",
    companySize: "1-10 employees",
    website: "designstudio.com",
    streetAddress: "1200 Congress Ave",
    city: "Austin",
    state: "Texas",
    postalCode: "78701",
    country: "us",
    location: "Austin, TX",
    timezone: "Central Time (CT)",
    customerSince: "Jul 1, 2024",
    renewalDate: "Jul 1, 2025",
    tags: ["Starter", "At Risk"],
    notes: "Low engagement. Needs re-activation outreach.",
    customFields: [],
  },
  {
    id: "6",
    firstName: "Robert",
    lastName: "Patel",
    name: "Robert Patel",
    email: "r.patel@financeplus.com",
    phone: "+1 (555) 678-9012",
    avatar: "/images/avatars/avatar-6.jpg",
    status: "active",
    plan: "enterprise",
    mrr: 8500,
    healthScore: 88,
    lifetimeValue: 204000,
    tenure: 36,
    lastContact: "1 hour ago",
    company: "Finance Plus",
    jobTitle: "CTO",
    industry: "Finance",
    companySize: "1000+ employees",
    website: "financeplus.com",
    streetAddress: "One Financial Center",
    city: "Boston",
    state: "Massachusetts",
    postalCode: "02111",
    country: "us",
    location: "Boston, MA",
    timezone: "Eastern Time (ET)",
    customerSince: "Jan 1, 2022",
    renewalDate: "Jan 1, 2025",
    tags: ["VIP", "Enterprise", "Finance", "Key Account"],
    notes: "Largest enterprise account. Very strategic relationship.",
    customFields: [
      { id: "1", name: "Lead Source", value: "Enterprise Sales" },
      { id: "2", name: "Customer Since", value: "January 2022" },
      { id: "3", name: "Account Manager", value: "Sarah Kim" },
      { id: "4", name: "Contract Value", value: "$102,000/year" },
    ],
  },
];

// Helper function to get customer by ID
export function getCustomerById(id: string): Customer | undefined {
  return customers.find((c) => c.id === id);
}

export interface ActivityItem {
  id: string;
  type: "email" | "call" | "deal" | "meeting" | "note";
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

export const activityByCustomerId: Record<string, ActivityItem[]> = {
  "1": [
    {
      id: "1",
      type: "email",
      title: "Email sent: Q4 Product Update",
      description: "Shared the latest product roadmap and upcoming features",
      badge: { label: "Opened", variant: "green" },
      meta: "Clicked 2 links",
    },
    {
      id: "2",
      type: "call",
      title: "Call completed: Quarterly Review",
      description:
        "30 minute call discussing renewal and expansion opportunities",
      badge: { label: "Positive", variant: "green" },
      meta: "32 min",
    },
    {
      id: "3",
      type: "meeting",
      title: "Meeting: Technical Integration Review",
      description: "Reviewed API implementation with engineering team",
      badge: { label: "Completed", variant: "green" },
      meta: "3 attendees",
    },
    {
      id: "4",
      type: "note",
      title: "Note added",
      description:
        "Team is interested in expanding to 3 additional departments",
    },
  ],
  "2": [
    {
      id: "1",
      type: "email",
      title: "Email sent: Q4 Product Update",
      description: "Shared the latest product roadmap and upcoming features",
      badge: { label: "Opened", variant: "green" },
      meta: "Clicked 2 links",
    },
    {
      id: "2",
      type: "call",
      title: "Call completed: Quarterly Review",
      description:
        "30 minute call discussing renewal and expansion opportunities",
      badge: { label: "Positive", variant: "green" },
      meta: "32 min",
    },
    {
      id: "3",
      type: "deal",
      title: "Deal closed: Enterprise Upgrade",
      description: "Upgraded from Pro to Enterprise plan - $2,450/mo",
      badge: { label: "Won", variant: "green" },
      meta: "$29,400 ARR",
    },
    {
      id: "4",
      type: "meeting",
      title: "Meeting: API Integration Demo",
      description: "Technical deep-dive with engineering team",
      badge: { label: "Tomorrow, 2:00 PM", variant: "blue" },
      meta: "4 attendees",
    },
    {
      id: "5",
      type: "note",
      title: "Note added",
      description: "Customer interested in API access and custom integrations",
    },
    {
      id: "6",
      type: "email",
      title: "Email received: Feature Request",
      description: "Requested Salesforce integration",
      badge: { label: "Replied", variant: "green" },
      meta: "2 hr response time",
    },
  ],
  "3": [
    {
      id: "1",
      type: "email",
      title: "Email sent: Renewal Reminder",
      description: "Contract renewal coming up in 30 days",
      badge: { label: "Opened", variant: "green" },
      meta: "1 click",
    },
    {
      id: "2",
      type: "call",
      title: "Call attempted: Renewal Discussion",
      description: "Left voicemail about upcoming renewal",
      badge: { label: "No Answer", variant: "amber" },
      meta: "2 min",
    },
    {
      id: "3",
      type: "meeting",
      title: "Meeting scheduled: Renewal Discussion",
      description: "Review contract terms and expansion options",
      badge: { label: "Next Week", variant: "blue" },
      meta: "2 attendees",
    },
    {
      id: "4",
      type: "note",
      title: "Note added",
      description:
        "Jennifer mentioned budget concerns - may need to discuss pricing",
    },
  ],
  "4": [
    {
      id: "1",
      type: "call",
      title: "Call completed: Product Feedback",
      description: "David shared ideas for new dashboard features",
      badge: { label: "Positive", variant: "green" },
      meta: "45 min",
    },
    {
      id: "2",
      type: "email",
      title: "Email sent: Feature Update",
      description: "Shared updates on requested features from last call",
      badge: { label: "Opened", variant: "green" },
      meta: "Clicked 3 links",
    },
    {
      id: "3",
      type: "note",
      title: "Note added",
      description: "Very engaged user, potential case study candidate",
    },
    {
      id: "4",
      type: "meeting",
      title: "Meeting: Product Roadmap Preview",
      description: "Exclusive preview of Q1 features",
      badge: { label: "Completed", variant: "green" },
      meta: "2 attendees",
    },
  ],
  "5": [
    {
      id: "1",
      type: "email",
      title: "Email sent: Re-engagement Campaign",
      description: "Sent tips and best practices guide",
      badge: { label: "Not Opened", variant: "amber" },
    },
    {
      id: "2",
      type: "email",
      title: "Email sent: Special Offer",
      description: "Offered 20% discount for annual commitment",
      badge: { label: "Not Opened", variant: "amber" },
    },
    {
      id: "3",
      type: "call",
      title: "Call attempted: Check-in",
      description: "Attempted to reach Emily for a quick check-in",
      badge: { label: "No Answer", variant: "amber" },
      meta: "Left voicemail",
    },
    {
      id: "4",
      type: "note",
      title: "Note added",
      description: "At risk of churning. Last login was 3 weeks ago.",
    },
  ],
  "6": [
    {
      id: "1",
      type: "deal",
      title: "Deal closed: Annual Contract Renewal",
      description: "Renewed enterprise contract for another year",
      badge: { label: "Won", variant: "green" },
      meta: "$102,000 ARR",
    },
    {
      id: "2",
      type: "call",
      title: "Call completed: Executive Review",
      description: "Quarterly business review with CTO",
      badge: { label: "Positive", variant: "green" },
      meta: "1 hour",
    },
    {
      id: "3",
      type: "meeting",
      title: "Meeting: Roadmap Preview",
      description: "Exclusive preview of upcoming enterprise features",
      badge: { label: "Completed", variant: "green" },
      meta: "5 attendees",
    },
    {
      id: "4",
      type: "email",
      title: "Email sent: Executive Summary",
      description: "Quarterly ROI report and usage analytics",
      badge: { label: "Opened", variant: "green" },
      meta: "Forwarded to team",
    },
    {
      id: "5",
      type: "note",
      title: "Note added",
      description:
        "Robert mentioned potential for expanding to European offices in Q2",
    },
    {
      id: "6",
      type: "meeting",
      title: "Meeting: Strategic Planning",
      description: "2025 roadmap alignment with Finance Plus goals",
      badge: { label: "Jan 15, 2025", variant: "blue" },
      meta: "6 attendees",
    },
  ],
};

// Notes data
export interface Note {
  id: string;
  author: string;
  date: string;
  content: string;
}

export const notesByCustomerId: Record<string, Note[]> = {
  "1": [
    {
      id: "1",
      author: "You",
      date: "Dec 18, 2024",
      content:
        "Key enterprise account. Technical team is very engaged with our API. Discussed expansion to 3 additional departments in Q1.",
    },
    {
      id: "2",
      author: "Sarah Kim",
      date: "Dec 5, 2024",
      content:
        "Had a great quarterly review call. James is very happy with the platform performance and mentioned they want to explore our analytics features.",
    },
  ],
  "2": [
    {
      id: "1",
      author: "You",
      date: "Dec 10, 2025",
      content:
        "Customer interested in API access and custom integrations. They want to build a custom dashboard for their engineering team. Follow up next week with technical documentation.",
    },
    {
      id: "2",
      author: "You",
      date: "Nov 28, 2025",
      content:
        "Great quarterly review call. Sarah mentioned they're expanding their team and might need additional seats in Q1. Very happy with the product so far.",
    },
  ],
  "3": [
    {
      id: "1",
      author: "You",
      date: "Dec 1, 2024",
      content:
        "Pending contract renewal. Jennifer mentioned some budget constraints. Need to schedule a review call before Dec 10th deadline to discuss options.",
    },
    {
      id: "2",
      author: "Mike Johnson",
      date: "Nov 15, 2024",
      content:
        "Health score dropped from 82 to 68 last month. Usage has declined. Need to investigate root cause and re-engage.",
    },
  ],
  "4": [
    {
      id: "1",
      author: "You",
      date: "Dec 12, 2024",
      content:
        "David is one of our most engaged Pro users. Provides excellent product feedback. Strong candidate for case study or testimonial.",
    },
    {
      id: "2",
      author: "You",
      date: "Nov 20, 2024",
      content:
        "Discussed potential upgrade to Enterprise. David said he needs to get budget approval first. Will follow up in January.",
    },
  ],
  "5": [
    {
      id: "1",
      author: "You",
      date: "Nov 15, 2024",
      content:
        "Low engagement - hasn't logged in for 3 weeks. Sent re-engagement email campaign but no response. Consider phone outreach.",
    },
    {
      id: "2",
      author: "You",
      date: "Oct 28, 2024",
      content:
        "Emily mentioned her team is very small and may not need all features. At risk of downgrading or churning.",
    },
  ],
  "6": [
    {
      id: "1",
      author: "You",
      date: "Dec 20, 2024",
      content:
        "Largest enterprise account. Very strategic relationship. Robert mentioned potential for expanding to their European offices in Q2 2025.",
    },
    {
      id: "2",
      author: "Sarah Kim",
      date: "Dec 5, 2024",
      content:
        "Completed annual contract renewal for $102,000. They're very happy with the platform and considering adding more seats for their Boston and London teams.",
    },
    {
      id: "3",
      author: "You",
      date: "Nov 10, 2024",
      content:
        "Executive review went great. CFO joined the call and was impressed with the ROI metrics we presented. Strong advocate internally.",
    },
  ],
};
