import { RestApiClient } from 'twenty-client-sdk/rest';

// Application variables (declared in app-variables.ts) reach logic functions
// as environment variables. Kept apart from runtime.ts so functions that need
// no mail transport do not bundle nodemailer/imapflow.
export const MAILBOX_ENCRYPTION_KEY_VARIABLE = 'MAILBOX_ENCRYPTION_KEY';
export const MAILBOX_WARMUP_CONFIG_VARIABLE = 'MAILBOX_WARMUP_CONFIG';

export const readEncryptionKey = (): string => {
  const key = process.env[MAILBOX_ENCRYPTION_KEY_VARIABLE];
  if (!key || key.trim().length < 16) {
    throw new Error(`${MAILBOX_ENCRYPTION_KEY_VARIABLE} is not set (min 16 characters). Set it in the app's settings.`);
  }
  return key;
};

export const createRestClient = () => new RestApiClient();
