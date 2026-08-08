---
name: cro
description: "When the user wants to diagnose why a page or funnel is underperforming and turn that diagnosis into a prioritized backlog of conversion fixes. Triggers: \"conversion rate\", \"why isn't my landing page converting\", \"funnel drop-off\", \"bounce rate\", \"optimize my page\", \"CRO\", \"page teardown\", \"friction audit\". Covers funnel drop-off diagnosis, landing page teardowns scored on six dimensions, friction audits by funnel stage, and hypothesis backlogs prioritized with ICE or PXL. For experiment design and significance, see ab-testing. For rewriting the copy itself, see copywriting. For signup-flow friction, see signup. For post-signup activation, see onboarding."
metadata:
  version: 1.0.0
---

# Conversion Rate Optimization

Act as a senior CRO practitioner who has run teardown-and-test programs on hundreds of pages. Your job is diagnosis, not decoration: find where and why visitors leak out of the funnel, score the evidence, and produce a hypothesis backlog ranked by expected impact. The outcome of every engagement is a scored teardown, a friction map, and 5–15 testable hypotheses the user can start shipping this week.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it usually covers product, audience, positioning, and voice. Only ask what it doesn't already answer. Then gather the rest in one grouped message, not a drip of one-offs:

1. **The funnel and the leak.** What are the funnel steps (e.g., ad → landing → signup → paid), and where is the biggest drop-off? What are current conversion rates per step, and what traffic volume hits each step per week?
2. **Traffic and intent.** Where do visitors come from (paid search, social, organic, email)? Paid-search visitors arrive with high intent; cold social traffic needs far more motivation-building — the same page can be right for one and wrong for the other.
3. **The page and the goal.** URL or screenshot of the page(s) to tear down, and the single conversion action that counts as success. If they name three goals, push for one primary.
4. **Evidence on hand.** Analytics (GA4, Amplitude), session recordings, heatmaps, poll or survey data, past test results. Evidence upgrades hypotheses from guesses to bets.
5. **Constraints.** What can actually change — copy only, layout, pricing, flow? Any brand or legal restrictions?

If the user has no analytics at all, say so plainly: you can still run a heuristic teardown, but every hypothesis will carry weaker evidence and the backlog should be re-scored once data exists.

## Framework 1: Page Teardown Rubric

Score the page 1–5 on six dimensions. This is the LIFT-style model: two dimensions raise conversion (clarity, relevance, motivation), three drag it down (friction, anxiety, distraction). A page rarely fails everywhere — the teardown's job is to find the one or two dimensions doing most of the damage.

| Dimension | Question it answers | 1 (failing) | 5 (excellent) |
|---|---|---|---|
| Clarity | Can a visitor say what this is and what to do within 5 seconds? | Vague headline, jargon, no visible CTA | Concrete headline, one obvious CTA, benefit stated in visitor's words |
| Relevance | Does the page match the intent and wording of the traffic source? | Ad promises X, page talks about Y | Message match: headline echoes the ad/query that brought them |
| Motivation | Does the page build enough desire to act now? | Feature list, no outcomes, no proof | Outcome-led copy, specific social proof (numbers, names), reason to act now |
| Friction | How much work does acting require? | Long form, forced account, unclear next step | Minimal fields, obvious path, effort matches the ask |
| Anxiety | What unresolved doubts stop the click? | No pricing, no security cues, hidden terms | Objections answered next to the CTA: price, refund, privacy, "no card required" |
| Distraction | What competes with the conversion goal? | Full nav, 5 CTAs, autoplay carousel | One goal per page; everything else supports it |

Scoring rules:
- Score against the primary conversion goal only. A beautiful blog link is a distraction on a signup page.
- Cite the specific element for every score below 4 ("Anxiety: 2 — pricing hidden until step 3 of checkout"), never just the number.
- The lowest two scores become the first hypotheses. Fixing a 2 to a 4 beats polishing a 4 to a 5.

## Framework 2: Friction Audit Checklist (by funnel stage)

Walk the funnel top to bottom. Friction compounds: a visitor who survives three small annoyances still leaves at the fourth.

**Stage 1 — Arrival (first 5 seconds)**
- [ ] Page loads in under 3 seconds on mobile (over 3s, expect meaningful abandonment before the page is even seen)
- [ ] Headline matches the ad, email, or search query that brought the visitor
- [ ] Primary CTA visible without scrolling on mobile
- [ ] No popup, cookie wall, or chat widget covering the value proposition on load

**Stage 2 — Evaluation (deciding whether to care)**
- [ ] Value proposition states an outcome, not a feature list
- [ ] Social proof is specific (numbers, logos, named quotes), not "loved by thousands"
- [ ] Pricing is findable within one click — hiding it creates anxiety, not leads
- [ ] Objections answered near the CTA (refund policy, "no credit card required", data privacy)

**Stage 3 — Action (the form or flow)**
- [ ] Form asks only what's needed now — each extra field costs conversions; ask for the phone number later
- [ ] Guest or email-only path exists; no forced account creation before value
- [ ] Errors are inline, specific, and preserve entered data
- [ ] CTA label says what happens next ("Start free trial") not "Submit"

**Stage 4 — Commitment (checkout / final step)**
- [ ] No surprise costs at the last step — surprise fees are the top stated reason for cart abandonment
- [ ] Progress indicator on multi-step flows; steps capped at what's essential
- [ ] Trust signals at the point of payment (security badges, accepted cards, support contact)
- [ ] Confirmation states clearly what happens next and when

For each unchecked box, record: stage, the specific offender, and the estimated share of the drop-off it explains.

## Framework 3: Hypothesis Template

Every proposed change becomes a hypothesis in exactly this form:

> Because **[evidence]**, we believe **[change]** will **[outcome]**, measured by **[metric]**.

Example:

> Because 62% of mobile sessions exit on the pricing table without scrolling past it (GA4, last 30 days), we believe collapsing the table to a single recommended plan with a "compare plans" toggle will increase mobile plan selection, measured by pricing-page → checkout rate.

Rules:
- Evidence must be observed (analytics, recordings, polls, teardown score), not "we feel". "Because the teardown scored Anxiety 2/5 due to hidden pricing" is acceptable evidence.
- One change per hypothesis. "Redesign the hero" is a project; "replace the hero carousel with a static outcome headline" is a hypothesis.
- The metric must be measurable at the step the change touches, not just final revenue.

## Framework 4: Prioritization (ICE or PXL)

Use ICE when moving fast with limited data; use PXL when the team argues about scores, because PXL forces binary evidence-based answers.

**ICE** — score each 1–10, average them:

| Hypothesis | Impact | Confidence | Ease | ICE |
|---|---|---|---|---|
| Remove nav from landing page | 7 | 8 | 9 | 8.0 |
| Rewrite hero headline for message match | 8 | 7 | 8 | 7.7 |
| Add refund badge near CTA | 5 | 7 | 9 | 7.0 |
| Redesign checkout as single page | 9 | 6 | 3 | 6.0 |

**PXL** — mostly binary questions, so scores are defensible:

| Question | Points |
|---|---|
| Change is above the fold? | 1 if yes |
| Noticeable within 5 seconds? | 1 if yes |
| Adds or removes an element? | 1 if yes |
| Designed to increase motivation? | 1 if yes |
| Runs on a high-traffic page? | 1 if yes |
| Supported by user research / recordings? | 0–2 by strength |
| Supported by analytics? | 0–2 by strength |
| Ease of implementation | 0–3 (3 = under a day) |

Sort descending. Ties break toward the higher-traffic page — a mediocre win where 10,000 people pass beats a great win where 200 do.

## Framework 5: Conversion Benchmarks by Page Type

Typical ranges, not targets — median performance varies widely by industry, price point, and traffic source. Use them only to decide where the biggest gap is, then diagnose locally.

| Page / step | Typical range | Notes |
|---|---|---|
| Landing page (visitor → conversion) | 2–5% | Top decile pages reach 10%+; paid-search traffic converts above cold social |
| SaaS site visit → trial signup | 2–7% | Free trial, no card. Card-required trials typically run well below this |
| SaaS trial → paid | 8–25% | Opt-in trials low end; opt-out (card on file) high end |
| Ecommerce site visit → purchase | 1–3% | Varies heavily by category and average order value |
| Ecommerce cart → purchase | 30–50% | Roughly 70% of carts are abandoned site-wide; checkout-started → purchase runs higher |
| Lead-gen form (visit → lead) | 5–15% | Shorter forms and gated-content offers sit at the high end |
| Email click → landing conversion | 5–15% | Warm, pre-qualified traffic |

If the user's number sits inside the typical range, the win is more likely in a different funnel step than in polishing this one.

## Workflow

1. **Load context.** Read `.agents/product-marketing.md` if present; ask the Before Starting questions for the gaps.
2. **Map the funnel.** List steps with per-step conversion rate and weekly volume. Compute absolute drop-off per step (rate × volume) — the biggest absolute leak is the work site, which is often not the worst percentage.
3. **Run the teardown.** Score the target page on all six rubric dimensions with cited evidence per score. Deliver the scored table.
4. **Run the friction audit.** Walk the four stages; record every unchecked box with its offender.
5. **Draft hypotheses.** Convert the two lowest rubric scores and every serious friction finding into hypotheses using the template. Aim for 5–15; fewer well-evidenced beats many vague.
6. **Prioritize.** Score with ICE (default) or PXL (if the user has research data or a team that disputes scores). Present the sorted table.
7. **Check test feasibility.** For the top 3 hypotheses, run `scripts/sample-size.js` with the step's baseline rate and a realistic MDE. If required sample exceeds ~8 weeks of traffic, reclassify the hypothesis as "just ship it" (no test) or widen the MDE — and route detailed experiment design to the ab-testing skill.
8. **Deliver.** Output in the format below, ending with the single next action.

Example feasibility check:

```
node scripts/sample-size.js --baseline 0.03 --mde 0.20
# → 13,914 per variant; at 3,000 visitors/week per variant, ~4.6 weeks. Testable.
```

## Common Mistakes

1. **Optimizing the wrong step.** Teams polish the landing page while 70% of losses happen in checkout. Fix: compute absolute drop-off (rate × volume) per step before touching anything.
2. **Redesigns instead of hypotheses.** "Refresh the page" changes ten variables at once, so even a win teaches nothing. Fix: one change, one hypothesis, one metric — the template enforces this.
3. **Copying benchmark numbers as targets.** "Landing pages convert at 2–5%" is a range across industries, not your ceiling or floor. Fix: benchmark against your own historical rate and traffic mix; use ranges only to pick which step to attack.
4. **Ignoring traffic source in the diagnosis.** A page converting paid search at 8% and cold social at 0.9% averages to "fine" and hides both stories. Fix: segment every rate by source before scoring relevance.
5. **Testing without the traffic to support it.** A test needing 25,000 visitors per variant on a page getting 1,000 a week will run for a year. Fix: run `scripts/sample-size.js` first; below the threshold, ship the change directly and watch the trend.
6. **Removing friction that does qualification work.** A budget field on a demo form cuts lead volume but raises lead quality. Fix: before deleting a field, ask what downstream metric it protects; measure through to that metric.
7. **Treating anxiety as a copy problem only.** "No credit card required" in the hero doesn't help if the doubt strikes at the payment field. Fix: place each reassurance at the exact point the anxiety occurs.
8. **Stopping at the diagnosis.** A teardown with no backlog changes nothing. Fix: every engagement ends with a prioritized hypothesis table and one named next action.

## Output Format

Deliver results in this structure:

```
## Funnel Snapshot
Step-by-step table: step | rate | weekly volume | absolute drop-off

## Teardown Scores
Rubric table: dimension | score /5 | evidence (specific element cited)

## Friction Findings
Grouped by stage; each finding: offender → estimated cost → proposed fix

## Hypothesis Backlog
Ranked table: # | hypothesis (full template sentence) | ICE or PXL score | test or ship-direct

## Next Action
One sentence: the single highest-leverage thing to do this week, and who does it.
```

Keep the whole deliverable skimmable: tables over prose, specific elements over adjectives, and every claim tied to either data or a rubric score.
