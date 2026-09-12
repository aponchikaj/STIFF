# Game rules the server enforces

What `backend/src/game/` holds people to, in the order a player meets it.
Everything below is enforced in code on `main` and ships on every branch; the
constants live in `rules.ts`, the age arithmetic in `age-gate.ts`, the
demotions in `discipline.service.ts`, the model in `ai/cheat-detector.service.ts`.

## Age: 16 and over, strictly

- `MINIMUM_AGE = 16`. Applies to **both** sides — watching included.
- Checked in two places: `POST /api/game/register` (before the account is
  made, so a refusal leaves nothing behind) and `EnrolmentsService.chooseRole`
  (every time an account takes a side, player or watcher).
- The date lives on the account as `users.birthDate` (`YYYY-MM-DD`). A shop
  account made on stiff.ge has none, so the first `POST /api/game/enrolments`
  from it must carry `birthDate`; once recorded, a supplied value is ignored.
  It is written **before** it is judged, so a refused fifteen-year-old cannot
  come back with a different year on the same account.
- Under sixteen is **403** (`ForbiddenException`, "You must be 16 or older").
  A malformed, impossible, future or >120-year date is **400**.

## Sign-up

`POST /api/game/register` takes `username`, `password`, `role`
(`player` | `watcher`) and `birthDate`. `email` is optional. There is no
phone number, no IP check, no device fingerprint — the game asks for the least
it can. It creates an ordinary **shop** account through the same
`AuthService.register` the shop uses (same username and password rules), sets
the shop session cookie, and takes the side through `chooseRole`. A live
season takes them whatever day it is on. Between seasons the account is still
made and the side is kept (`pending: 'no_season'`) until one opens.

`users.email` is nullable since migration `1787280000000-GameDiscipline`. An
account without one gets no verification mail and no password reset until it
adds an address.

## Roles

**Enrolment never closes.** Any day of the season, `open` or `running`,
takes a new account: someone who hears about the game on day two joins on day
two, at zero Nerve with a full set of hearts, and climbs from there. The only
time a side cannot be taken is between seasons, when there is nothing to join
and the choice is kept (`pending: 'no_season'`) until one opens.

`player` or `watcher`, per season, chosen once. A person cannot switch:
asking for the other side is a **409** naming what they already are (or, for
a demoted player, why they were moved). Only the game moves a player to
watcher — four ways: a confident cheating verdict, fewer than the daily
minimum of tasks, zero Nerve with zero hearts and zero coins, or losing the
last heart — and
only an admin moves them back. Every enrolment carries:

| column | meaning |
|---|---|
| `status` | `active`, `demoted`, or `cheater` |
| `demotionReason` | `cheating`, `missed_daily_minimum`, `zero_balance`, or `out_of_hearts` |
| `demotedAt` | when |
| `demotionSnapshot` | `{ nerve, heartsRemaining, coins?, attemptId?, by }` at the moment it happened |

`CHK_game_enrolments_demotion` holds that an `active` row has no reason and a
non-active row has one. A demoted player asking a player-only route gets a
**403** with the reason spelled out (`EnrolmentsService.require`).

## Hearts and the task clock

Every player starts with the season's hearts (`startingHearts`, **3** by
default). Hearts only ever go down. Two things cost one, and the last one
ends the season for them.

**The server draws the task.** `POST /api/game/tasks/draw { day }` picks at
random from the approved templates at that tier (`tier = day`), never one
this player has been offered before this season
(`UQ_game_task_assignments_enrolment_template`), and only while the season is
`running` — an `open` season is still enrolling and has no clock to start. A
player holds one task at a time: a draw while an offer is waiting returns
that offer, and a draw while a clock is running is a **409**. Nothing left
in the pool for them is a **409** too.

**Accept starts the clock.** `POST /api/game/assignments/:id/accept` sets
`acceptedAt = now()` and `expiresAt = now() + clockMinutes`, where
`clockMinutes` was copied from the template at the draw so a pool edit cannot
move a clock already running. `expiresAt` is server time; the phone's clock
does not matter. `GET /api/game/assignments/current` returns the held task
with `secondsLeft`.

**Decline costs a heart.** `POST /api/game/assignments/:id/decline` is
allowed before or after accepting (`offered` or `accepted`), closes the
assignment as `declined` with `heartBurned: true`, and burns one heart
(`DisciplineService.burnHearts`). The task does not come round again.

**00:00 costs a heart.** `AssignmentsService.sweepClocks` runs **every
minute** (leader lock `gameTaskClock`): any `accepted` task past `expiresAt`
becomes `expired` with `heartBurned: true`, and one heart is burned.

**Hand-ins are judged against the clock.** `POST /api/game/attempts/upload-url`
now requires `assignmentId` — the day and the task come from the assignment,
and it must be this player's, `accepted`, with time left (an overdue one is
settled on the spot and refused with "Time ran out on that task."). At
`POST /api/game/attempts/:id/confirm` the assignment is closed as
`submitted` only if `expiresAt` is still ahead. If not, the attempt is kept
as `rejected` with `rejectionReason` "Handed in after the clock ran out.",
the clock is settled at once (a heart, and watcher if it was the last), and
the client gets a **409** "Time ran out before you handed in."

**The last heart makes them a watcher, immediately.** Whether it went to a
decline, to the clock, or to an admin `burnHeart` on `settle`, the enrolment
is moved to `role: watcher`, `status: demoted`,
`demotionReason: out_of_hearts` in the same call
(`DisciplineService.demoteOutOfHearts`), and the person is told. A
demoted-for-hearts player asking a player route gets a **403** ("You lost
your last heart…").

`GET /api/game/rules` reports `startingHearts` and `heartCosts` alongside
the other constants.

## Clans and coins

A clan is **exactly two players**, one of whom leads (`CLAN_SIZE` in
`rules.ts`). Clans are per season, like everything about a player.

**Forming one.**

- Anyone who is a player can create one: `POST /api/game/clans { name }`
  (3–24 letters, numbers, spaces, dots, dashes or underscores; unique per
  season, case-insensitively — `UQ_game_clans_season_name`). The creator is
  the leader and the reply carries an `inviteCode`.
- One clan per person. `UQ_game_clan_members_enrolment` makes that a fact:
  an enrolment appears in `game_clan_members` once, as leader or as member.
  Creating or joining a second is a **409**.
- The second person joins by code: `POST /api/game/clans/join { code }`.
  `UQ_game_clan_members_clan_role` — one leader seat, one member seat — is
  what makes two the most a clan can hold; two people joining at once
  cannot both take the seat. The clan goes `forming` → `full`.
- `GET /api/game/clans/mine` returns the clan with its members (handle,
  role, nerve, coins, hearts), `myRole`, and the `inviteCode` only to its
  own members and only while forming. `GET /api/game/me` carries the same
  under `clan`.
- `POST /api/game/clans/leave` works only while `forming`: the member's
  seat is freed; the leader's leaving **disbands** it. A `full` clan is
  locked for the season — the team's tasks pay and charge both, and a
  walk-out would leave the other holding the score alone.

**Team tasks.**

- Templates carry `mode`: `solo` is drawn by a player, `team` only by a
  clan's leader. `GET /api/game/tasks?mode=team` lists them for reading.
- **Only the leader starts a task.** `POST /api/game/clans/tasks/draw
  { day }` needs a full clan (`ClansService.requireLeader` — a member gets a
  **403**, a forming clan a **409**), the season `running`, and picks at
  random from approved `mode: 'team'` templates at that tier that this
  leader has not been offered before. The assignment is held by the
  leader's enrolment and carries `clanId`. The leader cannot hold a solo
  task and a clan task at once.
- The leader accepts and declines through the ordinary
  `POST /api/game/assignments/:id/accept` / `decline` routes.
- **Either member may hand in.** `POST /api/game/attempts/upload-url`
  accepts a clan assignment from whichever member sends it
  (`AssignmentsService.requireOpen` checks clan membership when the sender
  is not the holder), and the confirm closes it the same way. The attempt
  is recorded under the uploading member, so a clan hand-in counts toward
  **that member's** daily minimum, not both.

**What it pays and what it costs** (`EconomyService`, `game-admin.service.ts`
`settle`, `assignments.service.ts` `fail`).

- **Finished** (`settle` with `approve`): **both members** receive the
  template's `rewardNerve` and `rewardCoins`. The reviewer's `nerve`
  parameter is ignored for a clan attempt; the template decides.
- **Failed**: on a rejected hand-in (`settle` with `reject`), a decline, or
  the clock reaching 00:00, **each member** loses the template's
  `penaltyCoins` — **1 to 3**, `CHK_game_task_templates_economy` in the
  database, `clampPenalty` in the service. A decline or an expiry also burns
  one heart from each member (a rejected hand-in does not). Coins floor at
  zero: a three-coin penalty on a one-coin balance takes one.
- Solo tasks: approval pays the reviewer's `nerve` if given, else the
  template's `rewardNerve`, plus the template's `rewardCoins`. There is no
  coin penalty for a solo failure; the hearts rule stands as before.
- Every coin movement is a row in `game_coin_ledger` — `delta` (what
  actually moved), `balanceAfter`, `reason` (`task_reward`, `task_penalty`,
  `vote_reward`, `purchase`, `cheating`, `reinstated`, `admin`),
  `refType`/`refId` — written in the
  same transaction as the update to `game_enrolments.coins`, which is the
  running total the screens read. Append-only; no endpoint edits it.

**Where coins show up.** The enrolment view, board rows and player search
(`coins`), the clan view's members, `GET /api/game/rules` (`clanSize`,
`teamPenaltyCoins: { min, max }`). The zero-balance sweep now requires
`coins = 0` as well. A cheater's coins are zeroed with Nerve and hearts (a
`cheating` ledger row) and come back on reinstate (a `reinstated` row).

## Watchers' vote

How the audience earns. Every confirmed hand-in is put to the watchers
for three hours, and a right call pays coins.

**The window.** `AttemptsService.confirmUpload` sets `votingStatus: 'open'`
and `votingEndsAt = submittedAt + VOTING_WINDOW_HOURS` (3, `rules.ts`) on
the attempt. A late hand-in (kept as `rejected`) opens no vote.

**Voting** (`VotingService`, `/api/game/votes`).

- **Watchers only.** Both routes call `EnrolmentsService.require(user,
  'watcher')`; a player asking is refused. A player's opinion of another
  player's hand-in is not evidence, and the coins are the audience's.
- `GET /api/game/votes/open` — every `submitted` attempt in the live season
  whose window is still open, oldest window first: media, caption, the
  player's handle, the task (title, brief, proof), `votingEndsAt`,
  `secondsLeft`, the `yes`/`no` tallies, and `myVote`.
- `POST /api/game/votes/:attemptId { vote: 'yes' | 'no' }` — one vote per
  watcher per attempt (`UQ_game_attempt_votes_attempt_enrolment`),
  changeable while the window is open. The window is re-checked inside the
  INSERT, so a vote cannot land after the resolver has claimed the attempt;
  a closed window is a **409** "Voting on that hand-in is closed." The reply
  carries the tallies and `cooldownSecondsLeft`.

**Resolving** (`VotingService.resolveDue`, `ai/vote-resolver.service.ts`).

- A cron every five minutes (`gameVotes`, under the leader lock) — and
  `POST /api/game/admin/votes/resolve` for the button — claims every
  `open` attempt past `votingEndsAt` with a conditional UPDATE to
  `resolving`, so two instances or a reviewer settling by hand cannot both
  resolve it.
- The **vote resolver agent** looks at the photo, the task brief and
  criteria, the caption, the cheat detector's verdict and the tallies, and
  answers `confirmed`, `not_confirmed` or `unsure` with a `payout` of 2–5
  coins. The vote is evidence it weighs, never the answer: a landslide
  "yes" on a photo that does not show the task is `not_confirmed`.
- **Photos only.** A clip, a missing `ANTHROPIC_API_KEY`, a refusal, an
  unreadable reply or an error all come back `unsure`, which sets
  `votingStatus: 'deferred'` and leaves the attempt for a person in the
  review queue. Nobody is paid until they settle it.
- `confirmed` → `VerdictsService.settle(approve, by: 'resolver')`: the
  attempt is published, the task's rewards are paid (both members for a
  clan), and the vote is closed as below. `not_confirmed` → `settle(reject)`
  with the resolver's first reason as `rejectionReason`; nobody is paid.

**What a vote pays** (`VerdictsService.closeVoting`, inside the settle
transaction — whoever settles, resolver or reviewer).

- On an **approval**, every **correct "yes"** voter whose cooldown has
  passed is paid the payout in one statement: coins added, `lastVoteWinAt`
  set to now on the enrolment, `paidCoins` written on the vote, and a
  `vote_reward` ledger row pointing at the attempt. A voter still inside
  the cooldown is counted (`cooling`), not paid.
- The payout is the resolver's figure when it decided, clamped to
  `VOTE_REWARD_MIN_COINS`–`VOTE_REWARD_MAX_COINS` (**2–5**), or the tier's
  default when a person settled by hand: day 1 → 2, day 2 → 3, day 3 → 5
  (`defaultVoteReward`).
- **Cooldown:** `VOTE_WIN_COOLDOWN_HOURS` (**5**) from the last paid vote.
  Voting is still allowed during it; earning is not.
- **A "no" never pays**, whatever the outcome, by the rule as written. A
  wrong "yes" pays nothing. On a rejection nobody is paid.
- The resolution is stored as `voting` on the attempt: `outcome`,
  `confidence`, `payout`, `reasons`, `model`, `by` (`resolver` or the
  admin's id), `resolvedAt`, `yes`, `no`, `paid`, `cooling`; `votingStatus`
  becomes `resolved`. A reviewer settling from the queue closes an `open`,
  `resolving` or `deferred` vote the same way.

`GET /api/game/rules` exposes `voting: { windowHours, rewardCoins: { min,
max }, cooldownHours }`.

**A consequence to know.** The open-votes list shows a hand-in to watchers
**before** anyone has reviewed it. The earlier design published nothing a
person had not looked at; the vote reverses that for watchers, by design.
Only the feed (`published` attempts) stays reviewed-first.

## Coin shop

Players and watchers alike spend the coins on their enrolment on whatever
an admin has listed (`ShopService`).

**Listing, from the panel** (`/api/game/admin/shop`, `@Roles('admin')`).

- `POST /shop/items` — `{ name, description?, imageUrl?, priceCoins,
  stock?, perPersonLimit?, status?, sortOrder? }`. `stock` omitted is
  unlimited; `status` defaults to `draft`; only `live` items are on sale.
  Images go through the existing `POST /api/uploads` (admin-only) and the
  returned URL is passed as `imageUrl`.
- `PATCH /shop/items/:id` — any of the same fields; send `stock: null` for
  unlimited. `GET /shop/items?status=` lists everything.
- `GET /shop/purchases?status=&itemId=&limit=` — who bought what, newest
  first. `PATCH /shop/purchases/:id { status: 'fulfilled' | 'cancelled',
  note? }` — `fulfilled` marks it handed over; `cancelled` refunds the coins
  (an `admin` ledger row) and puts the stock back. A cancelled purchase
  cannot be changed again.

**Buying** (`/api/game/shop`).

- `GET /api/game/shop` — public, so the shop is a reason to want an
  account. Live items with `priceCoins`, `stock` (null is unlimited),
  `perPersonLimit`, `soldOut`, and `bought` — how many the reader already
  has (0 signed out).
- `POST /api/game/shop/:id/buy` — needs a session and an enrolment of
  either side. One transaction: the per-person limit is checked (**409**
  "You can only buy this N time(s)."), the stock is decremented only if
  there is any (**409** "Sold out."), the purchase row is written, and the
  coins are charged only if the balance covers the price
  (`EconomyService.charge` — **409** "Not enough coins.", which rolls the
  stock back with it). A `purchase` ledger row points at the purchase.
- `GET /api/game/shop/purchases/mine` — the reader's purchases with
  `itemName` and `priceCoins` snapshotted at the time, `status`, `note`.

## Task creation: two agents

Tasks are written by a model and checked by a second one, in a loop, and
nothing either says is trusted on its own (`ai/task-pipeline.service.ts`).

**The creator** (`ai/task-generator.service.ts`, `TaskGeneratorService`)
writes a batch with the Charter in context — the tone, the blocked list,
the guards, the proof rule, and (part 7) team tasks and what a task pays.
Every task it writes carries `mode` (`solo` / `team` — a team task has both
people visibly doing it in the same footage), `rewardNerve` (5–100),
`rewardCoins` (1–20) and `penaltyCoins` (1, 2 or 3), bounded in the schema
and clamped again when filed. It is told to be strict: if a task could be
read as a blocked type, write a different one. `POST
/api/game/admin/tasks/generate { tier, count, avoid?, steer?, mode? }`
starts a batch — `mode` asks for solo or team tasks only, unset lets the
creator mix; the existing pool's slugs are passed as `avoid` automatically.

**The screen** (`ai/exclusions.ts`) is the floor. A regex rule per blocked
type, run over the brief and every criterion, deterministic and not open to
argument. It runs first because a task it refuses is not worth a reviewer
call, and it keeps running at approval time.

**The reviewer** (`ai/task-reviewer.service.ts`, `TaskReviewerService`)
reads every task that clears the screen and answers `approve` or `reject`
with a severity (`ok` / `bad` / `illegal`), the blocked types it saw, its
reasons, and `feedback` addressed to the creator. It is told to assume the
creator was not careful enough, to reject anything illegal, harmful, one of
the blocked types in substance, unprovable, missing its proof line, or
simply very bad — and not to reject a task for being gross or embarrassing
to the player. It **fails closed**: a refusal, an API error or an
unreadable reply is a rejection, never a pass.

**The loop.** A refusal from either gate goes back to the creator with the
reason (`TaskGeneratorService.revise`), which is told to write a *different*
task, not a softer version of the same one. Up to `GAME_TASK_MAX_ROUNDS`
(default **3**) per slot: round one is the batch, each replacement is the
next round. A slot that never produces an acceptable task is **dropped**,
not filled with the least-bad attempt. The reply reports `rounds`,
`dropped`, `models` (creator and reviewer), and `usage`.

**What is kept.** Every refusal lands in `game_generation_rejections` with
`source` (`screen` or `reviewer`), `feedback` (what the creator was told),
`round`, and the categories — the screen's, or the reviewer's blocked types.
Every surviving task is filed as a **draft** carrying `review` (the verdict
that let it through, with the round). A person still approves it into the
pool, and `approve` re-runs the screen; a draft whose `review.verdict` is
`reject` is refused with a **400** until it is edited and reviewed again
with `POST /api/game/admin/tasks/:id/review`, which stores a fresh verdict
as round `0`.

### Blocked task types

The list in `ai/blocklist.ts` is the one source: it is rendered into the
Charter the creator reads, into the reviewer's prompt and schema, and every
id has a screen rule of the same name (`exclusions.spec.ts` pins that).

| id | rule |
|---|---|
| `substances` | no drinking, drugs, smoking or vaping — not as the dare, a prop, or a setting |
| `weapons` | no knives, guns, replicas, fireworks, tasers, or anything carried to look like one |
| `theft` | nothing taken, moved, marked, stickered, broken or dirtied |
| `trespass` | the player is somewhere they may lawfully be, the whole time |
| `traffic` | no roads, crossings, tracks, platform edges, moving vehicles |
| `heights` | both feet at ground level; no roofs, balconies, ledges, climbing |
| `water` | no rivers, lakes, sea, canals, fountains, pools — in or at the edge of |
| `fire` | no flames, lighters, matches, candles, fireworks, hot surfaces |
| `dangerous_ingestion` | anything eaten is food-safe in the amount asked; nothing inedible, toxic, raw, expired, an allergen, a choking risk, a chug or speed challenge |
| `stunts` | no jumping, climbing, running at speed, balancing, flips, lifting |
| `violence` | nobody is hit, pushed, threatened, chased, cornered, or made to feel unsafe |
| `self_harm` | nothing that cuts, burns, bruises, shocks, holds breath or causes pain, even as a joke |
| `sexual` | nothing sexual, suggestive or undressed; outerwear may come off only where the brief names the items |
| `touching` | no physical contact with anyone; hand things over |
| `minors` | nobody under 16 in frame; anyone approached is an adult (18+) |
| `confrontation` | a stranger ends the interaction no worse off: no pranks, tricks, insults, shouting, filming without agreement |
| `hate` | nothing that targets or references a group, faith, nationality, body or political side |
| `deception` | the other person always knows what is happening; no pretending to be staff, police, injured, lost |
| `privacy` | no private homes, toilets, changing rooms, hospitals, schools; no names, plates, addresses, phones, screens, documents |
| `disruption` | nothing blocks a door, a queue, a counter, a stage, or a business at work |
| `animals` | no live animal approached, fed, handled, chased, filmed or used as a prop (pet food eaten by the player is fine) |
| `medical` | no pills, supplements, injections, devices, blood, vomit, urine, spit, or mimicked medical acts |
| `gambling` | no bets, casinos, slot machines, betting shops, games for money |
| `spending` | completable by someone who buys nothing |

The screen also keeps one older category, `nudity`, which `outerwear_only`
can redeem for a brief that names the garment coming off; "strip", "nude"
and "naked" trip the unredeemable `sexual` rule as well.

### Proof

Every task carries `proof`: `photo`, `video` or `either`, stated in the
brief's last line ("Take a video." / "Take a photo." / "Photo or video.")
and in the field. Eating, speaking, performing or another person means
`video`. It reaches the player on `GET /api/game/tasks`, on the drawn
assignment's `task`, and it is enforced at `POST /api/game/attempts/upload-url`:
a `kind` that does not match the task's proof is a **400** ("This task asks
for a video." / "…a photo.") before any upload URL is minted. `either`
accepts both. Rows from before migration `1787300000000-GameTaskReview`
read as `either`.

## Daily minimum: four tasks, no maximum

- A player hands in as many attempts a day as they like.
  `UQ_game_attempts_enrolment_day` is gone; `requestUpload` is a plain insert.
- `DisciplineService.sweepDailyMinimum` runs at **00:05 Asia/Tbilisi** and
  judges the last whole Tbilisi day. A player who handed in fewer than
  `GAME_DAILY_MINIMUM_TASKS` (default **4**) becomes a watcher with
  `demotionReason = 'missed_daily_minimum'`. Nerve and hearts are kept.
- What counts: attempts with `status IN ('submitted', 'published')` whose
  `submittedAt` — set by `confirmUpload`, the moment the file was confirmed —
  falls inside the day. An attempt waiting for a verdict counts; a rejected
  one does not; an abandoned `awaiting_upload` row never does.
- Who is judged: `role = 'player'`, `status = 'active'`, enrolled before the
  day began (`createdAt < window.start`), and only when the season is
  `running` and `startsAt` is before the window start — a season that opened
  at noon has not given anyone a whole day.
- `GET /api/game/me` returns `today: { handedIn, minimum }` for a player, the
  same count the sweep will make, so nobody finds out at midnight.
- Set `GAME_DAILY_MINIMUM_TASKS=0` to switch the rule off without a deploy.

## Zero balance

`DisciplineService.sweepZeroBalance` runs at **00:10 Asia/Tbilisi**. Any
active player with `nerve = 0` **and** `heartsRemaining = 0` **and**
`coins = 0` becomes a watcher with `demotionReason = 'zero_balance'`.
Players start with hearts, so this never catches someone who only just
joined.

Both sweeps run under `LeaderLockService` (one instance only when Redis is
configured), notify each person through `NotificationsService`, and log a
failure rather than letting it reach the scheduler.

## Cheat detection

`CheatDetectorService.inspectLater` fires after `confirmUpload` saves the
row — off the request, so the player is not kept waiting on a model.

- **Photos only.** The model is shown the image at `mediaUrl` together with
  the task's brief and criteria when `taskTemplateId` was given. A clip is
  recorded as `unchecked` with `skipped: 'video'` and left for a person; the
  row says the model never saw it, so nobody can later claim it did. Other
  `skipped` values: `not_configured` (no `ANTHROPIC_API_KEY`), `no_media`,
  `error`, `disabled`.
- The verdict (`authentic` | `suspicious` | `cheating` | `unchecked`,
  `confidence` 0–1, `reasons`, the named `signals`, `model`, `mode`,
  `enforced`) is written to `game_attempts.aiVerdict` with `aiCheckedAt`
  whatever it says, so the review queue shows what the model thought.
- **Modes** (`GAME_CHEAT_DETECTION`): `enforce` (default), `shadow` (verdict
  stored, nothing moves), `off` (model not called).
- **Threshold** (`GAME_CHEAT_CONFIDENCE`, default **0.85**): a `cheating`
  verdict below it is stored as `suspicious` for a person to look at.
- **On a confident `cheating` verdict in `enforce` mode** the detector calls
  `DisciplineService.flagCheater`: in one transaction the enrolment goes to
  `role = 'watcher'`, `status = 'cheater'`, `nerve = 0`,
  `heartsRemaining = 0`, `coins = 0` (the old values into
  `demotionSnapshot`, and a `cheating` row in `game_coin_ledger` for the
  coins), and the attempt goes to `rejected` with `rejectionReason`. The
  person is notified.
  An account already marked is refused, so a model verdict and a reviewer
  arriving together cannot both overwrite the snapshot.
- **Undo**: `POST /api/game/admin/enrolments/:id/reinstate` puts the account
  back as an active player, restoring Nerve, hearts and coins from the
  snapshot (a `reinstated` ledger row) unless `{ "restore": false }`.

## The cheater label

Once `status = 'cheater'`, every comment the account ever wrote comes back
from `GET /api/game/feed/:id/comments` (and `POST`) with
`authorStatus: 'cheater'` and `notice: "CHEATER WROTE A COMMENT"`
(`CHEATER_NOTICE` in `rules.ts`). The standing is read at render time from
the enrolment, not snapshotted on the comment. Other authors carry
`authorStatus: 'active' | 'demoted'`, or `null` for someone never enrolled,
and `notice: null`. Feed items carry `player.status` for the same purpose.

## The score and the board

Nerve is the score. It lives on the enrolment (`game_enrolments.nerve`),
starts at zero for every player, is paid when a hand-in is approved
(`rewardNerve` on the template, or the reviewer's figure for a solo one) and
is never bought, spent or negative. **Every change to it is a row in
`game_score_ledger`**, written in the same transaction, so at any moment a
player's score is `SUM(delta)` over their rows — and a number that moved has
a row saying who moved it and for what.

| `reason` | when |
|---|---|
| `task_reward` | an approved hand-in; `refId` is the attempt, `by` the admin or `resolver` |
| `clawback` | `POST /admin/attempts/:id/unpublish` — the net this attempt paid each enrolment, taken back; a second call finds nothing left |
| `cheating` | `flagCheater` zeroed it; `by` is `ai` or the admin |
| `reinstated` | what an admin's reinstatement actually put back — nothing, for a player demoted on hearts who kept their score |
| `admin` | `POST /admin/enrolments/:id/score` `{ delta, reason }`, a correction on the record |
| `opening` | written once by the migration for Nerve that existed before the ledger |

A negative movement floors at zero in the statement (`GREATEST`), and the
ledger records what actually moved, not what was asked. `lastScoredAt` moves
only when the score goes **up**: the board breaks ties on who *reached* a
score first, and a clawback does not make someone newer to what they have
left.

**The board** (`GET /api/game/leaderboard?page=&pageSize=`) is players only,
in the season being played, ordered by Nerve descending, then `lastScoredAt`
ascending with nulls last, then handle, on `IDX_game_enrolments_board`
(`seasonId, role, nerve DESC`). A watcher is never on it, and a player moved
to watcher drops off it with their Nerve intact.

**The board ranks and never cuts.** There is no field size, no daily cull and
no rank that ends anyone's season: a player at 900th is as much in the game as
the one at 1st, and the only things that move a player to watcher are the four
in "Roles" — none of them a position on this list. `GET /rules` says so in
`eliminationByRank: false`, so a client never has to infer it.

**Rank** is one more than the number of players ahead by the same rule, so
`GET /me` (`rank`) and `GET /leaderboard/me` can never disagree with the
page. `GET /leaderboard/me` is signed-in only and answers `{ onBoard, rank,
total, nerve, around }` — `around` is the `BOARD_NEIGHBOURS` rows either side
of the caller, numbered — or, for a player moved to watcher, `onBoard: false`
with the Nerve they finished with and `demotionReason`. Nobody is asked to
guess why they vanished from the board.

## Reports

Anyone with an account can say something is wrong, about almost anything
the game shows. The rules — what can be reported, for what, by whom, and
what closing a report may do — are `reports/report-rules.ts`; the service
is `reports/reports.service.ts`; the table is `game_reports`.

**What can be reported.** A hand-in (`attempt` — a photo or a clip in the
feed), a `comment`, a `user` (by id, or by the handle every screen shows),
a `task` brief, a `shop_item`, a `clan`, one's own `purchase`, or the game
itself (`app` — a bug, or a way to cheat it; no target id).

**For what.** Each kind lists its own reasons, in menu order, and
`GET /api/game/reports/reasons` renders the catalogue so the sheet never
offers a reason the server refuses. Every reason carries a priority
(0 low – 3 critical: self-harm, violence, a threat, anything illegal,
anyone under 16, an exploit) and says whose thing it is for: `cheating`
is only about somebody else, `wrong_verdict` and `unfair_demotion` are
appeals about one's own, a purchase can only be reported by its buyer, and
one's own comment cannot be reported at all ("delete it instead"). A
`dangerous` or `illegal` report may carry `tags` — the blocklist ids the
task pipeline uses, so "weapons" means the same thing to a reporter, the
reviewer agent and the Charter.

**What the row keeps.** A copy of the thing as it was (`snapshot`: the
comment's body, the clip's URL and caption, the handle, the task title)
and the account it is ultimately about (`targetUserId`: the player behind
a hand-in, a comment's author, a clan's leader). Both outlive the target —
a deleted comment, a renamed handle, a closed account (`SET NULL`).
Reports are never deleted: withdrawn and dismissed ones stay as history,
so a pattern of bad-faith reports is visible and the fifth report on a
clip lands differently from the first.

**What is refused.** A reason the target does not list (400). A second
open report on the same thing from the same account — 409, and
`UQ_game_reports_open_reporter_target` (partial: `open`/`reviewing`
only) decides when two taps race. Anything the reporter could not have
seen — an unpublished hand-in that is not theirs, a draft task or shop
item, somebody else's purchase — is a 404, not a hint. More than
`GAME_REPORT_DAILY_CAP` (default **20**) in a rolling day is a 429.

**Auto-hide.** Once `GAME_REPORT_AUTO_HIDE` (default **5**, `0` disables)
*different* accounts have an open report on the same hand-in or comment,
it is hidden from the feed (`hiddenAt`) without waiting for a person, and
those reports are raised to priority 2. Nothing else moves: the verdict,
the Nerve, the counters all stand until an admin resolves the reports —
`restore_content` puts it back, `remove_content` unpublishes it properly.

**Resolving.** An admin claims a report (`reviewing`), then closes it as
`resolved` (with an `action`) or `dismissed` (no action). The action runs
**first**, through the service that owns it, and a refusal keeps the
report open rather than marking it resolved over nothing:

| action | what runs |
|---|---|
| `none` | nothing |
| `remove_content` | comment: `FeedService.removeComment`; hand-in: `VerdictsService.unpublish` |
| `restore_content` | clears `hiddenAt` |
| `warn_user` | a notification to the account it is about, with the note |
| `flag_cheater` | `DisciplineService.flagCheater`, naming the hand-in when the report was about one |
| `reinstate` | `DisciplineService.reinstate` — an upheld appeal |
| `retire_task` | `TaskTemplatesService.retire` |
| `archive_item` | the shop item to `archived` |

Which actions fit which kind of thing is `ACTIONS_FOR_TARGET`. Closing
one report closes every other open report on the same thing the same way
(`includeSiblings`, default on). Every reporter is told the outcome —
"took action", "no action needed", or "did not find a problem" — plus
`reporterMessage` if the admin wrote one; the internal `note` never
leaves the panel. The account it is about is told when something was
done to it. A closed report can be reopened.

**The panel's view.** `GET /api/game/admin/reports/:id` returns the
report, the thing as it is *now* (exists, hidden, status, how many
distinct accounts have it open), every sibling report, and both parties'
history: how many reports the target has drawn and how many stuck, how
many the reporter has filed and how many were upheld or dismissed.
`GET /api/game/admin/reports/stats` is the dashboard — counts by status,
kind, priority and reason, the oldest wait, what is hidden, and the ten
most-reported things.

Every admin call here is a state change under `@Roles('admin')`, so it
lands in `admin_audit_logs` like the rest of the panel's work.

## Endpoints

Player-facing (`/api/game`):

| route | what |
|---|---|
| `GET /rules` | `{ minimumAge, dailyMinimumTasks, startingHearts, heartCosts, clanSize, eliminationByRank, tieBreak, teamPenaltyCoins, voting }` from the same constants |
| `GET /tasks?tier=&mode=` | the approved pool, for reading; playing goes through a draw |
| `POST /tasks/draw` | `{ day }` — the server picks; returns the waiting offer if there is one |
| `GET /assignments/current` | the offer waiting or the clock running, with `secondsLeft` |
| `POST /assignments/:id/accept` | starts the clock |
| `POST /assignments/:id/decline` | costs a heart; returns `{ assignment, heartsRemaining, demoted }` |
| `GET /me` | dashboard, with `today: { handedIn, minimum }` for a player, `rank` (null off the board) and `clan` |
| `GET /leaderboard?page=&pageSize=` | public — players by Nerve, high to low; a ranking, never a cut |
| `GET /leaderboard/me` | the caller's rank and the rows around them; honest for a demoted player |
| `GET /players/search?q=` | public — players only, by handle |
| `POST /clans` | `{ name }` — makes a clan, caller leads; returns the `inviteCode` |
| `POST /clans/join` | `{ code }` — takes the member seat; the clan becomes `full` |
| `GET /clans/mine` | the caller's clan, members, `myRole`, `inviteCode` while forming |
| `POST /clans/leave` | only while forming; the leader's leaving disbands |
| `POST /clans/tasks/draw` | `{ day }` — leader only, full clan only; a `mode: team` task |
| `GET /votes/open` | watchers only — hand-ins whose window is open, with tallies and `myVote` |
| `POST /votes/:attemptId` | `{ vote: 'yes' \| 'no' }` — watchers only, one per attempt, changeable while open |
| `GET /shop` | public — live items, with `bought` for a signed-in reader |
| `POST /shop/:id/buy` | any enrolment; **409** on sold out, over the per-person limit, or not enough coins |
| `GET /shop/purchases/mine` | the reader's purchases |
| `POST /register` | username, password, role, birthDate, optional email |
| `POST /enrolments` | `{ role, birthDate? }` for an existing account |
| `POST /attempts/upload-url` | unlimited per day; requires `assignmentId` (accepted, time left); either clan member for a clan task |
| `POST /attempts/:id/confirm` | closes the assignment if in time; **409** and a burned heart if not |
| `GET /reports/reasons` | public; the catalogue: kinds, reasons, tags, the daily cap and the auto-hide threshold |
| `POST /reports` | `{ targetType, targetId? \| handle?, reason, details?, tags?, context? }` — returns `{ report, hidden }` |
| `GET /reports/mine?limit=` | the caller's reports with `status` and `outcome`; never the internal note |
| `DELETE /reports/:id` | withdraws one that is still on the queue |

Admin (`/api/game/admin`, `@Roles('admin')`):

| route | what |
|---|---|
| `GET /enrolments?status=&role=&limit=` | who is in the live season |
| `POST /enrolments/:id/flag-cheater` | `{ attemptId?, reason? }` — same consequence as the model |
| `POST /enrolments/:id/reinstate` | `{ restore?: boolean }` — the one way back |
| `GET /enrolments/:id/score-ledger?limit=` | every point of Nerve the enrolment gained or lost, newest first |
| `POST /enrolments/:id/score` | `{ delta, reason }` — a correction, through the same movement as everything else; floors at zero, `admin` ledger row with the admin's id |
| `POST /discipline/run` | both sweeps now; returns what each moved |
| `POST /votes/resolve` | resolves every vote whose window has closed, now |
| `GET /shop/items?status=` · `POST /shop/items` · `PATCH /shop/items/:id` | the coin shop's catalogue |
| `GET /shop/purchases?status=&itemId=&limit=` · `PATCH /shop/purchases/:id` | purchases; `cancelled` refunds coins and stock |
| `GET /review` | the queue, each attempt with its `aiVerdict` |
| `POST /attempts/:id/unpublish` | out of the feed, and its Nerve back off the board — a `clawback` row per enrolment it paid |
| `POST /attempts/:id/settle` | `reason` on a rejection is stored as `rejectionReason`; `burnHeart` demotes when it was the last; pays the template's reward on approve (both members for a clan) and charges `penaltyCoins` to a clan on reject; closes an open or deferred vote and pays the correct "yes" voters on approve; records the admin's id as `by` |
| `POST /tasks/generate` | `{ tier, count, avoid?, steer?, mode? }` — the creator/reviewer loop; files drafts, stores every refusal |
| `POST /tasks/:id/review` | runs the reviewer on one stored task; the verdict is kept on the row |
| `POST /tasks/:id/approve` | re-screens, refuses a reviewer-rejected draft, records the approver |

Reports (`/api/game/admin/reports`, `@Roles('admin')`):

| route | what |
|---|---|
| `GET /stats` | counts by status, kind, priority and reason; oldest open wait; hidden counts; the ten most-reported things |
| `GET /?status=&targetType=&targetId=&targetUserId=&reporterId=&reason=&minPriority=&assignedTo=&limit=&offset=` | the queue by default (`queue` = open + reviewing; also `closed`, `all`, or one status); most urgent then oldest |
| `GET /:id` | the report, the target as it is now, its siblings, both parties' history, and the actions that fit |
| `POST /:id/claim` | `{ force? }` — takes it; 409 if another admin holds it |
| `PATCH /:id/priority` | `{ priority }` 0–3 |
| `POST /:id/resolve` | `{ status: resolved \| dismissed, action?, note?, reporterMessage?, includeSiblings?, notifyReporter? }` — runs the action first; closes siblings; tells the people |
| `POST /:id/reopen` | back on the queue as `reviewing` |

## Environment

| variable | default | meaning |
|---|---|---|
| `GAME_DAILY_MINIMUM_TASKS` | `4` | tasks per Tbilisi day to stay a player; `0` disables the sweep |
| `GAME_CHEAT_DETECTION` | `enforce` | `enforce` / `shadow` / `off` |
| `GAME_CHEAT_CONFIDENCE` | `0.85` | 0–1; a `cheating` verdict below it is stored as `suspicious` |
| `GAME_CHEAT_MODEL` | `claude-sonnet-5` | the model the detector calls |
| `GAME_TASK_REVIEWER_MODEL` | `claude-opus-5` | the model the task reviewer calls |
| `GAME_TASK_MAX_ROUNDS` | `3` | creator/reviewer rounds per slot before the slot is dropped (1–10) |
| `GAME_REPORT_AUTO_HIDE` | `5` | distinct accounts with an open report before a hand-in or comment is hidden from the feed; `0` disables |
| `GAME_REPORT_DAILY_CAP` | `20` | reports one account may file in a rolling day |
| `GAME_VOTE_RESOLVER_MODEL` | `claude-sonnet-5` | the model the vote resolver calls; without `ANTHROPIC_API_KEY` every vote is deferred to a person |
| `ANTHROPIC_API_KEY` | — | without it every cheat verdict is `unchecked` / `not_configured`, task generation is disabled, and the reviewer rejects everything (fails closed) |

## Deploying this

Migration `1787330000000-GameReports` is additive: the `game_reports`
table, and `hiddenAt` on `game_attempts` and `game_attempt_comments`
(nullable, never read by older code). Safe on every branch.

Migration `1787320000000-GameShopAndVoting` is additive: `game_enrolments.lastVoteWinAt`,
`game_attempts.votingStatus` (default `none`, `CHK_game_attempts_voting_status`)
/ `votingEndsAt` / `voting`, the `game_attempt_votes`, `game_shop_items` and
`game_purchases` tables, and the ledger's reason CHECK widened for
`vote_reward` and `purchase`. Safe on every branch.

Migration `1787310000000-GameClansAndCoins` is additive:
`game_enrolments.coins` (default `0`, `CHK_game_enrolments_coins`), the
`game_coin_ledger`, `game_clans` and `game_clan_members` tables,
`game_task_templates.mode` / `rewardNerve` / `rewardCoins` / `penaltyCoins`
(defaults `solo`, `0`, `0`, `1`; `CHK_game_task_templates_economy` holds the
penalty at 1–3), and `game_task_assignments.clanId`. Safe on every branch.

Migration `1787300000000-GameTaskReview` is additive:
`game_task_templates.proof` (default `either`) and `.review`, and
`game_generation_rejections.source` / `feedback` / `round`. Safe on every
branch.

Migration `1787290000000-GameTaskClock` is additive: the new
`game_task_assignments` table, `game_attempts.assignmentId`, and
`CHK_game_enrolments_demotion` widened to admit `out_of_hearts`. Safe on
every branch.

Migration `1787280000000-GameDiscipline` **drops
`UQ_game_attempts_enrolment_day`**. The old `requestUpload` reserves a day
with `ON CONFLICT ("enrolmentId", "day")`, and Postgres refuses that clause
the moment no unique index matches it — so any branch still running the old
code breaks on the next upload once the migration has run against the shared
database. Deploy `main` and merge it into `staff`, `admin`, `stage` and
`pre-prod` in the same sitting:

```bash
git checkout staff    && git merge main && git push origin staff
git checkout admin    && git merge main && git push origin admin
git checkout stage    && git merge main && git push origin stage
git checkout pre-prod && git merge main && git push origin pre-prod
```

Everything else in the migration is additive: `users.email` nullable,
`users.birthDate`, the four enrolment columns, and `submittedAt`,
`taskTemplateId`, `aiVerdict`, `aiCheckedAt`, `rejectionReason` on attempts
(`submittedAt` backfilled from `updatedAt` for rows already handed in).
