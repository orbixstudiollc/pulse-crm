import { defineFrontComponent } from 'twenty-sdk/define';

import { FC_NEW_LEADS_TREND_ID } from 'src/constants/insights-ids';
import { weeklyNewLeads } from 'src/insights/aggregations';
import { ColumnChart, Status, useInsightsData } from 'src/insights/ui';

const NewLeadsTrend = () => {
  const { data, error } = useInsightsData({ people: true });
  if (!data) return <Status error={error} />;
  const points = weeklyNewLeads(data.people, new Date(), 8).map((w) => ({
    label: w.weekStart.slice(5),
    count: w.count,
  }));
  return <ColumnChart points={points} />;
};

export default defineFrontComponent({
  universalIdentifier: FC_NEW_LEADS_TREND_ID,
  name: 'pulse-new-leads-trend',
  description: 'New leads per week over the last 8 weeks',
  component: NewLeadsTrend,
});
