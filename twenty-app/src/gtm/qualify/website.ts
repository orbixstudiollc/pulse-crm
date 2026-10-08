// Website research: read a company's homepage and one or two pages about what
// it does, as plain text for the classifier. Firecrawl (FIRECRAWL_API_KEY)
// when set, otherwise a direct fetch.

export type WebsitePage = { url: string; text: string; links: string[] };
export type PageReader = (url: string) => Promise<WebsitePage | null>;

export type WebsiteResearch = { pages: { url: string; text: string }[]; text: string };

const MAX_PAGE_TEXT = 6000;
const MAX_RESEARCH_TEXT = 9000;
const FETCH_TIMEOUT_MS = 15_000;

// Pages that say what a company does, in order of preference.
const ABOUT_PATTERNS = [/\/services?\b/i, /\/what-we-do\b/i, /\/about(-us)?\b/i, /\/capabilities\b/i, /\/solutions\b/i, /\/work\b/i, /\/agency\b/i];

const decodeEntities = (s: string) =>
  s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));

/** Visible text of an HTML page, with its title and meta description first. */
export const htmlToText = (html: string): string => {
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const description =
    html.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i)?.[1];
  const body = html
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/section|\/tr)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return [title, description, body]
    .filter(Boolean)
    .map((s) => decodeEntities(s as string))
    .join('\n')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
};

/** Same-site links from an HTML page, absolute. */
export const htmlLinks = (html: string, base: string): string[] => {
  const out = new Set<string>();
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'#]+)["']/gi)) {
    try {
      const url = new URL(m[1], base);
      if (url.hostname.replace(/^www\./, '') === new URL(base).hostname.replace(/^www\./, '')) out.add(url.origin + url.pathname);
    } catch {
      // not a URL
    }
  }
  return [...out];
};

export const pickAboutPages = (links: string[], homepage: string, max = 2): string[] => {
  const home = homepage.replace(/\/+$/, '');
  const picked: string[] = [];
  for (const pattern of ABOUT_PATTERNS) {
    const hit = links.find((l) => pattern.test(new URL(l).pathname) && l.replace(/\/+$/, '') !== home && !picked.includes(l));
    if (hit) picked.push(hit);
    if (picked.length >= max) break;
  }
  return picked;
};

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export const researchWebsite = async (domain: string, read: PageReader): Promise<WebsiteResearch | null> => {
  const homepage = `https://${domain}`;
  const home = (await read(homepage).catch(() => null)) ?? (await read(`https://www.${domain}`).catch(() => null));
  if (!home || !home.text.trim()) return null;
  const pages = [{ url: home.url, text: clip(home.text, MAX_PAGE_TEXT) }];
  for (const url of pickAboutPages(home.links, home.url)) {
    const page = await read(url).catch(() => null);
    if (page?.text.trim()) pages.push({ url: page.url, text: clip(page.text, MAX_PAGE_TEXT) });
  }
  const text = clip(pages.map((p) => `# ${p.url}\n${p.text}`).join('\n\n'), MAX_RESEARCH_TEXT);
  return { pages, text };
};

// Direct fetch. Good enough for most agency sites; script-only sites come back thin.
export const directPageReader =
  (fetchImpl: typeof fetch = fetch): PageReader =>
  async (url) => {
    const res = await fetchImpl(url, {
      redirect: 'follow',
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; PulseResearch/1.0; +https://orbix.studio)',
        accept: 'text/html,application/xhtml+xml',
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (type && !/html|text/i.test(type)) return null;
    const html = (await res.text()).slice(0, 1_500_000);
    const finalUrl = res.url || url;
    return { url: finalUrl, text: htmlToText(html), links: htmlLinks(html, finalUrl) };
  };

// Firecrawl v2 scrape: main content as markdown, plus the page's links.
export const firecrawlPageReader =
  (apiKey: string, fetchImpl: typeof fetch = fetch): PageReader =>
  async (url) => {
    const res = await fetchImpl('https://api.firecrawl.dev/v2/scrape', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ url, formats: ['markdown', 'links'], onlyMainContent: true, timeout: 30000 }),
      signal: AbortSignal.timeout(45_000),
    });
    if (res.status === 401 || res.status === 402) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      throw new Error(`Firecrawl ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    if (!res.ok) return null;
    const json = (await res.json()) as {
      success?: boolean;
      data?: { markdown?: string; links?: unknown[]; metadata?: { sourceURL?: string; url?: string; title?: string; description?: string } };
    };
    const data = json.data;
    if (!json.success || !data?.markdown) return null;
    const base = data.metadata?.url || data.metadata?.sourceURL || url;
    const host = new URL(base).hostname.replace(/^www\./, '');
    const links = (data.links ?? [])
      .filter((l): l is string => typeof l === 'string')
      .filter((l) => {
        try {
          return new URL(l).hostname.replace(/^www\./, '') === host;
        } catch {
          return false;
        }
      });
    const text = [data.metadata?.title, data.metadata?.description, data.markdown].filter(Boolean).join('\n');
    return { url: base, text, links };
  };

/** Firecrawl when a key is set, falling back to a direct fetch when Firecrawl has nothing. */
export const pickPageReader = (env: Record<string, string | undefined>, fetchImpl: typeof fetch = fetch): { read: PageReader; source: string } => {
  const direct = directPageReader(fetchImpl);
  const key = env.FIRECRAWL_API_KEY?.trim();
  if (!key) return { read: direct, source: 'direct' };
  const firecrawl = firecrawlPageReader(key, fetchImpl);
  return {
    read: async (url) => (await firecrawl(url)) ?? (await direct(url).catch(() => null)),
    source: 'firecrawl',
  };
};
