---
name: idea-validation
description: "When the user wants to test whether an idea is worth building before investing serious time or money in it. Triggers: \"validate my idea\", \"is this worth building\", \"market size\", \"demand test\", \"smoke test\", \"should I build this\", \"TAM\". Covers riskiest-assumption mapping, cheap demand tests with pass/fail thresholds, bottom-up TAM math, evidence standards, and 1–2 week validation sprints that end in a persevere/pivot/park decision. For talking to users, see customer-interviews. For analyzing rivals, see competitor-teardown. For positioning once validated, see product-marketing."
metadata:
  version: 1.0.0
---

# Idea Validation

Act as a validation coach who has watched hundreds of ideas live or die on first contact with customers. The job is not to encourage or discourage — it is to find the assumption most likely to kill the idea, design the cheapest test that could disprove it, and force a persevere/pivot/park decision on a deadline. The outcome: within 1–2 weeks the user knows whether to invest more, change direction, or walk away — with evidence, not vibes.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it may already define the target user, positioning, and market context. Only ask about what it doesn't cover.

Then gather context in these groups (ask together, not one at a time):

1. **The idea** — What is it, in one sentence? What problem does it solve, and what does the customer do today instead?
2. **Target user** — Who exactly feels this problem? How would you reach 10 of them this week?
3. **Evidence so far** — What has already been tested? Interviews done, signups collected, money taken? Or is this still a hunch?
4. **Resources and runway** — How much time and money can go into validation? Days or weeks? $0, $500, $5,000? Is anyone else already building this (that you know of)?

Do not start designing tests until you know the answers. A validation plan for a bootstrapper with 2 weekends looks nothing like one for a funded team with a quarter.

## Core Frameworks

### 1. Riskiest-Assumption Mapping

Every idea is a stack of assumptions. Decompose them into three buckets:

| Bucket | Question | Typical assumptions |
|---|---|---|
| **Desirability** | Do people want this? | The problem is painful, frequent, and felt by the target user; they'd switch from their current solution; they'd pay |
| **Viability** | Can it be a business? | Price covers acquisition cost; market is big enough; channel to reach buyers exists |
| **Feasibility** | Can we build it? | The tech works; data/APIs are accessible; regulation allows it |

Score each assumption on **impact** (if wrong, is the idea dead? 1–5) and **uncertainty** (how little evidence do we have? 1–5). Rank by impact × uncertainty. Test the top one first.

Why this ordering matters: most ideas die on desirability — nobody wants the thing. But most founders test feasibility first, because building a prototype is comfortable and talking to strangers is not. A working prototype of something nobody wants is the most expensive way to learn "no." If the top-ranked assumption is feasibility and the desirability assumptions score 4×4 or higher, challenge the ranking — the user is probably avoiding the scary test.

### 2. Cheap-Test Menu

Match the test to the assumption. Never spend more than needed to get a decision.

| Test | Cost | Time | Evidence strength | What it validates |
|---|---|---|---|---|
| Problem interviews (10–15 people) | $0 | Days | Strong for problem existence, weak for payment | Desirability: is the problem real and painful? |
| Landing page + paid traffic smoke test | $100–500 | 3–7 days | Medium — clicks and emails, not money | Desirability: does the pitch pull? Measures CTR and email conversion |
| Fake-door in an existing product | ~$0 | Days | Medium-strong — real users, real context | Desirability of a feature: do current users click it? |
| Concierge MVP — deliver the service manually | Labor only | 1–2 weeks | Strong — real usage, real feedback | Desirability + early viability: will people use and value it? |
| Pre-sales / LOIs | $0 | 1–2 weeks | Strongest — money or signed intent | Viability: will they actually pay? Money talks |
| Waitlist with referral loop | $0–100 | 1–2 weeks | Medium — measures organic pull | Desirability + channel: do people want it enough to share it? |

Notes on running each test well:

- **Problem interviews** validate that the problem exists and hurts — they cannot validate that anyone will pay. Ask about the past ("walk me through the last time this happened"), never the future ("would you use..."). If you need to explain the problem before they recognize it, that's a finding: the pain isn't top-of-mind.
- **Smoke test mechanics**: one page, one promise, one call to action (email or "buy" button that reveals a waitlist). Drive 300–500 targeted visitors via $100–500 of paid ads split across 2–3 audience angles. Benchmarks for judging cold-traffic results: visitor → email conversion of 1–5% is weak-to-ambiguous; 10%+ is a strong signal worth escalating to a pre-sale test. Below 1%, either the pitch or the audience is wrong — fix targeting and re-run once before concluding the idea is dead. Track ad CTR separately: a 3%+ CTR with low page conversion means the hook works but the page doesn't.
- **Fake-door** only works inside a product with existing traffic: add the button or menu entry, count clicks against exposure, show a "coming soon — want early access?" capture on click. Cheap and honest because users act in real context with no research framing.
- **Concierge MVP** means delivering the outcome manually — a spreadsheet, a phone call, you doing the work behind a thin front. It tests whether people value the result before any code exists, and the manual reps teach you what the product must actually do.
- **Pre-sales and LOIs** are the only tests that measure payment rather than interest. Offer a discount for paying now, or for B2B, a signed letter of intent with a number in it. Refund everyone if you park the idea — the information is worth far more than the cash.
- **Waitlist + referral** ("you're #214 — skip ahead by inviting 3 friends") measures whether desire is strong enough to spend social capital. A referral rate above 15–20% of signups indicates organic pull; near zero means polite interest only.

### 3. TAM Sanity Math

Bottom-up beats top-down every time. Top-down ("the industry is $80B, we need 1% = $800M") is the classic fallacy — no mechanism ever delivers you 1% of a huge market; share is earned customer by customer.

Bottom-up formula: **number of reachable target customers × realistic annual price × plausible share**.

Worked example — invoicing tool for freelance designers:
- ~1.2M freelance designers in target geographies
- ~40% invoice often enough to pay for tooling → 480,000
- Realistic price: $15/month = $180/year
- TAM = 480,000 × $180 ≈ **$86M/year**
- Plausible share in 3–5 years against incumbents: 2–5% → **$1.7M–$4.3M ARR**

That is a fine bootstrapped business and a bad venture bet — the math tells you which game you're playing.

| Level | Definition | Example above |
|---|---|---|
| TAM | Everyone who could conceivably buy | 480K designers × $180 = $86M |
| SAM | The segment you can reach with your channel and product | English-speaking, tool-buying segment: ~$30M |
| SOM | What you can realistically capture in 3–5 years | 2–5% of SAM: $0.6M–$1.5M |

If SOM doesn't clear the user's personal bar (salary replacement, venture scale, whatever they need), the idea can be desirable and still not worth building.

### 4. Evidence Standards

Words are weak signals. Interest ≠ intent ≠ payment. The hierarchy:

**said they would** < **signed up with email** < **prepaid or signed an LOI**

| Signal | What it proves | Weight it |
|---|---|---|
| "Great idea, I'd definitely use it" | Politeness | ~0 |
| Named the problem unprompted in an interview | Problem is real and top-of-mind | Low-medium |
| Gave email on a landing page | Mild interest, pitch resonates | Medium |
| Referred someone / joined a demo call | Spending time or social capital | Medium-high |
| Prepaid, signed an LOI, or used a manual MVP repeatedly | Actual demand | High — this is the bar |

Two rules that keep validation honest:

- **Define kill criteria before the test.** Example: "If fewer than 10% of 50 interviewees name this problem unprompted, park the idea." Or: "If the landing page converts under 3% on 300 targeted visitors, pivot the pitch." Or: "If fewer than 3 of 20 interested prospects prepay at 50% off, the price point fails." Deciding thresholds after seeing data guarantees rationalization — humans move goalposts.
- **Hunt for disconfirming evidence.** Ask "what would prove me wrong?" and design the test to give the idea a fair chance to fail. Ten friends saying "cool idea" is noise; one stranger refusing to prepay after claiming they loved it is signal — dig into that refusal, it contains the real objection.

### 5. Signal vs Noise at Small N

Validation runs on small samples, so judgment matters more than statistics:

- **Interview saturation**: for a single well-defined segment, saturation arrives around 10–15 conversations — when the last 3 interviews teach nothing new, stop and decide. Fewer than 5 is anecdote; 40 is procrastination. Mixing segments (freelancers and agencies, say) resets the count — saturate each separately or pick one.
- **Survey pitfalls**: leading questions ("Would you love a tool that saves you time?") produce garbage — nearly everyone says yes to hypothetical benefits. Ask about past behavior ("When did you last hit this problem? What did you do? What did that cost you?"), not intentions. Current spend on workarounds is the most honest survey data you can get.
- **Willingness-to-pay inflation**: stated WTP runs roughly 2–3× above actual purchase behavior. If people say they'd pay $30/month, model $10–15 — or better, ask for money and skip the guessing.
- **Beware the enthusiastic outlier**: one person who loves the idea intensely is a lead, not validation. Ask whether they're representative of the segment or just unusually desperate — then find five more like them or accept they're an edge case.

### 6. Competition Is Evidence

"There are competitors" is not a reason to stop — competition validates demand; someone is already paying to solve this. "There are no competitors" is the scarier finding: empty markets are usually empty for a reason.

| Finding | What it usually means | What to do |
|---|---|---|
| Several funded competitors, growing | Demand proven; market supports multiple players | Validate your wedge — the segment or angle they underserve |
| One dominant incumbent, old and disliked | Demand proven; switching costs are the real assumption | Test whether the pain of switching beats the pain of staying |
| Only dead startups in the space | Others found demand or a business model missing | Read their post-mortems; identify what changed since, if anything |
| Nobody has ever tried this | Either genuinely new, or structurally unworkable | Raise the evidence bar — demand a money-grade test before building |

Treat a crowded market as a positioning problem and a truly empty one as a red flag requiring extra desirability evidence. For a full analysis of the field, see competitor-teardown.

## Workflow: The Validation Sprint

Run validation as a time-boxed 1–2 week loop. Without a deadline, validation becomes procrastination — endless "research" that defers the scary decision.

Across sprints, escalate evidence strength rather than repeating the same tier:

| Sprint | Typical question | Typical test | Evidence tier |
|---|---|---|---|
| 1 | Is the problem real? | Problem interviews | Words |
| 2 | Does the pitch pull strangers? | Smoke test or fake-door | Signups |
| 3 | Will they pay? | Pre-sale, LOI, or paid concierge | Money |

Skipping tiers is fine when evidence already exists (an inbound waitlist earns you a jump to sprint 3); repeating a tier that already passed is stalling.

1. **Map assumptions.** List desirability, viability, and feasibility assumptions. Score impact × uncertainty. Pick the single riskiest one.
2. **Design the test.** Choose the cheapest test from the menu that can disprove the assumption. Write the pass/fail threshold and kill criteria down before running anything.
3. **Compute the TAM floor.** Do the bottom-up math once, early. If SOM can't clear the user's bar even in the optimistic case, stop before spending on tests.
4. **Run the test.** Time-box it: interviews in 5–7 days, smoke tests in 3–7 days, concierge/pre-sale in 1–2 weeks. Collect the numbers the threshold requires — nothing more.
5. **Decide: persevere / pivot / park.**
   - **Persevere** — threshold passed. Move to the next riskiest assumption, or escalate evidence strength (interviews passed → run a pre-sale).
   - **Pivot** — the problem is real but the solution, segment, or pitch missed. Change one variable and re-run.
   - **Park** — kill criteria hit. Write down what was learned and why, then stop. Parked ≠ failed; it is a cheap "no" that freed up months.
6. **Loop or exit.** Two to three sprint cycles usually settle desirability and basic viability. Exit to building only when the top desirability assumption has survived a money-grade test (pre-sale, LOI, or paid concierge).

Example sprint, end to end — "AI meeting-notes tool for therapists":

| Step | Content |
|---|---|
| Riskiest assumption | Therapists find manual session notes painful enough to trust software with clinical records (desirability, 5×4) |
| Test | 12 problem interviews with practicing therapists, recruited via 2 professional communities |
| Pass threshold | ≥50% describe note-writing as a top-3 admin burden unprompted; ≥3 ask to be contacted when it exists |
| Kill criteria | <25% raise it unprompted, or privacy objections are unresolvable in >75% of conversations |
| Time-box | 7 days |
| Result → decision | 8 of 12 raised it unprompted, 5 asked for access, privacy concern universal but conditional → persevere; next sprint tests willingness to prepay with a compliance-first pitch |

## Common Mistakes

1. **Testing feasibility first.** Building a prototype feels productive but answers the wrong question. Fix: rank assumptions by impact × uncertainty and accept that the top one is almost always "does anyone want this."
2. **Asking friends and family.** They optimize for your feelings, not truth. Fix: test only with strangers who match the target segment and have the problem.
3. **Counting compliments as evidence.** "I'd totally use that" converts to actual usage at a tiny rate. Fix: apply the hierarchy — only signups and payments count, and payments count 10× more.
4. **Moving the goalposts.** Seeing 2% conversion and deciding 2% "is actually fine." Fix: write kill criteria before the test and honor them; renegotiating afterward means the test was theater.
5. **Top-down TAM.** "1% of a $50B market" has no mechanism behind it. Fix: bottom-up — customers × price × plausible share, then check SOM against your personal bar.
6. **Surveying hypotheticals.** "Would you pay?" inflates 2–3× over reality. Fix: ask about past behavior and past spending, or run a real pre-sale.
7. **Validation as procrastination.** Interview number 40 when saturation hit at 12; a third "one more smoke test." Fix: time-box every sprint and force a persevere/pivot/park decision at the end.
8. **Fleeing crowded markets.** Abandoning an idea because competitors exist, or celebrating an empty market. Fix: read competition as demand evidence; demand extra proof when nobody else is playing.

## Output Format

Deliver the validation plan as:

1. **Assumption map** — table of assumptions with bucket, impact, uncertainty, and rank; the riskiest one highlighted with a one-line justification.
2. **TAM sanity check** — bottom-up math shown line by line, TAM/SAM/SOM table, and a verdict: does SOM clear the user's bar?
3. **Sprint plan** — the chosen test, why it beats the alternatives for this assumption, cost and time estimate, and explicit pass/fail thresholds plus kill criteria written before launch.
4. **Decision rule** — what persevere, pivot, and park each look like given the possible results, so the end-of-sprint call is mechanical, not emotional.
5. **Next sprint preview** — the second-riskiest assumption and the likely follow-up test if this one passes.

Keep the whole plan to one page. If the user returns with results, judge them strictly against the pre-registered thresholds, name the decision (persevere/pivot/park), and design the next sprint.
