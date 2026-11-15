#!/usr/bin/env node
// node tools/outline.mjs <file.md>         -> compact heading list with line ranges
// node tools/outline.mjs <file.md> --json  -> the JSON stored in .outline/
// node tools/outline.mjs --all             -> regenerate .outline/<name>.json for kb/ spec/ doc/
import fs from 'node:fs';
import path from 'node:path';
import { readHeadings, outlineJson } from './lib/md.mjs';

const args = process.argv.slice(2);

if (args[0] === '--all') {
  fs.mkdirSync('.outline', { recursive: true });
  let n = 0;
  for (const dir of ['kb', 'spec', 'doc']) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) {
      const rel = `${dir}/${f}`;
      const { headings } = readHeadings(rel);
      fs.writeFileSync(path.join('.outline', `${f}.json`), outlineJson(rel, headings));
      n++;
    }
  }
  console.log(`outline: wrote ${n} files to .outline/`);
} else if (args[0]) {
  const { headings } = readHeadings(args[0]);
  if (args[1] === '--json') process.stdout.write(outlineJson(args[0], headings));
  else for (const h of headings) console.log(`${'#'.repeat(h.level)} ${h.text}  [${h.start}-${h.end}]`);
} else {
  console.error('usage: node tools/outline.mjs <file.md> [--json] | --all');
  process.exit(2);
}
