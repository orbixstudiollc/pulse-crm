import { planNewLeads } from 'src/gtm/leadfinder/dedupe';
import { leadProfileFromProspeo, personPayloadFromProspeo } from 'src/gtm/leadfinder/mapping';
import { activeCriteria } from 'src/gtm/leadfinder/rescore';
import { scoreLead } from 'src/gtm/leadfinder/scoring';
import { createRecord, findPeopleByEmails, findPeopleByProspeoIds, listActiveIcpProfiles, updatePerson } from 'src/gtm/leadfinder/twenty';
import { enrichPerson, searchPeople } from 'src/gtm/prospeo/api';
import { ProspeoError } from 'src/gtm/prospeo/client';
import { buildSearchFilters, enrichedContact, personFields, toList } from 'src/gtm/prospeo/people';

// Decision makers to look for when no active ICP lists job titles.
export const DEFAULT_VISITOR_SENIORITY = ['Founder/Owner', 'C-Suite', 'Partner', 'Vice President', 'Head', 'Director'];

/** Search filters for people at one company: the active ICPs' titles, else senior roles. */
export const visitorSearchInput = (domain: string, icpTitles: string[]) =>
  icpTitles.length > 0
    ? { companyWebsites: [domain], jobTitles: icpTitles }
    : { companyWebsites: [domain], seniority: DEFAULT_VISITOR_SENIORITY };

/**
 * Adds up to `max` people at `domain` as website-visitor leads: one Prospeo
 * search (1 credit), the best ICP matches not already in the CRM, then a
 * verified work email for each (1 credit each). Returns the new person ids.
 */
export async function addLeadsAtCompany(apiKey: string, domain: string, companyId: string, max: number): Promise<string[]> {
  const icps = await listActiveIcpProfiles();
  const titles = [...new Set(icps.flatMap((icp) => toList(icp.jobTitles)))].slice(0, 50);
  let results: Record<string, unknown>[] = [];
  try {
    results = (await searchPeople(apiKey, buildSearchFilters(visitorSearchInput(domain, titles)), 1)).results ?? [];
  } catch (err) {
    if (err instanceof ProspeoError && err.isEmpty) return [];
    throw err;
  }
  const found = results.map(personFields);
  const ids = found.map((f) => f.personId).filter((id): id is string => Boolean(id));
  const emails = found.map((f) => f.email).filter((e): e is string => Boolean(e));
  const [byId, byEmail] = await Promise.all([findPeopleByProspeoIds(ids), findPeopleByEmails(emails)]);
  const plan = planNewLeads(found, {
    prospeoIds: byId.map((p) => p.prospeoPersonId).filter((v): v is string => Boolean(v)),
    emails: byEmail.map((p) => p.emails?.primaryEmail).filter((v): v is string => Boolean(v)),
  });

  const profiles = await activeCriteria();
  const ranked = plan.toCreate
    .map((lead) => ({ lead, score: scoreLead(leadProfileFromProspeo(lead), profiles) }))
    .sort((a, b) => (b.score?.score ?? 0) - (a.score?.score ?? 0))
    .slice(0, max);

  const created: string[] = [];
  for (const { lead, score } of ranked) {
    const payload = { ...personPayloadFromProspeo(lead, { companyId, score }), leadSource: 'WEBSITE', leadStatus: 'WARM' };
    const person = await createRecord('people', payload);
    created.push(person.id);
    if (lead.email || !lead.personId) continue;
    try {
      const contact = enrichedContact(await enrichPerson(apiKey, { person_id: lead.personId }));
      if (contact.email && (await findPeopleByEmails([contact.email])).length === 0) {
        await updatePerson(person.id, { emails: { primaryEmail: contact.email } });
      }
    } catch (err) {
      // No email found is fine: the lead stays, without an email.
      if (!(err instanceof ProspeoError && err.isEmpty)) throw err;
    }
  }
  return created;
}
