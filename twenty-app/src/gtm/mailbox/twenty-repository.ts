import type { NewMailboxInput } from 'src/gtm/mailbox/bulk-import';
import type { MailboxRepository } from 'src/gtm/mailbox/engine';
import type { MailboxPatch, MailboxRecord, WarmupMessageRecord } from 'src/gtm/mailbox/types';

// The subset of twenty-client-sdk's RestApiClient this repository uses.
export type RestLike = {
  get<T = unknown>(path: string, options?: { query?: Record<string, string | number | boolean | null | undefined> }): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown): Promise<T>;
};

type ListResponse<K extends string, T> = {
  data: Record<K, T[]>;
  pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
};

const PAGE_SIZE = 200;
const MAX_PAGES = 50;

const quote = (value: string) => `"${value.replace(/"/g, '\\"')}"`;

// Reads every page of a REST collection.
const listAll = async <T>(
  client: RestLike,
  plural: string,
  query: Record<string, string> = {},
): Promise<T[]> => {
  const records: T[] = [];
  let cursor: string | null | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const response = await client.get<ListResponse<string, T>>(`/rest/${plural}`, {
      query: { ...query, limit: PAGE_SIZE, starting_after: cursor ?? undefined },
    });
    records.push(...(response.data?.[plural] ?? []));
    if (!response.pageInfo?.hasNextPage || !response.pageInfo.endCursor) break;
    cursor = response.pageInfo.endCursor;
  }
  return records;
};

export const createTwentyMailboxRepository = (client: RestLike): MailboxRepository => ({
  listMailboxes: () => listAll<MailboxRecord>(client, 'mailboxes'),

  async updateMailbox(id: string, patch: MailboxPatch) {
    if (Object.keys(patch).length === 0) return;
    await client.patch(`/rest/mailboxes/${id}`, patch);
  },

  async createWarmupMessage(input) {
    const response = await client.post<{ data: { createWarmupMessage: { id: string } } }>('/rest/warmupMessages', input);
    return { id: response.data.createWarmupMessage.id };
  },

  async findWarmupMessageByTag(tag: string) {
    const response = await client.get<ListResponse<'warmupMessages', WarmupMessageRecord>>('/rest/warmupMessages', {
      query: { filter: `tag[eq]:${quote(tag)}`, limit: 1 },
    });
    return response.data?.warmupMessages?.[0] ?? null;
  },

  async updateWarmupMessage(id, patch) {
    await client.patch(`/rest/warmupMessages/${id}`, patch);
  },

  listWarmupMessagesSince: (since: Date) =>
    listAll<WarmupMessageRecord>(client, 'warmupMessages', { filter: `sentAt[gte]:${quote(since.toISOString())}` }),
});

// What bulk imports need: existing mailboxes (for dedupe, and to move
// password mailboxes onto Google delegation) and record writes.
export type ExistingMailbox = Pick<MailboxRecord, 'id' | 'email' | 'provider' | 'authType' | 'status'>;

export type MailboxImportStore = {
  listMailboxes(): Promise<ExistingMailbox[]>;
  createMailbox(input: NewMailboxInput): Promise<{ id: string }>;
  updateMailbox(id: string, patch: MailboxPatch): Promise<void>;
};

export const createMailboxImportStore = (client: RestLike): MailboxImportStore => ({
  async listMailboxes() {
    const mailboxes = await listAll<ExistingMailbox>(client, 'mailboxes');
    return mailboxes.filter((mailbox) => Boolean(mailbox.email));
  },
  async createMailbox(input) {
    const response = await client.post<{ data: { createMailbox: { id: string } } }>('/rest/mailboxes', input);
    return { id: response.data.createMailbox.id };
  },
  async updateMailbox(id, patch) {
    await client.patch(`/rest/mailboxes/${id}`, patch);
  },
});
