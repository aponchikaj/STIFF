# Skills Build Log

Target: 50 new skills under `.claude/skills/`, built in waves per the build brief.

## Step 0 — Recon (2026-08-08)

- `/Users/l4zare/Desktop/STIFF/.claude/skills/` — did not exist; created by Wave 1.
- `~/.claude/skills/` — contains an unrelated Solana-focused skill set
  (`scaffold-project`, `launch-token`, `cso`, `design-taste`, …). None of the
  15 house-style skills from the brief (`marketing-plan`, `launch`, `ads`, …)
  are installed anywhere, so the style contract in the brief is the authority.
- Name collisions with installed skills: **none** among the 50 planned names.
- Routing policy: since the 15 referenced skills don't exist here, descriptions
  route only to skills that will exist within the 50 (validator in Wave 7
  checks these resolve).
- Shared context file: `.agents/product-marketing.md` — emitted by the
  `product-marketing` skill at usage time; every marketing skill's
  "Before Starting" reads it first.

## Wave 1 — Repair dangling references (11 skills)

Status: **complete**. All 11 pass mechanical validation (frontmatter shape,
name=folder, description ≤1024 single quoted line, body <500 lines).
Pending cross-refs into later waves: `signup → forms-ux` (Wave 4),
`product-marketing → competitor-teardown` (Wave 6) — resolve before Wave 7 validator.

| Skill | Summary | SKILL.md lines | Extra files | Deliberately left out |
|---|---|---|---|---|
| product-marketing | Backbone: Dunford positioning, ICP, message house, objection map; writes `.agents/product-marketing.md` | 151 | assets/context-file-template.md | Padding to hit 200-line aim (density over length) |
| copywriting | PAS/AIDA/BAB selection, headline rules, landing copy jobs, voice axes, CTA/microcopy | 201 | references/swipe-file.md (247 ln, TOC) | — |
| cro | Teardown rubric (6 dims), friction audit, hypothesis template, ICE/PXL | 182 | scripts/sample-size.js (output verified) | — |
| pricing | Value-metric scoring, 3-tier + decoy design, Van Westendorp, freemium criteria | 251 | references/saas-pricing-models.md (491 ln, TOC) | — |
| offers | Value equation, objection→bonus stack, guarantee decision table, ethical scarcity | 178 | — | — |
| onboarding | Activation via retention-cohort correlation, TTV, empty states, tour decision table | 183 | — | — |
| signup | Field-by-field friction audit, SSO tradeoffs, verification patterns, trial design | 182 | — | — |
| referrals | k-factor + cycle-time math, incentive table, ask timing, fraud guards | 181 | — | — |
| social | Platform format/algorithm table, 12 hooks, repurposing pipeline, calendar pillars | 174 | references/platform-playbooks.md | — |
| cold-email | Deliverability preflight, warmup ramp, personalization tiers, sequences; CAN-SPAM/GDPR woven in | 205 | scripts/deliverability-check.sh (live-DNS tested) | — |
| ab-testing | MDE/sample math, peeking & alpha inflation, SRM checks, when-not-to-test | 173 | scripts/power-calc.js (tables match script output) | — |

## Wave 2 — SEO (7 skills)

Status: **complete**. All 7 pass mechanical validation.
Pending cross-ref into later waves: `seo-technical → frontend-performance` (Wave 5).

| Skill | Summary | SKILL.md lines | Extra files | Deliberately left out |
|---|---|---|---|---|
| seo-technical | Crawl→render→index→rank diagnosis, robots/noindex/canonical decision tables, CWV thresholds, JS rendering | 183 | references/schema-recipes.md (418 ln, TOC, 7 JSON-LD types) | — |
| seo-content | SERP-first intent classification, pillar/cluster, brief construction, refresh triage, cannibalization | 206 | assets/content-brief-template.md | — |
| keyword-research | Seed expansion, live-SERP difficulty checks, opportunity scoring, clustering | 183 | scripts/cluster-keywords.js (tested: CSV+newline input, --threshold, --help) | — |
| link-building | 7-tactic selection table, linkable assets, relevance-first prospecting, anchor distribution; white-hat only | 174 | — | Paid-link/PBN tactics (risk explained instead) |
| seo-local | GBP field leverage, review velocity, NAP, multi-location pages, grid tracking | 176 | — | — |
| programmatic-seo | 3-condition fit test, ≥50% unique-data bar, facet indexation matrix, gated 50–100-page pilot | 177 | — | — |
| aeo-geo | Per-engine sourcing table, citation-readiness checklist, AI-crawler access table, prompt-panel measurement | 173 | — | Vendor tool recommendations (DIY panels instead) |

## Wave 3 — Animation & motion (7 skills)

Status: **complete**. All 7 pass mechanical validation.
Pending cross-refs into later waves: `threejs-webgl → frontend-performance` (Wave 5),
`micro-interactions → forms-ux` (Wave 4).

| Skill | Summary | SKILL.md lines | Extra files | Deliberately left out |
|---|---|---|---|---|
| motion-design | Duration/easing token scales, brand→motion mapping, sqrt distance-duration coupling, choreography rules | 188 | — | — |
| css-animation | Render-pipeline cost model, will-change discipline, FLIP, @starting-style, jank tracing | 151 | — | Padding to 180-line aim (density over length) |
| framer-motion | Variants orchestration, AnimatePresence modes, layoutId shared elements, spring presets, RSC boundaries | 226 | — | — |
| svg-lottie | Technique selection, pathLength stroke drawing, point-matched morphing, dotLottie pipeline + budgets | 201 | — | — |
| threejs-webgl | DPR cap, R3F-vs-vanilla, draw-call/texture budgets, gltf-transform pipeline, lighting cost ladder | 194 | references/shader-basics.md (264 ln, TOC) | — |
| micro-interactions | 8-state component matrices, latency thresholds, loading decision table, haptics rules | 183 | — | — |
| scroll-animation | Linked-vs-triggered, 5-rung implementation ladder, reveal choreography numbers, scroll-jack warning | 223 | — | — |

## Wave 4 — Design & UI/UX (11 skills)

Status: **complete**. All 11 pass mechanical validation. Resolves the pending
`forms-ux` refs from Waves 1 and 3. Remaining pending ref: `typography → frontend-performance` (Wave 5).

| Skill | Summary | SKILL.md lines | Extra files | Deliberately left out |
|---|---|---|---|---|
| brand-identity | Scored identity audit, do/don't attribute pairs, voice+tone map, logo guidance, rebrand triage | 177 | assets/brand-guide-template.md (13 sections) | — |
| color-systems | OKLCH ramp generation, 3-layer token architecture, dark-mode remap rules, WCAG/APCA numbers | 203 | scripts/contrast-check.js (verified vs reference values) | — |
| typography | Modular scale, line-height/measure rules, pairing method, CLS-free font loading, clamp() fluid type | 200 | — | — |
| layout-grid | 4/8pt tokens, proximity diagnosis, grid-vs-flex, breakpoints, container queries, optical alignment | 183 | — | — |
| data-visualization | Chart decision table, Cleveland-McGill hierarchy, axis integrity, Okabe-Ito, dashboard F-pattern | 202 | — | — |
| presentation-design | Narrative arc table, title test, density budgets, data-slide craft; defers file output to built-in pptx | 182 | — | — |
| accessibility | WCAG 2.2 AA by POUR, ARIA anti-patterns, keyboard patterns, manual-first audit workflow | 221 | scripts/a11y-audit.js (tested: 11 findings on fixture, 0 false positives) | — |
| design-critique | Nielsen rubric with check questions, 0–4 severity, observation→principle→consequence→direction frame | 173 | — | — |
| information-architecture | Organization schemes, breadth-vs-depth math, card sorting + tree testing protocols with ship gates | 180 | — | — |
| forms-ux | Validation timing, error copy rules, single-column + keyboard pairing, multi-step, checkout patterns | 201 | references/autocomplete-attributes.md | — |
| mobile-ux | Touch targets, thumb zones, HIG-vs-Material divergence table, gesture conflicts, safe areas | 195 | — | — |

## Wave 5 — Software engineering (10 skills)

Status: **complete**. All 10 pass mechanical validation. `frontend-performance`
resolves the pending refs from `seo-technical`, `threejs-webgl`, and `typography`.
Remaining pending ref: `product-marketing → competitor-teardown` (Wave 6).

| Skill | Summary | SKILL.md lines | Extra files | Deliberately left out |
|---|---|---|---|---|
| frontend-performance | CWV budgets, field-vs-lab, LCP/INP/CLS fix ladders, bundle strategy, waterfall analysis | 228 | scripts/bundle-report.js (tested, CI exit codes) | — |
| react-patterns | Composition, state placement + derivability test, re-render model, effect discipline, RSC boundaries | 240 | — | — |
| typescript-patterns | Discriminated unions/brands, escape-hatch ladder, satisfies-vs-as, staged strict migration | 222 | — | — |
| testing-strategy | Test-shape budgets, behavior-first selection, mocking discipline, flake triage protocol, CI budget | 220 | — | — |
| code-review | Four-pass method, severity taxonomy, comment craft, size/latency limits, disagreement protocol | 202 | — | — |
| refactoring | Rewrite-vs-refactor table, characterization tests, seams, strangler-fig, debt triage | 209 | — | — |
| appsec | OWASP Top 10 checklist, injection/auth/CSRF fix patterns, STRIDE lite; defensive framing throughout | 223 | assets/threat-model-template.md | Exploitation techniques (defense only) |
| devops-cicd | Fail-fast pipelines, Actions OIDC/SHA-pinning, deploy strategy table, expand-and-contract migrations | 222 | assets/github-actions-starter.yml (YAML-validated) | — |
| observability | Three pillars with role boundaries, structured log schema, SLO/error budgets, burn-rate alerting | 224 | assets/incident-runbook-template.md | — |
| ai-engineering | Build-order discipline, eval harness design, RAG decisions, hallucination ladder, agent restraint | 156 | — | Padding to 220-line aim (density over length) |

## Wave 6 — Ideas, strategy & research (4 skills)

Status: **complete**. All 4 pass mechanical validation. Resolves the final
pending ref (`product-marketing → competitor-teardown`).

| Skill | Summary | SKILL.md lines | Extra files | Deliberately left out |
|---|---|---|---|---|
| idea-validation | Riskiest-assumption mapping, cheap-test menu with benchmarks, bottom-up TAM, kill criteria | 184 | — | — |
| competitor-teardown | Competitor classification, research source table, JTBD matrix, positioning map, steelman rules | 176 | assets/teardown-template.md | — |
| customer-interviews | Mom Test operationalized, leading→non-leading rewrites, JTBD four forces, synthesis method | 181 | references/question-bank.md | — |
| roadmap-prioritization | Strategy gate, RICE/ICE mechanics, opportunity-solution tree, allocation buckets, kill list | 151 | scripts/rice-score.js (tested: CSV/JSON/args/ICE modes) | — |

## Cross-linking pass

Every description was authored with routing lines to genuine siblings; the
validator resolves all `see <skill-name>` references across descriptions and
bodies. One prose false-positive fixed in `seo-technical` ("see per-section" →
"track indexation per section"). Zero dangling references remain.

## Wave 7 — Infrastructure

Status: **complete**.

- `.claude/skills/README.md` — index of all 50 skills grouped into 6 domains
  with trigger phrases and links (91 lines). Notes that the brief's 15
  pre-existing skills are not installed in this environment.
- `scripts/validate-skills.js` — runnable validator (frontmatter parse, name
  rules, description ≤1024, body ≤500 lines, routing-reference resolution,
  duplicate detection). Final output:
  ```
  Skills scanned: 50
  Total SKILL.md lines: 9654 (average 193)
  All checks passed: frontmatter, naming, description limits, body limits, routing references, uniqueness.
  ```
- `.claude-plugin/plugin.json` — plugin manifest (`stiff-skills` v1.0.0,
  skills path via `${CLAUDE_PLUGIN_ROOT}`).

## Final report

- **Total skills built:** 50 of 50 (11 + 7 + 7 + 11 + 10 + 4). Zero collisions,
  zero names skipped.
- **Total SKILL.md lines:** 9,654 (average 193 — every skill within the
  500-line cap; densest 240, leanest 150).
- **Extra files shipped:** 8 runnable scripts (all tested by their authors),
  6 reference docs, 5 fill-ready asset templates.
- **Validator:** passes clean, zero unresolved cross-references.
- **Three weakest / first to cut if trimming:**
  1. `seo-local` — solid content but narrowest fit for a digital-first brand
     with no physical locations.
  2. `svg-lottie` — nichest trigger surface; css-animation + framer-motion
     cover most real animation asks.
  3. `presentation-design` — the base model is already strong at deck
     structure; thinnest delta over unaided output.
