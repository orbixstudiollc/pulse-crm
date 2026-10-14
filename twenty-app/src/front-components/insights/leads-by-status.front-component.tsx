import { defineFrontComponent } from 'twenty-sdk/define';

import { FC_LEADS_BY_STATUS_ID } from 'src/constants/insights-ids';
import { leadsByStatus } from 'src/insights/aggregations';
import { BarList, Status, useInsightsData } from 'src/insights/ui';

const LeadsByStatus = () => {
  const { data, error } = useInsightsData({ people: true });
  if (!data) return <Status error={error} />;
  return <BarList buckets={leadsByStatus(data.people)} />;
};

export default defineFrontComponent({
  universalIdentifier: FC_LEADS_BY_STATUS_ID,
  name: 'pulse-leads-by-status',
  description: 'Leads by status',
  component: LeadsByStatus,
});
