import { definePageLayout, PageLayoutTabLayoutMode, PageLayoutType } from 'twenty-sdk/define';

import {
  PULSE_SETUP_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  PULSE_SETUP_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  PULSE_SETUP_TAB_UNIVERSAL_IDENTIFIER,
  PULSE_SETUP_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/sequences-ids';

// One full-page canvas so the long mailbox list can scroll.
export default definePageLayout({
  universalIdentifier: PULSE_SETUP_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Setup',
  type: PageLayoutType.STANDALONE_PAGE,
  tabs: [
    {
      universalIdentifier: PULSE_SETUP_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Setup',
      position: 0,
      icon: 'IconSettings',
      layoutMode: PageLayoutTabLayoutMode.CANVAS,
      widgets: [
        {
          universalIdentifier: PULSE_SETUP_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'Setup',
          type: 'FRONT_COMPONENT',
          position: { layoutMode: PageLayoutTabLayoutMode.CANVAS },
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier: PULSE_SETUP_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
  ],
});
