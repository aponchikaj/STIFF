---
name: brand-identity
description: "When the user wants to define, audit, or systematize a brand's identity — attributes, voice, logo, and the visual system that expresses them. Triggers: 'brand identity', 'logo', 'brand book', 'visual identity', 'brand voice', 'rebrand', 'our brand feels inconsistent'. Covers identity audits with consistency scoring, brand attribute definition with do/don't expression pairs, voice and tone systems, wordmark vs symbol logo decisions by company stage, visual identity system components, evolve-vs-replace rebrand triage, and rollout sequencing. For the positioning the identity expresses, see product-marketing. For palette engineering, see color-systems. For type selection, see typography."
metadata:
  version: 1.0.0
---

# Brand Identity

Act as a brand strategist who has built identity systems for companies from pre-seed to public. The outcome of this skill is a working brand system — not a mood board: named attributes with expression rules, a voice that survives being written by five different people, logo guidance that fits the company's actual stage, and a rollout plan that fixes the highest-traffic surfaces first. Identity is positioning made visible; every decision below should trace back to a positioning choice, not to taste.

## Before Starting

If `.agents/product-marketing.md` exists, read it first. Positioning drives identity — the attributes, voice, and visual choices below all express a positioning decision that file already records. Only ask about what it doesn't cover.

Then ask 3–5 questions, grouped so the user answers once:

1. **Situation** — Is this a new identity, a fix for inconsistency, or a rebrand? What triggered it now?
2. **Company stage and surfaces** — Team size, funding stage, and the 5–10 places the brand actually appears (site, app, decks, social, packaging, email).
3. **Positioning inputs** (skip anything the product-marketing file covers) — Who is the customer, what is the differentiated claim, who are the 2–3 competitors whose look you must not be confused with?
4. **Existing equity** — What do customers already recognize? Name, logo, a color, a tagline? Anything with recognition is expensive to discard.
5. **Constraints** — Legal restrictions on the name/mark, budget for design execution, hard deadlines (launch, funding announcement, conference).

## Identity Audit

Before defining anything, inventory what exists. Collect every touchpoint: website pages, app screens, sales decks, social profiles and posts, email templates, docs, invoices, swag, job listings. Screenshot or link each one.

Score each touchpoint 0–2 on four dimensions (max 8):

| Dimension | 0 | 1 | 2 |
|---|---|---|---|
| Logo usage | Wrong/stretched/old version | Correct mark, wrong context (bad contrast, no clearspace) | Correct mark, correct usage |
| Color | Off-palette colors dominate | Palette present but misapplied | On-palette, correct hierarchy |
| Typography | Random fonts | Right family, wrong weights/sizes | Matches type system |
| Voice | Contradicts attributes | Generic — could be any brand | Recognizably this brand |

Weight the findings by traffic: a 3/8 homepage matters more than a 6/8 invoice footer. Report the average score and the three lowest-scoring, highest-traffic touchpoints, in a table like:

| Touchpoint | Traffic rank | Logo | Color | Type | Voice | Total |
|---|---|---|---|---|---|---|
| Homepage | 1 | 2 | 1 | 2 | 1 | 6/8 |
| Sales deck | 3 | 0 | 1 | 0 | 1 | 2/8 |

A brand averaging below 5/8 has a consistency problem before it has a design problem — fix application before commissioning new assets. Re-run the same scoring after rollout; the number is the before/after proof the work landed.

## Brand Attributes

Define 3–5 attributes. Fewer than 3 gives no texture; more than 5 means nothing gets enforced. Each attribute needs a **do/don't expression pair** — the tension is what makes it usable. "Premium" alone is decoration; "premium but not distant" is a decision rule a designer can apply.

| Attribute (pattern) | Expresses as (do) | Never becomes (don't) |
|---|---|---|
| Premium but not distant | Restraint, whitespace, few words | Cold, jargon-heavy, unreachable |
| Confident but not arrogant | Plain claims, specifics, numbers | Superlatives, competitor trash talk |
| Friendly but not childish | Contractions, direct address | Exclamation points, slang, mascot humor |
| Technical but not academic | Precise terms, real examples | Citations, hedging, passive voice |

Write the user's actual attributes in this format. Each one must exclude something a competitor does — an attribute every competitor could also claim ("innovative", "trusted") is filler.

## Voice and Tone

Voice is constant — it is the attributes rendered in language. Tone is situational — the same voice modulated for context. A brand that changes voice per channel has no voice.

For each attribute, define vocabulary, syntax, and a before/after example:

| Attribute | Vocabulary | Syntax | Example rewrite |
|---|---|---|---|
| Confident, not arrogant | "ships", "does", numbers | Short declaratives, active voice | "We're thrilled to announce our revolutionary..." → "Search now returns results in 40ms." |
| Friendly, not childish | "you", contractions | Second person, questions allowed | "Users may configure..." → "You can set this up in two minutes." |

Then map tone across four situations — voice holds, register shifts:

| Situation | Tone shift | Example |
|---|---|---|
| Marketing / launch | Most energy, most personality | Full voice, humor allowed |
| Product UI | Neutral, brief, zero cleverness | Labels and confirmations, no jokes near destructive actions |
| Support / errors | Calm, ownership, next step first | "Something went wrong on our end. Retrying usually fixes it — here's how." |
| Incidents / legal / billing | Sober, precise, no personality | Plain statements of fact and remedy |

The most common failure is running marketing tone in error states. Nobody wants a playful 500 page.

Litmus test for the finished voice: hand the vocabulary/syntax table to someone who has never written for the brand and have them draft three sentences. If you can't tell their draft from the incumbent writer's, the voice is defined; if you can, the table is missing rules, not talent.

## Logo Guidance

**Wordmark vs symbol is a stage decision, not a taste decision.** A symbol only works once people recognize it, and recognition is bought with impressions — Nike spent decades and billions before the swoosh could stand alone. Most startups lack that recognition budget.

| Stage | Recommendation | Why |
|---|---|---|
| Pre-seed to Series A | Wordmark only | Every impression must also teach the name |
| Series B–C, known in niche | Wordmark primary + symbol for avatars/favicons | Small-square contexts need a symbol; keep the wordmark everywhere else |
| Category leader / consumer scale | Symbol can stand alone | Recognition budget exists |

Non-negotiable mechanics, whatever the mark:

- **Clearspace**: minimum margin on all sides equal to the x-height of the wordmark (or an equivalent unit of the symbol). Nothing enters that zone.
- **Minimum sizes**: 24px height digital, ~10mm print for the wordmark. Below that, use the symbol or nothing — an illegible logo is worse than none.
- **Required variants**: full-color, monochrome (one ink), and reversed (for dark/photo backgrounds). If the logo only works in full color on white, it isn't finished.
- **Forbidden uses**: list them explicitly in the brand book — stretching, recoloring, drop shadows, outlines, placing on low-contrast backgrounds. Every rule you don't write down will be broken by a partner's marketing team.

## Visual Identity System

Six components, each a decision the template in `assets/brand-guide-template.md` captures. Deep palette engineering routes to color-systems; typeface selection routes to typography — this skill decides what each component must *express* and records the decision.

| Component | The decision to make | Consistency test |
|---|---|---|
| Color | 1 dominant, 1–2 accents, roles assigned (action, warning, surface) | Could you identify the brand from a screenshot with the logo cropped out? |
| Typography | 1–2 families, fixed weight/size scale, usage per level | Headlines set the personality; body sets the readability |
| Photography style | Lit how, cropped how, people or product, candid or staged | Any two photos side by side look like the same shoot |
| Illustration style | Line weight, palette subset, level of abstraction — or "none" | "None" is a valid, enforceable choice; drift is not |
| Iconography | One set, one stroke weight, one corner radius | Mixed icon sets are the fastest tell of an unmanaged brand |
| Layout DNA | Grid, density, whitespace ratio, corner radius, shadow depth | A slide and a landing page read as siblings |

## Rebrand Triage

Default to evolution. Recognition is an asset built from every past impression, and a replacement rebrand sets it to zero.

| Signal | Evolve | Replace |
|---|---|---|
| Identity looks dated but positioning holds | Yes — refresh mark, type, palette | |
| Inconsistent application across surfaces | Yes — this is enforcement, not redesign | |
| Company repositioned (new market, merged, renamed) | | Yes — old identity signals the wrong thing |
| Reputation damage attached to the current identity | | Yes — reset is the point |
| New CMO/founder "wants a fresh look" | Yes — audit first; taste is not a trigger | |

Replace only for repositioning or reputation reset. Everything else is evolution: keep the recognizable elements (usually name, color, mark silhouette), modernize the rest, and version the change so old assets are identifiably old.

## Rollout Sequencing

Roll out by traffic, not by convenience. The surfaces a team can update fastest (internal docs, email signatures) are usually the ones fewest customers see. Order the work in three waves:

| Wave | Surfaces | Target |
|---|---|---|
| 1 — High traffic | Homepage, app shell, social profile images and bios, primary sales deck | Week 1–2: 80% of impressions now on the new identity |
| 2 — Recurring touch | Email templates, docs site, onboarding flows, ad creative | Week 3–6 |
| 3 — Long tail | Invoices, legacy landing pages, swag, partner portals, job listings | Tracked to zero, not "eventually" |

Maintain a **consistency-debt tracker**: every surface still carrying the old identity, with owner and due date (the template includes the table). Two rules keep it honest:

- Review the tracker on a fixed cadence (biweekly works) until it is empty. Untracked rollouts reliably stall around 60% — the visible surfaces get done, the long tail never does, and the audit score decays back within a year.
- Any *new* surface created during rollout must launch on the new identity. Debt that grows while being paid down never clears.

## Workflow

1. Read `.agents/product-marketing.md` if present; ask the Before Starting questions for gaps.
2. Run the identity audit: inventory touchpoints, score each 0–8, report the average and worst offenders.
3. Define 3–5 attributes with do/don't pairs; check each excludes something a real competitor does.
4. Build the voice table (attribute → vocabulary/syntax/example) and the 4-situation tone map.
5. Set logo guidance by stage: wordmark/symbol call, clearspace, minimum sizes, required variants, forbidden uses.
6. Decide the six visual system components; record each decision, routing palette math to color-systems and type selection to typography.
7. If this is a rebrand, run triage: evolve unless repositioning or reputation reset demands replacement.
8. Sequence the rollout in the three waves above and set up the consistency-debt tracker with owners and dates.
9. Deliver the filled brand book from `assets/brand-guide-template.md`.

## Common Mistakes

1. **Attributes with no exclusion.** "Innovative, trusted, customer-focused" fits every company alive. Fix: each attribute must name what the brand refuses to be ("premium but not distant") and exclude something a competitor actually does.
2. **Commissioning a symbol at seed stage.** The symbol eats budget and carries zero recognition. Fix: wordmark now; add a symbol when avatars and favicons force it, and even then keep the wordmark primary.
3. **Voice that shifts per channel.** Playful on social, corporate in email reads as two companies. Fix: one voice from the attribute table; only tone shifts, per the 4-situation map.
4. **Redesigning instead of enforcing.** Teams that score 4/8 on consistency commission a new identity that will also be applied inconsistently. Fix: if the audit shows misapplication, ship usage rules and fix the top surfaces before touching the design.
5. **Skipping monochrome and reversed variants.** The full-color logo then gets stretched onto dark slides and sponsor banners by hand. Fix: ship all three variants and the forbidden-uses list on day one.
6. **Replacing when evolving would do.** A leadership change triggers a ground-up rebrand and years of recognition evaporate. Fix: run the triage table; replace only for repositioning or reputation reset.
7. **Big-bang rollout with no debt tracking.** The homepage updates, then momentum dies and invoices carry the old logo for two years. Fix: sequence high-traffic first and keep the consistency-debt list with owners and dates until it hits zero.
8. **Writing the brand book nobody can apply.** Forty pages of philosophy, no minimum sizes, no example rewrites. Fix: every rule needs a number, a do/don't pair, or a before/after example — the template enforces this.

## Output Format

Deliver, in order:

1. **Audit summary** — touchpoint inventory, scores, average, three worst high-traffic offenders (skip for net-new brands).
2. **Attribute set** — 3–5 attributes, each as a do/don't table row.
3. **Voice and tone system** — attribute → vocabulary/syntax/example table plus the 4-situation tone map.
4. **Logo guidance** — stage call, clearspace and size rules, variant list, forbidden uses.
5. **Visual system decisions** — one recorded decision per component, with routes to color-systems and typography where execution goes deeper.
6. **Rebrand call** (if applicable) — evolve or replace, with the triggering signal named.
7. **Rollout plan** — ordered surface list and the consistency-debt tracker.
8. **Filled brand book** — copy `assets/brand-guide-template.md` into the user's project and complete every section; leave no placeholder brackets behind.
