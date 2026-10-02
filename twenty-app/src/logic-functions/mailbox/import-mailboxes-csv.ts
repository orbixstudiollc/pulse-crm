import { resolveMx } from 'dns/promises';

import { defineLogicFunction } from 'twenty-sdk/define';

import { MAILBOX_FN_IMPORT_CSV_UID, MAILBOX_IMPORT_CSV_ROUTE_PATH } from 'src/constants/mailbox-ids';
import { encryptMailboxSecret } from 'src/gtm/mailbox/credentials';
import { createRestClient, readDelegatedTokenSource, readEncryptionKey } from 'src/gtm/mailbox/env';
import { GMAIL_SCOPE } from 'src/gtm/mailbox/google-delegation';
import { importCsvMailboxes, toolOrRouteInput } from 'src/gtm/mailbox/import-runner';
import { providerFromMxHosts } from 'src/gtm/mailbox/server-settings';
import { createMailboxImportStore } from 'src/gtm/mailbox/twenty-repository';

type Input = { csv?: string; dryRun?: boolean };

// POST /s/mailboxes/import-csv  {"csv": "email,password,display name\n..."}
// Adds many app-password mailboxes (gmail.com, outlook.com, custom domains)
// in one paste. Each password is sealed with MAILBOX_ENCRYPTION_KEY before it
// is stored. Google Workspace rows may leave the password empty when the
// service account key is set (domain-wide delegation, any number of Workspace
// accounts). Route only, not an AI tool, so passwords never pass through a chat.
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
      const delegated = readDelegatedTokenSource();
      return await importCsvMailboxes({
        store: createMailboxImportStore(createRestClient()),
        csv: input.csv,
        seal: (password) => encryptMailboxSecret({ password }, key),
        dryRun: input.dryRun === true,
        delegation: delegated ? { verify: async (email) => void (await delegated(email, [GMAIL_SCOPE])) } : undefined,
        providerForDomain: async (domain) => providerFromMxHosts((await resolveMx(domain)).map((mx) => mx.exchange)),
      });
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  },
});
