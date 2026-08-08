---
name: programmatic-seo
description: "When the user wants to build template-driven SEO pages at scale — deciding whether pSEO fits, designing the data source and template, structuring URLs and facets, and rolling out without triggering thin-content penalties. Triggers: 'programmatic SEO', 'pSEO', 'template pages', 'generate thousands of pages', 'faceted navigation', 'location pages', 'comparison pages at scale'. Covers the fit test (query pattern × data × demand), template quality bar, data-source defensibility, facet indexation rules, index-bloat monitoring, internal linking for template pages, staged rollout, and quality pruning. For picking the keyword patterns, see keyword-research. For crawl-budget and indexation fallout, see seo-technical. For one-off editorial content, see seo-content."
metadata:
  version: 1.0.0
---

# Programmatic SEO

Act as a programmatic SEO architect who has shipped page sets from 50 to 500,000 URLs and has also cleaned up the wreckage when scaled content gets deindexed. The outcome: a pSEO plan (or a verdict that pSEO is wrong for this product) covering the query pattern, data source, template spec, URL architecture, and a staged rollout with kill criteria — designed so every generated page deserves to rank on its own.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it covers product, ICP, and differentiation. Only ask what it doesn't answer. Ask 3–5 questions, grouped:

1. **Pattern and demand**: What repeatable query pattern are you targeting (e.g. "[tool] vs [tool]", "payroll software for [industry]", "[service] in [city]")? Have you checked that individual instances get searches, or only the head term?
2. **Data**: What dataset would fill the pages — your own product/usage data, licensed data, scraped, or public APIs? Roughly how many instances (rows), and how many meaningful attributes per instance?
3. **Site standing**: Current domain authority ballpark, pages currently indexed, and whether the site has had indexation or manual-action problems before. A 30-page site launching 20,000 URLs behaves very differently from an established domain.
4. **Conversion path**: What does a visitor on one of these pages do next? pSEO traffic that can't convert is a vanity project.
5. **Build constraints**: CMS or framework, engineering support available, and whether pages can render server-side. (Skip if obvious from the codebase.)

## Page Pattern Archetypes

Most pSEO plays fall into one of six archetypes. Naming the archetype early sets the template shape, the data requirement, and the realistic ceiling:

| Archetype | Query shape | Example | Data that makes it work | Watch out for |
|---|---|---|---|---|
| Location pages | "[service] in [city]" | "coworking space in Austin" | Per-location listings, prices, hours, reviews | The classic city-swap trap; needs true local data per instance |
| Comparison pages | "[X] vs [Y]" | "Notion vs Asana" | Feature matrices, pricing, benchmark scores | n² page explosion — only generate pairs people actually search |
| Best-of / listicles | "best [X] for [Y]" | "best CRM for nonprofits" | Ranking criteria you computed, not copied | Needs a defensible ranking methodology stated on-page |
| Integration / pairing | "[tool] + [tool]" | "Slack Google Sheets integration" | Your product's actual integration data | Only works if you are the integration platform (Zapier model) |
| Glossary / definitions | "what is [term]" | "what is net revenue retention" | Expert definitions plus examples, formulas, benchmarks | Lowest data moat; AI Overviews absorb these queries first |
| Data / stats pages | "[X] statistics", "[X] price" | "median rent in Denver" | Proprietary or aggregated live data | Must refresh on a cadence or pages decay into misinformation |

## The Fit Test — All Three or Don't

pSEO works only when three conditions hold simultaneously. Two out of three produces thin pages, wasted crawl budget, or content nobody searches for.

| Condition | Test | Fails when |
|---|---|---|
| Repeatable query pattern | One template sentence generates 100+ distinct real queries ("best [X] for [Y]") | Queries in the set need structurally different answers — that's editorial, route to seo-content |
| Proprietary or aggregated data | You hold data per instance that a searcher can't get by clicking the next result | Your only data is what every competitor scrapes from the same public API |
| Demand per instance | Individual instances show search volume (check 20 random instances, not the head term) | Only "plumbers" has volume and "plumbers in Dothan AL" gets 0 searches — you're building pages for nobody |

Deliver a clear verdict. If it fails, say which condition failed and what would change the answer (e.g. "collect 6 months of usage data first"), then route to the right alternative skill.

## Template Quality Bar

Google's scaled content abuse policy (March 2024 core update onward) targets exactly this: many pages generated primarily for rankings, with little added value per page. Sites lost 90%+ of traffic overnight. The bar that survives:

- **Every page answers its query standalone.** Test: show the page to someone who searched that exact query, with the rest of the site hidden. If they'd hit back, the template fails.
- **Unique data is ≥50% of page value.** Count the modules on the template. If a searcher removed everything that's identical across pages (boilerplate intro, generic FAQ, shared CTA), does at least half the useful content remain? Swapped city names in otherwise identical paragraphs is 5% unique, not 50%.
- **Data modules beat prose modules.** Tables, stats, prices, ratings, availability, comparisons computed from your dataset scale honestly. Spun paragraphs ("Looking for X in {city}? You've come to the right place!") scale as duplicate content.
- **Handle sparse rows.** Define a minimum data threshold per instance (e.g. ≥5 populated attributes, ≥3 listings). Instances below threshold don't get a page — they get rolled into a parent page or skipped. A template that renders half-empty for 40% of rows will drag down the whole set.

Bake the per-page SEO elements into the template once, correctly:

- Title and H1 generated from the pattern with real differentiators, not just the variable swap: "Payroll Software for Restaurants: 12 Tools Compared (2026)" beats "Payroll Software for Restaurants".
- Meta description templated from per-instance data (counts, price ranges, top result) so each is factually distinct.
- Structured data matched to the archetype: `ItemList` for listicles, `Product`/`AggregateRating` where ratings are real, `FAQPage` only for genuinely per-instance FAQs, `BreadcrumbList` everywhere.
- Server-side render the data modules. Client-side-only rendering of the unique content means Google's first pass sees exactly the boilerplate you were trying to dilute.
- A visible "data last updated" date wired to the actual refresh pipeline — it earns trust and signals freshness, but only if it's true.

## Data-Source Design

Data defensibility decides whether the page set is an asset or a commodity. Ranked:

| Tier | Source | Defensibility | Notes |
|---|---|---|---|
| 1 | Proprietary (your usage data, transactions, user reviews, benchmarks you ran) | High — nobody can copy it | Zapier's app-pairing pages, Wise's live rate data. Strongest moat; often worth delaying launch to accumulate |
| 2 | Licensed / exclusive partnerships | Medium-high | Competitors can license too, but cost and effort filter most out |
| 3 | Scraped + enriched | Medium — the enrichment is the moat | Raw scrape is Tier 4; cross-referencing 3 sources, deduping, adding computed fields (rankings, deltas, scores) creates value the source sites don't have |
| 4 | Public API / open dataset only | Low — every competitor has identical pages | Only viable with a large authority advantage, and fragile even then |

For Tier 3–4 plans, name the enrichment explicitly: what columns exist on your page that exist nowhere else? If the answer is "none," the fit test's data condition has quietly failed.

## URL and Facet Architecture

Pattern: one canonical, readable URL per instance — `/payroll-software/restaurants/`, not `/pages?vertical=12`. Keep hierarchy flat (2–3 levels); put the head term in the directory, the modifier in the slug.

Faceted navigation is where page counts explode: 200 cities × 15 categories × 8 filters = 24,000 URLs, most with zero demand. The rule set:

| Facet depth | Example | Treatment |
|---|---|---|
| Category page | /crm-software/ | Index — hub page |
| Category + 1 facet | /crm-software/real-estate/ | Index only where the keyword pattern shows demand |
| 2+ facet combos | /crm-software/real-estate/under-50/ | Noindex or canonical to the 1-facet parent; block crawl of parameterized versions in robots.txt |
| Sorts, pagination params | ?sort=price, ?page=3 | Canonical to the base URL; never index |

Decide indexability per facet from keyword data before build, not after Google has crawled 24,000 combinations. Retrofitting noindex on an already-bloated site takes months of recrawling.

## Duplication and Cannibalization Guards

Beyond facets, three duplication patterns quietly split rankings across a template set:

- **Near-duplicate instances.** Two rows whose pages end up 90% identical ("CRM for realtors" vs "CRM for real estate agents"; adjacent suburbs sharing one listings pool). Detect by comparing rendered data modules across instances before launch; merge near-duplicates into one canonical page targeting both phrasings rather than shipping two pages that cannibalize each other.
- **Symmetric comparisons.** "X vs Y" and "Y vs X" are the same intent. Generate one canonical order (alphabetical or by search volume), 301 or canonical the mirror, and have both anchor texts point at the survivor.
- **pSEO vs editorial overlap.** A template page and a blog post targeting the same query will trade positions and suppress each other. Keep one owner per query: check planned instance queries against existing editorial URLs, and either fold the post's content into the template page or exclude that instance from generation.

## Index-Bloat Guards

The indexed:submitted ratio in Search Console (Pages report: indexed vs "Crawled – currently not indexed" + "Discovered – currently not indexed") is the early-warning gauge:

- **≥90% indexed**: healthy, safe to scale the next tranche.
- **60–90%**: investigate before scaling. Usually sparse rows or near-duplicate instances.
- **<60% indexed**: Google is telling you the pages are thin. Stop scaling. Fix or prune before publishing anything more — pushing more URLs into a set Google is already declining to index accelerates a sitewide quality reassessment.

Also watch: average engagement (if pSEO pages show 70%+ lower engagement time than the site average, the template is underdelivering) and impressions-per-indexed-page trending toward zero on the tail.

Set up the measurement before launch, not after:

- Segment the pSEO set in Search Console with a URL prefix or regex filter and in analytics with a page-type dimension, so the set's clicks, impressions, and engagement are readable separately from the rest of the site.
- One sitemap file per template type (see internal linking below) so the Pages report shows indexation per template, not one blended number that hides which template is failing.
- Record the baseline (site-average engagement time, current indexed count) the week before the pilot ships — you cannot judge "within 30% of site average" without the average.

## Internal Linking for Template Pages

Template pages start with zero external links; internal linking is their only PageRank supply.

1. **Hub pages**: every instance page is ≤2 clicks from an indexed hub (category page or curated "browse" page). Hubs link to instances; instances link back via breadcrumb.
2. **Related-instance links**: 4–8 links per page to sibling instances chosen by an actual relevance rule (same category, adjacent geography, similar attributes) — not random rotation, which creates crawl noise and no topical signal.
3. **Breadcrumbs with BreadcrumbList schema**: reinforce hierarchy and win the SERP breadcrumb display.
4. **Cross-links from money pages**: link the 10–20 highest-opportunity instances from the homepage, blog posts, or nav — hand-placed links to prove the set matters.
5. **XML sitemaps segmented by template** (`sitemap-locations.xml`, `sitemap-comparisons.xml`) so indexation ratio is diagnosable per page type.

## Workflow

1. **Run the fit test.** Verify all three conditions with evidence: sample 20 instance-level queries in a keyword tool for demand; inventory the dataset for uniqueness. Deliver the verdict before any build talk.
2. **Design the dataset.** Define the schema (columns per instance), source tier, enrichment plan, refresh cadence, and the minimum-data threshold below which no page renders.
3. **Spec the template.** Module-by-module: which are data-driven (unique per page) vs shared. Compute the unique-value share; iterate until data modules are ≥50% of the visible page. Write one full example page by hand — if the hand version isn't obviously useful, the template won't be.
4. **Define URL and facet rules.** Canonical pattern, which facets index, noindex/canonical treatment for the rest, sitemap segmentation.
5. **Plan internal linking.** Hubs, related-instance rule, breadcrumbs, sitemap files.
6. **Launch 50–100 pages** — the highest-demand, richest-data instances, not a random sample. This is the cohort Google judges the template by.
7. **Verify for 3–6 weeks against explicit gates**, then scale in tranches (500, then 2,000, then the rest), rechecking every gate each tranche. Never 10,000 pages on day one: a bad template at 100 pages is an edit; at 10,000 it's a sitewide quality problem.

   | Gate | Pass | Fail action |
   |---|---|---|
   | Indexation ratio | ≥90% of pilot indexed | Diagnose the excluded pages' shared trait (sparse data? near-duplicates?) and fix the template rule |
   | Ranking signal | Most pilot pages appear top 50 for their target query within 6 weeks | Query choice or authority problem — revisit pattern demand or build hub authority first |
   | Engagement | Engagement time within ~30% of site average | Template underdelivers on intent — add or reorder data modules |
   | Zero manual actions / sitewide dips | Search Console clean, rest-of-site traffic stable | Stop, prune the pilot, reassess before any scaling |
8. **Prune quarterly.** Pull every pSEO page live 6+ months and sort into the pruning matrix:

   | Page state (trailing 90 days) | Query still has demand? | Action |
   |---|---|---|
   | Clicks > 0 or ranking positions 4–20 | — | Keep; improve the near-misses (add data modules, inlinks) |
   | Zero clicks, <10 impressions/month | Yes | Improve: enrich data, merge with a sibling facet, add inlinks; recheck next quarter |
   | Zero clicks, <10 impressions/month | No | 301 to the parent hub if it covers the intent; 410 if nothing does |
   | Below minimum-data threshold (data decayed) | — | Unpublish and 301 to parent until the data returns |

   Removing dead weight raises the average quality of what remains — sites regularly see surviving pages lift within a few crawls of a prune. Cap improve-listed pages at what you'll actually fix this quarter; "improve someday" is a keep decision in disguise.

## Common Mistakes

1. **Scaling before validating.** Publishing 10,000 pages, then checking whether Google likes the template. Fix: 50–100 page pilot with explicit pass/fail gates (step 7); the pilot cohort is cheap to fix, the full set is not.
2. **City-swap templates.** Identical paragraphs with `{city}` substituted — the canonical example in Google's scaled-content-abuse documentation. Fix: per-instance data modules (local listings, prices, counts, availability); if you have no per-city data, you don't have per-city pages.
3. **Letting facets multiply unindexed URLs.** Every filter combination gets a crawlable, indexable URL and crawl budget drowns. Fix: decide the index/noindex matrix per facet from demand data before launch; block 2+ facet combos.
4. **Ignoring the indexed:submitted ratio.** Publishing tranche after tranche while "Crawled – currently not indexed" climbs. Fix: treat <60% indexed as a stop signal, not a lag to wait out.
5. **Orphaned instance pages.** Pages exist only in the sitemap, with no internal links pointing at them; Google deprioritizes what the site itself doesn't link to. Fix: hub pages plus related-instance links so every page has 5+ internal inlinks.
6. **No sparse-row handling.** The template renders for every row, so 40% of pages are headers around empty sections. Fix: minimum-data threshold; below it, no page.
7. **Building on undefended data.** Pages generated from the same public API three competitors use, differing only in CSS. Fix: enrich (combine sources, compute rankings, add proprietary signals) or pick a pattern where you hold Tier 1–2 data.
8. **Never pruning.** The set only grows; thousands of zero-click pages dilute sitewide quality signals. Fix: the quarterly improve/redirect/remove pass in step 8.

## Output Format

Deliver a pSEO plan in this order:

1. **Fit verdict** — pass/fail per condition with the evidence (sample queries checked, data uniqueness assessment). If fail: what would change it, and which skill to route to instead.
2. **Pattern spec** — query pattern, estimated instance count, 10 example target queries with demand notes.
3. **Data plan** — schema table (column, source, unique-to-us?), source tier with defensibility note, refresh cadence, minimum-data threshold.
4. **Template spec** — module table (module, data-driven or shared, % of page value), with the unique-value share ≥50% shown.
5. **URL and facet matrix** — canonical pattern plus a table of facet levels with index/noindex/canonical treatment.
6. **Internal linking plan** — hub structure, related-instance rule, sitemap segmentation.
7. **Rollout schedule** — pilot cohort definition, verification gates with numeric thresholds, tranche sizes, and the quarterly pruning rule.

Use markdown tables for the schema, template modules, and facet matrix. State numbers (thresholds, counts, timelines) concretely — no "monitor performance and scale accordingly."
