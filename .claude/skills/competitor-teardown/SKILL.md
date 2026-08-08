---
name: competitor-teardown
description: "When the user wants to research competitors and turn what rivals do into a feature, pricing, and messaging matrix they can act on. Triggers: 'competitor analysis', 'competitive landscape', 'teardown', 'who are my competitors', 'positioning map', 'what do rivals charge', 'competitive matrix'. Covers competitor classification (direct/indirect/status-quo), a research source playbook, jobs-to-be-done feature and pricing matrices, positioning maps, review-mining gap analysis, and an ongoing watch cadence. For turning differences into positioning, see product-marketing. For pricing responses, see pricing. For whether the market is worth entering at all, see idea-validation."
metadata:
  version: 1.0.0
---

# Competitor Teardown

Act as a competitive intelligence analyst who has run teardown programs at B2B SaaS companies — someone who knows that most "competitive analysis" is a screenshot dump that flatters the home team, and that a useful teardown is a small, current, evidence-linked matrix that changes a roadmap or pricing decision. The outcome of this skill is a bounded competitor set, a filled per-competitor teardown (use `assets/teardown-template.md`), a comparison matrix, a positioning map, and a gap analysis with named opportunities — each claim traceable to a link.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it likely already defines the product, segment, and known rivals. Only ask what it doesn't cover. Ask these grouped questions (3–5, batched, not one at a time):

1. **Product and buyer**: What does the product do, in one sentence, and who writes the check? What job does the buyer hire it for?
2. **Known field**: Which competitors come up in sales calls or in the user's head? Which ones have they actually lost deals to (different lists, usually)?
3. **Decision at stake**: What will this teardown change — roadmap, pricing, homepage messaging, a fundraise slide? The output format bends to the decision.
4. **Stage and market heat**: Pre-launch or in-market? Is the category stable (CRM) or moving monthly (AI tooling)? This sets research depth and watch cadence.
5. **Constraints**: Any competitors off-limits (partners, acquirers in talks)? Any prior teardown to refresh instead of rebuild?

## Competitor Classification

Classify before researching, because each class gets different treatment and the set must stay small.

| Class | Definition | Example | What to extract |
|---|---|---|---|
| Direct | Same job, same buyer, shows up in the same deals | Another invoicing SaaS for freelancers | Full teardown: features, pricing, messaging, GTM |
| Indirect | Same job, different form | An accountant who also invoices | Why buyers pick it anyway; the switching trigger |
| Status quo | Spreadsheet, email, an intern, doing nothing | Excel + a Stripe payment link | Why "good enough" holds; the cost of staying |

The spreadsheet-and-intern alternative is usually the real competitor — in most early markets more deals are lost to "we'll keep doing it manually" than to any named rival. Give status quo a row in every matrix.

Cap the set at 3–5 direct and 2–3 indirect competitors. Beyond that you get analysis paralysis: research time grows linearly, insight doesn't, and the matrix becomes unreadable. If more than 5 direct candidates exist, rank by deal overlap (who you actually lose to) and cut.

Two edge cases worth deciding explicitly: a platform giant with an adjacent feature (Notion has databases; is it a CRM competitor?) is direct only if buyers name it in deals — otherwise it's indirect, tracked but not torn down; and a competitor two segments up-market (enterprise-only, $50k floor) usually belongs on the watch list, not in the matrix, until their hiring or pricing shows down-market movement.

## Research Sources

Work down this table per competitor. Each source answers a different question; the changelog and job postings are the two most underused.

| Source | What it reveals | How to read it |
|---|---|---|
| Their website + pricing page | Claimed positioning, packaging, entry price | Pull the one-liner and tier names verbatim; note what the pricing page hides ("Contact us") |
| Changelog / release notes | Shipping velocity and direction | Count releases per quarter; 12 releases/quarter vs 2 is a strategy signal, not trivia |
| Job postings | Next 6–12 months of strategy | Hiring 3 ML engineers or a first enterprise AE tells you where they're going before their site does |
| G2 / Capterra reviews | Unmet needs, in the customer's words | Mine the 2–3 star reviews — 5-star is marketing, 1-star is rage; the middle says "great, except..." and the "except" is your opening. Quote verbatim |
| Community mentions (Reddit, HN, niche Slacks/forums) | Unfiltered sentiment, switching stories | Search "[name] alternative" and "switched from [name]" |
| Product signup | Actual onboarding, real feature depth | Only where ToS permits; screenshot the first-run experience and the paywall placement |
| archive.org on the pricing page | Pricing history and packaging drift | Two or three price raises in 24 months signals pricing power; a plan that vanished signals a failed bet |

Log a source link for every claim as you go. An unevidenced matrix cell is an opinion.

## Matrix Construction

Build one comparison matrix across the set, backed by a filled `assets/teardown-template.md` per competitor.

**Feature rows are jobs-to-be-done, not feature names.** Write "collects payments," not "Stripe integration" — feature names make the matrix a spec-sheet contest and hide the fact that two different features can do the same job. 8–15 job rows is plenty. Score each cell:

| Score | Meaning |
|---|---|
| Have | Does the job well; a customer would rely on it |
| Partial | Exists but limited — workaround-grade, add-on priced, or buried |
| None | Doesn't do the job |

**Pricing columns**: model (per-seat / usage / flat / hybrid), entry price (the real number, e.g., $29/user/mo — "affordable" is not data), expansion mechanics (what makes the bill grow: seats, usage tiers, add-ons), and discounting behavior (annual %, negotiability signals from reviews and forums).

**Messaging columns**: their homepage one-liner pulled verbatim, target segment as they name it, and claimed differentiators in their words. Verbatim matters — paraphrase smuggles in your bias, and the exact words are what your prospect reads.

A worked excerpt, invoicing tools for freelancers (illustrative numbers):

| Job-to-be-done | Us | FreshBooks | Wave | Status quo (Excel + Stripe link) |
|---|---|---|---|---|
| Collects payments | Have | Have | Have | Partial (manual link per invoice) |
| Chases late payers automatically | Have | Partial (add-on tier) | None | None |
| Tracks billable time | None | Have | None | Partial (a second spreadsheet) |
| Handles multi-currency clients | Partial | Have | Partial | None |

| Pricing | Us | FreshBooks | Wave | Status quo |
|---|---|---|---|---|
| Model | flat | per-tier by client count | free + payment fees | $0 + payment fees |
| Entry price | $15/mo | $19/mo | $0 | $0 |
| Expansion | none | client-count tiers, team seats | payment volume | none |
| Discounting | none | ~10% annual, frequent promos | n/a | n/a |

Two readings fall out immediately: the status-quo column explains why $0 keeps winning deals, and the "chases late payers" row is the only clean differentiator — which is a messaging decision, not just a roadmap fact.

## Positioning Map

1. Pick two axes customers actually weigh when choosing — price vs. depth, self-serve vs. sales-led, all-in-one vs. best-of-breed. Reject axes where everyone clusters at one end ("modern," "easy to use"); a map with no spread is decoration.
2. Plot every direct competitor plus status quo, using matrix data, not vibes — entry price and sales motion are observable.
3. Read the empty quadrant with suspicion. It is either an opportunity or a graveyard — cheap-and-deep may be empty because deep costs money to build and cheap can't fund it. Before building toward an empty quadrant, test which it is via idea-validation.

## Gap Analysis

The teardown earns its keep here — matrices describe, gaps decide. Produce three artifacts:

**Underserved segments and needs**, sourced from 2–3 star review mining. Format each as a quote plus a count, so frequency is visible:

| Unmet need (verbatim quote) | Who says it | How often | Which competitors fail it |
|---|---|---|---|
| "great, but reports take forever to build" | ops managers, 10–50 seats | 14 of 60 mid-star reviews | FreshBooks (Partial), Wave (None) |

One loud reviewer is an anecdote; the same complaint across a dozen reviews of two competitors is a segment.

**Table-stakes vs. differentiators**, splitting your own gap list by what the matrix shows:

| Bucket | Rule | Action |
|---|---|---|
| Table-stakes you're missing | Every direct competitor scores Have; you score Partial/None | Build to parity, ship quietly — nobody buys because of it, but they disqualify you without it |
| Differentiators worth building | Maps to a mined unmet need; rivals score Partial/None | Build and message loudly — this is the row product-marketing turns into a story |
| Ignorable | Rivals have it, no review evidence anyone cares | Skip; matching it is spec-sheet vanity |

**Flanking options**, when head-on parity is unwinnable: go cheaper/simpler for a segment the incumbents overserve (their $99 tier forces features a solo user never touches), or go premium for a segment they underserve (the "except it can't handle X at scale" reviewers). Name the segment, the price point, and the review evidence for each flank you propose.

## Workflow

1. Read `.agents/product-marketing.md` if present; ask the Before Starting questions for what's missing.
2. Build the long list of candidates (user's list, "alternative to" searches, G2 category pages), then classify and cut to 3–5 direct + 2–3 indirect + status quo.
3. Research each competitor through the source table, filling one `assets/teardown-template.md` per competitor, evidence links inline.
4. Construct the comparison matrix: JTBD feature rows scored have/partial/none, pricing columns, verbatim messaging columns. Include a status-quo column.
5. Draw the positioning map on two customer-weighed axes; flag the empty quadrant as untested.
6. Run the Gap Analysis section: quote-and-count unmet needs, split table-stakes from differentiators, name flanking options with evidence.
7. Apply the honest-broker pass (below), then set the watch cadence and deliver in the Output Format.

## Watch Cadence

A teardown decays — direction matters more than snapshots. A competitor at $49 heading down-market is a different threat than one at $49 heading up.

| Market tempo | Refresh | Also set up |
|---|---|---|
| Stable (mature category, quarterly releases) | Quarterly | Change alerts on each pricing page and changelog URL |
| Hot (AI tooling, new funding in the space, monthly ships) | Monthly | Alerts plus a skim of new G2 reviews and job postings |

Keep a change log per competitor (template has a section): date, what changed, source link, what it signals. Three log entries reveal a trajectory no single snapshot can:

| Date | Change | Signal |
|---|---|---|
| 2026-02 | Entry tier $19 → $29 | Testing pricing power, or funding pressure |
| 2026-05 | "Starter" plan removed; "Contact us" added to top tier | Moving up-market |
| 2026-07 | 4 enterprise-AE postings, first SOC 2 page | Confirms up-market shift — the low end is opening up |

Any one row is ambiguous; the three together are a strategy you can flank.

## Honest-Broker Rules

- Steelman every competitor: for each, write the strongest honest case for why a rational buyer picks them. A teardown that concludes "we win everywhere" is propaganda, not analysis — and it will be falsified in the first competitive deal.
- Name what each competitor does genuinely better, and mark what you concede (won't match) vs. must fix. Conceding on purpose is strategy; conceding by omission is a lost deal.
- Distinguish observed (screenshot, review quote, changelog entry) from inferred (job-posting reading, growth guesses). Label inferences as such.
- Never fabricate a data point to complete a matrix cell. Write "unknown — verify via [source]" instead; a false Have on a rival's row misdirects the roadmap.

## Common Mistakes

1. **Ignoring the status quo.** The matrix compares five SaaS tools while 70% of the market uses a spreadsheet. Fix: give status quo a column and write down why "good enough" holds.
2. **Feature-name rows.** "Has Zapier integration: yes/no" hides that a native automation does the same job. Fix: rows are jobs — "connects to the rest of the stack" — scored have/partial/none.
3. **Unbounded competitor sets.** Fifteen competitors, three weeks of research, no decision made. Fix: cap at 3–5 direct + 2–3 indirect, ranked by actual deal overlap; park the rest on a watch list.
4. **Mining only the extremes of reviews.** 5-star reviews are marketing; 1-star are shipping-and-support rage. Fix: the 2–3 star middle is where "great product, but it can't do X" lives — quote X verbatim.
5. **"We win everywhere" conclusions.** Every cell green for you means the analysis was scored by the home team. Fix: apply the steelman rule; a credible teardown concedes something.
6. **Snapshot thinking.** One-time analysis, stale in a quarter, silently wrong thereafter. Fix: set the watch cadence, alert on pricing/changelog URLs, log direction of change.
7. **Paraphrased messaging.** "They target enterprises" when their homepage says "for growing teams." Fix: pull one-liners, segments, and differentiators verbatim with links.
8. **Treating the empty quadrant as automatic opportunity.** Nobody sells cheap-and-deep — maybe because it's a graveyard. Fix: route the hypothesis through idea-validation before betting the roadmap on it.

## Output Format

Deliver, in order:

1. **Competitor set** — table: name, class (direct/indirect/status-quo), one-line why-included, deal-overlap evidence.
2. **Per-competitor teardowns** — one filled `assets/teardown-template.md` per direct competitor (lighter fills for indirect); every claim linked.
3. **Comparison matrix** — JTBD rows × competitors (status quo included), have/partial/none scoring; pricing block (model, entry price, expansion, discounting); messaging block (verbatim).
4. **Positioning map** — the two axes with a sentence justifying each, plotted positions, empty-quadrant note flagged opportunity-or-graveyard (untested).
5. **Gap analysis** — underserved needs with verbatim review quotes; table-stakes-missing vs. differentiators-worth-building; flanking options.
6. **Concessions** — what each rival does genuinely better; concede vs. must-fix.
7. **Watch plan** — cadence, alert URLs, change-log location, next refresh date.

Route follow-ups: sharpening the story around the differences → product-marketing; responding on price → pricing; deciding whether the market is worth entering at all → idea-validation.
