#!/usr/bin/env node
// Restyle scan: flags class vocabulary the restyle forbids.
//   node scripts/restyle/scan.mjs <root-or-file...>
// Prints `file:line: <rule>: <token>`; exit 1 on any violation, else `scan ok (<n> files)`.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { collectLiterals, tokenize, parseToken } from "./codemod.mjs";

const HEX_BUDGET = {
  "lib/design-system/palette-data.ts": 22,
  "components/postpeer/PlatformIcon.tsx": 13,
  "app/dashboard/icp/client.tsx": 13,
  "app/dashboard/icp/[id]/client.tsx": 12,
  "app/dashboard/campaigns/client.tsx": 10,
};
const FAMILIES = "indigo|violet|lime|emerald|blue|green|amber|red|orange|purple|sky|teal|cyan|pink|rose|yellow|fuchsia|slate|gray|zinc|stone";
const TOKEN_RULES = [
  ["FORBIDDEN_FAMILY", new RegExp(`^!?(bg|text|border(-[trblxyse])?|ring|divide|placeholder|from|to|via|stroke|fill|outline|decoration|accent|caret|shadow)-(${FAMILIES})-\\d{2,3}`)],
  ["BG_WHITE", /^!?bg-white(\/\d+)?!?$/],
  ["NEUTRAL_SHADE", /neutral-(300|400|600|700|800|950)(?!\d)/],
  ["FONT", /^!?font-(serif|onest)!?$/],
  ["SIZE", /^!?(text-(\[(9|10|11|15|28|32|40)px\]|[3-9]xl)|leading-\[(36|40|48)px\])!?$/],
  ["SHADOW", /^!?shadow-(sm|md|lg|xl|2xl)!?$/],
  ["BORDER2", /^!?border(-[trblxy])?-(2|\[0\.5px\])!?$/],
  ["GRADIENT", /^!?(bg-gradient-|from-\w+-\d|to-\w+-\d|via-\w+-\d)/],
  ["ARBITRARY_HEX", /^!?(bg|text|border|from|to|via)-\[#/],
];
const DARK_COLOUR = /^!?(bg|text|border|ring|divide|placeholder|stroke|fill)-/;
const HEX_RE = /(?<![\w&])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})\b/g;

function listFiles(target) {
  const st = fs.statSync(target);
  if (st.isFile()) return [target];
  return fs.readdirSync(target, { withFileTypes: true }).flatMap((e) => {
    if (["node_modules", ".next", ".git"].includes(e.name)) return [];
    return listFiles(path.join(target, e.name));
  });
}

const rel = (f) => path.relative(process.cwd(), path.resolve(f)).split(path.sep).join("/");
const skip = (r) => !/\.tsx?$/.test(r) || /\.test\.ts$/.test(r) || /(^|\/)app\/api\//.test(r);

function lineStarts(src) {
  const starts = [0];
  for (let i = 0; i < src.length; i++) if (src.charCodeAt(i) === 10) starts.push(i + 1);
  return (pos) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= pos) lo = mid; else hi = mid - 1;
    }
    return lo + 1;
  };
}

// Nearest enclosing element (walking tags backwards, skipping closed siblings)
// that carries a className, within the 6 lines before the <table.
function enclosingClass(lines, i, at) {
  let depth = 0;
  for (let j = i; j >= Math.max(0, i - 6); j--) {
    const text = j === i ? lines[i].slice(0, at) : lines[j];
    for (const t of [...text.matchAll(/<\/?[A-Za-z][\w.]*|\/>/g)].reverse()) {
      if (t[0] === "/>" || t[0].startsWith("</")) { depth++; continue; }
      if (depth > 0) { depth--; continue; }
      const rest = [text.slice(t.index), ...lines.slice(j + 1, i), lines[i].slice(0, at)].slice(0, i - j + 1).join("\n");
      const end = rest.search(/(?<!=)>/);
      const tag = end < 0 ? rest : rest.slice(0, end);
      if (/className=/.test(tag)) return tag;
    }
  }
  return null;
}

function tableScroll(lines, report) {
  lines.forEach((ln, i) => {
    const at = ln.search(/<table\b/);
    if (at < 0) return;
    const tag = enclosingClass(lines, i, at);
    if (!tag || !/overflow-x-auto/.test(tag)) report(i + 1, "TABLE_SCROLL", "<table");
  });
}

export function scanFile(file, src) {
  const out = [];
  const report = (line, rule, token) => out.push({ file, line, rule, token });
  const lineOf = lineStarts(src);
  const shades = new Map();
  for (const lit of collectLiterals(src, file)) {
    const toks = tokenize(src, lit).flatMap((ch) => {
      let pos = ch.start;
      return ch.items.map((it) => ({ ...it, pos: (pos += it.text.length) - it.text.length })).filter((it) => !it.ws);
    });
    const texts = toks.map((t) => t.text);
    const muted = texts.includes("text-fg-muted") && texts.some((t) => /^text-(sm|base)$/.test(t)) && !texts.some((t) => t.includes("placeholder:"));
    for (const t of toks) {
      const line = lineOf(t.pos);
      const p = parseToken(t.text);
      for (const [rule, re] of TOKEN_RULES) if (re.test(rule === "NEUTRAL_SHADE" ? t.text : p.util)) report(line, rule, t.text);
      if (p.chain.includes("dark") && DARK_COLOUR.test(p.util)) report(line, "DARK_COLOUR", t.text);
      if (muted && t.text === "text-fg-muted") report(line, "MUTED_BODY", t.text);
      for (const m of t.text.matchAll(/neutral-(\d{2,3})(?!\d)/g)) if (!shades.has(m[1])) shades.set(m[1], line);
    }
  }
  if (shades.size > 5) report(Math.min(...shades.values()), "NEUTRAL_COUNT", [...shades.keys()].sort((a, b) => a - b).join(","));
  tableScroll(src.split("\n"), report);
  const hex = [...src.matchAll(HEX_RE)];
  const budget = HEX_BUDGET[file] ?? 0;
  if (hex.length > budget) for (const m of hex) report(lineOf(m.index), "HEX", `${m[0]} (${hex.length}/${budget})`);
  return out.sort((a, b) => a.line - b.line);
}

function main(argv) {
  const files = [...new Set(argv.slice(2).flatMap(listFiles).map(rel))].filter((f) => !skip(f));
  let n = 0;
  for (const f of files) {
    for (const v of scanFile(f, fs.readFileSync(f, "utf8"))) {
      n++;
      process.stdout.write(`${v.file}:${v.line}: ${v.rule}: ${v.token}\n`);
    }
  }
  if (n) process.exit(1);
  process.stdout.write(`scan ok (${files.length} files)\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv);
