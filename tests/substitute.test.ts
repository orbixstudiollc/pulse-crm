import { describe, expect, it } from "vitest";
import { escapeHtml, substituteVariables } from "@/lib/personalization/substitute";

const XSS = "<img src=x onerror=alert(1)>";

describe("substituteVariables", () => {
  it("entity-escapes an HTML payload in a value when html is true", () => {
    const out = substituteVariables("Hi {{name}}", { name: XSS }, { html: true });
    expect(out).toBe("Hi &lt;img src=x onerror=alert(1)&gt;");
    expect(out).not.toContain("<img");
  });

  it("leaves the value untouched without the html option", () => {
    expect(substituteVariables("Hi {{name}}", { name: XSS })).toBe(`Hi ${XSS}`);
  });

  it("renders a missing variable as empty", () => {
    expect(substituteVariables("Hi {{missing}}!", {})).toBe("Hi !");
  });

  it("keeps authored template markup intact with html true", () => {
    const out = substituteVariables("<b>{{company}}</b>", { company: "Acme" }, { html: true });
    expect(out).toBe("<b>Acme</b>");
  });

  it("escapes ampersands and quotes in values", () => {
    const out = substituteVariables(
      '<a title="{{company}}">x</a>',
      { company: `Tom & Jerry's "Co"` },
      { html: true },
    );
    expect(out).toBe('<a title="Tom &amp; Jerry&#39;s &quot;Co&quot;">x</a>');
  });

  it("does not re-interpret inserted values as template syntax", () => {
    expect(substituteVariables("{{a}}", { a: "{{b}}", b: "boom" })).toBe("{{b}}");
  });
});

describe("escapeHtml", () => {
  it("escapes all five special characters", () => {
    expect(escapeHtml(`&<>"'`)).toBe("&amp;&lt;&gt;&quot;&#39;");
  });
});
