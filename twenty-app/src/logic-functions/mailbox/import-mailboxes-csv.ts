import { defineLogicFunction } from 'twenty-sdk/define';

import { MAILBOX_FN_IMPORT_CSV_UID, MAILBOX_IMPORT_CSV_ROUTE_PATH } from 'src/constants/mailbox-ids';
import { encryptMailboxSecret } from 'src/gtm/mailbox/credentials';
import { createRestClient, readEncryptionKey } from 'src/gtm/mailbox/env';
import { importCsvMailboxes, toolOrRouteInput } from 'src/gtm/mailbox/import-runner';
import { createMailboxImportStore } from 'src/gtm/mailbox/twenty-repository';

type Input = { csv?: string; dryRun?: boolean };

// POST /s/mailboxes/import-csv  {"csv": "email,password,display name\n..."}
// Adds many app-password mailboxes (gmail.com, outlook.com, custom domains)
// in one paste. Each password is sealed with MAILBOX_ENCRYPTION_KEY before it
// is stored. Route only, not an AI tool, so passwords never pass through a chat.
export default defineLogicFunction({
  universalIdentifier: MAILBOX_FN_IMPORT_CSV_UID,
  name: 'import-mailboxes-csv',
  description: 'Bulk-adds mailboxes from CSV (email, app password, display name), encrypting each password',
  timeoutSeconds: 120,
  httpRouteTriggerSettings: { path: MAILBOX_IMPORT_CSV_ROUTE_PATH, httpMethod: 'POST', isAuthRequired: true },
  handler: async (payload: unknown) => {
    const input = toolOrRouteInput<Input>(payload);
    if (typeof input.csv !== 'string' || !input.csv.trim()) return { ok: false, error: 'csv is required' };
    try {
      const key = readEncryptionKey();
      return await importCsvMailboxes({
        store: createMailboxImportStore(createRestClient()),
        csv: input.csv,
        seal: (password) => encryptMailboxSecret({ password }, key),
        dryRun: input.dryRun === true,
      });
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
});
