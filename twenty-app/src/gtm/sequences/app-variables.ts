import { FieldType, type ApplicationConfig } from 'twenty-sdk/define';

import {
  AI_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
  AI_BASE_URL_VARIABLE_UNIVERSAL_IDENTIFIER,
  AI_MODEL_VARIABLE_UNIVERSAL_IDENTIFIER,
  AI_PROVIDER_VARIABLE_UNIVERSAL_IDENTIFIER,
  PUBLIC_TWENTY_URL_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/sequences-ids';

// Per-workspace application variables for sequences. Spread into
// application-config.ts; logic functions read them from process.env.
export const SEQUENCES_APPLICATION_VARIABLES: NonNullable<ApplicationConfig['applicationVariables']> = {
  AI_PROVIDER: {
    universalIdentifier: AI_PROVIDER_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'AI provider',
    description:
      "Optional. One of: twenty (default, uses Settings > AI), anthropic, openai, or openai-compatible (OpenRouter, Groq, Together, Mistral, Gemini, a local Ollama, ...). Used to write personalised openers.",
    type: FieldType.TEXT,
    isRequired: false,
  },
  AI_MODEL: {
    universalIdentifier: AI_MODEL_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'AI model',
    description:
      'Optional model id for the provider, e.g. claude-sonnet-5-5, gpt-4.1, openai/gpt-4.1 on OpenRouter, llama3.1 on Ollama.',
    type: FieldType.TEXT,
    isRequired: false,
  },
  AI_API_KEY: {
    universalIdentifier: AI_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'AI API key',
    description: 'API key for the AI provider. Not needed for twenty or a local model without auth.',
    isSecret: true,
    isRequired: false,
  },
  AI_BASE_URL: {
    universalIdentifier: AI_BASE_URL_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'AI base URL',
    description:
      'For openai-compatible (or a relay in front of anthropic), e.g. https://api.llmsrelay.com/v1, https://openrouter.ai/api/v1 or http://localhost:11434/v1.',
    type: FieldType.TEXT,
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
