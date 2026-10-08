// The qualification gates. A lead is Qualified (eligible for outreach) only when:
//   1. the company classification is Qualified (confidence >= threshold),
//   2. the title classification is Qualified (confidence >= threshold),
//   3. the email is verified,
//   4. the person is not suppressed,
//   5. the company matches the ICP's locations and company sizes, when the ICP sets them.
// A clear failure rejects the lead; anything uncertain goes to Review.

import { headcountMatch, locationMatch } from 'src/gtm/leadfinder/scoring';
import type { IcpGrade } from 'src/gtm/leadfinder/scoring';
import { classify, type EmailStatus, type QualificationStatus } from 'src/gtm/qualify/values';

export type IcpFilters = { locations?: string[] | null; headcount?: string[] | null };

export type IcpFit = { ok: boolean | null; notes: string[] };

/** Location and size against the ICP. ok is null when data is missing for a criterion the ICP sets. */
export const icpFit = (icp: IcpFilters, lead: { location?: string | null; headcount?: string | number | null }): IcpFit => {
  const notes: string[] = [];
  let ok: boolean | null = true;
  const locations = (icp.locations ?? []).filter(Boolean);
  if (locations.length > 0) {
    if (!lead.location) {
      notes.push('Location unknown');
      ok = null;
    } else if (locationMatch(lead.location, locations) < 1) {
      notes.push(`Outside target locations (${lead.location})`);
      ok = false;
    }
  }
  const sizes = (icp.headcount ?? []).filter(Boolean);
  if (sizes.length > 0) {
    if (lead.headcount === null || lead.headcount === undefined || lead.headcount === '') {
      notes.push('Company size unknown');
      if (ok !== false) ok = null;
    } else if (headcountMatch(lead.headcount, sizes) < 1) {
      notes.push(`Company size outside target (${lead.headcount})`);
      ok = false;
    }
  }
  return { ok, notes };
};

export type GateInput = {
  companyConfidence: number | null;
  titleConfidence: number | null;
  emailStatus: EmailStatus;
  suppressedReason: string | null;
  fit: IcpFit;
  threshold: number;
  // Soft reasons to hold the lead for a person to look at (e.g. already in another sequence).
  holds?: string[];
};

export type GateResult = {
  status: Exclude<QualificationStatus, 'PENDING' | 'ENROLLED'>;
  score: number | null;
  grade: IcpGrade | null;
  notes: string[];
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

export const gradeForScore = (score: number): IcpGrade => (score >= 95 ? 'A' : score >= 85 ? 'B' : score >= 70 ? 'C' : 'D');

export const gate = (g: GateInput): GateResult => {
  const rejected: string[] = [];
  const review: string[] = [];
  const t = g.threshold;

  if (g.suppressedReason) rejected.push(`Suppressed: ${g.suppressedReason}`);

  const company = classify(g.companyConfidence, t);
  if (company === null) review.push('Company not classified');
  else if (company === 'REJECTED') rejected.push(`Company does not fit (${pct(g.companyConfidence!)})`);
  else if (company === 'REVIEW') review.push(`Company confidence ${pct(g.companyConfidence!)} is below ${pct(t)}`);

  const title = classify(g.titleConfidence, t);
  if (title === null) review.push('Title not classified');
  else if (title === 'REJECTED') rejected.push(`Title does not fit (${pct(g.titleConfidence!)})`);
  else if (title === 'REVIEW') review.push(`Title confidence ${pct(g.titleConfidence!)} is below ${pct(t)}`);

  if (g.emailStatus === 'INVALID') rejected.push('Email is invalid');
  else if (g.emailStatus === 'SUPPRESSED') rejected.push('Email is suppressed');
  else if (g.emailStatus !== 'VERIFIED') review.push(g.emailStatus === 'UNKNOWN' ? 'No verified email found' : 'Email not verified');

  if (g.fit.ok === false) rejected.push(...g.fit.notes);
  else if (g.fit.ok === null) review.push(...g.fit.notes);
  review.push(...(g.holds ?? []));

  // Lead score is the weaker of the two confidences, on the 0-100 scale.
  const both = g.companyConfidence !== null && g.titleConfidence !== null;
  const score = both ? Math.round(Math.min(g.companyConfidence!, g.titleConfidence!) * 100) : null;
  const grade = score === null ? null : gradeForScore(score);

  if (rejected.length > 0) return { status: 'REJECTED', score, grade, notes: [...rejected, ...review] };
  if (review.length > 0) return { status: 'REVIEW', score, grade, notes: review };
  return { status: 'QUALIFIED', score, grade, notes: [] };
};

/** True when only the email stands between the lead and Qualified, so verifying it is worth a credit. */
export const worthVerifying = (g: Omit<GateInput, 'emailStatus'> & { emailStatus: EmailStatus }): boolean =>
  g.emailStatus !== 'VERIFIED' &&
  g.emailStatus !== 'INVALID' &&
  g.emailStatus !== 'SUPPRESSED' &&
  gate({ ...g, emailStatus: 'VERIFIED' }).status === 'QUALIFIED';

export type SuppressionFacts = {
  email?: string | null;
  leadStatus?: string | null;
  emailStatus?: string | null;
  blockedHandles: Set<string>;
  ownDomains: Set<string>;
};

/** Why this person must not be contacted, or null. */
export const suppressionReason = (f: SuppressionFacts): string | null => {
  if (f.leadStatus === 'CUSTOMER') return 'already a customer';
  if (f.leadStatus === 'DISQUALIFIED') return 'marked disqualified (unsubscribed or not interested)';
  if (f.emailStatus === 'SUPPRESSED') return 'email suppressed';
  const email = f.email?.trim().toLowerCase();
  if (email) {
    const domain = email.split('@')[1] ?? '';
    if (f.blockedHandles.has(email) || f.blockedHandles.has(`@${domain}`) || f.blockedHandles.has(domain)) return 'on the blocklist';
    if (f.ownDomains.has(domain)) return 'one of our own sending domains';
  }
  return null;
};
