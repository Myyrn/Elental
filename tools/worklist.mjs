#!/usr/bin/env node
// kb <-> spec <-> code work list, from the kb `Rev:` and spec `Sync:` lists only (no section bodies).
//   node tools/worklist.mjs                 full list, all modules
//   node tools/worklist.mjs --summary       counts per module
//   node tools/worklist.mjs --module war    one module
//   node tools/worklist.mjs --stage code    only spec|code items
// Rules (index.md, KB <-> Spec continuity):
//   kb rev > synced rev -> revise spec | in Rev but not Sync -> write spec | in Sync but not Rev -> orphan
//   synced rev > code rev (or code `-`) -> code + tests
import fs from 'node:fs';
import { statusEntries } from './lib/md.mjs';

const argv = process.argv.slice(2);
const opt = (name) => { const i = argv.indexOf(name); return i >= 0 ? argv[i + 1] : null; };
const onlyModule = opt('--module');
const stage = opt('--stage');
const summary = argv.includes('--summary');

const mods = fs.readdirSync('kb').filter((f) => f.endsWith('__kb.md')).map((f) => f.replace('__kb.md', '')).sort();
let total = 0;
for (const m of mods) {
  if (onlyModule && m !== onlyModule) continue;
  const kbEntries = statusEntries(fs.readFileSync(`kb/${m}__kb.md`, 'utf8'));
  const revs = (kbEntries || []).filter((e) => !e.hasSlash);
  if (!revs.length) { console.log(`${m}: no Rev block in kb Status (skipped)`); continue; }
  const specFile = `spec/${m}__spec.md`;
  const syncs = fs.existsSync(specFile) ? (statusEntries(fs.readFileSync(specFile, 'utf8')) || []).filter((e) => e.hasSlash) : [];
  const sync = new Map(syncs.map((e) => [e.path, e]));
  const rev = new Map(revs.map((e) => [e.path, e.kb]));
  const items = [];
  for (const [p, r] of rev) {
    const s = sync.get(p);
    if (!s) items.push(['spec', 'write ', `${p} (kb ${r})`]);
    else if (r > s.kb) items.push(['spec', 'revise', `${p} (kb ${r} > synced ${s.kb})`]);
    else if (s.kb > r) items.push(['spec', 'ERROR ', `${p} (synced ${s.kb} exceeds kb ${r})`]);
    else if (s.code === null || s.code < r) items.push(['code', 'build ', `${p} (rev ${r}, code ${s.code === null ? '-' : s.code})`]);
  }
  for (const p of sync.keys()) if (!rev.has(p)) items.push(['spec', 'orphan', p]);
  const shown = stage ? items.filter((i) => i[0] === stage) : items;
  total += shown.length;
  if (summary) {
    const c = (k) => items.filter((i) => i[0] === k).length;
    console.log(`${m}: tracked ${rev.size}, spec work ${c('spec')}, code work ${c('code')}`);
  } else if (shown.length) {
    console.log(`${m}:`);
    for (const [st, kind, text] of shown) console.log(`  ${st}  ${kind}  ${text}`);
  }
}
console.log(`-- ${total} item(s)`);
