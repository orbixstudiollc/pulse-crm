// Website research: read a company's homepage and one or two pages about what
// it does, as plain text for the classifier. Firecrawl (FIRECRAWL_API_KEY)
// and Spider (SPIDER_API_KEY) when set, taking turns, otherwise a direct fetch.

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

const sameSite = (links: unknown[], base: string): string[] => {
  const host = new URL(base).hostname.replace(/^www\./, '');
  const out = new Set<string>();
  for (const l of links) {
    if (typeof l !== 'string') continue;
    try {
      const url = new URL(l, base);
      if (url.hostname.replace(/^www\./, '') === host) out.add(url.origin + url.pathname);
    } catch {
      // not a URL
    }
  }
  return [...out];
};

// Links written in markdown, for when Spider sends no link list.
const markdownLinks = (markdown: string): string[] => [...markdown.matchAll(/\]\(([^)\s]+)/g)].map((m) => m[1]);

// Spider (spider.cloud) scrape: one page as markdown. The answer is a list of
// pages ({ content, url, status, error, links? }); a single object is accepted too.
export const spiderPageReader =
  (apiKey: string, fetchImpl: typeof fetch = fetch): PageReader =>
  async (url) => {
    const res = await fetchImpl('https://api.spider.cloud/scrape', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ url, return_format: 'markdown', return_page_links: true, request: 'smart', limit: 1 }),
      signal: AbortSignal.timeout(45_000),
    });
    if (res.status === 401 || res.status === 402) {
      const detail = (await res.text().catch(() => '')).slice(0, 200);
      throw new Error(`Spider ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    if (!res.ok) return null;
    const json = (await res.json()) as unknown;
    const page = (Array.isArray(json) ? json[0] : json) as
      | { content?: unknown; url?: string; error?: unknown; status?: number; links?: unknown[] }
      | undefined;
    if (!page || typeof page.content !== 'string' || !page.content.trim()) return null;
    if (typeof page.status === 'number' && page.status >= 400) return null;
    const base = page.url || url;
    const links = sameSite(Array.isArray(page.links) && page.links.length ? page.links : markdownLinks(page.content), base);
    return { url: base, text: page.content, links };
  };

// Tries each reader in turn until one returns a page. A reader that throws
// (bad key, out of credits) is skipped, so the next one still gets a go.
export const chainReaders =
  (...readers: PageReader[]): PageReader =>
  async (url) => {
    for (const read of readers) {
      const page = await read(url).catch(() => null);
      if (page?.text.trim()) return page;
    }
    return null;
  };

/**
 * Firecrawl and Spider when their keys are set, falling back to a direct fetch.
 * With both keys they take turns going first, one website at a time, so
 * neither runs out of credits alone and either covers for the other.
 */
export const pickPageReader = (env: Record<string, string | undefined>, fetchImpl: typeof fetch = fetch): { read: PageReader; source: string } => {
  const direct = directPageReader(fetchImpl);
  const firecrawlKey = env.FIRECRAWL_API_KEY?.trim();
  const spiderKey = env.SPIDER_API_KEY?.trim();
  const firecrawl = firecrawlKey ? firecrawlPageReader(firecrawlKey, fetchImpl) : null;
  const spider = spiderKey ? spiderPageReader(spiderKey, fetchImpl) : null;
  if (firecrawl && spider) {
    const turns = [chainReaders(firecrawl, spider, direct), chainReaders(spider, firecrawl, direct)];
    let site = 0;
    let lastHost = '';
    return {
      // Pages of one website stay with the same reader.
      read: (url) => {
        const host = new URL(url).hostname.replace(/^www\./, '');
        if (host !== lastHost) {
          lastHost = host;
          site += 1;
        }
        return turns[site % 2](url);
      },
      source: 'firecrawl+spider',
    };
  }
  if (firecrawl) return { read: chainReaders(firecrawl, direct), source: 'firecrawl' };
  if (spider) return { read: chainReaders(spider, direct), source: 'spider' };
  return { read: direct, source: 'direct' };
};
