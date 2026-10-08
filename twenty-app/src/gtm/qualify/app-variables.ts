import { FieldType, type ApplicationConfig } from 'twenty-sdk/define';

import {
  FIRECRAWL_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
  JEV_MODEL_VARIABLE_UNIVERSAL_IDENTIFIER,
  OPENROUTER_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
  QUALIFY_DAILY_VERIFICATIONS_VARIABLE_UNIVERSAL_IDENTIFIER,
  QUALIFY_REVIEW_MODEL_VARIABLE_UNIVERSAL_IDENTIFIER,
  QUALIFY_THRESHOLD_VARIABLE_UNIVERSAL_IDENTIFIER,
} from 'src/constants/qualify-ids';
import { JEV_DEFAULT_MODEL } from 'src/gtm/qualify/jev';

// Per-workspace variables for lead qualification. Spread into application-config.ts.
export const QUALIFY_APPLICATION_VARIABLES: NonNullable<ApplicationConfig['applicationVariables']> = {
  FIRECRAWL_API_KEY: {
    universalIdentifier: FIRECRAWL_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'Firecrawl API key',
    description: 'Reads company websites for lead qualification (fc-...). Without it the site is fetched directly, which misses script-only sites.',
    isSecret: true,
    isRequired: false,
  },
  OPENROUTER_API_KEY: {
    universalIdentifier: OPENROUTER_API_KEY_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'OpenRouter API key',
    description: 'Turns on Jev (OpenRouter Decisions API) as the low-cost bulk classifier for companies and titles. Without it the AI provider classifies everything.',
    isSecret: true,
    isRequired: false,
  },
  JEV_MODEL: {
    universalIdentifier: JEV_MODEL_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'Jev model',
    description: `Optional. Defaults to ${JEV_DEFAULT_MODEL}.`,
    type: FieldType.TEXT,
    isRequired: false,
  },
  QUALIFY_REVIEW_MODEL: {
    universalIdentifier: QUALIFY_REVIEW_MODEL_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'Qualification review model',
    description:
      'Optional model id on your AI provider that takes a second look at borderline companies and titles (50-85%). With Jev on, defaults to the AI model; without Jev, only used when set.',
    type: FieldType.TEXT,
    isRequired: false,
  },
  QUALIFY_THRESHOLD: {
    universalIdentifier: QUALIFY_THRESHOLD_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'Qualification threshold',
    description: 'Optional. Confidence a company and a title each need to qualify, 0.5-1. Default 0.85.',
    type: FieldType.TEXT,
    isRequired: false,
  },
  QUALIFY_DAILY_VERIFICATIONS: {
    universalIdentifier: QUALIFY_DAILY_VERIFICATIONS_VARIABLE_UNIVERSAL_IDENTIFIER,
    label: 'Daily email checks',
    description: 'Optional. Most Prospeo email look-ups per day for leads that pass every other gate (about 1 credit each when found). Default 300.',
    type: FieldType.TEXT,
    isRequired: false,
  },
};

export const readDailyVerifications = (raw: string | undefined): number => {
  const n = Number(raw?.trim());
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 300;
};
