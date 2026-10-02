# game/ — the STIFF game front end

The player-and-watcher app. Next.js 16 (App Router, `src/`, `@/*`),
TypeScript, Tailwind v4. Talks to the same NestJS API the shop does, at
`/api/game/*`.

**Design has not started.** What is here is the foundation: the design
tokens off the spec boards, the icon set, every API endpoint wired and
typed, and the primitives those two imply. `/` is a placeholder and
`/system` is a developer tool. Neither is a designed screen.

```bash
npm run dev        # http://localhost:3003
npm run build
npm run typecheck
npm run lint
```

## Running it locally

Two processes. The API first:

```bash
cd ../backend && REDIS_URL= npm run start:dev    # :4000
cd ../game    && npm run dev                     # :3003
```

`REDIS_URL=` is not optional locally. `backend/.env` points at a
Render-internal Redis host that does not resolve off Render, and with it set
the throttler storage never resolves, so **every request hangs forever** —
the server starts, maps its routes, logs "successfully started", and then
answers nothing. Blanking it for the local run is the fix.

Port 3003 is not arbitrary either: it is what the backend's `corsOrigins()`
already reserves as `GAME_FRONTEND_URL`. Run this app anywhere else and
every call is a CORS failure that looks exactly like the API being down.

Then open **http://localhost:3003/system** — it calls every route for real
and tells you which half of the stack is broken.

## Layout

```
src/
  app/
    globals.css      every design token — colour, type, grid, glow, CRT
    fonts.ts         Press Start 2P via next/font
    layout.tsx       providers + the root <html>
    page.tsx         placeholder front door
    system/          the reference page: tokens, icons, live API probes
  components/
    icon.tsx         <Icon> / <ButtonIcon> — pixel-correct rendering
    ui.tsx           Frame, Button, Dialog, Hearts, Stat, Grid, Display
    providers/       React Query, Lenis, Toaster
  lib/
    api/             one module per backend controller + the transport
    queries/         a typed React Query hook for every endpoint
    icons.ts         the icon manifest, as types
    hooks.ts         useCountdown, useDebounced, measureMedia, …
    utils.ts         cn, formatClock, formatNumber, formatAgo, …
public/
  icons/             44 glyphs + 6 button faces
  fonts/             PPNeueBit goes here — see its README
```

## The API layer

`src/lib/api/` is one module per backend controller, named the same, in the
same order. `src/lib/queries/` wraps each one in a React Query hook with the
cache behaviour that endpoint actually needs.

| Module | Backend controller | Routes |
|---|---|---|
| `game.ts` | `game.controller.ts` | 24 |
| `clans.ts` | `clans.controller.ts` | 5 |
| `wars.ts` | `wars.controller.ts` | 7 |
| `reports.ts` | `reports/reports.controller.ts` | 4 |
| `shop.ts` | `shop.controller.ts` | 3 |
| `voting.ts` | `voting.controller.ts` | 2 |
| `auth.ts` | `auth.controller.ts` | 10 |
| `profile.ts` | `users.controller.ts` (the `me` half) | 6 |
| `notifications.ts` | `notifications.controller.ts` | 4 |

`/game/admin/*` is deliberately absent. Those routes are `@Roles('admin')`,
they belong to the game-admin panel on admin.stiff.co, and an admin-audience
token is rejected by the shop guard this client speaks to — a call from here
could only ever fail.

### Three things to know before writing a screen

**Sessions are the shop's.** There is no separate game account.
`POST /game/register` asks for less (a side, a handle, a password, a date of
birth — no email) and runs the 16+ age gate, but it mints an ordinary shop
token. Someone who signs up here is signed in on stiff.ge too.

**Reading works signed out.** The feed, the board, the pool, the shop, wars
and the season are all public — that is what makes someone want an account.
So `likedByMe` is `null`, not `false`, for an anonymous reader: false would
be a claim about someone who does not exist. Render it as *unknown*.

**A hand-in is three steps.** Ticket → `PUT` straight to object storage →
confirm. The bytes never pass through the API. `useHandIn` runs all three
and exposes `stage` and `progress`, because a 40 MB upload on a phone with a
clock at 00:40 needs a bar, not a spinner.

## The design system

Three spec boards fix four things, and `globals.css` encodes exactly those.

**Colour** — `#ffffff`, `#01a3ff`, `#01e7ff` on pure black, plus a heart red
and a coin amber sampled off the icon sheet. The board's rule is literal:
*"nothing without blur."* Every blue ships with a matching glow token. A
flat blue is off-brand.

**Type** — three roles. `font-display` (PPNeueBit-Bold, 32/28) for
headlines, `font-pixel` (Press Start 2P) for labels, buttons and the HUD,
`font-body` (Helvetica Neue, 16/20, caption 12/16) for anything read as a
sentence.

**Grid** — the board specifies 320–599px / 4 columns / 16px margins / 16px
gutter. The ladder extends that to 8 columns at 600px and 12 at 905px, with
the 16px rhythm held. Use `.grid-stiff`.

**Frames** — no radius anywhere. The rounded look in the mockups is a 6px
corner notch, cut by `.frame-notch`.

### The one trap

`clip-path` is applied *after* both `box-shadow` and `filter` on the same
element. Put a glow next to `.frame-notch` and it is clipped away with the
corners — silently, no error, the element just doesn't glow.

So a notched thing that glows is always **two elements**: the parent takes a
`.bloom-*` drop-shadow filter, the child takes the notch. `Frame` and
`Button` are built that way; copy the pattern rather than reaching for
`shadow-*` on anything notched.

### Icons

44 glyphs and 6 button faces in `public/icons/`, typed in `src/lib/icons.ts`
so a wrong name fails to compile instead of 404ing invisibly on a black page.

They are pixel art with scanlines and bloom already baked into the raster.
Two rules follow: never resample them smoothly (`<Icon>` sets
`image-rendering: pixelated` and passes `unoptimized`, which is load-bearing
— the Next image optimizer would re-encode and ruin them), and scale only by
whole multiples (`ICON_SIZES`: 16/24/32/48/64/96). `icon-glow` *adds* bloom
for a hover state; an un-glowed icon is already correct.

`opal` is the only non-square glyph and the only currency mark in the set —
there is no coin icon. `ICON_ASPECT` keeps it from being squashed.

### Fonts

Press Start 2P is installed. **PPNeueBit is not** — it is a commercial
Pangram Pangram licence and the files are not in the repo. `public/fonts/`
has the instructions; until the files are dropped in, `--font-display` falls
through to Press Start 2P, which keeps the pixel character but is much wider
per character. Do not sign off headline line-breaks before the real file
lands.

## Animation

Installed and ready: framer-motion + motion, GSAP + @gsap/react, Lenis,
@react-spring/web, @use-gesture/react, anime.js, @formkit/auto-animate,
canvas-confetti, lottie-react, split-type, react-fast-marquee, embla,
@number-flow/react, tw-animate-css, sonner, vaul, and
three + @react-three/fiber/drei/postprocessing for shader work on the CRT.

`optimizePackageImports` in `next.config.ts` keeps the bundle to what each
screen imports. Everything respects `prefers-reduced-motion`: the CSS layer
neutralises declarative animation globally, and `usePrefersReducedMotion`
covers the JS-driven kind that CSS cannot reach.

## Which branch this belongs on

Per the root `CLAUDE.md`: a fourth Next app is not shop work and must not
ship to stiff.ge. `game/` belongs on the **`game`** branch, which is a
superset of `main` the way `staff`, `admin` and `game-admin` are — it takes
shop work by `git merge main`, never by having it authored there.
