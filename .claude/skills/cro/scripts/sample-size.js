#!/usr/bin/env node
/**
 * sample-size.js — required sample size per variant for a two-proportion A/B test.
 *
 * Usage:
 *   node sample-size.js --baseline 0.03 --mde 0.20
 *   node sample-size.js --baseline 0.03 --mde 0.20 --power 0.8 --alpha 0.05 --absolute
 *   node sample-size.js 0.03 0.20            (positional: baseline, mde)
 *
 * Options:
 *   --baseline   Baseline conversion rate as a decimal (e.g. 0.03 for 3%). Required.
 *   --mde        Minimum detectable effect. Relative by default (0.20 = detect a
 *                20% lift, i.e. 3.0% -> 3.6%). Required.
 *   --absolute   Treat --mde as an absolute change in rate (0.01 = 3% -> 4%).
 *   --power      Statistical power (1 - beta). Default 0.8.
 *   --alpha      Two-sided significance level. Default 0.05.
 *
 * Output: required sample size per variant (and total), using the standard
 * two-sided z-test formula for comparing two proportions:
 *   n = (z_{1-a/2} * sqrt(2*pbar*(1-pbar)) + z_{1-b} * sqrt(p1(1-p1)+p2(1-p2)))^2 / (p2-p1)^2
 */

'use strict';

// Inverse standard normal CDF (Acklam's rational approximation, ~1e-9 accuracy).
function zQuantile(p) {
  if (p <= 0 || p >= 1) throw new Error('quantile input must be in (0,1)');
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2,
             1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2,
             6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838,
             -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996,
             3.754408661907416];
  const pLow = 0.02425, pHigh = 1 - pLow;
  let q, r;
  if (p < pLow) {
    q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
           ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    q = p - 0.5;
    r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
           (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
          ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

function sampleSizePerVariant({ baseline, mde, absolute = false, power = 0.8, alpha = 0.05 }) {
  const p1 = baseline;
  const p2 = absolute ? baseline + mde : baseline * (1 + mde);
  if (p1 <= 0 || p1 >= 1) throw new Error('baseline must be between 0 and 1 (exclusive)');
  if (p2 <= 0 || p2 >= 1) throw new Error(`target rate ${p2.toFixed(4)} is outside (0,1); check --mde`);
  if (p2 === p1) throw new Error('mde must be non-zero');

  const zAlpha = zQuantile(1 - alpha / 2); // two-sided
  const zBeta = zQuantile(power);
  const pBar = (p1 + p2) / 2;
  const numerator = Math.pow(
    zAlpha * Math.sqrt(2 * pBar * (1 - pBar)) +
    zBeta * Math.sqrt(p1 * (1 - p1) + p2 * (1 - p2)),
    2
  );
  const n = numerator / Math.pow(p2 - p1, 2);
  return { perVariant: Math.ceil(n), p1, p2 };
}

function parseArgs(argv) {
  const opts = { power: 0.8, alpha: 0.05, absolute: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--baseline': opts.baseline = parseFloat(argv[++i]); break;
      case '--mde': opts.mde = parseFloat(argv[++i]); break;
      case '--power': opts.power = parseFloat(argv[++i]); break;
      case '--alpha': opts.alpha = parseFloat(argv[++i]); break;
      case '--absolute': opts.absolute = true; break;
      case '--help':
      case '-h': opts.help = true; break;
      default: positional.push(arg);
    }
  }
  if (opts.baseline === undefined && positional[0] !== undefined) opts.baseline = parseFloat(positional[0]);
  if (opts.mde === undefined && positional[1] !== undefined) opts.mde = parseFloat(positional[1]);
  return opts;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help || opts.baseline === undefined || opts.mde === undefined ||
      Number.isNaN(opts.baseline) || Number.isNaN(opts.mde)) {
    console.log('Usage: node sample-size.js --baseline <rate> --mde <effect> [--absolute] [--power 0.8] [--alpha 0.05]');
    console.log('Example: node sample-size.js --baseline 0.03 --mde 0.20   # detect a 20% relative lift from a 3% baseline');
    process.exit(opts.help ? 0 : 1);
  }

  const { perVariant, p1, p2 } = sampleSizePerVariant(opts);
  const pct = (x) => (x * 100).toFixed(2) + '%';

  console.log('Two-proportion test, two-sided');
  console.log(`  Baseline rate:      ${pct(p1)}`);
  console.log(`  Target rate:        ${pct(p2)} (MDE ${opts.absolute ? '+' + pct(opts.mde) + ' absolute' : (opts.mde * 100).toFixed(1) + '% relative'})`);
  console.log(`  Power:              ${opts.power}   Alpha: ${opts.alpha}`);
  console.log(`  Required per variant: ${perVariant.toLocaleString('en-US')}`);
  console.log(`  Total (2 variants):   ${(perVariant * 2).toLocaleString('en-US')}`);
}

if (require.main === module) main();
module.exports = { sampleSizePerVariant, zQuantile };
