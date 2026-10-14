import { defineRole } from 'twenty-sdk/define';

import { COPILOT_ROLE_ID } from 'src/constants/insights-ids';

// What Pulse Copilot may do: read and update CRM records and call the app's
// tools. It cannot delete or destroy records.
export default defineRole({
  universalIdentifier: COPILOT_ROLE_ID,
  label: 'Pulse Copilot',
  description: 'Role for the Pulse Copilot agent: read/update records, use tools, no deletes',
  icon: 'IconSparkles',
  canReadAllObjectRecords: true,
  canUpdateAllObjectRecords: true,
  canSoftDeleteAllObjectRecords: false,
  canDestroyAllObjectRecords: false,
  canUpdateAllSettings: false,
  canBeAssignedToAgents: true,
  canBeAssignedToUsers: false,
  canBeAssignedToApiKeys: false,
});
