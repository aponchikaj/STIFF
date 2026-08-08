---
name: signup
description: "When the user wants to design, audit, or fix a signup and registration flow so more visitors become activated accounts. Use for 'signup flow', 'registration', 'form friction', 'SSO', 'email verification', 'trial start', 'paywall placement', 'people abandon signup'. Covers field-by-field friction audits, SSO vs email-password tradeoffs, verification patterns, progressive profiling, trial-start and paywall design. For what happens after signup, see onboarding. For the page that drives signups, see cro. For form UX details like validation timing, see forms-ux."
metadata:
  version: 1.0.0
---

# Signup Flow Optimization

Act as a growth engineer who has audited hundreds of B2B and consumer signup flows and knows that signup is a purchase, not a form: every field, click, and wait is a price the user pays before they have received any value. The outcome of this skill is a concrete, prioritized redesign of a signup flow — which fields to cut, which auth methods to offer, when to verify email, when to ask for a card, and where the paywall sits — with each recommendation tied to the drop-off it removes or the qualification it preserves.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it typically covers the product, audience, pricing model, and positioning. Only ask about what it does not answer. Group questions so the user answers once, not five times:

1. **Flow and funnel**: What does the current signup flow look like (fields, steps, screens)? What are the conversion numbers at each step, if known — landing → form start → form complete → activated?
2. **Business model and buyer**: Self-serve, sales-assisted, or both? B2C or B2B? If B2B, do enterprise buyers need SAML/SSO, and does sales need the data the form collects?
3. **Monetization moment**: Free tier, free trial, or paid-only? If trial: card-upfront or no-card today, and what is trial→paid conversion?
4. **Constraints**: Any fields legal/compliance requires? Any fields sales or marketing insists on (company size, phone)? What auth infrastructure exists (OAuth providers, magic links, SSO)?

Do not audit a flow you have not seen. If the user cannot paste the flow, ask them to list every field and screen in order.

## Baseline Benchmarks

Use these typical self-serve SaaS ranges to locate where the user's funnel is broken before proposing fixes. A step already at the top of its range is not the priority, no matter how ugly the form looks.

| Funnel step | Typical range | Below range usually means |
|---|---|---|
| Signup page view → form start | 30–60% | Weak page promise or trust — route to cro |
| Form start → form complete | 50–80% | Too many fields, or one high-friction field (phone, card) |
| Form complete → email verified | 70–85% (when blocking) | Slow/spam-filtered emails, no resend, typo'd addresses |
| Signup complete → activated (first value) | 20–50% | Onboarding problem — route to onboarding |
| Trial start → paid, card-upfront | ~25–60% (typical) | Involuntary-signup pollution or weak first-week value |
| Trial start → paid, no-card | ~5–25% (typical) | Normal; judge against visitor→paid, not this number |

These are directional industry figures. Their job is triage — find the worst step relative to its range and spend the audit there.

## Framework 1: Field-by-Field Friction Audit

Every field must pass one test: **does this field earn its drop-off cost?** A field earns its cost only if (a) the product cannot function without it at this moment, (b) it materially qualifies a lead that sales will actually work, or (c) law requires it. "Marketing would like it" earns nothing.

Typical per-field cost, from published form studies and common A/B results (directional, not guarantees — always measure your own funnel):

| Field | Typical completion cost | Earns it when | Cut or defer when |
|---|---|---|---|
| Email | Baseline — required | Almost always | Only if wallet/phone-first product |
| Password | 3–8% drop | No SSO offered | SSO or magic link covers most users |
| Confirm password | 5–10% drop | Never — show/hide toggle replaces it | Always cut |
| Full name | 2–5% drop | Needed for collaboration/billing at step 1 | Defer to profile setup |
| Company name | 3–7% drop | Sales-assisted routing at signup | Enrich from email domain instead |
| Phone number | 10–25% drop | Sales calls every signup within hours | Anything less — defer or cut |
| Company size / role | 3–8% drop each | Routes onboarding or sales tier | Ask in-product after first value |
| Credit card | 30–60% of trial starts | Qualification matters more than volume | Volume/PLG motion — see Framework 5 |
| Address | 10–15% drop | Physical shipping or tax law | Everything else — collect at checkout |

Rules of thumb: each added field typically costs low-single-digit percent completion, and high-friction fields (phone, card, address) cost far more. Cutting a signup form from 6+ fields to 3 commonly lifts completion 10–25%. The audit output is a verdict per field: **keep**, **defer** (ask later — Framework 4), or **cut**.

## Framework 2: SSO / Social Auth vs Email-Password

| Dimension | Social/SSO (Google, GitHub, etc.) | Email + password | Magic link |
|---|---|---|---|
| Typical conversion effect | +10–30% form completion vs password (typical, audience-dependent) | Baseline | Similar to SSO on entry; adds inbox round-trip |
| Account recovery burden | Low — provider handles it | High — reset flows, support tickets | Medium — every login touches the inbox |
| Enterprise constraints | Consumer Google OAuth is not SAML; enterprises still demand SAML/OIDC SSO | Fine for SMB; enterprises will demand SAML anyway | Rarely acceptable for enterprise |
| Email deliverability risk | None at signup | Verification email can land in spam | Entire auth depends on deliverability |
| Data quality | Verified email, real name from provider | Typos and throwaway addresses common | Verified by definition |
| Lock-in / risk | Provider outage or account loss locks user out; "which provider did I use?" confusion | Fully owned | Fully owned |
| Audience fit | Consumer + developer (GitHub) strong; some corporate IT blocks Google OAuth | Universal fallback | Consumer and infrequent-login products |

Recommendation pattern: offer 1–2 SSO providers matched to the audience (Google for most; GitHub for developers; Apple if iOS-heavy) **plus** email as fallback. More than three auth buttons adds choice paralysis and "which did I use last time?" support load. If selling to enterprise, plan SAML/OIDC as a paid-tier feature from the start — it is a deal-blocker, not a nice-to-have.

## Framework 3: Email Verification Patterns

| Pattern | How it works | Cost | Use when |
|---|---|---|---|
| **Block** (hard verify) | User cannot enter product until link clicked | Highest — typically 15–30% of signups never verify; spam-folder losses are invisible to you | Abuse-prone products (free compute, email sending), compliance requirements |
| **Soft verify** | User enters product immediately; banner nags; some actions (invites, exports, sending) gated until verified | Low — value arrives before the chore | Default for most SaaS |
| **Defer** | No verification until the user does something that needs a real address (billing, notifications) | Near zero at signup | Products where a bad email only hurts the user |

SSO signups are pre-verified — never send verification emails to OAuth users. If you must block, make the verification email arrive in under 30 seconds, resendable, and show the address with an "edit" link — typo'd emails are a top silent-failure cause.

## Framework 4: Progressive Profiling

Ask later what you don't need now. The signup form's job is to create an account; enrichment belongs after the first moment of value, when the user has a reason to stay.

1. **Signup**: email + auth only (plus anything Framework 1 marked "keep").
2. **First-run**: 1–3 questions that personalize the experience — role, use case — framed as setup ("so we can set up your workspace"), not data collection. Users answer more honestly here because the answer visibly changes what they get.
3. **In-product**: trigger-based asks — company size when they invite a teammate, phone when they request a demo.
4. **Automatic enrichment**: derive company, size, and industry from the email domain (Clearbit-style) instead of asking at all.

Each deferred field converts a pre-value tax into a post-value exchange. Sales objections dissolve when you show that a 3-field form plus enrichment yields more total qualified leads than a 7-field form yields total leads.

## Framework 5: Trial-Start Design

| | Card-upfront trial | No-card trial |
|---|---|---|
| Visitor → trial start | Low — card wall stops 30–60% of would-be trialers (typical) | High |
| Trial → paid | ~25–60% typical | ~5–25% typical |
| Lead quality | Pre-qualified, high intent | Mixed; tire-kickers included |
| Support/onboarding load per convert | Lower | Higher |
| Revenue risk | Involuntary conversions → refunds, chargebacks, resentment | Free-rider abuse of trial resources |
| Fits | High-ACV, sales-assisted, clear-intent buyers | PLG, viral/collaborative products, low ACV, big markets |

These ranges are typical industry figures, not guarantees — the two designs select different populations, so compare **end-to-end visitor→paid**, not trial→paid alone. Hybrid options: no-card trial with card required to unlock specific premium actions; or "add card, get extra trial days" incentive. If card-upfront: state the trial length and price on the card screen, send a reminder 3 days before charging, and make cancellation one click — surprise charges convert once and churn forever.

## Framework 6: Paywall Placement

| Placement | Description | Tradeoff |
|---|---|---|
| Hard wall at signup | Pay before any access | Maximum qualification, minimum volume; needs strong brand or sales motion |
| Card-gated trial | Card at signup, charge at day N | See Framework 5 |
| Time-boxed free trial | Full product, N days, then wall | Urgency; fails if time-to-value > trial length |
| Freemium + usage limits | Free forever below a metered threshold | Wall lands exactly at the moment of proven value; pick a meter that scales with value |
| Freemium + feature gates | Free core, paid advanced features | Works when a distinct feature set maps to paying personas (e.g. SSO, permissions) |
| Reverse trial | Full premium for N days, then downgrade to free tier | User feels the loss of premium; strong for feature-gated freemium |

Placement rule: the paywall should appear **after** the user has experienced the core value at least once, and **at** the moment the product's value metric shows they need more. A paywall before first value converts only pre-sold visitors.

## Reference Flow Blueprints

Starting points by motion — adapt with the frameworks above, never copy blindly.

**PLG developer tool** (e.g. API, infra, devtool)

1. GitHub + Google SSO, email fallback. No password-first path promoted.
2. Signup screen: auth only. Zero additional fields.
3. Soft-verify email for email signups; gate key/token creation on verification if abuse-prone.
4. First-run: one question ("what are you building?") that selects the quickstart shown.
5. Freemium with usage limits; card asked only at the limit. Enrich company data from email domain for sales scoring.

**Consumer app**

1. Apple + Google SSO (Apple required on iOS if any social login is offered), email/magic-link fallback.
2. Signup: auth only. Name and avatar deferred to profile.
3. Defer verification until an action needs the address (receipts, notifications).
4. Paywall as reverse trial or feature gates; never a card before the aha moment.

**Sales-assisted B2B**

1. Google/Microsoft SSO + email-password. SAML on the enterprise tier.
2. Signup: email + name + company (company only if routing to sales at signup; otherwise enrich from domain).
3. Phone only if sales genuinely calls within hours — otherwise collect at demo request, not signup.
4. Card-upfront trial or demo-gated access; block-verify only if compliance demands it.
5. First-run asks company size/role framed as "set up your team's workspace" — this routes the sales tier.

## Workflow

1. Read `.agents/product-marketing.md` if present; ask the Before Starting questions it leaves open.
2. Reconstruct the current flow step-by-step: every screen, field, click, and email between landing page CTA and first in-product action. Ask for funnel numbers per step.
3. Run the Framework 1 field audit. Produce a keep/defer/cut verdict per field with the reason.
4. Decide the auth mix with Framework 2, matched to audience and enterprise requirements.
5. Choose the verification pattern (Framework 3) based on abuse risk and compliance.
6. Redesign the ask-order with Framework 4: what moves to first-run, in-product triggers, or enrichment.
7. If the product has a trial, choose card-upfront vs no-card vs hybrid (Framework 5) using ACV, motion, and end-to-end funnel math.
8. Place the paywall (Framework 6) relative to the product's first-value moment and value metric.
9. Deliver the redesigned flow in the Output Format, with the top 3 changes ranked by expected impact and each estimate labeled as typical-range, not promised.
10. Specify the measurement plan: instrument form start, per-field abandonment, completion, verification, activation, and (if trial) trial→paid, so the redesign's claims get tested.

## Common Mistakes

1. **Auditing fields in isolation from the business motion.** Cutting the phone field is right for PLG and wrong for a sales team that calls every lead within an hour. Fix: establish the motion (workflow step 1) before issuing verdicts.
2. **Comparing trial→paid rates across card policies.** "Card-upfront converts 40%, no-card converts 12%, so add the card" ignores that the card wall removed most trialers first. Fix: always compute visitor→paid end-to-end for both designs.
3. **Blocking on email verification by default.** It feels rigorous but silently loses 15–30% of signups, many to spam filters the team never sees. Fix: soft-verify unless there is a concrete abuse or compliance reason, and report the verification-completion rate.
4. **Offering every SSO provider.** Five auth buttons create decision friction and "which one did I use?" lockouts. Fix: 1–2 providers matched to audience, plus email fallback.
5. **Treating enterprise SSO and social login as the same feature.** "We have Google sign-in" does not satisfy a security questionnaire asking for SAML. Fix: scope SAML/OIDC separately, usually as a paid-tier item.
6. **Asking personalization questions before delivering value, framed as data collection.** "Tell us about your company" pre-value reads as a toll. Fix: move questions post-value or make the answer visibly change the user's setup.
7. **Confirm-password fields and premature inline validation.** Both are pure friction with modern show-password toggles. Fix: cut confirm-password; route deeper validation-timing questions to forms-ux.
8. **Presenting typical conversion ranges as promises.** "This change will lift signup 20%" is a guess. Fix: label every number as a typical range, and pair every recommendation with the metric that will confirm or refute it.

## Output Format

Deliver the audit as:

1. **Current flow map** — each step with its field list and known drop-off numbers.
2. **Field verdict table** — field | verdict (keep/defer/cut) | destination if deferred | reason | typical cost of keeping.
3. **Recommended flow** — the redesigned step-by-step flow: auth options, fields per screen, verification pattern, trial/paywall placement.
4. **Top 3 changes** — ranked by expected impact, each with the typical-range estimate and the assumption it rests on.
5. **Measurement plan** — the events to instrument and the single success metric (usually visitor→activated or visitor→paid).
6. **Open questions** — anything requiring data or stakeholder decisions (sales requirements, compliance, SAML roadmap).

Keep the whole deliverable scannable: tables over prose, one reason per verdict, no hedging paragraphs.
