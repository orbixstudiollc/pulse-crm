#!/usr/bin/env node
// Clay layout check: lists boxed containers (rounded-lg/xl + border) left in page code.
//   node scripts/restyle/boxes.mjs <file...>
// A box that Clay keeps (kanban card, picker option, quick-action tile) opts out with a
// `data-clay-box` attribute on the same line. Exit 1 when any unmarked box remains.
import fs from "node:fs";

const BOX = /\brounded-(lg|xl|2xl)\b[^"'`]*\bborder\b(?!-)|\bborder\b(?!-)[^"'`]*\brounded-(lg|xl|2xl)\b/;
const files = process.argv.slice(2);
if (files.length === 0) {
  console.error("usage: boxes.mjs <file...>");
  process.exit(2);
}

let hits = 0;
for (const file of files) {
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    if (BOX.test(line) && !line.includes("data-clay-box")) {
      hits++;
      console.log(`${file}:${i + 1}: ${line.trim().slice(0, 140)}`);
    }
  });
}
console.log(hits === 0 ? `boxes ok (${files.length} files)` : `${hits} boxed container(s) left`);
process.exit(hits === 0 ? 0 : 1);
