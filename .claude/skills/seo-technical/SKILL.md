---
name: seo-technical
description: "When the user wants to diagnose and fix crawling, indexing, rendering, or site-health issues so search engines can discover and rank their pages. Use when the user says 'my pages aren't indexed', 'Google isn't picking up my site', 'crawl budget', 'robots.txt', 'canonical', 'sitemap', 'Core Web Vitals', 'schema markup', 'Discovered – currently not indexed', 'noindex', 'duplicate content', or 'structured data errors'. Covers the crawl → render → index → rank pipeline, Search Console coverage diagnosis, robots/noindex/canonical decisions, sitemap rules, canonicalization, CWV thresholds, JavaScript rendering, log-file analysis, and JSON-LD structured data. For titles, content quality, and on-page optimization, see seo-content. For template pages at scale, see programmatic-seo. For deeper CWV engineering work, see frontend-performance."
metadata:
  version: 1.0.0
---

# Technical SEO

Act as a technical SEO engineer who has debugged indexation for sites from 50 pages to 50 million. The outcome of this skill: a precise diagnosis of where pages are stuck in the crawl → render → index → rank pipeline, plus a prioritized fix list with the exact directives, headers, and file changes to ship — not generic advice.

## Before Starting

If `.agents/product-marketing.md` exists, read it before asking the user anything — it typically covers the product, audience, and site type. Only ask what it doesn't answer.

Then ask (grouped, 3–5 questions max):

1. **Symptom and evidence** — What made you suspect a problem? Do you have Search Console access, and what does the Pages (indexing) report show? What does `site:yourdomain.com` return vs. your actual page count?
2. **Stack and rendering** — What framework serves the site (Next.js, WordPress, SPA, static)? Is content server-rendered, statically generated, or client-rendered? Any auth walls, geo-blocks, or bot protection (Cloudflare, etc.)?
3. **Scale and structure** — Roughly how many URLs should be indexed? Are there faceted navigation, search pages, or URL parameters? Any recent migration, redesign, or domain change?

Skip questions the user already answered. If they have Search Console data, ask them to paste the coverage-state breakdown — it shortcuts most of the diagnosis.

## The Pipeline: Crawl → Render → Index → Rank

Every indexation problem is a failure at exactly one stage. Diagnose the stage first; the fix follows from it.

| Stage | What happens | How pages get stuck | How to tell |
|---|---|---|---|
| **Discovery** | Google finds the URL (links, sitemap) | Orphan pages, no internal links, missing from sitemap | URL not in Search Console at all; URL Inspection says "URL is not on Google" with no crawl history |
| **Crawl** | Googlebot fetches the URL | robots.txt block, 4xx/5xx, server timeouts, crawl budget exhausted | Coverage state "Blocked by robots.txt"; logs show no Googlebot hits; "Discovered – currently not indexed" |
| **Render** | Chromium renders JS, queued behind crawl | Critical content only in client-side JS, render errors, blocked JS/CSS resources | URL Inspection "View crawled page" shows empty/thin HTML; content visible in browser but not in rendered screenshot |
| **Index** | Google decides to store the page | Duplicate content, canonical elsewhere, noindex, quality threshold | "Crawled – currently not indexed", "Duplicate without user-selected canonical", "Alternate page with proper canonical tag" |
| **Rank** | Page competes for queries | Weak relevance/links — out of scope here | Indexed but no impressions → route to seo-content |

### Search Console coverage states — what each one actually means

| Coverage state | Stage stuck | Real meaning | First move |
|---|---|---|---|
| Discovered – currently not indexed | Crawl | Google knows the URL but hasn't bothered fetching it. Crawl budget or perceived low value. | Improve internal linking to it; cut crawl waste elsewhere; check server response times |
| Crawled – currently not indexed | Index | Fetched, then judged not worth indexing. Quality/duplication signal, not a technical bug. | Improve or consolidate the page; this is rarely fixed with directives |
| Blocked by robots.txt | Crawl | Disallow rule prevents fetching. Page can still appear in results with no snippet. | Decide: should it be crawled? Fix the rule or accept it |
| Indexed, though blocked by robots.txt | Crawl | Google indexed it from links alone, blind. Common when people use robots.txt to "hide" pages. | Unblock and add noindex if you want it gone; robots.txt is the wrong tool |
| Excluded by 'noindex' tag | Index | Working as configured — verify it's intentional | Grep for stray noindex in templates, headers, and plugins |
| Duplicate without user-selected canonical | Index | Google found duplicates and picked its own canonical | Add explicit canonicals; fix parameter/trailing-slash duplication |
| Alternate page with proper canonical tag | Index | This URL canonicals to another that is indexed — usually correct | Confirm the canonical target is right; no action if so |
| Page with redirect | Crawl | URL redirects; target may be indexed instead | Fine unless redirect chains >2 hops or loops exist |
| Soft 404 | Index | Page returns 200 but looks empty/error-like to Google | Return a real 404/410, or add real content |
| Server error (5xx) | Crawl | Repeated 5xx responses; Google slows crawling in response | Fix server stability first — 5xx spikes suppress crawl rate for weeks |

## robots.txt vs noindex vs canonical

These three are constantly confused because each controls a different stage. Using the wrong one causes the classic failure: robots.txt blocks crawling, not indexing — a blocked URL with inbound links gets indexed anyway, as a bare URL with no snippet. Worse, if you block a page AND noindex it, Google can never fetch the page to see the noindex.

| Goal | Correct tool | Why the others fail |
|---|---|---|
| Stop Google fetching a URL (save crawl budget, hide server load) | `robots.txt` Disallow | noindex requires a fetch to be seen; canonical requires a fetch too |
| Remove a page from search results | `<meta name="robots" content="noindex">` or `X-Robots-Tag: noindex` header | robots.txt leaves it indexable via links; canonical only consolidates, doesn't remove |
| Consolidate duplicate/parameter URLs to one indexed version | `<link rel="canonical">` | noindex throws away the duplicates' link equity; robots.txt hides the duplication signal from Google |
| Remove a page urgently (leaked, legal) | Search Console Removals tool + noindex or 404/410 | Directives take days–weeks; Removals hides within ~24h |
| Kill a page permanently | 410 (or 404) status | noindex keeps the page consuming crawl budget indefinitely |

Rules that follow from this:

- Never combine `Disallow` with `noindex` on the same URL — the Disallow makes the noindex invisible.
- Canonical is a hint, not a directive. Google ignores it when the pages differ substantially or other signals (internal links, sitemap, redirects) point elsewhere. Align all signals: sitemap lists only canonical URLs, internal links point at canonical URLs.
- `X-Robots-Tag` HTTP header is the only way to noindex non-HTML files (PDFs, images).

## Sitemaps

| Rule | Value | Why it matters |
|---|---|---|
| Max URLs per sitemap file | 50,000 | Hard limit; Google truncates or rejects beyond it |
| Max uncompressed file size | 50 MB | Same; gzip the file but the limit applies uncompressed |
| More URLs than one file holds | Use a sitemap index file pointing at child sitemaps | Also lets you segment (products.xml, posts.xml) to track indexation per section in Search Console |
| `lastmod` | Only set it when content meaningfully changed | Google explicitly ignores lastmod site-wide once it catches you setting it to "now" on every generation. Honest lastmod earns faster recrawls |
| `priority` / `changefreq` | Omit them | Google ignores both; they add bytes and false confidence |
| URL eligibility | Only 200-status, canonical, indexable URLs | A sitemap full of redirects/noindex/duplicates trains Google to distrust it — Search Console flags this as "Sitemap contains URLs that are blocked/duplicates" |
| Location | Reference from robots.txt (`Sitemap: https://example.com/sitemap.xml`) and submit in Search Console | robots.txt reference works for all engines; Search Console submission gives you the coverage report per sitemap |

A sitemap does not cause indexing — it accelerates discovery and gives you measurement. If sitemap URLs sit at "Discovered – currently not indexed", the problem is crawl budget or perceived quality, not the sitemap.

## Canonicalization Pitfalls

Every page should be reachable at exactly one URL; every variant should 301 or canonical to it. The usual duplicate generators:

| Variant source | Example duplicates | Fix |
|---|---|---|
| Protocol | `http://` and `https://` both return 200 | 301 all http → https at the edge; HSTS after |
| Host | `www` and apex both return 200 | Pick one, 301 the other, site-wide |
| Trailing slash | `/pricing` and `/pricing/` both 200 | Pick one convention, 301 the other (frameworks differ: Next.js default no-slash, WordPress slash) |
| Case | `/Pricing` returns 200 | 301 to lowercase, or 404 non-canonical case |
| Tracking parameters | `?utm_source=...`, `?fbclid=...`, `?gclid=...` | Self-referencing canonical on every page strips these; never internally link with tracking params |
| Functional parameters | `?sort=price`, `?page=2`, faceted filters `?color=red&size=m` | Canonical filtered/sorted views to the base category; keep paginated pages self-canonical (each page of a series canonicals to itself, not page 1) |
| Session IDs / uppercase params | `?SID=abc123` | Eliminate at the application layer; these explode crawl budget worst of all |
| Index files | `/`, `/index.html`, `/index.php` all 200 | 301 index files to the directory URL |

Verification: `curl -sI` each variant and confirm a single 301 hop to the canonical form — chains of 2+ redirects leak signal and slow crawling. Then confirm the canonical tag on the final URL is absolute, self-referencing, and appears exactly once (duplicate canonical tags with different values make Google ignore both).

## Core Web Vitals

Thresholds are measured at the 75th percentile of real-user (CrUX) data, per URL group. Lab tools (Lighthouse) diagnose; field data (Search Console CWV report, CrUX) is what Google actually uses.

| Metric | Good (p75) | Needs improvement | Poor | The single highest-leverage fix |
|---|---|---|---|---|
| LCP (Largest Contentful Paint) | < 2.5 s | 2.5–4.0 s | > 4.0 s | Make the LCP image/text server-delivered and preloaded: `<link rel="preload" as="image">` + `fetchpriority="high"`, no lazy-loading on the LCP element, image served in AVIF/WebP at rendered size |
| INP (Interaction to Next Paint) | < 200 ms | 200–500 ms | > 500 ms | Break up long main-thread tasks: defer non-critical JS, split hydration, `scheduler.yield()`/`setTimeout` chunking inside heavy handlers; third-party scripts to `async` or a worker (Partytown) |
| CLS (Cumulative Layout Shift) | < 0.1 | 0.1–0.25 | > 0.25 | Reserve space: explicit `width`/`height` (or `aspect-ratio`) on every image/embed/ad slot, `font-display: optional` or size-adjusted fallback fonts to stop font-swap shifts |

CWV is a ranking tiebreaker, not a primary factor — fix "Poor" URLs for the ranking and UX win, but don't chase 100/100 Lighthouse scores before indexation is fixed. For sustained engineering work on these metrics, see frontend-performance.

## JavaScript Rendering

Googlebot renders JavaScript with an evergreen Chromium, but rendering is a second, queued pass after the initial HTML fetch. The queue delay ranges from seconds to days depending on site priority — and Google indexes the unrendered HTML in the meantime.

Consequences and rules:

1. Any content that must be indexed belongs in the initial server HTML: title, meta robots, canonical, primary copy, internal links. SSR/SSG/ISR all satisfy this; pure client-side rendering gambles on the render queue.
2. Never inject or change `noindex`, canonical, or the title via client-side JS. If the raw HTML says `noindex`, Google may drop the page before the render pass ever runs — the JS "fix" is never seen.
3. Links must be real `<a href="...">` elements in rendered output. Googlebot does not click buttons, fire `onclick` handlers, or scroll to trigger infinite-scroll loading — content loaded only on interaction is invisible.
4. Don't block JS/CSS in robots.txt (`/assets/`, `/_next/`, `/wp-includes/`). Blocked resources mean broken rendering and a blank "View crawled page."
5. Test with URL Inspection → "View crawled page" → screenshot + HTML, or `curl` with a Googlebot user-agent, or Rich Results Test. If the rendered HTML lacks your content, fix rendering before touching anything else.

## Log-File Analysis

Server logs are the only ground truth for what Googlebot actually crawls. Search Console's Crawl Stats samples; logs don't. Filter to verified Googlebot (reverse-DNS to `googlebot.com`/`google.com`, or Google's published IP ranges — user-agent alone is spoofable), then look for:

| Signal | Threshold that indicates a problem | Meaning |
|---|---|---|
| % of Googlebot hits on parameterized/faceted URLs | > 20% of crawl on URLs you don't want indexed | Crawl budget waste — Disallow the parameter patterns in robots.txt |
| Hits on 404/410 URLs | > 5–10% sustained | Stale internal links or sitemap entries feeding dead URLs |
| Hits on redirects | > 10% | Internal links pointing at old URLs; update links to final destinations |
| Key pages with zero Googlebot hits in 30 days | Any money page | Discovery/priority problem — internal linking too weak |
| Crawl frequency skew | Homepage crawled hourly, product pages monthly | Architecture too deep; important pages need links from frequently-crawled pages |
| 5xx responses to Googlebot | > 1% | Google throttles crawl rate in response; fix before anything else |

Crawl budget only genuinely constrains sites above roughly 10,000 URLs (or any size with runaway parameter generation). Under that, "Discovered – currently not indexed" is a quality signal, not a budget one.

## Structured Data

Structured data earns rich results (stars, FAQs, breadcrumbs, product info) — it does not directly improve rankings. Use JSON-LD in a `<script type="application/ld+json">` tag in the head or body; it's Google's recommended format and the easiest to template.

Copy-paste recipes for Organization, Product, Article, FAQPage, BreadcrumbList, LocalBusiness, and HowTo are in [references/schema-recipes.md](references/schema-recipes.md) — each with required vs. recommended fields and validation notes. Two rules that outrank everything in the recipes: the markup must describe content visible on the page (invisible-content markup risks a manual action), and every deploy should pass the Rich Results Test before shipping.

## Audit Workflow

1. Establish the gap: compare intended URL count vs. Search Console "Indexed" count vs. `site:` estimate. Pull the full Pages (indexing) report breakdown by coverage state.
2. Bucket every excluded state using the pipeline table above — this tells you which stage(s) to attack. Fix stages left-to-right: crawl blocks before render issues before index-quality issues.
3. Inspect 3–5 representative stuck URLs with URL Inspection: last crawl date, discovered-via, user-declared vs. Google-selected canonical, rendered HTML.
4. Fetch and read robots.txt. Check for Disallow rules hitting wanted pages, blocked JS/CSS paths, and a Sitemap line. Test specific URLs against it (Search Console robots.txt report or a parser).
5. Verify canonicalization with curl: test http/https, www/apex, trailing slash, and uppercase variants of 3 URLs — each should 301 once to a single canonical form with a matching self-canonical tag.
6. Validate the sitemap: URL count vs. limits, only 200/canonical/indexable URLs, honest lastmod, referenced in robots.txt and submitted in Search Console.
7. Test rendering: compare raw HTML (`curl`) against rendered output (URL Inspection) for a key template. Confirm title, canonical, robots meta, primary content, and internal links exist in server HTML.
8. If the site exceeds ~10k URLs or has faceted navigation, run the log-file checks above and quantify crawl waste as a percentage.
9. Pull the Core Web Vitals report; for any "Poor" URL group, apply the top fix per failing metric.
10. Validate structured data on each template with the Rich Results Test; add missing schema from the recipes reference where the page type qualifies for a rich result.
11. Deliver findings in the Output Format below, ordered by expected indexation impact, and note the verification signal for each fix (which coverage state should shrink, and over what timescale — most take 2–8 weeks to show in Search Console).

## Common Mistakes

1. **Blocking a page in robots.txt to deindex it.** The block prevents Google from seeing anything — including a noindex — so the URL stays indexed as a bare link. Fix: remove the Disallow, serve noindex, wait for recrawl, then optionally re-block.
2. **Setting every sitemap lastmod to the build timestamp.** Google detects the dishonesty and ignores lastmod entirely, losing you the recrawl-priority benefit. Fix: emit lastmod from the content's real modified date, or omit it.
3. **Canonical tags that contradict other signals.** Page A canonicals to B, but the sitemap lists A and internal links point at A — Google overrides your canonical. Fix: make sitemap, internal links, redirects, and canonicals all agree on one URL.
4. **Treating "Crawled – currently not indexed" as a technical bug.** It's a quality verdict; no directive fixes it. Fix: consolidate thin pages, add unique value, or 410 them — and route content improvement to seo-content.
5. **Shipping critical content or meta tags via client-side JS only.** The render queue can delay or drop it; a JS-injected canonical or removed noindex may never be seen. Fix: server-render everything that affects indexing.
6. **Redirect chains after migrations.** old-http → old-https → new-domain → new-path leaks signal and slows crawling at every hop. Fix: collapse every chain to a single 301 to the final URL, and update internal links to point directly at it.
7. **Paginated series canonicaling to page 1.** This tells Google pages 2+ are duplicates, orphaning everything linked only from them. Fix: self-canonical each paginated page and keep crawlable links between pages.
8. **Chasing Lighthouse 100 while indexation is broken.** A perfect score on a page Google won't crawl is worth nothing. Fix: sequence work by the pipeline — crawl and index issues first, CWV tiebreakers second.

## Output Format

Deliver the audit as:

**Diagnosis summary** — 2–3 sentences: how many pages are stuck, at which pipeline stage(s), and the primary cause.

**Coverage table** — each Search Console state observed, URL count, pipeline stage, and verdict (fix / intentional / ignore).

**Prioritized fixes** — numbered list, highest indexation impact first. Each fix includes: the exact change (directive, header, redirect rule, or code snippet ready to paste), which coverage state or metric it moves, and expected time-to-effect (e.g., "2–4 weeks, watch 'Blocked by robots.txt' count fall").

**Verification plan** — which Search Console reports/log queries to re-check, at what interval, with the number that defines success (e.g., "indexed count reaches 4,200 of 4,500 sitemap URLs within 6 weeks").

Keep fixes copy-pasteable: real robots.txt lines, real redirect config for the user's stack, real JSON-LD from the recipes reference — not descriptions of fixes.
