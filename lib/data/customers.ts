export interface Customer {
  id: string;
  firstName: string;
  lastName: string;
  name: string; // computed: firstName + lastName
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
  location: string; // computed: city + state
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

// Activity data for customer details page
export interface ActivityItem {
  id: string;
  type: "email" | "call" | "deal" | "meeting" | "note";
  title: string;
  description: string;
  badge?: {
    label: string;
    variant: "success" | "info" | "warning" | "neutral";
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
      badge: { label: "Opened", variant: "success" },
      meta: "Clicked 2 links",
    },
    {
      id: "2",
      type: "call",
      title: "Call completed: Quarterly Review",
      description:
        "30 minute call discussing renewal and expansion opportunities",
      badge: { label: "Positive", variant: "success" },
      meta: "32 min",
    },
  ],
  "2": [
    {
      id: "1",
      type: "email",
      title: "Email sent: Q4 Product Update",
      description: "Shared the latest product roadmap and upcoming features",
      badge: { label: "Opened", variant: "success" },
      meta: "Clicked 2 links",
    },
    {
      id: "2",
      type: "call",
      title: "Call completed: Quarterly Review",
      description:
        "30 minute call discussing renewal and expansion opportunities",
      badge: { label: "Positive", variant: "success" },
      meta: "32 min",
    },
    {
      id: "3",
      type: "deal",
      title: "Deal closed: Enterprise Upgrade",
      description: "Upgraded from Pro to Enterprise plan - $2,450/mo",
      badge: { label: "Won", variant: "success" },
      meta: "$29,400 ARR",
    },
    {
      id: "4",
      type: "meeting",
      title: "Meeting: API Integration Demo",
      description: "Technical deep-dive with engineering team",
      badge: { label: "Tomorrow, 2:00 PM", variant: "info" },
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
      badge: { label: "Replied", variant: "success" },
      meta: "2 hr response time",
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
};
