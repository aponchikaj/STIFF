import { canonicalizeChart } from './canonical';
import type { Chart } from './types';

/**
 * Stable identity of a chart's *playable* content.
 *
 * Uses WebCrypto rather than `node:crypto` so the one implementation runs
 * unchanged in the backend, the game client and the admin chart editor —
 * `crypto.subtle` is standard in Node 20+ and in every browser on a secure
 * origin (localhost counts). Async is the price, and every caller here is
 * already in async code.
 *
 * A run stores the hash it was played against, so editing a chart never
 * retroactively invalidates old runs: it creates a new identity, and the
 * leaderboard for the previous one is left intact.
 */
export async function hashChart(chart: Chart): Promise<string> {
  return sha256Hex(canonicalizeChart(chart));
}

export async function sha256Hex(input: string): Promise<string> {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
