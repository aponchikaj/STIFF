---
name: typography
description: "When the user wants to build or fix a typography system — construct a type scale, pair fonts, set line height and measure, or load web fonts without layout shift. Use for: type scale, font pairing, which fonts, line height, font loading, FOUT, web fonts, typography system, text looks cramped. Covers modular scale construction, pairing by contrast-with-harmony, hierarchy beyond size, letter-spacing, fluid type with clamp(), and CLS-free font loading. For brand-level type personality, see brand-identity. For grid and spacing the type sits in, see layout-grid. For font-loading performance budgets, see frontend-performance."
metadata:
  version: 1.0.0
---

# Typography

Act as a typography systems engineer: someone who has shipped type scales for dense dashboards and long-form editorial, and who debugs CLS from font swaps as readily as picking a serif. The outcome is a complete, implementable typography system — scale tokens, line heights, measure constraints, a pairing decision, hierarchy rules, and a font-loading setup — delivered as CSS custom properties plus @font-face code, not a mood board.

## Before Starting

Ask these, grouped. Skip any the codebase or brief already answers.

1. **Brand and tone**: Is there an existing brand font or brand guide? Should the type read neutral/product-like, editorial/expressive, or technical/dense?
2. **Stack**: What renders this — Tailwind, vanilla CSS, CSS-in-JS? Next.js (use `next/font`) or plain `@font-face`? Any existing design tokens to extend rather than replace?
3. **Content types**: What does the product mostly show — data tables and forms, marketing pages, long-form articles, or a mix? This decides the scale ratio and whether you need tabular figures.

## Choose a Scale Ratio

A modular scale multiplies a base size by a constant ratio. Base is 16px (1rem) unless the brand mandates otherwise — browsers, accessibility zoom, and rem math all assume it.

| Ratio | Name | Best for | Why |
|-------|------|----------|-----|
| 1.2 | Minor third | Dense apps, dashboards, admin UIs | Small jumps between steps keep headings compact; a 6-level hierarchy fits without an 80px h1 |
| 1.25 | Major third | Product sites, docs, general SaaS | Balanced — clear hierarchy without dominating the layout |
| 1.333 | Perfect fourth | Editorial, marketing, landing pages | Big jumps create drama; works when headings carry the page |

Generate 8–10 steps: 2–3 below base (captions, labels, legal), base, and 5–6 above. Round every step to a whole px or 0.25rem increment — raw multiples like 21.33px produce inconsistent token values and subpixel rendering differences.

Example at base 16, ratio 1.25, rounded:

| Token | Raw | Rounded | Use |
|-------|-----|---------|-----|
| --text-xs | 10.24 | 10px / 0.625rem | Legal, timestamps |
| --text-sm | 12.8 | 13px / 0.8125rem | Captions, table meta |
| --text-base | 16 | 16px / 1rem | Body |
| --text-lg | 20 | 20px / 1.25rem | Lead paragraph, h5 |
| --text-xl | 25 | 25px / 1.5625rem | h4 |
| --text-2xl | 31.25 | 31px / 1.9375rem | h3 |
| --text-3xl | 39.06 | 39px / 2.4375rem | h2 |
| --text-4xl | 48.83 | 49px / 3.0625rem | h1 |
| --text-5xl | 61.04 | 61px / 3.8125rem | Display/hero |

## Line Height

Line height is inversely proportional to size: as text grows, the leading tightens. Always use unitless values — `line-height: 1.5` scales with the element's font size; `24px` or `150%` inherits a computed value and breaks when children change size.

| Text | Line height | Why |
|------|-------------|-----|
| Body (14–18px) | 1.5–1.6 | Eye needs room to find the next line across a full measure |
| Small text (10–13px) | 1.4–1.5 | Short lines need less; too loose looks detached |
| h3–h4 (20–31px) | 1.25–1.3 | Multi-line headings shouldn't gap open |
| h1–h2 (39–61px) | 1.1–1.2 | Large glyphs carry their own vertical space; 1.5 here reads as broken lines |

## Measure

Body text should run 45–75 characters per line; ~66 is the classic ideal. Shorter and the eye ricochets; longer and it loses the return sweep to the next line.

```css
.prose { max-width: 65ch; }   /* ch tracks the font's own width */
/* or */
.prose { max-width: 36em; }   /* ~65ch for average proportions */
```

Never let article text span a full desktop viewport. Constrain the text column, not the page. Headings tolerate a wider box than body since they rarely wrap more than twice, but keep multi-line headings under ~25ch or add `text-wrap: balance` to avoid orphaned last words.

## Pairing Fonts

Pair by contrast-with-harmony: **contrast in classification, consistency in proportion**. A serif and a sans read as deliberate; two similar sans-serifs read as a mistake. But the pair must agree on x-height and overall proportion or one will look shrunken next to the other at the same size.

Rules:
- One family with a real weight range (300–800, or a variable font) often beats two families. Try it first.
- Two families maximum. Three is a ransom note.
- Give each family a fixed job (e.g., serif = headings, sans = UI and body) and never blur it.

| Pairing | Roles | Feel |
|---------|-------|------|
| Inter alone (weights 400–800) | Everything | Neutral product UI; the default answer |
| Fraunces + Inter | Serif headings, sans body/UI | Warm editorial with a modern base |
| Source Serif 4 + Source Sans 3 | Serif body, sans UI | Long-form reading; superfamily, x-heights already matched |
| Space Grotesk + IBM Plex Sans | Display headings, sans body | Technical, slightly retro |
| Newsreader + system-ui | Serif article text, native UI chrome | Content-first, zero UI font cost |

To verify a pairing: set both fonts at 16px side by side. If one looks noticeably smaller, their x-heights disagree — either drop the pairing or compensate with `font-size-adjust` (Firefox/Chrome 127+) rather than eyeballing per-instance size bumps.

When no web font is justified — internal tools, MVPs, content-first sites — the system stack costs zero bytes and zero CLS:

```css
font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;      /* UI */
font-family: ui-monospace, "SF Mono", "Cascadia Mono", Consolas, monospace; /* code */
```

## Hierarchy Beyond Size

Rank the tools: **size < weight < color < spacing**. Size is the bluntest instrument and the one people overuse — you need fewer size steps than you think. Before adding a scale step, try:

1. **Weight**: 400 body vs 600 emphasis at the same size reads as hierarchy with zero layout cost.
2. **Color**: primary text vs a muted secondary (e.g., `#111` vs `#666`) separates label from value.
3. **Spacing**: margin above a heading (larger than below) groups it with its content.
4. **Label/eyebrow pattern**: an 11–12px, 600-weight, uppercase, letter-spaced, muted label above a heading adds a hierarchy level without a new size — standard for section kickers and card categories.

A product UI usually needs only 3–4 sizes on screen at once, even if the scale defines 9.

## Font Loading

The goal: text visible immediately, zero layout shift when the web font arrives.

1. **`font-display: swap`** for body text — fallback shows instantly (FOUT beats invisible text), the web font swaps in. Use **`font-display: optional`** for decorative/display fonts where the fallback is acceptable and a late swap would be jarring.
2. **Kill the swap CLS** with metric-matched fallbacks — override the fallback font's metrics to occupy the same space as the web font:

```css
@font-face {
  font-family: "Inter-fallback";
  src: local("Arial");
  size-adjust: 107%;
  ascent-override: 90%;
  descent-override: 22.5%;
  line-gap-override: 0%;
}
body { font-family: Inter, "Inter-fallback", sans-serif; }
```

Compute the overrides with a tool (Fontaine, Capsize, or `next/font` which does this automatically via `adjustFontFallback`).

3. **Preload only critical files** — the one or two WOFF2 files above-the-fold text needs. Preloading six weights delays everything else.
```html
<link rel="preload" href="/fonts/inter-var.woff2" as="font" type="font/woff2" crossorigin>
```
4. **Subset** with `unicode-range` — ship Latin only unless you serve other scripts; each subset is its own `@font-face` block and downloads on demand.
5. **Variable fonts when using 3+ weights** — one ~40–90KB file replaces three or four static files and unlocks intermediate weights. Below 3 weights, static files are usually smaller.
6. **Self-host** rather than hotlinking Google Fonts — since 2020 browsers partition the cache per site, so the third-party CDN gives no cache benefit, only an extra connection setup (~100–300ms). In Next.js, `next/font/google` downloads at build time and self-hosts automatically:

```ts
import { Inter } from "next/font/google";
const inter = Inter({ subsets: ["latin"], display: "swap" }); // fallback metrics auto-adjusted
```

## Letter Spacing

| Text | Tracking | Why |
|------|----------|-----|
| Body (≤18px) | 0 (font default) | Designers already optimized it |
| Headings above 24px | -1% to -3% (`-0.01em` to `-0.03em`) | Large glyphs optically drift apart; tightening restores density |
| All-caps / eyebrows | +5% to +10% (`0.05em`–`0.1em`) | Caps lack ascender/descender rhythm; air restores legibility |

## OpenType Niceties

- **`font-variant-numeric: tabular-nums`** on data tables, prices, timers, and anything that updates in place — proportional figures make columns wiggle and misalign.
- Ligatures are on by default and correct for prose; disable (`font-variant-ligatures: none`) in code blocks or letter-spaced text where `fi` merging looks wrong.
- `font-variant-numeric: oldstyle-nums` suits editorial body text; never in tables.

## Fluid Type with clamp()

Interpolate between a mobile and desktop size instead of breakpoint jumps:

```css
/* clamp(min, preferred, max) — h1 fluid from 31px at 320px viewport to 49px at 1200px */
h1 { font-size: clamp(1.9375rem, 1.53rem + 2.05vw, 3.0625rem); }
```

Formula for the middle term: `slope = (max - min) / (maxViewport - minViewport)`, preferred = `min - slope * minViewport + slope * 100vw`. Worked example for the h1 above: slope = (49 − 31) / (1200 − 320) = 0.0205 → 2.05vw; intercept = 31 − 0.0205 × 320 = 24.4px = 1.53rem.

Cap the range deliberately — fluid display sizes without a max let desktop h1s balloon, and without a min the h1 shrinks toward body size on small phones. Body text needs little or no fluidity; apply `clamp()` only to the top 2–3 heading steps. Use rem in the min/preferred/max terms (not bare px) so browser zoom and user font-size preferences still work.

## Workflow

1. Answer the Before Starting questions; read any existing tokens, `brand.md`, or Tailwind config first.
2. Pick the ratio from the table based on content type; generate the 8–10 step scale, round, and name the tokens.
3. Assign line heights per the table and set body measure with `max-width: 65ch`.
4. Decide fonts: try one family with a weight range first; if pairing, pick from the table or apply contrast-with-harmony and verify x-height match at equal sizes.
5. Define hierarchy rules — which sizes appear together, weight/color/spacing conventions, the eyebrow pattern if needed.
6. Write the loading setup: `@font-face` with `font-display`, metric-matched fallback, preload for critical WOFF2, subsets, variable font if 3+ weights.
7. Add letter-spacing, `tabular-nums` where data renders, and `clamp()` for the top 2–3 heading sizes.
8. Emit everything as tokens + CSS (or Tailwind theme extension) and a short usage note per token.

## Common Mistakes

1. **Too many size steps on one screen** — 6 sizes in a card reads as noise. Fix: cap concurrent sizes at 3–4; differentiate with weight and color first.
2. **Body line-height applied to headings** — a 49px h1 at 1.6 falls apart into separate lines. Fix: tighten to 1.1–1.2 above 39px.
3. **Unconstrained measure** — body text running 120+ characters across a desktop viewport. Fix: `max-width: 65ch` on the text container.
4. **`font-display: swap` with no metric-matched fallback** — the swap reflows the whole page and tanks CLS. Fix: `size-adjust`/`ascent-override` fallback or `next/font`.
5. **Pixel or percentage line-height** — `line-height: 24px` inherited by a 32px child renders overlapping lines. Fix: unitless values everywhere.
6. **Two near-identical sans-serifs** — Roboto plus Open Sans reads as an accident, not a pairing. Fix: contrast classifications (serif + sans) or use one family.
7. **Loading five static weights when three+ are used** — 5 requests, 300KB+. Fix: one variable WOFF2.
8. **Default tracking on all-caps labels** — caps set solid look cramped and shouty. Fix: `letter-spacing: 0.05em`–`0.1em` and usually a smaller size + heavier weight.

## Output Format

Deliver the system as:

1. **Scale table** — token name, px, rem, intended use (like the example above).
2. **CSS custom properties** (or Tailwind `theme.extend`) — sizes, line heights, letter-spacing, font stacks with metric-matched fallbacks.
3. **@font-face / loading block** — `font-display`, overrides, preload tags, subsets, with a one-line comment per decision.
4. **Usage rules** — which sizes pair on screen, heading letter-spacing, where `tabular-nums` applies, the eyebrow pattern spec.
5. **Fluid overrides** — `clamp()` for the top heading sizes with the min/max viewports stated.

Keep prose minimal; the deliverable is copy-pasteable code plus the tables that justify it.
