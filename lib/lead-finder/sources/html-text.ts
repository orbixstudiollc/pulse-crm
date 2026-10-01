// Pure HTML -> readable text, good enough to give an LLM a homepage's copy.

const ENTITIES: Record<string, string> = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", "#39": "'",
};

export function htmlToText(html: string): { title: string | null; text: string } {
  const titleMatch = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  const title = titleMatch ? decode(titleMatch[1]).replace(/\s+/g, " ").trim() || null : null;
  const metaMatch =
    /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i.exec(html) ??
    /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i.exec(html);

  const body = html
    .replace(/<(script|style|noscript|svg|template|iframe)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|section|article|li|h[1-6]|tr|br|header|footer)>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  const lines = decode(body)
    .split("\n")
    .map((l) => l.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  const description = metaMatch ? decode(metaMatch[1]).trim() : "";
  const text = [description, ...lines].filter(Boolean).join("\n");
  return { title, text };
}

function decode(s: string): string {
  return s.replace(/&(#?\w+);/g, (m, name: string) => {
    if (ENTITIES[name]) return ENTITIES[name];
    if (/^#\d+$/.test(name)) return String.fromCodePoint(Number(name.slice(1)));
    if (/^#x[0-9a-f]+$/i.test(name)) return String.fromCodePoint(parseInt(name.slice(2), 16));
    return m;
  });
}
