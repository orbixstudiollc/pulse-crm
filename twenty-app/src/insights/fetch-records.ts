import { RestApiClient } from 'twenty-client-sdk/rest';

// Reads every record of an object through Twenty's REST API, a page at a
// time, up to `maxRecords`. Good enough for SMB-sized workspaces; swap for a
// server-side groupBy once the dataset outgrows it.

type RestPage = {
  data?: Record<string, unknown[]>;
  pageInfo?: { hasNextPage?: boolean; endCursor?: string | null };
};

const PAGE_SIZE = 200;

export const fetchAllRecords = async <T>(
  namePlural: string,
  { maxRecords = 5000, client = new RestApiClient() }: { maxRecords?: number; client?: RestApiClient } = {},
): Promise<T[]> => {
  const out: T[] = [];
  let cursor: string | undefined;
  while (out.length < maxRecords) {
    const page = await client.get<RestPage>(`/rest/${namePlural}`, {
      query: { limit: PAGE_SIZE, depth: 0, starting_after: cursor },
    });
    const rows = (page.data?.[namePlural] ?? []) as T[];
    out.push(...rows);
    const next = page.pageInfo?.endCursor ?? undefined;
    if (!page.pageInfo?.hasNextPage || !next || rows.length === 0) break;
    cursor = next;
  }
  return out.slice(0, maxRecords);
};
