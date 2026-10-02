import { RestApiClient } from 'twenty-client-sdk/rest';
import { defineFrontComponent } from 'twenty-sdk/define';
import { Command, enqueueSnackbar, useSelectedRecordIds } from 'twenty-sdk/front-component';

import {
  ENRICH_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  ENRICH_LEAD_ROUTE_PATH,
} from 'src/constants/leadfinder-ids';

// Headless command: enriches the selected people through the enrich-lead route.
const MAX_PEOPLE = 25;

type EnrichResult = { ok: boolean; found?: boolean; emailUpdated?: boolean; error?: string };

const EnrichWithProspeo = () => {
  const selectedIds = useSelectedRecordIds();

  const execute = async () => {
    const ids = selectedIds.slice(0, MAX_PEOPLE);
    if (ids.length === 0) return;
    const client = new RestApiClient();
    let updated = 0;
    let notFound = 0;
    const errors: string[] = [];
    for (const personId of ids) {
      try {
        const res = await client.post<EnrichResult>(`/s${ENRICH_LEAD_ROUTE_PATH}`, { personId });
        if (!res.ok) errors.push(res.error ?? 'Unknown error');
        else if (!res.found) notFound++;
        else if (res.emailUpdated) updated++;
      } catch (err) {
        errors.push(err instanceof Error ? err.message : String(err));
      }
    }
    const parts = [`${updated} email${updated === 1 ? '' : 's'} found`];
    if (notFound > 0) parts.push(`${notFound} not found`);
    if (errors.length > 0) parts.push(`${errors.length} failed`);
    if (selectedIds.length > MAX_PEOPLE) parts.push(`only the first ${MAX_PEOPLE} were enriched`);
    enqueueSnackbar({
      message: `Prospeo: ${parts.join(', ')}`,
      variant: errors.length > 0 && updated === 0 ? 'error' : 'success',
      detailedMessage: errors[0],
    });
  };

  return <Command execute={execute} />;
};

export default defineFrontComponent({
  universalIdentifier: ENRICH_COMMAND_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'enrich-with-prospeo',
  description: 'Finds verified emails for the selected people with Prospeo',
  isHeadless: true,
  component: EnrichWithProspeo,
});
