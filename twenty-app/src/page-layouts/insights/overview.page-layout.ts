import { definePageLayout, PageLayoutTabLayoutMode, PageLayoutType } from 'twenty-sdk/define';

import {
  FC_LEADS_BY_STATUS_ID,
  FC_OVERVIEW_KPIS_ID,
  FC_PIPELINE_BY_STAGE_ID,
  OVERVIEW_PAGE_LAYOUT_ID,
  OVERVIEW_TAB_ID,
  OVERVIEW_W_KPIS_ID,
  OVERVIEW_W_PIPELINE_ID,
  OVERVIEW_W_STATUS_ID,
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

// The Pulse home screen: headline numbers, the pipeline and the lead funnel.
export default definePageLayout({
  universalIdentifier: OVERVIEW_PAGE_LAYOUT_ID,
  name: 'Overview',
  type: PageLayoutType.STANDALONE_PAGE,
  tabs: [
    {
      universalIdentifier: OVERVIEW_TAB_ID,
      title: 'Overview',
      position: 0,
      icon: 'IconHome',
      layoutMode: PageLayoutTabLayoutMode.GRID,
      widgets: [
        { universalIdentifier: OVERVIEW_W_KPIS_ID, title: 'This week', type: 'FRONT_COMPONENT', position: grid(0, 0, 2, 12), configuration: fc(FC_OVERVIEW_KPIS_ID) },
        { universalIdentifier: OVERVIEW_W_PIPELINE_ID, title: 'Pipeline value by stage', type: 'FRONT_COMPONENT', position: grid(2, 0, 6, 6), configuration: fc(FC_PIPELINE_BY_STAGE_ID) },
        { universalIdentifier: OVERVIEW_W_STATUS_ID, title: 'Leads by status', type: 'FRONT_COMPONENT', position: grid(2, 6, 6, 6), configuration: fc(FC_LEADS_BY_STATUS_ID) },
      ],
    },
  ],
});
