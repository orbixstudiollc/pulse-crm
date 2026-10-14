import { defineLogicFunction } from 'twenty-sdk/define';

import {
  ENRICH_LEAD_FUNCTION_UNIVERSAL_IDENTIFIER,
  ENRICH_LEAD_ROUTE_PATH,
} from 'src/constants/leadfinder-ids';
import { fullName } from 'src/gtm/leadfinder/mapping';
import { failure, toolOrRouteInput } from 'src/gtm/leadfinder/payload';
import { findPeopleByEmails, getPerson, updatePerson } from 'src/gtm/leadfinder/twenty';
import { enrichPerson } from 'src/gtm/prospeo/api';
import { getProspeoKey, ProspeoError } from 'src/gtm/prospeo/client';
import { enrichDatapoints, enrichedContact, toDomain } from 'src/gtm/prospeo/people';

type EnrichLeadInput = { personId?: string; mobile?: boolean };

const handler = async (payload: unknown) => {
  const { personId, mobile } = toolOrRouteInput<EnrichLeadInput>(payload);
  if (!personId) return { ok: false, error: 'personId is required' };
  try {
    const apiKey = getProspeoKey();
    const person = await getPerson(personId);
    if (!person) return { ok: false, error: `Person ${personId} not found` };

    const domain = person.company?.domainName?.primaryLinkUrl;
    const datapoints = enrichDatapoints({
      prospeoPersonId: person.prospeoPersonId,
      linkedinUrl: person.linkedinLink?.primaryLinkUrl,
      fullName: fullName(person),
      companyName: person.company?.name,
      companyDomain: domain ? toDomain(domain) : null,
      email: person.emails?.primaryEmail,
    });
    if (!datapoints) {
      return { ok: false, error: 'Not enough to look this person up: add a LinkedIn URL, or a name and company', code: 'INVALID_DATAPOINTS' };
    }

    let response: Record<string, unknown>;
    try {
      response = await enrichPerson(apiKey, datapoints, { mobile: Boolean(mobile) });
    } catch (err) {
      if (err instanceof ProspeoError && err.isEmpty) return { ok: true, personId, found: false, emailUpdated: false, mobileUpdated: false };
      throw err;
    }
    const contact = enrichedContact(response);

    const update: Record<string, unknown> = {};
    let duplicateOf: string | null = null;
    const currentEmail = person.emails?.primaryEmail?.toLowerCase() ?? null;
    if (contact.email && contact.email !== currentEmail) {
      const others = (await findPeopleByEmails([contact.email])).filter((p) => p.id !== personId);
      if (others.length > 0) duplicateOf = others[0].id;
      else update.emails = { primaryEmail: contact.email };
    }
    if (contact.mobile && contact.mobile !== person.phones?.primaryPhoneNumber) {
      update.phones = { primaryPhoneNumber: contact.mobile };
    }
    if (contact.personId && !person.prospeoPersonId) update.prospeoPersonId = contact.personId;
    if (Object.keys(update).length > 0) await updatePerson(personId, update);

    return {
      ok: true,
      personId,
      found: true,
      email: contact.email ?? null,
      emailVerified: contact.emailVerified,
      emailUpdated: 'emails' in update,
      mobileUpdated: 'phones' in update,
      // The email already belongs to another person in the CRM; left unchanged.
      duplicateOf,
    };
  } catch (err) {
    return failure(err);
  }
};

export default defineLogicFunction({
  universalIdentifier: ENRICH_LEAD_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'enrich-lead',
  description:
    "Look up a person's verified work email (and optionally mobile) in Prospeo and save it on the person. Costs 1 Prospeo credit for email, 10 with mobile; nothing when no match.",
  timeoutSeconds: 60,
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        personId: { type: 'string', description: 'Id of the person to enrich' },
        mobile: { type: 'boolean', description: 'Also look up a mobile number (10 credits instead of 1)' },
      },
      required: ['personId'],
    },
  },
  httpRouteTriggerSettings: {
    path: ENRICH_LEAD_ROUTE_PATH,
    httpMethod: 'POST',
    isAuthRequired: true,
  },
  handler,
});
