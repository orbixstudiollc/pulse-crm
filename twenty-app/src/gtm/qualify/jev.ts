// Jev (TypeSafe's decision model) through OpenRouter's Decisions API: cheap,
// fast yes/no probabilities for bulk classification. Returns no written
// reasons, so borderline results go to the review model for a second look.
//
// POST https://openrouter.ai/api/alpha/decisions
//   { model, state: { message }, questions: { name: { type: 'noul' | 'choice', instructions, criteria } } }
// -> { answers: { name: { type: 'noul', noul: 0.93 } | { type: 'choice', choice, probabilities, confidence } } }
// The API is in alpha, so the parsing below accepts a few shapes.

import type { Classifier, CompanyFacts, CompanyVerdict, IcpBrief, TitleVerdict } from 'src/gtm/qualify/classify';
import { clampConfidence } from 'src/gtm/qualify/values';

export const JEV_DEFAULT_MODEL = 'typesafe/jev-1.13';
const DECISIONS_URL = 'https://openrouter.ai/api/alpha/decisions';
const TITLE_CONCURRENCY = 6;

export const AGENCY_TYPES: Record<string, string> = {
  SEO: 'Search engine optimisation',
  'Paid media': 'PPC, Google Ads, paid social and other paid advertising',
  Social: 'Social media marketing and content',
  'Web design': 'Website design and development',
  Branding: 'Brand strategy and identity',
  Content: 'Content marketing, copywriting, video',
  'Full-service digital': 'A broad mix of digital marketing services',
  PR: 'Public relations and communications',
  Other: 'Something else, or not an agency',
};

export const TITLE_CATEGORIES: Record<string, string> = {
  Founder: 'Founder or co-founder',
  CEO: 'Chief executive, president',
  Owner: 'Owner or principal',
  Partner: 'Partner or managing partner',
  'Managing Director': 'Managing director or general manager',
  Sales: 'Sales leader',
  'Business Development': 'Business development or partnerships leader',
  Delivery: 'Head of delivery, operations or client services',
  Marketing: 'Marketing leader',
  'Individual contributor': 'Specialist, coordinator, assistant, intern or other non-leader',
  Other: 'Anything else',
};

const icpText = (icp: IcpBrief) =>
  [
    icp.description,
    icp.industries?.length ? `Target company types: ${icp.industries.join(', ')}.` : '',
    icp.jobTitles?.length ? `Target job titles: ${icp.jobTitles.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ')
    .slice(0, 1500);

type Answer = Record<string, unknown> | number | string | null | undefined;

/** Probability of yes from a noul answer. */
export const noulProbability = (a: Answer): number | null => {
  if (typeof a === 'number' || typeof a === 'string') return clampConfidence(a);
  if (!a || typeof a !== 'object') return null;
  for (const key of ['noul', 'probability', 'value', 'answer', 'yes']) {
    const v = a[key];
    if (typeof v === 'number' || typeof v === 'string') {
      const n = clampConfidence(v);
      if (n !== null) return n;
    }
    if (v && typeof v === 'object') {
      const inner = noulProbability(v as Answer);
      if (inner !== null) return inner;
    }
  }
  const probs = a.probabilities as Record<string, unknown> | undefined;
  if (probs && typeof probs === 'object') return clampConfidence(probs.true ?? probs.yes);
  return null;
};

export const choiceOf = (a: Answer, options: string[]): string | null => {
  if (!a || typeof a !== 'object') return typeof a === 'string' && options.includes(a) ? a : null;
  const c = a.choice ?? a.answer ?? a.value;
  if (typeof c === 'string' && options.includes(c)) return c;
  const probs = a.probabilities as Record<string, number> | undefined;
  if (probs && typeof probs === 'object') {
    const best = Object.entries(probs).filter(([k]) => options.includes(k)).sort((x, y) => Number(y[1]) - Number(x[1]))[0];
    if (best) return best[0];
  }
  return null;
};

export type JevClient = (body: Record<string, unknown>) => Promise<Record<string, Answer>>;

export const jevClient =
  (apiKey: string, fetchImpl: typeof fetch = fetch): JevClient =>
  async (body) => {
    const res = await fetchImpl(DECISIONS_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => '')).slice(0, 300);
      throw new Error(`OpenRouter decisions ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    const json = (await res.json()) as { answers?: Record<string, Answer> };
    return json.answers ?? {};
  };

export const companyDecision = (model: string, icp: IcpBrief, company: CompanyFacts, websiteText: string | null) => ({
  model,
  state: {
    message: [
      company.name && `Company: ${company.name}`,
      company.domain && `Website: ${company.domain}`,
      company.industry && `Listed industry: ${company.industry}`,
      company.headcount && `Employees: ${company.headcount}`,
      company.location && `Location: ${company.location}`,
      `Website text:\n${websiteText?.trim() ? websiteText : '(website could not be read)'}`,
    ]
      .filter(Boolean)
      .join('\n'),
  },
  questions: {
    fits_icp: {
      type: 'noul',
      instructions: `Judging from what the website says the business actually sells, is this company the kind of company this profile targets? Profile: ${icpText(icp)}`,
      criteria: {
        true: 'The website clearly shows a business of the targeted kind that sells its services to clients.',
        false: 'It is a different kind of business (a software product, marketplace, directory, in-house team, publisher, job board), or the site is empty, parked or unrelated.',
      },
    },
    agency_type: { type: 'choice', instructions: 'What is the main specialisation of this business?', criteria: AGENCY_TYPES },
  },
});

export const titleDecision = (model: string, icp: IcpBrief, title: string) => ({
  model,
  state: { message: `Job title: ${title.slice(0, 200)}` },
  questions: {
    decision_maker: {
      type: 'noul',
      instructions: `Is a person with this job title a decision-maker this profile targets? Profile: ${icpText(icp)}`,
      criteria: {
        true: 'Founder, owner, CEO, president, managing director, partner, or a leader of sales, business development, growth or delivery.',
        false: 'An individual contributor, assistant, intern, freelancer, student, recruiter, or an unrelated role.',
      },
    },
    category: { type: 'choice', instructions: 'Which role category fits this title best?', criteria: TITLE_CATEGORIES },
  },
});

export const jevCompanyVerdict = async (client: JevClient, model: string, icp: IcpBrief, company: CompanyFacts, websiteText: string | null): Promise<CompanyVerdict | null> => {
  const answers = await client(companyDecision(model, icp, company, websiteText));
  const confidence = noulProbability(answers.fits_icp);
  if (confidence === null) return null;
  const agencyType = choiceOf(answers.agency_type, Object.keys(AGENCY_TYPES));
  return {
    confidence,
    agencyType: agencyType && agencyType !== 'Other' ? agencyType : null,
    reason: `Jev: ${Math.round(confidence * 100)}% likely to fit the ICP from the website${websiteText?.trim() ? '' : ' (site could not be read)'}.`,
    evidence: null,
  };
};

export const jevTitleVerdicts = async (client: JevClient, model: string, icp: IcpBrief, titles: string[]): Promise<(TitleVerdict | null)[]> => {
  const out: (TitleVerdict | null)[] = titles.map(() => null);
  for (let i = 0; i < titles.length; i += TITLE_CONCURRENCY) {
    await Promise.all(
      titles.slice(i, i + TITLE_CONCURRENCY).map(async (title, j) => {
        const answers = await client(titleDecision(model, icp, title));
        const confidence = noulProbability(answers.decision_maker);
        if (confidence === null) return;
        out[i + j] = { confidence, category: choiceOf(answers.category, Object.keys(TITLE_CATEGORIES)), reason: 'Jev' };
      }),
    );
  }
  return out;
};

export const jevClassifier = (client: JevClient, model: string = JEV_DEFAULT_MODEL): Classifier => ({
  label: model,
  company: (icp, company, websiteText) => jevCompanyVerdict(client, model, icp, company, websiteText),
  titles: (icp, titles) => jevTitleVerdicts(client, model, icp, titles),
});
