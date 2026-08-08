#!/usr/bin/env node
/**
 * contrast-check.js — WCAG 2.x contrast ratio checker. No dependencies.
 *
 * Usage:
 *   node contrast-check.js <foreground-hex> <background-hex>
 *
 * Examples:
 *   node contrast-check.js "#1a1a2e" "#f5f5f4"
 *   node contrast-check.js 6366f1 fff
 *
 * Accepts 3- or 6-digit hex, with or without "#".
 * Prints the contrast ratio and pass/fail for:
 *   AA  normal text  (>= 4.5:1)   AA  large text  (>= 3:1)
 *   AAA normal text  (>= 7:1)     AAA large text  (>= 4.5:1)
 * Large text = >= 24px regular, or >= 18.66px (14pt) bold.
 * The 3:1 AA-large threshold also applies to UI components and
 * focus indicators under WCAG 1.4.11 (non-text contrast).
 *
 * Exit code: 0 if AA normal passes, 1 otherwise (useful in CI).
 */

function parseHex(input) {
  const raw = String(input).trim().replace(/^#/, "");
  if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(raw)) {
    throw new Error(
      `"${input}" is not a valid hex color. Use 3 or 6 hex digits, e.g. #f5f5f4 or fff.`
    );
  }
  const hex =
    raw.length === 3
      ? raw.split("").map((c) => c + c).join("")
      : raw;
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16),
    hex: "#" + hex.toLowerCase(),
  };
}

// WCAG 2.x relative luminance: sRGB channels are linearized, then
// weighted by the eye's sensitivity to each primary.
function relativeLuminance({ r, g, b }) {
  const linearize = (channel) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b)
  );
}

function contrastRatio(colorA, colorB) {
  const la = relativeLuminance(colorA);
  const lb = relativeLuminance(colorB);
  const lighter = Math.max(la, lb);
  const darker = Math.min(la, lb);
  return (lighter + 0.05) / (darker + 0.05);
}

function main() {
  const [, , fgArg, bgArg] = process.argv;
  if (!fgArg || !bgArg) {
    console.error("Usage: node contrast-check.js <foreground-hex> <background-hex>");
    console.error('Example: node contrast-check.js "#1a1a2e" "#f5f5f4"');
    process.exit(2);
  }

  let fg, bg;
  try {
    fg = parseHex(fgArg);
    bg = parseHex(bgArg);
  } catch (err) {
    console.error(err.message);
    process.exit(2);
  }

  const ratio = contrastRatio(fg, bg);
  const display = (Math.floor(ratio * 100) / 100).toFixed(2); // truncate, never round up past a threshold

  const checks = [
    { label: "AA  normal text (>= 4.5:1)", threshold: 4.5 },
    { label: "AA  large text  (>= 3:1)  ", threshold: 3.0 },
    { label: "AAA normal text (>= 7:1)  ", threshold: 7.0 },
    { label: "AAA large text  (>= 4.5:1)", threshold: 4.5 },
  ];

  console.log(`Foreground: ${fg.hex}`);
  console.log(`Background: ${bg.hex}`);
  console.log(`Contrast ratio: ${display}:1`);
  console.log("");
  for (const { label, threshold } of checks) {
    const pass = ratio >= threshold;
    console.log(`${pass ? "PASS" : "FAIL"}  ${label}`);
  }
  console.log("");
  console.log("Note: AA large (3:1) also covers UI components and focus indicators (WCAG 1.4.11).");

  process.exit(ratio >= 4.5 ? 0 : 1);
}

main();
