#!/usr/bin/env node
/**
 * a11y-audit.js — static accessibility scanner. No dependencies. Node 18+.
 *
 * Usage:
 *   node scripts/a11y-audit.js https://example.com
 *   node scripts/a11y-audit.js path/to/page.html
 *
 * Checks:
 *   - <img> missing alt attribute
 *   - form inputs (input/select/textarea) with no <label for>, wrapping <label>,
 *     aria-label, aria-labelledby, or title
 *   - <html> missing lang attribute
 *   - empty buttons and links (no text content and no accessible name)
 *   - heading level skips (e.g. h1 -> h3)
 *   - missing landmarks (main, nav, banner)
 *
 * Prints each finding with severity, WCAG SC, and the source line for context.
 * Exit code 1 if any blocker/serious findings, else 0.
 *
 * This is a static heuristic pass. It catches roughly the mechanical 30-40%
 * of issues; always follow with a keyboard-only and screen-reader pass.
 */

'use strict';

const fs = require('fs');

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node a11y-audit.js <url-or-html-file>');
  process.exit(2);
}

/** Replace a span of text with spaces, preserving length and newlines so
 *  match indexes still map to the correct source lines. */
function blank(str) {
  return str.replace(/[^\n]/g, ' ');
}

/** Mask comments, scripts, styles, and SVG internals so we don't flag
 *  markup inside them, without disturbing line numbering. */
function maskNonContent(html) {
  return html
    .replace(/<!--[\s\S]*?-->/g, blank)
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, blank)
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, blank);
}

function getAttr(tag, name) {
  const re = new RegExp(
    name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\'|([^\\s"\'>]+))',
    'i'
  );
  const m = tag.match(re);
  if (!m) return null;
  return m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
}

function hasAttr(tag, name) {
  return new RegExp('[\\s"\']' + name + '(\\s*=|[\\s/>])', 'i').test(tag);
}

function stripTags(html) {
  return html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').trim();
}

async function loadSource(target) {
  if (/^https?:\/\//i.test(target)) {
    const res = await fetch(target, {
      headers: { 'User-Agent': 'a11y-audit/1.0 (static scanner)' },
      redirect: 'follow',
    });
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);
    return await res.text();
  }
  return fs.readFileSync(target, 'utf8');
}

async function main() {
  let raw;
  try {
    raw = await loadSource(arg);
  } catch (err) {
    console.error(`Error loading "${arg}": ${err.message}`);
    process.exit(2);
  }

  const lines = raw.split('\n');
  const html = maskNonContent(raw);
  const findings = [];

  const lineOf = (index) => {
    let n = 1;
    for (let i = 0; i < index && i < html.length; i++) {
      if (html[i] === '\n') n++;
    }
    return n;
  };

  const context = (lineNo) => {
    const text = (lines[lineNo - 1] || '').trim();
    return text.length > 160 ? text.slice(0, 157) + '...' : text;
  };

  const add = (severity, rule, sc, message, index) => {
    const lineNo = index == null ? null : lineOf(index);
    findings.push({ severity, rule, sc, message, lineNo, context: lineNo ? context(lineNo) : '' });
  };

  // ---- 1. <html> lang attribute (WCAG 3.1.1) --------------------------------
  const htmlTag = html.match(/<html\b[^>]*>/i);
  if (!htmlTag) {
    if (/<(body|head)\b/i.test(html)) {
      add('serious', 'missing-lang', '3.1.1', 'No <html> element found; document language cannot be set', 0);
    }
  } else if (!getAttr(htmlTag[0], 'lang')) {
    add('serious', 'missing-lang', '3.1.1',
      'Missing lang attribute on <html>; screen readers may use the wrong pronunciation engine',
      htmlTag.index);
  }

  // ---- 2. Images missing alt (WCAG 1.1.1) -----------------------------------
  for (const m of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = m[0];
    if (!hasAttr(tag, 'alt') && !hasAttr(tag, 'aria-hidden') && getAttr(tag, 'role') !== 'presentation') {
      const src = getAttr(tag, 'src') || '(no src)';
      add('serious', 'img-missing-alt', '1.1.1',
        `<img> missing alt attribute (src: ${src}); add descriptive alt, or alt="" if decorative`,
        m.index);
    }
  }

  // ---- 3. Inputs without labels (WCAG 1.3.1 / 3.3.2 / 4.1.2) ----------------
  const labelForIds = new Set();
  for (const m of html.matchAll(/<label\b[^>]*>/gi)) {
    const id = getAttr(m[0], 'for');
    if (id) labelForIds.add(id);
  }
  const labelRanges = [];
  for (const m of html.matchAll(/<label\b[^>]*>[\s\S]*?<\/label\s*>/gi)) {
    labelRanges.push([m.index, m.index + m[0].length]);
  }
  const insideLabel = (i) => labelRanges.some(([a, b]) => i >= a && i < b);
  const SKIP_TYPES = new Set(['hidden', 'submit', 'reset', 'button']);

  for (const m of html.matchAll(/<(input|select|textarea)\b[^>]*>/gi)) {
    const tag = m[0];
    const el = m[1].toLowerCase();
    const type = (getAttr(tag, 'type') || 'text').toLowerCase();
    if (el === 'input' && SKIP_TYPES.has(type)) continue;
    const id = getAttr(tag, 'id');
    const labeled =
      (id && labelForIds.has(id)) ||
      insideLabel(m.index) ||
      (getAttr(tag, 'aria-label') || '').trim() ||
      hasAttr(tag, 'aria-labelledby') ||
      (getAttr(tag, 'title') || '').trim();
    if (!labeled) {
      const name = getAttr(tag, 'name') || id || '(unnamed)';
      add('serious', 'input-no-label', '3.3.2',
        `<${el}${el === 'input' ? ` type="${type}"` : ''}> "${name}" has no <label for>, wrapping label, aria-label, or aria-labelledby`,
        m.index);
    }
  }

  // ---- 4. Empty buttons and links (WCAG 4.1.2 / 2.4.4) ----------------------
  const hasInnerName = (inner) => {
    if (stripTags(inner)) return true;
    for (const im of inner.matchAll(/<(img|svg|input)\b[^>]*>/gi)) {
      const t = im[0];
      if ((getAttr(t, 'alt') || '').trim() || (getAttr(t, 'aria-label') || '').trim()) return true;
    }
    if (/<title\b[^>]*>\s*[^<\s]/i.test(inner)) return true; // svg <title>
    return false;
  };
  const hasOwnName = (tag) =>
    (getAttr(tag, 'aria-label') || '').trim() ||
    hasAttr(tag, 'aria-labelledby') ||
    (getAttr(tag, 'title') || '').trim();

  for (const m of html.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button\s*>/gi)) {
    if (!hasOwnName(m[0]) && !hasInnerName(m[1])) {
      add('blocker', 'empty-button', '4.1.2',
        'Button has no accessible name (no text, aria-label, or labeled image); announced only as "button"',
        m.index);
    }
  }
  for (const m of html.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a\s*>/gi)) {
    const openTag = m[0].match(/<a\b[^>]*>/i)[0];
    if (!hasAttr(openTag, 'href')) continue;
    if (!hasOwnName(openTag) && !hasInnerName(m[1])) {
      const href = getAttr(openTag, 'href');
      add('blocker', 'empty-link', '2.4.4',
        `Link to "${href}" has no accessible name (no text, aria-label, or labeled image)`,
        m.index);
    }
  }

  // ---- 5. Heading level skips (WCAG 1.3.1) ----------------------------------
  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>/gi)]
    .map((m) => ({ level: parseInt(m[1], 10), index: m.index }));
  if (headings.length && !headings.some((h) => h.level === 1)) {
    add('moderate', 'no-h1', '1.3.1', 'No <h1> found; every page needs one top-level heading', headings[0].index);
  }
  let prev = null;
  for (const h of headings) {
    if (prev !== null && h.level > prev + 1) {
      add('moderate', 'heading-skip', '1.3.1',
        `Heading level skip: h${prev} followed by h${h.level}; screen-reader heading navigation loses structure`,
        h.index);
    }
    prev = h.level;
  }

  // ---- 6. Missing landmarks (WCAG 1.3.1 / 2.4.1) ----------------------------
  const hasBody = /<body\b/i.test(html);
  if (hasBody) {
    const landmarks = [
      ['main', /<main\b|role\s*=\s*["']?main["']?/i, 'serious',
        'No <main> landmark; screen-reader users cannot jump past header/nav to content'],
      ['nav', /<nav\b|role\s*=\s*["']?navigation["']?/i, 'moderate',
        'No <nav> landmark; primary navigation is not exposed for landmark navigation'],
      ['banner', /<header\b|role\s*=\s*["']?banner["']?/i, 'minor',
        'No <header>/banner landmark found'],
    ];
    for (const [name, re, severity, msg] of landmarks) {
      if (!re.test(html)) add(severity, `missing-landmark-${name}`, '1.3.1', msg, null);
    }
  }

  // ---- Report ---------------------------------------------------------------
  const order = { blocker: 0, serious: 1, moderate: 2, minor: 3 };
  findings.sort((a, b) => order[a.severity] - order[b.severity] || (a.lineNo || 0) - (b.lineNo || 0));

  console.log(`a11y-audit: ${arg}`);
  console.log(`${'-'.repeat(60)}`);
  if (!findings.length) {
    console.log('No issues found by static checks.');
    console.log('Reminder: static scanning catches ~30-40% of WCAG failures.');
    console.log('Run a keyboard-only pass and a screen-reader pass before calling this accessible.');
    return;
  }

  for (const f of findings) {
    const loc = f.lineNo ? `line ${f.lineNo}` : 'document';
    console.log(`[${f.severity.toUpperCase()}] ${f.rule} (WCAG ${f.sc}) — ${loc}`);
    console.log(`  ${f.message}`);
    if (f.context) console.log(`  > ${f.context}`);
    console.log('');
  }

  const counts = findings.reduce((acc, f) => ((acc[f.severity] = (acc[f.severity] || 0) + 1), acc), {});
  console.log(`${'-'.repeat(60)}`);
  console.log(
    `Total: ${findings.length}  ` +
    `(blocker: ${counts.blocker || 0}, serious: ${counts.serious || 0}, ` +
    `moderate: ${counts.moderate || 0}, minor: ${counts.minor || 0})`
  );
  console.log('Static checks only — follow with keyboard-only, screen-reader, 200% zoom, and reduced-motion passes.');

  if ((counts.blocker || 0) + (counts.serious || 0) > 0) process.exitCode = 1;
}

main();
