// Thin record helpers over Twenty's workspace GraphQL API (genql-style, as in
// the sequences store), so each agency feature can describe its reads and
// writes in a few lines.

import { CoreApiClient } from 'twenty-client-sdk/core';

import type { GraphqlClient } from 'src/gtm/sequences/twenty-store';

export type Selection = Record<string, unknown>;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type Records = {
  findMany<T>(plural: string, filter: Record<string, unknown>, selection: Selection, first?: number, orderBy?: Record<string, string>[]): Promise<T[]>;
  findOne<T>(plural: string, id: string, selection: Selection): Promise<T | null>;
  create(singular: string, data: Record<string, unknown>): Promise<string>;
  update(singular: string, id: string, data: Record<string, unknown>): Promise<void>;
};

export const createRecords = (client: GraphqlClient = new CoreApiClient() as unknown as GraphqlClient): Records => ({
  async findMany(plural, filter, selection, first = 100, orderBy) {
    const res = await client.query({
      [plural]: {
        __args: { filter, first, ...(orderBy ? { orderBy } : {}) },
        edges: { node: { id: true, ...selection } },
      },
    });
    return (res?.[plural]?.edges ?? []).map((e: { node: unknown }) => e.node);
  },
  async findOne(plural, id, selection) {
    const [row] = await this.findMany<any>(plural, { id: { eq: id } }, selection, 1);
    return row ?? null;
  },
  async create(singular, data) {
    const name = `create${cap(singular)}`;
    const res = await client.mutation({ [name]: { __args: { data }, id: true } });
    return res[name].id as string;
  },
  async update(singular, id, data) {
    if (Object.keys(data).length === 0) return;
    await client.mutation({ [`update${cap(singular)}`]: { __args: { id, data }, id: true } });
  },
});

// A task for the team, linked to a person and/or another record through
// Twenty's task targets (target<Object>Id).
export const createTaskFor = async (
  records: Records,
  task: { title: string; body?: string | null; dueAt: string },
  targets: Record<string, string | null | undefined>,
): Promise<string> => {
  const base = { title: task.title.slice(0, 250), dueAt: task.dueAt, status: 'TODO' };
  let id: string;
  try {
    id = await records.create('task', task.body ? { ...base, bodyV2: { markdown: task.body } } : base);
  } catch {
    id = await records.create('task', base);
  }
  for (const [field, targetId] of Object.entries(targets)) {
    if (targetId) await records.create('taskTarget', { taskId: id, [field]: targetId }).catch(() => undefined);
  }
  return id;
};

export const randomToken = (bytes = 18): string => {
  const a = new Uint8Array(bytes);
  globalThis.crypto.getRandomValues(a);
  return Buffer.from(a).toString('base64url');
};
