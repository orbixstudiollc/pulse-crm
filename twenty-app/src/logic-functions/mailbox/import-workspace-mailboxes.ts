import { defineLogicFunction } from 'twenty-sdk/define';

import { MAILBOX_FN_IMPORT_WORKSPACE_UID, MAILBOX_IMPORT_WORKSPACE_ROUTE_PATH } from 'src/constants/mailbox-ids';
import { createRestClient, readDelegatedTokenSource, readWorkspaceAdminEmail } from 'src/gtm/mailbox/env';
import { DIRECTORY_USER_READONLY_SCOPE } from 'src/gtm/mailbox/google-delegation';
import { listWorkspaceUsers } from 'src/gtm/mailbox/google-directory';
import { importWorkspaceMailboxes, toolOrRouteInput, toStringList } from 'src/gtm/mailbox/import-runner';
import { createMailboxImportStore } from 'src/gtm/mailbox/twenty-repository';

type Input = { domain?: string; orgUnitPath?: string; emails?: string[] | string; dryRun?: boolean };

// Lists Google Workspace users (acting as the admin through domain-wide
// delegation) and adds each active one as a warming mailbox that signs in
// with delegated tokens. Existing mailboxes are skipped. No passwords.
const handler = async (payload: unknown) => {
  const input = toolOrRouteInput<Input>(payload);
  try {
    const tokens = readDelegatedTokenSource();
    if (!tokens) return { ok: false, error: 'GOOGLE_SERVICE_ACCOUNT_JSON is not set' };
    const admin = readWorkspaceAdminEmail();
    return await importWorkspaceMailboxes({
      store: createMailboxImportStore(createRestClient()),
      listUsers: async () =>
        listWorkspaceUsers(await tokens(admin, [DIRECTORY_USER_READONLY_SCOPE]), { domain: input.domain }),
      filter: { domain: input.domain, orgUnitPath: input.orgUnitPath, emails: toStringList(input.emails) },
      dryRun: input.dryRun === true,
    });
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: MAILBOX_FN_IMPORT_WORKSPACE_UID,
  name: 'import-workspace-mailboxes',
  description:
    'Import Google Workspace users as sending mailboxes (warming, warmup on, signed in by domain-wide delegation, no passwords). Optional filters: domain, org unit path, list of emails. Skips mailboxes that already exist. Use dryRun to preview.',
  timeoutSeconds: 300,
  toolTriggerSettings: {
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Only users on this domain, e.g. "acme-mail.com"' },
        orgUnitPath: { type: 'string', description: 'Only users in this org unit (and its children), e.g. "/Sales"' },
        emails: { type: 'array', items: { type: 'string' }, description: 'Only these addresses' },
        dryRun: { type: 'boolean', description: 'List what would be created without creating anything' },
      },
    },
  },
  httpRouteTriggerSettings: { path: MAILBOX_IMPORT_WORKSPACE_ROUTE_PATH, httpMethod: 'POST', isAuthRequired: true },
  handler,
});
