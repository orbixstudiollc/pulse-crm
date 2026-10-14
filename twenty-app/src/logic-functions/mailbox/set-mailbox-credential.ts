import { defineLogicFunction, type RoutePayload } from 'twenty-sdk/define';
import { Response } from 'twenty-sdk/logic-function';

import { MAILBOX_FN_SET_CREDENTIAL_UID } from 'src/constants/mailbox-ids';
import { encryptMailboxSecret } from 'src/gtm/mailbox/credentials';
import { createRestClient, readEncryptionKey } from 'src/gtm/mailbox/env';

type Body = { mailboxId?: string; password?: string };

// POST /s/mailbox-credential  {"mailboxId": "...", "password": "<app password>"}
// with a workspace API key. Seals the password with MAILBOX_ENCRYPTION_KEY and
// stores only the ciphertext on the mailbox, so the plain password never sits
// in a record field. Clears a previous error so warmup picks the mailbox up again.
export default defineLogicFunction({
  universalIdentifier: MAILBOX_FN_SET_CREDENTIAL_UID,
  name: 'set-mailbox-credential',
  description: 'Encrypts and stores a mailbox SMTP/IMAP app password',
  timeoutSeconds: 30,
  httpRouteTriggerSettings: { path: '/mailbox-credential', httpMethod: 'POST', isAuthRequired: true },
  handler: async (event: RoutePayload<Body>) => {
    const mailboxId = event.body?.mailboxId?.trim();
    const password = event.body?.password;
    if (!mailboxId || !password) {
      return new Response({ error: 'mailboxId and password are required' }, { status: 400 });
    }

    const sealed = encryptMailboxSecret({ password }, readEncryptionKey());
    const client = createRestClient();
    const current = await client.get<{ data: { mailbox: { id: string; status: string | null } | null } }>(
      `/rest/mailboxes/${encodeURIComponent(mailboxId)}`,
    );
    if (!current.data?.mailbox) return new Response({ error: 'Mailbox not found' }, { status: 404 });

    await client.patch(`/rest/mailboxes/${encodeURIComponent(mailboxId)}`, {
      credentialCiphertext: sealed,
      lastError: null,
      ...(current.data.mailbox.status === 'ERROR' ? { status: 'WARMING' } : {}),
    });

    return { ok: true, mailboxId };
  },
});
