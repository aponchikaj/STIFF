---
name: copywriting
description: "When the user wants to write or sharpen conversion copy — headlines, landing page sections, CTAs, microcopy, or brand voice. Trigger phrases: 'write me copy', 'headline', 'landing page copy', 'CTA', 'microcopy', 'tone of voice', 'make this punchier', 'rewrite this', 'button text', 'error message copy', 'tagline', 'hero copy'. Covers persuasion frameworks (PAS, AIDA, BAB), a headline formula library, voice calibration, CTA rules, and microcopy patterns for buttons, empty states, and errors. For positioning and audience context, see product-marketing. For page structure and conversion layout, see cro. For outreach copy, see cold-email. For platform posts, see social."
metadata:
  version: 1.0.0
---

# Copywriting

Act as a senior conversion copywriter — the kind who has run hundreds of headline tests and knows that copy is decided by the reader's state of mind, not the writer's cleverness. The outcome of this skill: copy that a specific reader understands in one pass, believes without effort, and acts on — measurably better than a generic rewrite.

## Before Starting

If `.agents/product-marketing.md` exists, read it before asking the user anything. It usually covers product, audience, positioning, and competitors — only ask what it does not answer. Then ask the remaining questions from these groups (3–5 questions total, grouped in one message, never one at a time):

1. **Reader** — Who exactly reads this, and what do they already believe about the problem? (Awareness stage changes everything: someone who knows the problem needs a different headline than someone who doesn't.)
2. **Action** — What single action should this copy drive? One asset, one action.
3. **Proof** — What concrete evidence exists? Numbers, customer quotes, before/after results, logos. Copy without proof is just claims.
4. **Voice** — Any existing copy the user likes or hates? A brand voice doc? If neither, calibrate using the axes below.
5. **Surface** — Where does this live (hero, pricing page, button, error state) and what constraints apply (character limits, existing design)?

If the user gives a vague brief ("make it punchier"), ask for the current copy and the reader before rewriting. Rewriting without the original is guessing.

## Framework Selection: PAS vs AIDA vs BAB

Pick the framework from the reader's awareness, not from habit. All three work; the wrong one for the awareness stage reads as either condescending (over-explaining) or confusing (under-explaining).

| Framework | Structure | Use when | Avoid when |
|---|---|---|---|
| **PAS** (Problem → Agitate → Solve) | Name the pain, twist the knife with consequences, present the fix | Reader feels the pain but hasn't prioritized fixing it. Cold-ish traffic, problem-aware readers. Strongest for emotional/urgent problems | Reader already comparing solutions — agitation feels manipulative and wastes their time |
| **AIDA** (Attention → Interest → Desire → Action) | Hook, build relevance, stack benefits and proof, ask for the action | Longer assets where you must earn attention first: full landing pages, ads to cold audiences, launch announcements | Short surfaces (a hero has no room for four stages) or warm readers who arrived already interested |
| **BAB** (Before → After → Bridge) | Paint current state, paint transformed state, position product as the bridge | Solution-aware readers evaluating options; products where the transformation is vivid and visual. Great for demos, case studies, onboarding | Problem is abstract or the "after" state is hard to picture — the contrast falls flat |

Decision shortcut: reader doesn't know they have a problem → AIDA. Knows the problem, hasn't acted → PAS. Knows solutions exist, comparing → BAB, then proof.

## Headlines

The headline does one job: earn the next line. It is not a summary and not a slogan.

Rules that hold up across testing literature:

- **Specificity beats cleverness.** "Cut deploy time from 40 min to 4" outperforms "Ship faster" because the reader can verify it against their own life. Every abstract claim ("powerful", "seamless") is a request for trust you haven't earned.
- **Length sweet spot: 6–12 words** for hero headlines. Under 6 tends toward vague slogans; over 14 loses scanners. (Typical range from aggregated A/B literature, not a law — a 16-word headline with a killer number can win.)
- **One idea per headline.** If the draft has "and" joining two claims, split it: strongest claim in the headline, second claim in the subhead.
- **The subhead carries the mechanism.** Headline states the outcome; subhead explains how, for whom, or why it's believable. Don't cram both into one line.
- **Front-load the meaningful words.** Scanners read the first 3 words and the last 3. "Your invoices, paid in 2 days" beats "Get paid within 2 days on all your invoices."

The full formula library — 15 fill-in patterns with worked example rewrites — is in `references/swipe-file.md`. Read it when drafting headlines; draft 5–10 candidates from different formulas rather than polishing one.

Before shipping a headline, check each candidate against four questions:

1. Could a competitor paste this above their product without lying? If yes, it's positioning-free — add the mechanism or the number that only this product can claim.
2. Does a first-time reader know what the product is, or does the subhead have to rescue them? (A hero headline can be pure outcome only if the subhead names the category immediately.)
3. Is there a word doing no work? "Very", "truly", "innovative", "solutions" almost never survive this check.
4. Does it match the traffic temperature? A bold contrarian hook wastes a pricing-page visit; a plain descriptive headline wastes a cold ad impression.

## Landing Page Copy

A landing page is an argument in sections. Each section answers the objection the previous section created. Write sections in this order of persuasive jobs, then let the design/CRO side arrange them:

| Section | Job | Copy rules |
|---|---|---|
| **Hero** | What is this, for whom, why care — in 5 seconds | Headline (outcome) + subhead (mechanism + audience) + primary CTA + risk-reducer line. No paragraph text |
| **Social proof strip** | "People like me use this" | Logos or one number ("12,400 teams"). Zero copy beyond a label — proof speaks for itself |
| **Problem / stakes** | Make the cost of the status quo concrete | 2–4 sentences or 3 pain bullets in the reader's own words (mine support tickets and reviews). PAS agitation lives here |
| **How it works** | Make the promise believable via mechanism | 3 steps max, each: verb-first title + one sentence. If it needs 5 steps on the page, the product story is too complicated for a lander |
| **Benefit blocks** | Translate features into outcomes | Each block: outcome headline, feature as supporting evidence ("so you can" test — feature → so you can → benefit; ship only the right side) |
| **Objection handling** | Kill the top 2–3 reasons people leave | FAQ or short blocks. Source the objections from real sales calls and churn reasons, not imagination. Price, effort-to-switch, and "will it work for my case?" are the usual three |
| **Final CTA** | Ask again, now that the argument is complete | Restate the core outcome in fresh words (don't repeat the hero verbatim) + same primary CTA + risk-reducer |

Rules across sections:

- One argument thread. Every section must serve the single conversion action chosen in Before Starting; a section that serves a different action gets cut.
- Subheads must tell the story alone. Most visitors read only headlines and subheads — scan just those and check the argument still holds.
- Specificity budget rises down the page. The hero can be short and bold; by the objection section the reader wants details, numbers, and edge cases.
- Word count follows price and risk, not habit. A $9 self-serve tool converts fine on a short page; a $30k/yr platform needs the long-form argument. Match copy depth to the decision's weight.

## "Make This Punchier" — Edit Moves

When the user asks for punchier/tighter copy, apply these mechanical passes in order rather than rewriting freestyle (freestyle rewrites drift from the original meaning):

1. **Cut throat-clearing openers.** "In today's fast-paced world", "We believe that", "It's no secret that" — delete the whole clause; the sentence almost always survives.
2. **Convert passive to active.** "Invoices can be sent by anyone on the team" → "Anyone on the team sends invoices."
3. **Swap abstractions for their concrete instance.** "streamline workflows" → name the actual workflow: "stop re-entering orders by hand."
4. **Break long sentences at the conjunction.** Two short sentences hit harder than one compound sentence. Vary length — a 3-word sentence after two long ones is the punch.
5. **Replace each adjective with its evidence** (number, mechanism, quote) or delete it.
6. **Move the most interesting word toward the front** of the sentence and the most interesting sentence toward the front of the paragraph.
7. **Read the result aloud**; anywhere breath runs out or emphasis lands wrong, cut again.

Show the user before/after with a one-line reason per change — teaching the pattern beats delivering a mystery rewrite.

## Voice Calibration

Voice is a set of positions on axes, not an adjective ("friendly" means nothing actionable). Calibrate each axis 1–5, then write to those settings consistently.

| Axis | 1 | 5 | How it shows up in the copy |
|---|---|---|---|
| Formal ↔ Casual | "We are pleased to announce" | "Big news:" | Contractions, sentence length, slang tolerance |
| Serious ↔ Playful | Zero jokes, zero winks | Puns in error messages | Where humor is allowed (marketing pages yes, billing errors no) |
| Reserved ↔ Bold | "may help improve" | "the fastest, period" | Claim strength, willingness to name competitors |
| Technical ↔ Plain | "idempotent retries" | "we won't charge you twice" | Jargon budget; who must understand without a glossary |
| Warm ↔ Neutral | Facts only | "we've got you" | Empathy statements, especially in error and empty states |

Two rules on top of the axes:

1. **Voice flexes by surface, tone stays fixed.** A playful brand still writes its payment-failure message at Serious 1–2. Pick a "ceiling" per surface: marketing pages get full personality, transactional UI gets half, error states involving money or data loss get almost none.
2. **When calibrating from examples**, take copy the user likes, score it on the five axes, and confirm the scores back before writing. This converts "I'll know it when I see it" into a spec.

Worked example — the same sentence at two voice settings:

- Formal 2 / Serious 2 / Reserved 2 / Technical 4 / Neutral: "Payment processing failed due to a card verification error. Please update your payment method to avoid service interruption."
- Casual 4 / Playful 2 / Bold 3 / Plain 5 / Warm 4: "Your card didn't go through — usually the bank just needs a nudge. Update your card and you're set; nothing gets paused for 7 days."

Note the second version stays at Playful 2 despite the casual register: money errors keep the humor ceiling low. The extra warmth comes from the reassurance ("nothing gets paused for 7 days"), which is also a concrete fact — warmth built from information, not exclamation points.

## Benchmarks Worth Knowing

All figures below are typical ranges from aggregated case literature and platform studies — use them as sanity checks and hypothesis generators, never as guarantees, and say so when quoting them to the user.

| Metric | Typical range | Practical use |
|---|---|---|
| Hero headline length | 6–12 words | Flag drafts outside 5–14 for a second look |
| Email subject line | 4–9 words, front-load first ~30 chars | Mobile clients truncate around 30–40 characters |
| CTA button text | 2–5 words | Longer than 5 usually means the button is doing the subhead's job |
| First-person CTA lift ("my" vs "your") | Single digits to ~90% CTR lift in published tests | Cheap A/B test; huge variance, so test rather than assume |
| Risk-reducer line near CTA | Often outperforms button-text changes | Test "No credit card required" before testing button verbs |
| Cutting first-draft word count | 20–30% | If the edit pass cut less, it probably wasn't a real edit pass |
| Landing page reading level | ~6th–8th grade for broad audiences | Technical buyers tolerate more; nobody complains copy is too clear |

When the user asks "what should we A/B test first?", the leverage order is usually: headline angle (not wording) → offer/risk-reducer framing → CTA copy → body edits. Headline angle changes move conversion by multiples of what word-level polish moves it.

## CTA Copy

- **Verb first, outcome second.** "Start free trial", "Get the report", "Book a demo". A CTA is an instruction, not a label — "Free trial" (noun) underperforms "Start your free trial" (action).
- **Specificity over generic verbs.** "Get my meal plan" beats "Submit"; "See pricing" beats "Learn more". First-person possessive ("my", "your") is a cheap test with a real record — case literature commonly reports single-digit to ~90% click-through lifts for "Start my trial" vs "Start your trial" style changes (typical range, wildly context-dependent; treat any single case study number as a hypothesis).
- **Match the CTA to commitment level.** "Buy now" on first touch skips too many steps. Low-intent surface → low-friction CTA ("See how it works"); high-intent surface (pricing page) → the real ask ("Start free trial").
- **Gain framing for the button, loss framing for the surrounding copy.** Buttons work best as promises ("Get my results"); loss aversion ("Don't lose another lead") belongs in headlines and reminder copy, used sparingly — constant loss framing reads as fear-mongering.
- **Reduce risk in the click radius.** A microcopy line under the button ("No credit card required" / "Cancel anytime" / "Takes 2 minutes") often moves conversion more than the button text itself, because it answers the objection at the moment of hesitation.
- **One primary CTA per screen.** Secondary actions get visually and verbally demoted ("or take the tour").

## Microcopy Patterns

| Surface | Pattern | Example |
|---|---|---|
| **Button** | Verb + object, ≤4 words, describes what happens next — never "OK"/"Yes" for destructive actions | "Delete 3 projects" not "Are you sure? → Yes" |
| **Empty state** | What this space is + how to fill it + one-click way to start. Never just "No data" | "No invoices yet. Send your first one — it takes about a minute. [Create invoice]" |
| **Error message** | What happened + why (if known) + exactly what to do next. Never blame the user, never show raw codes as the whole message | "That card was declined by your bank. Try another card or contact your bank. (Code: 4021)" |
| **Form field help** | Answer the objection at the field: why you're asking, what format, what happens with the data | "We only use your number for delivery updates" |
| **Confirmation (destructive)** | State the consequence concretely; make the confirm button repeat the action | "This deletes 214 contacts permanently. [Delete contacts] [Keep them]" |
| **Success state** | Confirm what happened + the natural next step | "Invoice sent to acme.co. Track it here." |
| **Loading / waiting** | Say what's happening if >2s; give a time estimate if >10s | "Analyzing 1,400 rows — about 20 seconds" |

Error messages get the most attention per word of any copy in the product: the reader is frustrated and paying full attention. Budget accordingly.

## Workflow

1. Read `.agents/product-marketing.md` if it exists; ask only the gap questions from Before Starting.
2. Identify the reader's awareness stage and pick a framework from the decision table. State the choice and the reason in one line — the user should be able to veto it.
3. Set voice: score the five axes (from the brand doc, provided examples, or explicit questions) and note any per-surface ceiling.
4. Collect proof before writing. List every concrete number, quote, and result available. If there is no proof, tell the user — and write around the gap with specificity of mechanism instead of unsupported claims.
5. Draft headlines first: 5–10 candidates using different formulas from `references/swipe-file.md`, not variations of one idea. Mark your top pick and say why in one line each for the top three.
6. Draft the body in the chosen framework. Write the CTA and its risk-reducing microcopy line together as a unit.
7. Cut pass: delete every adjective that a competitor could also claim ("powerful", "intuitive", "seamless"), every sentence that repeats a prior sentence's job, and every idea that doesn't serve the single action. Aim to cut 20–30% of the first draft's word count.
8. Read it aloud test: rewrite any sentence you stumbled on. If a sentence needs re-reading, it's the sentence's fault.
9. Deliver in the Output Format below, including the one-line rationale so the user can evaluate the thinking, not just the words.

## Common Mistakes

1. **Writing about the product instead of the reader.** "We built an AI-powered platform" → "Stop copy-pasting between five tools." Fix: the word "you" should appear before the word "we" in almost every asset.
2. **Clever over clear.** Puns and wordplay in headlines cost comprehension on the first pass, and there is no second pass. Fix: clarity in the headline, personality in the subhead and body.
3. **Stacked adjectives instead of evidence.** "Blazing-fast, seamless, powerful" is three claims with zero proof. Fix: replace each adjective with a number, a mechanism, or a customer quote — or cut it.
4. **Multiple competing CTAs.** "Sign up", "Book a demo", and "Read the docs" given equal weight splits intent three ways. Fix: one primary action per screen; demote the rest.
5. **Same voice on every surface.** Jokes in a payment-failure message; corporate stiffness in onboarding. Fix: apply the per-surface voice ceiling from Voice Calibration.
6. **Burying the offer.** Three paragraphs of scene-setting before saying what the product does. Fix: a first-time visitor must be able to answer "what is this and who is it for?" within the headline + subhead.
7. **Loss framing everywhere.** Constant "Don't miss out / Don't lose customers" fatigues readers and erodes trust. Fix: default to gain framing; reserve loss framing for genuinely time-bound or high-stakes moments.
8. **Editing by adding.** First drafts get "improved" by inserting qualifiers and extra benefits until nothing stands out. Fix: the edit pass removes words (target 20–30% shorter); if a new idea must go in, an old one comes out.

## Output Format

Deliver copy as ready-to-paste text, structured like this:

```
## [Asset name — e.g. Hero section]

**Framework:** PAS (reader is problem-aware; agitation earns the solution)
**Voice:** Casual 4 / Playful 2 / Bold 4 / Plain 4 / Warm 3

**Headline (recommended):** ...
**Subhead:** ...
**Body:** ...
**CTA:** [Button text] — supporting line: "..."

**Headline alternates:**
1. "..." — [formula used, one-line why]
2. "..." — [formula used, one-line why]

**Rationale:** 2–3 sentences on the key choices, so edits preserve the strategy.
```

For microcopy requests, deliver a table (surface → copy → note) instead. For rewrites, show before/after pairs with a one-line reason per change. Always mark any benchmark or lift figure as a typical range from case literature, not a guarantee.
