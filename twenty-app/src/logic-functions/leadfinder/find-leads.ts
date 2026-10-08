import { defineLogicFunction } from 'twenty-sdk/define';

import {
  FIND_LEADS_FUNCTION_UNIVERSAL_IDENTIFIER,
  FIND_LEADS_ROUTE_PATH,
} from 'src/constants/leadfinder-ids';
import { mergeSearchInput, planNewLeads } from 'src/gtm/leadfinder/dedupe';
import {
  companyPayloadFromProspeo,
  icpCriteria,
  leadProfileFromProspeo,
  personPayloadFromProspeo,
} from 'src/gtm/leadfinder/mapping';
import { failure, toolOrRouteInput } from 'src/gtm/leadfinder/payload';
import { activeCriteria } from 'src/gtm/leadfinder/rescore';
import { scoreLead } from 'src/gtm/leadfinder/scoring';
import {
  createRecord,
  findCompanyByDomain,
  findPeopleByEmails,
  findPeopleByProspeoIds,
  getIcpProfile,
} from 'src/gtm/leadfinder/twenty';
import { searchPeople } from 'src/gtm/prospeo/api';
import { getProspeoKey, ProspeoError } from 'src/gtm/prospeo/client';
import {
  buildSearchFilters,
  clampPage,
  clampPageCount,
  personFields,
  type LeadSearchInput,
  type ProspeoPersonFields,
} from 'src/gtm/prospeo/people';

type FindLeadsInput = LeadSearchInput & {
  icpProfileId?: string;
  page?: number;
  pages?: number;
};

const stringList = (description: string) => ({ type: 'array' as const, items: { type: 'string' as const }, description });

const handler = async (payload: unknown) => {
  const input = toolOrRouteInput<FindLeadsInput>(payload);
  try {
    const apiKey = getProspeoKey();

    let fromIcp: LeadSearchInput = {};
    const profiles = await activeCriteria();
    if (input.icpProfileId) {
      const icp = await getIcpProfile(input.icpProfileId);
      if (!icp) return { ok: false, error: `ICP profile ${input.icpProfileId} not found` };
      fromIcp = { jobTitles: icp.jobTitles, industries: icp.industries, locations: icp.locations, headcount: icp.headcount };
      // Score against the chosen ICP even when it is not active.
      if (!profiles.some((p) => p.id === icp.id)) profiles.push(icpCriteria(icp));
    }
    const explicit: LeadSearchInput = {
      jobTitles: input.jobTitles,
      industries: input.industries,
      locations: input.locations,
      headcount: input.headcount,
      seniority: input.seniority,
      companyWebsites: input.companyWebsites,
    };
    const filters = buildSearchFilters(mergeSearchInput<LeadSearchInput>(fromIcp, explicit));

    const firstPage = clampPage(input.page);
    const pageCount = clampPageCount(input.pages);
    const found: ProspeoPersonFields[] = [];
    let pagesFetched = 0;
    let totalAvailable: number | undefined;
    let totalPages: number | undefined;
    for (let page = firstPage; page < firstPage + pageCount; page++) {
      try {
        const res = await searchPeople(apiKey, filters, page);
        pagesFetched++;
        totalAvailable = res.pagination?.total_count ?? totalAvailable;
        totalPages = res.pagination?.total_page ?? totalPages;
        found.push(...(res.results ?? []).map(personFields));
        if (totalPages !== undefined && page >= totalPages) break;
      } catch (err) {
        if (err instanceof ProspeoError && err.isEmpty) break;
        throw err;
      }
    }

    const ids = found.map((f) => f.personId).filter((id): id is string => Boolean(id));
    const emails = found.map((f) => f.email).filter((e): e is string => Boolean(e));
    const [byId, byEmail] = await Promise.all([findPeopleByProspeoIds(ids), findPeopleByEmails(emails)]);
    const plan = planNewLeads(found, {
      prospeoIds: byId.map((p) => p.prospeoPersonId).filter((v): v is string => Boolean(v)),
      emails: byEmail.map((p) => p.emails?.primaryEmail).filter((v): v is string => Boolean(v)),
    });

    const companyIds = new Map<string, string>();
    let companiesCreated = 0;
    let companiesMatched = 0;
    let created = 0;
    const grades: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    for (const lead of plan.toCreate) {
      let companyId: string | null = null;
      const domain = lead.companyDomain;
      if (domain) {
        companyId = companyIds.get(domain) ?? null;
        if (!companyId) {
          const existing = await findCompanyByDomain(domain);
          if (existing) {
            companyId = existing.id;
            companiesMatched++;
          } else {
            const companyPayload = companyPayloadFromProspeo(lead);
            if (companyPayload) {
              companyId = (await createRecord('companies', companyPayload)).id;
              companiesCreated++;
            }
          }
          if (companyId) companyIds.set(domain, companyId);
        }
      }
      const score = scoreLead(leadProfileFromProspeo(lead), profiles);
      // Queued for qualification (website, company and title checks, the 85% gates).
      await createRecord('people', { ...personPayloadFromProspeo(lead, { companyId, score }), qualificationStatus: 'PENDING' });
      if (score) grades[score.grade]++;
      created++;
    }

    const lastPage = firstPage + pagesFetched - 1;
    return {
      ok: true,
      found: found.length,
      created,
      skippedDuplicates: plan.duplicates,
      skippedUnusable: plan.unusable,
      companiesCreated,
      companiesMatched,
      grades,
      pagesFetched,
      totalAvailable: totalAvailable ?? null,
      nextPage: totalPages !== undefined && lastPage < totalPages ? lastPage + 1 : null,
    };
  } catch (err) {
    return failure(err);
  }
};

export default defineLogicFunction({
  universalIdentifier: FIND_LEADS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'find-leads',
  description:
    'Find new leads in Prospeo for an ICP profile or explicit filters and add them to People (lead source Prospeo, status New), with their companies. Skips people already in the CRM. Costs one Prospeo credit per page of results.',
  timeoutSeconds: 300,
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        icpProfileId: { type: 'string', description: 'Id of an ICP profile whose titles, industries, locations and sizes to search with' },
        jobTitles: stringList('Job titles to search for, e.g. "Head of Marketing"'),
        industries: stringList('Company industries'),
        locations: stringList('Person locations, e.g. "United Kingdom"'),
        headcount: stringList('Company sizes: 1-10, 11-20, 21-50, 51-100, 101-200, 201-500, 501-1000, 1001-2000, 2001-5000, 5001-10000, 10000+'),
        seniority: stringList('Seniority: Founder/Owner, C-Suite, Partner, Vice President, Head, Director, Manager, Senior, Entry, Intern'),
        companyWebsites: stringList('Only people at these company domains'),
        page: { type: 'integer', minimum: 1, description: 'First Prospeo results page (25 people per page). Default 1.' },
        pages: { type: 'integer', minimum: 1, maximum: 10, description: 'How many pages to fetch. Default 1.' },
      },
    },
  },
  httpRouteTriggerSettings: {
    path: FIND_LEADS_ROUTE_PATH,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
  handler,
});
