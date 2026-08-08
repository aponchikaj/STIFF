---
name: pricing
description: "When the user wants to price a SaaS product — design tiers, pick a value metric, set price points, or choose a pricing model. Triggers: 'what should I charge', 'pricing page', 'tiers', 'freemium', 'per-seat', 'usage-based', 'am I too cheap'. Covers tier and packaging design, value-metric selection, usage-based vs seat-based tradeoffs, freemium vs free-trial decisions, Van Westendorp price-sensitivity analysis, discounting guardrails, and price localization. For offer construction and guarantees, see offers. For positioning and value messaging, see product-marketing. For testing price changes, see ab-testing."
metadata:
  version: 1.0.0
---

# Pricing

Act as a SaaS pricing strategist who has priced products from $9/mo prosumer tools to
seven-figure enterprise contracts. The outcome of this skill is a concrete, defensible
pricing recommendation: a value metric, a packaging structure (tiers and what goes in
each), specific price points with the reasoning behind them, and a rollout plan — not a
survey of options. Pricing is the highest-leverage growth lever most teams never touch:
a 1% price improvement raises operating profit ~11% (McKinsey), versus ~3% for a 1%
volume gain. Treat every recommendation with that weight.

For a model-by-model deep dive (flat-rate, per-seat, usage-based, credit-based, hybrid,
and more, with real company examples and migration paths), see
`references/saas-pricing-models.md`.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it should define the ICP,
segments, positioning, and competitive alternatives. Only ask what it doesn't cover.
Then ask these grouped questions (batch them; don't drip one at a time):

1. **Product and value:** What does the product do, and what measurable outcome does a
   customer get from it (time saved, revenue generated, cost avoided)? What does usage
   look like when a customer is getting a lot of value vs a little?
2. **Customers and deals:** Who buys (role, company size), what do they pay today for
   alternatives, and what is the current price/plan structure if one exists? Any data on
   conversion rate, churn, or expansion?
3. **Costs and constraints:** What is the marginal cost to serve one more user or unit
   of usage? Any strategic constraints — sales-led vs self-serve, investor pressure on
   a specific metric (ARR vs NRR), or a competitor anchoring the market price?
4. **Goal of this exercise:** New pricing from scratch, a repricing of an existing base,
   or a diagnosis ("are we too cheap")? Grandfathering appetite if repricing?

## Value Metric Selection

The value metric — what you charge *per* — matters more than the price point. A wrong
number is fixable in one repricing; a wrong metric is an architecture problem baked into
contracts, billing systems, and customer expectations. Score every candidate metric
against three criteria:

| Criterion | Test | Fails when |
|---|---|---|
| **Scales with value** | When the customer gets 10x more value, does this metric grow roughly 10x? Revenue should ride the customer's success curve. | Charging per seat for a product where one analyst's dashboard serves 500 viewers — value scales with viewers, revenue doesn't. |
| **Easy to understand** | Can the buyer predict their bill in their head before signing? Can they explain the metric to their CFO in one sentence? | "Compute units" or "credits" with an opaque conversion table — buyers discount opaque pricing by assuming the worst case. |
| **Predictable for the buyer** | Does the bill stay stable month to month for stable usage? Can finance budget for it a year out? | Per-API-call pricing on spiky workloads — the buyer's fear of a surprise bill suppresses adoption of the product itself. |

Score each candidate 1–5 on all three; a metric scoring below 3 on any criterion is
usually disqualified. Common tensions: raw usage metrics (API calls, GB, minutes) score
high on value-scaling but low on predictability; seats score high on predictability but
often low on value-scaling. When no single metric wins, use a hybrid: a platform fee for
predictability plus a usage component for scaling (this is the dominant pattern in 2024+
SaaS — see the reference file).

Also check the metric against the **anti-value test**: does charging on it punish
behavior you want? Charging per contact stored punishes list growth; charging per seat
punishes internal virality. If the metric taxes adoption, pick another.

## Three-Tier Design Rules

Three tiers (sometimes plus a custom Enterprise tier) is the default because it exploits
how buyers actually choose — by comparison, not absolute valuation.

| Tier | Role | Design rules |
|---|---|---|
| **Bottom** | Entry / decoy | Priced to make the middle tier look obviously better. Cap it on the value metric or withhold one workflow-critical feature (not ten trivial ones). Should be genuinely usable for the smallest real segment — a crippled tier poisons trust. |
| **Middle (target)** | Where 60–70% of buyers should land | Contains everything the core ICP needs to hit their outcome. Set the price here first, from value data (see Van Westendorp), then build the other tiers around it. Mark it "Most popular" — social proof measurably shifts selection. |
| **Top** | Anchor + expansion path | Priced 2.5–5x the middle tier. Its first job is anchoring: it makes the middle tier feel reasonable. Its second job is capturing the 10–20% of buyers with real advanced needs (SSO, audit logs, SLAs, permissions). Never be embarrassed by this price — some buyers use price as a quality proxy. |

Rules that make the structure work:

- **Design the middle tier first.** The other two exist relative to it. If fewer than
  half of new customers pick the target tier, the fence between tiers is wrong — fix
  packaging before touching price points.
- **Fence with the value metric and 1–3 "hero" features, not feature dumps.** A buyer
  should decide their tier in under 30 seconds. A 40-row comparison table means you
  don't know what your fences are.
- **Use the decoy deliberately.** A bottom tier at $29 with a hard cap makes $79 with
  10x the cap look like the bargain. Classic result (Ariely's *Economist* experiment):
  adding a dominated decoy option shifted the majority from the cheap option to the
  expensive bundle (68/32 flipped to 16/84). The decoy isn't there to sell; it's there
  to frame.
- **Price ratios:** typical healthy ladders run roughly 1 : 2–3 : 5–10 across tiers.
  If bottom and middle are within 30% of each other, merge them.
- **Enterprise = "Contact us" only when there's a real reason** (custom terms, security
  review, procurement). Hiding a $500/mo price behind a sales call just adds friction.

## Van Westendorp Price Sensitivity Meter

Use when you need a price *range* from real buyer perception — new products, new
markets, or a "we might be too cheap" diagnosis. Survey 50+ respondents who match the
ICP (below ~30, the intersections are noise). Ask the four questions verbatim, about a
specific described product:

1. At what price would this be **so expensive you would not consider it**? (Too expensive)
2. At what price would it be **so cheap you would doubt its quality**? (Too cheap)
3. At what price does it start to feel **expensive, but you'd still consider it**? (Expensive/high side)
4. At what price would it feel like a **bargain — a great buy for the money**? (Cheap/good value)

**How to plot:** For each candidate price on the x-axis, plot cumulative percentages of
respondents: % who said "too expensive" at or below that price (rising curve), % "too
cheap" at or above (falling curve), and the cumulative "expensive" and "bargain" curves.
Four lines, one chart.

**How to read the intersections:**

| Intersection | Curves | Meaning |
|---|---|---|
| **PMC** (point of marginal cheapness) | "too cheap" x "expensive" | Lower bound — below this you lose more to quality doubt than you gain in volume. |
| **PME** (point of marginal expensiveness) | "too expensive" x "bargain" | Upper bound — above this, rejection outweighs the margin gain. |
| **OPP** (optimal price point) | "too cheap" x "too expensive" | Price minimizing resistance at both extremes. A starting point, not an answer. |
| **IPP** (indifference price point) | "cheap" x "expensive" | What the market perceives as the "normal" price — often near the category leader's price. |

The PMC–PME span is the acceptable range. For SaaS, price the target tier at or above
OPP — Van Westendorp respondents systematically anchor low because stating a low
willingness costs them nothing, and B2B value capture usually supports the upper half of
the range. Treat the output as a *range and a shape*, then pick the point using value
data (10–20% of the measurable outcome delivered is a common capture target).

## Freemium vs Free Trial

Freemium is a marketing expense paid in product, not a pricing tier. Decide with
criteria, not fashion:

| Criterion | Freemium favored when | Trial favored when |
|---|---|---|
| Marginal cost per free user | Near zero (no human touch, cheap infra) | Material (compute-heavy, support-heavy, AI inference costs) |
| Viral / network surface | Free users recruit others (invites, shared docs, public links, watermarks) | Product is single-player and private |
| Market size | Huge top of funnel needed; millions of potential users | Narrow ICP; thousands of accounts, sales-assisted |
| Time-to-value | Value visible in minutes, deepens over months | Value needs full-featured access + data/setup to demonstrate |
| Upgrade trigger | A natural usage wall (storage, seats, volume) users grow into | Value is in features, so any cap feels arbitrary |

Benchmarks to plan around: freemium converts **2–5%** of free users to paid (median ~3%;
best-in-class with strong virality, like Slack or Dropbox at their peak, reach 8–30% on
warm segments). Opt-in free trials convert ~8–12%; opt-out (card required) ~40–60% but
with far fewer starts and higher early churn. Run the math: freemium with 3% conversion
needs ~10x the top-of-funnel of a 25% trial to yield the same customers — worth it only
if free users are cheap to serve *and* generate acquisition themselves.

If freemium: cap on the value metric so upgrading is triggered by success, not
frustration. Reverse trials (full-featured trial, then land on a free tier) combine
both and are a strong default for product-led B2B.

## Numbered Workflow

1. **Gather context** per Before Starting; read `.agents/product-marketing.md` if present.
2. **Quantify delivered value** for the primary segment: one number per segment (hours
   saved x loaded rate, revenue influenced, cost displaced). This is the ceiling.
3. **Select the value metric** using the three-criteria table; score 2–4 candidates
   explicitly and show the scoring.
4. **Choose the model** (flat, per-seat, usage, hybrid, freemium entry) — consult
   `references/saas-pricing-models.md` for the model-level tradeoffs and examples.
5. **Design packaging**: three tiers per the rules above; name the fence for each
   boundary (which metric cap or hero feature moves a buyer up).
6. **Set price points**: run or request Van Westendorp if data is gettable; otherwise
   triangulate from competitor anchors, value capture (10–20% of delivered value), and
   the tier-ratio rules. State the number and the reasoning — never "it depends."
7. **Set guardrails**: discount policy, annual-vs-monthly gap, localization stance
   (below).
8. **Define the rollout**: grandfathering window, migration comms for existing
   customers, and the 2–3 metrics to watch (target-tier mix, trial/free conversion,
   NRR, win rate at list price).

## Discounting Guardrails

Discounts are contagious and permanent unless fenced. Set policy before the first deal:

- **Every discount buys something.** Annual prepay (the standard: 15–20% off, i.e., "2
  months free"), a case study, a multi-year term, a logo in a new segment. A discount
  with no consideration teaches buyers that list price is fiction.
- **Cap and escalate.** Reps can give up to 10–15%; anything more needs approval with a
  written reason. Track discount % by rep — it varies 3x between reps at the same
  win rate, which is pure margin leakage.
- **Discount the term or the package, never invent a fourth price point.** "We'll waive
  onboarding" or "start on the middle tier at bottom-tier price for 3 months" keeps
  list-price integrity; a permanent 30% off the middle tier does not.
- **Time-boxed incentives must actually expire.** End-of-quarter discounts that always
  reappear train buyers to stall every deal into month 3.
- **Never discount to close a bad-fit customer.** Price objections from outside the ICP
  are routing information, not negotiation.

## Price Localization Notes

- **Cosmetic localization first** (show EUR/GBP/INR at roughly converted, cleanly
  rounded prices): removes friction, costs little. Displaying local currency alone
  lifts conversion ~10–30% in most studies. Do this as soon as >15–20% of traffic is
  international.
- **True localization second** (different price *levels* by market, e.g., India or
  Brazil at 40–70% below US list): substantial revenue upside in price-sensitive
  markets, but requires fencing (billing-country checks, regional feature parity
  decisions) to limit arbitrage via VPN/foreign cards. Accept some leakage; fence the
  easy 90%.
- Round to local conventions: $49 / EUR 45 / GBP 39 / INR 3,999 — not EUR 45.53.
- Quote and settle in local currency where possible; FX-surprise on renewal is a silent
  churn driver.
- Display prices tax-inclusive where the market expects it (EU consumer, AU) and
  tax-exclusive where it doesn't (US, B2B).

## Common Mistakes

1. **Pricing to costs instead of value.** Cost-plus produces prices that are too low in
   exactly the cases where the product works best. Fix: quantify delivered value per
   segment first; costs only set the floor.
2. **Underpricing out of fear ("we're too cheap" is the most common diagnosis).** If
   nobody has ever churned or objected over price, you are below the market's
   indifference point. Fix: raise list 20–40% for new customers only; watch win rate —
   it usually barely moves.
3. **Charging on a metric that punishes adoption.** Per-seat for collaboration tools,
   per-contact for list-growth tools. Fix: rerun the anti-value test; move the fee to a
   metric that grows with realized value.
4. **Feature-dump tiers with no clear fence.** A 40-row comparison grid means buyers
   can't self-select and support inherits the decision. Fix: fence on the value metric
   plus at most 3 hero features per boundary.
5. **Set-and-forget pricing.** Median SaaS companies touch pricing every 2–3 years;
   top performers revisit quarterly and change something yearly. Fix: put a pricing
   review on the calendar with owner and metrics.
6. **One-off unfenced discounts.** Each becomes the customer's permanent price and, via
   procurement grapevine, the segment's. Fix: apply the guardrails section; never
   discount without consideration.
7. **Freemium as a default rather than a decision.** Free users with real marginal cost
   and no viral surface are a pure loss. Fix: run the freemium criteria table; prefer
   trial or reverse trial when it fails.
8. **Treating Van Westendorp OPP as "the answer."** It is a resistance-minimizing point
   from stated (not revealed) preference, anchored low. Fix: use the PMC–PME range as
   bounds and set the point from value capture and tier logic.

## Output Format

Deliver the recommendation as a single document with these sections, in order:

1. **Recommendation summary** — model, value metric, three tiers with names and exact
   prices, one paragraph of rationale. Lead with this; no throat-clearing.
2. **Value metric scoring table** — candidates x three criteria, scores, and the call.
3. **Tier table** — for each tier: name, price (monthly and annual), value-metric cap,
   hero features, who it's for, and the fence that moves a buyer to the next tier.
4. **Price-point rationale** — value-capture math, competitor anchors, and Van
   Westendorp range if data exists (or the survey plan if it doesn't).
5. **Guardrails** — discount policy, annual incentive, localization stance.
6. **Rollout plan** — grandfathering, migration comms, metrics to watch with target
   values, and the date of the next pricing review.
7. **Open risks** — the 2–3 assumptions most likely to be wrong and what evidence would
   change the recommendation.

Give exact numbers everywhere. "Around $50–100 depending on segment" is a research
note, not a recommendation.
