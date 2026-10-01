import { defineFrontComponent } from 'twenty-sdk/define';

import { FC_LEADS_BY_GRADE_ID } from 'src/constants/insights-ids';
import { leadsByGrade } from 'src/insights/aggregations';
import { BarList, Status, useInsightsData } from 'src/insights/ui';

const LeadsByGrade = () => {
  const { data, error } = useInsightsData({ people: true });
  if (!data) return <Status error={error} />;
  return <BarList buckets={leadsByGrade(data.people)} />;
};

export default defineFrontComponent({
  universalIdentifier: FC_LEADS_BY_GRADE_ID,
  name: 'pulse-leads-by-grade',
  description: 'Leads by ICP grade',
  component: LeadsByGrade,
});
