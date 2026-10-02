import { ImapFlow, type MessageStructureObject } from 'imapflow';
import type { Readable } from 'stream';

import type { InboxReader, RecentMessage, SyncCursor } from 'src/gtm/mailbox/inbox-sync';
import { parseHeaderBlock } from 'src/gtm/mailbox/imap-inbox';
import type { ServerSettings } from 'src/gtm/mailbox/server-settings';
import type { MailboxAuth } from 'src/gtm/mailbox/transport';
import { WARMUP_TAG_HEADER } from 'src/gtm/mailbox/warmup-tag';

const SNIPPET_BYTES = 4000;

// First text/plain part, else the first text/html part (snippet source).
export const findTextPart = (node: MessageStructureObject | undefined): { part: string; html: boolean } | null => {
  if (!node) return null;
  const walk = (current: MessageStructureObject, wanted: string): string | null => {
    if (current.disposition === 'attachment') return null;
    if (current.type === wanted) return current.part ?? '1';
    for (const child of current.childNodes ?? []) {
      const found = walk(child, wanted);
      if (found) return found;
    }
    return null;
  };
  const plain = walk(node, 'text/plain');
  if (plain) return { part: plain, html: false };
  const html = walk(node, 'text/html');
  return html ? { part: html, html: true } : null;
};

export const htmlToText = (html: string) =>
  html
    .replace(/<(style|script)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"');

// Drops quoted history ("> ..." lines and everything after "On ... wrote:").
export const stripQuoted = (text: string) => {
  const cut = text.search(/\n\s*On .{0,200}wrote:\s*\n|\n-{2,}\s*Original Message/i);
  return (cut >= 0 ? text.slice(0, cut) : text)
    .split(/\r?\n/)
    .filter((line) => !line.trimStart().startsWith('>'))
    .join('\n');
};

const readStream = async (stream: Readable) => {
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(Buffer.from(chunk));
  return Buffer.concat(chunks).toString('utf8');
};

// Reads new INBOX mail over IMAP (imapflow), for the inbox sync.
export const openImapReader = async (settings: ServerSettings['imap'], auth: MailboxAuth): Promise<InboxReader> => {
  const client = new ImapFlow({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    logger: false,
    auth: auth.type === 'oauth' ? { user: auth.user, accessToken: auth.accessToken } : { user: auth.user, pass: auth.password },
  });
  await client.connect();

  return {
    async listNew(cursor, since, limit) {
      const lock = await client.getMailboxLock('INBOX', { readOnly: true });
      try {
        const box = client.mailbox;
        if (!box) throw new Error('INBOX could not be opened');
        const uidValidity = String(box.uidValidity);
        const resume = cursor && cursor.uidValidity === uidValidity ? cursor : null;

        const found = resume
          ? await client.search({ uid: `${resume.lastUid + 1}:*` }, { uid: true })
          : await client.search({ since }, { uid: true });
        // "N:*" always matches the newest message, even when it is older than N.
        const uids = (found || []).filter((uid) => !resume || uid > resume.lastUid).sort((a, b) => a - b).slice(-limit);
        const lastUid = Math.max(resume?.lastUid ?? 0, box.uidNext - 1, ...uids);
        const next: SyncCursor = { uidValidity, lastUid };
        if (uids.length === 0) return { cursor: next, messages: [] };

        const fetched: (RecentMessage & { textPart: { part: string; html: boolean } | null })[] = [];
        for await (const message of client.fetch(
          uids,
          { uid: true, envelope: true, flags: true, internalDate: true, bodyStructure: true, headers: [WARMUP_TAG_HEADER.toLowerCase()] },
          { uid: true },
        )) {
          const headers = parseHeaderBlock(message.headers?.toString('utf8') ?? '');
          const from = message.envelope?.from?.[0];
          const date = message.internalDate ?? message.envelope?.date;
          fetched.push({
            uid: message.uid,
            messageId: message.envelope?.messageId ?? null,
            subject: message.envelope?.subject ?? '',
            fromEmail: from?.address ?? null,
            fromName: from?.name ?? null,
            receivedAt: date ? new Date(date) : null,
            seen: message.flags?.has('\\Seen') ?? false,
            warmupHeader: headers[WARMUP_TAG_HEADER.toLowerCase()] ?? null,
            snippet: '',
            textPart: findTextPart(message.bodyStructure),
          });
        }

        // Downloads run after the fetch loop: imapflow cannot nest commands.
        const messages: RecentMessage[] = [];
        for (const { textPart, ...message } of fetched.sort((a, b) => a.uid - b.uid)) {
          if (textPart) {
            try {
              const download = await client.download(String(message.uid), textPart.part, { uid: true, maxBytes: SNIPPET_BYTES });
              if (download.content) {
                const raw = await readStream(download.content);
                message.snippet = stripQuoted(textPart.html ? htmlToText(raw) : raw);
              }
            } catch {
              // A missing preview is not worth failing the mailbox over.
            }
          }
          messages.push(message);
        }
        return { cursor: next, messages };
      } finally {
        lock.release();
      }
    },

    async close() {
      await client.logout();
    },
  };
};
