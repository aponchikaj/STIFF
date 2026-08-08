---
name: referrals
description: "When the user wants to design, build, or fix a referral program that turns existing users into a repeatable acquisition channel. Use for 'referral program', 'viral loop', 'word of mouth', 'invite flow', 'affiliate', 'k-factor', 'get users to share'. Covers viral loop math (k-factor, cycle time), incentive structure selection, ask timing, invite-flow UX, referral vs affiliate programs, and fraud guards. For when to ask (post-activation), see onboarding. For incentive economics, see offers. For measuring lift, see ab-testing. For shareable content loops, see social."
metadata:
  version: 1.0.0
---

# Referral Program Design

Act as a growth engineer who has shipped referral programs at consumer and B2B SaaS companies and knows that most referral programs fail quietly — not from bad incentives, but from asking the wrong users at the wrong moment and never measuring cycle time. The outcome of this skill: a referral program spec with honest k-factor projections, an incentive structure matched to the product's economics, an ask-timing map tied to value moments, an invite-flow wireframe, and fraud guards — ready to hand to engineering.

## Before Starting

If `.agents/product-marketing.md` exists, read it first and only ask what it does not cover. Then ask these grouped questions (3–5 total, batched in one message):

1. **Product and economics**: What does the product do, what is the LTV of a typical user, and what is current CAC from paid channels? (Referral incentive budget should sit well below blended CAC — typically 30–60% of it, since referred users convert and retain better.)
2. **Value moment**: What action tells you a user "got it"? (First successful export, first payout received, hit a usage milestone.) When does it typically happen — day 1, week 2?
3. **Current sharing behavior**: Do users already share organically (screenshots, links, word of mouth)? What do they share and where?
4. **Volume**: Monthly active users and monthly new signups. (A referral program on 500 MAU is a distraction; on 50,000 it is a channel.)
5. **Constraints**: Can you offer cash, account credit, or feature unlocks? Any legal/regulatory limits (fintech and health products often can't pay cash for referrals)?

## Loop Math

The core equation:

**k = (invites sent per user) × (conversion rate per invite)**

If 20% of users send invites, senders average 3 invites each, and 12% of invites convert to activated users: k = (0.20 × 3) × 0.12 = **0.072**. Every 1,000 new users generate 72 more.

Two truths that kill naive plans:

- **k > 1 means self-sustaining growth. Almost nothing achieves it.** Viral-era outliers (early Dropbox, PayPal) briefly exceeded 1. Real, healthy programs live at **k = 0.15–0.4** — that is not failure, it is a 15–40% amplifier on every other channel. At k = 0.3, 1,000 paid signups become 1,000 + 300 + 90 + 27 ≈ 1,428 users — a 43% discount on effective CAC, compounding forever.
- **Cycle time matters as much as k.** k = 0.3 with a 3-day cycle (invite → signup → activation → they invite) outgrows k = 0.5 with a 60-day cycle over any quarter. Model growth as k^(days elapsed / cycle days), not k per month. Shortening cycle time (faster activation, earlier ask) is often cheaper than raising k.

The interaction between the two, starting from 1,000 seed users over 90 days (total users including seed):

| | 7-day cycle | 21-day cycle | 60-day cycle |
|---|---|---|---|
| k = 0.15 | ~1,176 | ~1,174 | ~1,168 |
| k = 0.30 | ~1,428 | ~1,425 | ~1,390 |
| k = 0.50 | ~1,995 | ~1,940 | ~1,750 |

At low k, cycle time barely matters; as k climbs, a slow loop leaves real growth on the table. Practical order of operations: get k above ~0.15 first (incentive + ask timing), then attack cycle time (activation speed, ask placement), then optimize the invite flow for marginal k.

Decompose k into its four levers and improve the weakest one:

| Lever | Typical range | How to move it |
|---|---|---|
| % of users who see the ask | 30–90% | Placement: post-value-moment prompt beats buried settings page |
| % of those who send | 5–25% | Incentive clarity, prefilled message, one-tap share |
| Invites per sender | 2–5 | Contact picker, "invite 3, unlock X" framing |
| Invite → activated conversion | 5–20% | Landing page names the referrer, recipient-side incentive |

## Incentive Design

| Structure | What it is | Best fit | Example |
|---|---|---|---|
| Two-sided, product credit | Both sides get in-product value | Products where usage compounds; low marginal cost | Dropbox: 500 MB free space to both sides — cost near zero, reward reinforced the core product. Drove ~35% of daily signups at peak |
| Two-sided, cash | Both sides get money | High-LTV products where a referred user is worth $100+ | PayPal: $10–$20 to each side; expensive (~$60M total) but LTV of a transacting user justified it |
| One-sided (referrer only) | Only the sender is paid | When recipients already have strong intent; discourage mercenary signups | B2B tools where the recipient's incentive is the product itself |
| One-sided (recipient only) | Only the new user gets a deal | When senders share for status/altruism, not money; brand-sensitive products | "Give $20" framing with no sender payout — feels like a gift, not a commission |
| Feature unlocks | Referring unlocks tiers or capabilities | Freemium products with clear gated features | "Invite 3 friends to unlock advanced analytics" |

Rules of thumb:

- **Two-sided beats one-sided in almost every test** — the recipient-side incentive lifts invite conversion 2–3x because the sender is now giving a gift, not extracting a bounty.
- **Credit beats cash when your product has margin headroom**: a $20 account credit costs you far less than $20 and keeps the reward inside the product. Cash wins only when credit is meaningless to the recipient (they are not a user yet and may never be).
- **Cap total earnable rewards** (e.g., Dropbox capped at 16 GB) so the program cannot become a full-time job.
- Size the reward against LTV, not gut feel: reward per activated referral should be 10–30% of first-year gross profit per user. If you cannot afford that, fix unit economics before building referrals.

Worked example: a SaaS product at $30/month, 80% gross margin, 14-month average retention has first-year gross profit of about $288. A defensible two-sided reward is $30 credit to each side ($60 total, ~21% of first-year gross profit, and true cost is lower because credit is consumed at margin). Compare that to the paid channel: if blended CAC is $150, each activated referral acquired at $60 nominal cost is a clear win — and referred users typically retain better, widening the gap.

## Ask Timing

Ask after value delivery, never before. The single biggest determinant of send rate is whether the user was feeling successful when asked.

- **NPS 9–10 responders**: route promoters directly into the referral flow from the survey. Detractors get a support flow, never an ask.
- **Post-success actions**: just completed a project, received a payout, hit a milestone, got a result they screenshotted. Trigger the ask within that session, in context.
- **Never on first open, never mid-task, never in an error state.** An ask before activation trains users to dismiss the prompt forever.
- Re-ask cadence: after a dismissal, wait for the next distinct value moment (not a timer). Cap at roughly one ask per 2–4 weeks per user.

Concrete trigger examples by product type:

| Product type | Value moment to hook | Why it works |
|---|---|---|
| Fintech / payments | Payout or transfer confirmed | Money just arrived; trust and delight peak simultaneously |
| Design / creation tool | Export, publish, or first share of work | The user is already in sharing mode — the ask rides existing intent |
| Fitness / habit app | Streak milestone or goal hit | Achievement moments beg to be told; pair the ask with the share card |
| B2B SaaS | Report sent to a stakeholder, seat invite accepted, renewal | The user just demonstrated the product's value to someone else |
| Marketplace | 5-star review submitted, repeat purchase | A review is a referral in miniature; convert the sentiment while hot |

The persistent entry point (a "Refer a friend" item in settings or account menu) should still exist — some users go looking for it — but it will drive under 10% of sends. The triggered, in-context ask does the work.

## Invite-Flow UX

- **Prefill everything**: message copy, subject line, link. The user should edit, not compose. Blank text boxes cut sends by half or more.
- **Match share targets to where the audience actually talks**: WhatsApp/SMS for consumer, email/Slack for B2B, plus a copyable link as universal fallback. Order targets by observed usage, not alphabet.
- **The link must carry attribution** (unique per user), survive app-install redirects (deferred deep links on mobile), and land on a page that names the referrer and states the recipient's reward above the fold.
- **Show progress**: "2 of 3 friends joined — 1 more to unlock X" converts pending referrals into follow-ups by the sender.
- Keep the flow to two taps: see prompt → pick channel → send. Every added step halves completion.

Prefilled message copy that works follows one shape — reward first, sender's voice, no marketing tone:

> "I use [Product] for [job]. Sign up with my link and we both get [reward]: [link]"

Avoid copy that sounds like the company wrote it ("Discover the amazing power of..."). The message is sent from a friend's number or inbox; it must read like a friend. Write 2–3 channel-specific variants in the spec — SMS wants under 160 characters, email can carry a sentence of context, and the copy-link fallback should be the link alone plus a one-line blurb the user can paste anywhere.

Landing page requirements, in priority order: (1) referrer's name or avatar visible without scrolling — "Alex sent you $20 off" converts far better than a generic signup page; (2) the recipient's reward stated explicitly; (3) a single call to action; (4) the referral code pre-applied, never typed by hand. Manual code entry at checkout is where mobile referral conversion goes to die.

## Referral vs Affiliate

| | Referral | Affiliate |
|---|---|---|
| Who shares | Existing users | Third parties (creators, publishers, agencies) |
| Motivation | Product love + modest reward | Commission income |
| Reward | Credit, unlocks, small cash | Cash, % of revenue, recurring commission |
| Trust signal | High (personal recommendation) | Lower (audience knows it's paid) |
| Management | Product feature, automated | Partner program: contracts, dashboards, payout ops, tax forms |
| Scale ceiling | Bounded by user base × k | Bounded by partner recruitment |

Do not blend them. Affiliates paid like referrers churn; users paid like affiliates spam. If the user asks for "affiliate," confirm whether they mean users sharing (referral) or a partner commission program (affiliate) — the spec, tooling, and legal posture differ completely.

Running both is fine and common (many companies do), but keep them separate in every dimension: different links and attribution namespaces, different reward ledgers, different terms of service. Two collision rules to write down early: an affiliate's own signup never earns their commission, and when a click carries both an affiliate tag and a referral code, pay exactly one side (last-touch wins is the simple, defensible default). Affiliates also require paperwork users do not — payout tax forms above reporting thresholds, FTC-style disclosure requirements for promoted links, and a partner agreement with termination terms.

## Fraud Guards

Ship these with v1, not after the first incident:

- **Delay rewards until activation**, not signup. Pay when the referred user completes the value moment (first purchase, 7-day retention, KYC pass). This one rule eliminates most fraud.
- **Self-referral detection**: match device fingerprint, IP, payment instrument, and email patterns (plus-addressing, disposable domains) between referrer and referee. Block silently — flagging teaches fraudsters your rules.
- **Payout thresholds**: batch small rewards (pay at $25 accrued, not per referral) to raise the effort floor and reduce payout ops cost.
- **Velocity limits**: cap referrals per user per day/month; queue accounts exceeding limits for manual review instead of auto-paying.
- **Clawback terms** in the program TOS for refunded/chargeback referrals, and an audit log of every reward event.

Cash programs need all five. Credit/unlock programs can run lighter (fraud steals margin, not money) but still need self-referral detection and activation-gated rewards.

## Workflow

1. **Gather context** per Before Starting. Establish LTV, CAC, MAU, value moment, and whether organic sharing already exists.
2. **Set the target honestly.** Project k from the four-lever table using conservative rates; state the realistic band (usually 0.1–0.3 at launch) and the cycle time. Compute the effective CAC discount so stakeholders judge the program as an amplifier, not a growth engine.
3. **Choose the incentive structure** from the incentive table. Default to two-sided credit; justify any deviation against margin, legal constraints, and what recipients value pre-signup. Set reward size at 10–30% of first-year gross profit and cap total earnings.
4. **Map ask moments.** List the product's value moments, pick the top 2–3, and specify trigger conditions (event, not timer), placement, and re-ask rules. Wire NPS promoters into the flow if a survey exists.
5. **Spec the invite flow**: prefilled message copy (write it), share-target order, attribution link behavior, referrer-named landing page, and the sender's progress view.
6. **Spec fraud guards** matched to reward type: activation-gated payout, self-referral checks, thresholds, velocity limits, clawback terms.
7. **Define measurement**: instrument each of the four k levers separately, track cycle time, and cohort referred vs non-referred users on retention and LTV (referred users typically retain 15–25% better — if they don't, the incentive is attracting mercenaries). Hand lift measurement to ab-testing.
8. **Deliver the spec** in the Output Format below and flag open decisions for the user.

Health benchmarks to judge a live program against:

| Metric | Weak | Healthy | Suspicious (investigate) |
|---|---|---|---|
| Users who ever send an invite | < 5% | 10–25% | > 40% (check for forced/incentivized spam) |
| Invite → activated conversion | < 3% | 8–20% | > 35% (check for self-referral fraud) |
| k-factor | < 0.05 | 0.15–0.4 | > 0.7 sustained (audit before celebrating) |
| Referred-user 90-day retention vs baseline | worse | +15–25% | — |
| Reward cost per activated referral vs blended CAC | > 80% | 30–60% | < 10% (reward likely too small to motivate) |

## Common Mistakes

1. **Chasing k > 1.** Teams kill programs that "only" hit k = 0.25 — a 25% compounding discount on all acquisition. Fix: set the target as CAC amplification, not virality, and report effective CAC alongside k.
2. **Asking at signup.** The user has received zero value and the prompt trains permanent dismissal. Fix: gate every ask behind a completed value moment.
3. **Ignoring cycle time.** A program measured only on k looks fine while a 45-day loop strangles compounding. Fix: instrument invite→activation time and treat shortening it as equal priority to raising k.
4. **One-sided rewards by default.** Sender-only bounties make sharing feel mercenary and gut invite conversion. Fix: default two-sided; if budget forces one side, pay the recipient.
5. **Paying on signup.** Guarantees a fake-account industry the week incentives go live. Fix: pay on activation with velocity limits and self-referral detection from day one.
6. **Blank-box invite flows.** "Add a personal note" with an empty field halves sends. Fix: prefill copy the user can edit, and reduce the flow to two taps.
7. **Confusing referral with affiliate.** Running creators through the in-product referral flow (or paying users recurring commissions) breaks both economics and tone. Fix: separate programs, separate tooling, separate rewards.
8. **Not cohorting referred users.** If referred users retain worse than baseline, the program is buying churn with margin. Fix: compare retention/LTV of referred vs non-referred cohorts monthly; cut or restructure incentives that attract mercenaries.

## Output Format

Deliver the spec as a single document with these sections:

1. **Program summary** — one paragraph: structure, target k band, cycle time, effective CAC impact.
2. **Loop model** — table of the four k levers with assumed rates, projected k, cycle time, and 90-day user projection at those numbers.
3. **Incentive spec** — structure chosen, reward sizes both sides, cost per activated referral vs LTV, earning cap, rationale.
4. **Ask-timing map** — table: trigger event → placement → copy → re-ask rule.
5. **Invite flow** — step list with prefilled message copy, share targets in order, link/attribution behavior, landing-page requirements.
6. **Fraud guards** — checklist matched to reward type.
7. **Instrumentation** — events to track per lever, cycle-time metric, referred-cohort retention comparison; note which tests route to ab-testing.
8. **Open decisions** — anything requiring user input, each with a recommended default.
