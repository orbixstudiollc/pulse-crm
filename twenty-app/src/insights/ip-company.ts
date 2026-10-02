// IP-to-company lookup with IPinfo (ipinfo.io). Only paid IPinfo plans say
// which company uses an IP range (`company` / `asn` typed "business"); the
// free and Lite APIs only name the network owner, which is the visitor's ISP
// for nearly all traffic, so those give a network name and no company.

export type IpCompany = {
  // A business we can prospect, or null when the IP belongs to an ISP, host or school.
  companyName: string | null;
  companyDomain: string | null;
  city: string | null;
  country: string | null;
  // Who owns the network, for display even when it is not a business.
  network: string | null;
};

type Obj = Record<string, unknown>;

const str = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim() : null);

const BUSINESS_TYPES = new Set(['business']);

export const cleanDomain = (value: unknown): string | null => {
  const raw = str(value);
  if (!raw) return null;
  const domain = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? domain : null;
};

/** Read an IPinfo response (full or Lite format). */
export const parseIpinfo = (json: Obj): IpCompany => {
  const company = (json.company ?? null) as Obj | null;
  const asn = (json.asn && typeof json.asn === 'object' ? json.asn : null) as Obj | null;
  const city = str(json.city);
  const country = str(json.country_code) ?? (str(json.country)?.length === 2 ? str(json.country) : null) ?? str(json.country);
  const orgName = str(json.org)?.replace(/^AS\d+\s+/, '') ?? null;
  const network = str(company?.name) ?? str(asn?.name) ?? str(json.as_name) ?? orgName;
  const base = { city, country, network };

  // Only an owner IPinfo itself types as a business counts. Without a type
  // (free and Lite plans) the network owner is nearly always the visitor's
  // ISP, mobile carrier or host (live data: Bell Canada, Starlink, Netia), so
  // it is shown as the network but never prospected.
  for (const owner of [company, asn]) {
    const domain = cleanDomain(owner?.domain);
    if (owner && str(owner.type) && BUSINESS_TYPES.has(str(owner.type) as string) && domain) {
      return { ...base, companyName: str(owner.name), companyDomain: domain };
    }
  }
  return { ...base, companyName: null, companyDomain: null };
};

const NO_LOOKUP = /^(10\.|127\.|0\.|169\.254\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1$|fc|fd|fe80)/i;

/**
 * Look an IP up. Tries the full API first (company data on paid plans), then
 * the Lite API for the network owner's domain.
 */
export const lookupIp = async (ip: string, token: string, fetchImpl: typeof fetch = fetch): Promise<IpCompany> => {
  if (NO_LOOKUP.test(ip)) return { companyName: null, companyDomain: null, city: null, country: null, network: null };
  const get = async (url: string): Promise<Obj | null> => {
    const res = await fetchImpl(url, { headers: { Accept: 'application/json', Authorization: `Bearer ${token}` } });
    if (res.status === 401 || res.status === 403) throw new Error(`IPinfo rejected the token (${res.status})`);
    if (res.status === 429) throw new Error('IPinfo rate limit reached');
    if (!res.ok) return null;
    return (await res.json()) as Obj;
  };
  const ipPath = encodeURIComponent(ip);
  const full = await get(`https://ipinfo.io/${ipPath}/json`);
  const parsed = full ? parseIpinfo(full) : null;
  if (parsed?.companyDomain) return parsed;
  // The full response on free plans has no owner domain: ask Lite for it.
  if (!full || (!full.company && !(full.asn && typeof full.asn === 'object'))) {
    const lite = await get(`https://api.ipinfo.io/lite/${ipPath}`);
    if (lite) {
      const fromLite = parseIpinfo(lite);
      return { ...fromLite, city: parsed?.city ?? fromLite.city, country: parsed?.country ?? fromLite.country, network: fromLite.network ?? parsed?.network ?? null };
    }
  }
  return parsed ?? { companyName: null, companyDomain: null, city: null, country: null, network: null };
};
