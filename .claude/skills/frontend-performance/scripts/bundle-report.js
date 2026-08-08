#!/usr/bin/env node
/**
 * bundle-report.js — build-output size report with gzip estimates and budget warnings.
 *
 * Scans a build output directory (.next, dist, or build), sums JS/CSS sizes per
 * file, estimates over-the-wire size via zlib gzip, and prints a table sorted by
 * gzipped size, plus totals and warnings against a JS budget.
 *
 * Usage:
 *   node bundle-report.js                    # auto-detect .next | dist | build in cwd
 *   node bundle-report.js path/to/dist       # explicit build dir
 *   node bundle-report.js --budget=250       # total-JS budget in KB gzipped (default 200)
 *   node bundle-report.js dist --budget=250 --top=40
 *
 * Options:
 *   --budget=N   Total initial-JS budget in KB (gzipped). Default: 200.
 *   --top=N      Number of largest files to list. Default: 25.
 *   --all        List every file instead of the top N.
 *
 * No dependencies; requires Node 14+. Exits 1 if the JS budget is exceeded
 * (usable as a CI guard), 0 otherwise.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

// ---------------------------------------------------------------------------
// CLI parsing
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
let dirArg = null;
let budgetKB = 200;
let topN = 25;
let showAll = false;

for (const a of args) {
  if (a.startsWith('--budget=')) budgetKB = parseFloat(a.split('=')[1]) || 200;
  else if (a.startsWith('--top=')) topN = parseInt(a.split('=')[1], 10) || 25;
  else if (a === '--all') showAll = true;
  else if (a === '--help' || a === '-h') {
    console.log('Usage: node bundle-report.js [buildDir] [--budget=KB] [--top=N] [--all]');
    process.exit(0);
  } else if (!a.startsWith('--')) dirArg = a;
}

// ---------------------------------------------------------------------------
// Locate build directory
// ---------------------------------------------------------------------------

const CANDIDATES = ['.next', 'dist', 'build'];
let buildDir;

if (dirArg) {
  buildDir = path.resolve(dirArg);
  if (!fs.existsSync(buildDir) || !fs.statSync(buildDir).isDirectory()) {
    console.error(`Error: "${buildDir}" is not a directory.`);
    process.exit(1);
  }
} else {
  for (const c of CANDIDATES) {
    const p = path.resolve(process.cwd(), c);
    if (fs.existsSync(p) && fs.statSync(p).isDirectory()) {
      buildDir = p;
      break;
    }
  }
  if (!buildDir) {
    console.error(
      'Error: no build directory found. Looked for: ' +
        CANDIDATES.join(', ') +
        '\nRun your build first, or pass a path: node bundle-report.js path/to/dist'
    );
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------
// Walk and measure
// ---------------------------------------------------------------------------

const SKIP_DIRS = new Set(['node_modules', 'cache', '.git']);
const ASSET_RE = /\.(js|mjs|cjs|css)$/i;

/** Recursively collect asset file paths. */
function walk(dir, out) {
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.next') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIRS.has(e.name)) continue;
      walk(full, out);
    } else if (e.isFile() && ASSET_RE.test(e.name) && !e.name.endsWith('.map')) {
      out.push(full);
    }
  }
  return out;
}

const files = walk(buildDir, []);

if (files.length === 0) {
  console.error(`No .js/.css assets found under ${buildDir}. Did the build run?`);
  process.exit(1);
}

const rows = files.map((f) => {
  const buf = fs.readFileSync(f);
  const gz = zlib.gzipSync(buf, { level: 9 }).length;
  const ext = path.extname(f).toLowerCase();
  return {
    rel: path.relative(buildDir, f),
    type: ext === '.css' ? 'css' : 'js',
    raw: buf.length,
    gzip: gz,
  };
});

rows.sort((a, b) => b.gzip - a.gzip);

// For Next.js, client-facing JS lives under static/; server bundles don't ship
// to the browser, so budget-check only the client chunks when we can tell.
const isNext = path.basename(buildDir) === '.next';
const clientRow = (r) => !isNext || r.rel.startsWith('static' + path.sep) || r.rel.startsWith('static/');

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

function fmtKB(bytes) {
  return (bytes / 1024).toFixed(1) + ' KB';
}

function pad(str, width, right) {
  str = String(str);
  return right ? str.padStart(width) : str.padEnd(width);
}

const PER_FILE_WARN_KB = 50; // a single 50KB+ gzipped chunk deserves a look

const listed = showAll ? rows : rows.slice(0, topN);
const nameW = Math.min(72, Math.max(10, ...listed.map((r) => r.rel.length)));

console.log(`\nBundle report: ${buildDir}`);
console.log(`Files scanned: ${rows.length} (.js/.css, .map excluded)\n`);

console.log(
  pad('FILE', nameW) + '  ' + pad('TYPE', 4) + '  ' + pad('RAW', 10, true) + '  ' + pad('GZIP', 10, true) + '  FLAG'
);
console.log('-'.repeat(nameW + 34));

for (const r of listed) {
  const name = r.rel.length > nameW ? '…' + r.rel.slice(-(nameW - 1)) : r.rel;
  const flag = r.gzip > PER_FILE_WARN_KB * 1024 && r.type === 'js' ? '⚠ large' : '';
  console.log(
    pad(name, nameW) + '  ' + pad(r.type, 4) + '  ' + pad(fmtKB(r.raw), 10, true) + '  ' + pad(fmtKB(r.gzip), 10, true) + '  ' + flag
  );
}
if (!showAll && rows.length > topN) {
  console.log(`… and ${rows.length - topN} smaller files (use --all to list)`);
}

// ---------------------------------------------------------------------------
// Totals and budget
// ---------------------------------------------------------------------------

const sum = (arr, key) => arr.reduce((n, r) => n + r[key], 0);
const jsRows = rows.filter((r) => r.type === 'js' && clientRow(r));
const cssRows = rows.filter((r) => r.type === 'css' && clientRow(r));

const jsGzip = sum(jsRows, 'gzip');
const cssGzip = sum(cssRows, 'gzip');

console.log('\nTotals' + (isNext ? ' (client assets under static/ only)' : '') + ':');
console.log(`  JS : ${fmtKB(sum(jsRows, 'raw'))} raw, ${fmtKB(jsGzip)} gzipped across ${jsRows.length} files`);
console.log(`  CSS: ${fmtKB(sum(cssRows, 'raw'))} raw, ${fmtKB(cssGzip)} gzipped across ${cssRows.length} files`);

const budgetBytes = budgetKB * 1024;
const pct = ((jsGzip / budgetBytes) * 100).toFixed(0);

console.log(`\nJS budget: ${budgetKB} KB gzipped — currently at ${fmtKB(jsGzip)} (${pct}%)`);

let failed = false;
if (jsGzip > budgetBytes) {
  failed = true;
  console.log(`  ✗ OVER BUDGET by ${fmtKB(jsGzip - budgetBytes)}.`);
  console.log('    Note: this totals ALL JS chunks; the per-route initial payload is smaller.');
  console.log('    Start with the ⚠ large files above — dynamic-import them or audit their deps.');
} else {
  console.log('  ✓ Within budget.');
}

const bigFiles = jsRows.filter((r) => r.gzip > PER_FILE_WARN_KB * 1024);
if (bigFiles.length) {
  console.log(`\n${bigFiles.length} JS file(s) exceed ${PER_FILE_WARN_KB} KB gzipped — candidates for splitting or dep swaps.`);
}

console.log('');
process.exit(failed ? 1 : 0);
