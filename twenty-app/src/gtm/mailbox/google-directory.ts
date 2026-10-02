import type { DirectoryUser } from 'src/gtm/mailbox/bulk-import';

type FetchLike = (url: string, init: { headers: Record<string, string> }) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

const USERS_URL = 'https://admin.googleapis.com/admin/directory/v1/users';
const MAX_PAGES = 40;

// Lists Workspace users with the Admin SDK Directory API. The token must be
// delegated to an admin with the admin.directory.user.readonly scope.
export const listWorkspaceUsers = async (
  accessToken: string,
  options: { domain?: string | null; fetch?: FetchLike } = {},
): Promise<DirectoryUser[]> => {
  const doFetch = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
  const users: DirectoryUser[] = [];
  let pageToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ maxResults: '500', orderBy: 'email', projection: 'basic' });
    if (options.domain?.trim()) params.set('domain', options.domain.trim().replace(/^@/, ''));
    else params.set('customer', 'my_customer');
    if (pageToken) params.set('pageToken', pageToken);

    const response = await doFetch(`${USERS_URL}?${params}`, { headers: { Authorization: `Bearer ${accessToken}` } });
    if (!response.ok) {
      throw new Error(`Google Directory API error ${response.status}: ${(await response.text()).slice(0, 300)}`);
    }
    const body = (await response.json()) as { users?: DirectoryUser[]; nextPageToken?: string };
    users.push(...(body.users ?? []));
    if (!body.nextPageToken) break;
    pageToken = body.nextPageToken;
  }

  return users;
};
