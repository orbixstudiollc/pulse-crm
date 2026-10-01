import { prospeoRequest } from 'src/gtm/prospeo/client';

// Typed wrappers over the two Prospeo endpoints Lead Finder uses.

export interface SearchPersonResponse {
  results: Record<string, unknown>[];
  pagination?: { current_page: number; per_page: number; total_page: number; total_count: number };
}

export function searchPeople(
  apiKey: string,
  filters: Record<string, unknown>,
  page: number,
  fetchImpl?: typeof fetch,
) {
  return prospeoRequest<SearchPersonResponse>('/search-person', { page, filters }, apiKey, fetchImpl);
}

export function enrichPerson(
  apiKey: string,
  data: Record<string, unknown>,
  options: { mobile?: boolean } = {},
  fetchImpl?: typeof fetch,
) {
  return prospeoRequest<Record<string, unknown>>(
    '/enrich-person',
    { data, only_verified_email: true, ...(options.mobile ? { enrich_mobile: true } : {}) },
    apiKey,
    fetchImpl,
  );
}
