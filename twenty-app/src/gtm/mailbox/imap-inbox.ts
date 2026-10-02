import { ImapFlow } from 'imapflow';

import type { ServerSettings } from 'src/gtm/mailbox/server-settings';
import type { InboxFolder, InboxMessage, MailboxAuth, WarmupInbox } from 'src/gtm/mailbox/transport';
import { WARMUP_TAG_HEADER } from 'src/gtm/mailbox/warmup-tag';

const MAX_MESSAGES_PER_FOLDER = 200;

// Parses "Name: value" header lines (with folded continuation lines).
export const parseHeaderBlock = (raw: string): Record<string, string> => {
  const headers: Record<string, string> = {};
  const unfolded = raw.replace(/\r?\n[ \t]+/g, ' ');
  for (const line of unfolded.split(/\r?\n/)) {
    const index = line.indexOf(':');
    if (index <= 0) continue;
    headers[line.slice(0, index).trim().toLowerCase()] = line.slice(index + 1).trim();
  }
  return headers;
};

// WarmupInbox over IMAP with imapflow. Looks in INBOX and the folder the
// server marks as \Junk (Gmail "[Gmail]/Spam", Outlook "Junk Email").
export const openImapInbox = async (settings: ServerSettings['imap'], auth: MailboxAuth): Promise<WarmupInbox> => {
  const client = new ImapFlow({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    logger: false,
    auth: auth.type === 'oauth' ? { user: auth.user, accessToken: auth.accessToken } : { user: auth.user, pass: auth.password },
  });
  await client.connect();

  const folders = await client.list();
  const junk = folders.find((folder) => folder.specialUse === '\\Junk');
  const paths: Record<InboxFolder, string | null> = { INBOX: 'INBOX', SPAM: junk?.path ?? null };
  const isGmail = client.capabilities.has('X-GM-EXT-1');

  const withFolder = async <T>(folder: InboxFolder, run: () => Promise<T>): Promise<T | null> => {
    const path = paths[folder];
    if (!path) return null;
    const lock = await client.getMailboxLock(path);
    try {
      return await run();
    } finally {
      lock.release();
    }
  };

  return {
    async findTagged(tagPrefix, since) {
      const found: InboxMessage[] = [];
      for (const folder of ['INBOX', 'SPAM'] as const) {
        await withFolder(folder, async () => {
          const uids = await client.search(
            {
              seen: false,
              since,
              or: [{ header: { [WARMUP_TAG_HEADER.toLowerCase()]: tagPrefix } }, { body: tagPrefix }],
            },
            { uid: true },
          );
          if (!uids || uids.length === 0) return;
          const range = uids.slice(-MAX_MESSAGES_PER_FOLDER);
          for await (const message of client.fetch(
            range,
            { uid: true, envelope: true, headers: [WARMUP_TAG_HEADER.toLowerCase(), 'message-id'], bodyParts: ['TEXT'] },
            { uid: true },
          )) {
            const headers = parseHeaderBlock(message.headers?.toString('utf8') ?? '');
            found.push({
              uid: message.uid,
              folder,
              messageId: message.envelope?.messageId ?? headers['message-id'] ?? null,
              subject: message.envelope?.subject ?? '',
              fromEmail: message.envelope?.from?.[0]?.address ?? null,
              headers,
              text: message.bodyParts?.get('text')?.toString('utf8') ?? message.bodyParts?.get('TEXT')?.toString('utf8') ?? '',
            });
          }
        });
      }
      return found;
    },

    async markReadAndImportant(message) {
      await withFolder(message.folder, async () => {
        await client.messageFlagsAdd(String(message.uid), ['\\Seen', '\\Flagged'], { uid: true });
        if (isGmail) {
          await client.messageFlagsAdd(String(message.uid), ['\\Important'], { uid: true, useLabels: true });
        }
      });
    },

    async rescue(message) {
      if (message.folder !== 'SPAM') return;
      await withFolder('SPAM', async () => {
        await client.messageMove(String(message.uid), 'INBOX', { uid: true });
      });
    },

    async close() {
      await client.logout();
    },
  };
};
