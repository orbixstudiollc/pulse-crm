import { decryptMailboxSecret } from 'src/gtm/mailbox/credentials';
import type { MailboxAuth } from 'src/gtm/mailbox/transport';
import type { MailboxRecord } from 'src/gtm/mailbox/types';

// Works out how to log in to a mailbox: an OAuth app connection when one is
// linked (Google/Microsoft), otherwise the sealed app password.
export const resolveMailboxAuth = async (
  mailbox: Pick<MailboxRecord, 'email' | 'username' | 'credentialCiphertext' | 'connectionId'>,
  options: {
    encryptionKey: string | undefined;
    getAccessToken?: (connectionId: string) => Promise<string>;
  },
): Promise<MailboxAuth> => {
  const user = mailbox.username?.trim() || mailbox.email;

  if (mailbox.connectionId?.trim()) {
    if (!options.getAccessToken) throw new Error('OAuth connections are not available here');
    return { type: 'oauth', user, accessToken: await options.getAccessToken(mailbox.connectionId.trim()) };
  }

  if (!mailbox.credentialCiphertext) throw new Error('No credential set for this mailbox');
  if (!options.encryptionKey) throw new Error('MAILBOX_ENCRYPTION_KEY is not set');
  const { password } = decryptMailboxSecret(mailbox.credentialCiphertext, options.encryptionKey);
  return { type: 'password', user, password };
};
