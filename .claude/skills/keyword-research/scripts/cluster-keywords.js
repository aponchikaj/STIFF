#!/usr/bin/env node
/**
 * cluster-keywords.js — lexical first-pass keyword clustering.
 *
 * Usage:
 *   node cluster-keywords.js <file> [--threshold 0.5] [--min-group 2]
 *
 *   <file>        CSV (keywords read from the first column; a header row like
 *                 "keyword" is auto-skipped) or a plain newline-separated list.
 *   --threshold   Jaccard similarity (shared tokens / all tokens) required to
 *                 join two keywords into one group. 0..1, default 0.5.
 *                 Lower = bigger, looser groups.
 *   --min-group   Minimum members for a printed group; smaller groups are
 *                 listed under "Ungrouped". Default 2.
 *
 * Output: topic groups printed largest-first, each with a suggested head term,
 * then ungrouped keywords.
 *
 * Note: this is a lexical first pass. SERP-overlap clustering (shared top-10
 * URLs) is the ground truth — verify groups you intend to target.
 *
 * No external dependencies. Node 14+.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const STOPWORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
  'by', 'from', 'as', 'is', 'are', 'was', 'be', 'do', 'does', 'my', 'your',
  'you', 'i', 'it', 'its', 'that', 'this', 'what', 'how', 'why', 'when',
  'which', 'can', 'should', 'will', 'vs',
]);

function parseArgs(argv) {
  const args = { file: null, threshold: 0.5, minGroup: 2 };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--threshold') args.threshold = parseFloat(argv[++i]);
    else if (a === '--min-group') args.minGroup = parseInt(argv[++i], 10);
    else if (a === '-h' || a === '--help') args.help = true;
    else if (!args.file) args.file = a;
  }
  return args;
}

// Minimal CSV first-field extractor (handles double-quoted fields).
function firstCsvField(line) {
  if (line[0] === '"') {
    let out = '';
    for (let i = 1; i < line.length; i++) {
      if (line[i] === '"') {
        if (line[i + 1] === '"') { out += '"'; i++; }
        else return out;
      } else out += line[i];
    }
    return out;
  }
  const comma = line.indexOf(',');
  return comma === -1 ? line : line.slice(0, comma);
}

function loadKeywords(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const isCsv = path.extname(file).toLowerCase() === '.csv' || raw.includes(',');
  let lines = raw.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (isCsv) lines = lines.map(firstCsvField).map((s) => s.trim()).filter(Boolean);
  // Drop a header row if it looks like one.
  if (lines.length && /^(keywords?|quer(y|ies)|terms?|search terms?|phrase)$/i.test(lines[0])) {
    lines = lines.slice(1);
  }
  // Dedupe case-insensitively, keep first spelling.
  const seen = new Set();
  const out = [];
  for (const kw of lines) {
    const key = kw.toLowerCase();
    if (!seen.has(key)) { seen.add(key); out.push(kw); }
  }
  return out;
}

// Light stemmer: plural collapse only, so "makers"/"maker" and
// "strategies"/"strategy" share a token without mangling short words.
function stem(token) {
  if (token.length > 4 && token.endsWith('ies')) return token.slice(0, -3) + 'y';
  if (token.length > 4 && /(x|z|ch|sh|ss)es$/.test(token)) return token.slice(0, -2);
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
  return token;
}

function tokenize(keyword) {
  const tokens = keyword
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter((t) => t && !STOPWORDS.has(t))
    .map(stem);
  return new Set(tokens);
}

function jaccard(a, b) {
  if (a.size === 0 || b.size === 0) return 0;
  let shared = 0;
  for (const t of a) if (b.has(t)) shared++;
  return shared / (a.size + b.size - shared);
}

// Union-find for single-link agglomeration.
function makeUnionFind(n) {
  const parent = Array.from({ length: n }, (_, i) => i);
  function find(x) {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(a, b) { parent[find(a)] = find(b); }
  return { find, union };
}

// Head term: member whose tokens are most frequent across the group
// (highest average token frequency), tie-broken by fewer words, then length.
function suggestHead(members, tokenSets, keywords) {
  const freq = new Map();
  for (const i of members) {
    for (const t of tokenSets[i]) freq.set(t, (freq.get(t) || 0) + 1);
  }
  let best = members[0];
  let bestScore = -1;
  for (const i of members) {
    const tokens = tokenSets[i];
    if (tokens.size === 0) continue;
    let sum = 0;
    for (const t of tokens) sum += freq.get(t);
    const score = sum / tokens.size;
    const better =
      score > bestScore ||
      (score === bestScore && tokens.size < tokenSets[best].size) ||
      (score === bestScore && tokens.size === tokenSets[best].size &&
        keywords[i].length < keywords[best].length);
    if (better) { best = i; bestScore = score; }
  }
  return best;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.file) {
    console.log('Usage: node cluster-keywords.js <file> [--threshold 0.5] [--min-group 2]');
    process.exit(args.help ? 0 : 1);
  }
  if (!fs.existsSync(args.file)) {
    console.error(`Error: file not found: ${args.file}`);
    process.exit(1);
  }
  if (!(args.threshold > 0 && args.threshold <= 1)) {
    console.error('Error: --threshold must be in (0, 1].');
    process.exit(1);
  }

  const keywords = loadKeywords(args.file);
  if (keywords.length === 0) {
    console.error('Error: no keywords found in input.');
    process.exit(1);
  }

  const tokenSets = keywords.map(tokenize);
  const uf = makeUnionFind(keywords.length);
  for (let i = 0; i < keywords.length; i++) {
    for (let j = i + 1; j < keywords.length; j++) {
      if (jaccard(tokenSets[i], tokenSets[j]) >= args.threshold) uf.union(i, j);
    }
  }

  const groupsByRoot = new Map();
  for (let i = 0; i < keywords.length; i++) {
    const root = uf.find(i);
    if (!groupsByRoot.has(root)) groupsByRoot.set(root, []);
    groupsByRoot.get(root).push(i);
  }

  const groups = [];
  const ungrouped = [];
  for (const members of groupsByRoot.values()) {
    if (members.length >= args.minGroup) groups.push(members);
    else for (const i of members) ungrouped.push(i);
  }
  groups.sort((a, b) => b.length - a.length);

  console.log(`Clustered ${keywords.length} keywords into ${groups.length} groups ` +
    `(threshold ${args.threshold}, min group ${args.minGroup})\n`);

  groups.forEach((members, idx) => {
    const head = suggestHead(members, tokenSets, keywords);
    console.log(`Group ${idx + 1} (${members.length} keywords) — suggested head: "${keywords[head]}"`);
    for (const i of members) console.log(`  - ${keywords[i]}`);
    console.log('');
  });

  if (ungrouped.length > 0) {
    console.log(`Ungrouped (${ungrouped.length}) — treat as one-off long-tail or lower the threshold:`);
    for (const i of ungrouped) console.log(`  - ${keywords[i]}`);
  }

  console.log('\nNote: lexical clustering is a first pass. Verify groups you will target');
  console.log('via SERP overlap (3+ shared top-10 URLs = one page).');
}

main();
