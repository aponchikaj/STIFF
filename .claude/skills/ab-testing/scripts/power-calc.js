#!/usr/bin/env node
/**
 * power-calc.js — A/B test sample size and runtime calculator.
 *
 * Usage:
 *   node power-calc.js <baselineRate> <mde> <dailyTraffic> [--relative] [--variants N]
 *
 *   baselineRate  Current conversion rate of control, as a decimal (0.04 = 4%)
 *   mde           Minimum detectable effect. Absolute by default (0.005 = +0.5pp).
 *                 Pass --relative to treat it as a relative lift (0.10 = +10% of baseline).
 *   dailyTraffic  Total eligible visitors/users entering the experiment per day
 *                 (across ALL variants, before the split).
 *   --variants N  Number of variants including control (default 2).
 *
 * Fixed assumptions: alpha = 0.05 (two-sided), power = 0.80, equal split.
 *
 * Examples:
 *   node power-calc.js 0.04 0.005 2000            # 4% baseline, +0.5pp absolute MDE
 *   node power-calc.js 0.04 0.10 2000 --relative  # 4% baseline, +10% relative MDE
 *   node power-calc.js 0.025 0.15 5000 --relative --variants 3
 */

const Z_ALPHA = 1.959964; // two-sided alpha = 0.05
const Z_BETA = 0.841621;  // power = 0.80

function sampleSizePerVariant(p1, p2) {
  // Two-proportion z-test, unpooled variance with pooled term for the alpha side.
  const pBar = (p1 + p2) / 2;
  const numerator =
    Z_ALPHA * Math.sqrt(2 * pBar * (1 - pBar)) +
    Z_BETA * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2));
  return Math.ceil((numerator * numerator) / ((p2 - p1) * (p2 - p1)));
}

function fail(msg) {
  console.error(`Error: ${msg}\nRun with no arguments to see usage.`);
  process.exit(1);
}

const args = process.argv.slice(2);
if (args.length === 0) {
  const src = require('fs').readFileSync(__filename, 'utf8');
  console.log(src.split('*/')[0].replace(/^#!.*\n/, '') + '*/');
  process.exit(0);
}

const relative = args.includes('--relative');
let variants = 2;
const vIdx = args.indexOf('--variants');
if (vIdx !== -1) {
  variants = parseInt(args[vIdx + 1], 10);
  if (!Number.isInteger(variants) || variants < 2) fail('--variants must be an integer >= 2');
}

const positional = args.filter((a, i) => !a.startsWith('--') && (vIdx === -1 || i !== vIdx + 1));
if (positional.length < 3) fail('need <baselineRate> <mde> <dailyTraffic>');

const [baseline, mde, dailyTraffic] = positional.map(Number);
if (!(baseline > 0 && baseline < 1)) fail('baselineRate must be between 0 and 1 (e.g. 0.04)');
if (!(mde > 0)) fail('mde must be > 0');
if (!(dailyTraffic > 0)) fail('dailyTraffic must be > 0');

const treatment = relative ? baseline * (1 + mde) : baseline + mde;
if (treatment >= 1) fail(`treatment rate ${treatment.toFixed(4)} >= 1; check your MDE units`);

const perVariant = sampleSizePerVariant(baseline, treatment);
const total = perVariant * variants;
const rawDays = total / dailyTraffic;
const days = Math.ceil(rawDays);
const fullWeeks = Math.max(1, Math.ceil(days / 7));
const conversionsPerVariant = Math.round(perVariant * baseline);

const pct = (x) => (x * 100).toFixed(2) + '%';
console.log('A/B Test Power Calculation (alpha=0.05 two-sided, power=0.80)');
console.log('--------------------------------------------------------------');
console.log(`Baseline rate:          ${pct(baseline)}`);
console.log(`Treatment rate (MDE):   ${pct(treatment)} (${relative ? 'relative' : 'absolute'} MDE ${relative ? pct(mde) : (mde * 100).toFixed(2) + 'pp'})`);
console.log(`Variants (incl. ctrl):  ${variants}`);
console.log(`Sample per variant:     ${perVariant.toLocaleString()}`);
console.log(`Total sample needed:    ${total.toLocaleString()}`);
console.log(`Daily traffic:          ${dailyTraffic.toLocaleString()}`);
console.log(`Estimated runtime:      ${days} days (~${rawDays.toFixed(1)} raw) -> run ${fullWeeks} full week${fullWeeks > 1 ? 's' : ''}`);
console.log(`Expected conversions:   ~${conversionsPerVariant.toLocaleString()} per variant at baseline`);

if (days > 42) {
  console.log('\nWarning: runtime exceeds 6 weeks. Consider a larger MDE, more traffic,');
  console.log('or shipping on judgment instead — long tests decay (cookie churn, seasonality).');
}
if (conversionsPerVariant < 1000 && days > 28) {
  console.log('\nWarning: fewer than ~1000 conversions per variant in a reasonable window.');
  console.log('This test is likely underpowered; consider not testing.');
}
