# Opal Level 1 — The Shell · Implementation Plan

> **For agentic workers:** Use `subagent-driven-development` (recommended) or
> `executing-plans` to implement this plan task-by-task. Steps use checkbox
> (`- [ ]`) syntax for tracking.

**Goal:** Stand up `game.stiff.ge` as a walkable front door — intro film →
CHOOSE → role picker → a static opal ladder with hearts and a Nerve rail —
carrying the Opal visual identity as real design tokens.

**Architecture:** A fourth Next.js app at `game/` on a new `game` branch, which
is a superset of `main` exactly as `staff` and `admin` are. The backend gains a
`src/game/` module on every branch serving `/api/game/*`, following the
`src/staff/` precedent. Nothing in this level stores state or calls a model —
the ladder renders from a hardcoded fixture so the whole shell can be reviewed
before any schema exists.

**Tech Stack:** Next.js 16 (App Router, `src/`, `@/*` alias), React 19,
TypeScript, Tailwind CSS v4, NestJS 11, Jest.

**Spec:** the Opal design document (artifact). Sections §02 (look and feel),
§03 (the two loops), §04 (the ladder), §12 (hearts), §20 (repo).

## Global Constraints

- **Branch:** all work on `game`, branched from `main`. Never author shop
  changes here.
- **No Docker in local development.** Postgres runs natively via the EDB
  installer. This level touches no database anyway.
- **Backend routes are prefixed `/api`** via `setGlobalPrefix`. Game routes live
  under `/api/game/*`.
- **Palette (spec §02), exact values:** `--void:#07060C`, `--deep:#0F0A1C`,
  `--haze:#17102C`, `--line:#2E2352`, `--hot:#FF2D8F`, `--cold:#22E4FF`,
  `--pulse:#8B45FF`, `--amber:#FFB43D`, `--bone:#F1ECFF`, `--ash:#9C90C4`.
- **Type (spec §02):** Chakra Petch 700 display, IBM Plex Sans body, IBM Plex
  Mono for all labels and data.
- **Colour is structural, not decorative:** magenta is the player's side, cyan
  the watcher's, amber means held. Nothing gets a colour because it looked good
  there.
- **Every animation respects `prefers-reduced-motion`.** All motion in this
  level is decorative; none carries information.
- **Frontend has no test runner.** The gate for frontend work is
  `npm run lint && npm run typecheck && npm run build`, plus browser
  verification. Backend work is real TDD with Jest.

---

## File Structure

**Created:**

| File | Responsibility |
|---|---|
| `game/` | The player and watcher Next app. Scaffolded from the same config as `frontend/`. |
| `game/src/app/globals.css` | The Opal design tokens and Tailwind v4 `@theme`. Single source of colour. |
| `game/src/app/layout.tsx` | Font wiring, `<html>` shell, the scanline and bloom layers. |
| `game/src/app/page.tsx` | Intro → CHOOSE. The cold open. |
| `game/src/app/play/page.tsx` | The opal ladder, hearts rail, Nerve rail. |
| `game/src/components/intro-sequence.tsx` | The film and the CHOOSE beat. |
| `game/src/components/role-picker.tsx` | The two panels, magenta and cyan. |
| `game/src/components/opal.tsx` | One opal in its four states. Pure presentational. |
| `game/src/components/opal-ladder.tsx` | The three-day ladder. Consumes fixture data. |
| `game/src/components/hearts-rail.tsx` | Three hearts: whole, ash, out. |
| `game/src/lib/fixtures.ts` | Hardcoded season shape. Deleted in Level 2. |
| `game/src/lib/types.ts` | `OpalState`, `LadderDay`, `PlayerState`. Survives into Level 2. |
| `game/next.config.ts` | Security headers — **camera allowed on this origin only**. |
| `backend/src/game/game.module.ts` | Game module registration. |
| `backend/src/game/game.controller.ts` | `GET /api/game/health`. |
| `backend/src/game/game.controller.spec.ts` | Its test. |
| `backend/src/configure-app.spec.ts` | Pins the CORS origin list. |

**Modified:**

| File | Change |
|---|---|
| `backend/src/app.module.ts` | Register `GameModule`. |
| `backend/src/configure-app.ts` | Add the game origin to `corsOrigins()`. |
| `frontend/src/app/page.tsx` | The PLAY band. |
| `.github/workflows/ci.yml` | Detect and gate the `game/` app. |
| `.claude/launch.json` | `game` on port 3003. |
| `CLAUDE.md` | Document the `game` branch and app. |

---

## Task 1: The branch, the app, and CI

**Files:**
- Create: `game/` (full Next scaffold)
- Modify: `.github/workflows/ci.yml`, `.claude/launch.json`, `CLAUDE.md`

**Interfaces:**
- Produces: a `game/` workspace whose `npm run lint`, `npm run typecheck` and
  `npm run build` all pass, and a CI job that runs them.

- [ ] **Step 1: Branch from main**

```bash
git checkout main && git pull
git checkout -b game
```

- [ ] **Step 2: Scaffold the app with the same shape as `frontend/`**

```bash
npx create-next-app@latest game \
  --typescript --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --turbopack --no-git
```

- [ ] **Step 3: Match the frontend's scripts**

Edit `game/package.json` so `scripts` reads exactly:

```json
{
  "dev": "next dev --port 3003",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "typecheck": "tsc --noEmit"
}
```

- [ ] **Step 4: Verify the scaffold is green**

```bash
cd game && npm run lint && npm run typecheck && npm run build
```

Expected: all three exit 0. If `build` fails on a fresh scaffold, fix that
before going further — everything downstream assumes a green baseline.

- [ ] **Step 5: Teach CI about the game app**

In `.github/workflows/ci.yml`, the `detect` job already probes for
`staff/package.json` and `admin/package.json`. Add the same for game.

Under `outputs:` add:

```yaml
      has_game: ${{ steps.check.outputs.has_game }}
```

And inside the `run:` block of the `check` step, append:

```bash
          if [ -f game/package.json ]; then
            echo "has_game=true" >> "$GITHUB_OUTPUT"
          else
            echo "has_game=false" >> "$GITHUB_OUTPUT"
          fi
```

Then copy the existing `admin` job wholesale, renaming `admin` → `game`
throughout, gating it on `needs.detect.outputs.has_game == 'true'`. Keep the
build-before-typecheck order the existing jobs use — commit `d50880f9` fixed
that for a reason: Next generates types during build, so typecheck before build
can never be green.

- [ ] **Step 6: Add the dev server entry**

In `.claude/launch.json`, append to `configurations`:

```json
    {
      "name": "game",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "dev"],
      "cwd": "game",
      "port": 3003,
      "autoPort": false
    }
```

- [ ] **Step 7: Document the branch in CLAUDE.md**

In the branches table add a row:

```markdown
| `game` | everything in `main` **plus** `game/` | game.stiff.ge |
```

And under "Where to put a change" add:

```markdown
- **Game work** — anything in `game/`, or in `backend/src/game/`: seasons,
  tasks, attempts, the ledger, the leaderboard.
  → commit on **`game`**.
```

- [ ] **Step 8: Commit**

```bash
git add game .github/workflows/ci.yml .claude/launch.json CLAUDE.md
git commit -m "Give the game its own branch, app and CI gate."
```

---

## Task 2: Design tokens

**Files:**
- Modify: `game/src/app/globals.css`, `game/src/app/layout.tsx`

**Interfaces:**
- Produces: CSS custom properties for every colour in the spec's palette,
  exposed to Tailwind v4 via `@theme`, plus three font families available as
  `font-display`, `font-body`, `font-mono`.

- [ ] **Step 1: Write the tokens**

Replace the contents of `game/src/app/globals.css`:

```css
@import "tailwindcss";

@theme {
  --color-void: #07060c;
  --color-deep: #0f0a1c;
  --color-haze: #17102c;
  --color-raise: #1f1640;
  --color-line: #2e2352;
  --color-line-hi: #453473;

  --color-hot: #ff2d8f;
  --color-cold: #22e4ff;
  --color-pulse: #8b45ff;
  --color-amber: #ffb43d;

  --color-bone: #f1ecff;
  --color-ash: #9c90c4;
  --color-ash-dim: #6b6091;

  --font-display: var(--font-chakra), system-ui, sans-serif;
  --font-body: var(--font-plex-sans), system-ui, sans-serif;
  --font-mono: var(--font-plex-mono), ui-monospace, monospace;
}

/* Opal commits to one visual world. There is no light theme — the ground is
   painted explicitly so nothing borrows a host background. */
html {
  background: var(--color-void);
}

body {
  background: var(--color-void);
  color: var(--color-bone);
  font-family: var(--font-body);
  -webkit-font-smoothing: antialiased;
}

/* Two hard lights from opposite sides of a dark frame — spec §02. */
.opal-bloom {
  position: fixed;
  inset: -20vh -10vw;
  z-index: 0;
  pointer-events: none;
  background:
    radial-gradient(48vw 42vw at 8% 3%, rgb(255 45 143 / 0.2), transparent 62%),
    radial-gradient(44vw 40vw at 96% 20%, rgb(34 228 255 / 0.15), transparent 62%),
    radial-gradient(60vw 50vw at 50% 108%, rgb(139 69 255 / 0.16), transparent 66%);
  animation: opal-drift 34s ease-in-out infinite alternate;
}

@keyframes opal-drift {
  from { transform: translate3d(-2%, -1%, 0) scale(1); }
  to   { transform: translate3d(3%, 2%, 0) scale(1.08); }
}

.opal-scanlines {
  position: fixed;
  inset: 0;
  z-index: 40;
  pointer-events: none;
  opacity: 0.5;
  mix-blend-mode: multiply;
  background-image: repeating-linear-gradient(
    to bottom,
    rgb(0 0 0 / 0.26) 0px,
    rgb(0 0 0 / 0.26) 1px,
    transparent 1px,
    transparent 3px
  );
}

@media (prefers-reduced-motion: reduce) {
  *,
  .opal-bloom {
    animation: none !important;
    transition: none !important;
  }
}
```

- [ ] **Step 2: Wire the fonts**

Replace `game/src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Chakra_Petch, IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const chakra = Chakra_Petch({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-chakra",
  display: "swap",
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Opal",
  description: "Three tasks. Fifteen minutes. Everyone watching.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${chakra.variable} ${plexSans.variable} ${plexMono.variable}`}
    >
      <body>
        <div className="opal-bloom" aria-hidden />
        <div className="opal-scanlines" aria-hidden />
        <div className="relative z-10">{children}</div>
      </body>
    </html>
  );
}
```

- [ ] **Step 3: Verify**

```bash
cd game && npm run lint && npm run typecheck && npm run build
```

Then `npm run dev`, open `http://localhost:3003`, and confirm: the page ground
is near-black with a violet cast (not pure `#000`), the bloom drifts slowly, and
scanlines are visible but subtle. Toggle "Reduce motion" in the OS and confirm
the bloom stops moving.

- [ ] **Step 4: Commit**

```bash
git add game/src/app/globals.css game/src/app/layout.tsx
git commit -m "Give the game its palette, its type and its two lights."
```

---

## Task 3: Backend game module

**Files:**
- Create: `backend/src/game/game.module.ts`, `backend/src/game/game.controller.ts`,
  `backend/src/game/game.controller.spec.ts`
- Modify: `backend/src/app.module.ts`

**Interfaces:**
- Produces: `GameModule`, and `GET /api/game/health` returning
  `{ status: 'ok', level: 1 }`. Level 2's enrolment controller registers into
  this module.

- [ ] **Step 1: Write the failing test**

Create `backend/src/game/game.controller.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { GameController } from './game.controller';

describe('GameController', () => {
  let controller: GameController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [GameController],
    }).compile();

    controller = module.get<GameController>(GameController);
  });

  it('reports health without a session', () => {
    expect(controller.health()).toEqual({ status: 'ok', level: 1 });
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd backend && npm run test -- game.controller
```

Expected: FAIL — `Cannot find module './game.controller'`.

- [ ] **Step 3: Write the controller**

Create `backend/src/game/game.controller.ts`:

```ts
import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

@Controller('game')
export class GameController {
  /**
   * Unauthenticated on purpose: the game origin polls this to know the API is
   * reachable before it asks anyone to sign in.
   */
  @Public()
  @Get('health')
  health(): { status: 'ok'; level: number } {
    return { status: 'ok', level: 1 };
  }
}
```

> Check the actual path and name of the `@Public()` decorator in
> `backend/src/common/` before writing this import — match what the shop's
> controllers already use rather than inventing a path.

- [ ] **Step 4: Write the module**

Create `backend/src/game/game.module.ts`:

```ts
import { Module } from '@nestjs/common';
import { GameController } from './game.controller';

@Module({
  controllers: [GameController],
})
export class GameModule {}
```

- [ ] **Step 5: Register it**

In `backend/src/app.module.ts`, import `GameModule` and add it to the `imports`
array, next to the other feature modules.

- [ ] **Step 6: Run the test and the whole suite**

```bash
cd backend && npm run test -- game.controller && npm run test
```

Expected: the new test PASSES and nothing else breaks.

- [ ] **Step 7: Commit**

```bash
git add backend/src/game backend/src/app.module.ts
git commit -m "Give the game a module and a door to knock on."
```

---

## Task 4: CORS for the game origin

**Files:**
- Modify: `backend/src/configure-app.ts`
- Create: `backend/src/configure-app.spec.ts`

**Interfaces:**
- Consumes: `corsOrigins()` from Task 3's module context.
- Produces: `corsOrigins()` including `https://game.stiff.ge` and, when set,
  `GAME_FRONTEND_URL`.

- [ ] **Step 1: Write the failing test**

Create `backend/src/configure-app.spec.ts`:

```ts
import { corsOrigins } from './configure-app';

describe('corsOrigins', () => {
  const saved = { ...process.env };

  afterEach(() => {
    process.env = { ...saved };
  });

  it('always allows the production game origin', () => {
    expect(corsOrigins()).toContain('https://game.stiff.ge');
  });

  it('allows the game frontend from env in development', () => {
    process.env.GAME_FRONTEND_URL = 'http://localhost:3003';
    expect(corsOrigins()).toContain('http://localhost:3003');
  });

  it('defaults the game origin to port 3003 when unset', () => {
    delete process.env.GAME_FRONTEND_URL;
    expect(corsOrigins()).toContain('http://localhost:3003');
  });

  it('does not repeat an origin that appears twice', () => {
    process.env.GAME_FRONTEND_URL = 'https://game.stiff.ge';
    const origins = corsOrigins();
    expect(origins.filter((o) => o === 'https://game.stiff.ge')).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
cd backend && npm run test -- configure-app
```

Expected: FAIL — the array does not contain `https://game.stiff.ge`.

- [ ] **Step 3: Add the origin**

In `backend/src/configure-app.ts`, inside `corsOrigins()`, add two entries to
the set — the env-driven one beside the other three, and the production host
beside the other stiff.ge subdomains:

```ts
      process.env.GAME_FRONTEND_URL ?? 'http://localhost:3003',
```

```ts
      'https://game.stiff.ge',
```

The existing `new Set([...])` already handles the duplicate case, which is what
the fourth test pins.

- [ ] **Step 4: Run the test**

```bash
cd backend && npm run test -- configure-app
```

Expected: PASS, all four.

- [ ] **Step 5: Commit**

```bash
git add backend/src/configure-app.ts backend/src/configure-app.spec.ts
git commit -m "Let the game's origin talk to the API."
```

---

## Task 5: Camera policy on the game origin only

**Files:**
- Create: `game/next.config.ts`

**Interfaces:**
- Produces: a `Permissions-Policy` on the game origin permitting `camera` and
  `microphone` from `self`. Level 6's `getUserMedia` call depends on this.

The shop sets `camera=()` globally at `frontend/next.config.ts:71`, and the API
sets the same header on its responses. Neither changes. The game origin needs
the opposite, and only for itself.

- [ ] **Step 1: Write the config**

Create `game/next.config.ts`:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            // The shop disables the camera everywhere. The game is the one
            // origin that needs it, and only from its own documents — a live
            // attempt is captured here and nowhere else.
            key: "Permissions-Policy",
            value:
              "camera=(self), microphone=(self), display-capture=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify the header is actually served**

```bash
cd game && npm run build && npm run start &
sleep 3
curl -sI http://localhost:3003/ | grep -i permissions-policy
```

Expected: `permissions-policy: camera=(self), microphone=(self), display-capture=(), geolocation=()`

Then stop the server.

- [ ] **Step 3: Confirm the shop is untouched**

```bash
grep -n "Permissions-Policy" -A3 frontend/next.config.ts
```

Expected: still `camera=()`. If this changed, revert it — widening the shop's
camera policy is not part of this work.

- [ ] **Step 4: Commit**

```bash
git add game/next.config.ts
git commit -m "Open the camera on the game's origin, and only there."
```

---

## Task 6: Types and the season fixture

**Files:**
- Create: `game/src/lib/types.ts`, `game/src/lib/fixtures.ts`

**Interfaces:**
- Produces: `OpalState`, `LadderDay`, `PlayerState`, and `DEMO_PLAYER`.
  Tasks 7–9 consume these. `types.ts` survives into Level 2; `fixtures.ts` is
  deleted there.

- [ ] **Step 1: Write the types**

Create `game/src/lib/types.ts`:

```ts
/** Spec §04. An opal is sealed until its hour, then briefly alive. */
export type OpalState = "locked" | "armed" | "live" | "spent" | "missed";

export type Verdict = "completed" | "failed" | "declined";

export interface LadderDay {
  day: 1 | 2 | 3;
  /** "Qualifier" | "Nerve" | "Final" — shown under the opal. */
  tier: string;
  state: OpalState;
  /** ISO 8601. When this opal opens. */
  opensAt: string;
  /** Minutes on the clock once accepted. */
  clockMinutes: number;
  /** Null until settled. */
  verdict: Verdict | null;
}

export interface PlayerState {
  handle: string;
  /** Spec §12. Three at the start of a season; ash never returns. */
  heartsRemaining: number;
  heartsTotal: number;
  /** Spec §06. Earned only, never bought, never spent. */
  nerve: number;
  coins: number;
  rank: number | null;
  days: LadderDay[];
}
```

- [ ] **Step 2: Write the fixture**

Create `game/src/lib/fixtures.ts`:

```ts
import type { PlayerState } from "./types";

/**
 * Level 1 renders the shell with no backend. Level 2 replaces this with real
 * enrolment data and deletes this file.
 *
 * Deliberately mid-season: one day cleared, one live, one still sealed, and a
 * heart already gone — the states that are easy to get wrong are the ones worth
 * looking at while reviewing.
 */
export const DEMO_PLAYER: PlayerState = {
  handle: "asterisk",
  heartsRemaining: 2,
  heartsTotal: 3,
  nerve: 100,
  coins: 5,
  rank: 847,
  days: [
    {
      day: 1,
      tier: "Qualifier",
      state: "spent",
      opensAt: "2026-09-14T12:00:00+04:00",
      clockMinutes: 15,
      verdict: "completed",
    },
    {
      day: 2,
      tier: "Nerve",
      state: "live",
      opensAt: "2026-09-15T12:00:00+04:00",
      clockMinutes: 20,
      verdict: null,
    },
    {
      day: 3,
      tier: "Final",
      state: "locked",
      opensAt: "2026-09-16T12:00:00+04:00",
      clockMinutes: 25,
      verdict: null,
    },
  ],
};
```

- [ ] **Step 3: Verify**

```bash
cd game && npm run typecheck
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add game/src/lib
git commit -m "Describe a season, and invent one to look at."
```

---

## Task 7: The opal

**Files:**
- Create: `game/src/components/opal.tsx`

**Interfaces:**
- Consumes: `OpalState` from `@/lib/types`.
- Produces: `<Opal state={…} day={…} label={…} />` — presentational, no data
  fetching, no routing.

- [ ] **Step 1: Write the component**

Create `game/src/components/opal.tsx`:

```tsx
import type { OpalState } from "@/lib/types";

const ROMAN: Record<1 | 2 | 3, string> = { 1: "I", 2: "II", 3: "III" };

/** Spec §04. Each state is a different object, not a tint of the same one. */
const SURFACE: Record<OpalState, string> = {
  locked:
    "border border-line bg-[radial-gradient(circle_at_32%_28%,#2A2140,#100B1E_72%)] text-ash-dim saturate-0",
  armed:
    "border border-dashed border-hot bg-[radial-gradient(circle_at_32%_28%,#2E1F4C,#100B1E_72%)] text-bone",
  live: "border border-[#FF9FD1] bg-[radial-gradient(circle_at_30%_26%,#FF7ABE,#FF2D8F_42%,#7A1550_78%,#2A0A1D)] text-white opal-live",
  spent:
    "border border-line bg-[radial-gradient(circle_at_32%_28%,#241B36,#0C0816_72%)] text-ash-dim line-through",
  missed:
    "border border-line bg-[radial-gradient(circle_at_32%_28%,#241B36,#0C0816_72%)] text-ash-dim line-through opacity-60",
};

export function Opal({
  state,
  day,
  label,
}: {
  state: OpalState;
  day: 1 | 2 | 3;
  label: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3">
      <div
        className={`grid h-22 w-22 place-items-center rounded-full font-display text-xl font-bold tracking-widest ${SURFACE[state]}`}
        role="img"
        aria-label={`Day ${day}, ${label}, ${state}`}
      >
        {ROMAN[day]}
      </div>
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ash">
        {label}
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Add the live glow**

Append to `game/src/app/globals.css`:

```css
/* Halation is reserved for things that are genuinely happening — spec §02. */
.opal-live {
  animation: opal-breathe 3.4s ease-in-out infinite;
}

@keyframes opal-breathe {
  0%, 100% {
    box-shadow: 0 0 26px -4px rgb(255 45 143 / 0.6), 0 0 54px -12px rgb(139 69 255 / 0.5);
  }
  50% {
    box-shadow: 0 0 40px 0 rgb(255 45 143 / 0.9), 0 0 76px -6px rgb(139 69 255 / 0.7);
  }
}
```

- [ ] **Step 3: Verify**

```bash
cd game && npm run lint && npm run typecheck
```

Expected: exit 0. If `h-22`/`w-22` is not in your Tailwind scale, use
`h-[88px] w-[88px]` — the spec's opal is 88px.

- [ ] **Step 4: Commit**

```bash
git add game/src/components/opal.tsx game/src/app/globals.css
git commit -m "Draw the opal in each of its four states."
```

---

## Task 8: The hearts rail

**Files:**
- Create: `game/src/components/hearts-rail.tsx`

**Interfaces:**
- Consumes: nothing beyond props.
- Produces: `<HeartsRail remaining={2} total={3} />`.

Spec §12: a burned heart leaves an outline that stays on the board all season.
Nothing is hidden and nothing is restored — the scar is the memory. So the rail
always renders `total` hearts, `remaining` of them whole.

- [ ] **Step 1: Write the component**

Create `game/src/components/hearts-rail.tsx`:

```tsx
const PATH = "M31 53 L9 32 A13 13 0 0 1 31 15 A13 13 0 0 1 53 32 Z";

function Heart({ whole }: { whole: boolean }) {
  return (
    <svg viewBox="0 0 62 58" className="h-7 w-8" aria-hidden>
      <path
        d={PATH}
        fill={whole ? "#FF2D8F" : "none"}
        stroke={whole ? "#FF9FD1" : "#453473"}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeDasharray={whole ? undefined : "3 4"}
      />
    </svg>
  );
}

export function HeartsRail({
  remaining,
  total,
}: {
  remaining: number;
  total: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-ash">
        Hearts
      </span>
      <div
        className="flex items-center gap-1"
        role="img"
        aria-label={`${remaining} of ${total} hearts remaining`}
      >
        {Array.from({ length: total }, (_, i) => (
          <Heart key={i} whole={i < remaining} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

```bash
cd game && npm run lint && npm run typecheck
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add game/src/components/hearts-rail.tsx
git commit -m "Show the hearts, and the scar where one used to be."
```

---

## Task 9: The ladder page

**Files:**
- Create: `game/src/components/opal-ladder.tsx`, `game/src/app/play/page.tsx`

**Interfaces:**
- Consumes: `Opal`, `HeartsRail`, `DEMO_PLAYER`, `PlayerState`.
- Produces: the route `/play`.

- [ ] **Step 1: Write the ladder**

Create `game/src/components/opal-ladder.tsx`:

```tsx
import { Opal } from "@/components/opal";
import type { LadderDay } from "@/lib/types";

export function OpalLadder({ days }: { days: LadderDay[] }) {
  return (
    <div className="flex flex-wrap items-start justify-center gap-10 sm:gap-16">
      {days.map((d) => (
        <Opal key={d.day} state={d.state} day={d.day} label={d.tier} />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Write the page**

Create `game/src/app/play/page.tsx`:

```tsx
import { HeartsRail } from "@/components/hearts-rail";
import { OpalLadder } from "@/components/opal-ladder";
import { DEMO_PLAYER } from "@/lib/fixtures";

export default function PlayPage() {
  const player = DEMO_PLAYER;

  return (
    <main className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-14 px-6 py-16">
      <header className="flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="font-display text-3xl font-bold uppercase tracking-[0.15em]">
          {player.handle}
        </h1>
        <dl className="flex gap-8 font-mono text-[11px] uppercase tracking-[0.2em] text-ash">
          <div className="flex flex-col gap-1">
            <dt>Nerve</dt>
            <dd className="text-lg tabular-nums text-cold">{player.nerve}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt>Coins</dt>
            <dd className="text-lg tabular-nums text-bone">{player.coins}</dd>
          </div>
          <div className="flex flex-col gap-1">
            <dt>Rank</dt>
            <dd className="text-lg tabular-nums text-bone">
              {player.rank ?? "—"}
            </dd>
          </div>
        </dl>
      </header>

      <HeartsRail
        remaining={player.heartsRemaining}
        total={player.heartsTotal}
      />

      <OpalLadder days={player.days} />
    </main>
  );
}
```

- [ ] **Step 3: Verify in the browser**

```bash
cd game && npm run dev
```

Open `http://localhost:3003/play` and confirm: three opals, the first struck
through, the second lit and breathing, the third grey and desaturated. Two whole
hearts and one dashed outline. Nerve in cyan, everything else in bone.

Then resize to 375px wide and confirm nothing overflows horizontally.

- [ ] **Step 4: Verify the gate**

```bash
cd game && npm run lint && npm run typecheck && npm run build
```

Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add game/src/components/opal-ladder.tsx game/src/app/play/page.tsx
git commit -m "Put the ladder on a page, with the hearts beside it."
```

---

## Task 10: The cold open and the choice

**Files:**
- Create: `game/src/components/intro-sequence.tsx`,
  `game/src/components/role-picker.tsx`
- Modify: `game/src/app/page.tsx`

**Interfaces:**
- Produces: `/` — the intro, ending on CHOOSE, then the two panels. Picking
  "Player" routes to `/play`.

Spec §03: two panels, magenta and cyan, no third option. The video asset does
not exist yet — this task ships the sequence with a typographic stand-in so the
timing and the beat can be reviewed, and Level 8 drops the real film in behind
the same component.

- [ ] **Step 1: Write the intro**

Create `game/src/components/intro-sequence.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

/**
 * The film is not shot yet. This holds its place and its timing: a beat of
 * black, the word, then the choice. Swap the <video> in behind it later without
 * touching what comes after.
 */
export function IntroSequence({ onDone }: { onDone: () => void }) {
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onDone();
      return;
    }
    const appear = setTimeout(() => setShown(true), 600);
    const finish = setTimeout(onDone, 2600);
    return () => {
      clearTimeout(appear);
      clearTimeout(finish);
    };
  }, [onDone]);

  return (
    <div className="grid min-h-dvh place-items-center">
      <h1
        className={`font-display text-5xl font-bold uppercase tracking-[0.4em] transition-opacity duration-700 sm:text-7xl ${
          shown ? "opacity-100" : "opacity-0"
        }`}
        style={{
          textShadow:
            "-0.035em 0 0 rgb(255 45 143 / 0.85), 0.035em 0 0 rgb(34 228 255 / 0.75)",
        }}
      >
        Choose
      </h1>
    </div>
  );
}
```

- [ ] **Step 2: Write the picker**

Create `game/src/components/role-picker.tsx`:

```tsx
import Link from "next/link";

export function RolePicker() {
  return (
    <div className="grid min-h-dvh grid-cols-1 md:grid-cols-2">
      <Link
        href="/play"
        className="group flex flex-col justify-end gap-3 border-b border-line p-10 transition-colors hover:bg-hot/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-hot md:border-b-0 md:border-r"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-hot">
          You do it
        </span>
        <span className="font-display text-4xl font-bold uppercase tracking-[0.15em] sm:text-6xl">
          Player
        </span>
        <span className="max-w-xs text-sm text-ash">
          Three tasks. A camera. A clock that does not stop.
        </span>
      </Link>

      <Link
        href="/watch"
        className="group flex flex-col justify-end gap-3 p-10 transition-colors hover:bg-cold/5 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-cold"
      >
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-cold">
          You decide
        </span>
        <span className="font-display text-4xl font-bold uppercase tracking-[0.15em] sm:text-6xl">
          Watcher
        </span>
        <span className="max-w-xs text-sm text-ash">
          Watch them try. Say whether they did it.
        </span>
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Wire the page**

Replace `game/src/app/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { IntroSequence } from "@/components/intro-sequence";
import { RolePicker } from "@/components/role-picker";

export default function Home() {
  const [introDone, setIntroDone] = useState(false);

  return introDone ? (
    <RolePicker />
  ) : (
    <IntroSequence onDone={() => setIntroDone(true)} />
  );
}
```

- [ ] **Step 4: Verify in the browser**

`npm run dev`, open `http://localhost:3003`. Confirm: black, then CHOOSE fades
in with magenta/cyan fringing, then the two panels. Player routes to `/play`.
Tab through both panels and confirm a visible focus ring.

Enable "Reduce motion" and reload — the intro should be skipped entirely rather
than animating.

`/watch` will 404. That is expected; it arrives in Level 6.

- [ ] **Step 5: Verify the gate**

```bash
cd game && npm run lint && npm run typecheck && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add game/src/components/intro-sequence.tsx game/src/components/role-picker.tsx game/src/app/page.tsx
git commit -m "Open cold, land on one word, offer two doors."
```

---

## Task 11: PLAY on the shop

**Files:**
- Modify: `frontend/src/app/page.tsx`

**Interfaces:**
- Produces: a band on the shop homepage linking to the game origin.

**This is the one task in this level that touches shop code.** It is a link on
`frontend/`, which by the branch rules belongs on `main`. Do it as a separate
commit here, then cherry-pick it to `main` and merge `main` into `game` — do not
let it live only on the `game` branch, or stiff.ge will never show the button.

- [ ] **Step 1: Add the band**

In `frontend/src/app/page.tsx`, following the existing section composition and
using the file's `solidBtn` constant, insert a section between two existing
ones:

```tsx
<section className="flex flex-col items-center gap-6 py-24 text-center">
  <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-muted">
    Three tasks. Fifteen minutes.
  </p>
  <h2 className="font-display text-4xl uppercase sm:text-6xl">Opal</h2>
  <a
    className={solidBtn}
    href={process.env.NEXT_PUBLIC_GAME_URL ?? "https://game.stiff.ge"}
  >
    Play
  </a>
</section>
```

Use a plain `<a>`, not `next/link` — this is a cross-origin navigation and
`Link`'s prefetching does nothing useful for it.

- [ ] **Step 2: Add the env var**

Append to `frontend/.env.local`:

```
NEXT_PUBLIC_GAME_URL=http://localhost:3003
```

- [ ] **Step 3: Verify**

```bash
cd frontend && npm run lint && npm run typecheck && npm run build
```

Then `npm run dev`, scroll the homepage, confirm the band renders in the shop's
monochrome (not the game's palette — the shop keeps its own identity) and the
button opens the game.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/page.tsx
git commit -m "Put the door to the game on the shop's front page."
```

---

## Task 12: Deploy

**Files:** none — Vercel dashboard and DNS.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin game
```

Confirm CI goes green, including the new `game` job.

- [ ] **Step 2: Create the Vercel project**

New project from the same repo, then set:
- **Root Directory:** `game`
- **Production Branch:** `game`
- **Domain:** `game.stiff.ge`

Follow whatever the `ops/README.md` and `admin`'s project already record — the
host-to-project mapping was written down in commit `ae8d3c31` for exactly this
reason. Add the game row there.

- [ ] **Step 3: Set the environment**

On the Vercel project: `NEXT_PUBLIC_API_URL` pointing at the backend.

On the backend (Render): `GAME_FRONTEND_URL=https://game.stiff.ge`, and
`COOKIE_DOMAIN=.stiff.ge` — the latter is what lets a session created on
stiff.ge be visible on the game origin. `auth.controller.ts` documents the
tradeoff and `cookie-domain.spec.ts` pins the behaviour; read both before
setting it.

- [ ] **Step 4: Verify the deploy**

```bash
curl -sI https://game.stiff.ge/ | grep -i permissions-policy
curl -s https://<backend-host>/api/game/health
```

Expected: the header allows `camera=(self)`, and health returns
`{"status":"ok","level":1}`.

Then open `https://game.stiff.ge` on a phone and walk intro → CHOOSE → Player →
ladder.

- [ ] **Step 5: Record the deploy**

Add the game project to `ops/README.md` alongside the existing host mappings and
commit.

```bash
git add ops/README.md
git commit -m "Write down which project serves the game."
git push
```

---

## Level 1 gate

Before starting Level 2, all of these must be true:

- [ ] `game.stiff.ge` serves the shell over HTTPS
- [ ] Someone who has never seen it walks PLAY → intro → CHOOSE → Player →
      ladder without being told how
- [ ] The palette, type and texture match spec §02 when compared side by side
- [ ] `prefers-reduced-motion` disables every animation
- [ ] Nothing scrolls horizontally at 375px
- [ ] `GET /api/game/health` responds from the deployed backend
- [ ] The camera policy is open on the game origin and **still closed on the
      shop**
- [ ] CI is green on the `game` branch
- [ ] Three people have looked at it and said what they thought

---

## Self-review notes

**Spec coverage.** This level implements §02 (tokens, type, texture), §03 (entry
flow, both panels), §04 (the ladder and its four opal states), §12 (the hearts
rail and the ash scar), and the §20 repo requirements — branch, app, CORS,
cookie domain, camera header. It deliberately implements none of §05–§11 or
§13–§19; those are Levels 2 onward.

**Known gaps, all intentional:**
- `/watch` 404s until Level 6.
- The intro film is a typographic stand-in. The component boundary is drawn so
  the real video drops in without touching the picker.
- `fixtures.ts` is a lie by design and is deleted in Level 2.
- No accessibility audit yet. Run `accessibility-scan` at the end of Level 5,
  when there are real interactive flows to audit rather than three links.
