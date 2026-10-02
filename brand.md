# Brand — STIFF

_Status: active_

## Aesthetic

Brutalist minimalist. High contrast, generous whitespace, strict monochrome.
The asterisk (*) is the core motif — logo, theme toggle, loaders, decorative
separators. It represents the "spark" of creativity; treat it as a graphic
element, not a character.

## Color

Strictly monochromatic, two themes (class-strategy dark mode):

| Token | Light | Dark |
|---|---|---|
| background | #ffffff | #000000 |
| foreground | #000000 | #ffffff |
| muted (secondary text) | #52525b | #a1a1aa |
| subtle (borders) | #e4e4e7 | #27272a |
| surface (image blocks) | #f4f4f5 | #18181b |

No accent colors. Ever. Emphasis comes from scale, weight, and spacing.

## Typography

- **Archivo Black** — display only: h1, h2, hero text, the giant footer wordmark.
  Exposed as `font-display` and applied to h1/h2 globally.
- **Archivo** (400/500/700) — everything else: body, buttons, UI, product copy.
  The two are one superfamily — same skeleton, different weight cuts.
- Uppercase + letterspacing (`tracking-[0.15em]`–`[0.35em]`) for labels/nav/buttons.

## The panels are a second system

`admin.stiff.ge` and `admin.stiff.co` do **not** follow the rules above, and
that is deliberate. The brand governs stiff.ge, where a visitor spends two
minutes and the job is to look like nobody else. A panel is a tool somebody
stares at for an hour settling hand-ins, and three of the storefront's rules
actively hurt there. Tokens live in each panel's `src/app/globals.css`, and
the primitives in `src/components/ui.tsx`.

| | Storefront | Panels |
|---|---|---|
| Page | pure white / pure black | warm off-white `#f5f5f3`, white cards |
| Colour | none, ever | state only: positive, caution, danger, info |
| Uppercase | headings, nav, buttons, labels | labels, nav, buttons, badges — never sentences |
| Radius | 2px | 4px controls, 14px cards |
| Body size | editorial | 14px, tabular numerals in every column |

**Why each.** A tinted page behind white cards is what lets a dense screen
separate into regions without drawing a box around everything. Semantic
colour is information: a cheating verdict, a rejected attempt and a P3 report
have to be tellable apart at a glance, and monochrome prevents that — so
colour is never decoration here, only status. And when everything is
uppercase nothing is emphasised, so uppercase is demoted to labels.

**What carries over:** Archivo and Archivo Black, the asterisk as the mark and
the loader, high contrast, and the discipline about whitespace. A panel
should still be recognisably ours from across the room.

## Motion

Subtle but pervasive; framer-motion. Scroll reveals = opacity fade + slight
vertical translation (0.6s, ease [0.16,1,0.3,1], viewport once). Asterisks
rotate 360° on hover. Primary buttons are magnetic (gravitate toward cursor).
Everything respects `prefers-reduced-motion`.

## Voice

Concise, declarative, lowercase-tolerant but uppercase-styled. No exclamation
marks. "Essential clothing. Nothing extra."
