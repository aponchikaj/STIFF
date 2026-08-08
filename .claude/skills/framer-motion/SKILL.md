---
name: framer-motion
description: "When the user wants to build React animations with Framer Motion / the motion library — variants, orchestration, exit animations, layout transitions, gestures, or scroll-linked effects. Triggers: \"Framer Motion\", \"motion.div\", \"React animation\", \"variants\", \"AnimatePresence\", \"layout animation\", \"exit animation not working\", \"stagger children\". Covers variants architecture, AnimatePresence gotchas, layout/layoutId shared elements, spring tuning, gesture props, useScroll/useTransform, motion values for performance, RSC boundaries, and reduced motion. For duration/easing system decisions, see motion-design. For plain-CSS implementations, see css-animation. For component feedback patterns, see micro-interactions."
metadata:
  version: 1.0.0
---

# Framer Motion

Act as a senior React animation engineer who ships Framer Motion (now "motion") code that survives production: exit animations that actually fire, layout transitions that don't thrash, and continuous values that never touch React state. The outcome is animation code that is declarative where it can be, imperative where it must be, and always runs on transform/opacity.

## Before Starting

Ask these before writing code — the answers change imports, architecture, and what is even possible:

1. **Library and version**: `framer-motion` (legacy name) or `motion` (the rename, v11+)? The API is the same, but imports differ: `import { motion } from "framer-motion"` vs `import { motion, AnimatePresence } from "motion/react"`. New projects should install `motion`.
2. **React setup**: React version, and is this Next.js App Router / React Server Components? Motion components are client-only — `"use client"` placement matters (see step 7).
3. **What is being animated**: enter/exit of mounted elements, reordering/resizing (layout), a shared element across routes (layoutId), gesture feedback, or scroll-linked values? Each has a distinct tool; mixing them up is the main source of bugs.
4. **Continuity requirement**: does anything update every frame (cursor follow, scroll progress, drag)? If yes, plan motion values from the start — retrofitting `useState`-driven animation later is a rewrite.
5. **Accessibility bar**: must this respect `prefers-reduced-motion`? (Default yes for anything that moves more than ~20px or loops.)

## Core Frameworks

### 1. Variants architecture

Inline `animate={{ opacity: 1 }}` is fine for one element. Use variants when:

| Situation | Why variants win |
|---|---|
| Parent orchestrates children | `staggerChildren` / `delayChildren` only exist on variant transitions |
| One state name drives many elements | Set `animate="visible"` once on the parent; it propagates to every child with a matching variant name |
| Enter + exit + hover states on same tree | Named states ("hidden"/"visible"/"exit") stay readable; inline objects sprawl |
| Animation config should live outside JSX | Variants are plain objects — extract, test, reuse |

Propagation rules that trip people up:

- Propagation flows through **variant names**, not values. A child with no `variants` prop is skipped silently.
- A child that sets its own `animate` prop **breaks the chain** for itself and its subtree.
- `staggerChildren: 0.06` and `delayChildren: 0.15` go on the **parent's transition**, not the children's. Children define what they do; the parent defines when.

```tsx
const list = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.15 } },
};
const item = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0 },
};

<motion.ul variants={list} initial="hidden" animate="visible">
  {items.map((i) => <motion.li key={i.id} variants={item}>{i.label}</motion.li>)}
</motion.ul>
```

### 2. AnimatePresence gotchas

Exit animations have three hard requirements. Miss any one and the element just disappears.

| Requirement | Failure mode when violated |
|---|---|
| Motion element is a **direct child** of `AnimatePresence` | Wrapping in a `<div>` or fragment → exit never fires, no warning |
| Child has a **stable, unique `key`** | Index keys or missing keys → React reuses the node, AnimatePresence never sees an unmount, exit skipped |
| The element actually **unmounts** (conditional render / key change) | Toggling `visibility` or `display` via style → nothing to animate |
| `exit` variant/prop is defined on the child | Element unmounts instantly (this one at least is obvious) |

Mode selection:

| `mode` | Behavior | Use for |
|---|---|---|
| `"sync"` (default) | Enter and exit run simultaneously | Lists where items animate independently |
| `"wait"` | Exiting element finishes before the new one mounts | Tab panels, step wizards, route-like swaps — anything sharing one slot |
| `"popLayout"` | Exiting element pops to `position: absolute` so siblings reflow immediately | Lists with `layout` siblings that should close the gap during the exit |

The two classic failures: (1) **missing key on a single swapped child** — `<AnimatePresence mode="wait"><motion.div key={activeTab}>` needs that `key={activeTab}`; without it React updates in place and no exit runs. (2) **fragment child** — `<AnimatePresence><>{...}</></AnimatePresence>` hides children from presence tracking; hoist the motion element to be the direct child.

```tsx
<AnimatePresence mode="wait">
  <motion.div
    key={activeTab}                      // stable key = the whole trick
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.15 }}
  >
    {tabContent[activeTab]}
  </motion.div>
</AnimatePresence>
```

Also: `initial={false}` on `AnimatePresence` skips enter animations on first mount — use it for modals so the page load doesn't replay every closed modal's entrance.

### 3. Layout animations

- `layout` prop: animates position/size changes caused by React re-renders (reorder, expand, flex changes) using transforms — no width/height keyframing.
- `layoutId="thumbnail-42"`: shared-element transition. When one element with a `layoutId` unmounts and another mounts with the same id, motion animates between their bounding boxes. Pair with `AnimatePresence` for modal/lightbox open-close.
- Wrap related layout elements in `LayoutGroup` when they live in separate components — otherwise sibling accordions don't know to animate each other's displacement, and each measures in isolation (multiple layout roots also multiply measurement cost, which is where "layout thrash" comes from).
- **Distortion correction**: because layout animations scale the element, `borderRadius` and `boxShadow` visually warp mid-animation. Motion auto-corrects them only when they're set via `style`/animation props — `style={{ borderRadius: 12 }}`, not a CSS class.

```tsx
// Shared-element modal: same layoutId on thumbnail and expanded view
{items.map((item) => (
  <motion.img key={item.id} layoutId={`card-${item.id}`} onClick={() => setSelected(item.id)} />
))}
<AnimatePresence>
  {selected && (
    <motion.div layoutId={`card-${selected}`} style={{ borderRadius: 16 }}>
      <ExpandedCard id={selected} />
    </motion.div>
  )}
</AnimatePresence>
```

Scope choice:

| Prop | Animates |
|---|---|
| `layout` | Position and size |
| `layout="position"` | Position only — use when content should not scale (text reflows badly under scale) |
| `layout="size"` | Size only |

### 4. Springs

Physics beats duration for anything interactive: springs inherit velocity from gestures and interruptions, so a grabbed-mid-flight element feels continuous.

| Parameter | Intuition | Raising it does |
|---|---|---|
| `stiffness` | Spring strength | Faster, more aggressive approach |
| `damping` | Friction | Less oscillation; too high = sluggish crawl |
| `mass` | Weight | Slower, heavier, more momentum |

Recommended presets:

| Feel | Config | Use for |
|---|---|---|
| Gentle UI | `{ type: "spring", stiffness: 120, damping: 20 }` | Cards, panels, layout shifts |
| Snappy | `{ type: "spring", stiffness: 300, damping: 30 }` | Buttons, toggles, tooltips, whileTap |
| Bouncy | `{ type: "spring", stiffness: 400, damping: 15 }` | Playful accents only — one per view |

Use **duration-based** (`{ duration: 0.3, ease: "easeOut" }`) when timing must sync with something external — a sound cue, another element's timeline, or a design-spec'd duration. Use **physics** for everything the user touches.

### 5. Gestures

- `whileHover` / `whileTap` / `whileFocus` / `whileDrag`: declarative, auto-reversing state overlays. They accept variant names, so a parent's `whileHover` can propagate to children.
- `drag` / `drag="x"`: `dragConstraints` takes either an object (`{ left: 0, right: 300 }`) or a ref to a bounding element. `dragElastic={0.2}` (0–1) controls pull-past-bounds give; `0` is a hard wall, default `0.5` feels loose — 0.15–0.3 suits most UI.
- `dragMomentum={false}` for precise drop targets; leave it on for flickable surfaces.

```tsx
<motion.div
  whileHover={{ scale: 1.03 }}
  whileTap={{ scale: 0.97 }}
  transition={{ type: "spring", stiffness: 300, damping: 30 }}
  drag="x"
  dragConstraints={constraintsRef}   // or { left: -100, right: 100 }
  dragElastic={0.2}
/>
```

Gesture props layer on top of `animate` and revert automatically on release — do not hand-roll `onHoverStart`/`onHoverEnd` state for simple scale feedback.

### 6. Scroll

```tsx
const { scrollYProgress } = useScroll();               // page progress 0–1
const { scrollYProgress: p } = useScroll({ target: ref, offset: ["start end", "end start"] });
const opacity = useTransform(p, [0, 0.5, 1], [0, 1, 0]);
<motion.div ref={ref} style={{ opacity }} />
```

`useScroll` returns motion values — pipe them through `useTransform` into `style`. Never mirror scroll position into state. For enter-on-scroll reveals, prefer `whileInView={{ opacity: 1, y: 0 }}` with `viewport={{ once: true, amount: 0.3 }}` over hand-rolled observers.

### 7. Performance and boundaries

- Animate `x`, `y`, `scale`, `rotate`, `opacity` — GPU-composited, no layout/paint. Animating `width`, `height`, `top`, `left` forces layout every frame; use the `layout` prop to convert size changes into transforms instead.
- **Motion values bypass React re-renders.** `useMotionValue` + `useTransform` write directly to the DOM at 60fps with zero renders. Anything continuous (cursor, scroll, drag position, progress) must be a motion value, never `useState` — state-driven animation re-renders the tree every frame.

```tsx
// Cursor-follow without a single re-render
const x = useMotionValue(0);
const rotate = useTransform(x, [-200, 200], [-15, 15]);
<motion.div style={{ x, rotate }} onPointerMove={(e) => x.set(e.clientX - centerX)} />
```

- Need the value in React land occasionally? Read `x.get()` in an event handler, or subscribe with `useMotionValueEvent(x, "change", cb)` — still no per-frame renders.
- **RSC boundary**: `motion.*` components and all motion hooks require `"use client"`. Put the directive on a small leaf wrapper (e.g. `components/motion/FadeIn.tsx`) that accepts `children`, not on your page — server components can still render *as children* of a client motion wrapper, so you keep data fetching on the server.

### 8. Reduced motion

```tsx
const shouldReduceMotion = useReducedMotion();
const y = shouldReduceMotion ? 0 : 24;
// animate opacity always; suppress translation/scale when reduced
```

Pattern: keep opacity fades (they aid comprehension), zero out movement and scale, and disable loops/parallax. For app-wide enforcement, wrap the tree in `<MotionConfig reducedMotion="user">`.

## Workflow

1. Confirm the Before Starting answers; pin imports (`motion/react` for the renamed package).
2. Classify each animation: enter/exit → AnimatePresence; reflow → `layout`; cross-mount shared element → `layoutId`; continuous → motion values; scroll-linked → `useScroll` + `useTransform`.
3. Structure variants: parent owns orchestration (`staggerChildren`, `delayChildren`), children own their own poses; verify no child breaks propagation with its own `animate`.
4. Choose transitions: spring presets for interactive elements, durations only for externally-synced timing.
5. Audit every AnimatePresence against the three requirements table (direct child, stable key, real unmount) and pick the right `mode`.
6. Check performance: grep for animated `width/height/top/left`, replace with transforms or `layout`; move any per-frame state into motion values.
7. Place `"use client"` on leaf motion wrappers; add `useReducedMotion` (or `MotionConfig reducedMotion="user"`) before calling it done.

## Common Mistakes

1. **Exit animation never runs** — the motion element isn't a direct child of `AnimatePresence`, or lacks a stable key. Fix: hoist the motion element, key it by identity (`key={activeTab}`, `key={item.id}`), never by index.
2. **Stagger config on children** — `staggerChildren` on an item's transition does nothing. Fix: move it to the parent variant's `transition`; the parent orchestrates, children pose.
3. **State-driven continuous animation** — `onMouseMove={() => setPos(...)}` re-renders every frame and stutters. Fix: `useMotionValue` + set in the handler; the DOM updates without React.
4. **Animating width/height for expansion** — forces layout each frame, janks on low-end devices. Fix: `layout` prop on the element (and `LayoutGroup` around affected siblings), which animates via scale with distortion correction.
5. **borderRadius warping during layout animation** — radius set in a CSS class can't be corrected. Fix: move it to `style={{ borderRadius: 12 }}` so motion counter-scales it.
6. **`mode="wait"` with multiple simultaneous children** — wait mode only supports one child at a time; extra children queue or drop. Fix: use `"sync"` or `"popLayout"` for lists; reserve `"wait"` for single-slot swaps.
7. **`"use client"` slapped on the whole page** — turns the entire route into client bundle. Fix: thin motion wrapper components with the directive; pass server-rendered content as children.
8. **Bouncy spring everywhere** — `damping: 15` on every element reads as toy-like. Fix: gentle (120/20) as the default, snappy (300/30) for controls, bounce reserved for at most one accent per view.

## Output Format

Deliver:

1. **Working code** — complete components with imports (from `motion/react` unless the project pins `framer-motion`), `"use client"` where required, and stable keys shown explicitly.
2. **Transition rationale** — one line per animation naming the mechanism chosen (variants / AnimatePresence mode / layout / motion value) and the spring or duration values used.
3. **Gotcha callouts** — flag anything in the surrounding code that would silently break it: missing keys, fragment children, class-based borderRadius on layout elements, state used for continuous values.
4. **Reduced-motion note** — state what the reduced variant does (fade-only, movement zeroed) or why it was safely omitted.
