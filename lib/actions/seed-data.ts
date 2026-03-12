"use server";

import { createClient } from "@/lib/supabase/server";
import { getOrgId, getCurrentUserProfile } from "./helpers";
import { revalidatePath } from "next/cache";
import type { Database } from "@/types/database";

type CustomerInsert = Database["public"]["Tables"]["customers"]["Insert"];
type LeadInsert = Database["public"]["Tables"]["leads"]["Insert"];
type DealInsert = Database["public"]["Tables"]["deals"]["Insert"];
type ContactInsert = Database["public"]["Tables"]["contacts"]["Insert"];
type ActivityInsert = Database["public"]["Tables"]["activities"]["Insert"];

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

const JOB_TITLES = [
  "CEO", "CTO", "VP of Sales", "Head of Marketing", "Product Manager",
  "Engineering Lead", "Director of Operations", "CFO", "COO", "VP Engineering",
  "Sales Director", "Marketing Manager", "Business Development Manager",
  "Account Executive", "Solutions Architect",
];

const OBJECTION_CATEGORIES = ["price", "competition", "timing", "need", "authority", "trust"];

const OBJECTIONS = [
  {
    text: "Your solution is too expensive for our budget",
    category: "price",
    hidden: "They may not see the ROI clearly or are comparing to cheaper alternatives",
    ffr: "I understand budget is important. Many clients initially felt the same way, but found that our solution actually reduced their total costs by 30% within 6 months through automation and efficiency gains.",
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
    category: "trust",
    hidden: "Past failure created institutional resistance to trying new solutions",
    ffr: "I'm sorry to hear that. Can you share what went wrong? Understanding that helps us ensure a different outcome this time.",
    abc: "Acknowledge the bad experience, bridge to our support model and guarantees, close with a risk-free trial.",
    followUp: "What would need to be different this time for you to feel confident?",
    proof: "98% customer satisfaction score with a dedicated success manager assigned to every account.",
  },
];

function randomFrom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomDate(daysBack: number): string {
  const d = new Date();
  d.setDate(d.getDate() - Math.floor(Math.random() * daysBack));
  return d.toISOString();
}

function randomFutureDate(daysAhead: number): string {
  const d = new Date();
  d.setDate(d.getDate() + Math.floor(Math.random() * daysAhead) + 1);
  return d.toISOString().split("T")[0];
}

function generateEmail(firstName: string, lastName: string, company: string): string {
  const domain = company.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com";
  return `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${domain}`;
}

function generatePhone(): string {
  return `+1${randomBetween(200, 999)}${randomBetween(100, 999)}${randomBetween(1000, 9999)}`;
}

// ── Seed Functions ──────────────────────────────────────────────────────────

export async function seedAllData(): Promise<{
  success: boolean;
  error?: string;
  counts?: Record<string, number>;
}> {
  const supabase = await createClient();
  const orgId = await getOrgId();
  const { user } = await getCurrentUserProfile();

  const counts: Record<string, number> = {};

  try {
    // 1. Seed Customers (15)
    const customers: CustomerInsert[] = [];
    for (let i = 0; i < 15; i++) {
      const firstName = FIRST_NAMES[i % FIRST_NAMES.length];
      const lastName = LAST_NAMES[i % LAST_NAMES.length];
      const company = COMPANIES[i % COMPANIES.length];
      customers.push({
        organization_id: orgId,
        created_by: user.id,
        first_name: firstName,
        last_name: lastName,
        email: generateEmail(firstName, lastName, company),
        phone: generatePhone(),
        company,
        job_title: randomFrom(JOB_TITLES),
        industry: randomFrom(INDUSTRIES),
        status: randomFrom(CUSTOMER_STATUSES),
        plan: randomFrom(CUSTOMER_PLANS),
        mrr: randomBetween(50, 5000),
        health_score: randomBetween(30, 100),
        lifetime_value: randomBetween(500, 50000),
        customer_since: randomDate(365),
        tags: [randomFrom(INDUSTRIES), randomFrom(["Enterprise", "SMB", "Mid-Market"])],
      });
    }
    const { data: insertedCustomers, error: custErr } = await supabase
      .from("customers")
      .insert(customers)
      .select("id, first_name, last_name, email, company");
    if (custErr) throw new Error(`Customers: ${custErr.message}`);
    counts.customers = insertedCustomers?.length || 0;

    // 2. Seed Leads (25)
    const leads: LeadInsert[] = [];
    for (let i = 0; i < 25; i++) {
      const firstName = FIRST_NAMES[(i + 5) % FIRST_NAMES.length];
      const lastName = LAST_NAMES[(i + 3) % LAST_NAMES.length];
      const company = COMPANIES[(i + 7) % COMPANIES.length];
      const status = randomFrom(LEAD_STATUSES);
      leads.push({
        organization_id: orgId,
        created_by: user.id,
        name: `${firstName} ${lastName}`,
        email: generateEmail(firstName, lastName, company),
        company,
        phone: generatePhone(),
        industry: randomFrom(INDUSTRIES),
        website: `https://${company.toLowerCase().replace(/[^a-z0-9]/g, "")}.com`,
        status,
        source: randomFrom(LEAD_SOURCES),
        estimated_value: randomBetween(1000, 100000),
        score: status === "hot" ? randomBetween(70, 100) : status === "warm" ? randomBetween(40, 70) : randomBetween(10, 40),
        employees: randomBetween(10, 5000).toString(),
        location: randomFrom(["New York", "San Francisco", "London", "Berlin", "Toronto", "Austin", "Chicago", "Seattle", "Boston", "Denver"]),
      });
    }
    const { data: insertedLeads, error: leadErr } = await supabase
      .from("leads")
      .insert(leads)
      .select("id, name, email, company");
    if (leadErr) throw new Error(`Leads: ${leadErr.message}`);
    counts.leads = insertedLeads?.length || 0;

    // 3. Seed Deals (12)
    const deals: DealInsert[] = [];
    for (let i = 0; i < 12; i++) {
      const customer = insertedCustomers?.[i % (insertedCustomers.length || 1)];
      const stage = DEAL_STAGES[i % DEAL_STAGES.length];
      deals.push({
        organization_id: orgId,
        created_by: user.id,
        name: `${randomFrom(["Enterprise", "Pro", "Growth", "Standard", "Custom"])} Deal — ${COMPANIES[(i + 2) % COMPANIES.length]}`,
        customer_id: customer?.id || null,
        company: customer?.company || COMPANIES[i % COMPANIES.length],
        value: randomBetween(5000, 150000),
        probability: stage === "closed_won" ? 100 : stage === "closed_lost" ? 0 : randomBetween(20, 90),
        stage,
        close_date: stage === "closed_won" || stage === "closed_lost" ? randomDate(30) : randomFutureDate(60),
        contact_name: customer ? `${customer.first_name} ${customer.last_name}` : null,
        contact_email: customer?.email || null,
        days_in_stage: randomBetween(1, 30),
      });
    }
    const { data: insertedDeals, error: dealErr } = await supabase
      .from("deals")
      .insert(deals)
      .select("id, name");
    if (dealErr) throw new Error(`Deals: ${dealErr.message}`);
    counts.deals = insertedDeals?.length || 0;

    // 4. Seed Contacts (20)
    const contacts: ContactInsert[] = [];
    for (let i = 0; i < 20; i++) {
      const firstName = FIRST_NAMES[(i + 10) % FIRST_NAMES.length];
      const lastName = LAST_NAMES[(i + 8) % LAST_NAMES.length];
      const company = COMPANIES[(i + 4) % COMPANIES.length];
      const lead = insertedLeads?.[i % (insertedLeads.length || 1)];
      const customer = insertedCustomers?.[i % (insertedCustomers.length || 1)];
      contacts.push({
        organization_id: orgId,
        name: `${firstName} ${lastName}`,
        email: generateEmail(firstName, lastName, company),
        phone: generatePhone(),
        title: randomFrom(JOB_TITLES),
        lead_id: i < 10 ? lead?.id : null,
        customer_id: i >= 10 ? customer?.id : null,
        buying_role: randomFrom(["Decision Maker", "Influencer", "Champion", "Gatekeeper", "End User"]),
        influence_level: randomFrom(["high", "medium", "low"]),
        linkedin: `https://linkedin.com/in/${firstName.toLowerCase()}${lastName.toLowerCase()}`,
      });
    }
    const { error: contactErr } = await supabase.from("contacts").insert(contacts);
    if (contactErr) throw new Error(`Contacts: ${contactErr.message}`);
    counts.contacts = 20;

    // 5. Seed Activities (20)
    const activityTypes: Array<"call" | "email" | "meeting" | "note" | "task"> = ["call", "email", "meeting", "note", "task"];
    const activityData: ActivityInsert[] = [];
    for (let i = 0; i < 20; i++) {
      const type = activityTypes[i % activityTypes.length];
      activityData.push({
        organization_id: orgId,
        created_by: user.id,
        type,
        title: type === "call" ? `Follow-up call with ${randomFrom(COMPANIES)}` :
               type === "email" ? `Sent proposal to ${randomFrom(COMPANIES)}` :
               type === "meeting" ? `Demo meeting with ${randomFrom(COMPANIES)}` :
               type === "note" ? `Research notes on ${randomFrom(INDUSTRIES)} market` :
               `Follow up on ${randomFrom(COMPANIES)} requirement`,
        description: `Activity created during seed data generation.`,
        status: randomFrom(["completed", "pending", "scheduled"]) as "completed" | "pending" | "scheduled",
        date: randomDate(30).split("T")[0],
        time: `${randomBetween(9, 17).toString().padStart(2, "0")}:00`,
        related_type: randomFrom(["lead", "customer", "deal"]) as "lead" | "customer" | "deal",
        related_name: randomFrom(COMPANIES),
      });
    }
    const { error: actErr } = await supabase.from("activities").insert(activityData);
    if (actErr) throw new Error(`Activities: ${actErr.message}`);
    counts.activities = 20;

    // 6. Seed Competitors (5)
    const competitorsData = [
      {
        organization_id: orgId,
        name: "RivalCRM Pro",
        website: "https://rivalcrm.com",
        category: "Direct Competitor",
        description: "Full-featured CRM platform targeting mid-market companies with AI capabilities.",
        strengths: ["Strong brand recognition", "Large partner ecosystem", "Mobile app"],
        weaknesses: ["Complex pricing", "Slow customer support", "Outdated UI"],
      },
      {
        organization_id: orgId,
        name: "SalesForce Ultra",
        website: "https://salesforceultra.com",
        category: "Enterprise Competitor",
        description: "Enterprise-grade sales platform with extensive customization options.",
        strengths: ["Enterprise features", "Extensive API", "Global presence"],
        weaknesses: ["Expensive", "Steep learning curve", "Over-engineered for SMB"],
      },
      {
        organization_id: orgId,
        name: "LiteCRM",
        website: "https://litecrm.io",
        category: "Budget Competitor",
        description: "Lightweight and affordable CRM for small teams.",
        strengths: ["Low price", "Easy setup", "Clean interface"],
        weaknesses: ["Limited features", "No AI capabilities", "Poor reporting"],
      },
      {
        organization_id: orgId,
        name: "HubZone Sales",
        website: "https://hubzonesales.com",
        category: "Direct Competitor",
        description: "All-in-one sales and marketing platform with free tier.",
        strengths: ["Free tier", "Marketing integration", "Content tools"],
        weaknesses: ["Lock-in effect", "Expensive at scale", "Limited customization"],
      },
      {
        organization_id: orgId,
        name: "PipelinePro AI",
        website: "https://pipelineproai.com",
        category: "AI Competitor",
        description: "AI-first sales automation platform with predictive analytics.",
        strengths: ["AI-native", "Predictive scoring", "Automation"],
        weaknesses: ["New to market", "Limited integrations", "Small community"],
      },
    ];
    const { data: insertedCompetitors, error: compErr } = await supabase
      .from("competitors")
      .insert(competitorsData)
      .select("id, name");
    if (compErr) throw new Error(`Competitors: ${compErr.message}`);
    counts.competitors = insertedCompetitors?.length || 0;

    // 7. Seed Battle Cards for each competitor
    if (insertedCompetitors) {
      const battleCards = insertedCompetitors.map((comp) => ({
        competitor_id: comp.id,
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
      }));
      const { error: bcErr } = await supabase.from("battle_cards").insert(battleCards);
      if (bcErr) throw new Error(`Battle Cards: ${bcErr.message}`);
      counts.battle_cards = battleCards.length;
    }

    // 8. Seed Objection Playbook (6)
    const objectionData = OBJECTIONS.map((o) => ({
      organization_id: orgId,
      objection_text: o.text,
      category: o.category,
      hidden_meaning: o.hidden,
      ffr_response: o.ffr,
      abc_response: o.abc,
      follow_up_question: o.followUp,
      proof_point: o.proof,
    }));
    const { error: objErr } = await supabase.from("objection_playbook").insert(objectionData);
    if (objErr) throw new Error(`Objections: ${objErr.message}`);
    counts.objections = objectionData.length;

    // 9. Seed Sequences (3)
    const sequenceData = [
      { name: "New Lead Welcome Series", description: "5-step nurture sequence for new inbound leads", status: "active" as const, category: "Nurture", total_steps: 5 },
      { name: "Enterprise Outreach", description: "Strategic multi-channel outreach for enterprise prospects", status: "active" as const, category: "Outreach", total_steps: 4 },
      { name: "Re-engagement Campaign", description: "Win back cold leads with personalized touchpoints", status: "draft" as const, category: "Re-engagement", total_steps: 3 },
    ];
    const insertedSequences = [];
    for (const seq of sequenceData) {
      const { data: seqResult, error: seqErr } = await supabase
        .from("sequences")
        .insert({ organization_id: orgId, created_by: user.id, ...seq })
        .select("id, name")
        .single();
      if (seqErr) throw new Error(`Sequence: ${seqErr.message}`);
      insertedSequences.push(seqResult);

      // Add steps for each sequence
      const stepTypes = ["email", "wait", "email", "task", "email"];
      const steps = stepTypes.slice(0, seq.total_steps).map((type, idx) => ({
        sequence_id: seqResult.id,
        step_order: idx + 1,
        step_type: type,
        delay_days: type === "wait" ? randomBetween(2, 5) : idx === 0 ? 0 : randomBetween(1, 3),
        subject: type === "email" ? `Step ${idx + 1}: ${randomFrom(["Introduction", "Follow-up", "Value Proposition", "Case Study", "Next Steps"])}` : null,
        body: type === "email" ? `Hi {{first_name}},\n\nThis is step ${idx + 1} of the ${seq.name}.\n\nBest regards` : type === "task" ? `Follow up with the prospect about their interest` : null,
        channel: type === "email" ? "email" : type === "wait" ? "none" : "task",
      }));
      const { error: stepErr } = await supabase.from("sequence_steps").insert(steps);
      if (stepErr) throw new Error(`Steps: ${stepErr.message}`);
    }
    counts.sequences = insertedSequences.length;

    // 10. Seed ICP Profiles (2)
    const icpData = [
      {
        organization_id: orgId,
        name: "Enterprise SaaS",
        description: "Large SaaS companies with 200+ employees seeking automation solutions",
        is_primary: true,
        color: "#6366f1",
        criteria: {
          company_size: { min: 200, max: 10000, ideal: "500-2000" },
          industry: ["Technology", "SaaS", "Finance"],
          revenue: { min: 5000000 },
          tech_stack: ["Cloud", "API-first"],
          geography: ["North America", "Europe"],
          pain_points: ["Manual processes", "Data silos", "Scaling challenges"],
        },
        weights: {
          company_size: 25, industry: 20, revenue: 20, tech_stack: 15, geography: 10, pain_points: 10,
        },
      },
      {
        organization_id: orgId,
        name: "Growth-Stage Startup",
        description: "Fast-growing startups with 20-200 employees looking for scalable CRM",
        is_primary: false,
        color: "#10b981",
        criteria: {
          company_size: { min: 20, max: 200, ideal: "50-100" },
          industry: ["Technology", "E-commerce", "Marketing"],
          revenue: { min: 1000000 },
          growth_rate: "20%+ YoY",
          geography: ["North America"],
          pain_points: ["Outgrowing current tools", "Need automation"],
        },
        weights: {
          company_size: 20, industry: 20, revenue: 15, growth_rate: 20, geography: 10, pain_points: 15,
        },
      },
    ];
    const { error: icpErr } = await supabase.from("icp_profiles").insert(icpData);
    if (icpErr) throw new Error(`ICP: ${icpErr.message}`);
    counts.icp_profiles = 2;

    // 11. Seed Scoring Profile
    const { error: spErr } = await supabase.from("scoring_profiles").insert({
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
    });
    if (spErr && spErr.code !== "23505") throw new Error(`Scoring: ${spErr.message}`);
    counts.scoring_profiles = 1;

    // 12. Seed Proposals (4)
    if (insertedDeals) {
      const proposalData = insertedDeals.slice(0, 4).map((deal, i) => ({
        organization_id: orgId,
        deal_id: deal.id,
        title: `Proposal for ${deal.name}`,
        status: i < 2 ? "sent" : "draft",
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
        valid_until: randomFutureDate(30),
      }));
      const { error: propErr } = await supabase.from("proposals").insert(proposalData);
      if (propErr) throw new Error(`Proposals: ${propErr.message}`);
      counts.proposals = proposalData.length;
    }

    // 13. Seed Email Templates (4)
    const templateData = [
      {
        organization_id: orgId,
        name: "Cold Outreach",
        category: "Outreach",
        subject: "Quick question about {{company}}",
        body: "Hi {{first_name}},\n\nI noticed {{company}} is growing rapidly in the {{industry}} space. We help similar companies streamline their sales process with AI-powered CRM.\n\nWould you be open to a 15-minute call this week?\n\nBest,\n{{sender_name}}",
        merge_fields: ["first_name", "company", "industry", "sender_name"],
      },
      {
        organization_id: orgId,
        name: "Follow-Up After Demo",
        category: "Follow-up",
        subject: "Re: {{company}} demo follow-up",
        body: "Hi {{first_name}},\n\nThank you for taking the time to see our demo. I wanted to follow up on the key points we discussed.\n\nAs mentioned, our platform can help {{company}} with:\n- Automated lead scoring\n- AI-powered outreach sequences\n- Real-time pipeline analytics\n\nShall we schedule a next step?\n\nBest regards",
        merge_fields: ["first_name", "company"],
      },
      {
        organization_id: orgId,
        name: "Proposal Sent",
        category: "Proposal",
        subject: "Your personalized proposal from Pulse CRM",
        body: "Hi {{first_name}},\n\nPlease find attached our tailored proposal for {{company}}. I've included three pricing options to match your needs and budget.\n\nI'm available to discuss any questions you may have.\n\nBest regards",
        merge_fields: ["first_name", "company"],
      },
      {
        organization_id: orgId,
        name: "Re-engagement",
        category: "Re-engagement",
        subject: "Been a while, {{first_name}} — new updates from Pulse",
        body: "Hi {{first_name}},\n\nIt's been a while since we last connected. I wanted to share some exciting updates that might be relevant for {{company}}.\n\nWe've recently launched AI-powered features that could help your team close deals faster.\n\nWould you be interested in a quick catch-up?\n\nBest",
        merge_fields: ["first_name", "company"],
      },
    ];
    const { error: tmplErr } = await supabase.from("email_templates").insert(templateData);
    if (tmplErr) throw new Error(`Templates: ${tmplErr.message}`);
    counts.email_templates = templateData.length;

    // 14. Seed Copy Templates (3)
    const copyTemplateData = [
      {
        organization_id: orgId,
        name: "LinkedIn Connection Request",
        category: "Social",
        headline: "Let's connect!",
        body: "Hi {{name}}, I noticed we share interests in {{industry}}. I'd love to connect and exchange ideas about scaling sales teams with AI.",
        cta: "Connect",
        tags: ["linkedin", "social", "networking"],
      },
      {
        organization_id: orgId,
        name: "Product Launch Announcement",
        category: "Marketing",
        headline: "Introducing AI-Powered Sales Intelligence",
        body: "We're excited to announce our latest feature: AI-driven insights that help you close deals 40% faster. See how it works in 60 seconds.",
        cta: "Watch Demo",
        tags: ["launch", "marketing", "product"],
      },
      {
        organization_id: orgId,
        name: "Case Study Teaser",
        category: "Content",
        headline: "How TechNova Grew Revenue 200% with Pulse CRM",
        body: "See how TechNova leveraged AI scoring and automated outreach to transform their sales process and triple their pipeline value.",
        cta: "Read Case Study",
        tags: ["case-study", "social-proof", "content"],
      },
    ];
    const { error: copyErr } = await supabase.from("copy_templates").insert(copyTemplateData);
    if (copyErr) throw new Error(`Copy Templates: ${copyErr.message}`);
    counts.copy_templates = copyTemplateData.length;

    // 15. Seed Calendar Events (8)
    const calendarData = [];
    for (let i = 0; i < 8; i++) {
      calendarData.push({
        organization_id: orgId,
        created_by: user.id,
        title: randomFrom([
          "Discovery Call", "Product Demo", "Proposal Review",
          "Team Standup", "Client Check-in", "Pipeline Review",
          "Quarterly Business Review", "Strategy Planning",
        ]),
        date: randomFutureDate(14),
        start_time: `${randomBetween(9, 16).toString().padStart(2, "0")}:00`,
        end_time: `${randomBetween(10, 17).toString().padStart(2, "0")}:00`,
        type: randomFrom(["meeting", "call", "task", "reminder"]),
        status: randomFrom(["scheduled", "confirmed"]),
        related_type: randomFrom(["lead", "customer", "deal"]) as "lead" | "customer" | "deal",
        related_name: randomFrom(COMPANIES),
      });
    }
    const { error: calErr } = await supabase.from("calendar_events").insert(calendarData);
    if (calErr) throw new Error(`Calendar: ${calErr.message}`);
    counts.calendar_events = calendarData.length;

    // Revalidate all pages
    revalidatePath("/dashboard", "layout");

    return { success: true, counts };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export async function clearAllSeedData(): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const orgId = await getOrgId();

  try {
    // Delete in correct order to respect foreign keys
    await supabase.from("sequence_events").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("sequence_enrollments").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("sequence_steps").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("sequences").delete().eq("organization_id", orgId);
    await supabase.from("proposals").delete().eq("organization_id", orgId);
    await supabase.from("lead_competitors").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("battle_cards").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("competitors").delete().eq("organization_id", orgId);
    await supabase.from("objection_playbook").delete().eq("organization_id", orgId);
    await supabase.from("contacts").delete().eq("organization_id", orgId);
    await supabase.from("lead_notes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("lead_activities").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("lead_score_history").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("leads").delete().eq("organization_id", orgId);
    await supabase.from("deal_notes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("deal_activities").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("deals").delete().eq("organization_id", orgId);
    await supabase.from("customer_notes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("customer_activities").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("customer_custom_fields").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await supabase.from("customers").delete().eq("organization_id", orgId);
    await supabase.from("activities").delete().eq("organization_id", orgId);
    await supabase.from("calendar_events").delete().eq("organization_id", orgId);
    await supabase.from("email_templates").delete().eq("organization_id", orgId);
    await supabase.from("copy_templates").delete().eq("organization_id", orgId);
    await supabase.from("icp_profiles").delete().eq("organization_id", orgId);
    await supabase.from("scoring_profiles").delete().eq("organization_id", orgId);

    revalidatePath("/dashboard", "layout");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    };
  }
}
