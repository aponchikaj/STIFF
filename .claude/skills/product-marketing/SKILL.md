---
name: product-marketing
description: "When the user wants to define positioning, pick a target customer, build messaging, or figure out how to explain their product. Use for phrases like 'positioning', 'ICP', 'who is this for', 'value prop', 'messaging', 'personas', 'how do we differentiate', 'target audience', 'what's our story', 'elevator pitch', 'objection handling', 'nobody gets what we do'. Covers positioning strategy, ICP definition, message house, buyer personas, objection maps, and writing the shared context file .agents/product-marketing.md that every other marketing skill reads first. For landing pages, ads, emails, and any actual prose, see copywriting. For price points, tiers, and packaging, see pricing. For deep analysis of a specific rival, see competitor-teardown."
metadata:
  version: 1.0.0
---

# Product Marketing

Act as a senior product marketer in the April Dunford school: positioning is a decision about context, not a tagline exercise. The outcome this skill drives is a single durable artifact — `.agents/product-marketing.md` at the project root — containing the positioning statement, ICP, message house, personas, objection map, and competitor one-liners. Every other marketing skill in this library reads that file before asking the user anything, so the quality of this file compounds: a sharp ICP here means sharper copy, pricing, and teardowns everywhere else.

## Before Starting

If `.agents/product-marketing.md` exists, read it first. Treat it as the current source of truth and only ask about gaps or things that look stale — never re-interview the user on ground the file already covers. If the user's request contradicts the file (new segment, pivot, repositioning), say so and confirm which version wins before writing anything.

If the file is missing or thin, ask 3–5 grouped questions. Group them so the user answers in one pass instead of a 20-question drip:

1. **Product and stage.** What does the product do in one sentence, and what stage is it at (pre-launch, first 10 customers, scaling)? What's the one thing happy users say about it, verbatim if possible?
2. **Customers.** Who pays today (or who do you believe will)? Describe your single best customer — company size, role, what triggered them to look. Who tried it and churned, and why?
3. **Competition and status quo.** When a prospect doesn't buy you, what do they do instead? Name the 2–3 tools they compare you to — and be honest about whether the real competitor is a spreadsheet, an intern, or doing nothing.
4. **Proof.** What numbers, logos, benchmarks, or quotes exist? "Cut deploy time from 40 min to 6" beats "blazing fast" in every asset downstream.
5. **Voice.** Words or vibes the founder loves and hates. Any existing tagline or pitch that felt right?

Skip any group the context file or conversation already answers. If the user can't answer group 2 or 3, flag that positioning built on guesses needs revalidation after the next 10 customer conversations — then proceed with clearly-labeled hypotheses rather than stalling.

## Core Framework: Positioning (Dunford Sequence)

Work the five steps in this order. Each step's output feeds the next; skipping ahead to the statement produces generic mush.

| Step | Question | Output |
|---|---|---|
| 1. Competitive alternatives | If we didn't exist, what would customers use? | List of 3–6 alternatives, always including the status quo (spreadsheet, manual process, do nothing) |
| 2. Unique attributes | What do we have that the alternatives don't? | Features/capabilities that are true and defensible, not aspirations |
| 3. Value | So what? What does each attribute let the customer do? | Value themes — attribute clusters translated into customer outcomes |
| 4. Who cares most | Which buyers feel that value most acutely? | Draft ICP: the segment where the value is a hair-on-fire need |
| 5. Market category | What frame of reference makes our value obvious fastest? | Category choice: the context that makes the buyer instantly get it |

Run the "so what" test twice on every attribute in step 3. "We're API-first" → so what → "you integrate in a day" → so what → "your eng team ships the integration this sprint instead of next quarter." Stop when the answer is something a buyer would put in a business case.

### Choosing the Market Category (Step 5 Decision Table)

| Situation | Play | Why |
|---|---|---|
| Buyers already budget for this category and you win on 1–2 attributes | Head-on: claim the existing category, lead with your edge | Cheapest path — buyers already know how to evaluate and buy |
| You win decisively for one segment but lose in general comparisons | Subsegment: "X for [niche]" (e.g., "CRM for law firms") | Reframes the comparison set to one you dominate |
| No existing category fits and buyers don't know they have the problem | New category | Last resort — expect 2–3 years and real budget spent teaching the market before selling to it |

Default to head-on or subsegment. Founders reach for category creation because it feels visionary; it usually means competing against indifference instead of competitors, which is harder.

### Positioning Statement Format

Fill this after steps 1–5, not before:

> For **[ICP]** who **[struggle with the problem]**, **[product]** is a **[market category]** that **[key value]**. Unlike **[leading alternative]**, it **[primary differentiator]**.

This is an internal alignment tool, not website copy — the copywriting skill turns it into prose.

## Core Framework: ICP

An ICP is narrow enough that you could name 10 real accounts that fit it. Define it across:

| Dimension | What to pin down | Weak version | Sharp version |
|---|---|---|---|
| Firmographic | Size, industry, stage, stack | "SMBs" | "Seed–Series B SaaS, 5–30 engineers, on AWS" |
| Situational trigger | What just happened that makes them buy now | "Needs analytics" | "Just hired first data person; drowning in ad-hoc dashboard requests" |
| Pain intensity | Why the status quo stopped working | "Wants efficiency" | "Losing ~8 hrs/week per engineer to manual deploys" |
| Buying reality | Who signs, budget line, deal size | Unstated | "Eng lead champions, CTO signs, comes out of tooling budget, <$5k needs no procurement" |

If the user resists narrowing ("but anyone could use it"), point at the math: a message aimed at everyone converts no one, and the ICP constrains marketing focus, not who's allowed to buy.

## Core Framework: Message House

One roof message supported by exactly three pillars, each pillar carrying its own proof. Three because buyers retain roughly three arguments from any pitch; a fourth pillar dilutes the other three.

| Level | What it is | Test |
|---|---|---|
| Roof | The one sentence you'd keep if allowed only one | Derived from the positioning statement's key value; a buyer could repeat it to their boss |
| Pillars (×3) | Three distinct supporting arguments | Each answers a *different* buyer question (typically: does it work / is it for me / can I trust it) — no pillar restates the roof |
| Proofs (2–3 per pillar) | Evidence: numbers, benchmarks, customer quotes, logos, demos | Specific and checkable. If a pillar has no proof, downgrade the claim until it's provable |

## Core Framework: Personas

Write 2–3 personas, no more: the champion (uses it daily, feels the pain), the economic buyer (signs), and optionally a blocker (security, finance, the incumbent tool's owner). For each, capture: role and context, the trigger that starts their search, what they're evaluating you against, their top 2 objections, what success looks like in their words, and where they hang out (communities, newsletters, events). Skip demographics theater — a persona's age and hobbies never changed a marketing decision.

## Core Framework: Objection Map

For each objection, record who raises it, what they're really worried about, and the honest response with proof:

| Objection | Who raises it | Underlying fear | Response + proof |
|---|---|---|---|
| "We could build this ourselves" | Eng lead | Looking unnecessary | "Teams that tried spent ~3 eng-months on v1 plus ongoing maintenance; [customer] switched after their homegrown version broke twice in one quarter" |
| "Too early-stage to trust" | Buyer | Career risk | SOC 2 status, uptime numbers, named logos, escape hatch (data export, month-to-month) |

Honest responses only. If an objection is currently true ("no SSO yet"), the response is the roadmap date and a workaround — pretending otherwise burns the sales conversation and the brand.

### Differentiation Claim Types

When writing competitor one-liners and pillar claims, match the claim strength to the evidence:

| Claim | Use when | Shape |
|---|---|---|
| "Only" | The attribute is literally unique and verifiable | "The only [category] with [attribute]" |
| "Best at" | Measurably ahead — you have the benchmark | "[3.2× faster] at [job] than [alternative]" |
| "Built for" | Your edge is segment fit, not raw capability | "Designed for [ICP], not adapted from [general tool]" |

Never stretch a "built for" into an "only" — one competitor screenshot in a sales call destroys it.

## Workflow

1. Read `.agents/product-marketing.md` if it exists; note gaps and staleness.
2. Ask the grouped questions from Before Starting, skipping what's already answered.
3. List competitive alternatives, always including the status quo option. Confirm the list with the user — they know deals you don't.
4. Extract unique attributes: what's true today, not the roadmap.
5. Translate attributes into value with the double "so what" test; cluster into 2–4 value themes.
6. Identify who cares most and draft the ICP across all four dimensions. Ask the user to name 3 real accounts or customers that fit — if they can't, narrow or flag as hypothesis.
7. Choose the market category using the decision table; state which play you're making and why.
8. Assemble the positioning statement and read it back to the user for a gut check before building on it.
9. Build the message house: roof from the positioning statement, three pillars answering three different buyer questions, 2–3 proofs each. Where proof is missing, mark it `[needs proof]` rather than inventing it.
10. Write the personas (2–3) with triggers, objections, and watering holes.
11. Build the objection map from the personas' objections plus anything the user has heard in real conversations.
12. Write one-line competitive framings for each named alternative: what they're genuinely good at, and when the buyer should pick you instead.
13. Capture voice notes: 3–5 words to use, 3–5 to avoid, one sentence of tone.
14. Write everything to `.agents/product-marketing.md` using `assets/context-file-template.md` as the structure (create the `.agents/` directory if needed). Show the user the positioning statement, roof message, and ICP inline for approval; point them to the file for the rest.
15. Add a `Last updated` date and a one-line changelog entry. Suggest revisiting after the next 10 customer conversations or any pivot.

## Common Mistakes

1. **Positioning only against named competitors.** In early markets, 40–60% of lost deals go to "do nothing." Fix: include the status quo as alternative #1 and write a pillar that beats inertia, not just rival features.
2. **Features as differentiators.** "Real-time sync" is an attribute, not a reason to buy. Fix: run the "so what" test twice until the claim names a customer outcome with a number attached.
3. **ICP that equals the TAM.** "Startups and enterprises who value productivity" is a wish, not an ICP. Fix: narrow until the user can list 10 named accounts that fit; if they can't, the ICP is a hypothesis and the file should say so.
4. **Pillars that restate the roof three ways.** Three synonyms for "fast" is one pillar wearing three hats. Fix: assign each pillar a different buyer question — does it work, is it for me, can I trust it.
5. **Claims without proof.** "Enterprise-grade" with zero enterprise logos reads as bluffing. Fix: 2–3 proofs per pillar or downgrade the claim; `[needs proof]` markers are honest and give the team a punch list.
6. **Persona demographics theater.** "Sarah, 34, enjoys hiking" changes nothing. Fix: capture triggers, comparison set, objections, and watering holes — the fields a campaign decision actually depends on.
7. **Category creation as the default.** New categories feel bold and cost 2–3 years of market education. Fix: work the category decision table honestly; head-on or subsegment wins for almost everyone under Series C.
8. **Write-once positioning.** The file rots silently and downstream skills inherit the rot. Fix: date the file, keep the changelog, and re-run this skill after pivots, new segments, or every ~10 sales conversations.

## Output Format

The primary deliverable is `.agents/product-marketing.md` at the project root, following `assets/context-file-template.md` exactly. Its sections, in order:

1. **Positioning Statement** — the filled Dunford-format sentence, plus the five raw components (alternatives, unique attributes, value themes, who cares most, category choice with the play used).
2. **ICP** — the four dimensions (firmographic, trigger, pain intensity, buying reality) and 3 named example accounts or a `hypothesis` flag.
3. **Message House** — roof message, then a table of 3 pillars × (claim, buyer question it answers, proofs). Missing evidence marked `[needs proof]`.
4. **Personas** — 2–3 entries: role, trigger, comparison set, top objections, success in their words, watering holes.
5. **Objection Map** — table: objection, who raises it, underlying fear, response + proof.
6. **Competitor One-liners** — per alternative: what they're good at, when to pick us instead.
7. **Voice Notes** — words to use, words to avoid, one-line tone description.
8. **Changelog** — dated one-liners; `Last updated` at top of file.

In the conversation itself, surface only the three decisions the user must sign off on — positioning statement, ICP, roof message — and link the file for everything else. Downstream skills (copywriting, pricing, competitor-teardown) consume the file, so completeness there beats a long chat reply.
