import { describe, expect, it } from 'vitest';

import { warmupTagSecret } from 'src/gtm/mailbox/credentials';
import { findTextPart, htmlToText, stripQuoted } from 'src/gtm/mailbox/imap-reader';
import {
  FIRST_SYNC_LIMIT,
  SYNC_LIMIT,
  syncMailboxInboxes,
  type InboxSyncDeps,
  type NewEmailItem,
  type RecentMessage,
  type SyncCursor,
} from 'src/gtm/mailbox/inbox-sync';
import type { MailboxRecord } from 'src/gtm/mailbox/types';
import { generateWarmupTag } from 'src/gtm/mailbox/warmup-tag';
import type { InboundEmail } from 'src/gtm/sequences/mark-reply';

const tagSecret = warmupTagSecret('inbox-sync-test-key-0123456789');
const now = new Date('2026-10-02T12:00:00Z');

const mailbox = (id: string, email: string, over: Partial<MailboxRecord> = {}) =>
  ({ id, email, status: 'WARMING', authType: 'GOOGLE_DELEGATED', provider: 'GOOGLE', ...over }) as MailboxRecord;

const msg = (uid: number, over: Partial<RecentMessage> = {}): RecentMessage => ({
  uid,
  messageId: `<m${uid}@example.com>`,
  subject: `Hello ${uid}`,
  fromEmail: `lead${uid}@acme.com`,
  fromName: null,
  receivedAt: new Date('2026-10-02T11:00:00Z'),
  seen: false,
  warmupHeader: null,
  snippet: '  Hi   there  ',
  ...over,
});

const setup = (inboxes: Record<string, RecentMessage[]>, options: { replyFrom?: string[]; failAuth?: string[] } = {}) => {
  const cursors = new Map<string, SyncCursor>();
  const items: NewEmailItem[] = [];
  const replies: InboundEmail[] = [];
  const limits: number[] = [];
  const mailboxes = [
    mailbox('a', 'a@orbix.com'),
    mailbox('b', 'b@orbix.com'),
    mailbox('p', 'p@orbix.com', { status: 'PAUSED' }),
  ];
  const deps: InboxSyncDeps = {
    listMailboxes: async () => mailboxes,
    async resolveAuth(m) {
      if (options.failAuth?.includes(m.email)) throw new Error('unauthorized_client');
      return { type: 'oauth', user: m.email, accessToken: 't' };
    },
    async openReader(m) {
      return {
        async listNew(cursor, _since, limit) {
          limits.push(limit);
          const all = inboxes[m.email] ?? [];
          const messages = all.filter((x) => !cursor || x.uid > cursor.lastUid);
          return { cursor: { uidValidity: '1', lastUid: Math.max(cursor?.lastUid ?? 0, ...all.map((x) => x.uid)) }, messages };
        },
        async close() {},
      };
    },
    getCursor: async (id) => cursors.get(id) ?? null,
    setCursor: async (id, c) => void cursors.set(id, c),
    async recordReply(email) {
      const matched = Boolean(email.fromEmail && options.replyFrom?.includes(email.fromEmail));
      if (matched) replies.push(email);
      return { matched };
    },
    hasItem: async (id) => items.some((i) => i.messageId === id) || replies.some((r) => r.messageId === id),
    createItem: async (item) => void items.push(item),
    tagSecret,
    now,
  };
  return { deps, items, replies, cursors, limits };
};

describe('inbox sync', () => {
  it('copies new mail from every mailbox and skips paused ones', async () => {
    const { deps, items } = setup({ 'a@orbix.com': [msg(1), msg(2, { seen: true })], 'b@orbix.com': [msg(3)], 'p@orbix.com': [msg(9)] });
    const summary = await syncMailboxInboxes(deps);
    expect(summary).toMatchObject({ mailboxes: 2, read: 3, emails: 3, failed: [] });
    expect(items.map((i) => [i.mailboxEmail, i.subject, i.status, i.snippet])).toEqual(
      expect.arrayContaining([
        ['a@orbix.com', 'Hello 1', 'UNREAD', 'Hi there'],
        ['a@orbix.com', 'Hello 2', 'READ', 'Hi there'],
        ['b@orbix.com', 'Hello 3', 'UNREAD', 'Hi there'],
      ]),
    );
  });

  it('skips warmup mail and mail between our own mailboxes', async () => {
    const tag = generateWarmupTag(tagSecret, 'original');
    const { deps, items } = setup({
      'a@orbix.com': [msg(1, { warmupHeader: tag }), msg(2, { fromEmail: 'B@orbix.com' }), msg(3, { warmupHeader: 'someone-elses-ref' })],
    });
    const summary = await syncMailboxInboxes(deps);
    expect(summary.skipped).toBe(2);
    expect(items.map((i) => i.subject)).toEqual(['Hello 3']);
  });

  it('routes replies from people in a sequence through markReply', async () => {
    const { deps, items, replies } = setup({ 'a@orbix.com': [msg(1), msg(2)] }, { replyFrom: ['lead2@acme.com'] });
    const summary = await syncMailboxInboxes(deps);
    expect(summary.replies).toBe(1);
    expect(replies[0]).toMatchObject({ fromEmail: 'lead2@acme.com', mailboxEmail: 'a@orbix.com', messageId: '<m2@example.com>', kind: 'REPLY' });
    expect(items.map((i) => i.fromEmail)).toEqual(['lead1@acme.com']);
  });

  it('reads only new mail on the next run and does not duplicate', async () => {
    const inboxes = { 'a@orbix.com': [msg(1)] };
    const { deps, items, limits } = setup(inboxes);
    await syncMailboxInboxes(deps);
    inboxes['a@orbix.com'].push(msg(2));
    await syncMailboxInboxes(deps);
    expect(items.map((i) => i.subject)).toEqual(['Hello 1', 'Hello 2']);
    expect(limits).toEqual([FIRST_SYNC_LIMIT, FIRST_SYNC_LIMIT, SYNC_LIMIT, SYNC_LIMIT]);
  });

  it('keeps going when one mailbox cannot sign in, and keeps its cursor', async () => {
    const { deps, items, cursors } = setup({ 'a@orbix.com': [msg(1)], 'b@orbix.com': [msg(2)] }, { failAuth: ['a@orbix.com'] });
    const summary = await syncMailboxInboxes(deps);
    expect(summary.failed).toEqual([{ email: 'a@orbix.com', error: 'unauthorized_client' }]);
    expect(items).toHaveLength(1);
    expect(cursors.has('a')).toBe(false);
  });

  it('dedupes the same email delivered to two mailboxes', async () => {
    const { deps, items } = setup({ 'a@orbix.com': [msg(1)], 'b@orbix.com': [msg(1)] });
    await syncMailboxInboxes(deps);
    expect(items).toHaveLength(1);
  });
});

describe('inbox sync errors', () => {
  it('clears a stale inbox sign-in error after a successful sync', async () => {
    const { deps } = setup({ 'a@orbix.com': [msg(1)] }, { failAuth: ['b@orbix.com'] });
    const cleared: string[] = [];
    deps.listMailboxes = async () => [
      mailbox('a', 'a@orbix.com', { lastError: 'Inbox check failed: unauthorized_client' }),
      mailbox('b', 'b@orbix.com', { lastError: 'Inbox check failed: unauthorized_client' }),
      mailbox('c', 'c@orbix.com', { lastError: 'Sending failed: quota' }),
    ];
    deps.clearError = async (id) => void cleared.push(id);
    const summary = await syncMailboxInboxes(deps);
    expect(cleared).toEqual(['a']);
    expect(summary.failed.map((f) => f.email)).toEqual(['b@orbix.com']);
  });
});

describe('imap reader helpers', () => {
  it('prefers text/plain and skips attachments', () => {
    expect(
      findTextPart({
        type: 'multipart/mixed',
        childNodes: [
          { type: 'text/plain', part: '2', disposition: 'attachment' },
          { type: 'multipart/alternative', childNodes: [{ type: 'text/html', part: '1.2' }, { type: 'text/plain', part: '1.1' }] },
        ],
      }),
    ).toEqual({ part: '1.1', html: false });
    expect(findTextPart({ type: 'text/html' })).toEqual({ part: '1', html: true });
  });

  it('turns html into text and drops quoted history', () => {
    expect(htmlToText('<style>p{}</style><p>Hi&nbsp;Ann &amp; co</p>').replace(/\s+/g, ' ').trim()).toBe('Hi Ann & co');
    expect(stripQuoted('Sounds good\n\nOn Tue, Ann wrote:\n> earlier').trim()).toBe('Sounds good');
  });
});
