#!/usr/bin/env node
// node tools/section.mjs <file.md> "Rules"
// node tools/section.mjs <file.md> "Data Structures > Occupation"
// Case-insensitive match on heading text; a section runs to the next heading of the same or higher level.
import { readHeadings } from './lib/md.mjs';

const [file, query] = process.argv.slice(2);
if (!file || !query) {
  console.error('usage: node tools/section.mjs <file.md> "<heading or Parent > Child>"');
  process.exit(2);
}
const q = query.split('>').map((s) => s.trim().toLowerCase()).join(' > ');
const { lines, headings } = readHeadings(file);
let hits = headings.filter((h) => h.path.toLowerCase() === q);
if (!hits.length) hits = headings.filter((h) => h.path.toLowerCase().endsWith(' > ' + q) || h.text.toLowerCase() === q);
if (!hits.length) hits = headings.filter((h) => h.path.toLowerCase().startsWith(q));
if (hits.length !== 1) {
  console.error(hits.length ? `ambiguous (${hits.length}):` : 'no match; headings:');
  for (const h of hits.length ? hits : headings) console.error(`  ${h.path}  [${h.start}-${h.end}]`);
  process.exit(1);
}
const h = hits[0];
console.log(`<!-- ${file} ${h.path} [${h.start}-${h.end}] -->`);
console.log(lines.slice(h.start - 1, h.end).join('\n'));
