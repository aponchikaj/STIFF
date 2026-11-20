# STIFF Game — Version 2 Planning

Status: **draft for decision** · Written 2026-11-20 · Owner: STIFF
Companion documents:
- [`WHAT-WE-NEED.md`](WHAT-WE-NEED.md): the licences, banks, tax and legal checklist
- [`reports/Real money game Georgia.md`](reports/Real%20money%20game%20Georgia.md): the full research report with sources
- `research_notes/Real money game Georgia/`: raw research notes

---

## 0. The one-paragraph version

Version 1 is a dare game played for **Nerve** (score), **hearts** (lives) and
**coins/opals** (an in-game currency, partly bought with lari). Version 2
keeps that skeleton and adds what the film *Nerve* runs on: **every approved
task pays real money in lari**. An easy dare pays **50 tetri**, a medium one
**1 lari**, and hard and finale dares pay more. The admin panel sets every
amount. The money accumulates in a **wallet** on the player's account and can
be **withdrawn to a Georgian bank card or IBAN**. Doing this safely needs
three things V1 never needed:

1. a money ledger built like a bank's, not like a score;
2. a legal structure that keeps the game out of the gambling and e-money
   regimes, or licenses it inside them (see `WHAT-WE-NEED.md`);
3. a payout partner (a bank or a licensed payment provider) that actually
   moves the money.

We also redesign both front ends: the **game website** (`game/`) and the
**game admin panel** (`game-admin/`).

---

## 1. Where V1 stands (from reading the code)

| Area | What exists today | Where |
|---|---|---|
| Seasons | 3-day seasons; `tier = day` (1, 2, 3); `open → running → closed` | `backend/src/game/seasons.service.ts`, `media-rules.ts` |
| Roles | `player` / `watcher`, chosen once per season, 16+ gate | `enrolments.service.ts`, `age-gate.ts` |
| Tasks | AI creator + regex screen + AI reviewer loop, then human approval; 25 blocked categories; proof = photo/video | `ai/task-pipeline.service.ts`, `ai/blocklist.ts` |
| Clock | Server draws a task; accept starts `clockMinutes`; decline or expiry burns a heart | `assignments.service.ts` |
| Hand-in | ticket → PUT to storage → confirm | `attempts.service.ts`, `media-storage.service.ts` |
| Judging | AI cheat detector; 3-hour watcher vote; AI vote resolver; human review queue | `ai/cheat-detector.service.ts`, `voting.service.ts`, `verdicts` |
| Economy | `rewardNerve` (5–100), `rewardCoins` (1–20), `penaltyCoins` (1–3) per template; append-only `game_coin_ledger` and `game_score_ledger` | `economy.service.ts` |
| Paid currency | **Opals sold for lari** (`card_tbc`, `card_bog`), credited to the same balance as earned coins, which outlives the season | `opals.service.ts`, `opal-carry.service.ts` |
| Coin shop | Admin-listed items bought with coins | `shop.service.ts` |
| Discipline | Daily minimum of 4 tasks; zero-balance and out-of-hearts demotion; cheater zeroing | `discipline.service.ts` |
| Archived | Clans (2-person) and clan wars, kept but switched off | `rules.ts` `CLANS_ARCHIVED`, `CLAN_WARS_ARCHIVED` |
| Game site | Redrawn as a "phosphor tube": electric blue `#43DFFF` / `#A8F8FF` on black, CC Pixel Arcade (Silkscreen stand-in), `.phosphor` display type, `<CabinetMenu>`. Routes: `/play /feed /board /vote /shop /me /u /join /login /system` | `game/src/app/` (on the `game` branch) |
| Game admin | 13 screens: Overview, Seasons, Review, Hand-ins, Votes, Clocks, Players, Board, Tasks, Shop, Opals, Reports | `game-admin/` (on the `game-admin` branch) |

**What V1 already does well and V2 must keep:** the append-only ledgers, the
server-side clock, one-time settlement transitions (`pending → paid` happens
once), AI-checked tasks with a fail-closed reviewer, and the hard blocklist.
The money version is built on these properties; it does not replace them.

**The one V1 decision V2 must reverse:** *bought opals and earned coins are
the same balance.* That is harmless while coins buy hoodies. Once a task pays
cash, anything the player **paid for** that improves their chance of
**earning cash** is "consideration + prize". That is the textbook shape of a
regulated prize game or gambling. See §3.4.

---

## 2. What we take from *Nerve*, and what we invert

(The research report covers the film in full. This is the design takeaway.)

| In the film | V2 decision |
|---|---|
| Watchers pay to watch; players earn per dare; earnings are visible to everyone | **Copy:** a live feed and a public "earned this season" figure on every profile. **Invert:** watching is free. Watchers never pay into the money pool. |
| Dares escalate in value and danger | **Copy the value escalation only.** Price rises by tier, clock and difficulty, never by danger. The 25-category blocklist stays absolute, and a higher price never unlocks a blocked category. |
| The crowd decides the dares | **Invert:** the crowd votes on *whether a hand-in is genuine*, never on *what dare comes next*. Tasks come only from the reviewed pool. |
| You can't quit; snitches lose everything | **Invert:** quitting is always one tap. Withdrawn money is the player's, and nothing that happens later takes it back. Reporting a problem is protected and rewarded. |
| The game harvests players' data to coerce them | **Invert:** we collect the minimum, KYC only at withdrawal, a published privacy policy, and deletion on request. |
| Anonymous operators | **Invert:** STIFF is named on every screen, with a legal entity, terms, a support contact and a complaints route. |
| The finale is a life-or-death stage | **Replace:** the finale is a sponsored, supervised, filmed STIFF event with a fixed prize. |

---

## 3. The money system (the core of V2)

### 3.1 Units and principles

- **Every amount is stored in integer tetri** (1 GEL = 100 tetri), with no
  floats. The opal code already does this (`priceCents`, "Tetri. 1 GEL = 100").
  Rename the field to `amountTetri` in new tables so nobody reads "cents"
  as USD.
- **Displayed as lari**: `0.50 ₾`, `1.00 ₾`, `12.40 ₾`. Georgian: `0.50 ლ`.
- **Money and coins never mix.** Three separate balances:
  - **Lari wallet** (real money, withdrawable): earned only by an approved task.
  - **Coins** (in-game, never withdrawable): earned from votes, streaks, penalties and the coin shop, as today.
  - **Opals** (bought for lari, never withdrawable, never convertible to lari, and never able to raise a lari payout).
- **Money is only ever added by an approved task or by an admin
  correction with a reason.** It is never taken by a game mechanic. Penalties
  stay in hearts and coins. A real-money fine on a player is a legal and PR
  problem we do not need.
- **Earned is not the same as withdrawable.** Money passes through states
  (§3.3) so a cheat caught after approval can still be reversed before it
  leaves the building.

### 3.2 The reward table (admin-controlled)

A new **Reward table** screen in the game admin. Defaults, all editable:

| Difficulty | Example | Default pay | Admin range |
|---|---|---|---|
| **Easy** | Day-1 tier, short clock, one person | **0.50 ₾** (50 tetri) | 0.10 – 2.00 ₾ |
| **Medium** | Day-2 tier, needs a stranger's cooperation or a performance | **1.00 ₾** | 0.50 – 5.00 ₾ |
| **Hard** | Day-3 tier, long clock, public performance on video | **2.00 – 5.00 ₾** | 1.00 – 20.00 ₾ |
| **Special / sponsored** | A brand-funded dare (wear STIFF piece X at landmark Y) | **set per task** | 1.00 – 100.00 ₾ |
| **Finale** | The season finale event | **prize, set per season** | per season budget |

How a task's price is decided, in order:

1. The task template carries `difficulty` (`easy | medium | hard | special |
   finale`) and an optional `rewardTetriOverride`.
2. If there is no override, the price is the **reward table** value for that difficulty.
3. Optional **multipliers** the admin can switch on per season: a streak
   bonus (for example +10% after 5 approved tasks in a row), a team task (each
   member gets the full price), or a "happy hour" window (for example ×2 from
   20:00 to 22:00). Every multiplier has a cap.
4. The price is **frozen onto the assignment when the task is drawn**, in the same
   way `clockMinutes` is copied today, so an admin edit never changes a
   price a player has already accepted.
5. The player sees the price **on the card before accepting**.

The AI task creator gets the difficulty rubric in the Charter. It proposes a
difficulty, and a person confirms it with the price at approval. **The model never
sets a price.**

### 3.3 Money states and the ledger

New table `game_wallet_ledger` (append-only, like `game_coin_ledger`), plus
`game_wallets` (one per user, *not* per season, because money outlives seasons).

| State | Meaning | How it moves |
|---|---|---|
| `pending` | Hand-in confirmed, not yet judged | → `held` on approval, → void on rejection |
| `held` | Approved, inside the **clawback window** (default 72 h, admin-set) | → `available` when the window passes with no cheat flag, report or appeal |
| `available` | Withdrawable | → `withdrawing` on a withdrawal request |
| `withdrawing` | Sent to the payout provider | → `paid_out` on the provider's success callback, → `available` on failure |
| `paid_out` | Left STIFF | final |
| `reversed` | Clawed back (cheat proven inside the window) | final, with a reason |

Rules the code must enforce (each one gets a test):

- **Double-entry.** Every movement is two rows: the player's wallet and a
  STIFF account (`season_budget`, `sponsor_pool`, `payout_clearing`,
  `adjustments`). The sum is always zero. Reconciliation is one query.
- **Idempotent settlement.** Approval writes the `pending → held` row exactly
  once, using the same conditional-UPDATE pattern the vote resolver uses.
  A replayed provider callback cannot pay twice, as with opals today.
- **The balance on `game_wallets` is a cache**, checked nightly against the sum
  of the ledger. A mismatch pages an admin and freezes withdrawals.
- **Nothing edits or deletes a ledger row.** A correction is a new row.

### 3.4 Budget and limits (also admin-controlled)

- **Season budget.** The admin sets, for example, "this season pays out at most
  2,000 ₾". The budget is debited when a price is frozen at draw time, not at
  approval, so we never promise money we have not ring-fenced. When the budget
  runs out, the draw screen says the money pool is spent and tasks pay coins only.
  The budget is debited at **gross** (price ÷ 0.8), so the 20% tax STIFF owes
  is ring-fenced with the reward.
- **Sponsor pools.** A sponsor's money is its own account, tied to the sponsor's
  tasks. That way we can report to the sponsor exactly what their money paid for.
- **Per-player caps.** Earnings caps per day, per season and per calendar month,
  all admin-set. Caps keep a single account from draining the pool and keep us
  under KYC and tax thresholds (see `WHAT-WE-NEED.md`).
- **Velocity checks.** If, for example, more than N approvals in M minutes, or
  more than X ₾ in a day, hold everything for a person to review.
- **Opals in a money season.** Opals must not buy anything that raises cash
  earnings: no extra hearts, no extra time, no rerolls, no "skip". Options for
  the board, in order of legal safety:
  1. **Turn opal sales off** in seasons that pay lari (simplest and safest).
  2. Keep opals for **cosmetics only** (frames, badges, profile effects).
  3. Keep opals as they are only if a lawyer signs off on the prize-game analysis.

  Current behaviour (bought opals spent on hearts or shop items in the same
  balance as earned coins) is **not acceptable** in a money season.

### 3.5 Withdrawals

- **Minimum withdrawal**, admin-set (default **5.00 ₾**), so we are not paying
  transfer fees on 50 tetri.
- **First withdrawal triggers verification**: legal name, personal ID number, date
  of birth, an ID photo and a selfie, done through the payout provider's KYC
  flow if it has one, so we never store passports ourselves. The **name on
  the card or IBAN must match** the verified name.
- **18+ to withdraw**, and very likely 18+ to play for money at all. Under-18
  accounts keep playing for coins and opals only. (This is the recommendation
  pending legal confirmation; see `WHAT-WE-NEED.md` §Minors.)
- **Payout methods**, by priority (the provider decision and docs links are in `WHAT-WE-NEED.md` §7):
  1. **Launch: weekly bulk IBAN transfers** from STIFF's business account, using the
     **Bank of Georgia Business Online API** (`POST api/documents/bulk/domestic`,
     pays IBANs at any Georgian bank, idempotent via `UniqueId`) or the **TBC BIS
     Transfers API**. The backend builds the batch, and a STIFF signatory signs it
     inside the bank. That gives four-eyes control on money with nothing to build.
  2. **Phase 2: card payouts through Flitt** (`/api/p2pcredit`). This needs a card
     token from an earlier card payment by that user and a STIFF account at TBC.
  3. Manual fallback: the same batch exported as a bank import file.
- **Admin payout queue**: every request is visible with a risk score. Auto-approve
  below a threshold; a person approves above it.
- **Tax**: 20% personal income tax, withheld by STIFF at source (Tax Code
  Art. 154). Recommended: **STIFF pays it on top**, so "0.50 ₾" means 0.50 ₾
  reaches the player. Gross = net ÷ 0.8, so a 0.50 ₾ task costs STIFF
  0.625 ₾. **Every season budget is 1.25 times the announced prize money.**
  Tax is computed **per reward** (ledger row), not per withdrawal, and reported
  monthly by personal ID number. That is one more reason KYC must capture it.
  Accountant to confirm.

### 3.6 Watchers and money

Watchers keep earning **coins, not lari**, for correct votes. Paying cash for
correctly predicting an outcome looks like betting even without a stake, and it
invites watchers to collude with players. Watchers who want money can become players next
season. A possible later addition (V2.1, legal sign-off needed): a small monthly
**top-watcher prize** from the sponsor pool, awarded on accuracy, not on luck.

### 3.7 What happens to existing V1 numbers

- **Nerve** stays as the score and the board's ranking. It now also reflects
  difficulty, so the board and the money tell the same story.
- **Hearts** stay. Losing the last heart ends the *season* for that player. The
  wallet is untouched, because already-earned money is never forfeited.
- **Daily minimum of 4**: recommend **removing** it in money seasons, or making
  it opt-in. Forcing four paid dares a day is a pressure mechanic that reads
  badly next to real money and minors.
- **Cheater verdict**: a confident cheat verdict reverses `held` and `pending`
  money only. Money already `available` is frozen (not taken) pending a person's
  review and the player's right to appeal. Money already `paid_out` is a
  civil claim, never an automatic deduction.

---

## 4. New and changed features (beyond money)

| # | Feature | Why | Size |
|---|---|---|---|
| F1 | **Wallet screen** (balance by state, history, withdraw) | The heart of V2 | M |
| F2 | **Price on every task card, plus a live "₾ paid out this season" ticker** | The *Nerve* pull: visible money | S |
| F3 | **Verification flow** (KYC at first withdrawal) | Legal and fraud | M |
| F4 | **Appeals**: a player contests a rejection or a reversal, and a person decides within 48 h | Fairness once money is at stake | M |
| F5 | **Sponsored dares** (brand pays, task carries the sponsor's mark and pool) | Funds the prize money | M |
| F6 | **Live finale** (a ticketed or streamed STIFF event, fixed prize) | Season climax, marketing | L |
| F7 | **Safety centre** (one-tap quit, block, report, a "this dare feels unsafe" button that voids the task without costing a heart, help-line links) | The *Nerve* inversion, and a legal shield | S |
| F8 | **Responsible-play limits** (self-set daily time and earnings limits, cool-off) | Duty of care, especially for 18–21 | S |
| F9 | **Georgian and English UI** | Domestic consumer law expects Georgian | M |
| F10 | **Notifications** (task priced, approved, money available, payout sent) | Trust in the money flow | S |
| F11 | **Clans return as "Duos"** (unarchive, team tasks pay each member) | Social growth loop | M |
| F12 | **Referral reward in coins, not lari** | Growth without a cash pyramid | S |

---

## 5. Redesign: the game website (`game/`)

### 5.1 Direction

The current site is a phosphor tube showing an arcade GAME OVER screen: glow
`#43DFFF`, core `#A8F8FF`, white-hot `#E4FDFF` on pure black, "nothing without
blur", CC Pixel Arcade type (Silkscreen until the licence lands), `.phosphor`
scanline display type, `<CabinetMenu>` as the one selection device, and 44
recoloured pixel icons. **Keep the DNA, change the job.** Today it reads as an
arcade cabinet. V2 has to feel like *a live show where money moves*,
without borrowing the film's look (no Nerve logo, colours or UI quotes; the
look must be STIFF's own).

Principles:

1. **Money is the loudest thing on screen.** One new colour role: a **money
   green or amber** glow, used *only* for lari, so a player learns that this
   colour means real money. Amber is already the "currency" semantic, so lari
   needs a third hue (a phosphor green fits the tube). Coins keep amber, and
   opals keep their own mark. Three currencies must never look alike.
2. **Live by default.** The home screen is the feed: hand-ins arriving,
   prices, a ticker of lari paid out, players online and the season clock.
3. **The phone is the console.** Thumb-zone primary actions, a one-hand
   accept/decline, a full-screen countdown while a clock runs, haptics on the
   last 60 seconds.
4. **Pixel for HUD, human for reading.** Keep pixel type for labels, prices and
   clocks. Terms, safety copy, KYC and wallet history use the body face at
   readable sizes, because nobody signs legal text set in Press Start 2P.
5. **Trust surfaces.** The legal entity, terms, privacy policy, support and
   payout status are always one tap away. The website must look like a business
   that pays, not like an anonymous app.
6. **Motion with a reason.** Escalation in price pulses, an approval bursts
   (confetti is already installed), the clock tightens. Everything respects
   `prefers-reduced-motion`, as now.

### 5.2 Screen list

| Route | Screen | Notes |
|---|---|---|
| `/` | **Live**: feed, payout ticker, season clock, "join" call to action signed out | Replaces the placeholder |
| `/join` | **Sign-up**: side, handle, date of birth; a money explainer; 18+ check for money mode | Plain-language "how you get paid" |
| `/play` | **The console**: draw, see the price, accept, the clock, hand-in with a progress bar | The most-used screen; design it first |
| `/play/result/:id` | Approved, pending or rejected, with the money state and an appeal button | New |
| `/wallet` | **Wallet**: available, held, pending, history, withdraw | New |
| `/wallet/withdraw` | Amount, method, tax note, confirm | New |
| `/wallet/verify` | KYC handoff to the provider | New |
| `/vote` | Watcher voting, swipe yes/no, coins earned | Restyle |
| `/feed`, `/feed/:id` | Published hand-ins, reactions, comments | Restyle |
| `/board` | Nerve ranking plus "₾ earned" column | Restyle |
| `/shop` | Coin shop and opal cosmetics | Restyle; no pay-to-earn |
| `/me` | Profile, limits, safety, reports | Add limits and safety |
| `/safety` | Rules, blocklist in plain words, help lines, how to quit | New, public |
| `/legal/*` | Terms, privacy, prize rules, payout policy (ka + en) | New, public |

### 5.3 Design deliverables

1. A mood board and three directions, pressure-tested against the existing token
   set (`globals.css`).
2. Design tokens v2: add the money colour and glow, a body type scale for long
   text, light-on-dark contrast checks (WCAG AA for body text, even inside the CRT
   look).
3. A component kit: price tag, money chip (three currencies), wallet row, state
   pill (`pending/held/available/paid`), countdown v2, task card v2, KYC
   stepper.
4. High-fidelity designs: `/play` → `/wallet` → `/` → the rest.
5. Prototype test with 5 to 8 players before building.
6. Licence CC Pixel Arcade (Comicraft; still missing), or settle on Silkscreen.

---

## 6. Redesign: the game admin panel (`game-admin/`)

### 6.1 Direction

The panel's current system (warm-neutral page, white cards, semantic colour for
state only, Archivo / Archivo Black, the asterisk) is the right base for a tool
someone uses for hours. V2 adds a **finance surface**, which changes who uses the panel:
moderators *and* someone who signs off on money. So the redesign is mostly
**information architecture and workflow**, plus a visual refresh.

Principles:

1. **Money screens look different from game screens.** A distinct header band and
   tabular numerals. Every money action shows *who, how much, from which pool* and
   asks for a reason.
2. **Four-eyes on money.** A payout above a threshold, any manual credit, and any
   change to the reward table or budget need a second admin's approval. Both are
   recorded in `admin_audit_logs` (already exists).
3. **Queues first.** The overview shows what is waiting on a person, ranked:
   reviews, appeals, KYC, payouts, reports. Each comes with its SLA timer.
4. **Keyboard-driven review.** `A` approve, `R` reject, `J/K` next/previous,
   price confirm on approve. Review is where admin hours go.
5. **Read-only by default.** Destructive or financial actions sit behind an
   explicit "edit" mode.

### 6.2 New information architecture

```
Overview            what needs a person now, live season stats, today's payout total
Queues
  Review            hand-ins (existing), now with price confirm
  Appeals           new
  Verification      new: KYC results from the provider, mismatches
  Payouts           new: withdrawal requests, risk score, approve/hold/reject
  Reports           existing
The season
  Seasons           existing, plus budget, multipliers, money mode on/off
  Live clocks       existing
  Hand-ins          existing
  Votes             existing
  Players           existing, plus wallet, KYC status, limits, freeze
  Board             existing
Money               new section
  Reward table      difficulty → price, ranges, multipliers
  Budgets & pools   season budget, sponsor pools, burn-down chart
  Ledger            every money movement, filterable, export CSV
  Reconciliation    ledger vs wallet cache vs provider statement
  Tax report        monthly withholding export for the accountant / rs.ge
Setup
  Task pool         existing, plus difficulty and price at approval
  Sponsors          new: sponsor, pool, their tasks, a report to send them
  Coin shop         existing
  Opals             existing, plus "money season: sales off / cosmetics only"
Settings
  Admins & roles    moderator vs finance vs owner
  Limits & risk     caps, velocity rules, clawback window, minimum withdrawal
```

### 6.3 Roles inside the panel

| Role | Can |
|---|---|
| **Moderator** | Review, votes, reports, appeals (up to a price cap), players (not money) |
| **Finance** | Payouts, ledger, reconciliation, tax export, budgets; cannot review tasks |
| **Owner** | Everything, including the reward table, roles and limits |

Today every admin is `role=admin`. V2 needs **sub-roles** on top of the same
`/api/admin/auth/login`. This is shop-backend work and belongs on `main`.

---

## 7. Backend work (on `main`, per the repo's branch rules)

All of this is `backend/src/game/`, so per `CLAUDE.md` it is authored on
**`main`** and merged into `game` and `game-admin`.

1. **Migrations** (shared Supabase DB, additive only, defaults on everything):
   - `game_wallets` (user_id unique, balances per state in tetri, frozen flag, kyc_status)
   - `game_wallet_ledger` (append-only, double-entry, `amount_tetri bigint`, state_from, state_to, account, ref_type/ref_id, by, reason)
   - `game_money_accounts` (season_budget, sponsor pools, clearing, adjustments)
   - `game_reward_table` (difficulty, default_tetri, min_tetri, max_tetri, per season or global)
   - `game_task_templates`: add `difficulty`, `reward_tetri_override`, `sponsor_id`
   - `game_task_assignments`: add `reward_tetri` (frozen at draw)
   - `game_withdrawals` (amount, method, masked destination, provider ref, status, risk score, approved_by)
   - `game_kyc` (provider ref, status, verified name, birth date; no document images stored by us)
   - `game_appeals`
   - `game_sponsors`
2. **Services**: `WalletService` (the only writer of money, as `EconomyService` is for coins), `PayoutService` (the provider adapter behind an interface, as `payments/providers/` already does for the shop), `KycService`, `RiskService`, `ReconciliationService` (nightly cron under the existing leader lock), `TaxService` (monthly export).
3. **Rules in `rules.ts`**: `MONEY_MINIMUM_AGE = 18`, `DEFAULT_CLAWBACK_HOURS = 72`, `DEFAULT_MIN_WITHDRAWAL_TETRI = 500`, and caps. All of them are env- or admin-tunable with designed defaults, as in V1.
4. **Admin sub-roles** and four-eyes approval on money endpoints, pinned in `jwt-auth.guard.spec.ts`.
5. **Provider webhooks**: signature-verified, idempotent, replay-safe (copy the opal settlement pattern).
6. **Feature flag**: `GAME_MONEY_MODE=off|shadow|on`. In `shadow`, everything is computed and shown to admins, and no wallet is credited. That gives us a full season of real numbers before any real lari moves.

---

## 8. Phased roadmap

Ordered so that the legal answer arrives **before** we write code that pays money.

### Phase 0: Decide (weeks 0–3, mostly not code)
- [ ] Lawyer opinion on the game's classification (prize game / gambling / neither) and on holding balances (see `WHAT-WE-NEED.md`). **Gate for everything else.**
- [ ] Pick the payout partner and start merchant onboarding (it takes weeks).
- [ ] Accountant: tax treatment and whether to gross up.
- [ ] Decide: 18+ for money mode; what opals are allowed to do in money seasons.
- [ ] Set the first season budget and the reward table numbers.
- **Checkpoint:** a written yes/no from the lawyer, and a signed provider agreement or a known timeline.

### Phase 1: Ledger in shadow (weeks 2–5)
- [ ] Migrations for wallets, ledger, accounts, reward table, template difficulty, frozen price.
- [ ] `WalletService` with double-entry and idempotent settlement, fully unit-tested.
- [ ] Reward table and budget in the admin (behind owner role).
- [ ] `GAME_MONEY_MODE=shadow`: prices are computed and shown to admins only.
- **Checkpoint:** one full season in shadow; reconciliation runs nightly with zero mismatches.

### Phase 2: Redesign (weeks 3–9, runs in parallel with Phase 1)
- [ ] Game site: tokens v2, component kit, `/play`, `/wallet`, `/`, then the rest.
- [ ] Admin: the new IA, the Money section, queues-first overview, keyboard review.
- [ ] Georgian translations and the legal pages (texts from the lawyer).
- **Checkpoint:** a usability test with 5–8 players and 2 moderators.

### Phase 3: Payouts (weeks 6–10)
- [ ] KYC integration, withdrawals table, payout queue, provider adapter.
- [ ] Manual bulk-file fallback, so a launch never waits on an API.
- [ ] Risk rules, the clawback window, appeals.
- [ ] Tax export.
- **Checkpoint:** an internal season with staff accounts withdrawing real (small) money end-to-end.

### Phase 4: Launch (week ~10+)
- [ ] `GAME_MONEY_MODE=on` for one season with a small budget (for example 500–1,000 ₾).
- [ ] Watch daily: payouts, reversals, appeals, safety reports.
- [ ] Post-season review, then scale the budget and bring in sponsors.

---

## 9. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Classified as gambling or a prize game | Launch blocked, fines | Free entry, fixed prices, no paid advantage, a lawyer's opinion first; see `WHAT-WE-NEED.md` |
| Holding balances counts as e-money / payment service | NBG licence needed | Use a licensed partner to hold the funds, or pay out without a stored balance |
| A player is hurt doing a paid dare | Severe: legal, brand | Blocklist stays absolute; the price never rises with danger; a safety button; insurance; terms |
| Fraud: fake hand-ins, multi-accounts, money mules | Money lost | KYC at withdrawal, name match, clawback window, velocity rules, one wallet per personal ID number |
| Minors earning cash | Legal, PR | 18+ for money mode |
| The budget runs out mid-season | Player anger | Debit at draw, and announce when the pool is low |
| Tax done wrong | Penalties | Accountant sign-off; monthly export from the ledger |
| Provider outage | Payouts stuck | Bulk-file fallback; "withdrawing" money returns to "available" on failure |

## 10. Open questions for the founder

1. Is the money funded only by STIFF, or by sponsors from day one?
2. First season budget?
3. 18+ for the money version: yes? (Recommended.)
4. Opals in money seasons: off, cosmetics only, or unchanged with a lawyer's sign-off?
5. Do we keep the daily minimum of 4 tasks in money seasons? (Recommended: no.)
6. Separate LLC for the game? (Recommended; see `WHAT-WE-NEED.md`.)
7. Which provider do we approach first? (Recommendation in `WHAT-WE-NEED.md`.)
