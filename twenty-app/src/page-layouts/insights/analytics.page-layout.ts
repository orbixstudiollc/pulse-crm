import { definePageLayout, PageLayoutTabLayoutMode, PageLayoutType } from 'twenty-sdk/define';

import {
  ANALYTICS_PAGE_LAYOUT_ID,
  ANALYTICS_TAB_ID,
  ANALYTICS_W_GRADE_ID,
  ANALYTICS_W_KPIS_ID,
  ANALYTICS_W_PIPELINE_ID,
  ANALYTICS_W_SOURCE_ID,
  ANALYTICS_W_STATUS_ID,
  ANALYTICS_W_TREND_ID,
  FC_LEADS_BY_GRADE_ID,
  FC_LEADS_BY_SOURCE_ID,
  FC_LEADS_BY_STATUS_ID,
  FC_NEW_LEADS_TREND_ID,
  FC_OVERVIEW_KPIS_ID,
  FC_PIPELINE_BY_STAGE_ID,
} from 'src/constants/insights-ids';

const grid = (row: number, column: number, rowSpan: number, columnSpan: number) => ({
  layoutMode: PageLayoutTabLayoutMode.GRID as const,
  row,
  column,
  rowSpan,
  columnSpan,
});

const fc = (frontComponentUniversalIdentifier: string) => ({
  configurationType: 'FRONT_COMPONENT' as const,
  frontComponentUniversalIdentifier,
});

// Deeper cuts than Overview: lead flow over time and the full lead mix.
export default definePageLayout({
  universalIdentifier: ANALYTICS_PAGE_LAYOUT_ID,
  name: 'Analytics',
  type: PageLayoutType.STANDALONE_PAGE,
  tabs: [
    {
      universalIdentifier: ANALYTICS_TAB_ID,
      title: 'Analytics',
      position: 0,
      icon: 'IconChartBar',
      layoutMode: PageLayoutTabLayoutMode.GRID,
      widgets: [
        { universalIdentifier: ANALYTICS_W_KPIS_ID, title: 'Headline', type: 'FRONT_COMPONENT', position: grid(0, 0, 3, 12), configuration: fc(FC_OVERVIEW_KPIS_ID) },
        { universalIdentifier: ANALYTICS_W_TREND_ID, title: 'New leads per week', type: 'FRONT_COMPONENT', position: grid(3, 0, 5, 6), configuration: fc(FC_NEW_LEADS_TREND_ID) },
        { universalIdentifier: ANALYTICS_W_PIPELINE_ID, title: 'Pipeline value by stage', type: 'FRONT_COMPONENT', position: grid(3, 6, 5, 6), configuration: fc(FC_PIPELINE_BY_STAGE_ID) },
        { universalIdentifier: ANALYTICS_W_STATUS_ID, title: 'Leads by status', type: 'FRONT_COMPONENT', position: grid(8, 0, 5, 4), configuration: fc(FC_LEADS_BY_STATUS_ID) },
        { universalIdentifier: ANALYTICS_W_GRADE_ID, title: 'Leads by ICP grade', type: 'FRONT_COMPONENT', position: grid(8, 4, 5, 4), configuration: fc(FC_LEADS_BY_GRADE_ID) },
        { universalIdentifier: ANALYTICS_W_SOURCE_ID, title: 'Leads by source', type: 'FRONT_COMPONENT', position: grid(8, 8, 5, 4), configuration: fc(FC_LEADS_BY_SOURCE_ID) },
      ],
    },
  ],
});
