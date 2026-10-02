@AGENTS.md

# game/ — the STIFF game front end

Next.js 16 (App Router, `src/`, `@/*`), TypeScript, Tailwind v4, on
**port 3003**. Full orientation is in `README.md`; this file is the set of
things that are easy to get wrong.

## Branch

`game/` belongs on the **`game`** branch, never on `main`. It is a fourth
Next app and must not ship to stiff.ge. Like `staff`, `admin` and
`game-admin`, that branch is a superset of `main` and takes shop work by
`git merge main` — never by having it authored there.

## Running it

```bash
cd ../backend && REDIS_URL= npm run start:dev    # :4000
npm run dev                                      # :3003
```

Both parts matter.

**`REDIS_URL=`.** `backend/.env` points at a Render-internal Redis host that
does not resolve off Render. With it set, the throttler storage never
resolves and **every request hangs forever** — Nest starts, maps its routes,
logs "successfully started", and then answers nothing. It does not look like
a Redis problem; it looks like the API is dead.

**Port 3003.** The backend's `corsOrigins()` reserves it as
`GAME_FRONTEND_URL`. Any other port means every call is a CORS failure that
also looks like the API being down.

`/system` calls every route for real and tells you which half is broken.

## API

`src/lib/api/` is one module per backend controller, same name, same order.
`src/lib/queries/` is a typed React Query hook per endpoint. When a backend
route changes, change the matching module — do not call `apiFetch` from a
component.

- **Sessions are the shop's.** No separate game account. `POST /game/register`
  asks for less and runs the 16+ gate but mints an ordinary shop token.
  Reuse `authApi`; do not invent a second refresh path.
- **`/game/admin/*` is out of scope here.** Those are `@Roles('admin')` and
  belong to the panel on admin.stiff.co. An admin token is rejected by the
  guard this client speaks to, so such a call could only ever fail.
- **Reading works signed out.** `likedByMe` is `null`, not `false`, for an
  anonymous reader. Render it as *unknown* — false is a claim about someone
  who does not exist.
- **A hand-in is three steps** (ticket → `PUT` to storage → confirm) and
  only the confirm makes the attempt real. Use `useHandIn`; it exposes
  `stage` and `progress` because a 40 MB upload against a running clock
  needs a bar, not a spinner.
- **Clocks tick locally.** `useCountdown` derives from `expiresAt` rather
  than decrementing, so a slept tab wakes up correct. Never poll a clock.

## Design system

Tokens live in `src/app/globals.css` and come off the three spec boards.
Read a token; never hardcode a hex, a size or a gutter.

- **Nothing without blur.** Every blue is painted with a glow token. A flat
  `#01a3ff` is off-brand.
- **No radius.** The rounded look is a 6px corner notch (`.frame-notch`).
- **Type has three roles**: `font-display` (headlines), `font-pixel`
  (labels, buttons, HUD), `font-body` (sentences). Pixel faces are uppercase
  and letter-spaced; body text is not.
- **Grid** is `.grid-stiff` — 4/8/12 columns, 16px gutter.

### The trap

`clip-path` is applied **after** `box-shadow` and `filter` on the same
element. A glow declared next to `.frame-notch` is clipped away with the
corners — silently. Anything notched that glows is two elements: parent
takes a `.bloom-*` drop-shadow, child takes the notch. `Frame` and `Button`
do this; copy them rather than reaching for `shadow-*`.

## Icons

44 glyphs + 6 button faces in `public/icons/`, typed in `src/lib/icons.ts`.
Use `<Icon>`/`<ButtonIcon>` — never a raw `<img>`.

They are pixel art with scanlines and bloom baked into the raster, so:
never resample smoothly (`unoptimized` on the `next/image` is load-bearing),
and scale only by whole multiples from `ICON_SIZES`. `opal` is the only
non-square glyph, and the only currency mark in the set — there is no coin
icon. Prefer `ICON_ROLES` over a bare name so a screen asks for a meaning.

## Fonts

Press Start 2P is installed. **PPNeueBit is not** — commercial Pangram
Pangram licence, files deliberately absent. `--font-display` falls through
to Press Start 2P meanwhile, which is a much wider face, so headline
line-breaks will move when the real files land. See `public/fonts/README.md`.

## Before claiming something works

`npm run typecheck && npm run lint && npm run build`, and look at the page.
