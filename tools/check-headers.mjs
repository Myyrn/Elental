#!/usr/bin/env node
// Fails (exit 1) on: kb file missing Data Structures / Rules / Cross-references / Status; duplicate headings in one file;
// stale or missing .outline/; a tracked kb section without a Rev line; a Sync line without a kb section; a synced rev above its kb rev.
// Run `node tools/outline.mjs --all` first when .outline/ is stale.
import fs from 'node:fs';
import { readHeadings, outlineJson, statusEntries, trackedSections } from './lib/md.mjs';

const errors = [];
const err = (m) => errors.push(m);
const REQUIRED = ['Data Structures', 'Rules', 'Cross-references', 'Status'];
const files = [];
for (const dir of ['kb', 'spec', 'doc']) {
  if (!fs.existsSync(dir)) continue;
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.md'))) files.push({ dir, f, rel: `${dir}/${f}` });
}

for (const { dir, f, rel } of files) {
  const text = fs.readFileSync(rel, 'utf8');
  const { headings } = readHeadings(rel);
  const seen = new Set();
  for (const h of headings) {
    if (seen.has(h.path)) err(`${rel}: duplicate heading "${h.path}"`);
    seen.add(h.path);
  }
  const out = `.outline/${f}.json`;
  if (!fs.existsSync(out)) err(`${rel}: missing ${out}`);
  else if (fs.readFileSync(out, 'utf8') !== outlineJson(rel, headings)) err(`${rel}: stale ${out}`);
  if (dir === 'kb' && f !== 'cross_module_notes__kb.md') {
    const tops = new Set(headings.filter((h) => h.level === 2).map((h) => h.text.toLowerCase()));
    for (const r of REQUIRED) if (!tops.has(r.toLowerCase())) err(`${rel}: missing section "${r}"`);
    const revs = (statusEntries(text) || []).filter((e) => !e.hasSlash);
    if (revs.length) {
      const have = new Set(revs.map((e) => e.path));
      for (const t of trackedSections(headings)) if (!have.has(t)) err(`${rel}: tracked section "${t}" has no Rev line`);
    }
  }
}

for (const { dir, f, rel } of files.filter((x) => x.dir === 'spec')) {
  const kbRel = `kb/${f.replace('__spec.md', '__kb.md')}`;
  if (!fs.existsSync(kbRel)) continue;
  const syncs = (statusEntries(fs.readFileSync(rel, 'utf8')) || []).filter((e) => e.hasSlash);
  if (!syncs.length) continue;
  const revs = new Map((statusEntries(fs.readFileSync(kbRel, 'utf8')) || []).filter((e) => !e.hasSlash).map((e) => [e.path, e.kb]));
  for (const s of syncs) {
    if (!revs.has(s.path)) err(`${rel}: Sync line "${s.path}" has no kb section`);
    else if (s.kb > revs.get(s.path)) err(`${rel}: "${s.path}" synced rev ${s.kb} exceeds kb rev ${revs.get(s.path)}`);
  }
}

if (errors.length) { console.error(errors.join('\n')); console.error(`check-headers: ${errors.length} problem(s)`); process.exit(1); }
console.log(`check-headers: ok (${files.length} files)`);
