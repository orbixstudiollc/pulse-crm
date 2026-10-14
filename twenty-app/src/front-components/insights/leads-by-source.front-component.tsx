import { defineFrontComponent } from 'twenty-sdk/define';

import { FC_LEADS_BY_SOURCE_ID } from 'src/constants/insights-ids';
import { leadsBySource } from 'src/insights/aggregations';
import { BarList, Status, useInsightsData } from 'src/insights/ui';

const LeadsBySource = () => {
  const { data, error } = useInsightsData({ people: true });
  if (!data) return <Status error={error} />;
  return <BarList buckets={leadsBySource(data.people)} />;
};

export default defineFrontComponent({
  universalIdentifier: FC_LEADS_BY_SOURCE_ID,
  name: 'pulse-leads-by-source',
  description: 'Leads by source, busiest first',
  component: LeadsBySource,
});
