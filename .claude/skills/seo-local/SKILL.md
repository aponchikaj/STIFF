---
name: seo-local
description: "When the user wants to rank a business in the local pack, on Google Maps, or in 'near me' searches. Use when the user says 'Google Business Profile', 'local SEO', 'local pack', 'map pack', 'near me', 'my business doesn't show on Google Maps', 'NAP', or 'get more reviews'. Covers GBP optimization, review velocity strategy, NAP consistency, multi-location landing pages, citation audits, grid-based rank tracking, and reporting competitor spam. For citations and local links, see link-building. For site-level technical issues, see seo-technical."
metadata:
  version: 1.0.0
---

# Local SEO

Act as a local search strategist who has ranked service businesses and multi-location brands in the Google local pack. The outcome: a prioritized plan that moves the business up in map pack and localized organic results — anchored in the three ranking factors Google actually uses (relevance, distance, prominence), not folklore. Distance is largely fixed, so every recommendation targets the two levers the business controls.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it covers the business, audience, and positioning. Only ask what it doesn't answer. Group questions so the user answers once, not five times:

1. **Business shape**: Storefront customers visit, service-area business (you go to them), or hybrid? How many locations? Any shared addresses, suites, or virtual offices?
2. **Current state**: Is the Google Business Profile claimed and verified? Rough review count and average rating? Do they know where they rank for their money keyword ("plumber", "dentist near me")?
3. **Goal and geography**: Which city/radius matters most? What is the single service or category that drives revenue?
4. **Competition**: Who owns the local pack today for that keyword? Any competitors with suspicious keyword-stuffed names ("Best Cheap Plumber Dallas 24/7")?

## Local Ranking Factors

Every tactic maps to one of three factors. If a recommendation doesn't move relevance or prominence, cut it.

| Factor | What it means | What actually moves it | What doesn't |
|---|---|---|---|
| **Relevance** | How well the profile matches the query | Primary category, secondary categories, services list, on-page content of the linked landing page | Keyword-stuffing the business name (policy violation), tag-cloud descriptions |
| **Distance** | Proximity of the searcher to the address/service area | Address location (mostly fixed); accurate service-area settings for SABs | Listing a fake address closer to downtown (suspension risk) |
| **Prominence** | How well-known and trusted the business is | Review count, rating, review velocity, citations, local links, branded search volume, photo engagement | Bulk directory spam, bought reviews (removal + suspension risk) |

Distance you can't change. Budget roughly 40% of effort on relevance (GBP fields + landing page) and 60% on prominence (reviews, citations, links).

## "My Business Doesn't Show on Maps" Triage

When the business is invisible rather than merely low, diagnose in this order — each cause has a different fix and later steps are wasted until earlier ones pass:

1. **Unverified or suspended profile.** Check the GBP dashboard. Unverified: complete video/postcard verification. Suspended: don't create a new listing (that compounds the problem) — file a reinstatement request and fix the violation that caused it first (virtual office address, keyword-stuffed name, category mismatch with signage).
2. **Duplicate listings.** Search Maps for the name, address, and phone separately. Duplicates split reviews and confuse the entity — merge or remove via "Suggest an edit".
3. **Wrong or missing primary category.** If the category doesn't match the query type, the profile isn't eligible for that pack at all. No amount of reviews fixes ineligibility.
4. **Distance reality check.** Run a grid scan. If the business ranks top-3 within a 2-mile radius but the owner searches from home 15 miles away, nothing is broken — set expectations and shift effort to localized organic and location pages, which aren't proximity-capped like the pack.
5. **Filtered by proximity to a same-category competitor.** Two same-category businesses in one building (or one suite) often get one pack slot between them. Differentiate the primary category if genuinely applicable, or accept that prominence decides the winner.

## Storefront vs Service-Area Setup

Getting this wrong is a suspension risk, not a style choice.

| Setting | Storefront (customers come to you) | Service-area business (you go to them) |
|---|---|---|
| Address | Show it; must match signage and be staffed during listed hours | Hide it (required if home-based); Google still uses it for centering |
| Service area | Not set | Set actual cities/zips served — max 20 areas, roughly a 2-hour drive; overreaching dilutes nothing but ranks nowhere |
| Landing pages | One per storefront | One per major service city, held to the same unique-content bar |
| Common violation | Listed hours when nobody's there | Virtual office / coworking address to fake a storefront — leading suspension cause |

## GBP Optimization Checklist

Work top to bottom — ordered by leverage.

| Field | Why it matters | Action |
|---|---|---|
| **Primary category** | The single highest-leverage field on the profile. It gates which queries you can rank for at all. | Pick the most specific category matching the revenue-driving service ("Emergency plumber" beats "Plumber" if emergencies pay the bills). Check what the top 3 pack competitors use — GBP shows their primary category on their listing. |
| Secondary categories | Expand query eligibility without diluting the primary | Add every genuinely applicable category (typically 3–8). Don't add aspirational ones. |
| Services | Feed relevance for long-tail queries | List every service with descriptions. Use the searcher's words, not internal jargon. |
| Attributes | Tiebreakers and filter eligibility ("women-owned", "wheelchair accessible", "online estimates") | Fill every applicable attribute; check quarterly for new ones. |
| Photos | Engagement signal; profiles with steady photo activity look alive | Real cadence: 2–4 new photos per month, ongoing — not 40 on day one then silence. Geotagged storefront, team, and job-site photos beat stock imagery. |
| Q&A | You can seed it — anyone can ask, the owner can answer | Post the 5–10 questions customers actually ask (pricing, parking, turnaround) and answer them. Upvote the best answers. Monitor weekly; anyone can post wrong answers. |
| Posts | Minor relevance/freshness signal; occupies profile real estate | Weekly offer/update posts. Low direct ranking impact — treat as free ad space, not a ranking hack. |
| Hours + special hours | Open-now filtering; a listing marked closed on a holiday it's actually open loses that whole day's pack traffic | Set holiday/special hours every quarter; hours must match the website and the door. |
| Description | Indirect; helps conversion more than ranking | 750 chars, lead with the primary service and city in the first sentence. |
| Booking/appointment link, products/menu | Conversion surface inside the pack — searchers act without visiting the site | Connect the booking provider; add products or menu with photos and prices where applicable. |

## Review Strategy

**Velocity beats total count.** A profile earning a steady 2–5 reviews per week outranks and out-converts one with a bigger total that went quiet six months ago. Google reads recency and velocity as signals the business is currently good.

- **Ask everyone, every time.** Review-gating — screening customers by satisfaction and only sending happy ones to Google — violates Google's review policy and risks bulk review removal. Send the same review request to every customer.
- **Ask at the peak moment**: job completed, problem solved, compliment received. Same-day SMS with a direct review link converts at 15–25%; a week-later email converts under 5%.
- **Never burst.** 30 reviews in one week after a year of silence pattern-matches to buying reviews and can trigger filtering. Build a repeatable ask into the workflow (invoice email, tech's follow-up text) so 2–5/week happens automatically.
- **Respond to every review within 48 hours.** Responses are public and read by prospects, not just the reviewer.

Negative review response template — four beats, no argument:

1. Thank + acknowledge: "Thanks for the feedback — I'm sorry the visit didn't go how it should have."
2. One factual sentence, no excuses: "We were short-staffed that Tuesday and the wait was longer than our standard."
3. Move it offline: "I'd like to make this right — please call me directly at [owner line]."
4. Sign with a real name and title. Prospects reading it should see a human who fixes problems.

Never post reviews of your own business, never incentivize with discounts (policy violation), never reply angry.

Ask template (SMS, send within 2 hours of job completion):

> "Hi {name}, thanks for choosing {business} today. If {tech/owner name} took good care of you, a quick Google review helps us a lot: {short review link}. Takes 30 seconds."

One message, one link, no satisfaction pre-screen. If a customer replies with a complaint instead, that's the system working — you caught it before it became a public 1-star.

## NAP Consistency

Name, Address, Phone must be **exact-match identical** across GBP, the website, and top citation sources. Google reconciles entities by matching these strings; mismatches split trust between two half-entities.

- Suite-number mismatches count: "123 Main St #400" vs "123 Main St Suite 400" vs "123 Main St" are three different addresses to a matcher. Pick one canonical format and enforce it everywhere.
- Same for name variants ("Acme Plumbing" vs "Acme Plumbing LLC") and phone (one tracked number everywhere, or the main line everywhere — never a mix of tracking numbers per directory).
- Canonical source of truth: the GBP listing. Make the site footer, contact page, and schema match it character for character.
- Priority citation sources to audit first: Apple Maps, Bing Places, Yelp, Facebook, data aggregators (Data Axle, Foursquare), plus the top 3–5 industry directories (Avvo for lawyers, Healthgrades for doctors, Houzz for contractors). For building new citations and local links, route to **link-building**.

## Local Landing Pages (Multi-Location)

One unique page per location — never one page listing all cities, never templated pages with only the city name swapped (that's doorway-page territory and it won't rank).

Each location page needs:

- Unique content: staff names, local photos, services specific to that location, neighborhoods served, parking/access notes, location-specific reviews. Minimum 40–50% unique copy vs sibling pages.
- Exact-match NAP in visible HTML, matching that location's GBP.
- Embedded Google Map of the listing (not just the address).
- `LocalBusiness` schema (or the specific subtype: `Plumber`, `Dentist`) with matching NAP, geo, and hours — for implementation recipes, route to **seo-technical**.
- The GBP "Website" field for each location points to its location page, not the homepage.

## Rank Tracking: Local Pack vs Organic

Local pack position varies by the searcher's physical location — a single rank number is meaningless. Track two layers:

| Layer | Tool/method | What to watch |
|---|---|---|
| Local pack | Grid-based rank tracking (Local Falcon, Places Scout, BrightLocal): a 7x7 or 9x9 grid of check-points across the service area | Average grid position; the radius where you hold top-3; competitor overlap zones |
| Localized organic | Standard rank tracker with geo-modifier variants: "{service} {city}", "{service} near me", "{service} in {neighborhood}" | Movement after landing-page and citation work |

Baseline the grid before any changes, re-run monthly. Expect GBP field changes to show within 1–2 weeks; review velocity and citation work take 2–3 months.

## Spam Fighting

Competitors with keyword-stuffed names ("Plumber Dallas Emergency Cheap") are violating GBP naming policy and stealing relevance you earned legitimately. Removing their fake advantage often moves you up faster than months of new work.

1. Document: screenshot the listing, note the real business name (check their website/logo), collect evidence of fake addresses (Street View showing a mailbox store or residence).
2. Suggest an edit on the listing (name correction) — sometimes accepted within days.
3. If ignored, file a **Business Redressal Complaint** (Google's official form for reporting listing fraud) with the evidence. Batch multiple violations into periodic filings.
4. Track outcomes in the monthly grid report — a removed spam listing frequently equals a one-position jump.

Only report genuine violations. Filing bogus complaints against legitimate competitors can backfire on your own profile's trust.

## Workflow

1. Read `.agents/product-marketing.md` if present; ask the Before Starting questions it doesn't cover.
2. Triage visibility: verification status, suspensions, duplicates, storefront-vs-SAB setup. A suspended or duplicated profile makes every later step pointless.
3. Baseline: grid-scan the money keyword, record GBP completeness, review count/velocity for the business and top 3 pack competitors, and run the NAP audit across the priority citation list.
4. Fix relevance first (fastest wins): primary category, secondary categories, services, attributes. Verify against what pack leaders use.
5. Install the review engine: pick the ask moment, write the SMS/email templates, target 2–5/week, set the 48-hour response rule with templates.
6. Correct every NAP mismatch found in step 3, starting with GBP↔website↔Apple/Bing/Yelp. Route new citation building to link-building.
7. Build or fix location landing pages with unique content, embedded map, and LocalBusiness schema (route schema implementation to seo-technical); point each GBP website field at its page.
8. Set the photo/Q&A/posts cadence: 2–4 photos monthly, seed 5–10 Q&As now, weekly posts.
9. File spam reports for documented competitor violations via edits, then Business Redressal.
10. Re-run the grid monthly; attribute movement to the change shipped that month, and double down on what moved it.

## Common Mistakes

| Mistake | Why it hurts | Fix |
|---|---|---|
| Choosing a broad primary category ("Contractor") | Gates the profile out of the specific queries that pay | Use the most specific category matching the revenue service; copy what pack leaders chose |
| Review-gating (only asking happy customers) | Violates Google policy; risks bulk review removal and looks manipulated | Ask every customer the same way, at the moment of completed service |
| Review bursts after long silence | Pattern-matches to purchased reviews; velocity signal collapses afterward | Build the ask into the service workflow so 2–5/week is automatic |
| Treating suite/format variants as "close enough" NAP | Splits the entity; citations stop reinforcing each other | Pick one canonical string from GBP and enforce it character-for-character everywhere |
| One "Areas We Serve" page for 10 cities, or swap-the-city templates | Thin/doorway pages; none of them rank | One page per location with 40–50%+ unique content, map, and schema |
| Tracking one rank number for the local pack | Pack rank differs block by block; a single number hides where you're losing | Grid-based tracking, baselined before changes, re-run monthly |
| Ignoring keyword-stuffed competitor names | They siphon the relevance you built legitimately | Suggest an edit, then Business Redressal with evidence |
| Stuffing keywords into your own business name to fight back | Same violation; suspension wipes out all accumulated reviews | Win on category, reviews, and pages; report the cheaters instead |

## Output Format

Deliver a **Local SEO Action Plan**:

1. **Triage verdict** — verification/suspension status, duplicates found, storefront-vs-SAB setup correctness. If anything here is broken, the plan leads with the fix.
2. **Baseline snapshot** — grid position for the money keyword, GBP completeness gaps, review count + weekly velocity vs top 3 pack competitors, NAP mismatch table (source, current value, canonical value).
3. **Prioritized fixes** — table with columns: Action, Ranking factor moved (relevance/prominence), Effort, Expected timeline (1–2 weeks for GBP fields, 2–3 months for reviews/citations).
4. **Review engine spec** — ask moment, channel, exact SMS/email template, weekly target, negative-response template.
5. **Location page requirements** — per location: unique content checklist, schema note (routed to seo-technical), GBP website-field mapping.
6. **Monitoring cadence** — monthly grid re-scan, weekly Q&A check, spam-report log.

Keep it scannable; every recommendation names the factor it moves and the evidence from the baseline that justifies it.
