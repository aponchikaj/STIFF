# game-admin — admin.stiff.co

The game's control room. A separate Next.js app from the shop's panel, on a
separate domain, deployed from the `game-admin` branch and nothing else.

**Two panels, and the split is by product, not by size.** `admin.stiff.ge`
runs the shop: products, orders, gallery, content, collab. This one runs the
game: seasons, the review queue, players, the board, the task pool, the coin
shop and reports. Neither carries the other's screens, because an operator
running a season at midnight should not be one mis-click from editing a
product, and the two have different rhythms — the shop is a working week, a
season is a clock.

```bash
npm run dev        # http://localhost:3004
npm run build
npm run lint
npm run typecheck
```

## The screens

Grouped by what the operator is doing.

| Group | Screen | For |
|---|---|---|
| | Overview | the season, the counts, and **Needs a person** — what gets worse while nobody looks |
| **Queues** | Review | hand-ins waiting on a verdict, with what the model thought |
| | Votes | watchers' votes still open, and the deferred ones waiting on a person |
| | Reports | what players reported, claimed, prioritised and closed |
| | Clocks | tasks people hold and the timers on them, counting down live |
| **The season** | Hand-ins | every photo and clip, not only the queue; take one down, hide a comment |
| | Players | everyone enrolled: score and coin ledgers, corrections, flag, reinstate |
| | Clans | both seats, combined Nerve, record, and organising a war |
| | Clan wars | every war and its book; settle a stuck one, void and refund |
| | Board | the ranking, and player search |
| **Setup** | Seasons | draft, open, running, closed |
| | Tasks | the pool, the two-agent generator, the Charter's refusal rates |
| | Coin shop | items and purchases |

**Three levers deserve care**, and all three go through the path that already
exists for them rather than a second one:

- **Coin corrections** — coins are bought with real money. Through the ledger,
  floored at zero, a reason required, the admin named on the row.
- **Organising a war** — skips the challenge and opens the book at once. Until
  the player app exists it is the only way a war starts.
- **Hiding a comment** — never deleting. A hidden comment can be put back.

Nothing in the panel lets an admin bet. Someone who can see every pool and
settle every war has no business holding a stake in one.

Links between screens carry their filter in the URL — `/votes?status=deferred`,
`/hand-ins?status=published`, `/wars?filter=live` — so a number on the overview
opens the list it counted.

## One backend, one admin identity

There is no separate sign-in here. An admin is an ordinary shop account with
`role=admin`, and `/api/admin/auth/login` is the one place that mints an
admin-audience token. That token reaches `/api/game/admin/*` because those
routes carry `@Roles('admin')` — see the audience rules in the repo's root
`CLAUDE.md` and `backend/src/common/guards/jwt-auth.guard.spec.ts`.

So: sign in at admin.stiff.ge or here, it is the same account and the same
password. The cookies are per-origin, so the two panels hold their own
sessions and signing out of one leaves the other alone.

## The cross-domain part, which is the thing to get right

The panel is on **stiff.co** and the API is on **stiff.ge**. Those are
different registrable domains, so every call is cross-site unless it is
proxied first-party:

- **In production**, set `NEXT_PUBLIC_API_URL=/api` and `BACKEND_URL` to Nest.
  `next.config.ts` rewrites `/api/*` to the backend, so the browser only ever
  sees a same-origin request and the session cookie stays first-party. Without
  this, a browser blocking third-party cookies signs the operator out on every
  navigation, and nothing in the UI explains why.
- **In development** the panel calls `http://localhost:4000/api` directly and
  relies on CORS. `corsOrigins()` in `backend/src/configure-app.ts` must name
  this origin — `http://localhost:3004` locally, `https://admin.stiff.co`
  deployed — or every request fails in the browser with nothing in the server
  log to show for it.

## Media

Hand-ins live in the R2 bucket behind `media.stiff.ge`. The review screen
loads them directly, so that origin is named in the Content-Security-Policy in
`src/proxy.ts` (`NEXT_PUBLIC_GAME_MEDIA_URL` to override). A wrong value fails
silently — the photo simply never paints. Cloudinary is deliberately *not*
allowed: it holds the shop's product photography, which nothing here should be
able to load.

## Layout

| Path | What |
|---|---|
| `src/lib/api/game.ts` | one function per game endpoint, named for what it does |
| `src/lib/api/game-types.ts` | mirrors of the backend's entities and DTOs |
| `src/components/game/` | one file per screen, sharing `game-ui.tsx` |
| `src/components/chrome.tsx` | the header, the section nav, the session gate |
| `src/proxy.ts` | per-request CSP nonce and the security headers |

Every route the backend exposes under `/api/game/admin/*` has a function in
`game.ts`, and every function is called by a screen. When the backend grows a
route, it belongs in both places.

## Irreversible things

The panel does several: zeroing a cheater, burning a heart, retiring a task,
cancelling a purchase, closing a report with an action. None of them use a
browser dialog. `ConfirmButton` arms on the first press and fires on the
second, so a mis-click costs a press rather than a season.
