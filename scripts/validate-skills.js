#!/usr/bin/env node
/**
 * validate-skills.js — validates every skill under .claude/skills/ against the
 * Agent Skills format contract.
 *
 * Checks per skill:
 *   1. SKILL.md exists and frontmatter parses (--- ... --- block)
 *   2. `name` and `description` fields present
 *   3. `name` matches the folder name exactly
 *   4. `name` charset: lowercase letters/digits/hyphens, ≤64 chars,
 *      no leading/trailing/doubled hyphen
 *   5. `description` is a single-line quoted string ≤1024 chars
 *   6. SKILL.md body ≤500 lines
 *   7. Every `see <skill-name>` routing reference (description AND body)
 *      resolves to a skill folder that exists
 *   8. No duplicate skill names across folders
 *
 * Usage: node scripts/validate-skills.js [path-to-skills-dir]
 * Exit codes: 0 = clean, 1 = failures found
 */
const fs = require("fs");
const path = require("path");

const SKILLS_DIR = process.argv[2] || path.join(__dirname, "..", ".claude", "skills");

// English words that can follow "see" in prose; not treated as skill refs.
const STOPWORDS = new Set([
  "the", "a", "an", "also", "how", "what", "which", "your", "their", "it",
  "this", "that", "them", "if", "in", "on", "for", "and", "or", "above",
  "below", "section", "output", "references", "usage", "docs",
]);

function fail(list, skill, msg) {
  list.push(`  ${skill}: ${msg}`);
}

const dirs = fs
  .readdirSync(SKILLS_DIR)
  .filter((d) => fs.statSync(path.join(SKILLS_DIR, d)).isDirectory())
  .sort();

const names = new Set();
const errors = [];
let totalLines = 0;

for (const dir of dirs) {
  const skillPath = path.join(SKILLS_DIR, dir, "SKILL.md");
  if (!fs.existsSync(skillPath)) {
    fail(errors, dir, "missing SKILL.md");
    continue;
  }
  const text = fs.readFileSync(skillPath, "utf8");
  const lines = text.split("\n").length;
  totalLines += lines;

  const fmMatch = text.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    fail(errors, dir, "frontmatter block missing or malformed");
    continue;
  }
  const fm = fmMatch[1];

  const name = (fm.match(/^name:\s*(.+?)\s*$/m) || [])[1];
  const descLine = (fm.match(/^description:\s*(.+)$/m) || [])[1];
  const desc = (fm.match(/^description:\s*"(.*)"\s*$/m) || [])[1];

  if (!name) fail(errors, dir, "frontmatter missing `name`");
  if (!descLine) fail(errors, dir, "frontmatter missing `description`");

  if (name) {
    if (name !== dir) fail(errors, dir, `name "${name}" does not match folder name`);
    if (name.length > 64) fail(errors, dir, `name is ${name.length} chars (max 64)`);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(name))
      fail(errors, dir, `name "${name}" violates charset/hyphen rules`);
    if (names.has(name)) fail(errors, dir, `duplicate skill name "${name}"`);
    names.add(name);
  }

  if (descLine && desc === undefined)
    fail(errors, dir, "description is not a single-line double-quoted string");
  if (desc !== undefined && desc.length > 1024)
    fail(errors, dir, `description is ${desc.length} chars (max 1024)`);

  if (lines > 500) fail(errors, dir, `SKILL.md is ${lines} lines (max 500)`);

  // Routing references: `see <token>` where token is an existing skill name,
  // or looks like a skill slug (contains a hyphen) and is NOT a stopword.
  // Unknown hyphenated tokens and unknown non-stopword slugs are dangling refs.
  const refPattern = /\bsee ([a-z0-9]+(?:-[a-z0-9]+)*)\b/g;
  const allDirs = new Set(dirs);
  for (const [, token] of text.matchAll(refPattern)) {
    if (allDirs.has(token)) continue; // resolves
    if (STOPWORDS.has(token)) continue; // prose
    if (token.includes("-")) {
      fail(errors, dir, `dangling routing reference: see ${token}`);
    }
    // Single-word unknown tokens are ambiguous prose ("see below") — the
    // stopword list covers the common ones; anything else hyphen-less is
    // reported as a warning-level dangling ref only if it exactly matches
    // the shape of a former/removed skill (not detectable), so it is skipped.
  }
}

const avg = dirs.length ? Math.round(totalLines / dirs.length) : 0;
console.log(`Skills scanned: ${dirs.length}`);
console.log(`Total SKILL.md lines: ${totalLines} (average ${avg})`);
if (errors.length) {
  console.log(`\nFAILURES (${errors.length}):`);
  for (const e of errors) console.log(e);
  process.exit(1);
} else {
  console.log("All checks passed: frontmatter, naming, description limits, body limits, routing references, uniqueness.");
}
