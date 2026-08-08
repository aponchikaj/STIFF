---
name: roadmap-prioritization
description: "When the user wants to decide what to build next by turning a messy backlog into a strategy-mapped, scored, and honestly ranked roadmap. Triggers: \"roadmap\", \"prioritization\", \"RICE\", \"what should we build next\", \"backlog\", \"feature requests\", \"prioritize features\", \"ICE score\". Covers strategy-first gating, RICE/ICE scoring with a bundled calculator, opportunity-solution trees, allocation guardrails, request intake, cut criteria, and review cadence. For evidence that a problem is real before it enters the roadmap, see customer-interviews. For validating a big bet cheaply first, see idea-validation."
metadata:
  version: 1.0.0
---

# Roadmap Prioritization

Act as a product leader who has run quarterly planning at both a 5-person startup and a 200-person product org, and who knows that prioritization frameworks fail for social reasons before they fail for mathematical ones. The outcome: a ranked roadmap where every item maps to a stated goal, scores are honest enough to argue with, a kill list exists in writing, and the team knows why the top item beat the second one.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it likely covers positioning, target segment, and current strategic goals. Only ask what it doesn't answer. Then ask 3–5 grouped questions:

1. **Product stage** — Pre-launch, early traction, or scaling? Do you have usage analytics, or are reach numbers going to be guesses? (This decides RICE vs ICE.)
2. **Strategy and goal** — What are the 1–3 goals for this quarter, stated as outcomes ("cut churn from 6% to 4%"), not themes ("improve retention")? If there are none, stop and fix that first.
3. **Backlog state** — How many candidates? Where do they come from (customer requests, sales, internal ideas, debt)? Has anything been deduplicated?
4. **Team capacity** — How many person-weeks per quarter actually go to roadmap work, after support, maintenance, and meetings? Most teams overestimate by 30–40%.

## The strategy gate comes before any scoring

Prioritization without a strategy is averaging opinions — the framework just launders the averaging into a spreadsheet. Before scoring anything, add a "which goal does this serve" column and force every candidate through it:

| Candidate | Which goal does this serve? | Verdict |
|---|---|---|
| Bulk CSV export | Reduce churn (top-3 churn reason in exit surveys) | Score it |
| Dark mode | None stated — "users asked" | Park it or map it |
| SSO | Move upmarket ($30k+ deals blocked without it) | Score it |

Two failure signals:

- **An item maps to nothing** → it doesn't get scored. Park it until a goal claims it.
- **Every item maps to every goal** → the strategy is too vague to prioritize against. "Delight users" accepts anything; "get 100 teams to weekly active" rejects most things. Rewrite the goals, then come back.

## RICE mechanics

Score = (Reach × Impact × Confidence) / Effort. The bundled script computes and ranks:

```
node scripts/rice-score.js roadmap.csv        # RICE from CSV or JSON
node scripts/rice-score.js --ice ideas.csv    # ICE mode
```

(Usage comment at the top of `scripts/rice-score.js` documents file formats and inline args.)

| Factor | Definition | How to fill it in |
|---|---|---|
| Reach | Users (or events) affected per quarter | Pull from analytics: "1,200 users hit this screen monthly × 3". Never a round guess — a guessed reach poisons the whole score |
| Impact | Effect per reached user | 3 = massive, 2 = high, 1 = medium, 0.5 = low, 0.25 = minimal. Anchor to the goal metric, not general excitement |
| Confidence | How much evidence backs reach and impact | 100% = shipped-something-like-this data, 80% = strong signal, 50% = informed hunch. Below 50%: don't score — go get evidence first (see customer-interviews) |
| Effort | Total person-weeks across all disciplines | Include design, QA, and rollout, not just engineering |

Example: reach 1,200 users/quarter × impact 2 × confidence 80% ÷ 4 person-weeks = **480**.

### RICE vs ICE

| | RICE | ICE |
|---|---|---|
| Inputs | Reach, Impact, Confidence, Effort | Impact, Confidence, Ease — each 1–10, multiplied |
| Needs | Usage data for reach | Nothing but judgment |
| Best for | Post-launch products with analytics | Pre-launch, early stage, or triaging 50 ideas in an hour |
| Cost | ~10 min per item done honestly | ~1 min per item |
| Weakness | Garbage reach in, garbage rank out | No reach term — a niche feature can outscore a universal one |

Rule of thumb: ICE to cut 50 ideas to 10, RICE to rank the 10 — provided you have the data.

## Scoring honesty rules

Scores rank conversations; they don't make decisions. Enforce these:

- **A 2× score gap is signal; a 20% gap is noise.** 480 vs 460 means "discuss these two as peers", not "the first one wins". The script flags this automatically.
- **Score with the team, not solo.** Have 3–4 people score independently, then compare. When one person says impact 3 and another says 0.5, the divergence IS the insight — it surfaces a hidden assumption ("you think enterprise users will use this; I think only trials will"). Resolve the assumption, not the average.
- **Counter the two standard gaming moves.** Sandbagging effort ("it's only 2 weeks") and inflating impact ("this is a 3, definitely") are how pet projects win. The antidote is reference-class comparison: "Is this really bigger than the onboarding revamp we shipped in March? That was a 2 and moved activation 4 points." Keep a short list of shipped items with their actual impact and effort as calibration anchors.

## Opportunity-solution tree

When the backlog is feature requests rather than problems, rebuild it top-down before scoring:

1. **Outcome** — the quarterly goal metric ("raise week-4 retention from 22% to 30%").
2. **Opportunities** — problems and needs surfaced by research, mapped under the outcome ("users can't find their data after import", "no reason to return before Monday").
3. **Solutions** — 2–3 candidate solutions per opportunity, not one. A single solution per problem means you're rationalizing, not exploring.
4. **Cheapest test** — for each solution, the fastest way to learn if it works: a prototype, a fake-door, a concierge version.

Then score solutions, not raw requests. This keeps the roadmap tied to validated problems instead of feature-request roulette — and it's why "add a dashboard" loses to "users can't see if the product is working," which might be solved by a weekly email.

## Allocation guardrails

Balance buckets before ranking within them — otherwise growth work and debt always lose to feature work with countable reach:

| Bucket | Starting split | What goes here |
|---|---|---|
| Core value | 50–60% | Features and fixes that deepen the main job-to-be-done |
| Growth + debt | 20–30% | Acquisition/activation work, infrastructure, tech debt |
| Bets | 10–20% | High-uncertainty, high-upside experiments |

Adjust for stage (pre-PMF skews harder to core value and bets), but never let a bucket hit zero. A roadmap that's 100% feature work silently accrues debt until velocity halves — and by then the fix costs 2–3 quarters instead of 2–3 weeks. Rank with RICE *within* each bucket, not across buckets.

## Request intake discipline

- **Dedupe requests to underlying problems.** Five asks for "export to Excel" may be one reporting problem — and the best solution might be scheduled reports, not export. Tag every request with the problem behind it before it enters the backlog.
- **Weight by segment value, not vote count.** 40 votes from free users can matter less than 3 from the segment your strategy targets. Record who asked, their plan, and their revenue.
- **Publish "now / next / later", never dates.** Dates on discovery-stage items are fiction — you don't know the effort of things you haven't scoped. "Now" is committed, "next" is likely, "later" is direction.

## Cut criteria

The kill list is the roadmap's most important output — capacity comes from what you stop, not what you defer. Cut:

- **Below-threshold scores** — anything under roughly a third of the top score, unless a bucket guardrail protects it.
- **Zombie projects** — items that have sat "next quarter" for more than 2 quarters. They will never be a priority; stop pretending.
- **Sunk-cost bets** — "we've already invested 8 weeks" is an argument for killing, not continuing, if the remaining cost exceeds the remaining value.

Write a one-line kill rationale for each ("Killed 2026-Q3: reach was 40 users/quarter, all on legacy plan"). Undocumented kills resurrect in the next planning cycle and get re-litigated from scratch.

## Workflow

1. Read `.agents/product-marketing.md` if present; ask the Before Starting questions for gaps.
2. Confirm 1–3 quarterly goals stated as measurable outcomes. If goals are vague or absent, fix that before touching the backlog.
3. Intake: dedupe requests to underlying problems, tag each with requester segment and value.
4. Gate: map every candidate to a goal. Park unmapped items; if everything maps to everything, send the goals back for rewrite.
5. Pick the framework: ICE if pre-launch or triaging a large list; RICE if usage data exists. Gather real reach numbers before scoring.
6. Score independently with 2–4 people, run `scripts/rice-score.js`, then reconcile divergent scores by surfacing the assumptions behind them.
7. Apply bucket guardrails (50–60 / 20–30 / 10–20 starting split); re-rank within buckets against actual capacity in person-weeks.
8. Anything under 50% confidence near the top: route to customer-interviews for evidence, or design the cheapest test from its opportunity-solution branch (see idea-validation for big bets).
9. Write the kill list with one-line rationales.
10. Publish now/next/later and set cadence: quarterly strategy review, monthly re-rank. Weekly re-ranking is churn, not planning — items need time to prove or disprove themselves.

## Common Mistakes

1. **Scoring before strategy.** Without goals, RICE averages the loudest opinions with three decimal places of false precision. Fix: run the strategy gate first; refuse to score unmapped items.
2. **Guessed reach dressed as data.** "About 5,000 users" invented in the meeting corrupts every downstream rank. Fix: pull reach from analytics; if you can't, you're in ICE territory — admit it.
3. **Treating a 10–20% score gap as a decision.** 480 vs 460 is a coin flip with extra steps. Fix: treat anything within ~20% as tied; decide ties with strategy fit and sequencing, not decimals.
4. **Solo scoring.** One person's spreadsheet encodes one person's assumptions, and the team never sees them. Fix: independent scores from 3–4 people; mine the divergence.
5. **Ranking across buckets instead of within.** Debt and bets lose to features every time because their reach is hard to count. Fix: allocate buckets first, rank within.
6. **Dates on discovery-stage roadmap items.** A date on an unscoped item becomes a commitment sales repeats to customers. Fix: now/next/later externally; dates only for committed, scoped work.
7. **Counting votes instead of weighing segments.** Vote-count prioritization builds for whoever fills out forms, not whoever pays. Fix: weight requests by segment value against the strategy.
8. **Deferring instead of killing.** A 6-quarter "later" list is a morgue everyone re-argues each cycle. Fix: kill with written rationale; a real "later" list stays under ~15 items.

## Output Format

Deliver the prioritization as:

1. **Goals block** — the 1–3 quarterly outcomes candidates were gated against.
2. **Ranked table per bucket** — from `rice-score.js` output: rank, item, goal served, reach, impact, confidence, effort, score. Flag sub-50%-confidence items with their evidence plan.
3. **Now / next / later roadmap** — no dates; one line per item on why it earned its slot.
4. **Kill list** — each cut item with its one-line rationale.
5. **Open assumptions** — the 2–3 biggest score divergences from team scoring and what evidence would resolve each.
6. **Cadence note** — date of next monthly re-rank and quarterly strategy review.

Keep the whole deliverable scannable in under 5 minutes — a roadmap nobody reads ranks nothing.
