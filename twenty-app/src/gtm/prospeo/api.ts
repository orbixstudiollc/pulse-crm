import { ProspeoError, prospeoRequest } from 'src/gtm/prospeo/client';

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

export interface ProspeoAccountInfo {
  plan: string | null;
  remainingCredits: number | null;
  usedCredits: number | null;
  renewalDate: string | null;
  renewalInDays: number | null;
}

const toNumber = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const toText = (value: unknown) => (typeof value === 'string' && value.trim() ? value : null);

// Prospeo wraps the account details in `response` (`data` in some clients).
export function parseAccountInfo(json: Record<string, unknown>): ProspeoAccountInfo {
  const raw = (json.response ?? json.data ?? json) as Record<string, unknown>;
  return {
    plan: toText(raw.current_plan),
    remainingCredits: toNumber(raw.remaining_credits),
    usedCredits: toNumber(raw.used_credits),
    renewalDate: toText(raw.next_quota_renewal_date),
    renewalInDays: toNumber(raw.next_quota_renewal_days),
  };
}

// Free call: credits left, plan and renewal date. It costs no credits.
// Prospeo documents it as GET; older accounts answered POST only, so a 405 retries as POST.
export async function getAccountInfo(apiKey: string, fetchImpl?: typeof fetch): Promise<ProspeoAccountInfo> {
  try {
    return parseAccountInfo(await prospeoRequest<Record<string, unknown>>('/account-information', null, apiKey, fetchImpl));
  } catch (error) {
    if (!(error instanceof ProspeoError) || error.status !== 405) throw error;
    return parseAccountInfo(await prospeoRequest<Record<string, unknown>>('/account-information', {}, apiKey, fetchImpl));
  }
}
