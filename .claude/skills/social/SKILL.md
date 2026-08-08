---
name: social
description: "When the user wants to plan, write, or systematize social media content that grows an audience. Use when the user says \"what should I post\", \"LinkedIn\", \"Twitter\", \"X post\", \"Instagram\", \"TikTok\", \"content calendar\", or \"grow my audience\". Covers per-platform format and algorithm rules, hook patterns, repurposing one pillar piece into platform-native cuts, content calendar structure, and separating engagement metrics that matter from vanity metrics. For the underlying message and positioning, see product-marketing. For writing mechanics, see copywriting. For turning followers into referrers, see referrals."
metadata:
  version: 1.0.0
---

# Social Content Strategy

Act as a social content strategist who has grown accounts from zero to six figures of followers on LinkedIn, X, Instagram, and TikTok. The outcome: a repeatable content system — platform-native posts, a hook-driven writing process, a repurposing pipeline, and a calendar — that compounds reach and converts strangers into an owned audience, not a pile of one-off posts that die in 24 hours.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it defines the audience, positioning, and core message. Only ask what it doesn't cover. Then ask 3–5 grouped questions:

1. **Audience and platform**: Who exactly are you trying to reach, and where do they already spend time? Which 1–2 platforms will you commit to first? (Committing to one platform beats dabbling on four — the algorithm rewards consistency and you can only learn one feedback loop at a time.)
2. **Goal and conversion path**: Followers alone are worthless — what should a follower eventually do? (Join a waitlist, book a demo, buy, subscribe to email.) What's the current audience size and posting history?
3. **Raw material and capacity**: What do you already produce that can be repurposed — blog posts, podcast, changelog, customer calls, founder opinions? How many hours per week can you realistically spend? (Under 3 hours/week means one platform, text-first.)
4. **Voice constraints**: Personal account or brand account? Any topics that are off-limits (competitors, pricing, roadmap)? Personal accounts get 2–5x the organic reach of brand accounts on every platform — default to the founder's face unless there's a hard reason not to.

## Choosing Platforms

Pick where the buyer already is, weighted by the user's capacity and content comfort. Committing to 1–2 platforms for 90 days beats a thin presence on four.

| If the business is... | Primary | Secondary | Why |
|---|---|---|---|
| B2B SaaS, services, consulting | LinkedIn | X | Buyers have job titles; LinkedIn's organic reach per follower is the highest of any major platform |
| Devtools, fintech, startups | X | LinkedIn | The discourse lives on X; fastest feedback loop for testing ideas |
| Consumer product, e-commerce | Instagram | TikTok | Visual discovery and shopping behavior; Reels reach non-followers |
| Consumer, buyer under ~35 | TikTok | Instagram | Pure-merit distribution — follower count barely matters, so new accounts can win immediately |
| Local or appointment business | Instagram | TikTok | Geo-tagged Reels and Stories drive local discovery |

Capacity gates the choice too: under 3 hours/week means one text-first platform (LinkedIn or X — no editing pipeline). Video platforms need 5+ hours/week or they stall. A camera-shy founder on TikTok will quit; put them on LinkedIn text posts instead and revisit video later.

## Platform Format Rules

Every platform rewards content that keeps users *on that platform*. Native formats win; links and cross-posts get suppressed. Full per-platform detail lives in `references/platform-playbooks.md` — read it before writing posts for a specific platform.

| Platform | Post types that work | Length sweet spot | Cadence | Key algorithm signals |
|---|---|---|---|---|
| LinkedIn | Text + line breaks, carousels (PDF), personal story → business lesson | 150–300 words; carousels 8–12 slides | 3–5x/week, 1x/day max | Dwell time, comments in first 60–90 min, "see more" clicks; external links cut reach ~30–50% (put link in comments) |
| X (Twitter) | Single insight tweets, threads, quote-tweets with a take, visuals | Tweets 70–120 chars for RTs; threads 5–12 tweets | 2–5x/day (mix originals + replies) | Replies > likes, profile clicks, early velocity in first 30 min; replies to big accounts = borrowed distribution |
| Instagram | Reels (reach), carousels (saves), Stories (retention) | Reels 7–30 sec; carousels 6–10 slides; captions ≤ 125 chars before fold | 3–5 Reels/week + daily Stories | Watch time / rewatches, saves and shares > likes, first 3 seconds decide distribution |
| TikTok | Native talking-head, screen-share tutorials, POV/story formats | 21–34 sec sweet spot; 60s+ only if retention holds | 1–3x/day (volume game) | Completion rate above all, rewatch, share; every video tested on ~200–500 viewers regardless of follower count |

Two rules that hold everywhere:

- **The first line is 80% of the work.** Users decide in under 2 seconds whether to stop scrolling. Write the hook first, and write 5 variants before picking one.
- **Early engagement windows are real.** Every algorithm shows a post to a small test cohort first (30–90 minutes). Post when your audience is online and reply to every comment in the first hour — each reply is a fresh engagement signal that extends the test.

## Hook Library

Match the hook to the content; don't force one pattern. The hook is the first line (text) or first 1–3 seconds (video).

| # | Pattern | Template | Example |
|---|---|---|---|
| 1 | Contrarian take | "Everyone says X. It's wrong." | "Posting daily is killing your account." |
| 2 | Numbered promise | "N ways/lessons/mistakes about X" | "7 pricing mistakes I made before $1M ARR" |
| 3 | Before/after | "X months ago: [low]. Today: [high]." | "Jan: 0 users. Aug: 4,200. What changed:" |
| 4 | Mistake confession | "I wasted [cost] doing X. Here's what I'd do instead." | "I spent $30k on ads before learning this." |
| 5 | Specific result | "[Exact number] in [timeframe]. The playbook:" | "212 demos booked from one post. Breakdown:" |
| 6 | Curiosity gap | "The [surprising thing] nobody talks about" | "The real reason your posts die at 12 likes" |
| 7 | Direct callout | "If you're a [role] doing X, read this." | "If you're a founder posting into the void:" |
| 8 | Hot list | "Steal these N [assets]" | "Steal these 5 cold-open lines" |
| 9 | Myth kill | "X doesn't work anymore. Here's what does." | "Hashtags are dead. Do this instead." |
| 10 | Story cold-open | Drop into the middle of the action | "The investor hung up on me mid-sentence." |
| 11 | Question hook | A question the audience argues about | "Would you take $500k salary or keep your startup?" |
| 12 | Stakes/warning | "Stop doing X before it costs you Y" | "Stop shipping features. It's why growth stalled." |

Test rule: keep the body identical, vary only the hook, and compare 24-hour reach. Hooks routinely swing performance 3–10x on the same content.

### Adapting hooks per medium

The pattern stays; the delivery changes:

- **Text (LinkedIn, X)**: the hook is line one, standing alone before the fold. Cut every word that isn't earning attention — "I've been thinking about pricing lately and" becomes "Your pricing is too low."
- **Carousel (LinkedIn, Instagram)**: the hook is slide 1 in 30pt+ type, 10 words max. Slide 2 must escalate, not explain — it's the second hook.
- **Video (TikTok, Reels)**: the hook is spoken *and* on-screen text in seconds 0–2, opening mid-action. "The investor hung up on me" — then cut to context. Never open with your name, a greeting, or a logo.
- **Thread (X)**: tweet 1 carries hook + promise + a curiosity anchor ("No. 4 cost me a year"). Numbered promises and hot lists convert best here because the format telegraphs skimmability.

## Repurposing Pipeline

Cross-posting the same file to four platforms fails — each algorithm detects non-native content (watermarks, wrong aspect ratio, wrong pacing) and each audience expects a different rhythm. Instead: one pillar piece per week, cut platform-native.

1. **Pillar (1/week)**: One substantial asset — blog post, podcast episode, YouTube video, detailed teardown, or a 30-minute recorded rant. This is the idea reservoir.
2. **Extract 5–10 atomic ideas**: Each standalone claim, story, stat, or step becomes its own post. One pillar ≠ one post per platform; it's 5–10 posts per platform over 2–3 weeks.
3. **Cut native per platform**: LinkedIn gets a story-driven text post or carousel. X gets a thread (the full argument) plus 3–4 single tweets (the sharpest lines). Instagram gets a carousel of the steps and a Reel of the strongest 20 seconds. TikTok gets a re-shot talking-head — never the horizontal clip with a logo watermark.
4. **Re-run winners**: Any post in your top 10% gets rewritten (new hook, same idea) and reposted in 6–8 weeks. Under 10% of your audience saw it the first time.

## Content Calendar

Structure the week around content pillars — recurring themes tied to what you sell — so you never face a blank page. Allocation that works for most companies:

| Pillar | Share | Purpose | Example formats |
|---|---|---|---|
| Educational (how-to, frameworks) | 40% | Earns saves, shares, authority | Carousels, threads, tutorials |
| Opinion / point of view | 25% | Earns comments, differentiates you | Contrarian takes, myth kills |
| Story / behind-the-scenes | 20% | Earns trust and connection | Build-in-public, lessons, failures |
| Product / promotional | 15% | Converts the audience you earned | Launches, case studies, demos |

Rules: promotional stays ≤ 20% or reach decays and followers tune out. Plan one week ahead maximum — a 30-day pre-planned calendar can't react to what the data says. Batch creation into one 2–3 hour session per week; daily creation from scratch is the most common reason people quit at week 6.

### Example week (B2B founder, LinkedIn primary + X secondary)

| Day | Platform | Pillar | Format | Time |
|---|---|---|---|---|
| Mon | LinkedIn | Educational | Carousel: framework from this week's pillar piece | 8:00am |
| Mon | X | Opinion | Single tweet: sharpest claim from the carousel | 9:00am |
| Tue | X | Educational | Thread: full argument of the pillar piece | 8:30am |
| Wed | LinkedIn | Story | Text post: the failure that led to the framework | 7:45am |
| Thu | X | Opinion | Contrarian single tweet + 15 replies to large accounts | 8:30am |
| Fri | LinkedIn | Product | Case study: customer result, numbers first | 8:00am |

Adjust days and slots to the audience's timezone; keep the pillar mix, not the exact grid. X replies (10–20/day) run in the background all week — they're distribution work, not calendar slots.

## Converting Reach into an Owned Audience

Followers are rented; the platform owns the relationship and can change the rules overnight. Every content system needs an off-ramp to a channel you own (email list, community, product signup). Build a ladder rather than shouting "sign up" at cold viewers:

1. **Free value in-feed** (85% of posts) — earns the follow. No ask.
2. **Gated asset** (~1 post/week) — a template, teardown, or checklist in exchange for an email. On Instagram/TikTok use comment-to-DM ("comment SYSTEM and I'll send it") — it converts better than bio links and generates comment signals at the same time.
3. **Direct offer** (1–2 posts/month) — demo, trial, or product launch, aimed at the warm audience the first two rungs built.

Measure the ladder weekly: social → email signups is the single number that proves the system works. A month of great reach with zero owned-channel conversions means the content attracts the wrong audience — fix targeting (pillars, hooks, callouts), not volume.

## Workflow

1. Read `.agents/product-marketing.md` if it exists; ask the Before Starting questions for anything uncovered.
2. Pick 1–2 primary platforms based on where the audience is and the user's capacity. Justify the choice; say no to the rest for now.
3. Define 3–4 content pillars mapped to the positioning, with the percentage split from the calendar table.
4. Read `references/platform-playbooks.md` for each chosen platform before drafting anything.
5. Design the weekly calendar: which pillar, which format, which day/time, per platform.
6. Set up the repurposing pipeline: identify the pillar asset, extract atomic ideas, assign platform-native cuts.
7. Draft the first week of posts. For each: 5 hook variants, pick one, body per platform format rules, explicit CTA or deliberate absence of one (roughly 1 post in 4 carries a hard CTA).
8. Define the ladder from reach to owned audience: the gated asset, the comment-to-DM or link-in-comment mechanic per platform, and the direct offer cadence.
9. Define the measurement loop: which metrics to check weekly (see below), and a 4-week review where the bottom 50% of formats get cut and the top 10% get re-run.
10. Sanity-check the whole plan against capacity from Before Starting. A plan the user can sustain for 90 days beats an ideal plan they abandon in 3 weeks — cut platforms and formats until it fits.

## Metrics That Matter vs Vanity

| Matters | Why | Vanity | Why it lies |
|---|---|---|---|
| Saves + shares per post | Strongest algorithm signals; proxy for "worth keeping" | Likes | Cheapest action; algorithms weight it least |
| Comments (non-emoji) per post | Drives distribution; signals a real audience | Follower count | Bought, botted, or dead followers all count |
| Profile visits → follows conversion | Measures whether content attracts the *right* people | Impressions | You can't deposit impressions; spikes rarely repeat |
| Email signups / demos / DMs from social | The actual business outcome | Posting streak | Consistency of output ≠ growth of outcomes |
| Retention/completion rate (video) | The variable that decides whether the next video gets pushed | Total video views | 3-second views inflate the count |

Weekly review takes 15 minutes: top 3 posts by saves+shares (make more like these), bottom 3 (stop making these), and conversions to owned channels. Follower growth is a trailing output — never a weekly target.

## Common Mistakes

1. **Posting the same content to every platform.** Watermarked TikToks on Reels and horizontal YouTube clips on TikTok get suppressed, and text tuned for LinkedIn reads bloated on X. Fix: one pillar piece, native cuts per platform (see Repurposing Pipeline).
2. **Burying the hook.** Warming up with context ("I've been thinking a lot lately about...") loses the reader before the point. Fix: write the post, then delete the first 1–3 sentences — the real hook is usually sentence four. Lead with the conclusion.
3. **Links in the post body.** Every platform suppresses posts that route users off-platform — expect a 30–50% reach cut. Fix: link in the first comment (LinkedIn/X), link in bio + "link in bio" CTA (Instagram/TikTok), or make the content complete without the link and let profile clicks do the work.
4. **Chasing followers instead of conversions.** 100k followers who never buy lose to 3k followers in your exact niche. Fix: track profile-to-follow conversion and social-to-email signups weekly; write for the buyer, not the widest possible audience.
5. **Quitting at week 6.** Social compounds: accounts typically look dead for 8–12 weeks before the first outlier post. Most people quit right before the feedback loop starts. Fix: commit to a 90-day minimum with batch creation, and judge the system at 90 days — never a single post at 24 hours.
6. **Selling in every post.** Feeds full of product screenshots train the algorithm and the audience to skip you. Fix: hold promotion to ~15% of posts; earn attention with the other 85%, then the promotional posts actually land.
7. **Posting and ghosting.** The first 60–90 minutes decide distribution, and an unanswered comment section stalls the test cohort. Fix: post when you have 30 free minutes after; reply to every comment with a substantive response (a reply is a new comment in the algorithm's eyes).
8. **Ignoring the data because it's uncomfortable.** Creators keep making the format they *like* instead of the one that performs. Fix: the 4-week review is binding — double down on the top 10% by saves+shares even if it's not your favorite format.

## Output Format

Deliver a **Social Content System** document containing:

1. **Platform strategy** — chosen 1–2 platforms with a one-line rationale each, and what was deliberately deferred.
2. **Pillars** — 3–4 content pillars with percentage split and the positioning angle each one serves.
3. **Weekly calendar** — table: day, platform, pillar, format, posting time.
4. **Repurposing map** — the pillar asset and its platform-native cuts for the next 2 weeks.
5. **First week of posts** — fully drafted, each with the chosen hook (plus the 4 rejected variants for the first post, to show the method), formatted natively per platform.
6. **Measurement plan** — the 4–5 metrics to review weekly, current baseline if known, and the 4-week cut/double-down rule.

Keep drafts in the user's voice — pull phrasing from their existing writing when available. For sentence-level polish, route to copywriting; for message and positioning changes, route to product-marketing.
