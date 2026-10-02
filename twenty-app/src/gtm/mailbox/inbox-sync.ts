import type { MailboxAuth } from 'src/gtm/mailbox/transport';
import type { MailboxRecord } from 'src/gtm/mailbox/types';
import { verifyWarmupTag } from 'src/gtm/mailbox/warmup-tag';
import { isAutomatedSender } from 'src/gtm/sequences/inbound';
import type { InboundEmail, MarkReplyResult } from 'src/gtm/sequences/mark-reply';

// Copies new INBOX mail from every mailbox into the Inbox list, so mail to all
// mailboxes reads in one place. Replies from people in a sequence go through
// markReply (stops the sequence, lead goes HOT); everything else is stored as
// kind EMAIL. Warmup mail and mail between our own mailboxes are skipped.
// Each mailbox keeps a cursor (IMAP UIDVALIDITY + last UID seen), so a run
// only reads what arrived since the last one.

export type SyncCursor = { uidValidity: string; lastUid: number };

export type RecentMessage = {
  uid: number;
  messageId: string | null;
  subject: string;
  fromEmail: string | null;
  fromName: string | null;
  receivedAt: Date | null;
  seen: boolean;
  // Value of the warmup tag header, when present.
  warmupHeader: string | null;
  snippet: string;
};

export interface InboxReader {
  // Messages after the cursor; with no cursor (or a reset mailbox), the newest
  // since `since`. At most `limit`, oldest first.
  listNew(cursor: SyncCursor | null, since: Date, limit: number): Promise<{ cursor: SyncCursor; messages: RecentMessage[] }>;
  close(): Promise<void>;
}

export type NewEmailItem = {
  subject: string;
  snippet: string | null;
  fromEmail: string | null;
  receivedAt: string;
  mailboxEmail: string;
  messageId: string;
  status: 'UNREAD' | 'READ';
};

export type InboxSyncDeps = {
  listMailboxes(): Promise<MailboxRecord[]>;
  resolveAuth(mailbox: MailboxRecord): Promise<MailboxAuth>;
  openReader(mailbox: MailboxRecord, auth: MailboxAuth): Promise<InboxReader>;
  getCursor(mailboxId: string): Promise<SyncCursor | null>;
  setCursor(mailboxId: string, cursor: SyncCursor): Promise<void>;
  // markReply: records sequence replies; reports no match for anyone else.
  recordReply(email: InboundEmail): Promise<Pick<MarkReplyResult, 'matched'>>;
  hasItem(messageId: string): Promise<boolean>;
  createItem(item: NewEmailItem): Promise<void>;
  tagSecret: string;
  now: Date;
  log?: (message: string) => void;
};

export type InboxSyncSummary = {
  mailboxes: number;
  read: number;
  replies: number;
  emails: number;
  skipped: number;
  failed: { email: string; error: string }[];
};

export const FIRST_SYNC_DAYS = 3;
export const FIRST_SYNC_LIMIT = 25;
export const SYNC_LIMIT = 100;
export const SNIPPET_LENGTH = 280;
const CONCURRENCY = 5;

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

export const cleanSnippet = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, SNIPPET_LENGTH);

// Paused mailboxes are left alone; Error ones are still read (the error may be
// about sending only).
export const syncableMailboxes = (mailboxes: readonly MailboxRecord[]) =>
  mailboxes.filter((mailbox) => mailbox.status !== 'PAUSED');

const syncOne = async (
  deps: InboxSyncDeps,
  mailbox: MailboxRecord,
  ownAddresses: ReadonlySet<string>,
  // Message-IDs taken in this run: mailboxes sync in parallel, so the same
  // email sent to two of them must not be stored twice.
  claimed: Set<string>,
  summary: InboxSyncSummary,
) => {
  let reader: InboxReader | null = null;
  try {
    reader = await deps.openReader(mailbox, await deps.resolveAuth(mailbox));
    const cursor = await deps.getCursor(mailbox.id);
    const since = new Date(deps.now.getTime() - FIRST_SYNC_DAYS * 24 * 60 * 60 * 1000);
    const result = await reader.listNew(cursor, since, cursor ? SYNC_LIMIT : FIRST_SYNC_LIMIT);

    for (const message of result.messages) {
      summary.read++;
      const fromEmail = message.fromEmail?.trim().toLowerCase() || null;
      const isWarmup = Boolean(message.warmupHeader && verifyWarmupTag(deps.tagSecret, message.warmupHeader));
      if (isWarmup || (fromEmail && ownAddresses.has(fromEmail))) {
        summary.skipped++;
        continue;
      }
      // Message-ID is shared by every copy of an email; fall back to the UID.
      const messageId = message.messageId?.trim() || `${mailbox.email}#${result.cursor.uidValidity}:${message.uid}`;
      if (claimed.has(messageId)) {
        summary.skipped++;
        continue;
      }
      claimed.add(messageId);
      const receivedAt = (message.receivedAt ?? deps.now).toISOString();
      const snippet = cleanSnippet(message.snippet);

      if (fromEmail && !isAutomatedSender(fromEmail)) {
        const reply = await deps.recordReply({
          fromEmail,
          kind: 'REPLY',
          subject: message.subject || null,
          snippet,
          receivedAt,
          messageId,
          mailboxEmail: mailbox.email,
        });
        if (reply.matched) {
          summary.replies++;
          continue;
        }
      }

      if (await deps.hasItem(messageId)) {
        summary.skipped++;
        continue;
      }
      await deps.createItem({
        subject: message.subject.trim() || '(no subject)',
        snippet: snippet || null,
        fromEmail,
        receivedAt,
        mailboxEmail: mailbox.email,
        messageId,
        status: message.seen ? 'READ' : 'UNREAD',
      });
      summary.emails++;
    }
    // Saved last, so a failed run re-reads the same mail next time (duplicates
    // are skipped by Message-ID).
    await deps.setCursor(mailbox.id, result.cursor);
  } catch (error) {
    summary.failed.push({ email: mailbox.email, error: errorText(error) });
    deps.log?.(`inbox sync failed for ${mailbox.email}: ${errorText(error)}`);
  } finally {
    await reader?.close().catch(() => undefined);
  }
};

export const syncMailboxInboxes = async (deps: InboxSyncDeps): Promise<InboxSyncSummary> => {
  const all = await deps.listMailboxes();
  const ownAddresses = new Set(all.map((mailbox) => mailbox.email.trim().toLowerCase()));
  const mailboxes = syncableMailboxes(all);
  const summary: InboxSyncSummary = { mailboxes: mailboxes.length, read: 0, replies: 0, emails: 0, skipped: 0, failed: [] };

  const claimed = new Set<string>();
  const queue = [...mailboxes];
  const worker = async () => {
    for (let mailbox = queue.shift(); mailbox; mailbox = queue.shift()) {
      await syncOne(deps, mailbox, ownAddresses, claimed, summary);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, queue.length) }, worker));
  return summary;
};
