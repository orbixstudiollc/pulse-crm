import { defineFrontComponent } from 'twenty-sdk/define';

import { PULSE_SETUP_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/sequences-ids';
import { AiModelSection } from 'src/front-components/setup/ai-model-section';
import { MailboxImportSection } from 'src/front-components/setup/mailbox-import-section';
import { useTheme } from 'src/insights/ui';

// The Setup page in the sidebar: bulk mailbox import and the AI model picker.
const PulseSetup = () => {
  const theme = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, padding: 24, maxWidth: 760, fontFamily: 'inherit', color: theme.text }}>
      <MailboxImportSection />
      <AiModelSection />
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: PULSE_SETUP_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'pulse-setup',
  description: 'Add many mailboxes from a pasted sheet, and pick the AI model for openers',
  component: PulseSetup,
});
