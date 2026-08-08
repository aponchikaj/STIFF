---
name: ab-testing
description: "When the user wants to design, size, run, or interpret an A/B experiment and decide whether a result is trustworthy. Triggers: \"A/B test\", \"split test\", \"is this result real\", \"statistical significance\", \"sample size\", \"MDE\", \"experiment design\", \"which variant won\". Covers hypothesis structure, primary and guardrail metrics, MDE and sample-size math, run-length rules, the peeking problem, SRM checks, and reading a results table into a ship/kill decision. For what to test on a page, see cro. For pricing experiments, see pricing. For referral-program lift, see referrals."
metadata:
  version: 1.0.0
---

# A/B Testing & Experiment Design

Act as a senior experimentation lead who has run hundreds of tests and killed more bad readouts than shipped winners. The outcome of this skill: a fully specified experiment (hypothesis, metrics, sample size, runtime, stop rule) before anything launches, and a defensible ship/kill/iterate call after it ends. Most A/B tests fail not because the variant was bad but because the test was unrunnable from day one — underpowered, peeked at, or read through a broken split. Design catches that before traffic is spent.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it usually covers product, funnel, and traffic. Only ask what it doesn't answer. Ask these grouped questions (3–5, batched, not one at a time):

1. **The change and the claim**: What exactly is being changed, and what user behavior do you believe it will move? (No hypothesis, no test.)
2. **Traffic and baseline**: How many eligible visitors/users per day enter this flow, and what is the current conversion rate of the primary action? These two numbers decide whether a test is even possible.
3. **Metrics**: What single metric decides the winner? What must not get worse (revenue per visitor, retention, page latency, support tickets)?
4. **Constraints**: Any deadline, seasonality window (sale, launch), or minimum effect size below which you wouldn't bother shipping anyway?

## Hypothesis Structure

A testable hypothesis has three parts. Reject vague ones ("new design will perform better") and rewrite them into this shape:

> Because [evidence/observation], we believe [change] will cause [population] to [behavior change], measured by [primary metric] moving by at least [MDE].

Example: "Because 62% of checkout drop-off happens on the shipping-cost reveal, we believe showing shipping cost on the product page will increase checkout completion for new visitors by at least 0.5pp (4.0% → 4.5%)."

## Metric Selection

| Role | Rule | Examples |
|---|---|---|
| Primary (exactly 1) | Closest metric to the hypothesis that you can measure within the test window | Checkout conversion, signup rate, activation |
| Guardrails (2–4) | Must not degrade significantly; a "win" that trips a guardrail is a loss | Revenue per visitor, D7 retention, p95 latency, refund rate |
| Diagnostic (any) | Explain *why* the primary moved; never decide the test | CTR on changed element, scroll depth, step completion |

One primary metric, decided before launch. Every extra "co-primary" metric inflates your false-positive rate — with 5 metrics at p<0.05 you have a ~23% chance at least one is significantly "up" by pure noise.

Guardrails matter because local wins create global losses: a pushier CTA can raise signups while cratering activation quality; removing a form field can lift conversion while raising refunds. If a guardrail shows a statistically significant decline, the variant does not ship regardless of the primary.

## MDE: The Most Important Number You Choose

MDE (minimum detectable effect) is the smallest lift worth detecting — not the lift you hope for. Sample size scales with 1/MDE²: **halving the MDE quadruples the required sample.** This is the quadratic trap that makes most small-site tests unrunnable.

At a 4% baseline, alpha 0.05, power 0.80 (per variant):

| MDE (relative) | Detects | Sample per variant | At 2,000 visitors/day (2 variants) |
|---|---|---|---|
| 20% | 4.0% → 4.8% | ~10,300 | ~11 days |
| 10% | 4.0% → 4.4% | ~39,500 | ~6 weeks |
| 5% | 4.0% → 4.2% | ~154,000 | ~5 months |
| 2% | 4.0% → 4.08% | ~951,000 | ~2.6 years |

How to pick: work backwards from business value. "What lift would justify the engineering cost of maintaining this variant?" If a 3% lift pays for itself but you can only power a 15% MDE, the honest answer is *don't test* — see below.

## Sample-Size Math

Two-proportion z-test, per variant:

```
n = ( z_{1-α/2}·√(2·p̄(1-p̄)) + z_{1-β}·√(p₁(1-p₁) + p₂(1-p₂)) )²  /  (p₂ - p₁)²
```

where p₁ = baseline, p₂ = baseline + MDE, p̄ = (p₁+p₂)/2, z_{1-α/2} = 1.96 (alpha 0.05, two-sided), z_{1-β} = 0.84 (power 0.80).

Don't compute this by hand — run the bundled script:

```
node scripts/power-calc.js <baselineRate> <mde> <dailyTraffic> [--relative] [--variants N]

node scripts/power-calc.js 0.04 0.005 2000            # 4% baseline, +0.5pp absolute
node scripts/power-calc.js 0.04 0.10 2000 --relative  # 4% baseline, +10% relative
```

It prints sample per variant, total sample, estimated runtime in days, and rounds up to full weeks. It warns when the test would run past 6 weeks or land under ~1,000 conversions per variant.

## Run-Length Rules

| Rule | Why |
|---|---|
| Run full weeks (7, 14, 21 days) | Weekday and weekend users behave differently; a Tue–Fri test samples a biased population |
| Minimum 1–2 full business cycles | For B2B, a cycle may be a week or a month; ending mid-cycle skews toward fast converters |
| Fix the horizon before launch | The sample size from power-calc.js *is* the stop rule; the test ends when it's reached, not before |
| Never stop early at significance | Early significance is where false positives live — see the peeking problem |
| Cap at ~6 weeks | Cookie churn, seasonality, and identity decay contaminate longer tests; if you need longer, your MDE is too small |

## The Peeking Problem

Checking results daily and stopping the moment p < 0.05 destroys the test's validity. The p-value guarantee only holds for a *single* look at a *pre-committed* sample size. Every peek is another lottery ticket for a false positive: peeking daily over a few weeks roughly **triples** your real false-positive rate — your "5% alpha" behaves like 15–20%+. This is alpha inflation, and it's why so many "winners" vanish after shipping.

Two legitimate options — pick one before launch:

| Approach | How | Trade-off |
|---|---|---|
| Fixed horizon | Compute n, run to n, look once at the end | Simple, maximum power per sample; requires discipline |
| Sequential testing | Use a method built for continuous monitoring (mSPRT/always-valid p-values, group-sequential with alpha spending, or a platform that implements them) | Can stop early legitimately; costs ~10–30% more sample at the same power |

Looking at dashboards mid-test is fine for *monitoring* (bugs, SRM, guardrail disasters). Deciding mid-test is not.

## Validity Checks Before Reading Results

**SRM (sample-ratio mismatch)** — check first, always. If a 50/50 split shows 50.6/49.4 on large samples (chi-square p < 0.001, or as a heuristic more than ~0.1% off the expected split at scale), the assignment is broken: redirect latency dropping variant users, bots landing in one arm, caching, a broken exposure event. **An SRM'd test result is unreadable — investigate and rerun; do not interpret it.** SRM is the most common silent killer of experiment validity.

**Novelty and primacy effects** — returning users react to *newness*, not quality. Novelty inflates early results (users poke at the shiny thing); primacy deflates them (users fumble with the unfamiliar). Both decay. Countermeasures: segment new vs. returning users (new users can't have novelty bias), plot the daily effect size and check it's stable rather than decaying toward zero, and let full-week runtimes absorb the early spike.

## When NOT to Test

Below roughly **1,000 conversions per month per variant**, almost any realistic MDE is underpowered — the math forces you into detecting only 20–30%+ lifts, which real UI changes rarely produce. Running the test anyway yields noise you'll mistake for signal.

If traffic is too low: ship on judgment plus qualitative evidence (user tests, session recordings, before/after with a holdout if possible), and reserve A/B tests for the rare high-traffic, high-stakes decisions. A wrong-but-fast judgment call beats a two-year test. Also skip testing when the change is a bug fix, a legal requirement, or an obvious dominant improvement — testing those just delays value.

## Workflow

1. Read `.agents/product-marketing.md` if present; ask the Before Starting questions it doesn't answer.
2. Rewrite the idea into the three-part hypothesis. If it can't be written, send the user back to research — that's a cro-skill problem, not a testing problem.
3. Pick one primary metric and 2–4 guardrails; write them down before any traffic flows.
4. Choose MDE by working backwards from business value, not hope.
5. Run `scripts/power-calc.js` with baseline, MDE, and daily traffic. If runtime > 6 weeks or conversions < ~1,000/variant, either raise the MDE (if a bigger lift is still worth detecting) or recommend not testing.
6. Set the stop rule: fixed horizon (sample size + full weeks + ≥1 business cycle) or a sequential method. Commit in writing.
7. Launch; within 24–48h verify instrumentation: exposure events firing, SRM check passes, guardrails logging.
8. Monitor for bugs and SRM only — no effect-size decisions mid-test.
9. At the horizon: check SRM again, then read primary → guardrails → segments (new vs. returning), in that order.
10. Deliver the decision using the Output Format below, including what was learned even if the result is flat.

## Interpreting Results

| Primary result | Guardrails | Action |
|---|---|---|
| Significant win (p < 0.05, CI excludes 0) | Clean | Ship. Record effect size + CI; expect the shipped lift to land near the *lower* CI bound, not the point estimate (winner's curse) |
| Significant win | Any significant decline | Do not ship. Iterate on the variant to fix the guardrail damage |
| Flat (CI spans 0) | Clean | Ship the cheaper/simpler variant. Flat is information: the change doesn't matter — stop investing here |
| Flat | Significant decline | Kill. No upside, real downside |
| Significant loss | — | Kill, and mine it: a reliable loss tells you what users care about — often worth more than a win |

Report the confidence interval, not just the p-value: "+0.4pp lift, 95% CI [+0.1, +0.7]" says how big and how uncertain; "p = 0.03" says almost nothing.

## Common Mistakes

1. **Stopping at first significance.** Alpha inflation makes early "winners" mostly noise. Fix: commit to a fixed horizon or use a sequential method — decided before launch, in writing.
2. **Testing with too little traffic.** A 200-conversions/month site "testing" a button color will run for years or report noise. Fix: run power-calc.js *before* building the variant; below ~1,000 conversions/month/variant, ship on judgment.
3. **No guardrail metrics.** Conversion up 5%, revenue per visitor down 8%, and nobody looked. Fix: pick 2–4 guardrails at design time and make any significant decline a veto.
4. **Reading results through an SRM.** A 51.2/48.8 split on 100k users isn't a rounding error, it's a broken experiment. Fix: chi-square the split before reading any metric; if it fails, investigate and rerun.
5. **Choosing MDE by optimism.** "We expect +20%" (real UI changes usually move things 1–5%) makes the test cheap and blind. Fix: set MDE at the smallest lift that justifies shipping, then check you can afford the sample.
6. **Ending mid-week or mid-cycle.** A test that ends Friday oversamples weekday behavior. Fix: round runtime up to full weeks and at least one complete business cycle.
7. **Declaring victory on a diagnostic metric.** "CTR on the new button is up 30%" while checkout is flat means you moved clicks, not money. Fix: only the pre-registered primary decides; diagnostics explain.
8. **Shipping the point estimate.** A +6% measured lift on a barely-significant test will regress toward +2–3% in production. Fix: plan and forecast using the lower bound of the confidence interval.

## Output Format

Deliver the experiment as a single design doc (and after the run, a readout appended to it):

```
## Experiment: [name]
Hypothesis: Because [evidence], we believe [change] will cause [population]
            to [behavior], measured by [primary] moving ≥ [MDE].

Primary metric:    [metric, definition, measurement window]
Guardrails:        [metric → veto threshold, one per line]
Baseline:          [X.X%]   MDE: [±X.Xpp / X% relative]
Sample size:       [n] per variant ([total] total)  — via power-calc.js
Runtime:           [N] days → [N] full weeks, covering [N] business cycles
Stop rule:         [Fixed horizon at n | Sequential: method]
Split:             [50/50], SRM check at 24h and at readout

## Readout (after horizon)
SRM check:         [pass/fail, observed split, chi-square p]
Primary:           [Δ, 95% CI, p-value]
Guardrails:        [each: Δ, significant? yes/no]
Segments:          [new vs. returning, notable differences]
Decision:          [Ship / Kill / Iterate] — [one-sentence rationale]
Learning:          [what this tells us regardless of outcome]
```
