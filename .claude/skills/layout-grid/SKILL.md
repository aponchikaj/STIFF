---
name: layout-grid
description: "When the user wants to design or fix the spatial system of a UI — spacing, grids, containers, breakpoints, and alignment. Triggers: \"grid system\", \"spacing scale\", \"breakpoints\", \"whitespace\", \"alignment\", \"container queries\", \"layout feels off\", \"spacing is inconsistent\". Covers the spacing token scale, proximity ratios, grid vs flexbox choice, container widths, content-driven breakpoints, container queries, optical alignment, and density modes. For the type scale inside the grid, see typography. For mobile-specific layout patterns, see mobile-ux."
metadata:
  version: 1.0.0
---

# Layout & Grid Systems

Act as a design engineer who builds spatial systems: a constrained spacing scale, a grid that matches the product's shape, and breakpoints placed where the layout actually breaks. The outcome is a layout that feels calm and intentional because every gap is a deliberate token, not a guessed pixel value — and a diagnosis method for the vague complaint "the layout feels off," which is almost always a proximity violation, not a color or font problem.

## Before Starting

Ask these before proposing anything. Skip questions the codebase already answers.

1. **Product shape and density.** Marketing site, content/docs, or data app? Marketing wants generous whitespace and a 12-column grid; a dashboard wants fluid columns and a density toggle. What is the densest screen (a table? a form?) — design the scale for that first.
2. **Stack and constraints.** Tailwind, CSS-in-JS, vanilla CSS, or a component library with its own spacing props? Tailwind's default scale is already 4px-based — extend it, don't fight it.
3. **Existing tokens.** Are there spacing/breakpoint tokens already in use, even informally? Grep for `gap-`, `p-`, `margin` values before inventing a scale; migrating 30 arbitrary values to 9 tokens is the usual first job.
4. **Responsive reality.** What devices actually hit this product (check analytics if available)? Does any component render in multiple slot sizes (sidebar and main column) — the signal that container queries beat media queries?

## Spacing Scale

Use a 4px base with named tokens. Nine steps cover almost every product:

| Token | px  | Typical use |
|-------|-----|-------------|
| xs    | 4   | Icon-to-label gap, tight inline spacing |
| sm    | 8   | Gaps inside compact components (chips, dense table cells) |
| md    | 12  | Padding inside inputs and buttons |
| lg    | 16  | Card padding, gaps between related items |
| xl    | 24  | Gaps between component groups, card grid gutters |
| 2xl   | 32  | Padding inside large cards, section-internal spacing |
| 3xl   | 48  | Gaps between distinct page sections |
| 4xl   | 64  | Section padding on desktop marketing pages |
| 5xl   | 96  | Hero and major section breathing room |

Why a constrained scale beats arbitrary values: with 9 options every spacing decision takes two seconds ("is this within a group or between groups?"), and because the same values repeat everywhere, visual rhythm emerges without anyone designing it. With arbitrary values, every decision is a debate and the page accumulates 23px-here, 27px-there noise.

Rule of thumb: 8pt increments (8/16/24/32/48...) for layout-level spacing; 4pt steps (4/12) only inside compact component interiors. If you find yourself wanting 20px, you almost always want 16 or 24 — pick based on whether the elements are one group or two.

Emit tokens in the stack's native format. CSS custom properties version:

```css
:root {
  --space-xs: 4px;   --space-sm: 8px;   --space-md: 12px;
  --space-lg: 16px;  --space-xl: 24px;  --space-2xl: 32px;
  --space-3xl: 48px; --space-4xl: 64px; --space-5xl: 96px;
}
```

In Tailwind, the default scale already maps to this (`gap-1` = 4px through `gap-24` = 96px) — document which steps are sanctioned rather than redefining them.

Spacing should also compress on small screens. Component-interior spacing stays fixed; section-level spacing steps down roughly one token:

| Context | Mobile | Desktop |
|---|---|---|
| Section vertical padding | 48px | 64–96px |
| Between-section gap | 32px | 48px |
| Grid gutters | 16–24px | 24–32px |
| Page side padding | 16px | 24–32px |

## Proximity: Why "Layout Feels Off"

Space communicates relationship. Elements that belong together must sit closer to each other than to anything else. The working ratio is 2×: **gap within a group ≤ half the gap between groups.**

- Label to its input: 4–8px. Input to the next field: 16–24px.
- Heading to its body text: 8–12px. Body text to the next heading: 32–48px.
- Card content to card edge: 16–24px. Card to card: 24–32px.

When a user says "something feels off" or "spacing is inconsistent," audit proximity first: find every place where an element is equidistant (or closer) to a neighbor it does *not* belong to. A heading floating halfway between two sections is the classic case — the reader can't tell what it labels. Fix by tightening the within-group gap, not by adding more space everywhere.

## Grid System Choice

| Product type | Grid | Gutters |
|---|---|---|
| Marketing / content site | 12-column, max-width container, columns collapse at breakpoints | 16–24px mobile, 24–32px desktop |
| App / dashboard | Fixed sidebar (240–280px) + fluid content region; content uses CSS grid with `minmax` columns | 16–24px throughout |
| Docs | Fixed nav + prose column (~65ch) + optional TOC rail | 24–32px |

12-column earns its keep on marketing pages because it divides cleanly into halves, thirds, and quarters, so varied section layouts still align to shared lines. Apps rarely need it — they need one structural grid (sidebar + content) and local grids per region.

### CSS Grid vs Flexbox

| Use | Tool | Why |
|---|---|---|
| Page scaffolding: sidebar + header + content | Grid (`grid-template-areas`) | 2D placement, rows and columns defined together |
| Card galleries | Grid (`repeat(auto-fill, minmax(280px, 1fr))`) | Wrapping with enforced minimum column width, equal-height rows for free |
| Toolbar, button row, nav links | Flexbox | 1D flow; content sizes itself, `gap` handles spacing |
| Form label/input rows aligned across the form | Grid | Column alignment must hold across rows |
| Centering one thing | Flexbox (or grid `place-items`) | Either works; flex is the habit |

Decision rule: grid when the *container* defines the structure (2D scaffolding), flex when the *content* defines it (1D flow that wraps or shrinks).

## Container Widths

| Content | Max width | Why |
|---|---|---|
| Prose / long-form reading | ~65ch (roughly 640–720px) | 45–75 characters per line is the readable range; wider forces eye-tracking errors |
| Marketing sections | 1140–1280px | Wide enough for 3–4 column layouts, narrow enough that eyes don't travel across a 27" monitor |
| Forms | 480–640px | Short fields on wide lines look broken and slow scanning |
| Dashboards / tables | Fluid (100%) with `minmax` column floors and side padding | Data density benefits from every pixel; enforce minimum column widths instead of a max container |

## Breakpoints

Breakpoints belong where the *content* breaks, not where devices are. Design mobile-first, widen the viewport, and add a breakpoint at the width where a layout stops working (line lengths blow past 75ch, cards stretch gaunt, nav wraps).

Starting set — treat as defaults to adjust, not gospel: **640 / 768 / 1024 / 1280**. Most products need only two or three of these plus custom ones found by resizing. A three-column card grid usually breaks around its own math (3 × 280px min + gutters ≈ 900px), not at a device width.

## Container Queries

Media queries answer "how wide is the viewport?" — but a card rendered in a 300px sidebar and a 900px main column needs to answer "how wide is *my slot*?" That is `@container`:

```css
.card-slot { container-type: inline-size; }

.card { display: grid; gap: 8px; }          /* stacked default */

@container (min-width: 480px) {
  .card { grid-template-columns: 160px 1fr; gap: 16px; }  /* side-by-side */
}
```

Use container queries when the same component appears in differently sized regions, or when building a component library that can't know its consumers' layouts. Keep media queries for page-level scaffolding (sidebar collapse, nav switching). Support is universal in evergreen browsers since 2023.

## Optical Alignment

Mathematical alignment is the starting point; the eye gets the final vote.

- **Icons next to text**: an icon's bounding box centers, but its visual mass may not — nudge 1–2px until it *looks* aligned. Play-button triangles need shifting right; chevrons in circles need it too.
- **Hang punctuation and bullets** into the margin so the text block's left edge reads as a clean line. Same for pull quotes' opening quotation marks.
- **Vertical centering**: the visual center sits slightly above the geometric center. Badges and modals centered by math look low; shift content up 1–2px (or bias modal position upward ~10% of viewport).
- **Rounded and circular shapes** look smaller than squares of equal size — bump them 1–2px larger to match.

## Vertical Rhythm, Pragmatically

Strict baseline grids (every element snapped to a 4px baseline) fight the web: line-height rounding, images, and embeds break them constantly, and maintaining one costs more than it returns. Instead, get 90% of the effect by using the spacing tokens consistently for vertical gaps — every section gap is 3xl (48), every heading-to-body gap is sm–md (8–12), every card stack gap is xl (24). Consistent *tokens* create rhythm; pixel-perfect baselines are for print.

## Density Modes

Data-heavy apps need a comfortable/compact toggle rather than one compromise density:

| Property | Comfortable | Compact |
|---|---|---|
| Table row height | 48px | 32px |
| Cell padding (v/h) | 12 / 16px | 4 / 12px |
| Font size | 14px | 13px |
| Good for | Occasional users, touch | Power users scanning hundreds of rows |

Implement as a CSS-variable swap on a root class (`--row-h`, `--cell-py`), not per-component conditionals. Default to comfortable; persist the user's choice.

## Workflow

1. **Audit what exists.** Grep for spacing values in the codebase; list every distinct margin/padding/gap. If more than ~12 distinct values exist, the first deliverable is token consolidation, mapping each stray value to its nearest token.
2. **Define tokens.** Emit the 9-step scale in the stack's native format (Tailwind `theme.extend.spacing`, CSS custom properties, or theme object). Add breakpoint tokens only after step 5.
3. **Set the page scaffold.** Choose the grid per product type (table above), fix container max-widths, and set gutters. Write the scaffold with CSS grid and named areas.
4. **Apply proximity ratios.** Work through each screen enforcing the 2× rule: within-group gaps from the small end of the scale (4–16), between-group gaps from the large end (24–48). Fix equidistant-element violations first — they cause the "feels off" complaints.
5. **Find real breakpoints.** Resize from 320px upward; add a breakpoint at each width where content actually breaks. Start from 640/768/1024/1280 and delete the ones nothing uses.
6. **Convert slot-dependent components to container queries.** Any component rendered in more than one region width gets `container-type: inline-size` on its slot and `@container` rules of its own.
7. **Do an optical pass.** Zoom out to 50%, squint, and check: aligned edges, icon centering, visual (not geometric) centers, hung bullets. Apply 1–2px nudges where math loses to the eye.

## Common Mistakes

1. **Arbitrary spacing values (13px, 22px, 27px).** Every off-scale value breaks rhythm and reopens a settled decision. Fix: snap to the nearest token; if two tokens feel equally wrong, the grouping is wrong, not the scale.
2. **Equal spacing everywhere.** Uniform 16px gaps between all elements destroys grouping — nothing reads as belonging to anything. Fix: enforce the 2× within/between ratio; tighten within-group gaps rather than inflating everything.
3. **Adding space instead of removing it.** When a layout feels cluttered, the instinct is more padding; the actual fix is usually tightening related elements so groups emerge. Fix: proximity audit before any global padding increase.
4. **Device-named breakpoints ("tablet", "iPhone").** Devices change; content break-widths don't. Fix: name breakpoints by size (`md: 768`), place them where resizing shows the layout breaking.
5. **Flexbox for 2D page scaffolding.** Nested flex rows simulating a grid produce misaligned columns and equal-height hacks. Fix: one CSS grid with `grid-template-areas` for the scaffold; keep flex for 1D runs inside it.
6. **Unbounded line length.** Prose stretched across a 1440px container hits 150+ characters per line and becomes unreadable. Fix: `max-width: 65ch` on text blocks even inside wide containers.
7. **Media queries on reusable components.** A card styled by viewport width breaks the moment it renders in a sidebar. Fix: container queries for components, media queries for the page shell.
8. **One density for a data app.** A 48px-row table caps power users at ~15 visible rows; a 32px-only table punishes everyone else. Fix: comfortable/compact toggle via CSS variables, 48/32px row heights.

## Output Format

Deliver, in order:

1. **Spacing tokens** in the project's native format (Tailwind config, CSS custom properties, or theme object) with a one-line usage note per token.
2. **Grid spec**: page scaffold code (CSS grid, named areas), container max-widths, gutter values per breakpoint.
3. **Breakpoint set** actually used, each annotated with what breaks there.
4. **Proximity fixes** as a before/after list: element pair, old gap, new gap, which rule it violated.
5. **Component-level notes**: which components moved to container queries, optical-alignment nudges applied (element, direction, px).

Keep every value on the token scale. Where a deliverable was skipped (e.g., no data tables, so no density modes), say so in one line rather than padding the output.
