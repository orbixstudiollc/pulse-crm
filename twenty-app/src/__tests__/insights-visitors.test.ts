import { describe, expect, it } from 'vitest';

import { DEFAULT_VISITOR_SENIORITY, visitorSearchInput } from 'src/gtm/leadfinder/leads-at-company';
import { DEFAULT_VISITOR_ENRICH_CONFIG, enrichWebsiteVisitors, type PendingVisit, type VisitorEnrichDeps, type VisitPatch } from 'src/insights/enrich-visitors';
import { visitorEnrichConfig } from 'src/insights/enrich-visitors-runtime';
import { cleanDomain, lookupIp, parseIpinfo, type IpCompany } from 'src/insights/ip-company';

describe('IPinfo parsing', () => {
  it('uses company data from paid plans', () => {
    expect(
      parseIpinfo({ city: 'Austin', country: 'US', company: { name: 'Acme Corp', domain: 'acme.com', type: 'business' }, asn: { name: 'Acme', domain: 'acme.com', type: 'business' } }),
    ).toEqual({ companyName: 'Acme Corp', companyDomain: 'acme.com', city: 'Austin', country: 'US', network: 'Acme Corp' });
  });

  it('ignores ISPs and hosts on paid plans', () => {
    expect(parseIpinfo({ company: { name: 'Comcast', domain: 'comcast.net', type: 'isp' }, asn: { type: 'isp' } })).toMatchObject({ companyDomain: null, network: 'Comcast' });
  });

  it('never treats an untyped network owner as a company', () => {
    expect(parseIpinfo({ as_name: 'Stripe, Inc.', as_domain: 'stripe.com', country_code: 'US' })).toMatchObject({ companyDomain: null, network: 'Stripe, Inc.', country: 'US' });
    // ISPs that earlier slipped through as companies.
    expect(parseIpinfo({ as_name: 'Bell Canada', as_domain: 'bell.ca' }).companyDomain).toBeNull();
    expect(parseIpinfo({ as_name: 'Space Exploration Technologies Corporation', as_domain: 'spacex.com' }).companyDomain).toBeNull();
    expect(parseIpinfo({ asn: { name: 'Netia SA', domain: 'netia.pl' } }).companyDomain).toBeNull();
    expect(parseIpinfo({ as_name: 'Grameenphone Ltd.', as_domain: 'grameenphone.com' }).companyDomain).toBeNull();
    expect(parseIpinfo({ as_name: 'Amazon.com, Inc.', as_domain: 'amazon.com' }).companyDomain).toBeNull();
    expect(parseIpinfo({ as_name: 'Comcast Cable Communications', as_domain: 'comcast.com' }).companyDomain).toBeNull();
    expect(parseIpinfo({ org: 'AS7922 Comcast Cable' })).toMatchObject({ companyDomain: null, network: 'Comcast Cable' });
    // Real access networks seen on orbix.studio.
    expect(parseIpinfo({ as_name: 'Antaranga Dot Com Ltd', as_domain: 'antbd.net' }).companyDomain).toBeNull();
    expect(parseIpinfo({ as_name: 'QTnet,Inc.', as_domain: 'qtnet.co.jp' }).companyDomain).toBeNull();
    expect(parseIpinfo({ as_name: 'Example Corp', as_domain: 'example.ne.jp' }).companyDomain).toBeNull();
  });

  it('cleans domains', () => {
    expect(cleanDomain('https://www.Acme.com/about')).toBe('acme.com');
    expect(cleanDomain('not a domain')).toBeNull();
  });

  it('falls back to Lite for the network name when the free response has no owner', async () => {
    const calls: string[] = [];
    const fake = (async (url: string) => {
      calls.push(url);
      const body = url.includes('/lite/') ? { as_name: 'Acme Corp', as_domain: 'acme.com' } : { city: 'Dhaka', country: 'BD', org: 'AS1 Acme Corp' };
      return new Response(JSON.stringify(body), { status: 200 });
    }) as typeof fetch;
    expect(await lookupIp('198.51.100.7', 't', fake)).toEqual({ companyName: null, companyDomain: null, city: 'Dhaka', country: 'BD', network: 'Acme Corp' });
    expect(calls).toHaveLength(2);
    expect(await lookupIp('10.1.2.3', 't', fake)).toMatchObject({ companyDomain: null });
    expect(calls).toHaveLength(2);
  });

  it('reports a bad token', async () => {
    const fake = (async () => new Response('{}', { status: 403 })) as unknown as typeof fetch;
    await expect(lookupIp('198.51.100.7', 't', fake)).rejects.toThrow(/IPinfo rejected/);
  });
});

describe('visitor lead search', () => {
  it('uses ICP titles, else senior roles', () => {
    expect(visitorSearchInput('acme.com', ['CMO'])).toEqual({ companyWebsites: ['acme.com'], jobTitles: ['CMO'] });
    expect(visitorSearchInput('acme.com', [])).toEqual({ companyWebsites: ['acme.com'], seniority: DEFAULT_VISITOR_SENIORITY });
  });

  it('reads caps from variables', () => {
    expect(visitorEnrichConfig({ VISITOR_LEADS_PER_COMPANY: '5', VISITOR_LEADS_DAILY_CAP: 'x' })).toMatchObject({ leadsPerCompany: 5, dailyLeadCap: DEFAULT_VISITOR_ENRICH_CONFIG.dailyLeadCap });
  });
});

describe('enrichWebsiteVisitors', () => {
  const now = new Date('2026-10-02T12:00:00Z');
  const visit = (id: string, over: Partial<PendingVisit> = {}): PendingVisit => ({ id, ipAddress: null, companyDomain: null, companyName: null, personId: null, intentScore: 0, ...over });
  const ips: Record<string, IpCompany> = {
    '1.1.1.1': { companyName: 'Acme', companyDomain: 'acme.com', city: 'NYC', country: 'US', network: 'Acme' },
    '2.2.2.2': { companyName: null, companyDomain: null, city: 'Dhaka', country: 'BD', network: 'Grameenphone' },
    '4.4.4.4': { companyName: null, companyDomain: null, city: 'London', country: 'GB', network: 'BT' },
    '3.3.3.3': { companyName: 'Orbix', companyDomain: 'orbixstudio.co', city: null, country: null, network: 'Orbix' },
  };

  const setup = (visits: PendingVisit[], over: Partial<VisitorEnrichDeps> = {}) => {
    const patches = new Map<string, VisitPatch>();
    const kv = new Map<string, unknown>();
    const leadCalls: { domain: string; max: number }[] = [];
    const enrolled: string[][] = [];
    let n = 0;
    const deps: VisitorEnrichDeps = {
      listPending: async () => visits,
      updateVisit: async (id, patch) => void patches.set(id, { ...patches.get(id), ...patch }),
      lookupIp: async (ip) => ips[ip],
      ownDomains: async () => new Set(['orbixstudio.co']),
      findOrCreateCompany: async ({ domain }) => `company-${domain}`,
      findLeads: async (domain, _companyId, max) => {
        leadCalls.push({ domain, max });
        return Array.from({ length: max }, () => `lead-${++n}`);
      },
      enroll: async (ids) => {
        enrolled.push(ids);
        return ids.length;
      },
      getCompanyCooldown: async (d) => (kv.get(`c:${d}`) as string) ?? null,
      setCompanyCooldown: async (d, until) => void kv.set(`c:${d}`, until),
      getLeadsToday: async (day) => (kv.get(`d:${day}`) as number) ?? 0,
      setLeadsToday: async (day, count) => void kv.set(`d:${day}`, count),
      config: { ...DEFAULT_VISITOR_ENRICH_CONFIG, leadsPerCompany: 3, dailyLeadCap: 4 },
      now,
      ...over,
    };
    return { deps, patches, kv, leadCalls, enrolled };
  };

  it('matches companies, skips our team, ISPs and other regions, adds leads within the cap and enrolls them', async () => {
    const { deps, patches, leadCalls, enrolled } = setup([
      visit('isp', { ipAddress: '4.4.4.4' }),
      visit('bd', { ipAddress: '2.2.2.2' }),
      visit('bd-known', { ipAddress: '2.2.2.2', country: 'BD', personId: 'p-bd' }),
      visit('acme', { ipAddress: '1.1.1.1', intentScore: 50 }),
      visit('acme2', { ipAddress: '1.1.1.1' }),
      visit('us', { ipAddress: '3.3.3.3' }),
      visit('form', { companyDomain: 'beta.io', personId: 'p-form', intentScore: 30 }),
    ]);
    const summary = await enrichWebsiteVisitors(deps);
    expect(patches.get('isp')).toMatchObject({ enrichStatus: 'NO_MATCH', companyName: 'BT', country: 'GB' });
    // Outside the regions: no Prospeo; known countries skip the IP lookup too.
    expect(patches.get('bd')).toMatchObject({ enrichStatus: 'OUT_OF_REGION', country: 'BD' });
    expect(patches.get('bd-known')).toEqual({ enrichStatus: 'OUT_OF_REGION' });
    expect(patches.get('acme')).toMatchObject({ enrichStatus: 'LEADS_ADDED', companyId: 'company-acme.com', companyDomain: 'acme.com', leadsAdded: 3 });
    // Same company again in this run: linked, no second search.
    expect(patches.get('acme2')).toMatchObject({ enrichStatus: 'MATCHED', companyId: 'company-acme.com' });
    expect(patches.get('us')).toMatchObject({ enrichStatus: 'OWN_TEAM' });
    // Only 1 lead left under the daily cap of 4.
    expect(leadCalls).toEqual([{ domain: 'acme.com', max: 3 }, { domain: 'beta.io', max: 1 }]);
    // A form fill from outside the regions still gets the sequence (no credits used).
    expect(enrolled).toEqual([['lead-1', 'lead-2', 'lead-3', 'p-form', 'lead-4', 'p-bd']]);
    expect(summary).toMatchObject({ visits: 5, matched: 3, noMatch: 1, ownTeam: 1, outOfRegion: 2, leadsAdded: 4, enrolled: 6 });
  });

  it('respects the company cooldown across runs', async () => {
    const first = setup([visit('a', { ipAddress: '1.1.1.1' })]);
    await enrichWebsiteVisitors(first.deps);
    const second = setup([visit('b', { ipAddress: '1.1.1.1' })]);
    for (const [k, v] of first.kv) second.kv.set(k, v);
    await enrichWebsiteVisitors(second.deps);
    expect(second.leadCalls).toEqual([]);
    expect(second.patches.get('b')).toMatchObject({ enrichStatus: 'MATCHED' });
  });

  it('waits for an IPinfo token but still enrolls form fills', async () => {
    const { deps, patches, enrolled } = setup([visit('anon', { ipAddress: '1.1.1.1' }), visit('form', { ipAddress: '1.1.1.1', personId: 'p1' })], { lookupIp: null });
    const summary = await enrichWebsiteVisitors(deps);
    expect(patches.has('anon')).toBe(false);
    expect(patches.get('form')).toEqual({ enrichStatus: 'NO_MATCH' });
    expect(enrolled).toEqual([['p1']]);
    expect(summary.waitingForIpToken).toBe(2);
  });

  it('stops the run on a bad IPinfo token and marks other failures', async () => {
    const bad = setup([visit('a', { ipAddress: '1.1.1.1' }), visit('b', { ipAddress: '1.1.1.1' })], {
      lookupIp: async () => {
        throw new Error('IPinfo rejected the token (403)');
      },
    });
    const summary = await enrichWebsiteVisitors(bad.deps);
    expect(summary.errors).toHaveLength(1);
    expect(bad.patches.size).toBe(0);

    const flaky = setup([visit('a', { companyDomain: 'acme.com' })], {
      findOrCreateCompany: async () => {
        throw new Error('boom');
      },
    });
    await enrichWebsiteVisitors(flaky.deps);
    expect(flaky.patches.get('a')).toEqual({ enrichStatus: 'ERROR' });
  });
});
