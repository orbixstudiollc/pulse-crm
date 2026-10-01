import { defineFrontComponent } from 'twenty-sdk/define';

import { FC_PIPELINE_BY_STAGE_ID } from 'src/constants/insights-ids';
import { dominantCurrency, formatMoney, pipelineByStage } from 'src/insights/aggregations';
import { BarList, Status, useInsightsData } from 'src/insights/ui';

const PipelineByStage = () => {
  const { data, error } = useInsightsData({ opportunities: true });
  if (!data) return <Status error={error} />;
  const currency = dominantCurrency(data.opportunities);
  return (
    <BarList
      buckets={pipelineByStage(data.opportunities)}
      measure="value"
      format={(n) => formatMoney(n, currency)}
      detail={(b) => String(b.count)}
    />
  );
};

export default defineFrontComponent({
  universalIdentifier: FC_PIPELINE_BY_STAGE_ID,
  name: 'pulse-pipeline-by-stage',
  description: 'Opportunity value and count per stage',
  component: PipelineByStage,
});
