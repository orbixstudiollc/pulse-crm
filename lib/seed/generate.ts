import type { Database } from "@/types/database";

// Pure, edge-safe demo data generator shared by the "Seed Demo Data" action
// and guest workspace provisioning. No I/O here: insertSeed (./insert.ts)
// writes the bundle and resolves each child row's `parentIndex` to the id of
// the parent row inserted at that index.

type Tables = Database["public"]["Tables"];
export type CustomerInsert = Tables["customers"]["Insert"];
export type LeadInsert = Tables["leads"]["Insert"];
export type DealInsert = Tables["deals"]["Insert"];
export type ContactInsert = Tables["contacts"]["Insert"];
export type ActivityInsert = Tables["activities"]["Insert"];
export type CompetitorInsert = Tables["competitors"]["Insert"];
export type BattleCardInsert = Tables["battle_cards"]["Insert"];
export type ObjectionInsert = Tables["objection_playbook"]["Insert"];
export type SequenceInsert = Tables["sequences"]["Insert"];
export type SequenceStepInsert = Tables["sequence_steps"]["Insert"];
export type IcpProfileInsert = Tables["icp_profiles"]["Insert"];
export type ScoringProfileInsert = Tables["scoring_profiles"]["Insert"];
export type ProposalInsert = Tables["proposals"]["Insert"];
export type EmailTemplateInsert = Tables["email_templates"]["Insert"];
export type CopyTemplateInsert = Tables["copy_templates"]["Insert"];
export type CalendarEventInsert = Tables["calendar_events"]["Insert"];

/** A row whose foreign key `FK` is filled in by insertSeed from the parent at `parentIndex`. */
export type SeedChild<T, FK extends keyof T> = Omit<T, FK> & { parentIndex: number };

export interface SeedBundle {
  customers: CustomerInsert[];
  leads: LeadInsert[];
  /** parentIndex -> customers (customer_id) */
  deals: SeedChild<DealInsert, "customer_id">[];
  /** parentIndex -> customers (customer_id) */
  contacts: SeedChild<ContactInsert, "customer_id">[];
  /** parentIndex -> customers (related_id, related_type "customer") */
  activities: SeedChild<ActivityInsert, "related_id">[];
  competitors: CompetitorInsert[];
  /** parentIndex -> competitors (competitor_id) */
  battleCards: SeedChild<BattleCardInsert, "competitor_id">[];
  objections: ObjectionInsert[];
  sequences: SequenceInsert[];
  /** parentIndex -> sequences (sequence_id) */
  sequenceSteps: SeedChild<SequenceStepInsert, "sequence_id">[];
  icpProfiles: IcpProfileInsert[];
  scoringProfile: ScoringProfileInsert;
  /** parentIndex -> deals (deal_id) */
  proposals: SeedChild<ProposalInsert, "deal_id">[];
  emailTemplates: EmailTemplateInsert[];
  copyTemplates: CopyTemplateInsert[];
  calendarEvents: CalendarEventInsert[];
}

// ── Sample Data ─────────────────────────────────────────────────────────────

const COMPANIES = [
  "TechNova Solutions", "Quantum Digital", "Apex Dynamics", "BlueStar Analytics",
  "CloudForge Inc", "DataPulse Corp", "EverGreen AI", "FlowState Labs",
  "GigaByte Systems", "HyperLoop Tech", "InnoVault", "JetStream Software",
  "KineticWave", "LunarGrid", "MetaSphere", "NexGen Cloud",
  "OmniStack", "PivotPoint Inc", "QuasarTech", "RippleEffect Digital",
];

const FIRST_NAMES = [
  "James", "Sarah", "Michael", "Emily", "David", "Jessica", "Robert",
  "Ashley", "William", "Amanda", "Thomas", "Megan", "Christopher", "Lauren",
  "Daniel", "Rachel", "Andrew", "Nicole", "Matthew", "Stephanie",
];

const LAST_NAMES = [
  "Anderson", "Brooks", "Carter", "Davis", "Edwards", "Foster", "Garcia",
  "Hamilton", "Irving", "Johnson", "Kennedy", "Lawrence", "Mitchell",
  "Nelson", "Owens", "Palmer", "Quinn", "Roberts", "Sullivan", "Turner",
];

const INDUSTRIES = [
  "Technology", "Finance", "Healthcare", "E-commerce", "SaaS",
  "Manufacturing", "Education", "Real Estate", "Marketing", "Consulting",
];

const LOCATIONS = [
  "New York", "San Francisco", "London", "Berlin", "Toronto",
  "Austin", "Chicago", "Seattle", "Boston", "Denver",
];

const LEAD_SOURCES: Array<"Website" | "Referral" | "LinkedIn" | "Event" | "Google Ads" | "Cold Call"> = [
  "Website", "Referral", "LinkedIn", "Event", "Google Ads", "Cold Call",
];

const LEAD_STATUSES: Array<"hot" | "warm" | "cold"> = ["hot", "warm", "cold"];

const DEAL_STAGES: Array<"discovery" | "proposal" | "negotiation" | "closed_won" | "closed_lost"> = [
  "discovery", "proposal", "negotiation", "closed_won", "closed_lost",
];

const CUSTOMER_STATUSES: Array<"active" | "pending" | "inactive"> = [
  "active", "active", "active", "pending", "inactive", "active",
];

const CUSTOMER_PLANS: Array<"free" | "starter" | "pro" | "enterprise"> = [
  "free", "starter", "pro", "enterprise",
];

const ACTIVITY_TYPES: Array<"call" | "email" | "meeting" | "note" | "task"> = [
  "call", "email", "meeting", "note", "task",
];

const JOB_TITLES = [
  "CEO", "CTO", "VP of Sales", "Head of Marketing", "Product Manager",
  "Engineering Lead", "Director of Operations", "CFO", "COO", "VP Engineering",
  "Sales Director", "Marketing Manager", "Business Development Manager",
  "Account Executive", "Solutions Architect",
];

const OBJECTIONS = [
  {
    text: "Your solution is too expensive for our budget",
    category: "pricing",
    hidden: "They may not see the ROI clearly or are comparing to cheaper alternatives",
    ffr: "I understand budget is important. Many clients initially felt the same way, but found that our solution actually reduced their total costs by 30% within 6 months through automated workflows and efficiency gains.",
    abc: "Acknowledge the concern, bridge to value by comparing total cost of ownership, and close by offering a tailored pricing proposal.",
    followUp: "What would the ROI need to look like for this to make sense for your budget?",
    proof: "Case study: TechNova reduced operational costs by 35% in Q1 after implementation.",
  },
  {
    text: "We're already using a competitor's solution",
    category: "competition",
    hidden: "They may have pain points with their current solution but switching costs seem high",
    ffr: "That's great that you're already invested in this area. Many of our happiest clients switched from similar solutions. What specifically works well for you, and what could be better?",
    abc: "Acknowledge their investment, bridge by asking about gaps, close with a comparison demo.",
    followUp: "If I could show you 3 specific areas where we outperform, would that be worth 30 minutes?",
    proof: "67% of our enterprise clients migrated from a competitor within 2 weeks with zero downtime.",
  },
  {
    text: "We don't have time to implement a new solution right now",
    category: "timing",
    hidden: "Implementation complexity or change management is the real concern",
    ffr: "Timing is crucial. Our implementation team handles 90% of the setup, and most clients are fully operational within 5 business days.",
    abc: "Acknowledge the timing concern, bridge to our rapid onboarding process, close with a pilot option.",
    followUp: "If we could get you live in under a week, would Q2 be a good starting point?",
    proof: "Average implementation time: 4.2 business days for teams up to 50 users.",
  },
  {
    text: "I need to discuss this with my team before making a decision",
    category: "authority",
    hidden: "They may lack authority to decide alone, or need to build internal consensus",
    ffr: "Absolutely, getting team buy-in is important for success. Would it help if I prepared a brief for your team, or joined a quick call to answer their questions?",
    abc: "Acknowledge the need for consensus, bridge by offering support materials, close by scheduling a team demo.",
    followUp: "Who else would be involved in this decision? I'd love to address their specific concerns.",
    proof: "We provide ROI calculators and executive summaries that have helped 80% of prospects get internal approval within 1 week.",
  },
  {
    text: "I'm not sure your solution can handle our specific use case",
    category: "need",
    hidden: "They have a unique workflow that they're worried won't be supported",
    ffr: "That's a valid concern. Can you walk me through your specific workflow? We've successfully adapted to many unique use cases.",
    abc: "Acknowledge the specificity, bridge with a custom demo, close with a proof of concept offer.",
    followUp: "Would a 2-week proof of concept with your actual data help you evaluate the fit?",
    proof: "Custom configuration success rate: 96% of custom requirements met within standard implementation.",
  },
  {
    text: "We had a bad experience with a similar product before",
    category: "implementation",
    hidden: "Past failure created institutional resistance to trying new solutions",
    ffr: "I'm sorry to hear that. Can you share what went wrong? Understanding that helps us ensure a different outcome this time.",
    abc: "Acknowledge the bad experience, bridge to our support model and guarantees, close with a risk-free trial.",
    followUp: "What would need to be different this time for you to feel confident?",
    proof: "98% customer satisfaction score with a dedicated success manager assigned to every account.",
  },
];

const COMPETITORS = [
  {
    name: "RivalCRM Pro",
    website: "https://rivalcrm.com",
    category: "direct",
    description: "Full-featured CRM platform targeting mid-market companies with AI capabilities.",
    strengths: ["Strong brand recognition", "Large partner ecosystem", "Mobile app"],
    weaknesses: ["Complex pricing", "Slow customer support", "Outdated UI"],
  },
  {
    name: "SalesForce Ultra",
    website: "https://salesforceultra.com",
    category: "aspirational",
    description: "Enterprise-grade sales platform with extensive customization options.",
    strengths: ["Enterprise features", "Extensive API", "Global presence"],
    weaknesses: ["Expensive", "Steep learning curve", "Over-engineered for SMB"],
  },
  {
    name: "LiteCRM",
    website: "https://litecrm.io",
    category: "indirect",
    description: "Lightweight and affordable CRM for small teams.",
    strengths: ["Low price", "Easy setup", "Clean interface"],
    weaknesses: ["Limited features", "No AI capabilities", "Poor reporting"],
  },
  {
    name: "HubZone Sales",
    website: "https://hubzonesales.com",
    category: "direct",
    description: "All-in-one sales and marketing platform with free tier.",
    strengths: ["Free tier", "Marketing integration", "Content tools"],
    weaknesses: ["Lock-in effect", "Expensive at scale", "Limited customization"],
  },
];

const SEQUENCES = [
  { name: "New Lead Welcome Series", description: "Nurture sequence for new inbound leads", status: "active" as const, category: "nurture", total_steps: 3 },
  { name: "Enterprise Outreach", description: "Strategic multi-channel outreach for enterprise prospects", status: "active" as const, category: "cold_outreach", total_steps: 3 },
];

const SEQUENCE_STEP_TYPES = ["email", "wait", "email"];

const ICP_PROFILES = [
  {
    name: "Enterprise SaaS",
    description: "Large SaaS companies with 200+ employees seeking workflow tooling",
    is_primary: true,
    color: "#6366f1",
    criteria: {
      firmographic: {
        industries: ["Technology", "SaaS", "Finance"],
        company_sizes: ["51-200", "201-500", "501-1000", "1001-5000", "5000+"],
        employee_range: { min: 200, max: 10000 },
        geography: ["North America", "Europe"],
      },
      technographic: { tech_stack: ["Cloud", "API-first"], tech_sophistication_min: 0 },
      behavioral: { buying_patterns: [], trigger_events: [] },
      pain_points: [
        { name: "Manual processes", severity: 8 },
        { name: "Data silos", severity: 7 },
        { name: "Scaling challenges", severity: 6 },
      ],
      budget: { revenue_range: { min: 5000000, max: null }, deal_size_sweet_spot: null, funding_stages: [] },
      channel: { preferred_contact_methods: [], content_preferences: [] },
    },
    weights: { industry: 20, size: 25, revenue: 20, title: 10, geography: 10, tech: 15 },
  },
  {
    name: "Growth-Stage Startup",
    description: "Fast-growing startups with 20-200 employees looking for scalable CRM",
    is_primary: false,
    color: "#10b981",
    criteria: {
      firmographic: {
        industries: ["Technology", "E-commerce", "Marketing"],
        company_sizes: ["11-50", "51-200"],
        employee_range: { min: 20, max: 200 },
        geography: ["North America"],
      },
      technographic: { tech_stack: [], tech_sophistication_min: 0 },
      behavioral: { buying_patterns: [], trigger_events: ["20%+ YoY growth"] },
      pain_points: [
        { name: "Outgrowing current tools", severity: 8 },
        { name: "Too much manual work", severity: 7 },
      ],
      budget: { revenue_range: { min: 1000000, max: null }, deal_size_sweet_spot: null, funding_stages: [] },
      channel: { preferred_contact_methods: [], content_preferences: [] },
    },
    weights: { industry: 20, size: 20, revenue: 15, title: 15, geography: 15, tech: 15 },
  },
];

const EMAIL_TEMPLATES = [
  {
    name: "Cold Outreach",
    category: "cold_outreach",
    subject: "Quick question about {{company}}",
    body: "Hi {{first_name}},\n\nI noticed {{company}} is growing rapidly in the {{industry}} space. We help similar companies streamline their sales process with AI-powered CRM.\n\nWould you be open to a 15-minute call this week?\n\nBest,\n{{sender_name}}",
    merge_fields: ["first_name", "company", "industry", "sender_name"],
  },
  {
    name: "Follow-Up After Demo",
    category: "follow_up",
    subject: "Re: {{company}} demo follow-up",
    body: "Hi {{first_name}},\n\nThank you for taking the time to see our demo. I wanted to follow up on the key points we discussed.\n\nAs mentioned, our platform can help {{company}} with:\n- Automated lead scoring\n- AI-powered outreach sequences\n- Real-time pipeline analytics\n\nShall we schedule a next step?\n\nBest regards",
    merge_fields: ["first_name", "company"],
  },
  {
    name: "Proposal Sent",
    category: "general",
    subject: "Your personalized proposal from Pulse CRM",
    body: "Hi {{first_name}},\n\nPlease find attached our tailored proposal for {{company}}. I've included three pricing options to match your needs and budget.\n\nI'm available to discuss any questions you may have.\n\nBest regards",
    merge_fields: ["first_name", "company"],
  },
  {
    name: "Re-engagement",
    category: "re_engagement",
    subject: "Been a while, {{first_name}} — new updates from Pulse",
    body: "Hi {{first_name}},\n\nIt's been a while since we last connected. I wanted to share some exciting updates that might be relevant for {{company}}.\n\nWe've recently launched AI-powered features that could help your team close deals faster.\n\nWould you be interested in a quick catch-up?\n\nBest",
    merge_fields: ["first_name", "company"],
  },
  {
    name: "Meeting Confirmation",
    category: "meeting",
    subject: "Confirmed: our call with {{company}}",
    body: "Hi {{first_name}},\n\nThanks for booking time with us. I'm looking forward to learning more about {{company}} and your goals for this quarter.\n\nIf anything changes, just reply to this email.\n\nBest,\n{{sender_name}}",
    merge_fields: ["first_name", "company", "sender_name"],
  },
  {
    name: "Welcome Aboard",
    category: "nurture",
    subject: "Welcome to Pulse CRM, {{first_name}}",
    body: "Hi {{first_name}},\n\nWelcome aboard! Your onboarding specialist will reach out within one business day to help {{company}} get set up.\n\nIn the meantime, feel free to explore the dashboard.\n\nBest regards",
    merge_fields: ["first_name", "company"],
  },
];

const COPY_TEMPLATES = [
  {
    name: "LinkedIn Connection Request",
    category: "Social",
    headline: "Let's connect!",
    body: "Hi {{name}}, I noticed we share interests in {{industry}}. I'd love to connect and exchange ideas about scaling sales teams with AI.",
    cta: "Connect",
    tags: ["linkedin", "social", "networking"],
  },
  {
    name: "Product Launch Announcement",
    category: "Marketing",
    headline: "Introducing AI-Powered Sales Intelligence",
    body: "We're excited to announce our latest feature: AI-driven insights that help you close deals 40% faster. See how it works in 60 seconds.",
    cta: "Watch Demo",
    tags: ["launch", "marketing", "product"],
  },
  {
    name: "Case Study Teaser",
    category: "Content",
    headline: "How TechNova Grew Revenue 200% with Pulse CRM",
    body: "See how TechNova leveraged AI scoring and automated outreach to transform their sales process and triple their pipeline value.",
    cta: "Read Case Study",
    tags: ["case-study", "social-proof", "content"],
  },
  {
    name: "Webinar Invite",
    category: "Events",
    headline: "Live: Building a Predictable Pipeline",
    body: "Join our sales leaders for a 30-minute session on forecasting, lead scoring and follow-up cadences that actually work.",
    cta: "Save My Seat",
    tags: ["webinar", "events", "education"],
  },
  {
    name: "Free Trial Offer",
    category: "Marketing",
    headline: "Try Pulse CRM Free for 14 Days",
    body: "Import your leads, score them automatically and see your whole pipeline in one place. No credit card required.",
    cta: "Start Free Trial",
    tags: ["trial", "acquisition", "marketing"],
  },
  {
    name: "Customer Testimonial",
    category: "Content",
    headline: "\"We closed 3x more deals in our first quarter\"",
    body: "Hear from the teams who replaced spreadsheets with Pulse CRM and never looked back.",
    cta: "Read Their Story",
    tags: ["testimonial", "social-proof", "content"],
  },
];

const CALENDAR_TITLES = [
  "Discovery Call", "Product Demo", "Proposal Review",
  "Team Standup", "Client Check-in", "Pipeline Review",
  "Quarterly Business Review", "Strategy Planning",
];

// ── Helpers ─────────────────────────────────────────────────────────────────

interface Rand {
  pick<T>(arr: readonly T[]): T;
  between(min: number, max: number): number;
  pastDate(daysBack: number): string;
  futureDate(daysAhead: number): string;
}

// Dates are day-precision (YYYY-MM-DD) so a fixed rng yields identical output.
function makeRand(rng: () => number): Rand {
  const day = (offset: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offset);
    return d.toISOString().split("T")[0];
  };
  return {
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)],
    between: (min, max) => Math.floor(rng() * (max - min + 1)) + min,
    pastDate: (daysBack) => day(-Math.floor(rng() * daysBack)),
    futureDate: (daysAhead) => day(Math.floor(rng() * daysAhead) + 1),
  };
}

function domainOf(company: string): string {
  return company.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
}

function generateEmail(firstName: string, lastName: string, company: string): string {
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domainOf(company)}`;
}

function generatePhone(r: Rand): string {
  return `+1${r.between(200, 999)}${r.between(100, 999)}${r.between(1000, 9999)}`;
}

// ── Builders ────────────────────────────────────────────────────────────────

function buildCustomers(orgId: string, r: Rand): CustomerInsert[] {
  return Array.from({ length: 12 }, (_, i) => {
    const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
    const lastName = LAST_NAMES[i % LAST_NAMES.length];
    const company = COMPANIES[i % COMPANIES.length];
    return {
      organization_id: orgId,
      first_name: firstName,
      last_name: lastName,
      email: generateEmail(firstName, lastName, company),
      phone: generatePhone(r),
      company,
      job_title: r.pick(JOB_TITLES),
      industry: r.pick(INDUSTRIES),
      status: r.pick(CUSTOMER_STATUSES),
      plan: r.pick(CUSTOMER_PLANS),
      mrr: r.between(50, 5000),
      health_score: r.between(30, 100),
      lifetime_value: r.between(500, 50000),
      customer_since: r.pastDate(365),
      tags: [r.pick(INDUSTRIES), r.pick(["Enterprise", "SMB", "Mid-Market"])],
    };
  });
}

function buildLeads(orgId: string, r: Rand): LeadInsert[] {
  return Array.from({ length: 20 }, (_, i) => {
    const firstName = FIRST_NAMES[(i + 5) % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(i + 3) % LAST_NAMES.length];
    const company = COMPANIES[(i + 7) % COMPANIES.length];
    const status = r.pick(LEAD_STATUSES);
    return {
      organization_id: orgId,
      name: `${firstName} ${lastName}`,
      email: generateEmail(firstName, lastName, company),
      company,
      phone: generatePhone(r),
      industry: r.pick(INDUSTRIES),
      website: `https://${domainOf(company)}`,
      status,
      source: r.pick(LEAD_SOURCES),
      estimated_value: r.between(1000, 100000),
      score: status === "hot" ? r.between(70, 100) : status === "warm" ? r.between(40, 70) : r.between(10, 40),
      employees: r.between(10, 5000).toString(),
      location: r.pick(LOCATIONS),
    };
  });
}

function buildDeals(orgId: string, customers: CustomerInsert[], r: Rand): SeedBundle["deals"] {
  return Array.from({ length: 10 }, (_, i) => {
    const parentIndex = i % customers.length;
    const customer = customers[parentIndex];
    const stage = DEAL_STAGES[i % DEAL_STAGES.length];
    const closed = stage === "closed_won" || stage === "closed_lost";
    return {
      parentIndex,
      organization_id: orgId,
      name: `${r.pick(["Enterprise", "Pro", "Growth", "Standard", "Custom"])} Deal — ${customer.company}`,
      company: customer.company,
      value: r.between(5000, 150000),
      probability: stage === "closed_won" ? 100 : stage === "closed_lost" ? 0 : r.between(20, 90),
      stage,
      close_date: closed ? r.pastDate(30) : r.futureDate(60),
      contact_name: `${customer.first_name} ${customer.last_name}`,
      contact_email: customer.email,
      days_in_stage: r.between(1, 30),
    };
  });
}

function buildContacts(orgId: string, customers: CustomerInsert[], r: Rand): SeedBundle["contacts"] {
  return Array.from({ length: 12 }, (_, i) => {
    const parentIndex = i % customers.length;
    const firstName = FIRST_NAMES[(i + 10) % FIRST_NAMES.length];
    const lastName = LAST_NAMES[(i + 8) % LAST_NAMES.length];
    return {
      parentIndex,
      organization_id: orgId,
      name: `${firstName} ${lastName}`,
      email: generateEmail(firstName, lastName, customers[parentIndex].company ?? COMPANIES[i]),
      phone: generatePhone(r),
      title: r.pick(JOB_TITLES),
      buying_role: r.pick(["economic_buyer", "technical_evaluator", "champion", "blocker", "end_user"]),
      influence_level: r.pick(["high", "medium", "low"]),
      linkedin: `https://linkedin.com/in/${firstName.toLowerCase()}${lastName.toLowerCase()}`,
    };
  });
}

function activityTitle(type: (typeof ACTIVITY_TYPES)[number], company: string, r: Rand): string {
  if (type === "call") return `Follow-up call with ${company}`;
  if (type === "email") return `Sent proposal to ${company}`;
  if (type === "meeting") return `Demo meeting with ${company}`;
  if (type === "note") return `Research notes on ${r.pick(INDUSTRIES)} market`;
  return `Follow up on ${company} requirement`;
}

function buildActivities(orgId: string, customers: CustomerInsert[], r: Rand): SeedBundle["activities"] {
  return Array.from({ length: 20 }, (_, i) => {
    const parentIndex = i % customers.length;
    const company = customers[parentIndex].company ?? COMPANIES[parentIndex];
    const type = ACTIVITY_TYPES[i % ACTIVITY_TYPES.length];
    return {
      parentIndex,
      organization_id: orgId,
      type,
      title: activityTitle(type, company, r),
      description: "Activity created during seed data generation.",
      status: r.pick(["completed", "pending", "scheduled"] as const),
      date: r.pastDate(30),
      time: `${r.between(9, 17).toString().padStart(2, "0")}:00`,
      related_type: "customer" as const,
      related_name: company,
    };
  });
}

function buildSequenceSteps(r: Rand): SeedBundle["sequenceSteps"] {
  return SEQUENCES.flatMap((seq, parentIndex) =>
    SEQUENCE_STEP_TYPES.slice(0, seq.total_steps).map((type, idx) => ({
      parentIndex,
      step_order: idx + 1,
      step_type: type,
      delay_days: type === "wait" ? r.between(2, 5) : idx === 0 ? 0 : r.between(1, 3),
      subject: type === "email" ? `Step ${idx + 1}: ${r.pick(["Introduction", "Follow-up", "Value Proposition", "Case Study", "Next Steps"])}` : null,
      body: type === "email" ? `Hi {{first_name}},\n\nThis is step ${idx + 1} of the ${seq.name}.\n\nBest regards` : null,
      channel: type === "email" ? "email" : "none",
    })),
  );
}

function buildProposals(orgId: string, deals: SeedBundle["deals"], r: Rand): SeedBundle["proposals"] {
  return deals.slice(0, 3).map((deal, parentIndex) => ({
    parentIndex,
    organization_id: orgId,
    title: `Proposal for ${deal.name}`,
    status: parentIndex < 2 ? "sent" : "draft",
    content: {
      executive_summary: `This proposal outlines our recommended solution for ${deal.name}.`,
      solution_overview: "Our platform provides AI-powered CRM with automated scoring, outreach, and analytics.",
      pricing_section: "See attached pricing tiers below.",
      next_steps: ["Schedule implementation kickoff", "Sign agreement", "Begin onboarding"],
    },
    pricing_tiers: {
      good: { name: "Starter", price: 99, features: ["5 users", "Basic CRM", "Email support"] },
      better: { name: "Professional", price: 249, features: ["25 users", "AI features", "Priority support"] },
      best: { name: "Enterprise", price: 499, features: ["Unlimited users", "Full AI suite", "Dedicated CSM"] },
    },
    valid_until: r.futureDate(30),
  }));
}

function buildCalendarEvents(orgId: string, r: Rand): CalendarEventInsert[] {
  return Array.from({ length: 8 }, () => {
    const start = r.between(9, 16);
    return {
      organization_id: orgId,
      title: r.pick(CALENDAR_TITLES),
      date: r.futureDate(14),
      start_time: `${start.toString().padStart(2, "0")}:00`,
      end_time: `${(start + 1).toString().padStart(2, "0")}:00`,
      type: r.pick(["meeting", "call", "task", "reminder"]),
      status: r.pick(["scheduled", "confirmed"]),
      related_type: r.pick(["lead", "customer", "deal"] as const),
      related_name: r.pick(COMPANIES),
    };
  });
}

// ── Public API ──────────────────────────────────────────────────────────────

export function generateSeed(orgId: string, rng: () => number = Math.random): SeedBundle {
  const r = makeRand(rng);
  const customers = buildCustomers(orgId, r);
  const deals = buildDeals(orgId, customers, r);
  const competitors = COMPETITORS.map((c) => ({ organization_id: orgId, ...c }));

  return {
    customers,
    leads: buildLeads(orgId, r),
    deals,
    contacts: buildContacts(orgId, customers, r),
    activities: buildActivities(orgId, customers, r),
    competitors,
    battleCards: competitors.map((comp, parentIndex) => ({
      parentIndex,
      their_strengths: ["Market presence", "Brand recognition"],
      their_weaknesses: ["Slow innovation", "Poor support"],
      our_advantages: ["AI-powered features", "Better pricing", "Faster onboarding"],
      switching_costs: { estimated_time: "2 weeks", estimated_cost: "$2,000" },
      switching_triggers: ["Contract renewal", "Price increase", "Feature gaps"],
      landmine_questions: [
        "How does their AI compare to real-time scoring?",
        "What's their average support response time?",
      ],
      positioning_statement: `Unlike ${comp.name}, Pulse CRM provides AI-powered insights with a modern, intuitive interface at a competitive price point.`,
    })),
    objections: OBJECTIONS.map((o) => ({
      organization_id: orgId,
      objection_text: o.text,
      category: o.category,
      hidden_meaning: o.hidden,
      ffr_response: o.ffr,
      abc_response: o.abc,
      follow_up_question: o.followUp,
      proof_point: o.proof,
    })),
    sequences: SEQUENCES.map((s) => ({ organization_id: orgId, ...s })),
    sequenceSteps: buildSequenceSteps(r),
    icpProfiles: ICP_PROFILES.map((p) => ({ organization_id: orgId, ...p })),
    scoringProfile: {
      organization_id: orgId,
      name: "Default Scoring Profile",
      is_default: true,
      weight_company_size: 20,
      weight_industry_fit: 25,
      weight_engagement: 20,
      weight_source_quality: 15,
      weight_budget: 20,
      target_industries: ["Technology", "SaaS", "Finance", "Healthcare"],
      target_company_sizes: ["50-200", "200-1000", "1000+"],
    },
    proposals: buildProposals(orgId, deals, r),
    emailTemplates: EMAIL_TEMPLATES.map((t) => ({ organization_id: orgId, ...t })),
    copyTemplates: COPY_TEMPLATES.map((t) => ({ organization_id: orgId, ...t })),
    calendarEvents: buildCalendarEvents(orgId, r),
  };
}

export function countSeedRows(b: SeedBundle): number {
  return (
    b.customers.length + b.leads.length + b.deals.length + b.contacts.length +
    b.activities.length + b.competitors.length + b.battleCards.length +
    b.objections.length + b.sequences.length + b.sequenceSteps.length +
    b.icpProfiles.length + 1 + b.proposals.length + b.emailTemplates.length +
    b.copyTemplates.length + b.calendarEvents.length
  );
}
