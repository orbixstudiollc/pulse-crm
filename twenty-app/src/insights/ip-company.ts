// IP-to-company lookup with IPinfo (ipinfo.io). Paid IPinfo plans return the
// company that owns the IP range (`company`, `asn` with a type); the free Lite
// API only returns the network owner (`as_name`, `as_domain`), which is a real
// company for business networks and an ISP or cloud host otherwise. Home and
// mobile visitors resolve to their ISP and stay unmatched.

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

// Network owners that are carriers, clouds or hosts, not prospects.
const NOT_A_BUSINESS =
  /telecom|telekom|communications?|broadband|cable|wireless|mobile|cellular|internet|\bisp\b|\bnet(works?)?\b|fiber|fibre|dsl|telefonica|vodafone|verizon|comcast|at&t|t-mobile|charter|spectrum|orange|airtel|jio|grameenphone|robi|banglalink|hosting|\bhost|datacenter|data center|cloud|amazon|aws|google|microsoft|azure|oracle|digitalocean|ovh|hetzner|linode|akamai|cloudflare|fastly|vultr|leaseweb|contabo|university|college|school|edu\b/i;

const NOT_A_BUSINESS_DOMAIN =
  /(^|\.)(amazon|amazonaws|google|googleusercontent|microsoft|azure|oracle|digitalocean|ovh|hetzner|linode|akamai|cloudflare|fastly|vultr|leaseweb|contabo|comcast|verizon|att|t-mobile|vodafone|orange|airtel|jio)\.|\.edu$|\.ac\.[a-z]{2}$/i;

const BUSINESS_TYPES = new Set(['business']);

export const cleanDomain = (value: unknown): string | null => {
  const raw = str(value);
  if (!raw) return null;
  const domain = raw.replace(/^https?:\/\//i, '').replace(/^www\./i, '').split('/')[0].toLowerCase();
  return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain) ? domain : null;
};

// Access networks usually sit on .net or a "...net" brand (antbd.net, qtnet.co.jp, bbtec.net).
const ACCESS_NETWORK_DOMAIN = /\.net(\.[a-z]{2})?$|^[a-z0-9-]*net\.|\.(ne|ad|or)\.jp$/i;

const looksLikeBusiness = (name: string | null, domain: string | null) =>
  Boolean(domain) &&
  !NOT_A_BUSINESS_DOMAIN.test(domain as string) &&
  !ACCESS_NETWORK_DOMAIN.test(domain as string) &&
  !(name && NOT_A_BUSINESS.test(name));

/** Read an IPinfo response (full or Lite format). */
export const parseIpinfo = (json: Obj): IpCompany => {
  const company = (json.company ?? null) as Obj | null;
  const asn = (json.asn && typeof json.asn === 'object' ? json.asn : null) as Obj | null;
  const city = str(json.city);
  const country = str(json.country_code) ?? (str(json.country)?.length === 2 ? str(json.country) : null) ?? str(json.country);
  const orgName = str(json.org)?.replace(/^AS\d+\s+/, '') ?? null;
  const network = str(company?.name) ?? str(asn?.name) ?? str(json.as_name) ?? orgName;
  const base = { city, country, network };

  // Paid plans say what kind of owner it is.
  for (const owner of [company, asn]) {
    if (!owner) continue;
    const type = str(owner.type);
    const domain = cleanDomain(owner.domain);
    const name = str(owner.name);
    if (type ? BUSINESS_TYPES.has(type) && domain : looksLikeBusiness(name, domain)) {
      return { ...base, companyName: name, companyDomain: domain };
    }
  }
  if (company || asn) return { ...base, companyName: null, companyDomain: null };

  // Lite: guess from the network owner's name and domain.
  const liteName = str(json.as_name);
  const liteDomain = cleanDomain(json.as_domain);
  if (looksLikeBusiness(liteName, liteDomain)) return { ...base, companyName: liteName, companyDomain: liteDomain };
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
