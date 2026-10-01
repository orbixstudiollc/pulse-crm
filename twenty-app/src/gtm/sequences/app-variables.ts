import { FieldType, type ApplicationConfig } from 'twenty-sdk/define';

import {
  ANTHROPIC_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
  PUBLIC_TWENTY_URL_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/sequences-ids';

// Per-workspace application variables for sequences. Spread into
// application-config.ts; logic functions read them from process.env.
export const SEQUENCES_APPLICATION_VARIABLES: NonNullable<ApplicationConfig['applicationVariables']> = {
  ANTHROPIC_API_KEY: {
    universalIdentifier: ANTHROPIC_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'Anthropic API key',
    description:
      "Optional. generate-openers then writes openers with Claude (claude-sonnet-5-5) through the Anthropic API. Without it, Twenty's built-in AI is used.",
    isSecret: true,
    isRequired: false,
  },
  PUBLIC_TWENTY_URL: {
    universalIdentifier: PUBLIC_TWENTY_URL_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'Public Twenty URL',
    description:
      'Optional, e.g. https://crm.example.com. Turns on open tracking for sequence emails (a pixel pointing at <url>/s/sequences/open).',
    type: FieldType.TEXT,
    isRequired: false,
  },
};

export const openTrackingUrlFrom = (publicUrl: string | undefined): string | null => {
  const base = publicUrl?.trim().replace(/\/+$/, '');
  if (!base || !/^https?:\/\//i.test(base)) return null;
  return `${base}/s/sequences/open`;
};
