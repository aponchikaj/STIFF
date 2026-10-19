# Fonts

## CC Pixel Arcade — you have to supply the files

The brand face, in two roles: **CC Pixel Arcade Display** for headlines and
big numbers, **CC Pixel Arcade** for labels, buttons and the HUD. It is a
commercial licence from Comicraft (John Roshell, 2015) —
<https://myfonts.com/fonts/comicraft/pixel-arcade> or
<https://fontspring.com/fonts/comicraft/pixel-arcade> — and the files are
deliberately **not** in this repo. Shipping them without a webfont licence
is the one thing that turns a type purchase into a problem.

Buy the **web** licence, convert to woff2 if it does not come that way, and
drop the files here under exactly these names:

```
public/fonts/CCPixelArcadeDisplay.woff2   ← headlines (font-display)
public/fonts/CCPixelArcade.woff2          ← labels, buttons, HUD (font-pixel)
```

The `@font-face` rules at the bottom of `src/app/globals.css` already point
at those paths. Nothing else needs changing — add the files and every pixel
role switches over on the next reload. Then:

- re-measure `GLYPH_ADVANCE` in `src/components/wordmark.tsx`, which sizes
  the title-screen mark to the viewport from the face's average advance;
- look at the board and the play screen at 390px wide — the stand-in's
  metrics are not the real face's, so line-breaks will move.

## Silkscreen — installed, the stand-in

`Silkscreen-Regular.woff2` and `Silkscreen-Bold.woff2` are here, under the
SIL Open Font License (`Silkscreen-OFL.txt`). `globals.css` declares them as
**"STIFF Pixel"** with `size-adjust: 120%`, because Silkscreen's capitals are
0.70em tall and the screens were sized for a face whose capitals fill ~0.875em
— without it every 9–10px HUD label came out a fifth smaller. Bold carries
the display role, regular the labels.

It is self-hosted rather than loaded through `next/font` only because
`next/font` cannot set `size-adjust` on the face itself.

## Helvetica Neue — system

Sentences use the system copy via the `--font-body` stack. Not bundled: it
ships with macOS and iOS, and on Android/Windows the stack falls through to
Arial, which is the closest metric match. No file to add.
