import { defineSettingsFrontComponent } from 'twenty-sdk/define';

import { PULSE_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/sequences-ids';
import { AiModelSection } from 'src/front-components/settings/ai-model-section';
import { MailboxImportSection } from 'src/front-components/settings/mailbox-import-section';
import { useTheme } from 'src/insights/ui';

// Custom tab on Apps > Pulse GTM: bulk mailbox import and the AI model picker.
const PulseSettings = () => {
  const theme = useTheme();
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, padding: 24, maxWidth: 760, fontFamily: 'inherit', color: theme.text }}>
      <MailboxImportSection />
      <AiModelSection />
    </div>
  );
};

export default defineSettingsFrontComponent({
  universalIdentifier: PULSE_SETTINGS_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'pulse-settings',
  description: 'Add many mailboxes from a pasted sheet, and pick the AI model for openers',
  component: PulseSettings,
});
