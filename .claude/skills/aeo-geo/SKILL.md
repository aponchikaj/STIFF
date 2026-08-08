---
name: aeo-geo
description: "When the user wants to make their brand or content show up in AI-generated answers and get cited by answer engines. Triggers: 'AI search', 'ChatGPT recommends', 'Perplexity', 'AI Overviews', 'answer engine optimization', 'AEO', 'GEO', 'LLM visibility', 'how do I show up in AI answers'. Covers how answer engines retrieve and cite sources, citation-readiness audits, entity establishment, AI crawler access decisions, answer-source patterns, and measuring AI-referral share. For the underlying content quality, see seo-content. For structured data and crawlability, see seo-technical."
metadata:
  version: 1.0.0
---

# Answer Engine Optimization (AEO / GEO)

Act as an answer engine optimization strategist who has audited sites for citation share in ChatGPT, Perplexity, Google AI Overviews, and Claude, and who understands both the retrieval mechanics and the content patterns that actually earn citations. The outcome: a concrete, prioritized plan that gets the user's brand named and their pages cited when AI assistants answer questions in their category — not generic "write good content" advice.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it covers positioning, ICP, and category language. Only ask what it doesn't answer. Ask 3–5 grouped questions:

1. **Category and queries**: What product/category are you in, and what 3–5 questions do you most want AI assistants to answer with your brand? (e.g., "best X for Y", "how do I Z")
2. **Current footprint**: Do you have a blog/docs/comparison pages already? Are you mentioned in any third-party roundups, review sites, or Wikipedia? Any idea whether AI crawlers can access your site (robots.txt, JS-heavy rendering)?
3. **Baseline**: Have you tested what ChatGPT/Perplexity currently say when asked your target questions? Any AI-referral traffic showing in analytics?
4. **Constraints**: Who writes content, how much can ship per month, and are there legal/brand limits on naming competitors?

## How Answer Engines Source Content

Two separate games are being played, and most people conflate them:

| Layer | Mechanism | What you control | Time to impact |
|---|---|---|---|
| **Retrieval-augmented answers** | Engine runs a live web search, reads top results, selects passages to cite | Ranking in the underlying index (Bing for ChatGPT, Google for AI Overviews, Perplexity's own crawl) + being the most extractable passage on the page | Weeks — as fast as normal SEO |
| **Training-data brand presence** | Model "knows" your brand from pretraining; recommends you even without search | Volume and consistency of brand mentions across the open web before the training cutoff | 6–18 months; compounds slowly |

Practical implication: retrieval is where near-term wins live. A page that ranks top-10 for the underlying query and contains a clean, quotable answer block can be cited within weeks. Training-data presence is why category leaders get named even in offline answers — you build it by being mentioned consistently across many independent sources, not by anything on your own site alone.

Engines cross-check claims across sources. A fact that appears only on your site is weaker than the same fact corroborated by two or three independent pages.

Per-engine nuances worth knowing (as of 2026):

| Engine | Underlying index | Citation behavior | Practical priority |
|---|---|---|---|
| ChatGPT (search mode) | Bing + OpenAI crawl | Cites 2–5 sources inline; favors pages that answer the exact question quickly | Rank in Bing; allow OAI-SearchBot; tight answer blocks |
| Perplexity | Own index (PerplexityBot) | Heaviest citer — numbered citations on nearly every claim; favors fresh, dated content | Allow PerplexityBot; visible update dates; stats with sources |
| Google AI Overviews | Google Search | Cites pages already ranking roughly top-12 for the query; strong overlap with organic | Classic SEO is the prerequisite; extractability decides which ranking page gets quoted |
| Claude (web search) | Search partner index + ClaudeBot | Selective citing; favors authoritative, well-structured sources | Allow ClaudeBot; entity consistency and corroboration |

The overlap is large: one well-structured, well-ranked, crawler-accessible page serves all four. Don't build per-engine content; build one extractable page and verify access per bot.

## Citation-Readiness Audit

What gets cited, in rough order of citation frequency: **specific statistics with sources**, **crisp definitions**, **step-by-step answers**, **comparison verdicts**. Vague prose almost never gets quoted.

The core unit of AEO is the **extractable answer block**: the question as a heading (H2/H3, phrased the way people ask it), followed immediately by a 40–80 word direct answer. Elaboration comes after, never before. Engines lift that block nearly verbatim.

Per-page checklist — score each priority page:

| Check | Pass condition |
|---|---|
| Question-as-heading | H2/H3 matches a real query phrasing ("How much does X cost?"), not a clever title |
| Direct answer first | 40–80 words immediately under the heading fully answer the question standalone |
| Standalone lift test | The answer block makes sense with zero surrounding context (no "as mentioned above") |
| One stat or number | At least one specific figure, dated and sourced ("42% of teams, 2025 survey of 1,200") |
| Freshness signal | Visible updated date; fast-moving claims marked with the year |
| Entity clarity | Brand name + what it is stated plainly at least once ("Acme is a payroll platform for restaurants") |
| Crawler access | Page renders its content in HTML (not JS-only) and isn't blocked in robots.txt |
| FAQ/definition markup | FAQPage or DefinedTerm schema where the shape fits (see seo-technical for implementation) |

A page passing 6+ of 8 is citation-ready. Fix the direct-answer and standalone checks first — they matter more than markup.

## Entity Establishment

Engines resolve brands as entities and cross-check facts about them. Inconsistency (different descriptions, founding years, category labels across pages) makes them hesitate to assert anything about you.

1. **Canonical fact set**: Write one 50-word brand description + core facts (category, founded, HQ, pricing model, key differentiator). Use it verbatim on your About page, footer boilerplate, social bios, and press materials.
2. **Organization schema with sameAs**: Mark up your homepage with Organization schema linking to your LinkedIn, Crunchbase, GitHub, X — this ties your web presence into one entity graph.
3. **Wikipedia/Wikidata where warranted**: Only if you meet notability standards — a deleted promotional article hurts more than absence. A Wikidata entry is lower-bar and still useful.
4. **Third-party corroboration**: Get the same facts stated on review sites (G2, Capterra), directories, and press. Two independent sources repeating a claim make it citable; one self-published claim does not.

## Crawler Access

Decide deliberately which AI crawlers to allow. As of 2026, the ones that matter:

| Crawler | Operator | What it feeds | Cost of blocking |
|---|---|---|---|
| GPTBot | OpenAI | Model training data | You fade from future models' baseline knowledge; no immediate traffic loss |
| OAI-SearchBot | OpenAI | ChatGPT live search/citations | You cannot be cited in ChatGPT answers — direct visibility loss |
| PerplexityBot | Perplexity | Perplexity's index and citations | Invisible in Perplexity answers |
| ClaudeBot | Anthropic | Training + Claude web search | Absent from Claude's knowledge and citations |
| Google-Extended | Google | Gemini training (does NOT affect Search ranking or AI Overviews) | Excluded from Gemini training; AI Overviews eligibility follows normal Googlebot access |

The tradeoff: blocking training crawlers protects content from uncompensated training but removes you from the models buyers ask for recommendations. For most companies whose goal is being recommended, block nothing. Publishers monetizing content directly face a real tradeoff; product companies mostly don't. Never block search-mode bots (OAI-SearchBot, PerplexityBot) if you want citations — that's the whole game.

Verify access, don't assume it:

- Check `https://yoursite.com/robots.txt` for each user-agent above — CDN and CMS defaults (some WAF bot-protection presets, some robots.txt plugins) block AI bots without anyone deciding to.
- Fetch a priority page with `curl -A "GPTBot" <url>` and confirm you get a 200 with full content, not a 403 or a challenge page — WAF rules can block bots that robots.txt allows.
- View source (not DevTools-rendered DOM) on priority pages: if the answer content isn't in the raw HTML, most AI crawlers won't see it. Server-render anything you want cited.

## Where Answers Come From

Sample your target prompts and you'll see recurring source patterns:

- **"Best X" / "top X for Y" queries**: listicles and roundup pages dominate — often 6–8 of 10 citations. Being ranked #3 in five other people's roundups usually beats owning your own "best X" page, because engines discount self-serving sources for recommendation queries.
- **"X vs Y" queries**: honest comparison pages win, including third-party ones. Your own comparison page can get cited if it includes real tradeoffs and a table, not a strawman.
- **"What is / how to" queries**: docs, glossaries, and FAQ pages with tight answer blocks.
- **Stat queries**: original research and surveys get cited far out of proportion to their traffic — one good data report can earn citations across dozens of prompts.

Allocate effort accordingly: pitch inclusion in existing roundups (outreach, review-site presence) before writing another listicle of your own.

## Content Shapes That Win

Not all formats earn citations equally. When deciding what to create or restructure, prioritize by citation yield:

| Shape | Why engines cite it | Build notes |
|---|---|---|
| FAQ pages | Query-shaped headings map 1:1 to prompts; answers are pre-extracted | One question per H2/H3, 40–80 word answers, group by topic not alphabet |
| Definitions / glossary | "What is X" prompts are high-volume; a tight definition is the easiest lift | Lead with a one-sentence definition, then expand; one term per URL for competitive terms |
| Original data / surveys | Engines strongly prefer citing a primary source for any statistic | Publish methodology, sample size, and date; give every key stat its own quotable sentence |
| Honest comparison tables | "X vs Y" answers need structured tradeoffs; a fair table gets lifted whole | Include competitors by name, concede real weaknesses — a table where you win every row reads as marketing and gets skipped |
| How-to / step lists | Numbered steps extract cleanly into procedural answers | Number the steps, one action each, state prerequisites up front |
| Pricing pages with real numbers | "How much does X cost" is asked constantly; engines can't cite "contact sales" | Publish at least a starting price and what it includes |

The comparison-table point deserves emphasis: including competitors honestly is counterintuitive but it's what makes your page citable for the highest-intent queries. A page that names no competitors can't be a source for a "vs" answer at all.

## Measurement

You cannot rank-track AI answers the way you track SERPs — answers are probabilistic and personalized. Measure three things instead:

1. **Prompt-panel brand share.** A fixed panel of 15–30 prompts, run against ChatGPT-with-search, Perplexity, and AI Overviews. Build the panel across intent types so it mirrors a real buying journey:

   | Intent type | Example shape | Panel share |
   |---|---|---|
   | Recommendation | "best [category] for [use case]" | ~40% — highest commercial value |
   | Comparison | "[you] vs [competitor]", "alternatives to [competitor]" | ~25% |
   | Problem/how-to | "how do I [job your product does]" | ~25% |
   | Brand fact | "what is [brand]", "how much does [brand] cost" | ~10% — checks entity accuracy |

   For each run record: brand mentioned (Y/N), position if listed, URLs cited, competitors named, and whether facts about you are accurate. Run each prompt 3 times per engine and average — single runs are noise. Monthly cadence; the metric is *brand-mention share*: prompts where you appear ÷ total prompts, tracked per engine over time. Keep the panel stable so the trend means something; add prompts, don't swap them.
2. **AI-referral traffic.** Create an analytics segment for referrers including chatgpt.com, perplexity.ai, gemini.google.com, copilot.microsoft.com, and claude.ai. Expect small absolute numbers (typically 1–5% of organic as of 2026) but watch the trend and the conversion rate — AI-referred visitors arrive pre-qualified by a recommendation and often convert 2–3x better than generic organic.
3. **Citation audits.** When you are cited, note which page and which passage. This tells you which content shapes are working so you can replicate them.

Commercial tools exist for this (Profound, Peec, Otterly and similar, as of 2026), and they're worth it at scale — but a DIY prompt panel in a spreadsheet costs nothing and answers the core question for most teams. Start DIY; buy tooling when the panel outgrows manual runs.

## Workflow

1. **Baseline**: Run each target question through ChatGPT (with search), Perplexity, and Google AI Overviews. Record: is the brand named, which URLs are cited, which competitors appear. This is your prompt panel — save it.
2. **Source map**: For each query, list the cited domains. Tag each as "ours", "earnable third-party" (roundups, review sites you can pitch), or "structural" (Wikipedia, Reddit).
3. **Audit**: Score your top 10–20 pages against the citation-readiness checklist. Verify crawler access in robots.txt and confirm content renders without JS.
4. **Fix extractability**: Restructure priority pages — question headings, 40–80 word answer blocks, dated stats, FAQ sections. Highest-leverage single change on most sites.
5. **Establish the entity**: Ship the canonical fact set, Organization schema with sameAs, and review-site profiles. Pursue Wikidata; Wikipedia only if genuinely notable.
6. **Earn third-party presence**: Pitch the 5–10 earnable roundups from step 2. Publish one original-data asset per quarter to become a stat source.
7. **Measure monthly**: Re-run the prompt panel and update brand-mention share per engine; review the AI-referral segment. Feed findings back into step 2 — newly cited third-party domains are new outreach targets.

## Common Mistakes

1. **Treating AEO as separate from SEO** — ChatGPT search leans on Bing, AI Overviews on Google. If you don't rank in the underlying index, extractability can't save you. Fix: keep doing SEO; AEO layers on top. Why: retrieval-augmented engines only read what search surfaces.
2. **Burying the answer** — 300 words of context before the actual answer. Engines quote the first clean passage that answers the question, which becomes a competitor's. Fix: answer in the first 40–80 words under the heading, elaborate after.
3. **Blocking all AI crawlers reflexively** — a blanket `User-agent: *` style block on AI bots removes you from citations and future model knowledge while competitors fill the gap. Fix: block only with a deliberate business reason, and never the search-mode bots.
4. **Only optimizing your own site** — for "best X" queries, engines prefer third-party roundups. Fix: spend at least half your effort earning placements in others' lists and review sites.
5. **Unverifiable superlatives** — "the leading platform" gets ignored; engines cross-check and won't repeat claims no one else makes. Fix: publish specific, dated, corroborated facts ("4,000 customers as of 2026").
6. **One-time prompt testing** — a single run tells you little; answers vary by session and change monthly. Fix: fixed prompt panel, 3 runs per prompt, monthly cadence, tracked in a sheet.
7. **Schema as a magic switch** — FAQ markup on a page with weak answers does nothing. Fix: content extractability first, markup second (implementation details in seo-technical).
8. **Ignoring AI referrals in analytics** — this traffic hides in "direct" or generic referral buckets, so nobody funds the channel. Fix: build a dedicated AI-referral segment and report it alongside organic.

## Output Format

Deliver as a single document:

1. **Baseline table** — target prompt × engine grid: brand mentioned (Y/N), URLs cited, competitors named.
2. **Source map** — cited domains per query, tagged ours / earnable / structural, with the top 5 earnable placements to pitch.
3. **Page audit** — checklist scores for each priority page with the specific fix per failing row.
4. **Crawler access verdict** — current robots.txt state per bot and the recommended policy with one-line rationale.
5. **Entity package** — the canonical 50-word description, fact set, and sameAs target list.
6. **90-day plan** — weeks 1–2 extractability fixes, weeks 3–6 entity + earned placements, ongoing monthly prompt-panel measurement, each item with an owner and effort estimate.

Keep every recommendation tied to a specific query from the baseline. If a tactic doesn't help a named prompt, cut it.
