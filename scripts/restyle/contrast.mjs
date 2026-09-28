#!/usr/bin/env node
// WCAG 2.x contrast gate for the semantic tokens in styles/globals.css.
//   node scripts/restyle/contrast.mjs   -> prints a table, exit 1 on any failure
import fs from "node:fs";

// [text token, background token, minimum ratio]
const PAIRS = [
  ["on-inverse", "inverse", 4.5],
  ["on-inverse", "accent-strong", 4.5],
  ["accent-strong", "page", 4.5],
  ["accent-strong", "surface", 4.5],
  ["accent-on-surface", "accent-surface", 4.5],
  ...["page", "surface", "muted", "subtle", "active"].map((bg) => ["fg", bg, 4.5]),
  ...["page", "surface", "muted", "subtle"].map((bg) => ["fg-secondary", bg, 4.5]),
  ["success", "success-surface", 4.5],
  ["warning", "warning-surface", 4.5],
  ["danger", "danger-surface", 4.5],
  ["fg-muted", "page", 3],
];

function block(css, selector) {
  const start = css.search(new RegExp(`(^|\\n)\\s*${selector.replace(".", "\\.")}\\s*\\{`));
  if (start < 0) throw new Error(`no ${selector} block in globals.css`);
  const open = css.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(open + 1, i);
  }
  throw new Error(`unterminated ${selector} block`);
}

function vars(body) {
  const out = {};
  for (const m of body.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/--([\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

function resolve(table, name, seen = new Set()) {
  if (seen.has(name)) throw new Error(`cycle at --${name}`);
  seen.add(name);
  const v = table[name];
  if (v === undefined) throw new Error(`--${name} is not defined`);
  const ref = v.match(/^var\(--([\w-]+)\)$/);
  return ref ? resolve(table, ref[1], seen) : v;
}

function luminance(hex) {
  let h = hex.replace("#", "");
  if (h.length === 3) h = [...h].map((c) => c + c).join("");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error(`not a hex colour: ${hex}`);
  const [r, g, b] = [0, 2, 4].map((i) => {
    const c = parseInt(h.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function ratio(a, b) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

function main() {
  const css = fs.readFileSync("styles/globals.css", "utf8");
  const light = vars(block(css, ":root"));
  const themes = { light, dark: { ...light, ...vars(block(css, ".dark")) } };
  let failed = 0;
  console.log("theme  text               on background        fg        bg        ratio   min  result");
  for (const [theme, table] of Object.entries(themes)) {
    for (const [fg, bg, min] of PAIRS) {
      const a = resolve(table, fg);
      const b = resolve(table, bg);
      const r = ratio(a, b);
      const ok = r >= min;
      if (!ok) failed++;
      console.log(
        `${theme.padEnd(6)} ${fg.padEnd(18)} ${bg.padEnd(20)} ${a.padEnd(9)} ${b.padEnd(9)} ${r.toFixed(2).padStart(5)}:1 ${String(min).padStart(4)}  ${ok ? "PASS" : "FAIL"}`,
      );
    }
  }
  console.log(failed ? `contrast: ${failed} failing pair(s)` : "contrast ok");
  if (failed) process.exit(1);
}

main();
