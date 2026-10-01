import { decryptMailboxSecret } from 'src/gtm/mailbox/credentials';
import type { MailboxAuth } from 'src/gtm/mailbox/transport';
import type { MailboxRecord } from 'src/gtm/mailbox/types';
import type { MailboxAuthType } from 'src/gtm/mailbox/values';

type AuthFields = Pick<MailboxRecord, 'email' | 'username' | 'credentialCiphertext' | 'connectionId' | 'authType'>;

// The sign-in method in effect: explicit authType, else inferred from what is set.
export const effectiveAuthType = (mailbox: AuthFields): MailboxAuthType => {
  if (mailbox.authType === 'GOOGLE_DELEGATED' || mailbox.authType === 'OAUTH_CONNECTION') return mailbox.authType;
  if (!mailbox.credentialCiphertext && mailbox.connectionId?.trim()) return 'OAUTH_CONNECTION';
  return 'PASSWORD';
};

// Works out how to log in to a mailbox: Google Workspace delegation (token
// minted per user, nothing stored), an OAuth app connection, or the sealed
// app password.
export const resolveMailboxAuth = async (
  mailbox: AuthFields,
  options: {
    encryptionKey: string | undefined;
    getAccessToken?: (connectionId: string) => Promise<string>;
    getDelegatedToken?: (email: string) => Promise<string>;
  },
): Promise<MailboxAuth> => {
  const user = mailbox.username?.trim() || mailbox.email;
  const type = effectiveAuthType(mailbox);

  if (type === 'GOOGLE_DELEGATED') {
    if (!options.getDelegatedToken) throw new Error('GOOGLE_SERVICE_ACCOUNT_JSON is not set');
    return { type: 'oauth', user: mailbox.email, accessToken: await options.getDelegatedToken(mailbox.email) };
  }

  if (type === 'OAUTH_CONNECTION') {
    if (!mailbox.connectionId?.trim()) throw new Error('No OAuth connection id set for this mailbox');
    if (!options.getAccessToken) throw new Error('OAuth connections are not available here');
    return { type: 'oauth', user, accessToken: await options.getAccessToken(mailbox.connectionId.trim()) };
  }

  if (!mailbox.credentialCiphertext) throw new Error('No credential set for this mailbox');
  if (!options.encryptionKey) throw new Error('MAILBOX_ENCRYPTION_KEY is not set');
  const { password } = decryptMailboxSecret(mailbox.credentialCiphertext, options.encryptionKey);
  return { type: 'password', user, password };
};
