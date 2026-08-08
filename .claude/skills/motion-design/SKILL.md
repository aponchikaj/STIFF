---
name: motion-design
description: "When the user wants to design a motion system for their product — duration and easing tokens, choreography rules, and a motion spec developers can implement. Triggers: \"motion system\", \"easing\", \"duration tokens\", \"make it feel smooth\", \"animations feel off\", \"animations feel slow\", \"choreography\", \"motion spec\", \"how long should this animation be\", \"motion audit\", \"reduced motion\". Covers duration token scales, easing token sets, stagger and sequencing rules, mapping brand personality to motion values, distance-duration coupling, prefers-reduced-motion policy, and auditing an existing product's motion. For implementation in CSS, see css-animation. For React implementation, see framer-motion. For component-level feedback, see micro-interactions."
metadata:
  version: 1.0.0
---

# Motion Design Systems

Act as a motion design lead who has built motion systems for design systems used by dozens of product teams — someone who thinks in tokens and choreography rules, not one-off animations. The outcome: a complete motion spec — a duration scale, an easing set, choreography rules, and per-pattern notes — that a developer can implement without asking follow-up questions and that makes every screen in the product move like it belongs to the same family. Ad-hoc animation values are how products end up feeling janky: 300ms here, 500ms there, three different eases on one screen. A token system fixes that once.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — brand personality, audience, and category usually live there and drive every motion decision. Only ask what it doesn't cover. Ask 3–5 grouped questions:

1. **Personality**: Pick 2–3 adjectives the product should feel like (calm, playful, precise, premium, energetic, utilitarian). If product-marketing.md defines brand voice, confirm rather than re-ask.
2. **Surface and stack**: Web, native, or both? What implements animation today — CSS transitions, Framer Motion, something else? This decides whether the spec outputs cubic-beziers, spring params, or both.
3. **Current state**: New system from scratch, or an existing product with animations already in it? If existing, is the complaint "too slow", "inconsistent", or "feels cheap"?
4. **Density**: Is this a data-dense tool used 4 hours a day (motion should be nearly invisible) or a consumer product used 4 minutes a day (motion can carry personality)?
5. **Constraints**: Any accessibility requirements beyond `prefers-reduced-motion`, low-end device targets, or existing design tokens the motion scale must slot into?

## Duration Token Scale

Five steps cover almost every product. Name them by role, not by number, so designers reach for the right one.

| Token | Value | Use for | Examples |
|---|---|---|---|
| `duration-instant` | 100ms | Micro feedback tied to input | Hover states, button press, toggle, checkbox |
| `duration-fast` | 150–200ms | Small transitions within a component | Dropdown open, tooltip, tab underline, accordion row |
| `duration-base` | 250–350ms | Layout shifts, element enter/exit | Modal open, drawer slide, card expand, toast in |
| `duration-slow` | 400–600ms | Page-level and orchestrated sequences | Route transition, staggered list entrance, onboarding step |
| `duration-story` | 700–1200ms | Deliberate storytelling only | Hero reveal, celebration moment, empty-state illustration |

Rules that make the scale hold:

- Anything over ~700ms reads as slow unless it's intentional storytelling. If a functional transition needs 700ms, the distance is too big — shorten the travel, not just the clock.
- Exits run 20–30% faster than entrances (a 300ms modal open pairs with a ~200ms close). Users asked for the thing to go away; make it go.
- Frequency caps duration: an animation seen 50 times a day gets `instant` or `fast` no matter how nice it looks the first time. Save `slow` for things seen once per session.
- Pick exact values inside the ranges based on personality (see the mapping table) and freeze them. A system with `150` and `160` both in use is not a system.

## Easing Token Set

Easing communicates physics. Wrong easing at the right duration still feels off.

| Token | Curve | Use for | Why |
|---|---|---|---|
| `ease-out` (standard) | `cubic-bezier(0.2, 0, 0, 1)` | Entrances, anything responding to user input | Starts fast, decelerates — reads as responsive because most of the movement happens immediately |
| `ease-in` | `cubic-bezier(0.3, 0, 1, 1)` | Exits, dismissals | Accelerates away — the element commits to leaving instead of lingering |
| `ease-in-out` | `cubic-bezier(0.45, 0, 0.15, 1)` | On-screen movement A→B (reorder, slide between positions) | Element neither appears nor leaves, so it accelerates and settles |
| `spring-default` | stiffness 300, damping 30, mass 1 | Playful/energetic brands: entrances, drag release | Slight overshoot adds life; damping 30 keeps it to one settle, not a wobble |
| `spring-gentle` | stiffness 170, damping 26, mass 1 | Premium/calm brands wanting spring physics without bounce | Critically-damped feel — organic settle, zero overshoot |
| `linear` | `linear` | Continuous progress only: spinners, progress bars, marquees | Constant rate reads as machine activity; on anything else it reads as robotic |

Default the system to `ease-out` — roughly 80% of transitions are entrances or input responses. Never use `ease-in` for an entrance: it starts slow, which reads as lag between click and response.

## Motion Personality Mapping

Translate the brand adjectives from Before Starting into concrete values. This table is the bridge between "feel premium" and numbers a developer can type.

| Brand attribute | Duration bias | Easing | Distance/scale | Signature moves |
|---|---|---|---|---|
| Calm, trustworthy (fintech, health) | Middle of each range (base 300ms) | `ease-out`, no springs | Short travel: 8–16px slides, fade-forward | Opacity-led entrances; nothing overshoots |
| Playful, energetic (consumer, social) | Bottom of ranges (base 250ms) | `spring-default` everywhere it fits | Larger travel: 24–40px, scale 0.9→1 | Overshoot on entrances, staggered cascades |
| Premium, editorial (luxury, portfolio) | Top of ranges (base 350ms, story 800–1200ms) | `ease-in-out`, `spring-gentle` | Generous travel: 32–48px, slow reveals | Masked/clip reveals, slow image scale 1.05→1 |
| Precise, utilitarian (dev tools, dashboards) | Bottom of ranges (base 250ms), skip `slow` for chrome | `ease-out` only | Minimal: 4–8px or opacity-only | Motion nearly invisible; feedback only |
| Bold, confident (brand-led SaaS) | Fast small / slow large: fast 150ms, slow 500ms | `ease-out` with sharp curve (0.16, 1, 0.3, 1) | Big page moves, tiny component moves | Full-viewport route transitions, decisive snaps |

One personality per product. If stakeholders want "playful but premium", pick the dominant one for the system defaults and let the other appear only in one or two signature moments.

## Distance-Duration Coupling

Bigger movement needs more time, but not proportionally — perceived speed scales roughly with the square root of distance. A useful formula:

`duration ≈ 120ms + 5 × √(distance in px)` — then snap to the nearest token.

| Travel distance | Formula gives | Snap to token |
|---|---|---|
| 8px (tooltip nudge) | ~135ms | `instant`–`fast` (100–150ms) |
| 100px (dropdown, toast) | ~170ms | `fast` (150–200ms) |
| 400px (drawer, half-screen) | ~220ms | `base` (250–350ms) |
| 900px (full-screen slide) | ~270ms | `base`–`slow` (300–450ms) |

The point of the formula is the shape, not the constants: doubling distance should add ~40% duration, not 100%. A full-screen slide at the same 200ms as a dropdown feels violent; at 2× the dropdown's duration it feels sluggish. Same rule for scale animations — treat the pixel delta of the bounding box as the distance.

## Choreography Rules

Individual animations are easy; the system falls apart when several run at once. Fix these rules globally:

1. **Stagger siblings 20–50ms apart.** List items, cards in a grid, menu rows: 20–30ms for utilitarian products, 40–50ms for expressive ones. Below 20ms the stagger is invisible (animate together instead); above 50ms users wait for the tail.
2. **Cap the cascade.** Stagger the first 6–8 items, then land the rest together (or fade the container). A 30-item list at 50ms stagger makes the last item wait 1.5s — that's a loading screen, not choreography.
3. **Parent before children.** Container appears (or begins appearing) before its contents: modal panel first, then its content ~50–80ms later. Children animating into a container that doesn't exist yet reads as broken.
4. **Shared direction of travel.** Everything entering in one choreographed moment moves along the same axis. A header sliding down while cards slide up splits attention; pick one direction per scene (upward 12–24px + fade is the safe default).
5. **One hero per scene.** In any orchestrated sequence, one element gets the full entrance (movement + fade); supporting elements get opacity-only or reduced distance. If everything moves equally, nothing reads as important.
6. **Total sequence budget: ~700ms** from trigger to last element settled for functional screens. Storytelling moments may exceed it knowingly.

## Interruption and Performance Guardrails

A motion system also has to say what happens when reality interrupts the choreography. Put these four rules in every spec:

- **Interruptible by default.** A second click during a modal's entrance reverses it from its current position — never queue the close behind the open, and never ignore input while animating. Springs handle this naturally (retarget with preserved velocity); for CSS, transition the property rather than playing a fixed keyframe.
- **Animate only `transform` and `opacity`** in the spec's patterns. Animating `width`, `height`, `top`, or `box-shadow` triggers layout/paint and stutters on mid-range devices; specify scale/translate equivalents (or a FLIP note) instead, and flag exceptions explicitly.
- **Motion never gates data.** Content may render before its entrance animation finishes; a user who scrolls mid-cascade sees settled items, not blanks. Choreography decorates arrival — it must not delay it.
- **Loading states move continuously; state changes move once.** A spinner loops (`linear`); a completed action animates a single time and settles. Looping attention-grabbers on settled UI are the fastest way to make a product feel cheap.

## Reduced Motion Policy

`prefers-reduced-motion` means "reduce", not "remove". Users who set it still need state-change feedback — they're opting out of movement, not of information.

| Full motion | Reduced-motion replacement |
|---|---|
| Slide + fade entrance | Opacity fade only, 100–150ms |
| Scale/zoom transitions | Opacity cross-fade |
| Staggered cascade | All items fade in together |
| Parallax, scroll-driven movement | Static positioning |
| Autoplaying/looping decorative motion | First frame, static |
| Spinners, progress bars | Keep as-is — progress indication is information, and a determinate bar is not vestibular-triggering |

Bake this into the tokens: define each motion token with a reduced variant (`duration-base` → 150ms fade, distance → 0) so every consumer inherits the policy instead of re-deciding it per component. Never branch to `animation: none` globally — that removes feedback and can break `animationend`-dependent logic.

## Workflow

For a new system, run steps 1–3 and 6–7. For an existing product, run all steps — 4 and 5 are the audit.

1. **Establish personality.** Read `.agents/product-marketing.md`, ask the Before Starting questions, and pick one row of the personality mapping table. Write down the 2–3 adjectives and the chosen defaults — every later decision cites this.
2. **Fix the duration scale.** Pick exact values inside each range using the personality bias (e.g., playful: 100/150/250/400; premium: 100/200/350/600). Add `duration-story` only if the product has genuine storytelling moments.
3. **Fix the easing set.** Choose 3–4 tokens maximum from the easing table. Cut what the personality doesn't need — a utilitarian tool ships `ease-out`, `ease-in`, `linear` and nothing else. Output both cubic-bezier and spring forms if the stack includes Framer Motion.
4. **Audit the existing product** (existing products only). Inventory every duration and easing in the codebase — search for `transition`, `animation`, `duration`, `ease`, `spring`, `stiffness`, `setTimeout` used for sequencing. Build a frequency table of values found. Ten distinct durations and five eases is typical and is the diagnosis.
5. **Map findings to tokens.** For each found value, assign the nearest token and flag violations: anything >700ms that isn't storytelling, `linear` on non-progress elements, `ease-in` entrances, entrance/exit pairs at equal duration, staggers outside 20–50ms, missing reduced-motion handling. Produce a migration table: file/component → current value → token → note.
6. **Write choreography specs for the top patterns.** Cover the 5–8 patterns the product actually has: page/route entrance, modal open/close, list load, drawer, toast, expand/collapse, tab switch. For each: trigger, element order, per-element delay/duration/easing/distance, and the reduced-motion variant. Apply the choreography rules — hero element, shared direction, sequence budget.
7. **Deliver the spec** in the Output Format below, then route implementation: css-animation for CSS, framer-motion for React components, micro-interactions for component-level feedback details the system-level spec doesn't dictate.

## Token Delivery Formats

Ship the tokens in the format the stack consumes, in the same spec document:

```css
:root {
  --duration-instant: 100ms;  --duration-fast: 150ms;
  --duration-base: 300ms;     --duration-slow: 500ms;
  --ease-out: cubic-bezier(0.2, 0, 0, 1);
  --ease-in: cubic-bezier(0.3, 0, 1, 1);
}
@media (prefers-reduced-motion: reduce) {
  :root { --duration-base: 150ms; --duration-slow: 150ms; }
}
```

For Framer Motion stacks, mirror the same values as an exported `motionTokens` object with `transition` presets (`{ duration: 0.3, ease: [0.2, 0, 0, 1] }`, `{ type: "spring", stiffness: 300, damping: 30 }`) so components import presets, never inline numbers. One source of truth per stack; if both exist, the CSS custom properties are canonical and the JS object is generated from them.

## Common Mistakes

1. **One duration for everything.** 300ms on hovers makes input feedback feel laggy; 300ms on page transitions feels abrupt. Fix: hovers and presses get 100ms, page-level gets 400–600ms — the scale exists to be spread across.
2. **Ease-in on entrances.** The element starts slow, so the first 100ms after a click looks like nothing happened. Fix: entrances always decelerate (`ease-out`); acceleration is for exits.
3. **Equal-duration enter and exit.** A modal that takes as long to close as to open feels like it's resisting dismissal. Fix: exits at 60–80% of the entrance duration with `ease-in`.
4. **Linear stagger on long lists.** 50ms × 30 items = the bottom of the list arrives 1.5s late. Fix: stagger the first 6–8, land the rest together.
5. **Distance ignored.** The same 200ms drives both an 8px tooltip and a full-screen drawer, so one feels fine and the other feels violent. Fix: apply the sqrt coupling and snap to tokens.
6. **`prefers-reduced-motion` handled by deleting animation.** State changes become teleports and users lose feedback. Fix: substitute short opacity fades; keep progress indicators.
7. **Personality by adjective, not by number.** "Make it feel premium" ships as whatever each developer imagines. Fix: the personality mapping table converts adjectives to exact durations, curves, and distances once, in the spec.
8. **Springs tuned by vibes.** Random stiffness/damping per component yields three different bounces on one screen. Fix: two named spring tokens maximum, defined once with exact params.

## Output Format

Deliver the motion spec as a single document with these sections:

**1. Personality statement** — 2–3 sentences: the adjectives, the chosen mapping row, and the one-line rule of thumb (e.g., "fast and settled: everything decelerates, nothing bounces").

**2. Duration tokens** — table: token name, value (ms), reduced-motion value, use-for line.

**3. Easing tokens** — table: token name, cubic-bezier value, spring params (if applicable), use-for line.

**4. Choreography rules** — the 4–6 global rules in force (stagger interval, cascade cap, parent-first offset, direction default, sequence budget).

**5. Per-pattern specs** — one block per pattern (modal, list, route, drawer, toast, ...):

```
Pattern: Modal open
Trigger: user click
1. Overlay      — fade 0→1, duration-fast (150ms), ease-out
2. Panel        — +50ms, translateY 16px→0 + fade, duration-base (300ms), ease-out
3. Panel content — +80ms, fade 0→1, duration-fast (150ms), ease-out
Close: reverse order collapsed to one step — panel fade + translateY 0→8px, 200ms, ease-in
Reduced motion: overlay and panel fade only, 150ms, no translate
```

**6. Migration table** (audits only) — file/component, current value, target token, note.

Every value in the spec is a number a developer can type — no "quick", "smooth", or "snappy" without the milliseconds and curve next to it. Close by routing implementation to css-animation, framer-motion, or micro-interactions as fits the stack.
