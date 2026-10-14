import { headcountIndex } from 'src/gtm/leadfinder/headcount';

// Rule-based ICP fit scoring. Pure: no I/O, unit tested.
//
// Each ICP criterion that the profile actually sets (titles, industries,
// locations, company size) carries a weight. A lead earns that weight in full
// on a match, half on a near match, nothing otherwise. The score is the share
// of the available weight, 0-100. Criteria the profile leaves empty are
// ignored rather than counted as matches. A lead is scored against every
// active profile and keeps its best result.

export type IcpGrade = 'A' | 'B' | 'C' | 'D';

export type IcpCriteria = {
  id?: string;
  name?: string | null;
  jobTitles?: string[] | null;
  industries?: string[] | null;
  locations?: string[] | null;
  /** ICP select values (SIZE_51_100) or labels (51-100). */
  headcount?: string[] | null;
};

export type LeadProfile = {
  jobTitle?: string | null;
  industry?: string | null;
  location?: string | null;
  /** Range label, SIZE_* value or employee count. */
  headcount?: string | number | null;
};

export const SCORE_WEIGHTS = { title: 40, industry: 25, location: 15, headcount: 20 } as const;

export type Criterion = keyof typeof SCORE_WEIGHTS;

export type ScoreResult = {
  score: number;
  grade: IcpGrade;
  profileId?: string;
  profileName?: string | null;
  /** Match strength per criterion the profile sets: 1, 0.5 or 0. */
  matches: Partial<Record<Criterion, number>>;
};

export function gradeFor(score: number): IcpGrade {
  if (score >= 80) return 'A';
  if (score >= 60) return 'B';
  if (score >= 40) return 'C';
  return 'D';
}

export function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9+]+/g, ' ')
    .trim();
}

const TITLE_ALIASES: Record<string, string> = {
  ceo: 'chief executive officer',
  cto: 'chief technology officer',
  cfo: 'chief financial officer',
  coo: 'chief operating officer',
  cmo: 'chief marketing officer',
  cro: 'chief revenue officer',
  cio: 'chief information officer',
  vp: 'vice president',
  svp: 'senior vice president',
  evp: 'executive vice president',
  hr: 'human resources',
};

const STOP_WORDS = new Set(['of', 'and', 'the', 'for', 'at', 'in', 'a', 'to']);
// Rank words: sharing only one of these is not a near match ("Head of Sales" vs "Head of IT").
const RANK_WORDS = new Set([
  'chief', 'officer', 'head', 'director', 'manager', 'lead', 'senior', 'junior', 'vice',
  'president', 'executive', 'principal', 'associate', 'assistant', 'global', 'regional',
]);

function expandTitle(title: string): string {
  return normalize(title)
    .split(' ')
    .map((w) => TITLE_ALIASES[w] ?? w)
    .join(' ');
}

function words(value: string): string[] {
  return value.split(' ').filter((w) => w && !STOP_WORDS.has(w));
}

function containsPhrase(haystack: string, needle: string): boolean {
  if (!needle) return false;
  return ` ${haystack} `.includes(` ${needle} `);
}

/** 1 if a target title appears in the lead's title (or vice versa), 0.5 if they share a function word. */
export function titleMatch(leadTitle: string | null | undefined, targets: string[]): number {
  if (!leadTitle) return 0;
  const lead = expandTitle(leadTitle);
  if (!lead) return 0;
  let best = 0;
  for (const target of targets) {
    const t = expandTitle(target);
    if (!t) continue;
    if (containsPhrase(lead, t) || containsPhrase(t, lead)) return 1;
    const leadWords = new Set(words(lead));
    const shared = words(t).filter((w) => leadWords.has(w) && !RANK_WORDS.has(w));
    if (shared.length > 0) best = 0.5;
  }
  return best;
}

/** 1 if either value contains the other as a phrase, 0.5 on a shared significant word. */
function textMatch(leadValue: string | null | undefined, targets: string[], allowPartial: boolean): number {
  if (!leadValue) return 0;
  const lead = normalize(leadValue);
  if (!lead) return 0;
  let best = 0;
  for (const target of targets) {
    const t = normalize(target);
    if (!t) continue;
    if (containsPhrase(lead, t) || containsPhrase(t, lead)) return 1;
    if (allowPartial) {
      const leadWords = new Set(words(lead).filter((w) => w.length > 3));
      if (words(t).some((w) => leadWords.has(w))) best = 0.5;
    }
  }
  return best;
}

export function industryMatch(leadIndustry: string | null | undefined, targets: string[]): number {
  return textMatch(leadIndustry, targets, true);
}

const COUNTRY_ALIASES: Record<string, string> = {
  usa: 'united states',
  us: 'united states',
  'united states of america': 'united states',
  uk: 'united kingdom',
  'great britain': 'united kingdom',
  england: 'united kingdom',
  uae: 'united arab emirates',
};

function expandLocation(value: string): string {
  const n = normalize(value);
  const parts = n.split(' ');
  // Append the canonical country for any alias so "London, UK" also matches "United Kingdom".
  const extras = Object.entries(COUNTRY_ALIASES)
    .filter(([alias]) => containsPhrase(n, alias) || parts.includes(alias))
    .map(([, canonical]) => canonical);
  return [n, ...extras].join(' ');
}

/** 1 when the lead's location contains a target location (a city inside a country counts). */
export function locationMatch(leadLocation: string | null | undefined, targets: string[]): number {
  if (!leadLocation) return 0;
  const lead = expandLocation(leadLocation);
  for (const target of targets) {
    const t = normalize(COUNTRY_ALIASES[normalize(target)] ?? target);
    if (t && (containsPhrase(lead, t) || containsPhrase(t, normalize(leadLocation)))) return 1;
  }
  return 0;
}

/** 1 for the same size bucket, 0.5 for a neighbouring one. */
export function headcountMatch(leadHeadcount: string | number | null | undefined, targets: string[]): number {
  const lead = headcountIndex(leadHeadcount);
  if (lead === null) return 0;
  let best = 0;
  for (const target of targets) {
    const t = headcountIndex(target);
    if (t === null) continue;
    if (t === lead) return 1;
    if (Math.abs(t - lead) === 1) best = 0.5;
  }
  return best;
}

function clean(list: string[] | null | undefined): string[] {
  return (list ?? []).map((v) => (typeof v === 'string' ? v.trim() : '')).filter(Boolean);
}

/** Score one lead against one profile. Null when the profile sets no criteria. */
export function scoreAgainstProfile(lead: LeadProfile, profile: IcpCriteria): ScoreResult | null {
  const criteria: [Criterion, string[], (targets: string[]) => number][] = [
    ['title', clean(profile.jobTitles), (t) => titleMatch(lead.jobTitle, t)],
    ['industry', clean(profile.industries), (t) => industryMatch(lead.industry, t)],
    ['location', clean(profile.locations), (t) => locationMatch(lead.location, t)],
    ['headcount', clean(profile.headcount), (t) => headcountMatch(lead.headcount, t)],
  ];
  let available = 0;
  let earned = 0;
  const matches: ScoreResult['matches'] = {};
  for (const [name, targets, match] of criteria) {
    if (targets.length === 0) continue;
    const m = match(targets);
    matches[name] = m;
    available += SCORE_WEIGHTS[name];
    earned += SCORE_WEIGHTS[name] * m;
  }
  if (available === 0) return null;
  const score = Math.round((earned / available) * 100);
  return { score, grade: gradeFor(score), profileId: profile.id, profileName: profile.name, matches };
}

/** Best score across profiles. Null when no profile sets any criteria. */
export function scoreLead(lead: LeadProfile, profiles: IcpCriteria[]): ScoreResult | null {
  let best: ScoreResult | null = null;
  for (const profile of profiles) {
    const result = scoreAgainstProfile(lead, profile);
    if (result && (!best || result.score > best.score)) best = result;
  }
  return best;
}
