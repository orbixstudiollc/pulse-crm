import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageText } from "@/components/features/Copilot/MessageText";

const html = (text: string) => renderToStaticMarkup(createElement(MessageText, { text }));

describe("MessageText", () => {
  it("renders bold and code instead of showing the markers", () => {
    const out = html("Here are your **3 newest leads** and `search_leads`.");
    expect(out).toContain('<strong class="font-semibold">3 newest leads</strong>');
    expect(out).toContain(">search_leads</code>");
    expect(out).not.toContain("**");
  });

  it("renders a numbered list with nested bullets", () => {
    const out = html("1. **Megan Johnson** — LunarGrid\n   - warm · score **54**\n\n2. **Amanda Hamilton**\n   - warm");
    expect(out).toContain('<ol class="my-1.5 space-y-1 pl-5 list-decimal">');
    expect((out.match(/<li>/g) ?? []).length).toBe(4);
    expect(out).toContain("<strong class=\"font-semibold\">Megan Johnson</strong>");
    expect(out).toContain("<ul class=\"mt-0.5 list-disc");
  });

  it("renders single-asterisk italics without touching bold or list bullets", () => {
    const out = html("- **Michael Anderson** — score 99 — *Cold Call*\n* Plain bullet");
    expect(out).toContain("<em>Cold Call</em>");
    expect(out).toContain('<strong class="font-semibold">Michael Anderson</strong>');
    expect(out).toContain("<li><span>Plain bullet</span></li>");
    expect(out).not.toContain("*");
  });

  it("escapes HTML from the model instead of rendering it", () => {
    const out = html('<img src=x onerror="alert(1)"> **hi**');
    expect(out).not.toContain("<img");
    expect(out).toContain("&lt;img");
  });

  it("renders headings and plain paragraphs", () => {
    const out = html("## Quick take\nAmanda is the best opportunity.");
    expect(out).toContain('<p class="mt-3 mb-1 font-semibold">');
    expect(out).toContain("Amanda is the best opportunity.");
    expect(out).not.toContain("##");
  });
});
