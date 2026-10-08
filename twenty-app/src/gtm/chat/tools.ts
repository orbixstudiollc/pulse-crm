// The Pulse chat's tools: read and write CRM records over Twenty's REST API,
// plus the Pulse lead actions (fresh ICP, Prospeo search, qualification,
// enrollment). No delete tool and no email sending, on purpose.

import type { ToolSpec } from 'src/gtm/chat/model';

export type Rest = {
  get<T = unknown>(path: string, options?: { query?: Record<string, string | number | boolean | undefined> }): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
  patch<T = unknown>(path: string, body?: unknown): Promise<T>;
};

export type PulseActions = {
  startIcp(input: Record<string, unknown>): Promise<unknown>;
  findLeads(input: Record<string, unknown>): Promise<unknown>;
  qualifyLeads(): Promise<unknown>;
  qualificationStatus(): Promise<unknown>;
  enrollQualified(input: Record<string, unknown>): Promise<unknown>;
};

export type ChatTool = ToolSpec & { run(args: Record<string, unknown>): Promise<unknown> };

const OBJECT = /^[a-zA-Z][a-zA-Z0-9]{0,62}$/;
const ID = /^[0-9a-fA-F-]{36}$/;

const objectName = (v: unknown): string => {
  const s = String(v ?? '').trim();
  if (!OBJECT.test(s)) throw new Error(`"${s}" is not an object name. Use the plural API name, e.g. people, companies, opportunities.`);
  return s;
};

const recordId = (v: unknown): string => {
  const s = String(v ?? '').trim();
  if (!ID.test(s)) throw new Error(`"${s}" is not a record id.`);
  return s;
};

const plainObject = (v: unknown, what: string): Record<string, unknown> => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error(`${what} must be an object of field values.`);
  return v as Record<string, unknown>;
};

const unwrap = (json: unknown): unknown => {
  const data = (json as { data?: Record<string, unknown> } | null)?.data;
  if (!data || typeof data !== 'object') return json;
  const values = Object.values(data);
  return values.length === 1 ? values[0] : data;
};

// Object list and fields, from the metadata API. Tolerates both REST shapes.
const metadataObjects = async (rest: Rest) => {
  const json = await rest.get<unknown>('/rest/metadata/objects', { query: { limit: 200 } });
  const found = unwrap(json);
  const list = Array.isArray(found) ? found : Array.isArray((found as { objects?: unknown })?.objects) ? (found as { objects: unknown[] }).objects : [];
  return list as { nameSingular?: string; namePlural?: string; labelPlural?: string; isActive?: boolean; isSystem?: boolean; fields?: unknown[] }[];
};

const stringList = (description: string) => ({ type: 'array', items: { type: 'string' }, description });

export const chatTools = (rest: Rest, actions: PulseActions): ChatTool[] => [
  {
    name: 'list_objects',
    description: 'List the CRM objects in this workspace with their API names (plural names are used in the other record tools).',
    parameters: { type: 'object', properties: {} },
    run: async () =>
      (await metadataObjects(rest))
        .filter((o) => o.isActive !== false && !o.isSystem)
        .map((o) => ({ name: o.namePlural, singular: o.nameSingular, label: o.labelPlural })),
  },
  {
    name: 'describe_object',
    description: 'Fields of one object (name, type and select options), to know what to filter on or write.',
    parameters: { type: 'object', properties: { object: { type: 'string', description: 'Plural API name, e.g. people' } }, required: ['object'] },
    run: async (args) => {
      const name = objectName(args.object);
      const object = (await metadataObjects(rest)).find((o) => o.namePlural === name || o.nameSingular === name);
      if (!object) throw new Error(`No object named ${name}. Call list_objects.`);
      return (object.fields ?? [])
        .map((f) => f as { name?: string; type?: string; label?: string; isActive?: boolean; isSystem?: boolean; options?: { value?: string }[] })
        .filter((f) => f.isActive !== false && !f.isSystem)
        .map((f) => ({ name: f.name, type: f.type, label: f.label, ...(f.options?.length ? { options: f.options.map((o) => o.value) } : {}) }));
    },
  },
  {
    name: 'search_records',
    description:
      'Find records of an object. filter uses Twenty REST syntax: field[op]:value with ops eq, neq, in, like, ilike, gt, gte, lt, lte, is; nested fields with a dot; combine with and(...), or(...). Examples: leadStatus[eq]:HOT · name.firstName[ilike]:"%ann%" · emails.primaryEmail[eq]:"ann@x.com" · and(icpGrade[in]:[A,B],leadScore[gte]:80). order_by: field[AscNullsFirst|DescNullsLast].',
    parameters: {
      type: 'object',
      properties: {
        object: { type: 'string', description: 'Plural API name: people, companies, opportunities, tasks, notes, icpProfiles, sequences, sequenceEnrollments, campaigns...' },
        filter: { type: 'string' },
        orderBy: { type: 'string' },
        limit: { type: 'integer', minimum: 1, maximum: 60, description: 'Default 20' },
      },
      required: ['object'],
    },
    run: async (args) => {
      const object = objectName(args.object);
      const limit = Math.min(60, Math.max(1, Number(args.limit) || 20));
      const json = await rest.get<{ data?: Record<string, unknown[]>; totalCount?: number; pageInfo?: unknown }>(`/rest/${object}`, {
        query: {
          limit,
          filter: typeof args.filter === 'string' && args.filter.trim() ? args.filter.trim() : undefined,
          order_by: typeof args.orderBy === 'string' && args.orderBy.trim() ? args.orderBy.trim() : undefined,
        },
      });
      const records = (json?.data?.[object] ?? unwrap(json)) as unknown;
      return { records, totalCount: (json as { totalCount?: number })?.totalCount ?? null };
    },
  },
  {
    name: 'get_record',
    description: 'One record by id, with its related records one level deep.',
    parameters: { type: 'object', properties: { object: { type: 'string' }, id: { type: 'string' } }, required: ['object', 'id'] },
    run: async (args) => unwrap(await rest.get(`/rest/${objectName(args.object)}/${recordId(args.id)}`, { query: { depth: 1 } })),
  },
  {
    name: 'create_record',
    description: 'Create a record. data holds field values, e.g. people: {name:{firstName,lastName}, emails:{primaryEmail}, jobTitle, companyId}. Call describe_object first if unsure of field names.',
    parameters: { type: 'object', properties: { object: { type: 'string' }, data: { type: 'object' } }, required: ['object', 'data'] },
    run: async (args) => unwrap(await rest.post(`/rest/${objectName(args.object)}`, plainObject(args.data, 'data'))),
  },
  {
    name: 'update_record',
    description: 'Change fields on one record. Only the fields in data change.',
    parameters: { type: 'object', properties: { object: { type: 'string' }, id: { type: 'string' }, data: { type: 'object' } }, required: ['object', 'id', 'data'] },
    run: async (args) => unwrap(await rest.patch(`/rest/${objectName(args.object)}/${recordId(args.id)}`, plainObject(args.data, 'data'))),
  },
  {
    name: 'start_icp',
    description: 'Create a fresh ICP from the user\'s answers and make it the only active one (all other ICPs are turned off). Only after the user confirmed the summary.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        description: { type: 'string', description: 'Who fits and who does not, in plain words; the qualifier reads it for every company' },
        jobTitles: stringList('Decision-maker titles'),
        industries: stringList('Industries or company types'),
        locations: stringList('Countries, states or cities'),
        headcount: stringList('Company sizes, e.g. "11-50" or buckets 1-10, 11-20, 21-50, 51-100, 101-200, 201-500, 501-1000, 1001-2000, 2001-5000, 5001-10000, 10000+'),
      },
    },
    run: (args) => actions.startIcp(args),
  },
  {
    name: 'find_leads',
    description: 'Search Prospeo for new people and add them to the CRM, queued for qualification. 25 people per page, 1 Prospeo credit per page. Only after the user agreed to the page count.',
    parameters: {
      type: 'object',
      properties: {
        icpProfileId: { type: 'string', description: 'ICP to search with, usually the one start_icp just made' },
        pages: { type: 'integer', minimum: 1, maximum: 10 },
        page: { type: 'integer', minimum: 1, description: 'First page, to continue a search (nextPage from the last run)' },
      },
      required: ['icpProfileId'],
    },
    run: (args) => actions.findLeads(args),
  },
  {
    name: 'qualify_leads',
    description: 'Run the qualifier on the next batch of Pending leads now (it also runs by itself every 5 minutes).',
    parameters: { type: 'object', properties: {} },
    run: () => actions.qualifyLeads(),
  },
  {
    name: 'qualification_status',
    description: 'How many leads are Pending, Qualified, in Review, Rejected and Enrolled.',
    parameters: { type: 'object', properties: {} },
    run: () => actions.qualificationStatus(),
  },
  {
    name: 'enroll_qualified',
    description: 'Enroll Qualified leads with a verified email into a sequence. Run with dryRun true first and show the count; run for real only after the user says yes.',
    parameters: {
      type: 'object',
      properties: {
        sequenceId: { type: 'string' },
        campaignId: { type: 'string' },
        limit: { type: 'integer', minimum: 1 },
        dryRun: { type: 'boolean' },
      },
      required: ['sequenceId'],
    },
    run: (args) => actions.enrollQualified(args),
  },
];
