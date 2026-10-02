# Fonts

## Press Start 2P — installed, nothing to do

Loaded through `next/font/google` in `src/app/fonts.ts`. Self-hosted at build
time, so there is no request to Google at runtime and no layout shift.

## PPNeueBit — you have to supply the files

`PPNeueBit-Bold` is the display face on the spec board. It is a commercial
licence from Pangram Pangram (<https://pangrampangram.com/products/bitmap-fonts>)
and the files are deliberately **not** in this repo — shipping them without a
webfont licence is the one thing that turns a type purchase into a problem.

Buy the **web** licence, then drop these two files in this folder:

```
public/fonts/PPNeueBit-Bold.woff2      ← required, the display face
public/fonts/PPNeueBit-Regular.woff2   ← optional, used nowhere yet
```

The `@font-face` rules at the bottom of `src/app/globals.css` already point
at those exact paths. Nothing else needs changing — add the files and every
`font-display` heading switches over on the next reload.

### Until then

`--font-display` falls through to Press Start 2P, which is also a pixel face,
so the layout holds and nothing looks broken. The two are not metrically
compatible though — Press Start 2P is considerably wider per character — so
**do not sign off on final headline line-breaks until the real file is in.**

## Helvetica Neue — system

Body text uses the system copy via the `--font-body` stack. Not bundled: it
ships with macOS and iOS, and on Android/Windows the stack falls through to
Arial, which is the closest metric match. No file to add.
