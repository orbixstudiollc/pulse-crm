import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { rewriteClasses } from "../scripts/restyle/codemod.mjs";
import { jsxText } from "../scripts/restyle/jsxtext.mjs";

/** Rewrite one class string (wrapped as a string literal). */
const rw = (cls: string): string => JSON.parse(rewriteClasses(JSON.stringify(cls)).out);

// [input class string, expected output] — one row per mapping-table rule.
const ROWS: Array<[string, string]> = [
  // dark: colour tokens deleted when a light token of the same chain + property exists
  ["bg-white dark:bg-neutral-900", "bg-surface"],
  ["dark:hidden", "dark:hidden"],
  ["dark:block dark:invert", "dark:block dark:invert"],
  // neutral backgrounds
  ["bg-white", "bg-surface"],
  ["bg-white/80", "bg-surface/80"],
  ["bg-neutral-50", "bg-subtle"],
  ["bg-neutral-100", "bg-muted"],
  ["bg-neutral-200", "bg-active"],
  ["bg-neutral-300", "bg-active"],
  ["bg-neutral-400", "bg-fg-muted"],
  ["bg-neutral-500", "bg-fg-muted"],
  ["bg-neutral-700", "bg-inverse"],
  ["bg-neutral-800", "bg-inverse"],
  ["bg-neutral-900", "bg-inverse"],
  ["bg-neutral-950", "bg-inverse"],
  ["bg-zinc-500/10", "bg-muted"],
  ["bg-neutral-500/15", "bg-muted"],
  ["bg-neutral-400/10", "bg-muted"],
  ["hover:bg-neutral-50", "hover:bg-muted"],
  ["hover:bg-neutral-100", "hover:bg-muted"],
  ["hover:bg-neutral-200", "hover:bg-active"],
  ["hover:bg-neutral-300", "hover:bg-active"],
  ["bg-slate-100", "bg-muted"],
  ["bg-stone-900", "bg-inverse"],
  // neutral text
  ["text-neutral-950", "text-fg"],
  ["text-neutral-900", "text-fg"],
  ["text-neutral-800", "text-fg"],
  ["text-neutral-700", "text-fg"],
  ["text-neutral-600", "text-fg-secondary"],
  ["text-neutral-500", "text-fg-secondary"],
  ["text-gray-500", "text-fg-secondary"],
  ["text-neutral-400", "text-fg-muted"],
  ["text-neutral-300", "text-fg-disabled"],
  ["text-neutral-200", "text-fg-disabled"],
  ["text-neutral-100", "text-on-inverse"],
  ["text-neutral-50", "text-on-inverse"],
  ["text-white", "text-white"],
  // neutral borders
  ["border-neutral-50", "border-row"],
  ["border-neutral-100", "border-row"],
  ["border-neutral-200", "border-line"],
  ["border-neutral-300", "border-line"],
  ["border-neutral-400", "border-fg-muted"],
  ["border-neutral-500/30", "border-line"],
  ["border-neutral-600", "border-line"],
  ["border-neutral-700", "border-line"],
  ["border-neutral-800", "border-line"],
  ["border-neutral-900", "border-inverse"],
  ["border-neutral-950", "border-inverse"],
  ["border-t-neutral-600", "border-t-line"],
  ["border-b-neutral-200", "border-b-line"],
  ["hover:border-neutral-300", "hover:border-fg-muted"],
  ["hover:border-neutral-400", "hover:border-fg-muted"],
  ["focus:border-neutral-400", "focus:border-accent"],
  ["focus:border-neutral-950", "focus:border-accent"],
  // other neutral utilities
  ["divide-neutral-200", "divide-row"],
  ["ring-neutral-200", "ring-line"],
  ["hover:ring-neutral-300", "hover:ring-fg-muted"],
  ["placeholder-neutral-400", "placeholder:text-fg-muted"],
  ["placeholder:text-neutral-500", "placeholder:text-fg-muted"],
  ["stroke-neutral-200", "stroke-chart-grid"],
  ["fill-neutral-300", "fill-chart-grid"],
  ["accent-neutral-950", "accent-accent"],
  ["shadow-neutral-950/5 p-2", "p-2"],
  // colour families by role
  ["bg-indigo-50", "bg-accent-surface"],
  ["bg-emerald-100", "bg-success-surface"],
  ["bg-amber-200", "bg-warning-surface"],
  ["bg-red-500/10", "bg-danger-surface"],
  ["bg-blue-600", "bg-accent-strong"],
  ["bg-violet-500", "bg-accent-strong"],
  ["bg-green-500", "bg-success"],
  ["bg-orange-800", "bg-warning"],
  ["bg-rose-700", "bg-danger"],
  ["hover:bg-indigo-700", "hover:bg-accent-strong"],
  ["hover:bg-red-800", "hover:bg-danger"],
  ["hover:bg-sky-50", "hover:bg-accent-surface"],
  ["hover:bg-teal-100", "hover:bg-success-surface"],
  ["text-violet-600", "text-accent-strong"],
  ["text-lime-600", "text-success"],
  ["text-yellow-700", "text-warning"],
  ["text-pink-500", "text-danger"],
  ["bg-indigo-50 text-indigo-700", "bg-accent-surface text-accent-on-surface"],
  ["bg-red-50 text-red-700", "bg-danger-surface text-danger"],
  ["border-cyan-500", "border-accent"],
  ["border-emerald-300", "border-success"],
  ["border-l-amber-400", "border-l-warning"],
  ["ring-purple-500", "ring-accent"],
  ["focus:ring-indigo-500", "focus:ring-accent"],
  ["focus-visible:ring-blue-600", "focus-visible:ring-accent"],
  ["checked:bg-indigo-600", "checked:bg-accent"],
  ["checked:border-indigo-600", "checked:border-accent"],
  ["peer-checked:bg-blue-600", "peer-checked:bg-accent"],
  ["stroke-emerald-500", "stroke-success"],
  ["stroke-amber-500", "stroke-warning"],
  ["stroke-red-500", "stroke-danger"],
  // gradients are never mapped
  ["bg-gradient-to-r from-indigo-500 to-violet-500", "bg-gradient-to-r from-indigo-500 to-violet-500"],
  // typography
  ["font-serif", "font-semibold"],
  ["font-onest text-sm", "text-sm"],
  ["font-serif italic", "font-semibold"],
  ["italic text-sm", "italic text-sm"],
  ["font-bold", "font-semibold"],
  ["font-extrabold", "font-semibold"],
  ["font-black", "font-semibold"],
  ["text-[9px]", "text-xs"],
  ["text-[10px]", "text-xs"],
  ["text-[11px]", "text-xs"],
  ["text-[15px]", "text-sm"],
  ["text-[28px]", "text-xl"],
  ["text-3xl", "text-xl"],
  ["text-[32px]", "text-[22px]"],
  ["text-[40px]", "text-2xl"],
  ["text-4xl", "text-2xl"],
  ["md:text-5xl", "md:text-2xl"],
  ["text-6xl", "text-2xl"],
  ["leading-[36px] text-sm", "text-sm"],
  ["leading-[40px] text-sm", "text-sm"],
  ["leading-[48px] text-sm", "text-sm"],
  ["tracking-tight tracking-[0.2em] text-sm", "text-sm"],
  ["uppercase text-xs", "text-xs"],
  // shape
  ["border-2", "border"],
  ["border-b-2", "border-b"],
  ["border-[0.5px]", "border"],
  ["rounded-[12px]", "rounded-lg"],
  ["shadow-sm shadow-md p-2", "p-2"],
  // spacing
  ["lg:p-8", "lg:p-6"],
  ["lg:px-8", "lg:px-6"],
  ["lg:-mx-8", "lg:-mx-6"],
  // never touched
  ["bg-black/50 bg-transparent", "bg-black/50 bg-transparent"],
  ["bg-[#123456] text-[#fff]", "bg-[#123456] text-[#fff]"],
  // important modifier is carried
  ["!bg-red-600 !text-white", "!bg-danger !text-on-inverse"],
];

describe("rewriteClasses mapping table", () => {
  it.each(ROWS)("%s -> %s", (input, expected) => {
    expect(rw(input)).toBe(expected);
  });
});

describe("rewriteClasses behaviour", () => {
  it("is idempotent on every mapping row and on a real page", () => {
    for (const [input] of ROWS) {
      const once = rewriteClasses(JSON.stringify(input)).out;
      expect(rewriteClasses(once).out).toBe(once);
    }
    const file = path.resolve(__dirname, "../app/dashboard/settings/client.tsx");
    const once = rewriteClasses(fs.readFileSync(file, "utf8"), file).out;
    expect(rewriteClasses(once, file).out).toBe(once);
  });

  it("maps text-white to text-on-inverse in the inverse pattern", () => {
    expect(rw("bg-neutral-900 dark:bg-white text-white dark:text-neutral-900")).toBe("bg-inverse text-on-inverse");
  });

  it("(h) maps text-white to text-on-inverse only on a filled background", () => {
    expect(rw("bg-indigo-600 hover:bg-indigo-700 text-white")).toBe("bg-accent-strong hover:bg-accent-strong text-on-inverse");
    expect(rw("bg-red-500 text-white/90")).toBe("bg-danger text-on-inverse/90");
    expect(rw("bg-emerald-600 text-white")).toBe("bg-success text-on-inverse");
    expect(rw("bg-amber-700 text-white")).toBe("bg-warning text-on-inverse");
    expect(rw("bg-accent-strong text-white")).toBe("bg-accent-strong text-on-inverse");
    expect(rw("bg-inverse text-white")).toBe("bg-inverse text-on-inverse");
    expect(rw("bg-black/50 text-white")).toBe("bg-black/50 text-white");
    expect(rw("bg-red-500/10 text-white")).toBe("bg-danger-surface text-white");
    expect(rw("bg-indigo-300 text-white")).toBe("bg-indigo-300 text-white");
    const once = rewriteClasses('"bg-neutral-800 text-white"').out;
    expect(once).toBe('"bg-inverse text-on-inverse"');
    expect(rewriteClasses(once).out).toBe(once);
  });

  it("uses text-accent-on-surface for accent pills only", () => {
    expect(rw("bg-blue-100 text-blue-600")).toBe("bg-accent-surface text-accent-on-surface");
    expect(rw("bg-blue-600 text-blue-100")).toBe("bg-accent-strong text-accent-strong");
    expect(rw("bg-emerald-50 text-emerald-700")).toBe("bg-success-surface text-success");
  });

  it("carries arbitrary variants as prefix", () => {
    expect(rw("[&::-webkit-slider-thumb]:bg-neutral-950 dark:[&::-webkit-slider-thumb]:bg-neutral-50")).toBe(
      "[&::-webkit-slider-thumb]:bg-inverse",
    );
  });

  it("rewrites status maps, cn() branches and template literals", () => {
    const src = [
      'const m = { call: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" };',
      'const c = cn("px-2", active && "bg-neutral-100 dark:bg-neutral-800");',
      "const t = `px-2 ${a ? \"bg-white\" : \"\"} uppercase ${b}`;",
      "const p = `bg-${c}-500 bg-white${x}`;",
    ].join("\n");
    expect(rewriteClasses(src, "x.ts").out).toBe(
      [
        'const m = { call: "bg-accent-surface text-accent-on-surface" };',
        'const c = cn("px-2", active && "bg-muted");',
        "const t = `px-2 ${a ? \"bg-surface\" : \"\"} ${b}`;",
        "const p = `bg-${c}-500 bg-white${x}`;",
      ].join("\n"),
    );
  });

  it("reports unmapped colour tokens and leaves them unchanged", () => {
    const r = rewriteClasses('"from-indigo-500 bg-neutral-600 text-sm"');
    expect(r.out).toBe('"from-indigo-500 bg-neutral-600 text-sm"');
    expect(r.unmapped.get("from-indigo-500")).toBe(1);
    expect(r.unmapped.has("bg-neutral-600")).toBe(true);
    expect(r.changed).toBe(0);
  });

  it("reports orphan-dark strings and keeps their dark tokens", () => {
    const r = rewriteClasses('<input className="dark:bg-neutral-800 dark:border-neutral-700" />');
    expect(r.out).toBe('<input className="dark:bg-neutral-800 dark:border-neutral-700" />');
    expect(r.orphans).toHaveLength(1);
    expect(r.orphans[0].text).toBe("dark:bg-neutral-800 dark:border-neutral-700");
  });

  it("leaves hex literals, style objects and JSX text untouched", () => {
    const src = '<div style={{ color: "#ff0000", textTransform: "uppercase" }} className="bg-white">uppercase bg-white</div>';
    expect(rewriteClasses(src).out).toBe(
      '<div style={{ color: "#ff0000", textTransform: "uppercase" }} className="bg-surface">uppercase bg-white</div>',
    );
  });
});

describe("rulings", () => {
  it("(a) deletes a dark token only when the same chain + property has a light token", () => {
    expect(rw("hover:bg-neutral-100 dark:hover:bg-neutral-800")).toBe("hover:bg-muted");
    const r = rewriteClasses('"bg-white dark:bg-neutral-900 dark:hover:bg-neutral-800"');
    expect(r.out).toBe('"bg-surface dark:hover:bg-neutral-800"');
    expect(r.orphans).toHaveLength(1);
    expect(rw("text-sm dark:text-neutral-400")).toBe("text-sm dark:text-neutral-400");
  });

  it("(b) deletes every shadow size instead of mapping to shadow-dropdown", () => {
    expect(rw("shadow-lg shadow-xl shadow-2xl rounded-lg")).toBe("rounded-lg");
  });

  it("(c) maps p-5/p-6 to p-4 only in bordered + rounded strings", () => {
    expect(rw("rounded-xl border p-6")).toBe("rounded-xl border p-4");
    expect(rw("border-2 rounded-lg p-5")).toBe("border rounded-lg p-4");
    expect(rw("border p-6")).toBe("border p-6");
    expect(rw("rounded-xl p-5")).toBe("rounded-xl p-5");
    expect(rw("rounded-xl border md:p-6")).toBe("rounded-xl border md:p-6");
  });

  it("(d) jsxtext keeps document order and duplicates", () => {
    const src = '<div><p>Save</p><p>Save</p><Input placeholder="Search" /><p>{busy ? "Saving..." : "Cancel"}</p></div>';
    expect(jsxText(src)).toEqual(["Save", "Save", "Search", "Saving...", "Cancel"]);
  });

  it("(e) the codemod CLI refuses paths outside app/ and components/", () => {
    const cli = path.resolve(__dirname, "../scripts/restyle/codemod.mjs");
    let status = 0;
    try {
      execFileSync(process.execPath, [cli, "tests/restyle-codemod.test.ts"], { cwd: path.resolve(__dirname, ".."), stdio: "pipe" });
    } catch (e) {
      status = (e as { status: number }).status;
    }
    expect(status).toBe(2);
  });
});
