import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { Command, enqueueSnackbar, useSelectedRecordIds } from 'twenty-sdk/front-component';

import {
  FIND_LEADS_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  FIND_LEADS_ROUTE_PATH,
} from 'src/constants/leadfinder-ids';

// Headless command: runs one page of Prospeo search for the selected ICP.
type FindLeadsResult = { ok: boolean; created?: number; found?: number; skippedDuplicates?: number; error?: string };

const FindLeadsForIcp = () => {
  const selectedIds = useSelectedRecordIds();

  const execute = async () => {
    const icpProfileId = selectedIds[0];
    if (!icpProfileId) return;
    try {
      const res = await new RestApiClient().post<FindLeadsResult>(`/s${FIND_LEADS_ROUTE_PATH}`, { icpProfileId });
      if (!res.ok) {
        enqueueSnackbar({ message: 'Lead search failed', variant: 'error', detailedMessage: res.error });
        return;
      }
      enqueueSnackbar({
        message: `Added ${res.created ?? 0} new leads (${res.found ?? 0} found, ${res.skippedDuplicates ?? 0} already in the CRM)`,
        variant: 'success',
      });
    } catch (err) {
      enqueueSnackbar({
        message: 'Lead search failed',
        variant: 'error',
        detailedMessage: err instanceof Error ? err.message : String(err),
      });
    }
  };

  return <Command execute={execute} />;
};

export default defineFrontComponent({
  universalIdentifier: FIND_LEADS_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'find-leads-for-icp',
  description: 'Searches Prospeo for people matching the selected ICP and adds them as leads',
  isHeadless: true,
  component: FindLeadsForIcp,
});
