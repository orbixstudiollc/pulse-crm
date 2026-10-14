import { RestApiClient } from 'twenty-client-sdk/rest';

import type { TwentyCompanyRecord, TwentyIcpRecord, TwentyPersonRecord } from 'src/gtm/leadfinder/mapping';

// Thin wrapper over Twenty's REST API for Lead Finder. Inside a logic function
// the client picks up the API URL and the app's access token from the
// environment Twenty provides.

type Obj = Record<string, unknown>;
type ListResponse = { data: Record<string, unknown[]>; pageInfo?: { hasNextPage?: boolean; endCursor?: string } };

let client: RestApiClient | null = null;
const rest = () => (client ??= new RestApiClient());

/** Quote a value for a REST filter expression. */
export function filterValue(value: string): string {
  return JSON.stringify(value);
}

export function inFilter(field: string, values: string[]): string {
  return `${field}[in]:[${values.map(filterValue).join(',')}]`;
}

function first<T>(json: { data: Obj }): T {
  return Object.values(json.data)[0] as T;
}

async function list<T>(object: string, query: Record<string, string | number | undefined>): Promise<{ records: T[]; endCursor?: string; hasNextPage: boolean }> {
  const json = await rest().get<ListResponse>(`/rest/${object}`, { query });
  return {
    records: (json.data?.[object] ?? []) as T[],
    endCursor: json.pageInfo?.endCursor,
    hasNextPage: Boolean(json.pageInfo?.hasNextPage),
  };
}

export async function getPerson(id: string): Promise<TwentyPersonRecord | null> {
  const json = await rest().get<{ data: Obj }>(`/rest/people/${id}`, { query: { depth: 1 } });
  return first<TwentyPersonRecord | null>(json) ?? null;
}

export async function getIcpProfile(id: string): Promise<TwentyIcpRecord | null> {
  const json = await rest().get<{ data: Obj }>(`/rest/icpProfiles/${id}`);
  return first<TwentyIcpRecord | null>(json) ?? null;
}

export async function listActiveIcpProfiles(): Promise<TwentyIcpRecord[]> {
  const { records } = await list<TwentyIcpRecord>('icpProfiles', { filter: 'isActive[eq]:true', limit: 100 });
  return records;
}

/** One page of people (with companies), for bulk rescoring. */
export function listPeoplePage(cursor?: string, limit = 60) {
  return list<TwentyPersonRecord>('people', { limit, depth: 1, starting_after: cursor });
}

export async function findPeopleByProspeoIds(ids: string[]): Promise<TwentyPersonRecord[]> {
  if (ids.length === 0) return [];
  const { records } = await list<TwentyPersonRecord>('people', { filter: inFilter('prospeoPersonId', ids), limit: 200 });
  return records;
}

export async function findPeopleByEmails(emails: string[]): Promise<TwentyPersonRecord[]> {
  if (emails.length === 0) return [];
  const { records } = await list<TwentyPersonRecord>('people', { filter: inFilter('emails.primaryEmail', emails), limit: 200 });
  return records;
}

export async function findCompanyByDomain(domain: string): Promise<TwentyCompanyRecord | null> {
  const { records } = await list<TwentyCompanyRecord>('companies', {
    filter: `domainName.primaryLinkUrl[ilike]:${filterValue(`%${domain}%`)}`,
    limit: 5,
  });
  return records[0] ?? null;
}

export async function createRecord<T = { id: string }>(object: 'people' | 'companies', payload: Obj): Promise<T> {
  return first<T>(await rest().post<{ data: Obj }>(`/rest/${object}`, payload));
}

export async function updatePerson(id: string, payload: Obj): Promise<void> {
  await rest().patch(`/rest/people/${id}`, payload);
}
