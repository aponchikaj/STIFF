---
name: css-animation
description: "When the user wants to build or fix CSS animations that hold 60fps on real hardware. Triggers: \"CSS animation\", \"keyframes\", \"transition\", \"animation is janky\", \"60fps\", \"will-change\", \"transform\", \"animate this without a library\". Covers compositor-safe properties, the 16.7ms frame budget, will-change discipline, FLIP for layout changes, @starting-style / allow-discrete for display:none transitions, jank debugging in DevTools, reduced-motion, and production keyframe patterns — all in plain CSS or the Web Animations API, no libraries. For system-level duration/easing decisions, see motion-design. For React components, see framer-motion. For scroll-driven effects, see scroll-animation."
metadata:
  version: 1.0.0
---

# CSS Animation

Act as a rendering-performance engineer who ships animations that stay at 60fps on a mid-range Android phone, not just a dev machine. The outcome: every animation runs on the compositor thread where possible, degrades gracefully under `prefers-reduced-motion`, and any jank gets diagnosed from a DevTools trace rather than guessed at. Every fix names the pipeline stage it avoids (layout, paint, or composite) — that reasoning is what separates a real fix from cargo-culting `will-change`.

## Before Starting

Ask these, grouped, before writing keyframes:

1. **What's animating?** Which elements, which properties, triggered by what (hover, mount, state change, route change)? Is the element entering/exiting the DOM (`display: none` involved)?
2. **What devices matter?** Desktop-only dashboard or mobile-heavy traffic? Low-end Android changes the budget: assume 4x CPU slowdown, treat paint cost as 3–5x desktop.
3. **What are the jank symptoms, if any?** Stutter on start (layer promotion mid-animation), stutter throughout (layout/paint every frame), or stutter only while scrolling (main-thread contention)? Each points to a different fix.
4. **Is layout changing?** If the element's size or position in flow must actually change (accordion, reorder, card-to-detail), plan for FLIP or the grid-rows trick up front — don't animate `height` and hope.

## Property Cost: The Render Pipeline Table

Every animated property re-runs some suffix of the pipeline **Layout → Paint → Composite**. The earlier the stage you trigger, the more work per frame.

| Property | Layout | Paint | Composite | Verdict |
|---|---|---|---|---|
| `transform` (translate/scale/rotate) | – | – | ✓ | Cheap. Compositor thread; survives main-thread jank |
| `opacity` | – | – | ✓ | Cheap. Same |
| `filter`, `backdrop-filter` | – | ✓* | ✓ | Middling. GPU-accelerated paint, but `blur()` cost scales with radius² and area |
| `background-color`, `color`, `box-shadow` | – | ✓ | ✓ | Repaints the element every frame |
| `width`, `height`, `top`, `left`, `margin`, `padding`, `font-size`, `flex-basis` | ✓ | ✓ | ✓ | Expensive. Relayouts the element and everything it affects — can cascade to the whole page |

Rule: animate only `transform` and `opacity` for anything continuous or interaction-critical. Everything else is negotiable only for short, infrequent transitions on small elements.

**The 16.7ms frame budget.** 60fps means one frame every 16.7ms, and the browser needs ~3–4ms of that for its own compositing/raster work — you realistically get ~10ms of main-thread time. One layout pass on a complex page costs 5–40ms; a full-viewport paint 10ms+; a forced synchronous layout (read `offsetHeight` after a style write) can double that. Any of these inside an animation frame drops you to 30fps or worse. Compositor-only animations skip the main thread entirely, which is why they keep running even while JS is blocked.

## will-change Rules

`will-change` pre-promotes an element to its own compositor layer so promotion doesn't happen mid-animation (that promotion is itself a paint, and causes the classic "first frame stutters" bug).

- Apply it **just before** the animation starts (e.g. on hover of the parent, or via JS right before adding the animating class), and **remove it after** the animation ends.
- Each layer holds a GPU texture: roughly width × height × device-pixel-ratio² × 4 bytes. A 350×500 card at 2x DPR is ~2.8MB. Blanket `will-change: transform` on every card in a list is a GPU memory leak, not an optimization — on low-memory mobile GPUs it causes the exact jank it was meant to prevent.
- Elements that are *always* animating (an infinite spinner) may keep it permanently; that's the only case.
- Never use it "preventively" in a reset or utility class. If an animation is janky without `will-change`, first check whether you're animating a layout/paint property — `will-change` cannot fix that.

## Transition vs Animation vs Web Animations API

| | `transition` | `@keyframes` + `animation` | Web Animations API |
|---|---|---|---|
| Best for | A→B between two states | Multi-step, looping, autonomous motion | Dynamic values, playback control |
| Trigger | Property value change (class toggle, hover) | Class applied / element inserted | JS call `el.animate()` |
| Runs without JS | ✓ | ✓ | – |
| Mid-flight interruption | Reverses smoothly from current value | Restarts unless engineered around | Full control: `pause()`, `reverse()`, `playbackRate` |
| Values from data (e.g. FLIP deltas) | Awkward (inline styles) | Awkward (CSS vars) | Natural — pass numbers directly |
| Chaining/sequencing | `transition-delay` only | `animation-delay`, multiple animations | Promises: `anim.finished.then(...)` |

Default: `transition` for state changes, `@keyframes` for loops and entrances, WAAPI when values are computed at runtime (FLIP) or you need pause/reverse/seek.

## Workflow

1. **Classify the motion.** State change → transition. Loop/entrance → keyframes. Runtime-computed or controllable → WAAPI. Layout actually changing → step 3.
2. **Express it in transform/opacity.** "Slide down" is `translateY`, not `top`. "Grow" is `scale`, not `width` (watch text distortion — scale containers, counter-scale content, or use FLIP). "Fade the background" is an `opacity`-animated pseudo-element overlay, not `background-color`.
3. **If layout must change, use FLIP** — animate the *appearance* of layout change with transforms:
   1. **First**: record `el.getBoundingClientRect()` before the change.
   2. **Last**: apply the change (class toggle, DOM reorder) and measure again.
   3. **Invert**: compute deltas (`dx = first.left - last.left`, `dy`, `sx = first.width / last.width`, `sy`) and apply `transform: translate(dx, dy) scale(sx, sy)` — the element now *looks* unmoved.
   4. **Play**: animate the transform to `none`:
      ```js
      el.animate(
        [{ transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})` }, { transform: "none" }],
        { duration: 250, easing: "cubic-bezier(0.2, 0, 0, 1)" }
      );
      ```
   Layout happens once (step 2); every animated frame is compositor-only.
4. **Handle enter/exit as a pair.** Every entrance keyframe gets a mirrored exit; exits run ~30% faster (200ms in, 150ms out — leaving elements shouldn't demand attention). For elements toggling `display: none`, modern CSS handles it without JS:
   ```css
   dialog {
     transition: opacity 200ms, translate 200ms,
       display 200ms allow-discrete, overlay 200ms allow-discrete;
     opacity: 1; translate: 0 0;
   }
   dialog:not([open]) { opacity: 0; translate: 0 8px; }
   @starting-style {
     dialog[open] { opacity: 0; translate: 0 8px; }
   }
   ```
   `@starting-style` supplies the "from" values on the frame the element becomes rendered (entry); `transition-behavior: allow-discrete` on `display`/`overlay` defers the flip to `display: none` until the exit transition finishes. Baseline in all evergreen browsers since late 2024; gate with `@supports` and fall back to instant toggle.
5. **Implement reduced-motion.** Not optional — vestibular disorders make large translate/scale/parallax motion physically nauseating:
   ```css
   @media (prefers-reduced-motion: reduce) {
     *, *::before, *::after {
       animation-duration: 0.01ms !important;
       animation-iteration-count: 1 !important;
       transition-duration: 0.01ms !important;
     }
   }
   ```
   Better than the blanket kill: keep opacity fades (harmless), remove transforms. Use `0.01ms`, not `0` — `animationend`/`transitionend` still fire, so JS waiting on them doesn't hang.
6. **Verify with a trace, not eyes.** DevTools → Performance panel → enable 4x CPU throttling → record the interaction:
   - Red frame markers / frames over 16.7ms → find what filled them.
   - Purple (Layout) blocks every frame → a layout property is animating, or JS reads geometry mid-animation (layout thrash: the flame chart shows Recalculate Style → Layout repeating). Fix: move to transform, or batch reads before writes.
   - Green (Paint) blocks every frame → paint storm. Check Rendering tab → "Paint flashing"; a full-screen green flash on every frame means a large repaint region. Fix: promote the animating element, shrink what's painting, or drop the `filter`/`box-shadow` animation.
   - Long yellow (Scripting) → unrelated JS starving the main thread; compositor-only animations sail through this, so if the animation still stutters here, it isn't compositor-only yet (check the Layers panel).

## Common Mistakes

1. **Animating `height: auto` for accordions.** `height` can't transition to `auto`, and animating height is per-frame layout anyway. Fix — the grid trick, layout-cheap and handles unknown content height:
   ```css
   .accordion { display: grid; grid-template-rows: 0fr; transition: grid-template-rows 250ms; }
   .accordion.open { grid-template-rows: 1fr; }
   .accordion > .inner { overflow: hidden; min-height: 0; }
   ```
2. **`transition: all`.** Catches properties you never intended (a `width` change from a media query now animates through layout), and makes every future style change a potential animation. Fix: list properties explicitly — `transition: opacity 200ms, transform 200ms`.
3. **`will-change` on a broad selector** (`.card { will-change: transform }` across a 200-item list). Hundreds of megabytes of GPU textures; janks the exact devices you were optimizing for. Fix: apply on interaction start, remove on `transitionend`/`animationend`.
4. **Animating `box-shadow` on hover.** Repaints the element + shadow region every frame; large soft shadows are among the most expensive paints. Fix: put the final shadow on a pseudo-element with `opacity: 0` and transition its opacity — composite-only, visually identical.
5. **`left`/`top` for movement.** Per-frame layout, and subpixel positions snap to whole pixels, so motion looks steppy even when it isn't dropping frames. Fix: `transform: translate()` — subpixel-smooth and compositor-driven.
6. **Reading layout inside the animation loop.** `el.offsetHeight` or `getBoundingClientRect()` after a style write forces synchronous layout every frame. Fix: measure once before animating (FLIP does exactly this); in rAF loops, batch all reads before all writes.
7. **Infinite animations that never stop painting.** A skeleton shimmer animating `background-position` on a gradient paints every frame, forever, even off-screen. Fix: shimmer via a translating pseudo-element (composite-only, pattern below) and stop the animation when content loads or the element leaves the viewport (`animation-play-state` + IntersectionObserver).
8. **Ignoring interruption.** User re-hovers mid-exit and the keyframe animation restarts from frame 0, causing a visible jump. Fix: use transitions for interruptible state (they reverse from the current value), or WAAPI with `reverse()`.

### Reference patterns (composite-only)

```css
/* Fade-up entrance — pair with a faster mirrored exit */
@keyframes fade-up { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }
.enter { animation: fade-up 300ms cubic-bezier(0.2, 0, 0, 1) both; }

/* Skeleton shimmer — translating overlay, no background-position paint */
.skeleton { position: relative; overflow: hidden; background: #e2e5e9; }
.skeleton::after {
  content: ""; position: absolute; inset: 0;
  background: linear-gradient(90deg, transparent, rgb(255 255 255 / 0.4), transparent);
  transform: translateX(-100%); animation: shimmer 1.5s infinite;
}
@keyframes shimmer { to { transform: translateX(100%); } }

/* Spinner — rotation is composite-only; keeps spinning while main thread is blocked */
@keyframes spin { to { transform: rotate(360deg); } }
.spinner { animation: spin 800ms linear infinite; will-change: transform; }
```

## Output Format

Deliver, in order:

1. **The animation code** — complete CSS (and JS only if WAAPI/FLIP requires it), copy-pasteable, with the trigger mechanism (class name, selector state) explicit.
2. **Pipeline audit** — one line per animated property: property → deepest pipeline stage triggered → why acceptable. Flag anything above composite and justify it or replace it.
3. **Reduced-motion variant** — the `prefers-reduced-motion` block, stating what is preserved vs removed.
4. **Verification steps** — what to record in the Performance panel and what a passing trace looks like (no per-frame Layout/Paint blocks, frames under 16.7ms at 4x throttle).
5. **Compatibility notes** — only when using `@starting-style`, `allow-discrete`, or other post-2023 features: the `@supports` guard and fallback behavior.
