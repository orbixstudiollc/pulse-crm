#!/usr/bin/env node
// Prints the user-visible text of a TSX file in DOCUMENT ORDER, one per line,
// with no sorting and no de-duplication: every JSX text node (whitespace
// collapsed, must contain a letter) and the string values of the attributes
// below, plus string literals rendered as JSX children. Compare before/after
// output to prove a restyle changed no text.
//   node scripts/restyle/jsxtext.mjs <file>      or      ... | node scripts/restyle/jsxtext.mjs -
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const ATTRS = new Set([
  "title", "label", "description", "placeholder", "aria-label", "itemLabel", "searchPlaceholder",
  "name", "heading", "subtitle", "emptyTitle", "emptyDescription",
]);

function stringValue(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isJsxExpression(node)) return stringValue(node.expression);
  return null;
}

// String literals rendered as a JSX child: `{"x"}`, `{a ? "x" : "y"}`, `{a && "x"}`.
function childStrings(node, out) {
  if (!node) return;
  if (ts.isParenthesizedExpression(node)) return childStrings(node.expression, out);
  if (ts.isConditionalExpression(node)) {
    childStrings(node.whenTrue, out);
    childStrings(node.whenFalse, out);
    return;
  }
  if (ts.isBinaryExpression(node) && ["&&", "||", "??"].includes(node.operatorToken.getText())) {
    childStrings(node.right, out);
    return;
  }
  const v = stringValue(node);
  if (v !== null && /[A-Za-z]/.test(v)) out.push(v.replace(/\s+/g, " ").trim());
}

export function jsxText(src) {
  const sf = ts.createSourceFile("input.tsx", src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const out = [];
  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const text = node.getText(sf).replace(/\s+/g, " ").trim();
      if (/[A-Za-z]/.test(text)) out.push(text);
    } else if (ts.isJsxExpression(node) && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
      childStrings(node.expression, out);
    } else if (ts.isJsxAttribute(node) && ATTRS.has(node.name.getText(sf))) {
      const v = stringValue(node.initializer);
      if (v !== null) out.push(v);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return out;
}

function main(arg) {
  const src = !arg || arg === "-" ? fs.readFileSync(0, "utf8") : fs.readFileSync(arg, "utf8");
  for (const line of jsxText(src)) process.stdout.write(line + "\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv[2]);
