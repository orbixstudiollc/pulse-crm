// In-memory Records and AI writer for the agency update / renewal tests (not a
// test file itself). Understands the filter subset the agency logic uses:
// and/or, eq, neq, in, gt/gte/lt/lte and is NULL / NOT_NULL, plus orderBy.
import type { AgencyWriter } from 'src/gtm/agency/ai';
import type { Records } from 'src/gtm/agency/gql';
import type { AgencySettings } from 'src/gtm/agency/settings';

type Row = Record<string, any> & { id: string };

const matches = (row: Row, filter: Record<string, any>): boolean =>
  Object.entries(filter).every(([key, cond]) => {
    if (key === 'and') return (cond as Record<string, any>[]).every((f) => matches(row, f));
    if (key === 'or') return (cond as Record<string, any>[]).some((f) => matches(row, f));
    const v = row[key] ?? null;
    return Object.entries(cond as Record<string, any>).every(([op, x]) => {
      switch (op) {
        case 'eq':
          return v === x;
        case 'neq':
          return v !== x;
        case 'in':
          return (x as unknown[]).includes(v);
        case 'gt':
          return v !== null && v > x;
        case 'gte':
          return v !== null && v >= x;
        case 'lt':
          return v !== null && v < x;
        case 'lte':
          return v !== null && v <= x;
        case 'is':
          return x === 'NULL' ? v === null : v !== null;
        default:
          throw new Error(`Unsupported filter op ${op}`);
      }
    });
  });

export class FakeRecords implements Records {
  tables: Record<string, Row[]> = {};
  updates: { singular: string; id: string; data: Record<string, unknown> }[] = [];
  private seq = 0;

  constructor(private now: Date = new Date()) {}

  table(plural: string) {
    return (this.tables[plural] ??= []);
  }
  add(plural: string, row: Partial<Row>): string {
    const id = row.id ?? `${plural}-${++this.seq}`;
    this.table(plural).push({ createdAt: this.now.toISOString(), ...row, id });
    return id;
  }
  rows(plural: string, filter: Record<string, any> = {}) {
    return this.table(plural).filter((r) => matches(r, filter));
  }

  async findMany<T>(plural: string, filter: Record<string, unknown>, _selection: unknown, first = 100, orderBy?: Record<string, string>[]) {
    let rows = this.rows(plural, filter);
    for (const order of [...(orderBy ?? [])].reverse()) {
      const [[field, dir]] = Object.entries(order);
      const desc = dir.startsWith('Desc');
      rows = [...rows].sort((a, b) => {
        const x = a[field] ?? null;
        const y = b[field] ?? null;
        if (x === y) return 0;
        if (x === null) return 1;
        if (y === null) return -1;
        return (x < y ? -1 : 1) * (desc ? -1 : 1);
      });
    }
    return rows.slice(0, first).map((r) => ({ ...r })) as T[];
  }
  async findOne<T>(plural: string, id: string, selection: unknown) {
    const [row] = await this.findMany<T>(plural, { id: { eq: id } }, selection, 1);
    return row ?? null;
  }
  async create(singular: string, data: Record<string, unknown>) {
    return this.add(`${singular}s`, data as Partial<Row>);
  }
  async update(singular: string, id: string, data: Record<string, unknown>) {
    if (Object.keys(data).length === 0) return;
    this.updates.push({ singular, id, data });
    const row = this.table(`${singular}s`).find((r) => r.id === id);
    if (row) Object.assign(row, data);
  }
}

export class FakeWriter implements AgencyWriter {
  calls: { system: string; prompt: string }[] = [];
  constructor(private reply: unknown = { subject: 'Hello', body: 'Body text' }) {}
  async write(system: string, prompt: string) {
    this.calls.push({ system, prompt });
    return this.reply;
  }
  // The JSON inside <data> of the n-th call.
  data(n = 0): Record<string, any> {
    const m = this.calls[n]?.prompt.match(/<data>\n([\s\S]*)\n<\/data>/);
    return m ? JSON.parse(m[1]) : {};
  }
}

export const testSettings = (over: Partial<AgencySettings> = {}): AgencySettings => ({
  clientEmailFrom: 'team@agency.test',
  autoSend: false,
  intakeFormUrl: null,
  bookingLink: null,
  stripeSecretKey: null,
  invoiceDueDays: 7,
  depositPercent: 50,
  currency: 'USD',
  publicPagesUrl: null,
  ...over,
});

export const DAY_MS = 24 * 60 * 60 * 1000;
export const daysAgo = (now: Date, days: number) => new Date(now.getTime() - days * DAY_MS).toISOString();

// A client contact with an email and a company.
export const seedContact = (db: FakeRecords, id = 'person-1') => {
  db.add('companies', { id: 'company-1', name: 'Acme' });
  db.add('people', { id, name: { firstName: 'Ana', lastName: 'Lee' }, emails: { primaryEmail: 'Ana@Acme.test' } });
  return id;
};
