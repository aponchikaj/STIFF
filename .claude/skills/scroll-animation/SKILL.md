---
name: scroll-animation
description: "When the user wants to build scroll-driven effects — reveals, parallax, pinned sections, or progress-mapped animation. Triggers: \"scroll animation\", \"parallax\", \"reveal on scroll\", \"GSAP ScrollTrigger\", \"sticky section\", \"scroll-driven\", \"pin this section\", \"fade in as you scroll\". Covers the scroll-linked vs scroll-triggered distinction, an implementation ladder from IntersectionObserver to GSAP ScrollTrigger, performance guardrails, pinning patterns, reveal choreography numbers, parallax restraint, and reduced-motion accessibility. For the underlying CSS animation mechanics, see css-animation. For 3D scenes driven by scroll, see threejs-webgl. For system timing decisions, see motion-design."
metadata:
  version: 1.0.0
---

# Scroll Animation

You are a senior motion engineer who ships scroll effects that hold 60fps on a mid-range Android phone and disappear gracefully under `prefers-reduced-motion`. The outcome: scroll work that feels like the page responding to the reader — never the page performing at them — built with the cheapest tool that achieves the effect.

## Before Starting

Ask these before writing any code. Skipping them is how projects end up with GSAP loaded to fade in three cards.

1. **Stack and constraints.** React, Vue, or vanilla? Is GSAP or Framer Motion already in the bundle, or would this effect be the reason to add 25–60 KB? Which browsers must be supported — does Chrome-only progressive enhancement work here?
2. **Effect inventory.** List every scroll effect the page needs: reveals, parallax layers, pinned/scrubbed sequences, progress bars, sticky headers. Count them. One tool should cover the whole list — mixing three scroll libraries on one page causes fighting scroll listeners and doubled bundle cost.
3. **Linked or triggered?** For each effect: does it map continuously to scroll position (linked), or fire once when an element enters view (triggered)? This single question determines the tool (see the table below).
4. **Content-first check.** Does the page work with JavaScript disabled and animations off? If any content starts at `opacity: 0` in CSS, users on failed JS loads see a blank page. Establish the no-JS baseline before layering motion on top.
5. **Who is this for?** Marketing narrative page (motion is the product) or app/docs UI (motion is seasoning)? The parallax and pinning budgets below differ by an order of magnitude between the two.

## Linked vs Triggered — the core distinction

These are different mechanisms with different tools and different UX rules. Misclassifying an effect is the most common root cause of janky scroll work.

| | Scroll-triggered | Scroll-linked |
|---|---|---|
| Definition | Fires once when a threshold is crossed | Progress-mapped: animation position = scroll position |
| Examples | Fade-in reveal, counter start, class toggle | Parallax, scrubbed timeline, progress bar, pinned sequence |
| Timing source | Duration-based (400–600ms), plays after trigger | No duration — scroll is the timeline |
| Right tool | IntersectionObserver; CSS `view()` timeline | CSS `scroll()`/`view()` scrub; GSAP `scrub`; `useScroll` |
| Re-trigger rule | Fire once and stay. Re-animating on scroll-up feels broken — the user already read that content | Always reversible by definition; must track scroll in both directions |
| Cost model | Zero scroll-handler cost (observer callbacks) | Runs every frame while scrolling — must be transform/opacity only |

The re-trigger rule matters: a reveal that resets when the user scrolls up and replays on the way down reads as a bug, not a delight. Set `observer.unobserve(el)` after the first intersection, or use `once: true` in your library.

## Implementation ladder

Start at the top. Move down only when the current rung cannot express the effect. Every rung down adds bundle weight and maintenance surface.

| Rung | Tool | Use for | Cost | Support |
|---|---|---|---|---|
| 1 | IntersectionObserver + CSS class | Triggered reveals, lazy effects, nav highlighting | 0 KB, zero scroll-handler cost | Universal |
| 2 | CSS scroll-driven animations (`animation-timeline: scroll()` / `view()`) | Linked effects: progress bars, simple parallax, scrub-on-entry | 0 KB, runs off main thread | Chrome/Edge; treat as progressive enhancement with `@supports (animation-timeline: scroll())` |
| 3 | `position: sticky` | Pinning without scrubbing — sticky headers, stacking cards | 0 KB, browser-native | Universal |
| 4 | Framer Motion `useScroll` + `useTransform` | Linked effects in React when framer-motion is already installed | ~32 KB (usually sunk cost) | Universal |
| 5 | GSAP ScrollTrigger | Complex pinned + scrubbed timelines, multi-element choreography, snap points | ~60 KB (core + plugin) | Universal |

Rung 2 in practice — the `scroll()` timeline tracks a scroller's progress, `view()` tracks an element's journey through the viewport:

```css
@supports (animation-timeline: scroll()) {
  .progress-bar {
    animation: grow linear both;
    animation-timeline: scroll(root);
  }
  .card {
    animation: card-in linear both;
    animation-timeline: view();
    animation-range: entry 0% entry 60%;
  }
}
```

Firefox and Safari users get the static layout — which is exactly the content-first baseline from question 4.

### Rung 1 reference — triggered reveals, zero dependencies

```js
const els = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('is-visible');
    io.unobserve(e.target);          // fire once and stay — never re-trigger
  }
}, { threshold: 0.2, rootMargin: '0px 0px -12% 0px' });
els.forEach((el) => io.observe(el));
```

```css
.js .reveal {                         /* hidden only when JS confirmed running */
  opacity: 0;
  transform: translateY(24px);
  transition: opacity 500ms ease-out, transform 500ms ease-out;
}
.js .reveal.is-visible { opacity: 1; transform: none; }
```

Stagger siblings by setting `transition-delay: calc(var(--i) * 80ms)` with `--i` capped at 6–7 so late items never wait past ~600ms.

### Rung 4 reference — Framer Motion linked effect

```jsx
function ParallaxHeading() {
  const ref = useRef(null);
  const prefersReduced = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ['start end', 'end start'],   // element's full trip through viewport
  });
  const y = useTransform(scrollYProgress, [0, 1], [40, -40]); // ±40px ≈ under 20% budget
  return <motion.h2 ref={ref} style={{ y: prefersReduced ? 0 : y }}>…</motion.h2>;
}
```

`useTransform` writes to `transform` on the motion value pipeline — no React re-renders per frame. Keep it that way: never map scroll progress into state with `useState`.

### Rung 5 reference — pinned, scrubbed timeline

```js
gsap.registerPlugin(ScrollTrigger);

const mm = gsap.matchMedia();
mm.add('(prefers-reduced-motion: no-preference)', () => {
  gsap.timeline({
    scrollTrigger: {
      trigger: '.sequence',
      start: 'top top',
      end: '+=200%',        // pin for 2 viewport-heights of scroll
      pin: true,
      scrub: 0.8,           // ~0.8s smoothing: connected but not harsh
      anticipatePin: 1,     // prevents the 1-frame jump when pinning starts
    },
  })
    .from('.sequence .step-1', { yPercent: 30, opacity: 0 })
    .from('.sequence .step-2', { yPercent: 30, opacity: 0 })
    .from('.sequence .step-3', { yPercent: 30, opacity: 0 });
});
```

Everything lives inside `matchMedia`, so reduced-motion users get the unpinned static section with no cleanup code. Kill switch: `ScrollTrigger.getAll().forEach(t => t.kill())` restores normal flow.

## Performance guardrails

Scroll handlers run during the one thing users notice most: scrolling. The rules:

- **Never read layout in a scroll handler.** `getBoundingClientRect`, `offsetTop`, `scrollY` reads mixed with style writes force synchronous layout every frame. Batch: read once (or cache on resize), write inside `requestAnimationFrame`. Better: don't write a scroll handler at all — that is what rungs 1, 2, and 3 exist for.
- **Animate transform and opacity only.** These composite on the GPU. Animating `top`, `height`, `margin`, or `background-position` triggers layout or paint per frame and dies on low-end devices.
- **Parallax = `transform: translate3d()`, never `background-position`.** `translate3d` promotes a compositor layer; `background-position` repaints every frame.
- **Passive listeners.** If you must attach a scroll listener, `{ passive: true }` — otherwise the browser blocks scrolling on your handler.
- **Test on 90Hz+ displays and low-end Android.** High-refresh screens expose stutter that looks fine at 60Hz; a $150 Android exposes main-thread cost that an M-series laptop hides. Chrome DevTools 6x CPU throttle is the minimum bar.
- **`will-change` sparingly.** Apply to the 2–3 elements actively animating, remove after. Blanket `will-change: transform` on 50 cards exhausts GPU memory on mobile.

## Pinning and sticky patterns

| Need | Solution | Why |
|---|---|---|
| Element stays while siblings scroll past | `position: sticky` | Free, robust, no JS, no layout shift |
| Stacked cards that pin and hand off | `position: sticky` with staggered `top` offsets | Still no JS |
| Section pins while an internal timeline scrubs | GSAP ScrollTrigger `pin: true` + `scrub: 0.5–1` | Sticky cannot map a timeline to scroll distance |
| Horizontal scroll section | ScrollTrigger pin + `x` tween across `scrollWidth` | Native horizontal-in-vertical is not reliable |

Always reach for `position: sticky` first — most "pin this section" requests need nothing more. When you do use ScrollTrigger pinning, know the pitfalls: pinning inserts a spacer element to preserve document height — with `pinSpacing: false` the following content slides underneath instead. Pinned sections inside `transform`-ed or `overflow: hidden` ancestors break (a transformed ancestor becomes the containing block for `fixed`). And a `scrub` value of 0.5–1 second of smoothing feels connected; raw `scrub: true` can feel harsh on trackpads.

## Reveal choreography numbers

Defaults that read as polish rather than performance:

| Parameter | Value | Why |
|---|---|---|
| Trigger threshold | 0.15–0.3 of element visible (or `rootMargin: "0px 0px -12% 0px"`) | At 0, elements animate while still off-screen edge; above 0.4, tall elements on short viewports never fire |
| Translate distance | 16–32px | Enough to register direction; 60px+ reads as content flying in |
| Duration | 400–600ms, ease-out | Under 300ms is missable; over 700ms makes readers wait |
| Stagger | 60–100ms between siblings, cap the group at ~600ms total | Below 50ms reads as simultaneous; a 12-item list at 100ms each makes item 12 wait 1.2s — cap or batch |
| Above-the-fold | Do not scroll-animate on load | The user has not scrolled; hiding initial content behind reveals delays LCP and reads as a broken page. Use load-in animation or nothing |

## Parallax restraint

Parallax is seasoning, not the meal. Budget: at most 3 depth layers, and each layer's total offset at most 20% of the scroll distance it travels — beyond that, the movement stops reading as depth and starts reading as gimmick, and text drifting past its background becomes hard to read. Disable parallax on mobile (`@media (pointer: coarse)` or width-based): it fights momentum scrolling, and iOS historically throttles scroll events mid-fling so layers snap on release. Serve the static layout instead; nobody misses parallax on a phone.

## Accessibility

- **Respect `prefers-reduced-motion`.** Vestibular disorders make parallax and large translates physically nauseating. Replace movement with static presentation or an opacity-only fade — reduced motion means reduce, not necessarily remove; a 300ms fade with zero translate is usually fine. Gate globally:

```css
@media (prefers-reduced-motion: reduce) {
  .reveal { transition: opacity 300ms ease; transform: none !important; }
}
```

In GSAP use `gsap.matchMedia()`; in Framer Motion use `useReducedMotion()`.

- **No `opacity: 0` defaults without a fallback.** If the reveal class is applied in CSS and JS never loads, content is invisible forever. Either add the hidden state via JS after confirming it runs (`document.documentElement.classList.add('js')`, scope hidden styles to `.js .reveal`), or provide a `<noscript>` override.
- **Pinned sections and keyboard users.** Long pinned sequences trap keyboard/screen-reader users in scrolled theater. Ensure content is in DOM order and reachable by Tab regardless of pin state.

## Scroll-jacking warning

Overriding scroll speed, direction, or snapping the user to sections tests terribly: it breaks scroll-position muscle memory, fights browser/OS smooth-scrolling and momentum, and behaves differently on trackpad vs wheel vs touch. Reserve full scroll-jacking for narrative editorial pieces where the scroll is the story — and even then provide a visible skip control and keep native scrolling as the input (map it, never replace it). If a stakeholder asks for "that Apple product-page effect," clarify that Apple uses scroll-linked scrubbing over native scroll, not hijacked scroll speed — build that instead.

## Workflow

1. **Inventory and classify.** List every effect; mark each linked or triggered (use the table). Confirm the no-JS/reduced-motion baseline renders complete content.
2. **Pick one rung.** Choose the highest rung on the ladder that covers the whole inventory. Record why anything forced a move down — that justification is the bundle-cost receipt.
3. **Build the static page first.** Full layout, real content, no animation. This is the fallback for Firefox (rung 2), no-JS, and reduced-motion users, and it prevents animation-driven layout decisions.
4. **Add triggered reveals.** IntersectionObserver with threshold 0.2, unobserve after first fire, apply a class that transitions transform + opacity per the choreography table. Exclude above-the-fold elements.
5. **Add linked effects.** CSS scroll-driven timelines behind `@supports`, or `useScroll`/ScrollTrigger `scrub` per your rung. Transform/opacity only; verify no layout reads per frame in the Performance panel.
6. **Add pinning if inventoried.** `position: sticky` first; ScrollTrigger `pin` only for scrubbed timelines. Check pin-spacing and ancestor `transform`/`overflow` conflicts.
7. **Wire reduced motion.** Global media-query override plus library-level gating. Verify by toggling the OS setting, not just DevTools emulation.
8. **Profile on hostile hardware.** DevTools 6x CPU throttle, then a real low-end Android and a 120Hz display. Record a Performance trace while scrolling: any frame over 16ms during scroll is a defect, not a nitpick.
9. **Ship with a kill switch.** Keep effects behind a single class or config flag so a reported jank regression can be disabled without a redesign.

## Common Mistakes

1. **Scroll listener + `getBoundingClientRect` per frame.** Forces synchronous layout every scrolled frame; stutters visibly on 90Hz+ displays. Fix: IntersectionObserver for triggers, CSS timelines or a scrub-capable library for linked effects; if a handler is unavoidable, cache measurements and write in `requestAnimationFrame` with `{ passive: true }`.
2. **Reveals that re-trigger on scroll-up.** The content replays its entrance every time the user scrolls back — reads as broken. Fix: unobserve after first intersection (`once: true` equivalents: ScrollTrigger `once: true`, Framer Motion `viewport={{ once: true }}`).
3. **`opacity: 0` in the stylesheet with no JS fallback.** Ad blockers, slow networks, and script errors leave a blank page — and search crawlers may see it too. Fix: scope hidden states behind a JS-added root class or `<noscript>` reset.
4. **Animating above-the-fold content with scroll reveals.** Hero content sits invisible until a scroll event that already happened at position 0, or pops in late and tanks perceived LCP. Fix: above-the-fold gets load animation or none; scroll reveals start below the fold.
5. **GSAP ScrollTrigger for three fade-ins.** 60 KB and a scroll-management layer for what 15 lines of IntersectionObserver does free. Fix: walk the ladder top-down; ScrollTrigger earns its weight only for pinned/scrubbed timelines.
6. **Parallax via `background-position` or 5-layer 50% offsets.** Per-frame repaints plus motion that reads as a 2013 theme demo. Fix: `translate3d` layers, max 3, max 20% offset, disabled on mobile.
7. **Ignoring `prefers-reduced-motion`.** Parallax and pinned scrubbing can cause genuine nausea; it is also a WCAG 2.3.3 concern. Fix: global reduced-motion override at the start of the project, not as a launch-week patch.
8. **Pinned section inside a transformed ancestor.** The pin sticks to the ancestor, not the viewport, and appears to "not work" — the transformed ancestor is the containing block. Fix: move the pin out, or drop the ancestor transform; check `overflow: hidden` clipping while you are there.

## Output Format

Deliver:

1. **Effect inventory table** — each effect, linked/triggered classification, chosen rung, and trigger/scrub parameters.
2. **Implementation** — complete code for the chosen rung: observer + CSS classes, `@supports`-gated scroll timelines, or the ScrollTrigger/useScroll setup. Include the reduced-motion override and the no-JS fallback in the same delivery, not as follow-ups.
3. **Choreography spec** — thresholds, distances, durations, staggers actually used, flagged wherever they deviate from the defaults table and why.
4. **Performance checklist** — confirmation of transform/opacity-only animation, passive listeners, no per-frame layout reads, and results from the 6x-throttle trace.
5. **Known limits** — which browsers get the static fallback, what is disabled on mobile, and where the kill switch lives.
