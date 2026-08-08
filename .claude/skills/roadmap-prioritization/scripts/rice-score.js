#!/usr/bin/env node
/**
 * rice-score.js — rank roadmap items by RICE (default) or ICE (--ice). No dependencies.
 *
 * USAGE
 *   node rice-score.js items.json              RICE from a JSON file
 *   node rice-score.js items.csv               RICE from a CSV file (header row required)
 *   node rice-score.js --ice items.csv         ICE mode (impact x confidence x ease, each 1-10)
 *   node rice-score.js "Name,reach,impact,confidence,effort" ...   inline items as CLI args
 *
 * RICE INPUT (per item)
 *   name        string   e.g. "Bulk export"
 *   reach       number   users (or events) affected per quarter — pull from analytics, not guesses
 *   impact      number   3 = massive, 2 = high, 1 = medium, 0.5 = low, 0.25 = minimal
 *   confidence  number   100, 80, or 50 (percent; 0.5-1.0 fractions also accepted)
 *   effort      number   person-weeks (> 0)
 *   goal        string   optional — which strategic goal this serves (printed if present)
 *
 *   score = (reach x impact x confidence) / effort
 *
 * ICE INPUT (per item, with --ice)
 *   name, impact (1-10), confidence (1-10), ease (1-10)
 *   score = impact x confidence x ease            (max 1000)
 *
 * FILE FORMATS
 *   JSON: [{"name":"Bulk export","reach":1200,"impact":2,"confidence":80,"effort":4,"goal":"Reduce churn"}]
 *   CSV : name,reach,impact,confidence,effort,goal   (columns matched by header name, any order;
 *         no quoted commas — keep names comma-free)
 *
 * EXAMPLES
 *   node rice-score.js roadmap.csv
 *   node rice-score.js --ice "Dark mode,6,7,8" "SSO,9,6,3"
 */

'use strict';

const fs = require('fs');
const path = require('path');

function fail(msg) {
  process.stderr.write(`rice-score: ${msg}\n`);
  process.exit(1);
}

const rawArgs = process.argv.slice(2);
const ice = rawArgs.includes('--ice');
const args = rawArgs.filter((a) => a !== '--ice');

if (args.length === 0) {
  fail('no input. Pass a .json/.csv file or inline items. See usage comment at top of this file.');
}

const NUM_FIELDS = ice ? ['impact', 'confidence', 'ease'] : ['reach', 'impact', 'confidence', 'effort'];

function toNumber(value, field, itemName) {
  const n = Number(value);
  if (!Number.isFinite(n)) fail(`"${itemName}": ${field} is not a number (got "${value}")`);
  return n;
}

function normalize(item) {
  const name = String(item.name ?? '').trim();
  if (!name) fail(`item is missing a name: ${JSON.stringify(item)}`);
  const out = { name, goal: item.goal ? String(item.goal).trim() : '' };
  for (const f of NUM_FIELDS) {
    if (item[f] === undefined || item[f] === '') fail(`"${name}": missing ${f}`);
    out[f] = toNumber(item[f], f, name);
  }
  if (ice) {
    for (const f of NUM_FIELDS) {
      if (out[f] < 1 || out[f] > 10) fail(`"${name}": ICE ${f} must be 1-10 (got ${out[f]})`);
    }
    out.score = out.impact * out.confidence * out.ease;
  } else {
    if (out.confidence > 1) out.confidence /= 100; // accept 80 or 0.8
    if (out.confidence <= 0 || out.confidence > 1) fail(`"${name}": confidence must be in (0, 100]`);
    if (out.effort <= 0) fail(`"${name}": effort must be > 0 person-weeks`);
    out.score = (out.reach * out.impact * out.confidence) / out.effort;
  }
  return out;
}

function parseCsv(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2) fail('CSV needs a header row and at least one item row');
  const header = lines[0].split(',').map((h) => h.trim().toLowerCase());
  if (!header.includes('name')) fail(`CSV header must include "name" (got: ${lines[0]})`);
  return lines.slice(1).map((line) => {
    const cells = line.split(',').map((c) => c.trim());
    const item = {};
    header.forEach((h, i) => { item[h] = cells[i]; });
    return item;
  });
}

function parseInline(arg) {
  const parts = arg.split(',').map((p) => p.trim());
  const expected = 1 + NUM_FIELDS.length;
  if (parts.length < expected) {
    fail(`inline item "${arg}" needs ${expected} fields: name,${NUM_FIELDS.join(',')}`);
  }
  const item = { name: parts[0] };
  NUM_FIELDS.forEach((f, i) => { item[f] = parts[i + 1]; });
  if (parts[expected]) item.goal = parts[expected];
  return item;
}

let rawItems;
const first = args[0];
const ext = path.extname(first).toLowerCase();
if (args.length === 1 && (ext === '.json' || ext === '.csv')) {
  if (!fs.existsSync(first)) fail(`file not found: ${first}`);
  const text = fs.readFileSync(first, 'utf8');
  if (ext === '.json') {
    let parsed;
    try { parsed = JSON.parse(text); } catch (e) { fail(`invalid JSON in ${first}: ${e.message}`); }
    rawItems = Array.isArray(parsed) ? parsed : parsed.items;
    if (!Array.isArray(rawItems)) fail(`${first} must be a JSON array (or {"items":[...]})`);
  } else {
    rawItems = parseCsv(text);
  }
} else {
  rawItems = args.map(parseInline);
}

const items = rawItems.map(normalize).sort((a, b) => b.score - a.score);

// ---- print ranked table ----
const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/\.?0+$/, ''));
const hasGoal = items.some((i) => i.goal);
const cols = ice
  ? ['#', 'Item', 'Impact', 'Conf', 'Ease', 'ICE']
  : ['#', 'Item', 'Reach/q', 'Impact', 'Conf', 'Effort(pw)', 'RICE'];
if (hasGoal) cols.splice(2, 0, 'Goal');

const rows = items.map((it, idx) => {
  const base = ice
    ? [String(idx + 1), it.name, fmt(it.impact), fmt(it.confidence), fmt(it.ease), fmt(it.score)]
    : [String(idx + 1), it.name, fmt(it.reach), fmt(it.impact), `${Math.round(it.confidence * 100)}%`,
       fmt(it.effort), it.score >= 100 ? String(Math.round(it.score)) : fmt(it.score)];
  if (hasGoal) base.splice(2, 0, it.goal || '(unmapped — gate it)');
  return base;
});

const widths = cols.map((c, i) => Math.max(c.length, ...rows.map((r) => r[i].length)));
const line = (cells) => cells.map((c, i) => c.padEnd(widths[i])).join('  ');
console.log(line(cols));
console.log(widths.map((w) => '-'.repeat(w)).join('  '));
rows.forEach((r) => console.log(line(r)));

if (!ice) {
  const low = items.filter((i) => i.confidence < 0.5).map((i) => i.name);
  if (low.length) {
    console.log(`\nConfidence below 50% — get evidence before scoring: ${low.join(', ')}`);
  }
  if (items.length >= 2 && items[0].score > 0 && items[1].score / items[0].score > 0.8) {
    console.log('\nTop two scores are within 20% — that gap is noise, not a decision. Discuss, don\'t rank.');
  }
}
