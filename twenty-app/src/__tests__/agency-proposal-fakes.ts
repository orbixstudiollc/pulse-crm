// In-memory Records for the agency proposal tests (not a test file itself).
// Rows are stored as GraphQL would return them; the filter evaluator covers
// what the agency code uses: eq, neq, in, is NULL / NOT_NULL, gte, lte, and,
// or, and nested composite fields.

import type { AgencyWriter } from 'src/gtm/agency/ai';
import type { Records } from 'src/gtm/agency/gql';
import type { AgencySettings } from 'src/gtm/agency/settings';

type Row = Record<string, any> & { id: string };

const PLURALS: Record<string, string> = {
  person: 'people',
  company: 'companies',
  opportunity: 'opportunities',
  agencyService: 'agencyServices',
};
const pluralOf = (singular: string) => PLURALS[singular] ?? `${singular}s`;

const matches = (row: any, filter: Record<string, any>): boolean =>
  Object.entries(filter).every(([field, cond]) => {
    if (field === 'and') return (cond as any[]).every((f) => matches(row, f));
    if (field === 'or') return (cond as any[]).some((f) => matches(row, f));
    if (field === 'not') return !matches(row, cond);
    const value = row?.[field];
    if (cond && typeof cond === 'object' && !Object.keys(cond).some((k) => ['eq', 'neq', 'in', 'is', 'gte', 'lte', 'gt', 'lt'].includes(k))) {
      return matches(value, cond);
    }
    return Object.entries(cond as Record<string, any>).every(([op, v]) => {
      switch (op) {
        case 'eq': return value === v;
        case 'neq': return value !== v;
        case 'in': return (v as any[]).includes(value);
        case 'is': return v === 'NULL' ? value === null || value === undefined : value !== null && value !== undefined;
        case 'gte': return value !== null && value !== undefined && value >= v;
        case 'lte': return value !== null && value !== undefined && value <= v;
        case 'gt': return value !== null && value !== undefined && value > v;
        case 'lt': return value !== null && value !== undefined && value < v;
        default: throw new Error(`Fake filter does not support ${op}`);
      }
    });
  });

export class FakeRecords implements Records {
  tables: Record<string, Row[]> = {};
  updates: { singular: string; id: string; data: Record<string, unknown> }[] = [];
  private seq = 0;

  table(plural: string) {
    return (this.tables[plural] ??= []);
  }
  add(plural: string, row: Row) {
    this.table(plural).push({ ...row });
    return row.id;
  }
  get(plural: string, id: string) {
    return this.table(plural).find((r) => r.id === id) ?? null;
  }

  async findMany<T>(plural: string, filter: Record<string, unknown>, _selection: unknown, first = 100): Promise<T[]> {
    return this.table(plural).filter((r) => matches(r, filter)).slice(0, first).map((r) => structuredClone(r)) as T[];
  }
  async findOne<T>(plural: string, id: string): Promise<T | null> {
    const row = this.get(plural, id);
    return row ? (structuredClone(row) as T) : null;
  }
  async create(singular: string, data: Record<string, unknown>) {
    const id = `${singular}-${++this.seq}`;
    this.table(pluralOf(singular)).push({ ...data, id, createdAt: new Date(Date.UTC(2026, 0, 1, 0, 0, this.seq)).toISOString() });
    return id;
  }
  async update(singular: string, id: string, data: Record<string, unknown>) {
    if (!Object.keys(data).length) return;
    this.updates.push({ singular, id, data });
    const row = this.get(pluralOf(singular), id);
    if (!row) throw new Error(`No ${singular} ${id}`);
    Object.assign(row, data);
  }
}

// Returns queued replies in order and remembers what it was asked.
export class FakeWriter implements AgencyWriter {
  calls: { system: string; prompt: string }[] = [];
  constructor(public replies: unknown[] = []) {}
  async write(system: string, prompt: string) {
    this.calls.push({ system, prompt });
    return this.replies.length > 1 ? this.replies.shift() : this.replies[0];
  }
}

export const settingsFor = (over: Partial<AgencySettings> = {}): AgencySettings => ({
  clientEmailFrom: 'hello@orbix.studio',
  autoSend: false,
  intakeFormUrl: null,
  bookingLink: null,
  stripeSecretKey: null,
  invoiceDueDays: 7,
  depositPercent: 50,
  currency: 'USD',
  publicPagesUrl: 'https://fn.example.com/s',
  ...over,
});
