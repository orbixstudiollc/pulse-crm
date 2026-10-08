// Lead search: shared by the find-leads logic function and the Pulse chat.

import { mergeSearchInput, planNewLeads } from 'src/gtm/leadfinder/dedupe';
import {
  companyPayloadFromProspeo,
  icpCriteria,
  leadProfileFromProspeo,
  personPayloadFromProspeo,
} from 'src/gtm/leadfinder/mapping';
import { failure } from 'src/gtm/leadfinder/payload';
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

export type FindLeadsInput = LeadSearchInput & {
  icpProfileId?: string;
  page?: number;
  pages?: number;
};

// Search Prospeo and add the new people (queued for qualification) and their companies.
export const findLeads = async (input: FindLeadsInput) => {
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
