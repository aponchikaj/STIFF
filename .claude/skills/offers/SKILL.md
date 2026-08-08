---
name: offers
description: "When the user wants to construct or strengthen a commercial offer — the value proposition, stack, guarantee, and buying pressure around a product. Triggers: \"make this irresistible\", \"bonuses\", \"guarantee\", \"scarcity\", \"urgency\", \"bundle\", \"no one is buying\". Covers the value equation, offer stacks and objection-killing bonuses, risk reversal, ethical scarcity and urgency, offer naming, and decoy/anchor structuring. For the underlying price and tiers, see pricing. For writing the offer copy, see copywriting. For referral incentives, see referrals."
metadata:
  version: 1.0.0
---

# Offers

Act as an offer strategist in the tradition of direct-response marketing: someone who has watched identical products succeed or fail purely on how the offer was constructed. The product is a fixed input; the offer is everything wrapped around it — the promise, the stack, the guarantee, the deadline, the name. The outcome of this skill is a complete, buildable offer specification the user can hand to a copywriter or drop onto a landing page, where every element exists to raise perceived value or lower perceived risk, and nothing is decorative.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it usually covers the product, audience, and positioning. Only ask what it does not cover. Ask these in grouped batches, not one at a time:

1. **Product and outcome:** What is the product, what concrete result does a successful customer get, and how long does that result take today?
2. **Audience and objections:** Who buys, and what are the top 2–3 reasons prospects say no or go silent? (If the user doesn't know, ask what the last three lost deals said.)
3. **Economics and proof:** Price point, margin room for bonuses or guarantees, and what proof exists (case studies, numbers, testimonials).
4. **Constraints:** Real capacity limits, real dates (cohort starts, launch windows), and anything legally or brand-wise off the table.

Do not ask about pricing tiers in depth (route to pricing) or copy tone (route to copywriting).

## The Value Equation

Perceived value is a ratio, not a sum:

> **Value = (Dream Outcome × Perceived Likelihood of Achievement) ÷ (Time Delay × Effort and Sacrifice)**

| Lever | What raises it | Typical instrument |
|---|---|---|
| Dream outcome | Promise the end state, not the tool ("rank #1" not "SEO software") | Headline promise, offer name |
| Perceived likelihood | Proof, specificity, guarantees, "done-with-you" elements | Case studies, guarantee, onboarding call |
| Time delay (÷) | Faster first result, quick wins before the big win | Templates, done-for-you setup, "first result in 7 days" |
| Effort and sacrifice (÷) | Remove steps the customer must take | Migration service, pre-filled assets, checklists |

The division matters: halving time-to-result doubles perceived value even if the outcome is unchanged. Most weak offers over-invest in the numerator (bigger promises) when the fastest gains are in the denominator (less waiting, less work). Audit every proposed element against exactly one lever; if it doesn't move any, cut it.

## Diagnosing "No One Is Buying"

When the trigger is a stalled launch rather than a new build, diagnose before redesigning. Offer surgery on a traffic problem wastes weeks.

| Symptom pattern | Likely problem | It is probably NOT | First move |
|---|---|---|---|
| Low traffic, few sales | Distribution | The offer | Fix traffic first; revisit the offer only with 200+ qualified visitors of data |
| Traffic but no clicks past the headline | Dream outcome / promise | Bonuses or guarantee | Rewrite the core promise (step 4 of the workflow) |
| Clicks, reads, but no checkout starts | Perceived likelihood or price framing | The product | Add proof, restructure anchor/decoy, strengthen guarantee |
| Checkout starts, then abandonment | Risk or effort at the finish line | The promise | Move the guarantee and "what happens after I buy" answer onto the checkout itself |
| Sales, then refunds | Overclaimed promise or slow first result | Marketing volume | Shrink the claim or engineer a faster first win; check guarantee window vs. time-to-result |
| One-time buyers, no repeat/referral | Delivery, not the offer | More bonuses | Route to product work; a better offer for a weak product just accelerates refunds |

Ask which pattern matches before touching the stack. If the user has no funnel numbers at all, that absence is the finding — recommend instrumenting before restructuring.

## Offer Stack Construction

The core product answers "what do I get." Bonuses answer "but what about..." — each bonus exists to kill one named objection. A bonus that doesn't map to an objection is padding and lowers credibility.

**Objection → bonus mapping:**

| Objection in the prospect's head | Bonus that kills it | Example |
|---|---|---|
| "I won't have time to implement this" | Done-for-you or done-with-you component | Free setup call, migration service |
| "This won't work for my specific case" | Niche-specific templates or playbooks | "Agency edition" template pack |
| "I'll get stuck and have no help" | Access or support bonus | 30 days of Slack support, weekly office hours |
| "I can't get my team/spouse/boss on board" | Stakeholder-facing asset | ROI calculator, one-page internal pitch deck |
| "I've bought things like this and never used them" | Accountability or activation bonus | Kickoff call, 14-day activation checklist |
| "It's too expensive right now" | Fast-payback bonus | "First client in 30 days" playbook |
| "What happens after I buy — then what?" | Roadmap or continuity bonus | 90-day implementation calendar |

Rules for the stack:
- 3–5 bonuses. Beyond that, each addition dilutes the others and signals desperation.
- Name each bonus like a product and assign it an honest standalone value. "$197 value" must be defensible — a price someone actually pays for a comparable thing, not an invented number. Inflated bonus values are the fastest way to make the whole offer feel fake.
- Stack total should land at 3–10× the price. 100× reads as fiction.
- Order the stack by the strength of the objection it kills, strongest first.

## Risk Reversal

The guarantee transfers risk from buyer to seller. Choose by refund economics and result attributability:

| Guarantee type | Structure | Use when | Avoid when |
|---|---|---|---|
| Unconditional | "Any reason, full refund, X days" | Low marginal cost (digital, SaaS), high-trust brand play; refund rates under ~10% are normal | High-cost fulfillment (services, hardware) where serial refunders are expensive |
| Conditional | "Refund if you did the work and didn't get X" (defined completion criteria) | Result depends on customer action; filters non-implementers while protecting real buyers | Conditions are so onerous the guarantee reads as a trap — that's worse than none |
| Performance | "You don't pay until/unless outcome X" or "we work free until X" | Outcome is measurable, largely attributable to you, and margins support it (agencies, lead gen) | Outcome depends heavily on client execution or market luck |
| Anti-guarantee | "All sales final — because you get X immediately" | Consumable value delivered instantly (revealed information, access) | Any offer where trust is the bottleneck |

Sizing: the guarantee window should exceed the time-to-first-result, ideally by 2×. A 30-day guarantee on a product whose first result takes 60 days is a broken promise wearing a bow. Longer windows usually *lower* refund rates — urgency to refund fades once the deadline pressure is gone.

Wording templates — a guarantee is only as strong as its specificity:

- Unconditional: "Try [offer] for 60 days. If it's not for you — any reason, no questions — email us and we refund every cent."
- Conditional: "Complete the 4 implementation modules and attend 2 coaching calls within 90 days. If you haven't landed [specific result], we refund you in full." The conditions must be things a serious buyer would do anyway — never busywork designed to disqualify.
- Performance: "If we don't deliver [measurable outcome] within [period], we keep working at no charge until we do" — or the stronger form, "you pay nothing until [outcome]."

Name the guarantee like a product ("The Ship-It-or-Free Guarantee") — a named guarantee is quoted and remembered; an unnamed one is fine print.

## Ethical Scarcity and Urgency

Scarcity (limited units) and urgency (limited time) only work when true, and fake versions are not just sleazy — evergreen countdown timers that reset per visitor and false "only 2 left" claims destroy trust on the second visit and can violate consumer protection law (e.g., FTC deceptive practices rules, EU Unfair Commercial Practices Directive).

Legitimate sources, in order of preference:
1. **Real capacity:** onboarding bandwidth, cohort seats, support load. State the actual number and honor it.
2. **Real calendar:** cohort start dates, price increases you actually execute, seasonal relevance.
3. **Bonus expiry:** the core offer stays; a specific bonus is available until a real date. Weaker but honest, and it lets you run recurring deadlines without lying about the product.
4. **Cost-based deadlines:** launch pricing that genuinely ends because early buyers subsidize development.

If no real constraint exists, create one (cap a cohort, schedule a price increase and keep it) or run without scarcity. An offer with no deadline converts slower but doesn't poison the brand.

Enforcement is what makes the constraint real:

- State the number or date on the page and never quietly extend it. One "extended by popular demand" is survivable; two makes every future deadline a suggestion.
- When a cap fills, close it publicly and open a waitlist — the visible closure is what makes the next cohort's cap credible, and the waitlist becomes launch-day demand.
- Typical honest deadline arc: announce → one reminder mid-window → a final-day notice stating exactly what disappears and when. Roughly half of deadline-driven sales land in the final 24 hours; that spike comes from the deadline being believed, not from the number of reminders.
- If the price rises after the deadline, it must actually rise. Grandfather existing buyers, never new ones.

## Naming and Structuring the Offer

Name the offer after the outcome and, when possible, a timeframe or mechanism: "The 90-Day Pipeline Sprint" beats "Premium Consulting Package." Test names against the question: could a stranger guess what they get and roughly how fast?

Reliable naming patterns:

| Pattern | Formula | Example |
|---|---|---|
| Outcome + timeframe | [Result] in [period] | "First Client in 30 Days" |
| Named mechanism | The [distinctive method] System/Method | "The Cold-Email Compounder" |
| Audience + outcome | [Who] to [result] | "Freelancer to Agency Accelerator" |
| Enemy/problem flip | Kill/End/Escape [pain] | "The Churn-Killer Program" |

Avoid tier metals (Gold/Platinum), internal jargon, and clever puns that need the sales page to decode. If a name needs explaining, it is a slogan, not a name.

**Decoy and anchor structuring.** Present the offer against reference points that make it the obvious choice:

| Slot | Role | Construction |
|---|---|---|
| Anchor | Sets the price ceiling | A genuinely available high-end option (done-for-you, 1:1) at 3–5× the target price — must be real and occasionally bought |
| Target | The offer you built | Gets the full stack, guarantee, and deadline |
| Decoy | Makes the target look complete | A stripped option close in price to the target but missing the objection-killing bonuses — the gap in value must be obvious at a glance |

Two options create a coin flip; three create a comparison the target wins. Keep the decoy honest: it must be a real product someone could reasonably buy, just clearly dominated for most buyers. (Detailed tier pricing belongs to the pricing skill — here you only decide the *structural* roles.)

## Workflow

1. Read `.agents/product-marketing.md` if present; ask only the uncovered Before Starting questions.
2. Score the current offer (or bare product) on all four value-equation levers, 1–5 each. Identify the weakest lever — that's where the offer work concentrates.
3. List the top 3–5 objections verbatim, in the customer's words. Pull from lost-deal reasons, support tickets, or the user's answers — do not invent polite objections.
4. Design the core promise: outcome + timeframe + mechanism. Rewrite until it moves the dream-outcome or time-delay lever explicitly.
5. Build the stack: map each objection to one bonus using the table above, name each bonus, assign defensible values, order strongest-objection first.
6. Select the guarantee from the decision table based on refund economics and attributability; set the window to 2× time-to-first-result; draft the exact guarantee sentence.
7. Choose a scarcity/urgency source from the legitimate list, or explicitly decide to run without one. Record the real constraint and who enforces it.
8. Name the offer; structure anchor/target/decoy roles.
9. Assemble the Output Format below, then stress-test: read the finished offer as a skeptical prospect and list what still feels unbelievable. Fix believability before adding more value — an unbelievable $10k stack loses to a believable $2k one.

## Common Mistakes

1. **Stacking value without stacking proof.** Every claim raises the believability bar. Fix: pair each major stack element with one piece of evidence, or shrink the claim to what you can prove.
2. **Bonuses that are just more content.** Three extra ebooks kill zero objections and add effort (denominator up, value down). Fix: delete any bonus you cannot map to a row in the objection table.
3. **Fake or recycled deadlines.** A countdown that resets teaches prospects to ignore all your deadlines forever, and regulators treat fabricated scarcity as deception. Fix: use bonus expiry or real cohort caps; if nothing is real, run without urgency.
4. **Guarantee mismatch.** A 14-day guarantee on a 60-day result, or a performance guarantee on an outcome the client controls. Fix: window ≥ 2× time-to-first-result; pick the guarantee type from the decision table, not from what competitors do.
5. **Discounting instead of adding value.** Cutting price lowers perceived likelihood ("why so cheap?") and trains buyers to wait for sales. Fix: hold price, add an objection-killing bonus or shorten time-to-result.
6. **Naming the container, not the outcome.** "Gold Package" forces the prospect to do the valuation work. Fix: outcome + timeframe naming, tested on someone outside the company.
7. **Solving the wrong lever.** Pumping the dream outcome ("10x your revenue!") when the real blocker is perceived likelihood or effort. Fix: run the four-lever score in step 2 first and spend the offer budget on the lowest score.
8. **Inflated bonus valuations.** "$4,997 value" on a PDF collapses trust in the real numbers around it. Fix: value each bonus at a price a comparable item actually sells for, and be ready to say where.

## Output Format

Deliver the offer as a single specification with these sections, in order:

1. **Offer name** — outcome + timeframe/mechanism, with one alternate.
2. **Core promise** — one sentence: who gets what result, by when, via what mechanism.
3. **Value-equation audit** — the four lever scores (before → after) and the primary lever this offer moves.
4. **The stack** — table: element, objection it kills, standalone value with one-line justification; stack total vs. price.
5. **Guarantee** — type, exact customer-facing wording, window, and the refund-economics reasoning.
6. **Scarcity/urgency** — the real constraint, the exact claim, and who enforces it (or a note that the offer runs without one and why).
7. **Structure** — anchor / target / decoy roles and what differentiates each.
8. **Believability check** — the 2–3 weakest claims and the proof needed before launch.
9. **Handoffs** — open items for pricing (tier prices), copywriting (page and email copy), and referrals (incentive design), so adjacent skills pick up cleanly.

Keep the specification concrete enough that a landing page could be built from it without a follow-up conversation.
