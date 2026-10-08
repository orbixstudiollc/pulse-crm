import {
  definePageLayout,
  PageLayoutTabLayoutMode,
  PageLayoutType,
  PageLayoutWidgetVerticalListHeightBehavior,
} from 'twenty-sdk/define';

import {
  PULSE_CHAT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  PULSE_CHAT_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  PULSE_CHAT_TAB_UNIVERSAL_IDENTIFIER,
  PULSE_CHAT_WIDGET_UNIVERSAL_IDENTIFIER,
} from 'src/constants/chat-ids';

// One full-height widget: the chat scrolls inside it.
export default definePageLayout({
  universalIdentifier: PULSE_CHAT_PAGE_LAYOUT_UNIVERSAL_IDENTIFIER,
  name: 'Pulse chat',
  type: PageLayoutType.STANDALONE_PAGE,
  tabs: [
    {
      universalIdentifier: PULSE_CHAT_TAB_UNIVERSAL_IDENTIFIER,
      title: 'Chat',
      position: 0,
      icon: 'IconMessageCircle',
      layoutMode: PageLayoutTabLayoutMode.VERTICAL_LIST,
      widgets: [
        {
          universalIdentifier: PULSE_CHAT_WIDGET_UNIVERSAL_IDENTIFIER,
          title: 'Pulse chat',
          type: 'FRONT_COMPONENT',
          heightBehavior: PageLayoutWidgetVerticalListHeightBehavior.TAB_VIEWPORT,
          configuration: {
            configurationType: 'FRONT_COMPONENT',
            frontComponentUniversalIdentifier: PULSE_CHAT_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
          },
        },
      ],
    },
  ],
});
