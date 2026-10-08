// A fresh ICP for each "find leads" run: create it from the answers the user
// gave in chat, turn it on, and turn every other ICP off so the qualifier and
// the lead search both use this one.

import type { Records } from 'src/gtm/agency/gql';
import { HEADCOUNT_LABELS, headcountLabel, headcountValue } from 'src/gtm/leadfinder/headcount';

export type StartIcpInput = {
  name?: string;
  description?: string;
  jobTitles?: string[];
  industries?: string[];
  locations?: string[];
  headcount?: string[];
};

const bounds = (label: string): [number, number] => {
  if (label.endsWith('+')) return [Number(label.slice(0, -1)), Infinity];
  const [lo, hi] = label.split('-').map(Number);
  return [lo, hi];
};

/**
 * Company sizes as ICP select values. Takes the exact buckets ("11-20"), SIZE_*
 * values, or any range ("11-50", "50+", "1,000-5,000"), which become every
 * bucket it overlaps. Unreadable sizes are returned apart.
 */
export const headcountValues = (sizes: string[] = []): { values: string[]; unknown: string[] } => {
  const picked = new Set<string>();
  const unknown: string[] = [];
  for (const raw of sizes) {
    const exact = headcountLabel(raw);
    if (exact) {
      picked.add(exact);
      continue;
    }
    const s = raw.replace(/,/g, '').replace(/\s+/g, '');
    const range = s.match(/^(\d+)(?:-(\d+)|(\+))?$/);
    if (!range) {
      unknown.push(raw);
      continue;
    }
    const lo = Number(range[1]);
    const hi = range[2] ? Number(range[2]) : range[3] ? Infinity : lo;
    const hits = HEADCOUNT_LABELS.filter((label) => {
      const [a, b] = bounds(label);
      return a <= hi && b >= lo;
    });
    if (hits.length === 0) unknown.push(raw);
    hits.forEach((l) => picked.add(l));
  }
  return { values: HEADCOUNT_LABELS.filter((l) => picked.has(l)).map(headcountValue), unknown };
};

const clean = (list?: string[]) => [...new Set((list ?? []).map((s) => String(s).trim()).filter(Boolean))];

export const icpRecord = (input: StartIcpInput, today = new Date()) => {
  const { values, unknown } = headcountValues(input.headcount);
  const jobTitles = clean(input.jobTitles);
  const industries = clean(input.industries);
  const locations = clean(input.locations);
  const name = input.name?.trim() || `ICP ${today.toISOString().slice(0, 10)}${industries[0] ? ` · ${industries[0]}` : ''}`;
  return {
    data: { name, description: input.description?.trim() || null, jobTitles, industries, locations, headcount: values, isActive: true },
    unknownSizes: unknown,
  };
};

export const startIcp = async (records: Records, input: StartIcpInput) => {
  const { data, unknownSizes } = icpRecord(input);
  if (!data.description && data.jobTitles.length === 0 && data.industries.length === 0) {
    return { ok: false as const, error: 'Say who the ICP is for: a description, job titles or industries.' };
  }
  const id = await records.create('icpProfile', data);
  const active = await records.findMany<{ id: string }>('icpProfiles', { isActive: { eq: true } }, {}, 100);
  const turnedOff: string[] = [];
  for (const icp of active) {
    if (icp.id === id) continue;
    await records.update('icpProfile', icp.id, { isActive: false });
    turnedOff.push(icp.id);
  }
  return { ok: true as const, icpProfileId: id, icp: data, turnedOff: turnedOff.length, unknownSizes };
};
