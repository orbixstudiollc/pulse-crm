import { defineFrontComponent } from 'twenty-sdk/define';

import { FC_OVERVIEW_KPIS_ID } from 'src/constants/insights-ids';
import {
  dominantCurrency,
  formatMoney,
  formatPercent,
  hotLeadCount,
  newLeadsThisWeek,
  openPipeline,
  winRate,
} from 'src/insights/aggregations';
import { KpiRow, Status, useInsightsData } from 'src/insights/ui';

const OverviewKpis = () => {
  const { data, error } = useInsightsData({ people: true, opportunities: true });
  if (!data) return <Status error={error} />;
  const now = new Date();
  const fresh = newLeadsThisWeek(data.people, now);
  const pipe = openPipeline(data.opportunities);
  const wins = winRate(data.opportunities, now);
  const sign = fresh.delta > 0 ? '+' : '';
  return (
    <KpiRow
      tiles={[
        {
          label: 'Open pipeline',
          value: formatMoney(pipe.value, dominantCurrency(data.opportunities)),
          hint: `${pipe.count} open deals`,
        },
        { label: 'New leads this week', value: String(fresh.thisWeek), hint: `${sign}${fresh.delta} vs last week` },
        { label: 'Hot leads', value: String(hotLeadCount(data.people)), tone: 'red', hint: 'Status Hot' },
        { label: 'Win rate', value: formatPercent(wins.rate), tone: 'green', hint: `${wins.won} won · ${wins.lost} lost` },
      ]}
    />
  );
};

export default defineFrontComponent({
  universalIdentifier: FC_OVERVIEW_KPIS_ID,
  name: 'pulse-overview-kpis',
  description: 'Open pipeline, new leads this week, hot leads and win rate',
  component: OverviewKpis,
});
