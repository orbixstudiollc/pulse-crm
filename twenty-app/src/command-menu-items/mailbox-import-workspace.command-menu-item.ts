import { defineCommandMenuItem } from 'twenty-sdk/define';

import {
  MAILBOX_IMPORT_WORKSPACE_CMD_UID,
  MAILBOX_IMPORT_WORKSPACE_FRONT_UID,
  MAILBOX_OBJECT_UID,
} from 'src/constants/mailbox-ids';

// Shown on the Mailboxes list.
export default defineCommandMenuItem({
  universalIdentifier: MAILBOX_IMPORT_WORKSPACE_CMD_UID,
  label: 'Import Google Workspace mailboxes',
  shortLabel: 'Import Workspace',
  availabilityType: 'GLOBAL_OBJECT_CONTEXT',
  availabilityObjectUniversalIdentifier: MAILBOX_OBJECT_UID,
  frontComponentUniversalIdentifier: MAILBOX_IMPORT_WORKSPACE_FRONT_UID,
});
