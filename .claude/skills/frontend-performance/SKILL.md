---
name: frontend-performance
description: "When the user wants to diagnose and fix slow web pages — poor Core Web Vitals, bloated JavaScript, or sluggish interactions. Triggers: \"site is slow\", \"LCP\", \"INP\", \"CLS\", \"Core Web Vitals\", \"bundle size\", \"lazy loading\", \"hydration\", \"lighthouse score\". Covers performance budgets, field-vs-lab diagnosis, the LCP/INP/CLS fix ladders, bundle splitting and dependency audits, network waterfall analysis, image and third-party discipline, and caching layers, with a bundled script that reports build-output sizes against budget. For render-cost fixes inside React components, see react-patterns. For compositor-safe animation, see css-animation. For CWV's ranking impact, see seo-technical."
metadata:
  version: 1.0.0
---

# Frontend Performance

Act as a web performance engineer who has shipped Core Web Vitals fixes on high-traffic production sites. The outcome: the user's pages pass CWV thresholds at the 75th percentile of real field data, the initial JS payload fits a budget, and every fix is verified against measurement — not vibes. Diagnose before prescribing; a page that "feels slow" can be a TTFB problem, a hydration problem, or a 4MB hero image, and the fixes share nothing.

## Before Starting

Ask these, grouped, and wait for answers before recommending anything:

1. **Stack and rendering model** — Which framework (Next.js, Remix, Vite SPA, Astro, plain HTML)? Server-rendered, static, or client-rendered? Which hosting/CDN?
2. **Current metrics** — Do you have field data (CrUX, Vercel Analytics, RUM tool)? What are p75 LCP/INP/CLS today? If only Lighthouse scores exist, say so — that changes how much we trust the numbers.
3. **Worst pages and users** — Which routes are slowest, and is the pain concentrated on mobile, specific geographies, or logged-in views? Optimizing the homepage when checkout is the slow page wastes the effort.

If the user has no data at all, step 1 of the workflow generates it before any code changes.

## Budgets

Hold every page to these targets, measured at p75 of field data (not lab, not your dev machine):

| Metric | Target | What it measures | Typical culprit |
|---|---|---|---|
| LCP | < 2.5s | Largest content paint | Slow TTFB, late-discovered hero image, render-blocking CSS/JS |
| INP | < 200ms | Worst interaction latency | Long tasks, hydration cost, heavy event handlers |
| CLS | < 0.1 | Layout shift score | Unsized images/embeds, font swaps, injected banners |
| TTFB | < 800ms | Server + network to first byte | No CDN, uncached SSR, slow origin/data fetches |
| Initial JS | ~200KB gzipped | JS shipped on first route load | Barrel imports, heavy deps, no code splitting |

The 200KB JS figure is a working target, not a spec — mid-range Android phones spend roughly 1ms of parse/compile per KB, so 200KB gzipped already costs several hundred ms of main-thread time before your app does anything. Run `scripts/bundle-report.js` to see where you stand.

Route symptoms to sections with this table:

| Symptom | Failing metric | Go to |
|---|---|---|
| "Page takes forever to show content" | LCP, TTFB | LCP Fix Ladder, Waterfall Analysis, Caching Layers |
| "Clicks/typing feel laggy" | INP | INP Fix Ladder |
| "Content jumps around while loading" | CLS | CLS Fixes |
| "Bundle is huge / build warns about chunk size" | LCP + INP | Bundle Strategy |
| "Fast on wifi, slow on phones" | All | Field vs Lab, then re-diagnose throttled |
| "Got slow after adding analytics/chat/ads" | LCP + INP | Third-Party Scripts |

## Field vs Lab Data

| | Field (CrUX, RUM) | Lab (Lighthouse, WebPageTest) |
|---|---|---|
| What it is | Real users, real devices, real networks | One synthetic run, throttled |
| Answers | "Do we have a problem, and how bad?" | "Why, and where exactly?" |
| Trustworthy for | Pass/fail against budgets, trends | Waterfalls, traces, element attribution |
| Fails at | Telling you which resource caused it | Representing your actual users |

Field data is the truth; Lighthouse is a debugging microscope. Diagnose in the lab, verify in the field. A Lighthouse score of 95 on your MacBook means nothing if CrUX shows p75 LCP at 4.1s on mobile — and a fix isn't done until field p75 moves, which takes up to 28 days of CrUX collection to confirm. Never report a Lighthouse score as "our performance."

## LCP Fix Ladder

Work top to bottom; stop when field p75 crosses 2.5s. Each rung typically buys more than the ones below it.

1. **Identify the LCP element.** DevTools Performance panel or `PerformanceObserver({type: 'largest-contentful-paint'})`. Everything else depends on knowing whether it's a hero image, a text block, or (worse) something behind client-side rendering.
2. **Server-render it.** If the LCP element only appears after JS runs, no amount of asset tuning helps — the ceiling is your bundle download + execute time. SSR/SSG the route or at least the above-fold content.
3. **Preload its image or font.** `<link rel="preload" as="image" href="...">` for a hero discovered late (CSS background images and JS-set sources are invisible to the preload scanner). Preload the text font if LCP is a heading.
4. **Priority hints.** `fetchpriority="high"` on the LCP `<img>`; browsers default images to low priority until layout. In Next.js this is `priority` on `next/image`. Simultaneously ensure the LCP image is never `loading="lazy"`.

   ```html
   <!-- head: only if the image is late-discovered (CSS bg, JS-set src) -->
   <link rel="preload" as="image" href="/hero.avif" fetchpriority="high">

   <!-- the LCP element itself -->
   <img src="/hero.avif" width="1200" height="600" fetchpriority="high" alt="…">
   ```

5. **Cut TTFB.** LCP can't beat 2.5s if TTFB is 1.8s. CDN in front of the origin, cache SSR HTML (ISR/stale-while-revalidate), move blocking data fetches out of the critical path or closer to the edge.
6. **Remove render-blocking resources.** Inline critical CSS, `defer` all scripts, drop unused CSS bundles. Check the "Eliminate render-blocking resources" Lighthouse audit for the list.

## INP Fix Ladder

1. **Long-task audit.** Performance panel, find tasks > 50ms; the interaction that overlaps the longest task is your INP. Attribute with `PerformanceObserver({type: 'event'})` or the web-vitals library's INP attribution build.
2. **Break up long tasks.** Yield to the main thread between chunks of work: `scheduler.yield()` where available, else `await new Promise(r => setTimeout(r, 0))` between iterations. Paint happens between tasks — a 400ms task blocks every click for 400ms.

   ```js
   const yieldToMain = () =>
     'scheduler' in window && 'yield' in scheduler
       ? scheduler.yield()
       : new Promise((r) => setTimeout(r, 0));

   for (const batch of chunk(items, 100)) {
     process(batch);
     await yieldToMain(); // browser can paint and handle input here
   }
   ```

3. **Cut hydration cost.** Hydration is often the single biggest long task. Move static content to server components (Next.js App Router) or islands (Astro); a component that never re-renders on the client shouldn't ship or hydrate its JS.
4. **Event-handler hygiene.** Do the minimum synchronously (update UI state), defer the rest (analytics, recalculation) to after paint. Debounce input handlers; don't read layout (`offsetHeight`) then write styles in a loop — that forces synchronous reflow.
5. **Web workers for heavy compute.** Parsing large payloads, diffing, search indexing — anything > 50ms of pure computation belongs off the main thread. Comlink makes the message-passing tolerable.

## CLS Fixes

| Shift source | Fix |
|---|---|
| Images/videos without dimensions | Always set `width`/`height` (or `aspect-ratio`); browser reserves space before load |
| Web font swap reflow | `font-display: swap` plus metric-matched fallback (`size-adjust`, `ascent-override`) or `next/font`, which does this automatically |
| Late-injected content (banners, ads, embeds) | Reserve the slot with `min-height` before the content arrives; never insert above existing content |
| Animating `top`/`left`/`height` | Animate `transform` and `opacity` only — they don't trigger layout |

Metric-matched fallback, hand-rolled (skip if the framework's font tooling does it):

```css
@font-face {
  font-family: 'Inter-fallback';
  src: local('Arial');
  size-adjust: 107%;        /* tune until fallback text occupies the same box */
  ascent-override: 90%;
  descent-override: 22%;
}
body { font-family: Inter, 'Inter-fallback', sans-serif; }
```

CLS is the cheapest vital to fix — most shifts are one missing attribute — and the most annoying to users. Don't let it linger because the other metrics look scarier.

## Bundle Strategy

- **Route-level code splitting is table stakes.** Every framework does it by default; verify nothing has broken it (a shared layout importing a page-only heavy lib un-splits it for every route).
- **Dynamic-import below-fold and interaction-gated components.** Modals, charts, editors, anything behind a click. The user pays for it when they use it, not on first paint.

  ```jsx
  // Next.js — chart ships only when rendered, never in the entry chunk
  const Chart = dynamic(() => import('./Chart'), { ssr: false, loading: () => <Skeleton /> });

  // Plain React — same idea
  const Editor = React.lazy(() => import('./Editor'));

  // Non-component code: load on the interaction that needs it
  button.addEventListener('click', async () => {
    const { exportPdf } = await import('./export-pdf.js');
    exportPdf(doc);
  });
  ```

- **Tree-shaking traps.** Barrel files (`import { Button } from '@/components'`) can drag the whole directory into every chunk — import from the concrete file, or configure `optimizePackageImports`. Libraries without `"sideEffects": false` in package.json defeat dead-code elimination.
- **Dependency audit — bundlephobia mindset.** Before adding a dep, check its gzipped cost. Classic swaps: moment (~70KB) → date-fns or Temporal-polyfill-free `Intl`; lodash → per-method imports or native; axios → `fetch`. One 80KB dep can be 40% of your entire budget.
- **Measure, don't guess.** Run the bundled script for a per-file size table with gzip estimates and budget warnings:

```bash
node .claude/skills/frontend-performance/scripts/bundle-report.js        # auto-detects .next/dist/build
node .claude/skills/frontend-performance/scripts/bundle-report.js dist --budget=200
```

For chunk-content attribution (which dep is inside the big chunk), follow up with `@next/bundle-analyzer` or `rollup-plugin-visualizer`.

## Waterfall Analysis

DevTools Network panel, throttled to Fast 4G, cache disabled:

1. Find the LCP resource and walk backwards through its request chain — HTML → CSS → font/image, or worse, HTML → JS → API → image. Each arrow is a serial round trip; three chained requests on a 200ms RTT link is 600ms before the resource even starts downloading.
2. Flag serial fetches that could be parallel: an API call that waits for a JS bundle that waits for another JS bundle. Hoist the data fetch to the server or kick it off in `<head>`.
3. `<link rel="preconnect">` third-party origins on the critical path (fonts, image CDN) — saves DNS + TCP + TLS, typically 100–300ms each on mobile.
4. Anything render-blocking that isn't needed for first paint gets `defer`, `media="print"` tricks, or deleted.

## Images

- Serve AVIF with WebP fallback (`<picture>`, or automatic via `next/image` / an image CDN). AVIF is typically 30–50% smaller than JPEG at equivalent quality.
- `srcset` + `sizes` so a 400px-wide card doesn't download a 2000px original. Most oversized-image bytes come from missing `sizes`, not missing formats.
- `loading="lazy"` for below-fold images — but never the LCP image; lazy-loading it adds a full discovery delay to your worst metric.
- Explicit dimensions on everything (see CLS table).

## Third-Party Scripts

1. Inventory with a request-domain breakdown (DevTools or a WebPageTest run); teams routinely find tags nobody owns. Delete first, optimize second — tag-manager sprawl means marketing can add 300KB without a code review.
2. `defer`/`async` everything; no third-party script deserves render-blocking placement.
3. Facade pattern for heavy embeds: render a static thumbnail for YouTube/chat/maps and load the real embed on click (`lite-youtube-embed` style). A YouTube embed costs ~500KB+ of JS for a video most users never play.
4. Load analytics/marketing tags after load or on first interaction, not in `<head>`.

## Caching Layers

| Layer | Policy | Why |
|---|---|---|
| Hashed static assets (`app.3f2a1b.js`) | `Cache-Control: public, max-age=31536000, immutable` | Content-addressed names never change content; repeat visits pay zero |
| HTML / SSR pages | `s-maxage` + `stale-while-revalidate` at the CDN (or ISR) | Serves cached instantly, revalidates in background — TTFB drops to edge latency |
| API responses | Short `s-maxage` or SWR where freshness allows | Removes origin round trips from the interaction path |
| Everything | CDN in front of origin | TTFB budget (<800ms) is unmeetable cross-continent without edge caching |

## Workflow

1. **Establish the baseline.** Pull CrUX (PageSpeed Insights shows it) or RUM p75 for the worst pages. No field data? Add the `web-vitals` library or enable the host's analytics now — fixes without a baseline can't be verified.

   ```js
   import { onLCP, onINP, onCLS, onTTFB } from 'web-vitals/attribution';
   const report = (m) =>
     navigator.sendBeacon('/vitals', JSON.stringify({
       name: m.name, value: m.value, rating: m.rating,
       target: m.attribution?.element ?? m.attribution?.interactionTarget,
       page: location.pathname,
     }));
   onLCP(report); onINP(report); onCLS(report); onTTFB(report);
   ```

2. **Pick the failing metric.** Fix the one failing worst at p75; don't shotgun. Each metric has its own ladder above.
3. **Reproduce in the lab.** Lighthouse/Performance trace with mobile CPU + network throttling until the lab shows the same symptom as the field. If you can't reproduce it, you're about to fix the wrong thing.
4. **Run the bundle report** (if JS weight is implicated) and the waterfall analysis (if load timing is). Identify the top 2–3 concrete causes with numbers attached.
5. **Apply the ladder rungs** for the failing metric, one change at a time, re-measuring in the lab after each. Keep changes that move the number; revert ones that don't.
6. **Verify in the field.** Ship, then watch p75 over the following days/weeks. Close the loop only when field data crosses the threshold.
7. **Install a regression guard.** Wire the bundle-report script (or `size-limit`) into CI with the budget as a hard limit; performance regressions arrive one innocent PR at a time.

## Common Mistakes

1. **Optimizing to Lighthouse score instead of field data.** The score is a lab composite with its own weighting; users experience p75 field metrics. Fix: treat CrUX/RUM as the acceptance test, Lighthouse as the debugger.
2. **Lazy-loading the LCP image.** `loading="lazy"` on the hero delays discovery until layout, adding hundreds of ms to LCP. Fix: eager + `fetchpriority="high"` for the LCP image, lazy for everything below the fold.
3. **Chasing bundle size when TTFB is the problem** (or vice versa). A 2s TTFB caps LCP no matter how small the JS; a 900KB bundle ruins INP no matter how fast the server. Fix: read the waterfall before choosing a fix.
4. **Preloading everything.** Ten `rel="preload"` tags compete with the actual critical resource for bandwidth and can make LCP worse. Fix: preload only the 1–2 resources on the LCP critical path.
5. **Breaking up long tasks with `requestIdleCallback` for user-facing work.** Idle callbacks may never fire on a busy page, stalling the interaction indefinitely. Fix: `scheduler.yield()` / `setTimeout(0)` chunking so work continues promptly but paint can interleave.
6. **Trusting `"it's code-split"` without checking chunk contents.** A barrel import or a shared provider can silently pull a heavy lib into the entry chunk. Fix: run the bundle report; if a chunk is suspiciously large, open the analyzer and attribute it.
7. **Fixing CLS by making content pop in faster.** Speed doesn't remove the shift; reserved space does. Fix: dimensions, `min-height` slots, metric-matched fallback fonts.
8. **Declaring victory from a single lab run.** Lab variance between runs is easily ±10%; one good run proves nothing. Fix: median of 3–5 runs for lab claims, field p75 for real claims.

## Output Format

Deliver findings as:

1. **Scorecard** — table of LCP / INP / CLS / TTFB / initial-JS vs budget, marked pass/fail, with the data source (field or lab) for each number.
2. **Diagnosis** — the 2–3 root causes, each with the evidence (waterfall chain, long-task trace, bundle-report line) and estimated impact.
3. **Fix plan** — ordered list, biggest expected win first; for each: the concrete change, file(s) touched, expected metric movement, and effort (S/M/L).
4. **Verification plan** — which lab check confirms each fix pre-ship, and which field metric confirms it post-ship, including the CI budget guard.

When implementing fixes directly, make one change per step and state the before/after measurement alongside the diff.
