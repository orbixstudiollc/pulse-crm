import { defineLogicFunction } from 'twenty-sdk/define';

import {
  FIND_LEADS_FUNCTION_UNIVERSAL_IDENTIFIER,
  FIND_LEADS_ROUTE_PATH,
} from 'src/constants/leadfinder-ids';
import { findLeads, type FindLeadsInput } from 'src/gtm/leadfinder/find';
import { toolOrRouteInput } from 'src/gtm/leadfinder/payload';

const stringList = (description: string) => ({ type: 'array' as const, items: { type: 'string' as const }, description });

const handler = (payload: unknown) => findLeads(toolOrRouteInput<FindLeadsInput>(payload));

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
