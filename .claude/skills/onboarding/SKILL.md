---
name: onboarding
description: "When the user wants to design or improve first-run onboarding so new signups reach product value and retain. Use for: activation, aha moment, time to value, users sign up and leave, product tour, empty states, first-run experience. Covers defining an activation metric from retention-cohort correlation, instrumenting time-to-value, checklist and progress patterns, empty-state design, and tour-vs-tooltip decisions. For the signup form itself, see signup. For getting users to invite others, see referrals. For page-level conversion before signup, see cro."
metadata:
  version: 1.0.0
---

# Onboarding & Activation

Act as an activation-focused growth engineer who has instrumented onboarding funnels at product-led SaaS companies. The outcome of this skill is a defined, data-backed activation metric for the user's product, an instrumented time-to-value funnel, and a concrete redesign of the first-run experience that moves more new signups to that activation event faster. Every recommendation must trace back to a measurable event, not a design opinion.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it typically covers the product, ICP, positioning, and core value proposition. Only ask about what it doesn't cover. Then ask 3–5 grouped questions:

1. **Product and value moment**: What does the product do, and what is the earliest moment a new user could plausibly feel it working? What must happen before that moment (account setup, data import, integration, invite)?
2. **Current funnel and data**: What analytics exist today (PostHog, Amplitude, Mixpanel, none)? Do you know current signup→active conversion, and what "active" currently means internally? Rough D7 retention if known?
3. **User type and motivation**: Do users arrive with high intent (they searched for this) or low intent (invited by a teammate, clicked an ad)? Solo user or team product? Self-serve or sales-assisted?
4. **Existing onboarding surface**: What happens today between signup and first real use — a wizard, a blank dashboard, an email? Any checklist, tour, or templates already in place?
5. **Constraints**: Engineering budget for this (a week? a quarter?), and whether the product has a hard setup dependency (API keys, wallet connection, data sync) that can't be removed, only softened.

Skip questions the user has already answered in context. If they have no analytics at all, the workflow starts at step 1 (instrumentation) — say so plainly rather than designing blind.

## Core Frameworks

### 1. Activation metric: find yours, don't copy theirs

Famous activation metrics are outputs of analysis, not templates. Slack's "2,000 messages sent by a team," Facebook's "7 friends in 10 days," Dropbox's "one file in one folder on one device" — each was found by correlating early behaviors with long-term retention *in their own data*. Copying Slack's number for your product is cargo-culting; your product has its own value moment.

The method is **retention-cohort correlation**:

| Step | What to do | Why |
|------|-----------|-----|
| 1. List candidates | Pick 5–10 early actions a user can take in week 1 (created project, invited teammate, connected integration, ran first query, hit result page) | You need hypotheses to test, drawn from what the product's value actually is |
| 2. Split cohorts | For each candidate, split a signup cohort into "did it in first N days" vs. "didn't" | Isolates the behavior from time-on-platform |
| 3. Compare retention | Measure week-4 (or month-3) retention for both groups | Retention is the ground truth activation should predict |
| 4. Pick the predictor | Choose the action with the largest retention gap that is also *causable* — something onboarding can push users toward | A metric you can't influence (e.g., "came from referral") is a segment, not an activation event |
| 5. Set the threshold | Test thresholds (1 project vs. 3 projects; 1 day vs. 7 days) and pick the knee of the curve, where additional actions stop adding retention | Slack's 2,000 was a knee, not a round number they liked |

Correlation is not causation — a behavior can be a *marker* of good-fit users rather than a *cause* of retention. Sanity-check by asking: "If we forced a bad-fit user to do this, would they retain?" If obviously no (e.g., "visited the pricing page"), it's a marker; keep looking. Then validate causally: run an experiment that pushes more users to the candidate event and check whether downstream retention actually moves.

### 2. Aha moment vs. activation event

These are related but distinct, and conflating them produces bad onboarding:

- **Aha moment**: the subjective instant the user *feels* the value ("oh, it found the bug for me"). Qualitative — find it by watching 5–10 session recordings of retained users and interviewing them ("when did you know this was for you?").
- **Activation event**: the *measurable proxy* for that feeling, defined via the correlation method above.
- **Setup moment**: everything required before the aha is possible (connect repo, import data). Setup is a tax, not value — minimize it, defer it, or fake it with sample data.

Design rule: onboarding's only job is to get the user from signup to the aha moment with the fewest possible setup steps in between. Every screen that isn't moving toward it is friction.

### 3. Time to value (TTV)

Once the activation event is defined, TTV = time from signup to that event. Instrument it and track:

- **Median TTV** (not mean — a few week-long stragglers destroy the mean).
- **Activation rate at D1 / D7**: percent of a signup cohort that has hit the event by then.
- **Drop-off by funnel step**: signup → step 1 → step 2 → activation, so you know *where* users stall, not just that they do.

Set reduction targets as ratios, not absolutes: "cut median TTV from 2 days to under 1 hour" is a typical first-pass goal for products where activation currently requires a return visit. If median TTV is longer than one session, the single highest-leverage move is usually making activation possible *in the first session* — via sample data, templates, or deferring setup.

Standard TTV reduction levers, in rough order of impact for most products:

| Lever | Mechanism | Typical fit |
|-------|-----------|-------------|
| Sample data / demo mode | Value visible before any setup | Products where real data takes hours or days to arrive |
| Templates | First artifact created in one click instead of from scratch | Builders: docs, boards, dashboards, workflows |
| Deferred setup | Move email verification, profile, preferences to after activation | Anything currently front-loading forms |
| Copy-paste quickstart | One command or snippet that produces a working result | Dev tools and APIs — "first 200 response" in under 5 minutes |
| Smart defaults | Pre-select the configuration most users pick anyway | Products with an intimidating settings step |
| Concierge fallback | Human or agent does setup for high-value stuck users | Sales-assisted or high-ACV segments only; doesn't scale |

**Out-of-session activation.** When activation structurally requires a return visit (teammate must accept an invite, data sync takes hours), in-product design alone can't close the gap. Pair it with behavior-triggered lifecycle messages: fire on *state*, not on a fixed drip schedule — "your import finished, here's the result" outperforms "day 3: have you tried importing?". One rule: every activation email deep-links to the exact next step, never to the homepage or a login wall that loses the click.

### 3b. Segment before you average

A single onboarding path assumes a single user, which is rarely true. Averages hide the fact that different arrivals need different first runs:

| Segment split | Why it changes onboarding |
|---------------|---------------------------|
| High intent (searched, compared, chose you) vs. low intent (ad click, curiosity) | High-intent users tolerate setup; low-intent users need value in under a minute or they're gone |
| Inviter vs. invitee | The invitee didn't choose the product — land them directly in the thing they were invited to, never in a generic wizard |
| Technical vs. non-technical persona | A quickstart with code activates one and terrifies the other; ask one routing question at signup if both exist |
| Migrating (has data elsewhere) vs. starting fresh | Migrators need import as step one; fresh users need templates |

Practical minimum: track signup source and invited-vs-organic as event properties from day one, and report activation rate per segment. If one segment activates at 40% and another at 8%, the blended 24% will mislead every decision. Branch the first-run flow only when a segment is both large and measurably underperforming — premature branching multiplies maintenance for no gain.

### 4. Checklists and the endowed progress effect

Onboarding checklists work because of the **endowed progress effect**: people are more likely to complete a goal when they start with artificial progress already granted. In the classic car-wash loyalty study (Nunes & Drèze, 2006), customers given a 10-stamp card with 2 stamps pre-filled completed at 34% vs. 19% for an 8-stamp card starting at zero — same 8 washes required, nearly double the completion.

Apply it:

- Pre-check 1–2 items the user already did ("Create account ✓", "Verify email ✓") so the bar starts at 20–30%, never 0%.
- Keep it to 3–5 remaining items, ordered by the activation path — the checklist *is* the shortest path to the activation event, not a feature tour.
- Show a progress bar or fraction; ambiguous progress ("almost there!") underperforms explicit progress ("3 of 5").
- Make it dismissible but persistent (collapsed widget, not a modal) — users who dismiss and return later still activate.
- End the checklist *at* the activation event, not at "explored all features." A checklist item like "check out settings" dilutes it.

### 5. Empty states: teach, do, or demo

Every screen a new user can reach with no data yet is an onboarding surface. Never ship a blank table with "No items yet." Three options, chosen per screen:

| Pattern | What it is | Best when | Cost | Risk |
|---------|-----------|-----------|------|------|
| **Teach** | Explain what belongs here + one CTA to create it ("Projects group your scans. Create your first project →") | The action is quick and the concept needs naming | Low — copy + button | Still zero value shown; weakest option alone |
| **Do** | The empty state *is* the creation flow — inline form, one-click template, or import wizard embedded where the data will appear | The first item can be created in under a minute | Medium | Can feel pushy if the action needs prerequisites |
| **Demo** | Pre-populate with realistic sample data, clearly labeled, with "replace with your own" | Real setup is slow (data sync, integration) but the aha is *seeing* populated output | High — sample data must be maintained and clearly fake-labeled | Users mistake demo data for real; always label and make dismissal one click |

Default heuristic: **do** where the first action is cheap, **demo** where setup is expensive, **teach** only as a fallback or as copy layered onto the other two.

### 6. Tour vs. tooltip vs. do nothing

Product tours are the most overused onboarding pattern. Decide per situation:

| Approach | Use when | Avoid when | Notes |
|----------|----------|-----------|-------|
| **Full tour** (multi-step modal walkthrough) | UI is genuinely novel (new interaction paradigm) AND users are low-intent and would otherwise bounce in confusion | Almost everywhere else — tours are skipped by a large majority of users and completion drops with every added step | If used: max 3–4 steps, skippable at every step, ends by *doing* the first real action, never just pointing at chrome |
| **Contextual tooltip** (single hint, triggered by state) | One specific control is high-value but non-obvious, and you can trigger the hint exactly when it's relevant (user just did X, has never done Y) | Firing on first load regardless of context — that's a tour wearing a disguise | One tooltip at a time; dismiss forever on click; tie each to a behavioral trigger |
| **Do nothing** (self-evident UI + good empty states) | The interface follows conventions users already know, and empty states carry the guidance | The product has a real conceptual model to teach (e.g., branching, staging) | This is the correct default. Redesigning a confusing screen beats annotating it |

Decision rule: if you're reaching for a tour to explain the UI, first ask whether the empty state or the UI itself should change. Tours patch design debt; they rarely pay it down.

### 7. Activation benchmarks by product type (typical, not targets)

These are typical observed ranges for D7 activation (share of signups hitting a meaningful activation event within 7 days) in self-serve products. Use them to sanity-check whether you have an activation problem, not as goals — the right comparison is your own cohort trend.

| Product type | Typical D7 activation | Notes |
|--------------|----------------------|-------|
| Consumer mobile app | 15–30% | High signup volume, low intent; huge D1 drop-off is normal |
| Self-serve B2B SaaS (solo user) | 25–40% | Single-player value moment reachable in-session helps |
| Self-serve B2B SaaS (team/invite-dependent) | 15–30% | Activation gated on a second human is structurally slower |
| Dev tool / API product | 10–25% | "First successful API call" gates on code integration; sandbox keys and copy-paste quickstarts move this most |
| Fintech / crypto (KYC, wallet, or funding required) | 10–20% | Regulatory or funding setup is a hard tax; demo/sandbox modes matter |
| PLG with sample-data or template start | +5–15 pts over category baseline | The single most reliable lever across categories |

If you're below the low end of your category, fix the path to activation before spending on acquisition — pouring more signups into a leaky first run compounds the waste.

### 8. Reading activation experiments honestly

Onboarding changes are unusually easy to fool yourself about, because every new signup only experiences one version and cohorts drift with marketing. Rules for trustworthy reads:

- **Compare weekly signup cohorts, not calendar traffic.** A cohort is "everyone who signed up in week N," followed for a fixed window. Comparing "activations this month vs. last month" mixes cohort sizes and ages into noise.
- **Hold the follow-up window constant.** D7 activation for the new flow can only be read 7 days after each cohort signs up. Reading it early systematically undercounts the newest cohort and makes every change look bad.
- **Watch for mix shift.** If a launch or campaign changed who is signing up, activation moves for reasons unrelated to your redesign. Check activation *per segment* (Framework 3b) before crediting the new flow.
- **Expect small effects on big funnels.** Moving D7 activation from 25% to 28% is a real win worth shipping; expecting 2x from a checklist is how good changes get rolled back. Size expectations from the drop-off you targeted: a step losing 30% of users caps your gain at roughly those 30 points times your fix's effectiveness.
- **Prefer an A/B split when volume allows** (roughly 200+ activations per arm for directional confidence); otherwise use before/after across at least 2–3 full cohorts on each side and say the read is directional, not proven.

## Workflow

Follow in order; each step's output feeds the next.

1. **Instrument events.** Before any redesign, ensure analytics capture: signup (with source, intent, and invited-vs-organic as properties), each setup step, every candidate value action, and session boundaries. Use whatever stack exists; if none, recommend one lightweight option and the 8–12 events to track. Name events as `object_verb` (`project_created`, `invite_sent`) and keep the taxonomy in one reviewed file so it doesn't rot. No instrumentation → no activation metric → nothing else in this skill works.
2. **Wait for or use existing cohort data.** You need at least a few hundred signups with 4+ weeks of history for correlation. If the product is pre-data, define a *provisional* activation event from first principles (the smallest action that delivers the core value) and mark it for validation later — say explicitly that it's a hypothesis.
3. **Find the activation event.** Run the retention-cohort correlation from Framework 1: candidates → cohort splits → retention gaps → causability check → threshold at the knee. Deliver one sentence: "A new user is activated when they ___ within ___ days."
4. **Identify the aha moment behind it.** Watch recordings or interview retained users to name the felt moment the metric proxies (Framework 2). This tells you what onboarding must *show*, not just what it must count.
5. **Map and measure the current path.** Diagram every step from signup to activation with drop-off percentages and median time per step, split by the segments from Framework 3b. Mark each step as value, necessary setup, or removable friction. The step with the largest (drop-off × cohort size) product is your first target.
6. **Shorten the path.** In priority order: delete removable steps; defer setup until after the aha (sample data or demo mode per Framework 5); collapse remaining setup into the fewest screens; then guide with a checklist (Framework 4) and at most contextual tooltips (Framework 6). Add lifecycle nudges only for gaps that structurally require a return visit.
7. **Set targets and ship one experiment.** Pick one metric to move first — usually D7 activation rate or median TTV — set a target (e.g., 25% → 32%, or 2 days → 1 session), ship the single highest-leverage change, and compare cohorts before/after. Iterate.

## Common Mistakes

1. **Copying another company's activation metric.** "7 friends in 10 days" was Facebook's answer to Facebook's data. Fix: run the correlation method on your own cohorts; borrow the *method*, never the number.
2. **Confusing correlation with causation.** "Users who visit docs retain better" may just mean engaged users read docs. Fix: apply the causability test, then validate with an experiment that pushes the behavior and checks retention movement.
3. **Touring instead of doing.** A 9-step modal tour that ends on the same empty dashboard teaches nothing. Fix: end every guided flow with the user having *done* the first real action; prefer do/demo empty states over tours entirely.
4. **Front-loading all setup.** Demanding integration, teammate invites, and preferences before showing any value maximizes drop-off at the most fragile moment. Fix: defer everything not strictly required for the aha; use sample data to make value visible in minute one.
5. **Checklist as feature tour.** Items like "explore analytics" and "visit settings" pad the list and dilute the path. Fix: checklist items are exactly the steps to the activation event, 3–5 items, 1–2 pre-checked.
6. **Measuring mean TTV.** One user who activates after 3 weeks drags the mean into meaninglessness. Fix: report median TTV and D1/D7 activation rate; look at the full distribution for the stuck cohort.
7. **Treating benchmarks as targets.** "We hit 30%, we're done" ignores that your ceiling depends on traffic intent and product. Fix: benchmark once for sanity, then compete only against your own previous cohorts.
8. **Redesigning before instrumenting.** Shipping a beautiful new onboarding with no event tracking means you'll never know if it worked. Fix: instrumentation is step 1 of the workflow, always.

## Output Format

Deliver results as:

1. **Activation definition** — one sentence: "A new user is activated when they [event] within [N days]," plus the evidence (retention gap or first-principles rationale, labeled hypothesis vs. validated).
2. **Funnel map** — table of steps from signup to activation: step, type (value / setup / friction), drop-off %, median time, proposed change (keep / defer / delete / redesign).
3. **First-run redesign spec** — per screen: empty-state pattern chosen (teach/do/demo) with copy, checklist contents with pre-checked items, and any tooltip triggers. Concrete enough to hand to an engineer.
4. **Instrumentation plan** — event names, properties, and where they fire (only if gaps exist).
5. **Targets and next experiment** — the one metric to move, current → target values, the single change being shipped, and how success will be read from cohort comparison.

Keep the whole deliverable skimmable: tables over prose, exact copy in quotes, and every claim tied to a metric or marked as a hypothesis.
