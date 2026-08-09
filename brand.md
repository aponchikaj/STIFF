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

## Motion

Subtle but pervasive; framer-motion. Scroll reveals = opacity fade + slight
vertical translation (0.6s, ease [0.16,1,0.3,1], viewport once). Asterisks
rotate 360° on hover. Primary buttons are magnetic (gravitate toward cursor).
Everything respects `prefers-reduced-motion`.

## Voice

Concise, declarative, lowercase-tolerant but uppercase-styled. No exclamation
marks. "Essential clothing. Nothing extra."
