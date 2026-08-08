---
name: keyword-research
description: "When the user wants to find, evaluate, and prioritize keywords their site can actually rank for. Use for 'keyword research', 'search volume', 'keyword difficulty', 'what keywords should I target', 'long-tail', 'SERP analysis', or 'which keywords can I actually win'. Covers seed expansion, intent tagging, live-SERP difficulty auditing, opportunity scoring, clustering, and a prioritized roadmap. For turning keywords into briefs and clusters of content, see seo-content. For thousands of templated pages, see programmatic-seo."
metadata:
  version: 1.0.0
---

# Keyword Research

Act as a senior SEO strategist who has built organic channels for both new domains and established sites, and who treats keyword tools as noisy instruments rather than oracles. The outcome of this skill is not a keyword dump — it is a prioritized roadmap of keyword clusters the site can realistically win, each tagged with intent, a difficulty verdict from the live SERP, and an opportunity score tied to business value.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it usually answers the product, audience, and competitor questions. Only ask what it doesn't cover.

Ask these grouped questions (batch them, don't drip):

1. **Business:** What does the product do, and what does a conversion look like (demo, signup, purchase)? Roughly what is a customer worth? This drives intent-to-value weighting.
2. **Site reality:** What's the domain, how old is it, and what's its approximate authority (DR/DA if known)? Is Google Search Console connected? Existing positions 5–15 are the fastest wins and only GSC shows them.
3. **Competitors and language:** Which 3–5 sites rank where you want to rank? Where do your customers talk (subreddits, forums, communities), and do you have sales-call notes or support tickets? Customer vocabulary beats tool suggestions.
4. **Capacity and tools:** How many pieces of content can you ship per month, and which tools do you have (Ahrefs, Semrush, GSC only, nothing)? The roadmap must fit real capacity.

## Seed Expansion Methods

Start from 5–15 seed terms and expand to 150–500 raw candidates before filtering. Use every method — each surfaces keywords the others miss.

| Method | How | What it uniquely finds |
|---|---|---|
| Competitor gaps | Pull top pages/keywords for 3–5 ranking competitors; keep terms where they rank top 10 and you don't | Proven-demand terms with a known content template to beat |
| Autocomplete + PAA mining | Type seeds into Google, harvest autocomplete; expand every People Also Ask box twice | Long-tail question phrasing with near-zero tool coverage |
| Forum language | Search Reddit/niche forums for the problem space; extract the exact nouns and verbs users write | Pre-solution vocabulary — how buyers describe pain before knowing product terms |
| Sales-call vocabulary | Mine call notes, support tickets, onboarding surveys for repeated phrases | High-intent commercial phrasing tools never suggest; often zero reported volume |
| GSC queries | Export 16 months of queries; filter impressions > 50 and position 5–30 | Keywords Google already associates with the site — the quick-win pool |

## Intent Tagging

Tag every candidate. Intent determines both business value and what page type can rank — an informational SERP will not rank a product page no matter how good it is.

| Intent | Signals in query | Ranking page type | Business-value weight |
|---|---|---|---|
| Transactional | buy, pricing, demo, tool, software, "best X for Y" | Product/comparison page | 1.0 |
| Commercial investigation | best, vs, alternatives, review, comparison | Listicle/comparison | 0.7 |
| Informational | how, what, why, guide, examples | Blog/guide | 0.3 |
| Navigational | brand names, login, docs | Skip unless it's your brand | 0.1 |

Confirm the tag against the live SERP: if Google ranks guides for a query you tagged transactional, Google's read wins.

## Difficulty Reality-Check

Tool KD scores are a proxy built mostly on backlink counts. They miss content quality and SERP layout, and the same KD 25 can mean "winnable this quarter" or "dominated forever." Audit the live SERP for every keyword that survives filtering:

| SERP signal | Check | Verdict |
|---|---|---|
| Domain strength | DR/DA of positions 1–10 | Two or more results with DR within ~20 points of yours (or DR < 40) = winnable |
| Content quality | Open the top 3. Thin, outdated, off-intent, or forum results? | Any weak top-3 result = real opening regardless of KD |
| SERP feature crowding | Ads, shopping, AI overview, PAA, video above position 1 | Heavy features can cut organic CTR 30–60%; discount volume accordingly |
| Result diversity | Forums, UGC, or small sites ranking | Reddit/Quora in the top 5 is the strongest winnability signal there is |

A new or low-authority site (DR < 30) should target KD < 20–30 equivalents only, and lean on the long tail until it has rankings and links to spend. Sending a fresh domain at KD 60 head terms wastes quarters.

Worked audit — "gantt chart maker for construction", site DR 22, tool KD 12:

- Positions 1–10: two DR 85+ tool brands, one DR 31 niche blog, one DR 18 template site, a Reddit thread at position 6.
- Top 3 content: the brand pages are generic gantt landing pages that never mention construction; the niche blog is a 2021 listicle with dead links.
- Features: 3 ads on top, PAA at position 4, no AI overview. Discount effective volume ~25%.
- Verdict: winnable — Reddit in the top 10 plus off-intent top-3 content outweighs the big-brand presence. Winability 7/10 with a construction-specific comparison page.

Do this level of audit for every cluster entering the roadmap; the whole check takes 2–3 minutes per keyword.

### Winability rubric

Anchor the 1–10 winability score so it stays consistent across keywords:

| Score | Live SERP looks like |
|---|---|
| 1–2 | Top 10 all DR 70+, strong on-intent content, heavy SERP features |
| 3–4 | Mostly DR 50+, decent content; one weak result at position 8–10 |
| 5–6 | Mixed DR, at least two results within ~20 DR points of the site, or top-3 content is mediocre |
| 7–8 | Forum/UGC in top 10, or 2+ low-DR sites ranking, or top 3 off-intent |
| 9–10 | Reddit/Quora in top 5, thin or outdated content across the SERP |

## Opportunity Scoring

Score = Volume score × Intent-to-business-value × Winability. Rate each factor 1–10 (intent uses the weight table above ×10, winability uses the rubric above), multiply, rank. The multiplication is deliberate: a zero-ish factor should kill a keyword, and averaging would hide that.

Convert reported volume to a coarse 1–10 band rather than using raw numbers — the bands absorb the ±50% tool error:

| Reported monthly volume | Volume score |
|---|---|
| 0–10 (incl. "zero-volume" from sales/forum sources) | 2 |
| 10–100 | 3 |
| 100–500 | 4 |
| 500–1,000 | 5 |
| 1,000–5,000 | 6 |
| 5,000–10,000 | 7 |
| 10,000–50,000 | 8–9 |
| 50,000+ | 10 |

Worked example for a DR 22 project-management tool site:

| Keyword | Vol/mo | Vol score | Intent weight | Winability | Opportunity |
|---|---|---|---|---|---|
| project management software | 74,000 | 10 | 10 | 1 | 100 |
| gantt chart maker for construction | 480 | 4 | 10 | 7 | 280 |
| how to write a project charter | 2,900 | 6 | 3 | 8 | 144 |
| asana vs monday for agencies | 210 | 3 | 7 | 8 | 168 |
| free project timeline template | 4,400 | 7 | 5 | 6 | 210 |

The 74k head term scores worst — winability 1 zeroes it out for now. The 480-volume long-tail transactional term scores best. This is the normal result, not an edge case.

## Volume Skepticism

Treat tool volumes as ±50% error bars, not measurements. Tools bucket volumes, average across 12 months (hiding seasonality), and undercount long-tail and new terminology badly. Two consequences:

- Never let a 10x volume difference between two tools change a decision; check GSC impressions if you rank at all, since that's the only ground truth.
- "Zero volume" long-tail keywords — especially sales-call vocabulary — often convert best precisely because tools can't see them and competitors don't target them. If real buyers say the phrase, write for it.
- For anything plausibly seasonal (tax, holidays, events, "template" terms spiking in January), check the 12-month trend rather than the average — a flat 2,000/mo average can hide a 10,000 December peak that changes when to publish.

## Clustering

Group keywords so each cluster maps to one page — separate pages for "gantt chart maker" and "gantt chart creator" cannibalize each other.

- **Lexical first pass:** run the bundled script for a fast shared-token grouping:
  `node scripts/cluster-keywords.js keywords.csv --threshold 0.5`
  It accepts a CSV (keywords in the first column, header auto-skipped) or a plain newline list, and prints groups largest-first with a suggested head term plus an "Ungrouped" list of singletons.

  | Option | Default | Effect |
  |---|---|---|
  | `--threshold` | 0.5 | Jaccard similarity needed to merge; drop to 0.35–0.4 for looser topical groups, raise to 0.6+ for near-variant-only groups |
  | `--min-group` | 2 | Groups smaller than this print under Ungrouped |

  If most keywords land in Ungrouped, lower the threshold; if unrelated topics merge into one mega-group, raise it. Re-running takes seconds — tune until groups look like pages. Example output:

  ```
  Group 1 (4 keywords) — suggested head: "gantt chart maker"
    - gantt chart maker
    - gantt chart creator
    - free gantt chart maker
    - gantt chart maker for construction
  ```
- **SERP-overlap verification:** lexical similarity is a heuristic; SERP overlap is the truth. For each cluster you'll actually target, Google the head term and one or two members. 3+ shared top-10 URLs = one page. Distinct SERPs = split the cluster even if the words are near-identical ("crm" vs "crm meaning" share tokens but not SERPs). The reverse also happens: "kanban vs scrum" and "scrum vs kanban board" may cluster separately lexically but share a SERP — merge them.

## Workflow

1. Gather context per Before Starting; read `.agents/product-marketing.md` if present.
2. Expand seeds using all five methods to 150–500 raw candidates. Record source per keyword — sales-call and forum terms deserve benefit of the doubt later.
3. Filter the raw list: drop competitor brand names (except as "X vs Y" / "X alternatives" candidates), terms with no plausible page on this site, and geographies or languages the business doesn't serve.
4. Deduplicate and cluster: run `scripts/cluster-keywords.js`, then verify the top ~20 clusters by SERP overlap. Merge or split accordingly.
5. Tag intent per cluster (tag the head term, spot-check members).
6. Pull GSC positions if available. Anything ranking 5–15 goes straight to the quick-win list — improving an existing page beats publishing a new one by weeks.
7. Reality-check difficulty on the live SERP for every cluster that could make the roadmap. Assign winability 1–10 using the rubric.
8. Score every cluster with the opportunity formula. Show the scoring table — the user should see why, not just the ranking.
9. Build the roadmap: quick wins first, then top-scored new clusters sized to stated monthly capacity, then a parking lot of head terms to revisit once authority grows.

## Common Mistakes

1. **Trusting tool KD without opening the SERP.** KD 15 with three DR 80 brands in the top 3 is not easy; KD 45 with two Reddit threads ranking is not hard. Fix: the live-SERP audit is mandatory for anything entering the roadmap.
2. **Chasing head terms from a new domain.** "project management software" from DR 20 is a two-year project at best. Fix: cap targets at KD < 20–30 equivalents until rankings prove authority, and park head terms explicitly so the ambition isn't lost.
3. **Discarding zero-volume keywords.** Tools are blind below their bucketing floor and to new phrasing. Fix: keep any zero-volume term sourced from sales calls or forums; assign volume score 2–3 rather than 0.
4. **One page per keyword.** Publishing separate posts for every lexical variant splits link equity and cannibalizes rankings. Fix: cluster first, SERP-verify, one page per verified cluster.
5. **Ignoring intent when scoring.** A 20k-volume informational term can score below a 200-volume transactional one — and should. Fix: multiply, never average, so low intent weight actually drags the score down.
6. **Skipping GSC quick wins.** Teams plan six months of new content while page 2 rankings sit one internal-link-and-refresh away from page 1. Fix: positions 5–15 are always roadmap items 1 through N.
7. **Treating volume as precise.** Ranking keyword A over B because one tool says 900 vs 700 is false precision inside the error bars. Fix: score volume in coarse 1–10 bands.
8. **Running research once and freezing it.** SERPs shift, GSC surfaces new queries within weeks of publishing, and winability changes as the site earns links. Fix: refresh the quick-win list monthly from GSC and re-score the parking lot quarterly.

## Output Format

Deliver a keyword research report in this structure:

1. **Summary** — 3–5 sentences: site's authority position, the strategic angle (e.g., "long-tail transactional first, head terms parked"), expected focus for the next quarter.
2. **Quick wins** — table of existing positions 5–15: keyword, current position, URL, fix (refresh / internal links / retarget intent).
3. **Prioritized cluster roadmap** — table sorted by opportunity score: cluster head term, member count, intent, volume band, winability (with one-line SERP evidence), opportunity score, suggested page type, priority (P1 = this month within capacity, P2 = this quarter, P3 = parked). Example row shape:

   | Cluster head | Members | Intent | Vol band | Winability | Score | Page type | Priority |
   |---|---|---|---|---|---|---|---|
   | gantt chart maker for construction | 4 | Transactional | 100–500 | 7 — Reddit at #6, off-intent top 3 | 280 | Comparison landing | P1 |

4. **Scoring table** — the worked opportunity math for at least the top 10 clusters, so the prioritization is auditable.
5. **Parking lot** — head terms and high-KD clusters to revisit, with the trigger condition ("revisit when 3 P1 clusters hit top 5" or "at DR 35+").
6. **Assumptions and gaps** — unverified volumes, missing GSC access, guessed DR — anything that would change the ranking if corrected.

Keep the roadmap sized to stated capacity. Ten P1 clusters for a team that ships two posts a month is a plan that fails by design.
