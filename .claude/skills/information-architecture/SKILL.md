---
name: information-architecture
description: "When the user wants to organize a site or app's content so people can actually find things — structuring pages, navigation, categories, and labels. Triggers: information architecture, sitemap, navigation, menu structure, card sorting, taxonomy, users can't find anything, how should I organize my pages. Covers organization schemes, labeling from user vocabulary, breadth-vs-depth decisions, navigation pattern selection, card sorting and tree testing protocols, sitemap deliverables, search integration, and taxonomy design. For evaluating an existing design's usability, see design-critique. For URL structure and crawlability, see seo-technical."
metadata:
  version: 1.0.0
---

# Information Architecture

Act as a senior information architect who has run card sorts and tree tests on sites from 30-page marketing sites to 50,000-SKU catalogs. The outcome of this skill is a validated hierarchy — organization scheme chosen deliberately, labels pulled from user vocabulary, structure tested against findability tasks before any visual design — delivered as an annotated sitemap the team can build from.

## Before Starting

Ask these, grouped, before proposing any structure. Skip only what the user has already answered.

1. **Content inventory**: How many pages/items exist today, and how many in 12 months? Is content mostly static pages, a growing catalog, or user-generated? (The answer changes everything: 40 pages needs a top nav; 4,000 needs facets and search.)
2. **User goals**: What are the top 5 tasks visitors arrive to do? Which one drives revenue or retention? Do users seek known items ("find the refund policy") or browse exploratively ("what do you sell")?
3. **Current pain**: Where do users get lost today? What do support tickets and site-search logs say people can't find? Is there analytics data on nav clicks, search queries with zero results, or high-exit pages?
4. **Constraints**: Existing brand/legal category names that can't change? Multiple audiences with genuinely different content (not just different framing)?

## Organization Schemes

Pick the scheme first — it determines everything downstream. Most sites should default to topic or task; audience-based nav is the most common self-inflicted wound.

| Scheme | Organizes by | Fits when | Fails when |
|---|---|---|---|
| By topic | Subject matter ("Insurance", "Loans") | Users browse to learn; content maps to distinct subjects | Topics overlap heavily; users arrive with a task, not a subject |
| By task | Verbs ("Pay a bill", "File a claim") | Transactional products; top 5 tasks cover 80% of visits | Content is reference material with no clear action |
| By audience | Visitor identity ("For Students", "For Enterprises") | Audiences have almost zero content overlap AND self-identify instantly (e.g. Patients vs. Providers in healthcare) | Almost everywhere else — see below |
| By format | Content type ("Videos", "Whitepapers", "Docs") | Users genuinely seek a format ("show me the webinar") | Used as a lazy default; users want answers, not formats |
| Hybrid | Mix, one scheme per nav level | Large sites: topic top-level, task second-level | Schemes are mixed *within* one menu level, forcing users to guess which logic applies |

Why audience-based nav usually fails: users don't reliably self-identify. A small-business owner doesn't know if she's "SMB" or "Enterprise"; a researcher is also a "Student". When someone fits two doors — or neither — they stall at the top of the funnel, and content gets duplicated behind each door and drifts out of sync. Reserve audience schemes for hard-walled populations with disjoint content.

Never mix schemes within a single menu level. "Products | Solutions | For Developers | Resources" forces users to evaluate three different logics per scan.

## Labeling Rules

Labels are the interface to the hierarchy. Wrong labels sink a correct structure.

- **User vocabulary over internal jargon.** Mine site-search logs, support tickets, and open card-sort category names for the words users actually type. If users search "cancel subscription" and your page is "Manage plan lifecycle", rename the page.
- **Front-load the keyword.** Users scan the first 1–2 words of each nav item. "Pricing" beats "See our pricing options"; "Refunds" beats "How to get a refund".
- **Concrete beats clever.** "Products" beats "Solutions" — "Solutions" could mean products, services, case studies, or consulting, and every extra plausible meaning taxes the click. Same for "Resources", "Explore", "Discover": acceptable only when the contents genuinely resist a more specific name.
- **Keep grammatical parallelism per level.** All nouns or all verbs within one menu. "Pricing, Docs, Blog, Get started" mixes forms and reads as two menus.
- **Test labels separately from structure.** A tree test failure can be a bad label on a good branch; check which one failed before restructuring.

Quick label audit for an existing nav — flag any item that fails one of these:

| Check | Pass example | Fail example |
|---|---|---|
| Could a first-time visitor predict what's behind it? | "Pricing" | "Solutions" |
| Is the distinguishing word first? | "Refund policy" | "Our policy on refunds" |
| Would a user type this into search? | "Cancel subscription" | "Plan lifecycle" |
| Is it distinct from every sibling? | "Docs" vs "Blog" | "Resources" vs "Library" |

## Breadth vs Depth

Prefer broad-and-shallow. Two clicks through 7 options each (49 reachable pages) beats four clicks through 3 options each (81 pages) in practice, because every level is a fresh chance to pick the wrong branch, and mis-clicks compound: at 90% per-choice accuracy, a 2-level path succeeds 81% of the time; a 4-level path, 66%.

- **Hide-nothing principle for primary tasks.** The top 3–5 user tasks must be reachable from the homepage without opening any menu, and never buried under a generic parent like "More" or "Resources".
- **5–9 top-nav items** is the practical ceiling. Not because of the "7±2" short-term-memory claim — that's about recall, and navigation is recognition, so the myth doesn't apply — but because scanning cost and visual crowding rise sharply past 9 items, especially on mobile.
- **3 levels deep** is the useful maximum for nav-reachable content; deeper content should be reached via search, cross-links, or facets rather than menu drilling.
- Depth is acceptable for reference material (docs, help centers) where users arrive by search; it is toxic for revenue paths.

## Navigation Pattern Selection

| Pattern | Fits | Rules of thumb |
|---|---|---|
| Top nav (flat) | ≤50 pages, marketing sites, simple apps | 5–9 items; primary CTA visually distinct at far right |
| Sidebar | Web apps, docs, admin tools; users return daily | Persistent, collapsible; show current location; ≤2 nested levels visible |
| Mega-menu | 50–5,000 pages; e-commerce, universities, B2B with many product lines | Open on click or after a 300ms hover-intent delay (never instant hover — diagonal mouse travel closes it); columns = categories, not layout convenience; 3–5 columns; every column header is itself a clickable landing page |
| Tabs | Peer views of one object (Overview / Activity / Settings) | 2–7 tabs; never nest tabs in tabs; tabs switch views, they don't navigate away |
| Hub-and-spoke | Mobile apps, wizards, task-isolated flows | Each spoke is self-contained; always one tap back to hub; no cross-spoke jumps mid-task |

Choose by content volume and product type, then validate the hierarchy with a tree test before building the component.

Mobile behavior is part of the pattern decision, not an afterthought: a 7-item top nav collapses into a drawer on mobile, which demotes every item to 2 taps — so on mobile, surface the top 1–2 tasks as visible buttons outside the drawer. A mega-menu becomes an accordion; cap it at 2 visible levels or it becomes unusable on a phone.

### Supplementary navigation

The primary menu carries at most a third of real wayfinding. Plan the rest deliberately:

- **Breadcrumbs** on any site 3+ levels deep. Show the full path, make every ancestor clickable, and reflect the hierarchy — not the user's click history. Breadcrumbs are the cheapest fix for "where am I?" and cost one line of vertical space.
- **Contextual cross-links** ("Related articles", "Frequently bought together") carry users across branches the tree separates. Every cross-link in the sitemap deliverable becomes one of these. Without them, hierarchies punish users who entered through the wrong branch — which, via search engines, is most users.
- **Footer nav** is the fallback map: a flat, complete list of key pages. Users who scroll to the footer are lost or hunting for something specific (contact, legal, careers) — serve both, and don't make the footer a second creative exercise.
- **Landing-page deep links**: search engines land users mid-tree on detail pages. Every detail page must expose its position (breadcrumb) and its siblings (in-section nav), or the deep-linked visitor is stranded on an island.

## Card Sorting Protocol

Card sorting discovers how *users* group content — run it before proposing categories, not after.

- **Open sort** (users create and name their own groups): use to discover categories. 15–20 participants; results stabilize around 15 and rarely shift after 20.
- **Closed sort** (users file cards into your predefined categories): use to validate a proposed scheme or compare two candidate schemes. 20–30 participants for reliable percentages.
- **30–50 cards max per session.** Beyond 50, participants fatigue and start dumping cards into "Misc". Cover the full content range by sampling representative items, not by including everything.
- Card names must be content descriptions ("Article: how billing cycles work"), never your candidate category labels — that leads the sort.
- **Reading the similarity matrix:** pairs grouped together by ≥70% of participants belong in the same category, treat that as settled; 40–70% signals an ambiguous item that needs a cross-link or a clearer label; below 40% means the items are unrelated, don't force them together. Open-sort group names are a goldmine for labels — harvest the most frequent user-invented names verbatim.

## Tree Testing Protocol

Tree testing measures findability on the bare hierarchy — text-only, no visual design, no search — so structure failures can't hide behind good UI or be blamed on bad UI.

1. Build the tree as plain nested labels (tools: Treejack, or a spreadsheet-driven prototype).
2. Write 8–12 tasks covering the top user goals plus known problem areas. **Non-leading task wording:** never reuse words from the target label. If the target is "Refunds", the task is "You bought the wrong size and want your money back" — not "Find the refunds page". Include 1–2 tasks with plausible wrong branches to detect false confidence.
3. Run with 15–20 participants per audience. Randomize task order.
4. Read four numbers per task: **success rate** (reached correct node), **directness** (reached it without backtracking), first-click destination, and time.

Task wording examples — the difference between measuring the tree and measuring reading comprehension:

| Target node | Leading (invalid) | Non-leading (valid) |
|---|---|---|
| Pricing → Compare plans | "Find the plan comparison page" | "You're deciding whether the cheaper tier is enough for your team of 4" |
| Support → Refunds | "Where would you request a refund?" | "The jacket you ordered doesn't fit and you want your money back" |
| Docs → API keys | "Find the API keys documentation" | "Your script needs a credential to talk to the service" |

**Ship gates: ≥70% task success and ≥60% directness**, averaged and per critical task. A task with high success but low directness means the right branch exists but a decoy branch is attracting first clicks — fix the decoy's label. High failure concentrated on one first-click means a top-level category is mislabeled or missing. Retest after fixes; don't ship a tree that fails its gates, because no amount of visual design repairs a structure users can't predict.

## Search Integration

Navigation and search are complements, not rivals.

- Nav alone stops scaling around **100 pages** or whenever users do known-item seeking ("find invoice #4412", a specific part number, a specific doc page). Past either threshold, ship search prominently — not as a footer afterthought.
- **Search-log mining is ongoing IA input**, not a one-time study: queries with zero results reveal missing content or missing synonyms; high-frequency queries for content that exists in the nav reveal that the nav path is broken; trending new terms reveal vocabulary drift. Review logs monthly.
- Route fixes correctly: a zero-result query for content you have is a synonym problem (fix the taxonomy); a top query landing on a page 3 levels deep is a hierarchy problem (promote or cross-link it).

## Taxonomy Basics

For catalogs, help centers, and any site past ~500 items, the hierarchy needs a taxonomy underneath.

- **Controlled vocabulary**: one canonical term per concept, chosen from user vocabulary. Every tagger uses "invoice", never a mix of "invoice/bill/statement".
- **Synonyms and aliases**: map variant terms ("bill", "statement", British/American spellings, old product names) to the canonical term so search and filters catch them. This is where search-log mining pays off directly.
- **Faceted classification for large catalogs**: instead of one giant tree, tag items with independent facets (product type × material × price band × brand) and let users filter in any order. A 10,000-SKU catalog is unbrowsable as a tree but tractable as 4–6 facets of 5–15 values each. Facets must be mutually independent; if two facets always co-occur, merge them.

## Workflow

1. **Inventory**: list all content (URL, title, type, owner, traffic if available). For sites over ~200 pages, sample by section plus include every top-100-traffic page.
2. **Mine user vocabulary**: pull 90 days of site-search logs, support ticket subjects, and competitor nav labels. Build a term-frequency list.
3. **Choose the organization scheme** using the table above; justify the choice against the top 5 user tasks.
4. **Run an open card sort** (15–20 participants, 30–50 cards) if categories are uncertain; skip to a closed sort if validating a known-good scheme.
5. **Draft the hierarchy**: 5–9 top-level items, ≤3 levels for nav-reachable content, labels from the step-2 vocabulary list.
6. **Tree test** with 8–12 non-leading tasks, 15–20 participants. Gate: ≥70% success, ≥60% directness. Iterate labels first, structure second, and retest.
7. **Select navigation patterns** per the pattern table; specify mega-menu/sidebar behavior rules explicitly.
8. **Deliver the annotated sitemap** (format below) plus taxonomy spec if the site warrants one, and set up monthly search-log review as the maintenance loop.

## Common Mistakes

1. **Mirroring the org chart.** Nav labeled "Division A / Division B" reflects who owns the content, not how users think. Fix: organize by user task or topic; users should never need to know your internal structure.
2. **Audience-based nav for overlapping audiences.** "For Individuals / For Teams" with 60% shared content duplicates pages and stalls users who fit both. Fix: one shared structure; use audience filtering or in-page framing instead of duplicate doors.
3. **Designing nav UI before testing the tree.** Teams debate mega-menu styling while the hierarchy itself fails findability. Fix: tree test the bare structure first; pixels come after the ≥70%/≥60% gates pass.
4. **Junk-drawer categories.** "Resources", "More", "Other" accumulate everything that lacked a home and become where content goes to die. Fix: if a category would hold unrelated items, the parent scheme is wrong — re-sort; every top task gets a real home.
5. **Labels from internal jargon.** "Solutions", internal product code names, marketing coinages. Fix: rename from search logs and card-sort group names; front-load keywords.
6. **Deep trees to keep menus 'clean'.** Burying content 4–5 clicks down trades visible complexity for invisible failure. Fix: broaden the tree; 7 options at 2 levels beats 3 options at 4.
7. **Treating IA as a one-time project.** Content grows, vocabulary drifts, the tree rots. Fix: monthly search-log review, quarterly zero-result audit, tree retest after any major content addition.
8. **Sitemap delivered as a bare tree.** A tree with no page types or cross-links leaves the build team guessing. Fix: use the deliverable format below.

## Output Format

Deliver the sitemap as hierarchy + page types + cross-links — a bare tree is not a deliverable.

```
1.0 Home                        [landing]
├── 2.0 Products                [category landing — clickable, not just a menu header]
│   ├── 2.1 Product A           [product detail] ↔ cross-link: 4.2 Pricing, 5.1 Docs quickstart
│   ├── 2.2 Product B           [product detail] ↔ cross-link: 3.1 Case study
│   └── 2.3 Compare products    [comparison table]
├── 3.0 Customers               [category landing]
│   └── 3.1 Case studies        [index → detail template]
├── 4.0 Pricing                 [pricing table]     ← top-task: reachable in 1 click, no menu
└── 5.0 Docs                    [search-first hub; tree nav below 5.x only]
```

Annotate every node with: page type/template, primary user task served, and cross-links (the ↔ links are what make a sitemap a navigation system rather than a filing cabinet). Accompany the sitemap with:

- **Scheme rationale**: which organization scheme, why, and what was rejected.
- **Label decisions table**: chosen label | user-vocabulary evidence | rejected alternatives.
- **Test results**: card-sort similarity highlights and tree-test scores per task against the 70%/60% gates.
- **Nav pattern spec**: which pattern per area, with behavior rules (hover-intent delay, mobile collapse behavior).
- **Maintenance plan**: monthly search-log review owner and cadence.

Present recommendations as decisions with evidence, not options — the user came for a structure, so give them one and show why it will test well.
