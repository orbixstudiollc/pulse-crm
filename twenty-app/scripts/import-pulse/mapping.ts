// Pure mapping from Pulse (Supabase) rows to Twenty REST payloads.
// No I/O, so it can be unit tested. Used by ./run.ts.

export type PulseLead = {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  phone: string | null;
  linkedin: string | null;
  location: string | null;
  website: string | null;
  industry: string | null;
  employees: string | null;
  title: string | null;
  status: 'hot' | 'warm' | 'cold';
  source: string | null;
  score: number | null;
  qualification_grade: string | null;
  converted_at?: string | null;
};

export type PulseCustomer = {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  job_title: string | null;
  industry: string | null;
  company_size: string | null;
  website: string | null;
  city: string | null;
};

export type PulseDeal = {
  id: string;
  name: string;
  company: string | null;
  value: number | null;
  stage: 'discovery' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';
  close_date: string | null;
  contact_email: string | null;
};

const LEAD_SOURCE_MAP: Record<string, string> = {
  website: 'WEBSITE',
  referral: 'REFERRAL',
  linkedin: 'LINKEDIN',
  event: 'EVENT',
  'google ads': 'GOOGLE_ADS',
  'cold call': 'COLD_CALL',
  'cold outreach': 'COLD_OUTREACH',
};

/** Twenty's default opportunity stages are NEW, SCREENING, MEETING, PROPOSAL, CUSTOMER. */
const DEAL_STAGE_MAP: Record<PulseDeal['stage'], string | null> = {
  discovery: 'SCREENING',
  proposal: 'PROPOSAL',
  negotiation: 'PROPOSAL',
  closed_won: 'CUSTOMER',
  // Twenty has no "lost" stage by default; lost deals are reported, not imported.
  closed_lost: null,
};

export function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return { firstName: parts[0] ?? '', lastName: '' };
  return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1] };
}

export function toDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  const host = website.trim().replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
  return host || null;
}

/** Companies are keyed by lower-cased name so leads, customers and deals share one record. */
export function companyKey(name: string | null | undefined): string | null {
  const n = name?.trim();
  return n ? `company:${n.toLowerCase()}` : null;
}

export function companyPayload(name: string, extra: { website?: string | null; industry?: string | null }) {
  const domain = toDomain(extra.website);
  return {
    name: name.trim(),
    pulseId: companyKey(name),
    ...(domain ? { domainName: { primaryLinkUrl: `https://${domain}` } } : {}),
  };
}

function contactFields(p: { email: string | null; phone: string | null }) {
  return {
    ...(p.email ? { emails: { primaryEmail: p.email.trim().toLowerCase() } } : {}),
    ...(p.phone ? { phones: { primaryPhoneNumber: p.phone } } : {}),
  };
}

export function leadToPerson(lead: PulseLead, companyId: string | null) {
  const grade = lead.qualification_grade?.trim().toUpperCase();
  return {
    name: splitName(lead.name),
    pulseId: `lead:${lead.id}`,
    ...contactFields(lead),
    ...(lead.title ? { jobTitle: lead.title } : {}),
    ...(lead.linkedin ? { linkedinLink: { primaryLinkUrl: lead.linkedin } } : {}),
    leadStatus: lead.converted_at ? 'CUSTOMER' : lead.status.toUpperCase(),
    leadScore: lead.score ?? null,
    leadSource: (lead.source && LEAD_SOURCE_MAP[lead.source.toLowerCase()]) ?? 'OTHER',
    ...(grade && ['A', 'B', 'C', 'D'].includes(grade) ? { icpGrade: grade } : {}),
    ...(companyId ? { companyId } : {}),
  };
}

export function customerToPerson(customer: PulseCustomer, companyId: string | null) {
  return {
    name: { firstName: customer.first_name, lastName: customer.last_name },
    pulseId: `customer:${customer.id}`,
    ...contactFields(customer),
    ...(customer.job_title ? { jobTitle: customer.job_title } : {}),
    leadStatus: 'CUSTOMER',
    ...(companyId ? { companyId } : {}),
  };
}

export function dealToOpportunity(
  deal: PulseDeal,
  refs: { companyId: string | null; pointOfContactId: string | null }
) {
  const stage = DEAL_STAGE_MAP[deal.stage];
  if (!stage) return null;
  return {
    name: deal.name,
    pulseId: `deal:${deal.id}`,
    stage,
    amount: { amountMicros: Math.round((deal.value ?? 0) * 1_000_000), currencyCode: 'USD' },
    ...(deal.close_date ? { closeDate: new Date(deal.close_date).toISOString() } : {}),
    ...(refs.companyId ? { companyId: refs.companyId } : {}),
    ...(refs.pointOfContactId ? { pointOfContactId: refs.pointOfContactId } : {}),
  };
}
