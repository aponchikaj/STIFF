---
name: svg-lottie
description: "When the user wants to build, optimize, or debug animated SVG graphics and Lottie animations for web or app UIs. Use when the user says 'SVG animation', 'Lottie', 'animated icon', 'path morphing', 'stroke animation', 'line drawing effect', 'After Effects export', or 'animated illustration'. Covers technique selection (CSS SVG vs SMIL vs GSAP vs Lottie), stroke line-drawing, path morphing rules, SVG rendering performance, the After Effects to dotLottie pipeline, player and renderer choice, file-size budgets, segment-based interactivity, and accessibility. For UI transition animation, see css-animation or framer-motion. For system-level motion decisions, see motion-design."
metadata:
  version: 1.0.0
---

# SVG & Lottie Animation

Act as a motion engineer who ships vector animation that stays sharp at any resolution, loads in tens of kilobytes, and holds 60fps on mid-range phones. The outcome: the right technique chosen for the asset (not the trendiest one), stroke and morph animations that work in plain CSS where possible, and Lottie used only where designer-authored complexity justifies its runtime — exported, compressed, and wired for interactivity and reduced motion.

## Before Starting

Ask these before writing any code:

1. **Asset source** — Does the artwork exist already? As what: hand-written SVG, Figma/Illustrator export, or an After Effects composition? Who maintains it after launch — a developer (favors code-driven SVG) or a designer (favors Lottie)?
2. **Target platforms** — Web only, or also iOS/Android/React Native? Which minimum browsers? (CSS `d: path()` morphing needs Safari 18+; Lottie runs everywhere its players do.)
3. **Interactivity needs** — Fire-and-forget loop, plays-once-on-view, scroll-scrubbed, hover-reactive, or state-driven (e.g. a toggle with in/out segments)? Interactivity depth drives player and technique choice.
4. **Budget and context** — Where does it render (hero, icon button, loader, empty state)? How many animations on screen at once? Existing JS bundle pressure?

## Technique Selection

Pick the cheapest technique that meets the requirement. Complexity you don't ship is performance you keep.

| Technique | Capability | Payload cost | Control | When it wins |
|---|---|---|---|---|
| CSS-animated SVG | Transforms, opacity, stroke props, simple morphs via `d: path()` | ~0 KB runtime; just the SVG | Keyframes + media queries; no timeline scrubbing | Icons, loaders, line drawing, hover states — the default for anything a developer can author |
| SMIL (`<animate>`) | Attribute animation inside the SVG file itself | 0 KB; self-contained file | Weak — hard to pause/sync from JS | Animations that must live inside a standalone .svg (email won't run it; README badges, embedded images) |
| JS libs (GSAP + plugins) | Full timelines, staggering, MorphSVG between mismatched paths, scroll scrubbing | ~70 KB min+gzip core (+ paid plugins) | Total — seek, reverse, dynamic values | Choreographed sequences, morphs CSS can't express, physics/scroll-linked motion |
| Lottie | Anything After Effects exports: character animation, masks, complex easing | 30–150 KB asset + 20–250 KB player | Segment playback, speed, direction, frame seek | Designer-authored illustration/character work no one wants to hand-code |
| Animated icon fonts | Prebuilt icon sets with canned states | Font/JS per vendor | Vendor API only | Rarely. Only when a vendor set (e.g. Lordicon) exactly matches the design and speed-to-ship beats ownership |

Decision rule: if a developer can rebuild the motion in under a day with CSS or GSAP, do that — you gain versionable code and drop the Lottie runtime. Reach for Lottie when the After Effects file is the source of truth.

## Stroke Techniques (Line Drawing)

The line-drawing effect is one dash covering the whole path, with its offset animated. Normalize with `pathLength="1"` so you never measure path length in JS — the browser rescales dash units to a 0–1 range regardless of the path's true geometry:

```html
<svg viewBox="0 0 100 100" role="img" aria-labelledby="sig-title">
  <title id="sig-title">Signature being drawn</title>
  <path class="draw" pathLength="1" d="M10 80 C 40 10, 65 10, 95 80"
        fill="none" stroke="currentColor" stroke-width="2"/>
</svg>
```

```css
.draw {
  stroke-dasharray: 1;      /* one dash the length of the path */
  stroke-dashoffset: 1;     /* pushed fully out of view */
  animation: draw 1.2s ease-out forwards;
}
@keyframes draw { to { stroke-dashoffset: 0; } }
```

- Reverse the values (0 → 1) to "erase". Animate `stroke-dasharray` between patterns for marching-ants or dash-cycle effects.
- Stagger multiple paths with `animation-delay` (e.g. 120ms steps) so a multi-stroke illustration draws sequentially.
- Set `stroke-linecap: round` — flat caps make the drawing edge look clipped mid-animation.
- Without `pathLength="1"` you must call `getTotalLength()` per path and inject the value; that forces layout reads and breaks on responsive scaling. Use the attribute.

## Path Morphing

Browsers interpolate paths only when both shapes have the **same number of points and the same command sequence in the same order** (`M C C L Z` must match `M C C L Z`). Violate this and the animation snaps instead of morphing.

| Approach | Requirement | Support |
|---|---|---|
| CSS `d: path("...")` in keyframes | Identical point count + command order | Chrome 46+, Firefox 97+, Safari 18+ (2024) — provide a non-morphing fallback for older Safari |
| GSAP MorphSVG | None — it resamples and matches points for you | All browsers GSAP supports; paid Club plugin |
| Flubber (open source) | None — interpolates between arbitrary shapes, returns path strings | Anywhere; you drive it with rAF or a tween |

A compatible CSS morph — both paths are `M` + two `C` segments + `Z`, only coordinates differ:

```css
.blob {
  d: path("M20,50 C20,20 80,20 80,50 C80,80 20,80 20,50 Z");
  transition: d 400ms ease;
}
.blob:hover, .toggled .blob {
  d: path("M15,50 C25,10 75,30 85,50 C75,70 25,90 15,50 Z");
}
```

To hand-match points for the CSS route: author both shapes with the same tool and structure (duplicate the start shape, move its points — never redraw), convert everything to cubic curves, and verify with a diff of the command letters. SvgPathEditor (yqnn.github.io/svg-path-editor) exposes the command list for inspection. If shapes differ wildly (star to blob), add intermediate points to the simpler shape until counts match — or stop fighting and use MorphSVG/Flubber.

## SVG Performance

Same GPU rules as HTML: `transform` and `opacity` are cheap; geometry attributes (`cx`, `x`, `points`, `d`) and layout-affecting properties are not.

- Set `transform-box: fill-box; transform-origin: center;` on any SVG child you rotate or scale. Without it, `transform-origin` resolves against the whole viewBox, so elements orbit the SVG's top-left corner instead of spinning in place. This is the single most common SVG animation bug.
- Never animate an element carrying `filter` (blur, drop-shadow) or heavy masks — filters re-rasterize every frame on the CPU. Bake shadows into the artwork or apply the filter to a static parent.
- Prefer animating CSS `transform` on SVG elements over the `transform` attribute or SMIL — it composites; attribute changes repaint.
- Cap live animated nodes. Fifty paths animating independently will jank where one animated `<g>` wrapping them won't. Group and animate the group.
- Run artwork through SVGO before shipping: 2–4 decimal places of path precision is visually lossless and routinely halves file size.

## Lottie Pipeline

1. Animate in After Effects using only shape layers, transforms, masks, and track mattes.
2. Export with the Bodymovin extension (or the LottieFiles plugin) to JSON.
3. Convert JSON to **dotLottie** (`.lottie`) — a zipped container that is typically 80–90% smaller (a 120 KB JSON commonly lands at 15–25 KB). Use the LottieFiles CLI/web converter.
4. Load with a player suited to the stack:

| Player | Size (min+gzip, approx.) | Format | Notes |
|---|---|---|---|
| lottie-web | ~250 KB (svg build ~150 KB `lottie_light`) | JSON | Reference player, most feature-complete; heavy |
| lottie-react | lottie-web + ~2 KB wrapper | JSON | React lifecycle + hooks over lottie-web; same weight |
| @lottiefiles/dotlottie-web (+ dotlottie-react) | ~50 KB JS + WASM renderer | .lottie and JSON | Smallest ergonomic path to dotLottie; canvas-based ThorVG renderer |

Renderer choice in lottie-web: `svg` (default) gives crisp scaling and DOM access for styling — right for icons and small illustrations; `canvas` rasterizes but wins when animations are large, numerous, or mask-heavy. Benchmark on a real mid-range Android device before committing, not desktop Chrome.

### Lottie Budgets

- Target **under 100 KB JSON / under 30 KB dotLottie** for UI animations; hero illustrations may stretch to ~300 KB JSON, but justify it.
- **One playing animation at a time on mobile.** Pause off-screen instances with IntersectionObserver — every playing Lottie ticks rAF work even when invisible.
- Avoid AE features that don't export or export badly: layer effects (glow, blur — dropped), most expressions (only a partial whitelist converts), 3D layers, some blend modes, and embedded raster images (they inflate the JSON with base64 and defeat vector scaling). Audit the export in the LottieFiles previewer, not in AE.
- If the designer used unsupported features, the fix is in AE (pre-render to shapes, bake expressions into keyframes) — never patch the JSON by hand.

## Interactivity

- **Segment playback** — `anim.playSegments([0, 30], true)` for intro, `[30, 60]` for loop, `[60, 90]` for outro. Design AE comps with labeled segment ranges from day one; retrofitting segments into a single baked timeline is guesswork.
- **Scroll** — scrub `anim.goToAndStop(frame, true)` from scroll progress, or use `@lottiefiles/lottie-interactivity` for declarative `playOnScroll`/seek modes.
- **Hover/state** — play forward on `mouseenter`, `anim.setDirection(-1)` and play on `mouseleave`. For toggles (hamburger→X), one animation played forward/backward beats two separate files.

Reference wiring — segment map plus off-screen pause with dotlottie-web:

```js
import { DotLottie } from "@lottiefiles/dotlottie-web";

const SEGMENTS = { intro: [0, 30], loop: [30, 90], outro: [90, 120] };

const anim = new DotLottie({
  canvas: document.querySelector("#hero-anim"),
  src: "/animations/hero.lottie",
  autoplay: false,
});

anim.addEventListener("load", () => {
  anim.setSegment(...SEGMENTS.intro);
  anim.play();
});
anim.addEventListener("complete", () => {
  anim.setSegment(...SEGMENTS.loop);
  anim.setLoop(true);
  anim.play();
});

// One playing animation at a time; nothing runs off-screen.
new IntersectionObserver(([entry]) => {
  entry.isIntersecting ? anim.play() : anim.pause();
}, { threshold: 0.2 }).observe(document.querySelector("#hero-anim"));
```

## Accessibility

- Meaningful inline SVG: `role="img"` plus a `<title>` referenced by `aria-labelledby`. Decorative motion: `aria-hidden="true"`. Lottie containers: `role="img"` + `aria-label` (players render nothing readable).
- Respect `prefers-reduced-motion: reduce`: pause autoplaying loops and show the final frame, and gate CSS animations behind the media query. Reduced motion means reduced, not blank — a static end state, never an empty box.

```css
@media (prefers-reduced-motion: reduce) {
  .draw { animation: none; stroke-dashoffset: 0; } /* show finished drawing */
}
```

```js
if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
  anim.setLoop(false);
  anim.addEventListener("load", () =>
    anim.setFrame(anim.totalFrames - 1)); // static end state
}
```

## Workflow

1. Clarify asset source, platforms, interactivity, and budget (questions above).
2. Choose the technique from the selection table; state why the cheaper rows don't suffice.
3. Prepare the asset: SVGO-optimize hand-authored SVG; for Lottie, audit the AE comp for unsupported features, export via Bodymovin, convert to dotLottie, verify size against budget.
4. Implement: `pathLength="1"` stroke setup, point-matched morph paths, or player wiring with segments — per the sections above.
5. Wire interactivity and lifecycle: IntersectionObserver pause, segment map, hover/scroll bindings.
6. Add accessibility: roles, labels, reduced-motion branch.
7. Verify on a real mid-range mobile device: frame rate during animation, total payload, CPU with the tab throttled.

## Common Mistakes

1. **Reaching for Lottie for a 4-node icon.** A 250 KB player to animate a chevron. Fix: CSS on inline SVG for anything a developer can express in a day; Lottie is for designer-authored complexity.
2. **Rotating SVG children around the viewBox corner.** Missing `transform-box: fill-box`, so gears orbit instead of spin. Fix: `transform-box: fill-box; transform-origin: center;` on every transformed child.
3. **Morph that snaps instead of tweening.** Point counts or command orders differ between the two `d` values. Fix: duplicate-and-edit the start shape so structure matches, or hand mismatched shapes to MorphSVG/Flubber.
4. **Measuring paths in JS for line drawing.** `getTotalLength()` + inline dash values breaks on scaling and forces layout reads. Fix: `pathLength="1"` and animate between 1 and 0.
5. **Shipping raw Bodymovin JSON.** 400 KB of unminified JSON with base64 images inside. Fix: strip rasters in AE, convert to dotLottie (80–90% smaller), enforce the <30 KB budget.
6. **Letting off-screen Lotties run.** Three autoplaying loops below the fold burning mobile CPU. Fix: IntersectionObserver play/pause; one playing animation at a time on mobile.
7. **Animating filtered elements.** A drop-shadowed path tweening at 20fps because the filter re-rasterizes per frame. Fix: bake shadows into artwork or move the filter to a static ancestor.
8. **Ignoring reduced motion.** Infinite loops for vestibular-sensitive users, or hiding the graphic entirely. Fix: pause on `prefers-reduced-motion` and display the final frame.

## Output Format

Deliver, in order:

1. **Technique decision** — one short paragraph: chosen row from the selection table and why cheaper rows were rejected.
2. **Asset notes** — export/optimization steps taken or required (SVGO settings, Bodymovin export flags, dotLottie conversion), with before/after sizes in KB.
3. **Implementation** — complete, runnable code: inline SVG + CSS, or player setup with segment map and lifecycle wiring. No fragments that hide the hard part.
4. **Accessibility block** — the exact roles/labels and the reduced-motion branch, in the code, not as advice.
5. **Verification checklist** — payload vs budget, device tested, frame rate observed, off-screen pause confirmed.
