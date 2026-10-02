// Select values for website visits.

export const VISITOR_ENRICH_STATUSES = [
  { label: 'Waiting', value: 'PENDING', color: 'gray' },
  { label: 'Company found', value: 'MATCHED', color: 'blue' },
  { label: 'Leads added', value: 'LEADS_ADDED', color: 'green' },
  { label: 'No company', value: 'NO_MATCH', color: 'gray' },
  { label: 'Our team', value: 'OWN_TEAM', color: 'purple' },
  { label: 'Outside your regions', value: 'OUT_OF_REGION', color: 'gray' },
  { label: 'Error', value: 'ERROR', color: 'red' },
] as const;

export type VisitorEnrichStatus = (typeof VISITOR_ENRICH_STATUSES)[number]['value'];
