import { defineLogicFunction } from 'twenty-sdk/define';

import { RENEWALS_FUNCTION_UNIVERSAL_IDENTIFIER } from 'src/constants/agency-ids';
import { dailyRenewals } from 'src/gtm/agency/renewals';
import { agencyRecords, agencySettings, agencyWriter, errorText } from 'src/gtm/agency/runtime';

// Daily 10:00: renewal emails 14 days ahead, referral asks two weeks after
// delivery, and upsells the delivery trigger missed.
const handler = async () => {
  try {
    return await dailyRenewals({ records: agencyRecords(), writer: await agencyWriter(), settings: agencySettings() });
  } catch (error) {
    return { ok: false, error: errorText(error) };
  }
};

export default defineLogicFunction({
  universalIdentifier: RENEWALS_FUNCTION_UNIVERSAL_IDENTIFIER,
  name: 'renewals',
  description: 'Drafts renewal emails before renewal dates, referral asks after delivery, and missed upsells',
  timeoutSeconds: 300,
  handler,
  cronTriggerSettings: { pattern: '0 10 * * *' },
});
