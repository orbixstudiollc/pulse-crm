import { RestApiClient } from 'twenty-client-sdk/rest';

import {
  createDelegatedTokenSource,
  parseServiceAccountKey,
  sharedTokenCache,
  type DelegatedTokenSource,
} from 'src/gtm/mailbox/google-delegation';

// Application variables (declared in app-variables.ts) reach logic functions
// as environment variables. Kept apart from runtime.ts so functions that need
// no mail transport do not bundle nodemailer/imapflow.
export const MAILBOX_ENCRYPTION_KEY_VARIABLE = 'MAILBOX_ENCRYPTION_KEY';
export const MAILBOX_WARMUP_CONFIG_VARIABLE = 'MAILBOX_WARMUP_CONFIG';
export const GOOGLE_SERVICE_ACCOUNT_JSON_VARIABLE = 'GOOGLE_SERVICE_ACCOUNT_JSON';
export const GOOGLE_WORKSPACE_ADMIN_EMAIL_VARIABLE = 'GOOGLE_WORKSPACE_ADMIN_EMAIL';

// Token source for Google Workspace delegation, or null when no key is set.
export const readDelegatedTokenSource = (): DelegatedTokenSource | null => {
  const raw = process.env[GOOGLE_SERVICE_ACCOUNT_JSON_VARIABLE];
  if (!raw || !raw.trim()) return null;
  return createDelegatedTokenSource(parseServiceAccountKey(raw), { cache: sharedTokenCache });
};

export const readWorkspaceAdminEmail = (): string => {
  const admin = process.env[GOOGLE_WORKSPACE_ADMIN_EMAIL_VARIABLE]?.trim();
  if (!admin) throw new Error(`${GOOGLE_WORKSPACE_ADMIN_EMAIL_VARIABLE} is not set`);
  return admin;
};

export const readEncryptionKey = (): string => {
  const key = process.env[MAILBOX_ENCRYPTION_KEY_VARIABLE];
  if (!key || key.trim().length < 16) {
    throw new Error(`${MAILBOX_ENCRYPTION_KEY_VARIABLE} is not set (min 16 characters). Set it in the app's settings.`);
  }
  return key;
};

export const createRestClient = () => new RestApiClient();
