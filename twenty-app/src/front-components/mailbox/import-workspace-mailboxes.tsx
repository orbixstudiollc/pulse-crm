import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { Command, enqueueSnackbar } from 'twenty-sdk/front-component';

import { MAILBOX_IMPORT_WORKSPACE_FRONT_UID, MAILBOX_IMPORT_WORKSPACE_ROUTE_PATH } from 'src/constants/mailbox-ids';

// Headless command: imports every active Google Workspace user as a mailbox.
type ImportResult = { ok: boolean; created?: string[]; skippedExisting?: string[]; failed?: unknown[]; error?: string };

const ImportWorkspaceMailboxes = () => {
  const execute = async () => {
    try {
      const res = await new RestApiClient().post<ImportResult>(`/s${MAILBOX_IMPORT_WORKSPACE_ROUTE_PATH}`, {});
      if (!res.ok) {
        enqueueSnackbar({ message: 'Workspace import failed', variant: 'error', detailedMessage: res.error });
        return;
      }
      enqueueSnackbar({
        message: `Added ${res.created?.length ?? 0} mailboxes (${res.skippedExisting?.length ?? 0} already there, ${res.failed?.length ?? 0} failed)`,
        variant: 'success',
      });
    } catch (err) {
      enqueueSnackbar({
        message: 'Workspace import failed',
        variant: 'error',
        detailedMessage: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return <Command execute={execute} />;
};

export default defineFrontComponent({
  universalIdentifier: MAILBOX_IMPORT_WORKSPACE_FRONT_UID,
  name: 'import-workspace-mailboxes',
  description: 'Imports Google Workspace users as warming mailboxes via domain-wide delegation',
  isHeadless: true,
  component: ImportWorkspaceMailboxes,
});
