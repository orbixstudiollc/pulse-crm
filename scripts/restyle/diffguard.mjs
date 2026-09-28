#!/usr/bin/env node
// Diff-line guard: proves a restyle changed only presentation.
//   node scripts/restyle/diffguard.mjs <base-rev> <file...>
// Runs `git diff -U0 <base> -- <file>` and fails (exit 1) if any +/- line is not one of:
//   - a line containing className | class= | cn( | clsx(
//     (or a line inside a multi-line className attribute / cn|clsx|twMerge call)
//   - a string-literal line whose literals consist only of class tokens (status/colour maps)
//   - a Recharts colour prop line (stroke|fill|stopColor|contentStyle|tick=|activeDot|cursor=)
//   - an import from @/lib/design-system/chart-colors or @/components/ui (single or multi-line)
//   - a `style={{ ... }}` line whose only change is a colour value
//   - a `transition={{` line
//   - any line inside a multi-line `style={{ ... }}` / `contentStyle={{ ... }}` object
//   - a colour-map entry line (`key: "#hex" | chartSeries[n] | chartX | "var(--x)",`)
//   - a palette const array of only hex / chartSeries[n] / "var(--x)" elements, the blank
//     line right after such a removed array, and a `...chartTooltipStyle,` line
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const SINGLE = new Set([
  "flex", "grid", "block", "inline", "hidden", "contents", "table", "relative", "absolute", "fixed", "sticky", "static",
  "border", "rounded", "shadow", "italic", "uppercase", "lowercase", "capitalize", "truncate", "underline", "transition",
  "grow", "shrink", "container", "invisible", "visible", "isolate", "antialiased", "outline", "ring", "peer", "group",
  "resize", "collapse",
]);
const TOKEN_RE =
  /^!?(?:(?:\[[^\]]*\]|[a-z0-9@*][\w@*-]*(?:-\[[^\]]*\])?(?:\/[\w-]+)?):)*!?-?[a-z][\w.\/%-]*(?:\[[^\]]*\][\w.\/%-]*)?!?$/;
const LITERAL_RE = /(["'`])((?:(?!\1)[^\\]|\\.)*)\1/g;
const COLOUR_RE = /#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)|hsla?\([^)]*\)|var\(--[\w-]+\)/g;
const COLOUR_MAP_RE =
  /^\s*[\w"'-]+\s*:\s*("#[0-9a-fA-F]{3,8}"|'#[0-9a-fA-F]{3,8}'|chartSeries\[\d+\]|chart[A-Z]\w*|"var\(--[\w-]+\)"),?\s*$/;
const PALETTE_START_RE = /^\s*(export\s+)?const\s+\w+\s*=\s*\[/;
const PALETTE_ELEMENT_RE = /^("#[0-9a-fA-F]{3,8}"|'#[0-9a-fA-F]{3,8}'|chartSeries\[\d+\]|"var\(--[\w-]+\)"|'var\(--[\w-]+\)')$/;
const IMPORT_RE = /\bfrom\s*["'](@\/lib\/design-system\/chart-colors|@\/components\/ui(?:\/[\w./-]*)?)["']/;

const isClassToken = (t) => TOKEN_RE.test(t) && (/[-:[]/.test(t) || SINGLE.has(t));
const isClassString = (s) => {
  const toks = s.split(/\s+/).filter(Boolean);
  return toks.length > 0 && toks.every(isClassToken);
};

function classLiteralLine(s) {
  const lits = [...s.matchAll(LITERAL_RE)];
  if (!lits.length || !lits.every((m) => isClassString(m[2]))) return false;
  return /^[\s\w$.?:&|!=,()[\]{};]*$/.test(s.replace(LITERAL_RE, ""));
}

function lineAllowed(s) {
  return (
    /className|class=|\bcn\(|\bclsx\(/.test(s) ||
    classLiteralLine(s) ||
    /\b(stroke|fill|stopColor|contentStyle|tick|activeDot|cursor)\s*[=:]/.test(s) ||
    (/^\s*import\b/.test(s) && IMPORT_RE.test(s)) ||
    /transition=\{\{/.test(s) ||
    COLOUR_MAP_RE.test(s) ||
    /^\s*\.\.\.chartTooltipStyle,\s*$/.test(s)
  );
}

/**
 * Line numbers (1-based) covered by class contexts, allowed imports, multi-line
 * style/contentStyle objects and palette arrays in `src`; `lines.paletteEnds`
 * holds the last line of each palette array.
 */
function contextLines(src, file) {
  const lines = new Set();
  lines.paletteEnds = new Set();
  if (!src) return lines;
  const srcLines = src.split("\n");
  const kind = file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS;
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, kind);
  const span = (node) => [
    sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
    sf.getLineAndCharacterOfPosition(node.end).line + 1,
  ];
  const mark = (node) => {
    const [a, b] = span(node);
    for (let l = a; l <= b; l++) lines.add(l);
  };
  const unwrap = (e) => (e && (ts.isAsExpression(e) || ts.isSatisfiesExpression(e)) ? unwrap(e.expression) : e);
  const isPalette = (node) => {
    if (!ts.isVariableStatement(node) || node.declarationList.declarations.length !== 1) return false;
    const init = unwrap(node.declarationList.declarations[0].initializer);
    if (!init || !ts.isArrayLiteralExpression(init) || !init.elements.length) return false;
    if (!PALETTE_START_RE.test(srcLines[span(node)[0] - 1])) return false;
    return init.elements.every((el) => PALETTE_ELEMENT_RE.test(el.getText(sf)));
  };
  const isMultiLineStyle = (node) =>
    ts.isJsxAttribute(node) &&
    /^(style|contentStyle)$/.test(node.name.getText(sf)) &&
    node.initializer &&
    ts.isJsxExpression(node.initializer) &&
    node.initializer.expression &&
    ts.isObjectLiteralExpression(node.initializer.expression) &&
    span(node)[0] !== span(node)[1];
  const visit = (node) => {
    if (ts.isImportDeclaration(node) && IMPORT_RE.test(node.getText(sf))) mark(node);
    else if (isPalette(node)) {
      mark(node);
      lines.paletteEnds.add(span(node)[1]);
    } else if (isMultiLineStyle(node)) mark(node);
    else if (ts.isJsxAttribute(node) && /^(className|class)$/.test(node.name.getText(sf))) mark(node);
    else if (ts.isCallExpression(node) && /^(cn|clsx|twMerge)$/.test(node.expression.getText(sf))) mark(node);
    else if (ts.isNoSubstitutionTemplateLiteral(node) || ts.isStringLiteral(node)) {
      if (isClassString(node.text)) mark(node);
    } else if (ts.isTemplateExpression(node)) {
      const parts = [node.head.text, ...node.templateSpans.map((s) => s.literal.text)].join(" ");
      if (isClassString(parts)) mark(node);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return lines;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] });
}

/** Check a `git diff -U0` of `file` against both versions; returns the offending lines. */
export function checkDiff(file, diff, baseSrc, curSrc) {
  const ctx = { "-": contextLines(baseSrc, file), "+": contextLines(curSrc, file) };
  const bad = [];
  let hunk = null;
  const flush = () => {
    if (!hunk) return;
    const norm = (s) => s.replace(COLOUR_RE, "COLOUR");
    for (const [sign, other] of [["-", "+"], ["+", "-"]]) {
      for (const { n, s } of hunk[sign]) {
        if (lineAllowed(s) || ctx[sign].has(n)) continue;
        if (sign === "-" && s.trim() === "" && ctx["-"].paletteEnds.has(n - 1)) continue;
        if (/style=\{\{/.test(s) && hunk[other].some((o) => norm(o.s) === norm(s))) continue;
        bad.push(`${file}:${sign}${n}: ${s}`);
      }
    }
  };
  for (const line of diff.split("\n")) {
    const h = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (h) {
      flush();
      hunk = { "-": [], "+": [], next: { "-": Number(h[1]), "+": Number(h[2]) } };
      continue;
    }
    if (!hunk || line.startsWith("+++") || line.startsWith("---")) continue;
    const sign = line[0];
    if (sign !== "+" && sign !== "-") continue;
    hunk[sign].push({ n: hunk.next[sign]++, s: line.slice(1) });
  }
  flush();
  return bad;
}

function checkFile(base, file) {
  const diff = git(["diff", "-U0", "--no-color", base, "--", file]);
  let baseSrc = "";
  try {
    baseSrc = git(["show", `${base}:./${file.replace(/\\/g, "/")}`]);
  } catch {
    baseSrc = "";
  }
  const curSrc = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
  return checkDiff(file, diff, baseSrc, curSrc);
}

function main(argv) {
  const [base, ...files] = argv.slice(2);
  if (!base || !files.length) {
    process.stderr.write("usage: node scripts/restyle/diffguard.mjs <base-rev> <file...>\n");
    process.exit(2);
  }
  let bad = [];
  try {
    for (const f of files) bad = bad.concat(checkFile(base, f));
  } catch (e) {
    process.stderr.write(`diffguard: ${e.stderr || e.message}\n`);
    process.exit(2);
  }
  for (const b of bad) process.stdout.write(b + "\n");
  if (bad.length) process.exit(1);
  process.stdout.write(`diffguard ok (${files.length} files)\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv);
