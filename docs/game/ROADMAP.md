# Opal — Build Roadmap

**Spec:** the Opal design document (artifact). Read it before executing any level.

Nine levels. Each one produces something that works on its own, and each has a
**gate** — a condition that must be true before the next level starts. The gates
matter more than the estimates: skipping one is how you end up with a live video
pipeline verifying tasks nobody enjoys.

**Level 5 is the first shippable season.** Everything before it builds toward a
complete, playable, non-live game. Levels 6 and 7 add the expensive half.

---

## Level 0 — Prove the premise

**No code. About a week, mostly other people's time.**

The whole design rests on the tasks being fun. Nothing else is worth building
until that is tested, and testing it costs an afternoon.

- [ ] Write **20 real tasks** — not templates. Actual dares, each with its
      machine-readable criteria and a tier. Cover all three days: photo-provable
      qualifiers, live tier-2 social dares, tier-3 finals.
- [ ] Run the exclusion list (spec §11 part II) over all 20. Any that fail get
      rewritten or cut — this is also the first real test of the exclusion list.
- [ ] Show them to **10 people in the target audience**. Ask one question: *would
      you actually do this?* Count the yes answers per task.
- [ ] Answer the four blocking decisions (spec §22): redemption rate, who sells
      sponsorship, death permanent or seasonal, blocklist scope.
- [ ] Open the legal conversation. It has a long lead time and gates Level 8, not
      Level 1 — start it now, don't wait for it.

**Gate:** at least 12 of the 20 tasks get a majority "yes, I'd do that". If
fewer, the problem is the task design and no amount of engineering fixes it.

---

## Level 1 — The shell

**~2 weeks. Plan: `docs/game/plans/2026-08-30-level-1-shell.md`**

The `game` branch, the `game/` Next app, the visual identity as real tokens, and
a walkable front door: intro → CHOOSE → role → a static opal ladder with hearts
and a Nerve rail. No camera, no coins, no backend state.

**Gate:** `game.stiff.ge` is live, someone who has never seen it can walk from
the shop's PLAY button to the ladder, and the whole thing looks like §02.

---

## Level 2 — Identity and enrolment

**~1 week.**

Seasons, enrolments, roles. Phone verification for players (the blocklist's
primary key — see spec §12), 18+ attestation, hearts and Nerve stored per
enrolment. The shop session crosses to the game origin.

- Backend: `game_seasons`, `game_enrolments`, enrolment endpoints
- Player enrols with a verified phone; watcher enrols without
- Role is per-season and cannot be both
- Hearts render from real data on the ladder and on the shop profile

**Gate:** a real person signs in on stiff.ge, lands on game.stiff.ge already
authenticated, enrols as a player, and sees three hearts that came from the
database.

---

## Level 3 — The loop, without video

**~3 weeks.**

The heart of the game. Templates, task instances, assignment with the uniqueness
constraint, decline-and-recycle, the server-owned clock, accept/decline, photo
proof upload, and the ledger.

- `game_task_templates`, `game_tasks`, `game_assignments`, `game_attempts`
- `game_ledger` — append-only, with `currency` and `source` from day one
- Escrow: hold at accept, release/burn/refund at settle
- Hearts burn when a penalty exceeds the earned-coin balance
- Proof is a photo upload; the verdict is a staff decision (Level 4 gives them
  the screen — until then it's a database update)

**Recover, don't rewrite:** `git show d9e8f928 -- backend/src/game/economy.service.ts`
has the ledger service and its tests from the removed rhythm game. It lacks
escrow, `source` and the second currency. Those are the three additions.

**Gate:** a full three-day season can be played end to end by five people, with
coins and hearts moving correctly, verified by reading the ledger.

---

## Level 4 — The control room

**~2 weeks.**

The `game-admin/` app. Without it Level 3's staff verdicts are `psql` commands,
so this is not a nicety — it's how the game is operated at all.

- `game-admin/` Next app, own Vercel project, port 3004
- `backend/src/game-admin/` — sign-in, IP allowlist, audit trail only
- Fourth token audience `stiff-game`, new cases in `jwt-auth.guard.spec.ts`
- Screens: task studio, review queue, season control, players
- The live wall waits for Level 6

**Gate:** a staff member who has never used `psql` can run a whole season —
publish templates, resolve verdicts, arm opals, stop everything.

---

## Level 5 — Leaderboard, prizes and economy · **first shippable season**

**~1.5 weeks.**

- Nerve board with the 5,000 → 1,000 → 100 cut lines
- Ties broken by completion timestamp, published in advance
- Prize tiers including the sponsor placements (spec §07)
- Coin bundles through `PAYMENTS_TEST_MODE`, then live TBC/BOG credentials
- Season pass
- Score clawback via compensating ledger entries when a verdict is overturned

**Gate:** this is a complete game. If you stopped here you could run a real
season for 300 people. **Do not start Level 6 until someone has actually played
Level 5 and enjoyed it.**

---

## Level 6 — Live

**~4 weeks.**

- Provider integration — test Cloudflare *and* Bunny.net on Georgian mobile
  networks before committing (spec §19)
- WHIP publish from the browser, canvas composite carrying the watermark
- Two-track split: broadcast to the provider, proof frames direct to R2 via
  presigned URLs — never through the Nest app
- Watcher index, stream page, socket room, debounced vote tally
- Report button, kill switch, and the panel's live wall
- Proof frames record from the first day even though nothing reads them yet

**Gate:** 50 concurrent streams held for a full 20-minute window without a drop,
on real phones on real Georgian networks.

---

## Level 7 — The AI

**~5 weeks.**

**The Charter comes first**, before any model call ships, because every later
call loads it.

- `backend/src/game/charter/` — one file per part, build-time hash
- Adversarial corpus in CI: signs in frames, hostile display names, malicious
  report text. All must fail closed. Runs on every Charter change.
- Task generation from approved templates, batch, ahead of the round
- Tier A / B / C cascade with frame-diffing and prompt caching
- Liveness challenges, decision bands, report triage with autonomous suspension
- The panel's "what the AI thought" screen — build it *with* the cascade, not
  after, because shadow mode is unreadable without it

**Gate:** shadow mode has run for a full season's worth of attempts and the
model's verdicts agree with staff verdicts often enough to trust. **No coin,
heart or Nerve point moves on a model's say-so before that.**

---

## Level 8 — Season one

**Small, cheap, and filmed.**

~300–500 invited players, mostly existing customers and their friends. Live bank
credentials, a real mint budget, almost no sponsorship — sponsors buy proven
audience and there isn't one yet.

**Budget for a camera operator at the final even though nothing is sponsored.
The tape is what sells season two.**

Six numbers to watch: cost per verified attempt, review queue depth, decline rate
against pool supply, co-voting density, how many reach day three with hearts
left, and the only one that really matters — **new shop customers acquired.**

---

## Sequencing notes

**The gates are the plan.** Estimates will be wrong; the gates won't be.

**Levels 1–5 need no vendor accounts** beyond what you already have. No
streaming provider, no AI spend, no R2. That is deliberate — it means the
decisions in spec §19 can stay open while real progress happens.

**Two blockers to clear early, both in spec §20:**
- `frontend/next.config.ts:71` disables the camera globally. The game app ships
  its own header; leave the shop's alone. Needed by Level 6, but set it up in
  Level 1 so it is never a surprise.
- The removed rhythm game's migrations (`1787220000000`–`1787240000000`) were
  deleted without a drop migration. **Check the live Supabase schema before
  Level 3 names a single table.** Highest timestamp on `main` is
  `1787210000000`.

**Branch discipline:** everything above lives on the `game` branch, which is a
superset of `main`. Shop work is never authored there — it arrives by
`git merge main`. `backend/src/game/` ships on every branch, like
`backend/src/staff/` and `backend/src/admin/` already do.
