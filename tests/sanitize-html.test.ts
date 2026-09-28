// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { sanitizeEmailHtml } from "@/lib/security/sanitize-html";

function parse(html: string): HTMLElement {
  const div = document.createElement("div");
  div.innerHTML = sanitizeEmailHtml(html);
  return div;
}

describe("sanitizeEmailHtml", () => {
  it("removes <script>", () => {
    const out = sanitizeEmailHtml("<p>a</p><script>alert(1)</script>");
    expect(out).not.toMatch(/script/i);
    expect(out).toContain("<p>a</p>");
  });

  it("keeps img but drops onerror", () => {
    const img = parse("<img src=x onerror=alert(1)>").querySelector("img");
    expect(img).not.toBeNull();
    expect(img!.hasAttribute("onerror")).toBe(false);
  });

  it("strips javascript: href", () => {
    const a = parse('<a href="javascript:alert(1)">x</a>').querySelector("a");
    expect(a).not.toBeNull();
    expect(a!.hasAttribute("href")).toBe(false);
  });

  it("adds target=_blank and rel=noopener to https links", () => {
    const a = parse('<a href="https://x.test">x</a>').querySelector("a")!;
    expect(a.getAttribute("href")).toBe("https://x.test");
    expect(a.getAttribute("target")).toBe("_blank");
    expect(a.getAttribute("rel")).toContain("noopener");
  });

  it("removes iframe, form and style elements", () => {
    const out = sanitizeEmailHtml(
      '<iframe src="https://x.test"></iframe><form action="https://x.test"><p>f</p></form><style>p{color:red}</style>',
    );
    expect(out).not.toMatch(/<iframe/i);
    expect(out).not.toMatch(/<form/i);
    expect(out).not.toMatch(/<style/i);
  });

  it("drops style attributes", () => {
    const p = parse('<p style="position:fixed">x</p>').querySelector("p")!;
    expect(p.hasAttribute("style")).toBe(false);
  });

  it("keeps raster data: image src", () => {
    const img = parse('<img src="data:image/png;base64,AAAA">').querySelector("img")!;
    expect(img.getAttribute("src")).toBe("data:image/png;base64,AAAA");
  });

  it("drops svg data: image src", () => {
    const img = parse('<img src="data:image/svg+xml;base64,AAAA">').querySelector("img")!;
    expect(img.hasAttribute("src")).toBe(false);
  });

  it("drops data: href on links", () => {
    const a = parse('<a href="data:text/html;base64,AAAA">x</a>').querySelector("a")!;
    expect(a.hasAttribute("href")).toBe(false);
  });

  it("drops entity-encoded javascript: href", () => {
    const a = parse('<a href="&#106;avascript:alert(1)">x</a>').querySelector("a")!;
    expect(a.hasAttribute("href")).toBe(false);
  });

  it("preserves plain formatting", () => {
    expect(sanitizeEmailHtml("<p>Hello <b>world</b></p>")).toBe("<p>Hello <b>world</b></p>");
  });

  it("does not duplicate hooks across calls", () => {
    const html = '<a href="https://x.test">x</a><img src="data:image/png;base64,AAAA">';
    const first = sanitizeEmailHtml(html);
    const second = sanitizeEmailHtml(html);
    expect(second).toBe(first);
    expect(second.match(/noopener/g)).toHaveLength(1);
  });
});
