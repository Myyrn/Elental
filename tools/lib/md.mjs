// Shared markdown helpers for tools/outline.mjs, section.mjs, worklist.mjs, check-headers.mjs.
// Headings inside code fences are ignored. Line numbers are 1-based.
// `path` = heading path WITHOUT the level-1 title, e.g. "Data Structures > Grid".
import fs from 'node:fs';

export function parseHeadings(text) {
  const lines = text.split(/\r?\n/);
  const hs = [];
  let fence = null;
  lines.forEach((ln, i) => {
    const f = ln.match(/^\s*(```+|~~~+)/);
    if (f) {
      if (!fence) fence = f[1][0];
      else if (f[1][0] === fence) fence = null;
      return;
    }
    if (fence) return;
    const m = ln.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (m) hs.push({ level: m[1].length, text: m[2].trim(), start: i + 1 });
  });
  const stack = [];
  hs.forEach((h, i) => {
    h.end = lines.length;
    for (let j = i + 1; j < hs.length; j++) {
      if (hs[j].level <= h.level) { h.end = hs[j].start - 1; break; }
    }
    if (h.level === 1) { stack.length = 0; h.path = h.text; return; }
    while (stack.length && stack[stack.length - 1].level >= h.level) stack.pop();
    h.path = [...stack.map((s) => s.text), h.text].join(' > ');
    stack.push(h);
  });
  return { lines, headings: hs };
}

export function readHeadings(file) {
  return parseHeadings(fs.readFileSync(file, 'utf8'));
}

// One heading per line keeps the committed .outline/*.json small and diff-friendly.
export function outlineJson(file, headings) {
  const rows = headings.map((h) => '  ' + JSON.stringify({ l: h.level, t: h.text, s: h.start, e: h.end }));
  return `{"file":${JSON.stringify(file)},"headings":[\n${rows.join(',\n')}\n]}\n`;
}

// Rev/Sync paths are compared without backticks (inline code in a heading is formatting, not address).
export const normPath = (p) => p.replace(/`/g, '').replace(/\s+/g, ' ').trim();

// Entries of the Status section written as `- <heading path> = <n>` (kb Rev:)
// or `- <heading path> = <kb rev> / <code rev|->` (spec Sync:).
export function statusEntries(text) {
  const { lines, headings } = parseHeadings(text);
  const st = headings.find((h) => h.level === 2 && /^status$/i.test(h.text));
  if (!st) return null;
  const out = [];
  for (let i = st.start; i < st.end; i++) {
    const m = lines[i].match(/^\s*[-*]\s+(.+?)\s*=\s*(\d+)(?:\s*\/\s*(\d+|-))?\s*$/);
    if (!m) continue;
    out.push({
      path: normPath(m[1]),
      kb: Number(m[2]),
      code: m[3] === undefined ? undefined : m[3] === '-' ? null : Number(m[3]),
      hasSlash: m[3] !== undefined,
    });
  }
  return out;
}

// Tracked kb sections: every ### under Data Structures and Rules; a parent with no ### children is tracked itself.
// Returned normalised (see normPath) so they compare equal to Rev/Sync paths.
export function trackedSections(headings) {
  const out = [];
  for (const parent of ['Data Structures', 'Rules']) {
    const p = headings.find((h) => h.level === 2 && h.text.toLowerCase() === parent.toLowerCase());
    if (!p) continue;
    const kids = headings.filter((h) => h.level === 3 && h.path.startsWith(p.text + ' > ') && h.start > p.start && h.end <= p.end);
    if (kids.length) kids.forEach((k) => out.push(normPath(k.path)));
    else out.push(normPath(p.text));
  }
  return out;
}
