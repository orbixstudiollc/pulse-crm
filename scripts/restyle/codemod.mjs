#!/usr/bin/env node
// Restyle codemod: rewrites Tailwind class tokens inside string and template
// literals to the semantic token vocabulary (styles/globals.css).
// Unknown colour tokens are LEFT UNCHANGED and reported; nothing is guessed.
//
//   node scripts/restyle/codemod.mjs <file...>   (paths under app/ or components/ only)
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const NEUTRALS = new Set(["neutral", "slate", "gray", "zinc", "stone"]);
const ROLE = {
  indigo: "accent", blue: "accent", sky: "accent", cyan: "accent", violet: "accent", purple: "accent", fuchsia: "accent",
  emerald: "success", green: "success", lime: "success", teal: "success",
  amber: "warning", yellow: "warning", orange: "warning",
  red: "danger", rose: "danger", pink: "danger",
};
const FAMILY_RE =
  /^(neutral|slate|gray|zinc|stone|indigo|blue|sky|cyan|violet|purple|fuchsia|emerald|green|lime|teal|amber|yellow|orange|red|rose|pink)-(\d{2,3})(?:\/(\d+))?$/;
const SEMANTIC = [
  "page", "surface", "subtle", "muted", "active", "sidebar", "inverse", "on-inverse", "line", "divider", "row",
  "fg", "fg-secondary", "fg-muted", "fg-disabled", "accent", "accent-strong", "accent-surface", "accent-on-surface",
  "success", "success-surface", "success-fill", "warning", "warning-surface", "danger", "danger-surface", "code",
  "chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-grid", "chart-axis", "background", "foreground",
];
const OTHER_COLOUR_RE = new RegExp(
  `^(?:white|black|transparent|current|inherit|(?:primary|success|warning|danger)-\\d{2,3}|${SEMANTIC.join("|")})(?:\\/\\d+)?$|^\\[(?:#|rgb|hsl|oklch|var\\(|color)`,
);
// Longest first so `border-t-x` resolves before `border-x`.
const COLOUR_UTILS = [
  "ring-offset", "border-t", "border-r", "border-b", "border-l", "border-x", "border-y", "border-s", "border-e",
  "border", "bg", "text", "ring", "divide", "placeholder", "from", "to", "via", "stroke", "fill", "outline",
  "decoration", "accent", "caret", "shadow",
];
const DARK_DELETABLE = new Set([
  "bg", "text", "border", "border-t", "border-r", "border-b", "border-l", "border-x", "border-y", "border-s", "border-e",
  "ring", "divide", "placeholder", "stroke", "fill", "from", "to", "via", "outline", "shadow", "accent",
]);

const EXACT = new Map([
  ["font-serif", "font-semibold"], ["font-bold", "font-semibold"], ["font-extrabold", "font-semibold"], ["font-black", "font-semibold"],
  ["text-[9px]", "text-xs"], ["text-[10px]", "text-xs"], ["text-[11px]", "text-xs"], ["text-[15px]", "text-sm"],
  ["text-[28px]", "text-xl"], ["text-3xl", "text-xl"], ["text-[32px]", "text-[22px]"],
  ["text-[40px]", "text-2xl"], ["text-4xl", "text-2xl"], ["text-5xl", "text-2xl"], ["text-6xl", "text-2xl"],
  ["border-2", "border"], ["border-t-2", "border-t"], ["border-r-2", "border-r"], ["border-b-2", "border-b"],
  ["border-l-2", "border-l"], ["border-x-2", "border-x"], ["border-y-2", "border-y"], ["border-[0.5px]", "border"],
  ["rounded-[12px]", "rounded-lg"],
]);
const DELETE = new Set([
  "font-onest", "leading-[36px]", "leading-[40px]", "leading-[48px]", "uppercase",
  "shadow-sm", "shadow-md", "shadow-lg", "shadow-xl", "shadow-2xl",
]);
const FULL_TOKEN = new Map([["lg:p-8", "lg:p-6"], ["lg:px-8", "lg:px-6"], ["lg:-mx-8", "lg:-mx-6"]]);
const BORDER_WIDTH = new Set(["border", "border-2", "border-[0.5px]"]);

const VARIANT_RE = /^(?:\[[^\]]*\]|[a-z0-9@*][\w@*-]*(?:-\[[^\]]*\])?(?:\/[\w-]+)?):/;

/** Split a class token into variant chain, important flags and utility. */
export function parseToken(tok) {
  const chain = [];
  let rest = tok;
  for (let m = rest.match(VARIANT_RE); m; m = rest.match(VARIANT_RE)) {
    chain.push(m[0].slice(0, -1));
    rest = rest.slice(m[0].length);
  }
  const lead = rest.startsWith("!");
  if (lead) rest = rest.slice(1);
  const trail = !lead && rest.endsWith("!");
  if (trail) rest = rest.slice(0, -1);
  return { chain, lead, trail, util: rest };
}

function build(chain, t, util) {
  return chain.map((v) => v + ":").join("") + (t.lead ? "!" : "") + util + (t.trail ? "!" : "");
}

const isColourValue = (v) => FAMILY_RE.test(v) || OTHER_COLOUR_RE.test(v);

/** Resolve `util` into { prop, value } when it is a colour utility, else null. */
export function colourOf(util) {
  for (const p of COLOUR_UTILS) {
    if (util.startsWith(p + "-") && isColourValue(util.slice(p.length + 1))) return { prop: p, value: util.slice(p.length + 1) };
  }
  return null;
}

const chainKey = (chain) => chain.filter((v) => v !== "dark").join(":");
const hasState = (chain, re) => chain.some((v) => re.test(v));
const HOVER = /(^|-)hover(\/|$)/;
const FOCUS = /^focus(-visible|-within)?$/;
const CHECKED = /(^|-)checked(\/|$)/;

/** Normalised property key used by ruling (a): placeholder-x behaves as placeholder:text-x. */
function propKey(chain, prop) {
  if (prop === "placeholder") return [...chain.filter((v) => v !== "dark"), "placeholder"].join(":") + "|text";
  return chainKey(chain) + "|" + prop;
}

function mapNeutral(chain, prop, fam, shade, alpha) {
  const a = alpha ? "/" + alpha : "";
  const s = Number(shade);
  const isBorder = prop === "border" || prop.startsWith("border-");
  if (prop === "bg") {
    if ((fam === "zinc" && s === 500 && alpha === "10") || (fam === "neutral" && s === 500 && alpha === "15") || (fam === "neutral" && s === 400 && alpha === "10")) return "bg-muted";
    if (hasState(chain, HOVER) && [50, 100].includes(s)) return "bg-muted" + a;
    if (hasState(chain, HOVER) && [200, 300].includes(s)) return "bg-active" + a;
    if (s === 50) return "bg-subtle" + a;
    if (s === 100) return "bg-muted" + a;
    if (s === 200 || s === 300) return "bg-active" + a;
    if (s === 400 || s === 500) return "bg-fg-muted" + a;
    if (s >= 700) return "bg-inverse" + a;
    return undefined;
  }
  if (prop === "text") {
    if (chain.includes("placeholder")) return "text-fg-muted";
    if (s >= 700) return "text-fg" + a;
    if (s === 600 || s === 500) return "text-fg-secondary" + a;
    if (s === 400) return "text-fg-muted" + a;
    if (s === 300 || s === 200) return "text-fg-disabled" + a;
    if (s === 100 || s === 50) return "text-on-inverse" + a;
    return undefined;
  }
  if (isBorder) {
    if (s === 500 && alpha === "30") return prop + "-line";
    if (hasState(chain, HOVER) && (s === 300 || s === 400)) return prop + "-fg-muted" + a;
    if (hasState(chain, FOCUS) && (s === 400 || s === 950)) return prop + "-accent" + a;
    if (s === 50 || s === 100) return prop + "-row" + a;
    if (s === 200 || s === 300) return prop + "-line" + a;
    if (s === 400) return prop + "-fg-muted" + a;
    if (s >= 600 && s <= 800) return prop + "-line" + a;
    if (s >= 900) return prop + "-inverse" + a;
    return undefined;
  }
  if (prop === "divide") return "divide-row";
  if (prop === "ring") return hasState(chain, HOVER) ? "ring-fg-muted" : "ring-line";
  if (prop === "stroke" || prop === "fill") return prop + "-chart-grid";
  if (prop === "accent" && s === 950) return "accent-accent";
  if (prop === "shadow" && s === 950) return null;
  return undefined;
}

function mapFamily(chain, prop, fam, shade, alpha, ctx) {
  const role = ROLE[fam];
  const s = Number(shade);
  const isBorder = prop === "border" || prop.startsWith("border-");
  const checked = hasState(chain, CHECKED);
  if (prop === "bg") {
    if (checked) return "bg-accent";
    if (alpha || [50, 100, 200].includes(s)) return `bg-${role}-surface`;
    if (s >= 500 && s <= 900) return role === "accent" ? "bg-accent-strong" : `bg-${role}`;
    return undefined;
  }
  if (prop === "text") {
    if (ctx.pillFamilies.has(fam)) return role === "accent" ? "text-accent-on-surface" : `text-${role}`;
    return role === "accent" ? "text-accent-strong" : `text-${role}`;
  }
  if (isBorder) return checked ? prop + "-accent" : `${prop}-${role}`;
  if (prop === "ring") return "ring-accent";
  if (prop === "stroke" && s === 500 && ["emerald", "amber", "red"].includes(fam)) return `stroke-${role}`;
  return undefined;
}

/**
 * Map one parsed token. Returns { value } (string = replacement, null = delete),
 * or { unmapped: true } for a colour token left alone, or {} for untouched.
 */
function mapToken(t, ctx, neighbours) {
  const bare = build([], { lead: false, trail: false }, t.util);
  const full = build(t.chain, { lead: false, trail: false }, t.util);
  if (FULL_TOKEN.has(full) && !t.lead && !t.trail) return { value: FULL_TOKEN.get(full) };
  if (EXACT.has(bare)) return { value: build(t.chain, t, EXACT.get(bare)) };
  if (DELETE.has(bare) || /^tracking-/.test(bare)) return { value: null };
  if (bare === "italic" && neighbours.some((n) => n && n.util === "font-serif" && chainKey(n.chain) === chainKey(t.chain))) return { value: null };
  if (t.chain.length === 0 && ctx.card && (bare === "p-5" || bare === "p-6")) return { value: build([], t, "p-4") };

  const c = colourOf(t.util);
  if (!c) return {};
  const isDark = t.chain.includes("dark");
  if (isDark) {
    if (!DARK_DELETABLE.has(c.prop)) return FAMILY_RE.test(c.value) ? { unmapped: true } : {};
    return ctx.lightKeys.has(propKey(t.chain, c.prop)) ? { value: null } : { orphan: true };
  }
  const white = c.value.match(/^white(?:\/(\d+))?$/);
  if (white) {
    const a = white[1] ? "/" + white[1] : "";
    if (c.prop === "bg") return { value: build(t.chain, t, "bg-surface" + a) };
    if (c.prop === "text" && (ctx.filled || ctx.inverseChains.has(chainKey(t.chain)))) return { value: build(t.chain, t, "text-on-inverse" + a) };
    return {};
  }
  const m = c.value.match(FAMILY_RE);
  if (!m) return {};
  const [, fam, shade, alpha] = m;
  if (c.prop === "placeholder") {
    return NEUTRALS.has(fam) ? { value: build([...t.chain, "placeholder"], t, "text-fg-muted") } : { unmapped: true };
  }
  const out = NEUTRALS.has(fam) ? mapNeutral(t.chain, c.prop, fam, shade, alpha) : mapFamily(t.chain, c.prop, fam, shade, alpha, ctx);
  if (out === undefined) return { unmapped: true };
  return { value: out === null ? null : build(t.chain, t, out) };
}

// Rule (h): a filled background makes `text-white` -> `text-on-inverse`. Judged on the
// post-mapping value so pass 1 and pass 2 agree (e.g. bg-neutral-900 -> bg-inverse).
const FILLED = /^bg-(accent-strong|danger|success|warning|inverse)$/;
function filledBg(chain, value) {
  const m = value.match(FAMILY_RE);
  if (!m) return "bg-" + value;
  const [, fam, shade, alpha] = m;
  const out = NEUTRALS.has(fam) ? mapNeutral(chain, "bg", fam, shade, alpha) : mapFamily(chain, "bg", fam, shade, alpha, null);
  return out || "";
}

function contextOf(parsed) {
  const ctx = { lightKeys: new Set(), inverseChains: new Set(), pillFamilies: new Set(), card: false, filled: false };
  let border = false;
  let rounded = false;
  for (const t of parsed) {
    if (!t) continue;
    const c = colourOf(t.util);
    const dark = t.chain.includes("dark");
    if (c && !dark) ctx.lightKeys.add(propKey(t.chain, c.prop));
    if (c && dark && c.prop === "text" && /^(neutral|slate|gray|zinc|stone)-9\d\d$/.test(c.value)) ctx.inverseChains.add(chainKey(t.chain));
    if (c && !dark && c.prop === "bg" && FILLED.test(filledBg(t.chain, c.value))) ctx.filled = true;
    if (c && !dark && t.chain.length === 0 && c.prop === "bg") {
      const m = c.value.match(/^([a-z]+)-(50|100)$/);
      if (m && ROLE[m[1]]) ctx.pillFamilies.add(m[1]);
    }
    if (t.chain.length === 0 && BORDER_WIDTH.has(t.util)) border = true;
    if (t.chain.length === 0 && t.util.startsWith("rounded-")) rounded = true;
  }
  ctx.card = border && rounded;
  return ctx;
}

/** Find every string / template literal: [{ chunks: [{start,end}], start }]. */
export function collectLiterals(src, fileName = "input.tsx") {
  const kind = /\.tsx$/.test(fileName) ? ts.ScriptKind.TSX : /\.(m?js|jsx)$/.test(fileName) ? ts.ScriptKind.JSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(fileName, src, ts.ScriptTarget.Latest, true, kind);
  const out = [];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) return;
    if (ts.isJsxAttribute(node) && node.name.getText(sf) === "style") return;
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      out.push({ chunks: [{ start: node.getStart(sf) + 1, end: node.end - 1 }], start: node.getStart(sf) });
      return;
    }
    if (ts.isTemplateExpression(node)) {
      const chunks = [{ start: node.head.getStart(sf) + 1, end: node.head.end - 2 }];
      for (const span of node.templateSpans) {
        visit(span.expression);
        const lit = span.literal;
        chunks.push({ start: lit.getStart(sf) + 1, end: lit.end - (ts.isTemplateTail(lit) ? 1 : 2) });
      }
      out.push({ chunks, start: node.getStart(sf) });
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

/** Split a literal into per-chunk items; tokens touching `${`/`}` are partial. */
export function tokenize(src, lit) {
  return lit.chunks.map((ch, ci) => {
    const text = src.slice(ch.start, ch.end);
    const items = (text.match(/\s+|\S+/g) || []).map((s) => ({ ws: /^\s/.test(s), text: s }));
    items.forEach((it, i) => {
      if (it.ws) return;
      it.partial = (i === 0 && ci > 0) || (i === items.length - 1 && ci < lit.chunks.length - 1);
    });
    return { ...ch, items };
  });
}

function rebuild(items) {
  const out = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.ws) { out.push({ ws: true, text: it.text }); continue; }
    if (it.value === undefined) { out.push({ ws: false, text: it.text }); continue; }
    if (it.value !== null) { out.push({ ws: false, text: it.value }); continue; }
    const prev = out.length && out[out.length - 1].ws ? out.pop().text : "";
    const next = items[i + 1] && items[i + 1].ws ? items[++i].text : "";
    const merged = prev === "" || next === "" ? "" : prev.includes("\n") || !next.includes("\n") ? prev : next;
    if (merged) out.push({ ws: true, text: merged });
  }
  return out.map((o) => o.text).join("");
}

/**
 * Rewrite class tokens in every string/template literal of `src`.
 * Pure and idempotent. `orphans` lists class strings whose dark: colour
 * tokens were kept because no light token with the same chain+property exists.
 */
export function rewriteClasses(src, fileName = "input.tsx") {
  const edits = [];
  const unmapped = new Map();
  const orphans = [];
  let changed = 0;
  for (const lit of collectLiterals(src, fileName)) {
    const chunks = tokenize(src, lit);
    const toks = chunks.flatMap((ch) => ch.items.filter((it) => !it.ws));
    const parsed = toks.map((it) => (it.partial ? null : parseToken(it.text)));
    const ctx = contextOf(parsed);
    let orphan = false;
    toks.forEach((it, i) => {
      if (!parsed[i]) return;
      const r = mapToken(parsed[i], ctx, [parsed[i - 1], parsed[i + 1]]);
      if (r.unmapped) unmapped.set(it.text, (unmapped.get(it.text) || 0) + 1);
      if (r.orphan) orphan = true;
      if ("value" in r && r.value !== it.text) it.value = r.value;
    });
    // Drop produced tokens that duplicate another token of the same class string.
    const kept = new Set(toks.filter((it) => it.value === undefined).map((it) => it.text));
    for (const it of toks) {
      if (typeof it.value !== "string") continue;
      if (kept.has(it.value)) it.value = null;
      else kept.add(it.value);
    }
    if (orphan) orphans.push({ start: lit.start, text: src.slice(lit.chunks[0].start, lit.chunks[lit.chunks.length - 1].end) });
    for (const ch of chunks) {
      const n = ch.items.filter((it) => !it.ws && it.value !== undefined).length;
      if (!n) continue;
      changed += n;
      edits.push({ start: ch.start, end: ch.end, text: rebuild(ch.items) });
    }
  }
  let out = src;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return { out, changed, unmapped, orphans };
}

function lineOf(src, pos) {
  let n = 1;
  for (let i = 0; i < pos; i++) if (src.charCodeAt(i) === 10) n++;
  return n;
}

function main(argv) {
  const files = argv.slice(2);
  const refused = files.filter((f) => !/^(app|components)\//.test(path.relative(process.cwd(), path.resolve(f)).split(path.sep).join("/")));
  if (refused.length) {
    for (const f of refused) process.stderr.write(`${f}: refused (only paths under app/ or components/ are rewritten)\n`);
    process.exit(2);
  }
  for (const f of files) {
    const src = fs.readFileSync(f, "utf8");
    const r = rewriteClasses(src, f);
    if (r.out !== src) fs.writeFileSync(f, r.out);
    process.stdout.write(`${f}: ${r.changed} tokens changed\n`);
    for (const [tok, n] of r.unmapped) process.stderr.write(`${f}: unmapped ${tok} x${n}\n`);
    for (const o of r.orphans) process.stderr.write(`${f}:${lineOf(src, o.start)}: orphan-dark "${o.text.replace(/\s+/g, " ").trim()}"\n`);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv);
