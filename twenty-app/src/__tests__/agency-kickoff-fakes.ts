// In-memory Records for the agency tests: tables keyed by plural name, the
// filters the agency code uses (eq, in, and), and createdAt from a settable clock.

import type { AgencyWriter } from 'src/gtm/agency/ai';
import type { Records } from 'src/gtm/agency/gql';

const PLURALS: Record<string, string> = {
  task: 'tasks',
  taskTarget: 'taskTargets',
  clientProject: 'clientProjects',
  clientInvoice: 'clientInvoices',
  clientEmail: 'clientEmails',
  person: 'people',
  opportunity: 'opportunities',
  company: 'companies',
  agencyService: 'agencyServices',
  proposal: 'proposals',
};

type Row = Record<string, any> & { id: string };

const matches = (row: Row, filter: Record<string, any>): boolean =>
  Object.entries(filter).every(([key, cond]) => {
    if (key === 'and') return (cond as Record<string, any>[]).every((f) => matches(row, f));
    if (key === 'or') return (cond as Record<string, any>[]).some((f) => matches(row, f));
    if (cond && typeof cond === 'object') {
      if ('eq' in cond) return row[key] === cond.eq;
      if ('in' in cond) return (cond.in as unknown[]).includes(row[key]);
      if ('is' in cond) return cond.is === 'NULL' ? row[key] == null : row[key] != null;
    }
    return true;
  });

export class FakeRecords implements Records {
  tables = new Map<string, Row[]>();
  updates: { singular: string; id: string; data: Record<string, unknown> }[] = [];
  now = new Date('2026-10-03T12:00:00Z');
  private seq = 0;

  table(plural: string): Row[] {
    if (!this.tables.has(plural)) this.tables.set(plural, []);
    return this.tables.get(plural)!;
  }

  seed(plural: string, row: Row) {
    this.table(plural).push({ ...row });
    return row.id;
  }

  get(plural: string, id: string) {
    return this.table(plural).find((r) => r.id === id);
  }

  async findMany<T>(plural: string, filter: Record<string, unknown>, _selection: unknown, first = 100): Promise<T[]> {
    return this.table(plural).filter((r) => matches(r, filter as Record<string, any>)).slice(0, first).map((r) => ({ ...r })) as T[];
  }

  async findOne<T>(plural: string, id: string): Promise<T | null> {
    const row = this.get(plural, id);
    return row ? ({ ...row } as T) : null;
  }

  async create(singular: string, data: Record<string, unknown>): Promise<string> {
    const id = `${singular}-${++this.seq}`;
    this.table(PLURALS[singular] ?? `${singular}s`).push({ id, createdAt: this.now.toISOString(), ...data });
    return id;
  }

  async update(singular: string, id: string, data: Record<string, unknown>): Promise<void> {
    this.updates.push({ singular, id, data });
    const row = this.get(PLURALS[singular] ?? `${singular}s`, id);
    if (row) Object.assign(row, data);
  }

  // Tasks with their targets folded in, for assertions.
  tasksWithTargets(): (Row & { targets: Record<string, any>[] })[] {
    return this.table('tasks').map((t) => ({
      ...t,
      targets: this.table('taskTargets').filter((tt) => tt.taskId === t.id).map(({ id: _id, taskId: _t, createdAt: _c, ...rest }) => rest),
    }));
  }
}

export const fakeWriter = (reply: unknown) => {
  const calls: { system: string; prompt: string }[] = [];
  const writer: AgencyWriter = {
    write: async (system, prompt) => {
      calls.push({ system, prompt });
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
  return { writer, calls };
};
