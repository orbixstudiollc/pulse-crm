import { FieldType, type ApplicationConfig } from 'twenty-sdk/define';

import {
  VAR_IPINFO_TOKEN_ID,
  VAR_TRACKING_ENDPOINT_ID,
  VAR_VISITOR_COUNTRIES_ID,
  VAR_VISITOR_LEADS_DAILY_CAP_ID,
  VAR_VISITOR_LEADS_PER_COMPANY_ID,
  VAR_VISITOR_SEQUENCE_NAME_ID,
} from 'src/constants/insights-ids';

// Application variables for Website Visitors. Spread into application-config.ts.
export const VISITOR_APPLICATION_VARIABLES: NonNullable<ApplicationConfig['applicationVariables']> = {
  IPINFO_TOKEN: {
    universalIdentifier: VAR_IPINFO_TOKEN_ID,
    label: 'IPinfo token',
    description:
      'Finds the company behind a visitor from their IP address. Free token at ipinfo.io/signup; a plan with company data matches more visitors.',
    isSecret: true,
    isRequired: false,
  },
  VISITOR_LEADS_PER_COMPANY: {
    universalIdentifier: VAR_VISITOR_LEADS_PER_COMPANY_ID,
    label: 'Leads per visiting company',
    description: 'How many ICP people Prospeo adds as leads for each company that visits (default 3, 0 turns it off). About 1 credit per search plus 1 per email.',
    type: FieldType.TEXT,
    isRequired: false,
  },
  VISITOR_LEADS_DAILY_CAP: {
    universalIdentifier: VAR_VISITOR_LEADS_DAILY_CAP_ID,
    label: 'Visitor leads per day (max)',
    description: 'Most new leads website visitors can bring in per day, to protect Prospeo credits (default 20).',
    type: FieldType.TEXT,
    isRequired: false,
  },
  VISITOR_COUNTRIES: {
    universalIdentifier: VAR_VISITOR_COUNTRIES_ID,
    label: 'Visitor countries',
    description:
      'Only visitors from these places get a company lookup and Prospeo leads. Regions EUROPE, GCC, NORTH_AMERICA, OCEANIA and/or country codes, comma separated (default "EUROPE, GCC, NORTH_AMERICA, OCEANIA"). ALL turns the filter off.',
    type: FieldType.TEXT,
    isRequired: false,
  },
  VISITOR_SEQUENCE_NAME: {
    universalIdentifier: VAR_VISITOR_SEQUENCE_NAME_ID,
    label: 'Website visitor sequence',
    description: 'Name of the sequence new visitor leads and form fills are enrolled in (default "Website visitors"). No sequence with that name: nobody is enrolled.',
    type: FieldType.TEXT,
    isRequired: false,
  },
  TRACKING_ENDPOINT_URL: {
    universalIdentifier: VAR_TRACKING_ENDPOINT_ID,
    label: 'Tracking endpoint (advanced)',
    description: 'Optional. Overrides the address the website tag sends to, e.g. a proxy on your own domain. Leave empty to use this workspace.',
    type: FieldType.TEXT,
    isRequired: false,
  },
};
