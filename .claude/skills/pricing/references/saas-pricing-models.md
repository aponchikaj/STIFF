# SaaS Pricing Models — Model-by-Model Deep Dive

Companion reference to the pricing skill. Each section covers how the model works, when
it wins, when it fails, real operators using it, typical numbers, and migration notes.

## Table of Contents

1. [Flat-Rate](#1-flat-rate)
2. [Per-Seat (Per-User)](#2-per-seat-per-user)
3. [Per-Active-User](#3-per-active-user)
4. [Usage-Based (Pure Consumption)](#4-usage-based-pure-consumption)
5. [Credit-Based](#5-credit-based)
6. [Tiered Feature-Based (Good/Better/Best)](#6-tiered-feature-based-goodbetterbest)
7. [Hybrid: Platform Fee + Usage](#7-hybrid-platform-fee--usage)
8. [Freemium](#8-freemium)
9. [Free Trial and Reverse Trial](#9-free-trial-and-reverse-trial)
10. [Outcome-Based](#10-outcome-based)
11. [Open-Core / Open-Source Commercial](#11-open-core--open-source-commercial)
12. [Enterprise Custom / Negotiated](#12-enterprise-custom--negotiated)
13. [Model Comparison Matrix](#13-model-comparison-matrix)
14. [Choosing and Migrating](#14-choosing-and-migrating)

---

## 1. Flat-Rate

One product, one price, everything included. `$99/mo, all features, unlimited use.`

**How it works.** A single subscription price regardless of team size or usage. The
purest form of predictability.

**Wins when:**
- The buyer is a small business owner who wants zero bill anxiety and zero math.
- The product's value doesn't vary much across customers (a scheduling page, a status
  page, a simple monitoring tool).
- You compete against complex pricers and want "simple" as a positioning weapon.
- Marginal cost per customer is low and roughly uniform.

**Fails when:**
- Customer value varies 100x (a 5-person shop and a 5,000-person company pay the same —
  you are massively underpricing the big one).
- Usage costs vary widely (your heaviest 5% of customers can eat all margin).
- Expansion revenue matters to your growth model — flat-rate has structurally ~100% NRR
  ceiling before churn; there is nothing to expand into.

**Operators.** Basecamp is the canonical case: $299/mo flat, unlimited users — a
deliberate positioning statement against per-seat incumbents. Superhuman started at a
flat $30/user (per-seat but single-plan simplicity). Many indie SaaS products
($19–$99/mo) live here.

**Typical numbers.** SMB flat rates cluster at $9/19/29/49/99. Above ~$300/mo flat,
buyers start expecting tiering.

**Migration notes.** Flat-rate to tiered is the most common first repricing: keep the
flat price as the middle tier, add a capped cheaper tier and an expanded top tier.
Grandfather existing customers at the old price for 6–12 months.

---

## 2. Per-Seat (Per-User)

`$25/user/month.` The default B2B SaaS model for two decades.

**How it works.** Price scales linearly with provisioned users. Usually combined with
feature tiers (per-seat price differs by tier).

**Wins when:**
- Value genuinely scales with people using it (CRM: each rep with a license sells more;
  design tools: each designer creates).
- Buyers budget headcount-linked software spend easily — finance teams understand
  seats better than any other metric.
- You sell to teams that grow; land small, expand with the org.

**Fails when:**
- One seat serves many (dashboards, reporting, admin tools) — value leaks to non-payers
  and honest customers feel punished.
- It taxes collaboration: buyers ration seats, adoption stalls, and your champion has
  to beg for licenses. Seat-rationing is the leading indicator of per-seat mispricing.
- AI does the work: when an agent replaces the humans who would have held seats, seat
  count shrinks as delivered value grows — the metric moves inversely to value. This is
  why 2023–2026 saw broad movement away from pure per-seat in AI-heavy products.

**Operators.** Salesforce ($25–$500/user/mo across editions), Figma ($15–$75/editor/mo
— note the fence: only *editors* pay, viewers are free, which fixes the collaboration
tax), Notion, Linear, Slack (per-active-user variant, below).

**Typical numbers.** SMB tools $8–$25/seat; mid-market $25–$75; enterprise editions
$75–$300+. Annual discount 15–20%.

**Design details that matter:**
- **Editor/viewer split** (Figma, Airtable): charge only roles that create value,
  let consumption roles ride free. Dramatically improves the value-scaling score.
- **Minimum seats** (e.g., 5-seat minimum) protect deal size but add friction at the
  low end.
- **True-up vs true-down:** enterprise contracts usually true-up quarterly (you pay for
  added seats) but only true-down at renewal. Say this clearly in the order form.

**Migration notes.** Per-seat to hybrid (platform + usage) is the current common path
for AI products: freeze seat price, introduce a usage component (credits, runs, tasks)
on new value, keep existing contracts whole until renewal.

---

## 3. Per-Active-User

Per-seat, but you only pay for users who actually used the product that month.

**How it works.** Provisioning is free; billing is based on monthly active users, often
with a "fair billing" true-down.

**Wins when:**
- Deployment is org-wide but adoption is uncertain — removes the buyer's biggest
  per-seat objection ("I'll pay for 500 licenses and 200 will log in").
- You're the challenger displacing an incumbent that charges for shelfware.

**Fails when:**
- Revenue forecasting matters more than deal velocity — MAU-billed revenue is noisier.
- "Active" is hard to define defensibly (a single login? an action?). A generous
  definition gives away revenue; a stingy one feels like a trick.

**Operators.** Slack pioneered "fair billing" — you're credited for inactive users.
Many HR/benefits platforms bill per-employee-per-month (PEPM), a cousin where the
metric is total employees, not active users ($2–$15 PEPM typical).

**Migration notes.** Easy to adopt from per-seat as a competitive move; hard to retreat
from without a visible price increase. Define "active" in the contract, not the FAQ.

---

## 4. Usage-Based (Pure Consumption)

`$0.008 per GB-second.` Pay for exactly what you use, often with volume discounts.

**How it works.** Metered consumption of an infrastructure-like unit: API calls,
compute, storage, messages, minutes, rows, tokens. Usually prepaid commitments earn
discounts; on-demand pays list.

**Wins when:**
- The product is infrastructure and usage is a near-perfect proxy for value delivered
  (Twilio message = message sent; Snowflake credit = query run).
- Buyers start tiny — usage-based removes all adoption friction; the first dollar of
  spend follows the first unit of value.
- Expansion is your growth engine: usage-based leaders routinely post 120–160% NRR
  (Snowflake ran ~170% at IPO) because revenue rides customer growth automatically.

**Fails when:**
- The buyer can't predict the bill: procurement hates open-ended exposure; developers
  fear the $10k surprise. Unpredictability is the #1 stated objection to usage pricing.
- Usage doesn't track value (charging per login, per report viewed) — you've built a
  tax on engagement.
- Your revenue is now pro-cyclical: customer cost-cutting hits you instantly (2022–23
  cloud "optimization" wave cut consumption-revenue growth across the sector).
- Sales comp and forecasting aren't rebuilt for it — reps can't be paid on committed
  ARR that may not consume.

**Operators.** AWS, Twilio ($0.0079/SMS), Stripe (2.9% + 30¢ — a take-rate variant),
Snowflake (credits/compute-hour), OpenAI API (per-token), Datadog (per-host +
per-GB hybrid).

**Design details that matter:**
- **Commit-and-drawdown:** annual committed spend at a discount, drawn down by usage
  (Snowflake, AWS EDP). Gives you forecastability and the buyer a discount; the
  standard enterprise wrapper around consumption.
- **Spend caps and alerts:** offer hard caps and budget alerts prominently. Fear of
  runaway bills suppresses usage more than the bills themselves cost.
- **Volume tiers:** published price breaks (first 1M calls at X, next 9M at 0.8X)
  reduce the perceived punishment for growth.
- **Pick a unit you can defend for a decade.** Changing the meter later is the hardest
  migration in SaaS.

**Migration notes.** Pure usage to hybrid is common once you move upmarket: add a
platform/support fee and committed contracts. The reverse (subscription to pure usage)
usually passes through a hybrid stage for years.

---

## 5. Credit-Based

Buy or receive a pool of credits; features consume credits at set rates.

**How it works.** An abstraction layer over usage: 1 credit = 1 email verification =
0.5 image generations = 2 API calls, etc. Credits come with the plan and/or are bought
in packs, often expiring monthly or annually.

**Wins when:**
- You have many heterogeneous actions with different costs (especially AI products
  mixing cheap and expensive model calls) and need one currency across them.
- You want plan simplicity on the pricing page with usage economics underneath.
- Prepaid packs improve cash flow and breakage (unused expired credits) adds margin.

**Fails when:**
- The conversion table becomes a research project — credits score worst of all models
  on "easy to understand," and buyers assume worst-case burn rates.
- Expiration policies feel punitive; "I paid for these" disputes are a support tax.
- You quietly change consumption rates: this reads as a stealth price increase and
  burns trust faster than an honest list-price change.

**Operators.** OpenAI (API prepaid credits), Midjourney (fast-hours), HeyGen/Synthesia
(video credits), Clay (credits per enrichment), Apollo, Zapier (tasks — effectively
credits with one action type).

**Design details that matter:**
- Publish the consumption table and version it; give 30+ days notice on rate changes.
- Roll over at least some unused credits (e.g., up to 1 month's worth) — full
  forfeiture is the most-hated policy in the model.
- Show a live burn-rate meter in-app; predictability must be manufactured since the
  model doesn't provide it naturally.

**Migration notes.** Credit models are the standard landing zone for AI features bolted
onto seat-based products: seats stay, AI actions consume credits, overage packs sold
separately.

---

## 6. Tiered Feature-Based (Good/Better/Best)

Three packages fenced by features and/or caps; the SaaS pricing-page default.

**How it works.** Not a value metric itself but a packaging layer on top of one
(per-seat tiers, usage-capped tiers, flat tiers). Covered structurally in SKILL.md's
tier-design section; this section adds the model-level view.

**Wins when:**
- Segments differ in *which capabilities* they need, not just how much they use
  (solo user vs team vs org with compliance requirements).
- You need one pricing page to serve self-serve SMB and sales-assisted mid-market.

**Fails when:**
- Fences are arbitrary (features assigned to tiers by internal politics, not buyer
  segments) — buyers stall or buy the wrong tier and churn.
- Genuine value drivers are all in the top tier, making the middle tier a lie; or
  security basics (SSO!) are held hostage in Enterprise — the "SSO tax" generates real
  resentment and public shaming (sso.tax). Charge for admin scale, not for safety.

**Operators.** Practically everyone: HubSpot (Starter/Professional/Enterprise per
hub), Zoom, Atlassian, Mailchimp (tiers x contact-count grid — a tier-usage matrix).

**Typical numbers.** Tier ratios 1 : 2.5 : 6 (e.g., $29/$79/$199). Target-tier mix
goal: 60–70% of new revenue in the middle tier; >40% landing in the bottom tier means
the middle fence is too weak.

**Migration notes.** Repackaging tiers (moving features between them) for *new*
customers is low-risk if existing customers are grandfathered; removing features from a
tier customers already bought is the highest-churn action in pricing — avoid, or swap
with compensating value.

---

## 7. Hybrid: Platform Fee + Usage

`$500/mo platform fee including 10k units; $0.04/unit after.` The dominant emerging
model in modern SaaS, especially AI products.

**How it works.** A recurring subscription (per tier or per seat) buys access and an
included usage allowance; consumption beyond the allowance bills as overage or
draws from committed spend.

**Wins when:**
- You need both stability and scaling: the platform fee gives you forecastable ARR and
  the buyer a predictable floor; the usage component captures the 10x customer.
- Different stakeholders want different things: finance wants the fixed fee,
  procurement wants caps, your CFO wants NRR — hybrid gives each a handle.
- AI economics: seats no longer proxy value and pure usage scares buyers; platform +
  credits is the current equilibrium (Intercom's Fin at $0.99/resolution rides on a
  seat subscription; Cursor's $20/seat with usage-based fast-request pools; Datadog's
  per-host + per-GB).

**Fails when:**
- The included allowance is set wrong: too generous and the usage line never bills
  (you've built flat-rate with extra billing infrastructure); too stingy and every
  invoice has surprise overages (you've imported usage-pricing's anxiety while keeping
  a subscription's rigidity).
- Two meters confuse the pricing page. Hybrid needs *more* communication discipline,
  not less.

**Typical numbers.** Included allowance sized so ~60–80% of customers on a tier stay
within it in a normal month; overage unit price set 10–30% above the effective
included rate to nudge upgrades to the next tier or a commit.

**Migration notes.** Hybrid is the safest destination from both directions: per-seat
products add a usage component on new (usually AI) value; usage products add a
platform fee when moving upmarket. Introduce the second axis only on new value or new
customers — re-metering existing revenue is where migrations die.

---

## 8. Freemium

A permanently free tier as the top of the acquisition funnel.

**How it works.** Free tier capped on the value metric (users, storage, volume,
projects); paid tiers remove caps and add features. Decision criteria are in SKILL.md;
this section covers operating the model.

**Wins when** (all three, ideally): marginal cost of a free user is near zero; free
users have a viral surface (invites, shared artifacts, watermarks, network effects);
the market is large enough that 2–5% conversion still yields a business.

**Fails when:** free users cost real money (AI inference, human support), the free tier
fully satisfies the core need forever (no upgrade wall), or the funnel is too small —
3% of a small number is a hobby.

**Operators and their walls.** Dropbox (2GB storage wall, viral via shared folders and
referral space), Slack (10k-message history wall — the message *disappearing* was the
upgrade trigger; searchable history is the product), Zoom (40-minute meeting wall —
felt by every participant, mid-meeting), Notion (block cap for teams), Canva
(premium assets + brand kit), GitHub (private repo limits historically, now
Actions minutes).

**Benchmarks.** Free-to-paid conversion: 2–5% typical, ~3% median; 6–10% good;
Slack-at-peak ~30% *of teams that hit the wall* (measure conversion of
wall-hitters, not all signups — it's the actionable number). Time-to-convert median
~2–4 months. A free tier that converts <1% and shows no viral coefficient >0.2 is a
cost center wearing a growth costume.

**Design details that matter:**
- Cap on the value metric so the wall arrives *because the user succeeded*.
- Make the wall visible before it hits (progress meters: "8.4k of 10k messages").
- Instrument the wall: conversion rate at the wall is your key freemium metric.
- Revisit free-tier generosity yearly; markets and your costs move (many AI products
  cut free tiers in 2023–25 as inference costs made free users materially expensive).

---

## 9. Free Trial and Reverse Trial

Time-boxed full access (trial), or full access that decays to a free tier
(reverse trial).

**How it works.**
- **Opt-in trial:** no card required; 7/14/30 days. Converts ~8–12% (median), higher
  with strong onboarding.
- **Opt-out trial:** card required, auto-converts; 40–60% convert, but 3–10x fewer
  people start, and involuntary conversions churn early. Net-net roughly comparable
  customer volume with worse goodwill; use when your funnel has high intent.
- **Reverse trial:** everyone gets the paid tier for 14 days, then lands on free.
  Combines trial urgency with freemium's long-tail nurture; the user has *felt* the
  premium features they lose. Strong default for product-led B2B (popularized by
  Airtable, used by Notion-style products).

**Trial length:** shortest time in which a motivated user reaches the value moment.
14 days is the B2B default; 7 for simple tools; 30 only when setup genuinely takes
weeks (data-heavy products). Longer trials mostly delay decisions, not improve them —
extending on request costs nothing and converts better than defaulting long.

**Design details that matter:**
- Optimize time-to-first-value inside the trial; trial conversion is an onboarding
  metric wearing a pricing hat.
- Send a "here's what you did with the product" summary email before expiry — convert
  on demonstrated value, not countdown fear.
- Let users extend once, self-serve. The extension click identifies your highest-intent
  pipeline for free.

---

## 10. Outcome-Based

Pay per result: per resolved ticket, per qualified lead, per hire, per % of
recovered revenue.

**How it works.** The meter is the *outcome* the buyer actually wants, not an input or
activity. The logical endpoint of value-based pricing.

**Wins when:**
- The outcome is unambiguous, attributable, and measured by a system both sides trust
  (a support ticket resolved without human handoff; a chargeback recovered).
- You're selling against a labor line item, not a software budget — "$2 per resolution
  vs $8 per human resolution" is a comparison a CFO closes on.
- AI agents doing complete jobs: this is why outcome pricing surged 2024–26.

**Fails when:**
- Attribution is contested (did the lead convert because of you?) — every invoice
  becomes a negotiation.
- The vendor controls the outcome definition (moral hazard: an "auto-resolved" ticket
  the customer reopens angrier).
- Buyers need budget certainty: pure outcome pricing has the worst bill
  predictability of any model; nearly all real deployments wrap it in commits or caps.

**Operators.** Intercom Fin: $0.99 per AI-resolved conversation (the flagship case —
note the definition work: "resolved" = user confirms or doesn't reply then doesn't
reopen). Zendesk AI per automated resolution. Affirm-style take rates and Stripe's
2.9% are outcome-adjacent (pay per successful transaction). Recruiting marketplaces
per hire (15–25% of salary).

**Design details that matter:**
- Write the outcome definition with the customer's lawyers, not after.
- Offer a hybrid wrapper: platform fee + outcome fee with a monthly cap.
- Price against the displaced alternative's unit cost (human resolution cost, agency
  cost-per-lead), typically capturing 20–50% of the delta.

---

## 11. Open-Core / Open-Source Commercial

Free open-source core; paid tiers for hosting, scale, security, and compliance.

**How it works.** The OSS project is the funnel (freemium's cousin, with the free tier
distributed as software). Monetization via: managed cloud (most common), enterprise
features (SSO, RBAC, audit), support/SLA contracts, or licensing (BSL-style
restrictions on competitors).

**Wins when:** developer adoption is the wedge; the buyer of the paid tier (platform
team, CISO) is distinct from the user of the free core (developer); self-hosting is
real work you can charge to remove.

**Fails when:** the core is too complete (nothing to sell) or too crippled (community
revolt, fork risk); or a hyperscaler can host your own project against you — the reason
Elastic, MongoDB, Redis, and HashiCorp relicensed.

**Operators.** GitLab (open core + tiers), Supabase and Vercel (managed cloud for OSS),
Grafana, Sentry, HashiCorp (BSL). Typical split: cloud revenue dominates and grows
fastest; support-only contracts are a shrinking model.

**Fencing rule of thumb:** individual-developer value stays free; organizational-scale
value (SSO, audit, RBAC, multi-tenant admin, SLAs) is paid. Fence on *who needs it*,
not *how good it is*.

---

## 12. Enterprise Custom / Negotiated

"Contact us." Price built per deal from a rate card.

**How it works.** A internal (never public) rate card prices components — platform,
seats/usage bands, premium support, security add-ons, services — and deal desk
composes and discounts within guardrails.

**Wins when:** deals exceed roughly $50–100k ACV, procurement demands negotiation
anyway, requirements genuinely vary (deployment model, SLAs, liability terms), or
publishing your top price would anchor big buyers low.

**Fails when:** used to hide an unremarkable $500/mo price — friction without benefit;
or when no rate card exists and every deal is improvised (pricing drift, discount
leakage, quota-driven giveaways).

**Design details that matter:**
- Maintain the rate card and measure realized-vs-list by rep and segment.
- Publish the *existence* of the lower tiers' prices even if Enterprise is custom —
  full price opacity suppresses inbound.
- Standard enterprise mechanics: annual or multi-year prepay, ramp schedules
  (year 1 discounted, year 2–3 step up), true-up terms, renewal caps (buyers will ask
  for 5–7% increase caps; agree only with multi-year commitment).

---

## 13. Model Comparison Matrix

| Model | Scales with value | Buyer predictability | Adoption friction | NRR potential | Revenue forecastability | Best-fit stage |
|---|---|---|---|---|---|---|
| Flat-rate | Poor | Excellent | Lowest | ~100% ceiling | Excellent | Early, SMB, simple products |
| Per-seat | Fair (good for people-tools) | Excellent | Medium (seat rationing) | 105–115% | Excellent | Team collaboration, sales-led |
| Per-active-user | Fair | Good | Low | 105–115% | Good | Org-wide deployments |
| Usage-based | Excellent | Poor | Lowest | 120–170% | Fair (good with commits) | Infra, dev tools, APIs |
| Credit-based | Good | Poor–fair | Low | 110–140% | Good (prepaid) | AI products, mixed actions |
| Tiered feature | Depends on underlying metric | Excellent | Low | 100–120% | Excellent | Everyone (packaging layer) |
| Hybrid platform+usage | Very good | Good | Low–medium | 115–140% | Good | Scale-ups, AI SaaS |
| Freemium (+paid) | n/a (acquisition) | Excellent | None | — | — | Big-market PLG |
| Outcome-based | Excellent (by definition) | Worst | Low | High but volatile | Poor without caps | AI agents, attributable results |
| Open-core | Good (via cloud) | Good | None for core | 110–130% | Good | Dev-infra with OSS wedge |
| Enterprise custom | Good (negotiated) | Good (fixed contracts) | Highest | 110–125% | Excellent | >$50k ACV, sales-led |

---

## 14. Choosing and Migrating

**Choosing — three questions, in order:**

1. **What is the unit of value?** (SKILL.md's value-metric criteria.) The model follows
   the metric: people-shaped value → seat family; consumption-shaped → usage family;
   result-shaped → outcome; mixed → hybrid.
2. **How does the buyer buy?** Self-serve card swipe wants published tiers and low
   friction (flat, tiered, freemium/trial). Procurement wants commits, caps, and
   negotiation (hybrid with commits, enterprise custom).
3. **What does your growth model need?** Expansion-led growth needs a metric that grows
   inside accounts (usage, hybrid). Logo-led growth tolerates flat/seat. If investors
   price you on NRR, do not choose a ~100%-NRR-ceiling model.

**Migration principles (any model to any model):**

- **Change the meter for new customers first.** Existing contracts migrate at renewal,
  with 60–90 days notice and a side-by-side "your bill under old vs new" statement.
- **Grandfather visibly and finitely.** "Your price is locked for 12 months" earns
  goodwill; open-ended grandfathering creates a permanent shadow price list.
- **Never re-meter and re-price simultaneously.** Change the metric at revenue-neutral
  rates first; adjust price levels a cycle later. Two variables at once makes churn
  attribution impossible.
- **Model the whole base before announcing.** Compute every customer's new bill; cap
  individual increases (e.g., no account's bill rises >20% in year 1) even if the new
  model says otherwise — the model is right on average and wrong per-account.
- **Watch, in order:** target-tier/plan mix of new deals (first 30 days), win rate at
  list (first quarter), NRR and logo churn of migrated cohorts (first year).
