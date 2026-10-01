import { FieldType, type ApplicationConfig } from 'twenty-sdk/define';

import {
  MAILBOX_VAR_ENCRYPTION_KEY_UID,
  MAILBOX_VAR_GOOGLE_ADMIN_EMAIL_UID,
  MAILBOX_VAR_GOOGLE_SERVICE_ACCOUNT_UID,
  MAILBOX_VAR_WARMUP_CONFIG_UID,
} from 'src/constants/mailbox-ids';

// Per-workspace application variables for mailboxes and warmup. Spread into
// application-config.ts. Logic functions read them from process.env.
export const MAILBOX_APPLICATION_VARIABLES: NonNullable<ApplicationConfig['applicationVariables']> = {
  MAILBOX_ENCRYPTION_KEY: {
    universalIdentifier: MAILBOX_VAR_ENCRYPTION_KEY_UID,
    label: 'Mailbox encryption key',
    description:
      'Secret used to encrypt mailbox app passwords (AES-256-GCM) and sign warmup tags. Use 32+ random bytes, e.g. `openssl rand -base64 32`. Changing it makes stored passwords unreadable: set them again afterwards.',
    isSecret: true,
    isRequired: false,
  },
  MAILBOX_WARMUP_CONFIG: {
    universalIdentifier: MAILBOX_VAR_WARMUP_CONFIG_UID,
    label: 'Warmup settings (JSON)',
    description:
      'Optional overrides for the warmup ramp, e.g. {"startVolume":2,"maxVolume":40,"rampDays":24,"replyRate":0.35}. See src/gtm/mailbox/config.ts for every key.',
    type: FieldType.RAW_JSON,
    isRequired: false,
  },
  GOOGLE_SERVICE_ACCOUNT_JSON: {
    universalIdentifier: MAILBOX_VAR_GOOGLE_SERVICE_ACCOUNT_UID,
    label: 'Google service account key (JSON)',
    description:
      'Optional. The JSON key of a Google Cloud service account with domain-wide delegation, for Google Workspace mailboxes without passwords. Paste the whole downloaded key file. See src/gtm/mailbox/README.md.',
    type: FieldType.TEXT,
    isSecret: true,
    isRequired: false,
  },
  GOOGLE_WORKSPACE_ADMIN_EMAIL: {
    universalIdentifier: MAILBOX_VAR_GOOGLE_ADMIN_EMAIL_UID,
    label: 'Google Workspace admin email',
    description: 'Optional. A Workspace admin the service account acts as to list users when importing mailboxes.',
    type: FieldType.TEXT,
    isRequired: false,
  },
};
