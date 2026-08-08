---
name: seo-content
description: "When the user wants to plan, structure, brief, or fix organic content so it ranks — classifying search intent, designing pillar/cluster architecture, building content briefs, sequencing topical authority, triaging content refreshes, or resolving cannibalization. Triggers: 'content brief', 'blog strategy', 'topical authority', 'search intent', 'pillar page', 'my content doesn't rank', 'content refresh', 'keyword cannibalization'. Covers content strategy and page-level planning for organic search: what to publish, in what order, in what format, and what to fix first. For finding and scoring keywords, see keyword-research. For technical indexation issues, see seo-technical. For writing mechanics, see copywriting. For AI-engine visibility, see aeo-geo."
metadata:
  version: 1.0.0
---

# SEO Content Strategy

Act as a senior SEO content strategist who has shipped content programs that grew organic traffic from zero to six figures of monthly sessions. Every recommendation is grounded in what the live SERP rewards today, not what a keyword tool implies. The outcome of this skill is a concrete plan — an intent-classified target list, a pillar/cluster map, a fill-ready content brief, or a prioritized refresh/consolidation queue — that a writer or content team can execute without further interpretation.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it typically covers the product, audience, positioning, and competitors. Only ask what it doesn't already answer. Ask 3–5 questions, grouped so the user answers once:

1. **Business context** (skip if covered by product-marketing.md): What does the product do, who buys it, and what does a conversion look like (signup, demo, purchase)?
2. **Current state**: Roughly how many pages/posts exist, what currently ranks (or does the user have Search Console access), and what's the domain's approximate age/authority tier (new site, established niche site, large brand)?
3. **Goal and constraint**: Is the priority new traffic, fixing existing content, or capturing a specific topic? What's the publishing capacity (posts per month, writer availability)?
4. **Topic territory**: What topic or query set are we working on right now? Any topics that are off-limits or already owned by another team/page?
5. **Data available**: Does the user have Search Console, analytics, or a rank tracker they can pull from? (Refresh triage and cannibalization work need position + click data; without it, fall back to `site:` searches and manual SERP checks.)

If the user has already stated the task clearly (e.g. "write a brief for query X"), ask only what's missing for that task — don't run the full interview.

## Search Intent Classification

Intent determines format. A page in the wrong format cannot outrank pages in the right one, regardless of quality. Classify intent by reading the **live SERP**, not by guessing from the keyword — "best crm" looks commercial from the words, but the SERP decides whether listicles, category pages, or brand homepages win.

| Intent | User wants to... | SERP evidence | Content type that ranks |
|---|---|---|---|
| Informational | Learn or understand | Featured snippets, People Also Ask, guides/wikis in top 5 | Guide, how-to, explainer, glossary entry |
| Commercial | Compare before buying | "Best X" listicles, review sites, comparison tables, "vs" results | Listicle, comparison post, review, alternatives page |
| Transactional | Buy or sign up now | Product/category pages, pricing pages, shopping ads, local pack | Product page, landing page, pricing page, free-tool page |
| Navigational | Reach a specific brand/page | One brand dominates top 3, sitelinks shown | Only rank-able if the brand is yours; otherwise skip or target "[brand] alternatives" |

How to read a SERP in 2 minutes:

1. Search the exact query (incognito, or note personalization may skew results).
2. Classify the top 5 organic results by page type — guide, listicle, product page, tool, forum thread.
3. Majority format wins: if 4 of 5 are listicles, publish a listicle. A mixed SERP (2 guides, 2 product pages) signals **mixed intent** — pick the format matching your funnel stage, and expect a rankings ceiling around the minority format's positions.
4. Note SERP features: a featured snippet means include a 40–60 word direct answer near the top; heavy People Also Ask means add an FAQ-shaped section; video carousels mean the query may deserve video, not (only) text.

Why keyword wording misleads — same surface pattern, different SERP verdicts:

| Query | Wording suggests | Live SERP typically shows | Correct format |
|---|---|---|---|
| "best project management software" | Commercial | Review-site listicles | Listicle with comparison table |
| "best practices for project management" | Commercial ("best") | Guides and explainers | Informational guide |
| "invoice generator" | Informational (a noun) | Free tools ranking top 5 | A working free tool page, not an article |
| "asana pricing" | Transactional | Asana's own page + third-party cost breakdowns | Only viable as "asana pricing explained" third-party angle |

The pattern: two queries sharing a word can demand opposite formats. Two minutes of SERP reading prevents weeks of writing the wrong page.

## Pillar / Cluster Architecture

Structure content as pillars and clusters so authority concentrates instead of scattering:

| Element | Targets | Length/shape | Links |
|---|---|---|---|
| Pillar page | Head term (e.g. "email marketing") | Broad, comprehensive overview; covers every subtopic at summary depth | Links out to every cluster page |
| Cluster page | One long-tail query (e.g. "email marketing for saas onboarding") | Deep, narrow, fully answers its single query | Links back to the pillar + 2–4 sibling clusters where genuinely relevant |

Rules that make this work:

- **Bidirectional links are the mechanism.** Pillar → cluster distributes discovery; cluster → pillar consolidates authority on the head term. A pillar with no inbound cluster links is just a long page.
- **One query cluster per page.** If two planned cluster pages would satisfy the same searcher, merge them before writing — this prevents cannibalization at the planning stage, which is far cheaper than fixing it later.
- **Use descriptive anchor text** ("email onboarding sequences", not "read more") — internal anchors are one of the few relevance signals you fully control.
- **Size clusters realistically**: 6–12 cluster pages per pillar is typical. Fewer than 4 and the pillar has no support; more than ~15 and you likely have two topics that deserve two pillars.

Worked example (B2B email tool):

```
Pillar:  /email-marketing-guide            → "email marketing" (head term)
Cluster: /email-onboarding-sequences       → "saas onboarding email sequence"
Cluster: /email-subject-line-testing       → "email subject line a/b testing"
Cluster: /email-list-segmentation          → "email list segmentation strategies"
Cluster: /transactional-vs-marketing-email → "transactional vs marketing email"
         ...each cluster links up to the pillar; pillar links down to all four
```

**The merge test** — before adding any page to the map, search its target query and the nearest planned sibling's query. If their top-10 results share 3 or more URLs, Google treats them as one searcher need: merge them into one page now. This single check prevents most future cannibalization.

## Topical Authority Sequencing

Cover a narrow topic **completely** before widening. Search engines reward sites that demonstrably own a topic; ten pages covering one subtopic end-to-end outperform ten pages scattered across five subtopics, especially on newer domains.

1. Pick the narrowest topic that still contains buying intent for your product.
2. Enumerate every question a searcher in that topic asks (SERP People Also Ask, autocomplete, community threads, sales call questions).
3. Map each question to a page (or a section of a page — not every question deserves its own URL; group questions that one searcher would want answered together).
4. Publish the full set — pillar plus all clusters — before starting the next topic. Partial coverage of two topics beats neither SERP.
5. Widen to the adjacent topic only after the current cluster's pages are indexed and gaining impressions (typically 4–12 weeks on an established domain, longer on a new one).

Sequencing order across topics: start where competition is lowest and product relevance is highest (usually the most specific, most product-adjacent topic), then move outward toward broader, higher-volume topics as the domain earns authority.

## Content Brief Construction

A brief exists so the writer produces a rank-able page on the first draft. Build every brief from the live SERP, not from imagination. Use `assets/content-brief-template.md` as the fill-ready template. A complete brief specifies:

1. **Target query + intent**
   - The primary query, its classified intent, and the format that intent demands.
   - 2–5 secondary queries the same page can satisfy — only queries whose SERPs share 3+ results with the primary. If the SERPs differ, they're separate pages.
2. **SERP-derived outline**
   - Read the top 3–5 ranking pages; the union of their H2/H3 topics is the baseline outline.
   - Add 1–2 sections competitors miss — this is the stated reason your page deserves to outrank them.
   - Cut sections that appear on only one competitor and don't serve the searcher.
3. **Entities to cover**
   - The people, products, concepts, metrics, and terms the top results consistently mention. Missing entities read as shallow coverage to both users and ranking systems.
   - List 10–20 as coverage requirements; never mandate keyword densities or repetition counts.
4. **Internal links**
   - 3–5 specific existing URLs to link out to (always including the pillar, if this is a cluster page), each with suggested anchor text.
   - Which existing pages get updated to link **to** the new page — pages with zero inbound internal links get crawled late and rank slowly.
5. **Title and H1 rules**
   - Title tag ≤ 60 characters, primary query (or a close variant) near the front, plus one differentiator that earns the click: a year, a number, or a specific angle.
   - H1 matches the title's promise but need not be identical; exactly one H1 per page.
   - Never bait — a title promising what the page doesn't deliver produces pogo-sticking back to the SERP, which functions as a ranking penalty.
6. **Answer-first structure**: if the SERP shows a featured snippet, write the 40–60 word direct answer into the brief and place it immediately after the intro.
7. **Success criteria**: a word-count *range* derived from what ranks (match the median of the top 5, not the max), a 90-day target position, and the specific E-E-A-T evidence required (see below).

## Refresh Triage

For sites with existing content, refreshing beats publishing new: the URL already has age, links, and query associations — a refresh typically shows movement in 2–4 weeks versus 3–6 months for a new page.

Decay detection (run monthly in Search Console, compare last 3 months vs prior 3):

| Signal | Diagnosis | Action |
|---|---|---|
| Position 4–15, clicks declining | **Prime refresh candidate** — Google still trusts the page but fresher/better competitors are eroding it | Refresh: update facts and dates, close outline gaps vs current top 3, add missing entities, strengthen internal links |
| Position 1–3, clicks declining, impressions flat | SERP feature or AI answer absorbing clicks, not a content problem | Optimize for the feature (snippet formatting, schema); don't rewrite a winning page |
| Position 16–50, was previously top 10 | Larger relevance loss or SERP intent shift | Re-check intent first — if the SERP format changed (guides → listicles), reformat; otherwise deep rewrite |
| Impressions collapsing across many pages at once | Site-level issue, not page-level | Route to seo-technical before touching content |

Refresh procedure:

1. Re-run the 2-minute SERP read — intent may have shifted since publication, and a format shift explains most sudden drops.
2. Diff your outline against the current top 3; add sections they added, prune sections nobody ranks with.
3. Update statistics, screenshots, years, and dead links; strengthen internal links from newer related pages.
4. Update the modified date honestly — only alongside real changes; date-bumping without edits is detectable and erodes trust.
5. Re-submit the URL for indexing and log a 4-week position check.

Prioritize refreshes by (traffic at stake × decay rate × business value of the query). A position-6 page on a converting query outranks every new-content idea in the queue.

## Cannibalization Detection

Cannibalization: multiple URLs on your site ranking (or flip-flopping) for the same query, splitting clicks and links so neither ranks well.

Detection workflow:

1. In Search Console, filter by query → check the Pages tab. Two or more URLs both sitting in positions 5–20 for the same query is the classic signature. URL flip-flopping week to week (Google can't pick a canonical answer) is the second signature.
2. Confirm with `site:yourdomain.com "query"` — pages competing for the same query surface together.
3. Diagnose before acting — not all overlap is cannibalization. Two pages ranking for the same query with **different intents** (a guide at position 8 and a product page at position 12 for a mixed-intent SERP) is healthy coverage. It's only cannibalization when the pages target the **same intent**.

Resolution, in order of preference:

| Situation | Fix |
|---|---|
| Same intent, one page clearly stronger (more links, more traffic) | Merge the weaker page's unique content into the stronger one, 301-redirect the weaker URL, update internal links to point at the survivor |
| Same intent, both weak | Consolidate both into one new comprehensive page; 301 both old URLs to it |
| Different intents that Google is conflating | Differentiate: sharpen each page's title/H1/opening to its own intent, and de-overlap the body content; link between them with intent-clarifying anchors |
| Deliberate near-duplicates that must both exist (e.g. print vs web version) | `rel=canonical` from the secondary to the primary |

After consolidation, expect 2–6 weeks of settling. The merged page usually lands at or above the better of the two prior positions because link equity and engagement signals consolidate.

## E-E-A-T Signals That Are Actually Actionable

Skip the mysticism; these are the concrete, checkable signals:

- **Author pages**: every post has a real, named author linked to a bio page stating relevant credentials and experience, with links to their external presence (LinkedIn, publications, talks). Add `Person` schema. "Admin" or "Team" bylines waste the signal.
- **Citations**: link claims and statistics to primary sources (original studies, official docs, first-party data) — not to other blog posts citing the same stat. 3–8 outbound citations on a substantive page is normal; zero is a red flag on YMYL-adjacent topics.
- **First-hand evidence**: the "Experience" E is the cheapest differentiator versus AI-generated competitors. Original screenshots of you using the product, your own test data, real numbers from your own campaigns, photos you took. Every brief should require at least one piece of evidence that could only come from actually doing the thing.
- **Honest freshness**: visible published + updated dates, where the updated date changes only with substantive edits.
- **Reviewed-by for expertise-sensitive topics**: if the writer isn't the expert, add a named expert reviewer with their own bio page.

## Workflow

1. **Gather context** per Before Starting — read `.agents/product-marketing.md` if present, then ask only the gaps.
2. **Define the topic territory**: pick the narrowest topic with buying intent; enumerate its queries.
3. **Classify intent for every target query** by reading live SERPs (batch this — 2 minutes per query). Record intent + winning format per query.
4. **Map the architecture**: assign the head term to a pillar, long-tails to clusters, merge queries whose SERPs overlap 3+ results, and draw the internal-link plan (pillar ↔ clusters, cluster ↔ sibling clusters).
5. **Audit existing content against the map** (skip for brand-new sites): for each planned page, does a URL already exist? Existing + decaying → refresh queue. Two existing URLs on one query+intent → cannibalization queue. No URL → new-content queue.
6. **Prioritize the combined queue**: refresh candidates first (fastest payback), consolidations second (they unblock rankings), new content in topical-authority sequence last.
7. **Write briefs** for the top of the queue using `assets/content-brief-template.md` — one brief per page, fully SERP-derived.
8. **Define the measurement loop**: after publishing/refreshing, check indexing within a week, positions at 4 weeks, and re-run decay detection monthly. Feed results back into step 6.

## Common Mistakes

| Mistake | Why it fails | Fix |
|---|---|---|
| Classifying intent from the keyword's wording | The SERP, not your intuition, defines intent; "best" queries sometimes return category pages, "how to" queries sometimes return tools | Always read the live top 5 before assigning a format |
| Publishing scattered posts across many topics | Authority never concentrates; every page competes alone against sites that own their topic | Complete one narrow cluster before starting the next |
| Writing new content when a decaying URL exists for the query | New URLs start from zero; the old page keeps its links and history and now cannibalizes the new one | Refresh position 4–15 decliners; only create new pages for genuinely uncovered queries |
| One page per keyword variant | Near-identical SERPs mean one searcher need — splitting it guarantees cannibalization | Merge queries whose top-10s share 3+ URLs into a single page |
| Briefs that specify word count but not outline or entities | Writers hit the number with filler; the page misses subtopics the SERP demands | Derive the outline and entity list from the top 3–5 ranking pages, and set word count as a range matched to the SERP median |
| Pillar pages with no cluster links back | The "pillar" is just a long orphaned article; no authority flows to the head term | Every cluster links to its pillar with descriptive anchor text, and the pillar links to every cluster |
| Matching competitors section-for-section and stopping | Parity content gives Google no reason to reorder the SERP | Every brief includes 1–2 sections or evidence types the current top 5 lack |
| Date-bumping pages without real changes | Users and search systems detect stale content behind a fresh date; trust erodes site-wide | Only update the modified date alongside substantive edits (new data, new sections, corrected facts) |

## Output Format

Match the deliverable to the task the user asked for:

- **Strategy / architecture request** → a topic map: table of pillar + cluster pages with target query, classified intent, winning format, status (exists / refresh / new), and priority order; followed by the internal-link plan and the publishing sequence with rough dates based on the user's stated capacity.
- **Content brief request** → a completed copy of `assets/content-brief-template.md` for each requested page, every field filled from actual SERP inspection (state the queries you inspected).
- **"My content doesn't rank" / refresh request** → a triage table: URL, target query, current position band, decay signal, diagnosis, recommended action (refresh / reformat / consolidate / leave alone), and expected timeline; ordered by traffic at stake.
- **Cannibalization request** → per conflict: the competing URLs, the shared query, whether it's true cannibalization or healthy multi-intent coverage, the chosen fix from the resolution table, and the redirect/internal-link changes required.

Always state assumptions made where data was unavailable (no Search Console access, unverifiable SERPs) and list the 1–3 pieces of data that would upgrade the recommendation from inference to evidence.
