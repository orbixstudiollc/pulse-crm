import { defineLogicFunction } from 'twenty-sdk/define';

import { IMPORT_LEADS_FUNCTION_UNIVERSAL_IDENTIFIER, IMPORT_LEADS_ROUTE_PATH } from 'src/constants/qualify-ids';
import { failure, toolOrRouteInput } from 'src/gtm/leadfinder/payload';
import { cleanRow, parseLeadFile, type LeadColumn, type LeadRow } from 'src/gtm/qualify/columns';
import { importLeads, MAX_IMPORT_ROWS } from 'src/gtm/qualify/import';
import { createImportStore } from 'src/gtm/qualify/twenty-store';

type Input = { rows?: LeadRow[]; csv?: string; mapping?: (LeadColumn | null)[] };

// POST /s/qualify/import  {"rows": [...]} or {"csv": "...", "mapping": [...]}
// Creates or matches Companies and People; new people start as Pending for
// the qualifier. The Setup page sends the file in chunks of rows.
export default defineLogicFunction({
  universalIdentifier: IMPORT_LEADS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'import-leads',
  description: `Import up to ${MAX_IMPORT_ROWS} leads (rows of name, email, title, company, website, ...). Matches companies by domain and skips people already in the CRM by email, source record ID, LinkedIn or Prospeo ID. New people are queued for qualification.`,
  timeoutSeconds: 300,
  httpRouteTriggerSettings: { path: IMPORT_LEADS_ROUTE_PATH, httpMethod: 'POST', isAuthRequired: true },
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        rows: {
          type: 'array',
          description: 'Lead rows with any of: sourceRecordId, prospeoPersonId, firstName, lastName, fullName, email, emailStatus, jobTitle, linkedinUrl, location, city, state, country, companyName, companyDomain, companyLinkedinUrl, industry, headcount, companyCity, companyCountry',
          items: { type: 'object' },
        },
        csv: { type: 'string', description: 'Alternatively, CSV text with a header row' },
      },
    },
  },
  handler: async (payload: unknown) => {
    const input = toolOrRouteInput<Input>(payload);
    try {
      const rows = Array.isArray(input.rows)
        ? input.rows.filter((r) => r && typeof r === 'object').map(cleanRow)
        : typeof input.csv === 'string'
          ? parseLeadFile(input.csv, input.mapping).rows
          : null;
      if (!rows) return { ok: false, error: 'Send rows or csv' };
      return { ok: true, ...(await importLeads({ store: createImportStore(), rows })) };
    } catch (error) {
      return failure(error);
    }
  },
});
