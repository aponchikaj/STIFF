---
name: link-building
description: "When the user wants to earn backlinks, improve domain authority, or run link acquisition campaigns for organic search. Use when the user says backlinks, link building, digital PR, guest post, how do I get links, domain authority, anchor text, or toxic links. Covers white-hat tactic selection, linkable-asset design, prospecting, outreach angles, anchor-text distribution, and toxic-link screening. For outreach email mechanics and deliverability, see cold-email. For linkable content itself, see seo-content. For local citations, see seo-local."
metadata:
  version: 1.0.0
---

# Link Building

Act as a senior link acquisition strategist who has run digital PR and outreach programs for SaaS, e-commerce, and content sites. Your job is to help the user earn links that actually move rankings: pick the right tactic for their resources, design assets people cite voluntarily, build a prospect list ranked by topical relevance, and write outreach angles that convert at 5-15% instead of the 1-5% cold baseline. Everything here is white-hat — earned links from real editorial decisions. Paid link schemes and PBNs are excluded not on principle alone but because they concentrate risk: Google's link-spam systems now mostly neutralize bought links (money wasted), and when they do act, the result is a manual action that can suppress the whole domain for months and require public-facing cleanup. One leaked seller list or one disgruntled vendor exposes the entire network at once. Earned links compound; bought links are a liability sitting on the balance sheet waiting to be marked down.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it should cover product, audience, and positioning. Only ask what it does not answer. Group questions so the user answers once:

1. **Site and goal**: What domain, what pages need links (homepage authority vs. specific money pages), and what keywords are those pages targeting?
2. **Current state**: Roughly how many referring domains today, any prior link building (agencies, bought links, guest posting), and any manual actions showing in Google Search Console?
3. **Assets and resources**: What do you already have that is citable — proprietary data, a free tool, original research, notable customers or founders? How many hours per week and what budget can go to this?
4. **Constraints**: Any industries or sites you will not appear on, and does anyone on the team have subject-matter credibility for expert-quote or guest-post bylines?

## Tactic Selection

Match tactic to resources and stage. Do not run all seven; pick two — one asset-driven, one relationship-driven — and run them for a full quarter before switching.

| Tactic | Effort | Hit rate (of outreach) | Link quality | Best when |
|---|---|---|---|---|
| Digital PR (newsworthy story/data to journalists) | High | 1-5% cold, 5-15% with a genuinely new angle | Very high (news/media DR) | You have surprising data or a story with tension |
| Original data studies | High upfront, then compounding | Passive links accrue; outreach converts 5-15% | High, deep-page links | You have proprietary usage data or can run a survey (n≥500) |
| Guest posts | Medium per link | 5-15% on personalized pitches to sites that publish guests | Medium (varies with host site) | You have a credible byline and need early links |
| Unlinked brand mentions | Low | 20-40% — they already wrote about you | Medium-high | Brand gets mentioned but not linked (check monthly) |
| Broken link building | Medium | 1-5% typical | Medium | A dead resource in your niche has many inbound links |
| Resource page outreach | Low-medium | 2-8% | Medium | You have a definitive guide or free tool that fits curated lists |
| HARO-style expert quotes (Connectively, Qwoted, Featured) | Low per pitch, daily habit | 3-10% of pitches placed | High DR but often homepage-only anchor | A founder/expert can answer queries within 2 hours |

Baseline expectations: generic templated outreach converts at 1-5%; personalized campaigns with a real reason to link convert at 5-15%. If a vendor promises more than that at scale, the links are being bought or placed on sites nobody edits.

Stage guidance:

- **0-20 referring domains**: unlinked mentions, HARO-style quotes, and 2-3 guest posts. Cheap, fast, builds the base profile.
- **20-100 referring domains**: ship the first data study or free tool; add resource-page outreach for it.
- **100+ referring domains**: digital PR campaigns and annual refreshes of the data asset; outreach becomes relationship maintenance with journalists who already cited you.

## Linkable Asset Patterns

Links go to assets that make the linker's own content better. Ranked by link-earning power:

| Asset type | Why it earns links | Example shape |
|---|---|---|
| 1. Original data | Writers need statistics to cite and cannot get them elsewhere | "We analyzed 4,200 [X] and found..." annual report |
| 2. Free tools / calculators | Utility gets recommended; tools earn links for years | ROI calculator, grader, generator relevant to the niche |
| 3. Definitive guides | Cited as the canonical explainer of a concept | 3,000+ word guide that resource pages want to list |

Blog posts, opinion pieces, and product pages rarely earn links on their own — build one of the three above per quarter rather than hoping. For asset production itself (research, writing, structure), hand off to seo-content.

Data sources when you think you have no data:

- **Your own product**: anonymized, aggregated usage stats ("median time to first invoice across 3,800 accounts"). Cheapest and most defensible.
- **Surveys**: 500+ respondents via a panel provider; costs roughly $1,000-3,000 and yields a citable dataset competitors cannot copy.
- **Public data, original analysis**: scrape or download public records, job postings, pricing pages, or government datasets and compute something nobody has computed. The originality is in the analysis, not the source.

An asset is linkable when it passes this spec:

- **One headline number**: a single surprising statistic a journalist can put in a title ("62% of X fail within Y"). If the study has ten equal findings, it has zero headlines.
- **Embeddable chart or table**: something bloggers can screenshot or embed with attribution — the attribution is the link.
- **Methodology section**: sample size, date range, how data was collected. Journalists will not cite numbers they cannot defend to an editor.
- **Timeliness hook**: tie to a season, news cycle, or annual cadence ("2026 State of X") so it can be re-pitched every year with fresh data.

## Tactic Playbooks

Execution notes for the tactics most users pick. Each assumes the asset and prospect list from the workflow below.

**Digital PR.** Journalists cover stories, not products. The three campaign shapes that reliably place:

| Campaign shape | Example | Pitch window |
|---|---|---|
| Ranked list / index from data | "The 20 cities with the fastest-growing X" | Evergreen; regional press each take their city |
| Counterintuitive finding | "Remote workers ship 14% more code, not less" | 2-3 weeks of pitching after publication |
| Reactive comment / newsjack | Expert quote within hours of industry news | Same day only — speed beats polish |

Pitch the finding, not the report: subject line is the headline number. Offer the journalist an exclusive first look to the top-tier target before going wide.

**Unlinked brand mentions.** Monthly sweep: search Google and a mention tracker (Brand24, Ahrefs Alerts) for your brand name minus your own domain. For each unlinked mention, thank the author, offer one clarifying detail or updated fact, and ask for the link so their readers can find the source. This converts at 20-40% because the editorial decision to cite you was already made — you are only asking them to finish it.

**Broken link building.** Find dead pages with many inbound links (Ahrefs "Best by links" filtered to 404 on competitor or resource domains). Rebuild the content better on your site, then contact everyone linking to the dead page: "the resource you link to in [section] has been down since [date]; we maintain a current version." You are doing them a favor first — the link is the natural resolution.

**Guest posts.** Only pitch sites you would want traffic from, not just links. Pitch 3 specific title ideas tied to gaps in their existing archive (prove you searched it). Accept editorial anchor decisions; take one contextual link to a relevant deep page plus the author-bio link, and never negotiate anchors — that conversation converts an earned placement into a bought one.

**HARO-style expert quotes.** Answer only queries squarely in your expertise, within 2 hours, in 3-5 quotable sentences the journalist can paste verbatim, with a one-line credential. Skip anything requiring a stretch — off-topic placements produce the off-topic high-DR links that dilute relevance.

## Workflow

1. **Audit the current link profile.** Pull referring domains from Ahrefs, Semrush, or Search Console. Record:
   - Total referring domains and the trend over 12 months.
   - Referring-domain counts for the top 3 pages ranking on your target keywords — the gap to the page-one median is the scale you need.
   - Red flags from past work: exact-match anchor clusters, links from unrelated foreign-language sites, sudden historical spikes. These inform step 7.

2. **Pick two tactics from the table** based on the Before Starting answers and stage guidance. Set a 90-day target in referring domains earned (e.g., 15-25 quality links), never in "outreach emails sent" — activity metrics without placement targets reward spam.

3. **Build or designate the asset.** If no citable asset exists, that comes first — outreach without a reason to link is what produces 1% hit rates. Route asset creation to seo-content; your job here is the spec above: name the headline number, the embeddable element, and the methodology the asset must contain.

4. **Prospect with relevance before authority.** Build the list in this order:
   - Sites that cover your exact topic (search the keyword plus "statistics", "tools", "resources", "guide").
   - Sites linking to competing pages on the same keyword — the competitor backlink gap is the highest-intent list because these sites demonstrably link to content like yours.
   - Sites that linked to similar or older assets (for data studies and broken-link plays).

   Only then sort by authority. A DR30 blog exactly on your topic passes more ranking-relevant signal and referral traffic than a DR70 site linking off-topic — Google weighs the topical context of the linking page, and off-topic high-DR links are also the signature pattern of link sellers. Score each prospect before it enters the outreach queue:

   | Check | Pass looks like | Fail action |
   |---|---|---|
   | Topical relevance | Site or at least the target page covers your exact subject | Drop — never outreach off-topic regardless of DR |
   | Real audience | Organic traffic in Ahrefs, named authors, an about page | Drop — no audience means no referral value and no trust |
   | Editorial standards | Original content; guest posts are a minority of recent posts | Drop if the archive is wall-to-wall guest posts with commercial anchors |
   | Not a seller | No "write for us + fee" page, no sponsored-post rate card | Drop — a posted fee marks the whole domain as a seller |
   | Reachable human | Named editor or author with findable contact | Deprioritize — generic inboxes convert at a fraction of named contacts |

5. **Construct the outreach angle before writing the email.** The angle is the answer to "why does linking help *them*?" Common angles, strongest first:
   - Their stat is outdated and your study has the current number.
   - Their article cites a dead or broken source you can replace.
   - Their listicle or resource page is missing the category you fill.
   - Their audience keeps asking a question your tool or guide answers.

   Then compress to a 3-sentence pitch: (1) specific proof you read their page — quote the exact line or section; (2) the asset and the one number or feature that makes it worth citing; (3) a low-friction ask ("worth a mention in the tools section?"). Example shape: "Your guide to invoice automation cites a 2021 figure for average payment delay — we just published 2026 data from 4,100 invoices showing it's now 11 days, not 23. Chart here if useful: [link]. Worth updating the stat? Happy to send the raw table." Sending mechanics, subject lines, follow-up cadence, and deliverability belong to cold-email — pass the angle and pitch there.

6. **Manage anchor text passively.** You rarely control anchors on earned links, which is exactly why earned profiles look natural. When you do influence them (guest posts, resource listings), keep the distribution roughly:

   | Anchor type | Share of profile | Example |
   |---|---|---|
   | Branded / naked URL | 50-70% | "Acme", "acme.com" |
   | Natural phrase / title | 20-35% | "this study of 4,200 sites" |
   | Partial match | 5-15% | "guide to invoice automation" |
   | Exact match | under 5% | "invoice software" |

   A profile heavy in exact-match commercial anchors is the classic Penguin-era over-optimization signal and still triggers link-spam demotion today. If a guest-post host asks "what anchor do you want?", that is the tell you are buying placement, not earning citation.

7. **Screen for toxic links — but only act when it matters.** Disavow exists for two cases:
   - A manual action for unnatural links in Search Console (disavow, remove what you can, file reconsideration).
   - An obvious negative-SEO flood — thousands of spam links appearing within weeks, visible as a spike in referring domains from gibberish sites.

   Outside those, Google states it ignores links it distrusts, and preemptive disavowing more often removes links that were quietly helping. Do not pay for "toxic link cleanup" on the strength of a tool's toxicity score alone — those scores flag low-DR and foreign sites that are frequently harmless.

8. **Report on the right cadence.** Links take 4-12 weeks after acquisition to influence rankings — Google must recrawl the linking page, then re-evaluate yours. Set expectations up front so the campaign is not killed at week 3:

   | Timeframe | What should be moving | What should not be judged yet |
   |---|---|---|
   | Weeks 1-2 | Prospects contacted, reply rate (target 10-20% on personalized pitches) | Placements, rankings |
   | Weeks 3-6 | First links placed, referring-domain count ticking up | Rankings — recrawl lag still applies |
   | Weeks 6-12 | Ranking movement on target pages begins | ROI conclusions on the newest links |
   | Day 90 | Cost per link, quality mix, ranking delta — scale, adjust, or swap a tactic | — |

   Also normalize the velocity itself: 5-15 earned links per month is a healthy solo-team pace; a sudden month of 200 new referring domains from a vendor is a spam pattern, not a win.

## Common Mistakes

1. **Outreach with nothing to link to.** Fix: build one data study, tool, or definitive guide first; it is the difference between 1% and 10% hit rates.
2. **Sorting prospects by DR and ignoring topic.** Fix: filter for topical relevance first, authority second — a DR30 exact-topic link beats a DR70 off-topic one.
3. **Pitches that lead with your ask.** Fix: first sentence proves you read their page; second gives them the benefit; the ask comes last and small.
4. **Buying "guest posts" from sites with public rate cards.** Fix: treat any posted fee as a link-seller signal — the link gets discounted by Google and the neighborhood is penalty-adjacent. Spend the fee on a survey instead.
5. **Requesting exact-match anchors everywhere you can.** Fix: cap exact match under 5% of the profile; default to branded and natural phrases.
6. **Disavowing on a tool's toxicity score.** Fix: disavow only for manual actions or spam floods; otherwise leave the profile alone.
7. **Judging campaigns at two weeks.** Fix: commit to 90 days; rankings lag links by 4-12 weeks, so early success metrics are replies and placements, not positions.
8. **Chasing one link at a time instead of repeatable systems.** Fix: prefer tactics that compound — an annual data study earns links every year; a monthly unlinked-mention sweep converts at 20-40% for an hour of work.

## Output Format

Deliver a link building plan as a single document:

1. **Snapshot** — current referring domains, competitor gap for the top 3 target keywords, any manual-action or spam flags from the audit.
2. **Tactic selection** — the two chosen tactics with the reasoning row from the table, the stage rationale, and the 90-day referring-domain target.
3. **Asset spec** — what to build or repurpose, with the headline number, embeddable element, and methodology named; handoff notes for seo-content.
4. **Prospect list criteria** — inclusion and disqualification rules, plus the first 20 prospects (site, page, relevance note, DR, chosen angle).
5. **Outreach angles** — the 3-sentence pitch per prospect segment; handoff to cold-email for sending mechanics and follow-up cadence.
6. **Anchor and risk guardrails** — target anchor distribution table and the disavow policy (when to act, when to ignore).
7. **Measurement plan** — weekly activity metrics, monthly ranking checks, and the day-90 review date with the 4-12 week ranking lag stated explicitly.
