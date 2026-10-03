import { defineLogicFunction, type DatabaseEventPayload } from 'twenty-sdk/define';

import { PROJECT_DELIVERED_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/agency-ids';
import { onProjectDelivered } from 'src/gtm/agency/renewals';
import { agencyRecords, agencySettings, agencyWriter, errorText } from 'src/gtm/agency/runtime';

type Row = { id?: string; status?: string | null };

// When a project moves to Delivered: stamps the delivery date and drafts the
// upsell for the next service.
const handler = async (event: DatabaseEventPayload) => {
  const { before, after } = event.properties as { before?: Row; after?: Row };
  if (!after?.id || after.status !== 'DELIVERED') return { ok: true, skipped: 'Not delivered' };
  if (before?.status === 'DELIVERED') return { ok: true, skipped: 'Already delivered' };
  try {
    return await onProjectDelivered({
      records: agencyRecords(),
      writer: await agencyWriter(),
      settings: agencySettings(),
      projectId: after.id,
    });
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: PROJECT_DELIVERED_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'project-delivered',
  description: 'When a project is delivered, records the date and drafts an upsell email for the next service',
  timeoutSeconds: 120,
  handler,
  databaseEventTriggerSettings: { eventName: 'clientProject.updated', updatedFields: ['status'] },
});
