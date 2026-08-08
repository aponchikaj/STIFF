---
name: cold-email
description: "When the user wants to plan, write, or fix a cold email program that lands in the inbox and gets replies. Triggers: cold email, outreach, cold DM, prospecting, deliverability, SPF, DKIM, DMARC, my emails go to spam, sequences. Covers deliverability preflight (SPF/DKIM/DMARC, domain warmup, volume guardrails), personalization tiers with expected reply rates, and 3-5 touch sequence design for targeted, opt-out-respecting B2B prospecting. For the value proposition itself, see product-marketing. For copy mechanics, see copywriting. For social-channel outreach, see social."
metadata:
  version: 1.0.0
---

# Cold Email

Act as a senior outbound operator who has run B2B cold email programs from domain purchase to booked meetings. The outcome: a deliverability-verified sending setup, a tiered personalization plan matched to account value, and a 3-5 touch sequence that earns replies without burning the domain. Everything here assumes legitimate outreach — targeted lists, a real sender identity, a working opt-out, and compliance with CAN-SPAM (accurate headers, physical address, honored unsubscribes) and GDPR (lawful basis, usually legitimate interest for relevant B2B contact, documented and easy to object to). Spray-and-pray is out of scope because it destroys the asset this skill exists to protect: inbox placement.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it should define the ICP, value proposition, and proof points. Only ask what it does not cover. Group questions so the user answers once, not five times:

1. **Audience and offer**: Who exactly gets this email (role, company size, trigger event), and what is the one-sentence reason they should care? What proof exists (customer names, numbers)?
2. **Sending infrastructure**: What domain will send? Is it the main company domain or a separate one? How old is it, and has it sent cold email before? How many inboxes are available?
3. **Volume and goals**: How many prospects per month, and what counts as success — replies, meetings, or pipeline? Any past campaigns with reply/bounce data?

Skip any question already answered by context. Three grouped questions beat ten scattered ones.

## Deliverability Preflight

Deliverability is the multiplier on everything else. A 15% reply rate on emails that reach 40% of inboxes performs like a 6% campaign. Run the preflight before writing a single line of copy.

Run the bundled checker first: `scripts/deliverability-check.sh yourdomain.com` — it verifies SPF, DKIM, and DMARC via DNS and prints pass/fail with fix hints.

| Check | Requirement | Why it matters |
|---|---|---|
| Separate sending domain | Use `try-acme.com` or `acmehq.com`, never the main domain | A spam-flagged main domain breaks transactional and team email; a burner variant contains the blast radius |
| SPF | One `v=spf1` TXT record listing your ESP, ending `~all` or `-all` | Receivers reject or junk mail from servers the domain never authorized; multiple SPF records = automatic fail |
| DKIM | Selector record published, signing enabled in ESP | Proves the message wasn't altered; Gmail and Yahoo require it for bulk senders since 2024 |
| DMARC | `_dmarc` TXT with at least `v=DMARC1; p=none; rua=mailto:...` | Required by Gmail/Yahoo; move to `p=quarantine` once reports look clean |
| Domain warmup | 2-4 weeks, starting ~10-20 emails/day per inbox, roughly doubling weekly | Sudden volume from a new domain is the strongest spam signal there is |
| List hygiene | Verify every address before sending (bounce-check tool); remove catch-alls or send to them cautiously | Bounces above 2% tell providers you scraped a stale list |
| Bounce rate | Keep under 2% | Above that, providers start junking the whole domain |
| Spam complaints | Keep under 0.1% (1 per 1,000) | Gmail's published enforcement threshold; exceeding it tanks placement for weeks |
| Volume ceiling | ~30-50 cold sends/day per warmed inbox | Beyond this, per-inbox reputation degrades; scale with more inboxes, not more volume |

To send 1,000 emails/month, provision 2-3 inboxes on 1-2 secondary domains and warm them before launch — not one inbox at 50/day from day one.

### Warmup Ramp

Per inbox, from the day DNS records verify. Send warmup traffic to engaged addresses first (warmup tool or colleagues who reply), because early replies teach providers the mail is wanted.

| Week | Daily volume per inbox | Mix |
|---|---|---|
| 1 | 10-15 | Mostly warmup traffic; a handful of real tier 1 sends |
| 2 | 20-30 | Roughly half warmup, half real prospects |
| 3 | 30-40 | Mostly real sends; keep some warmup running |
| 4+ | 30-50 steady | Full production; keep 10-20% warmup traffic indefinitely |

If bounces exceed 2% or a provider starts junking mail during warmup, drop back one week's volume and hold until metrics recover. Pushing through a bad signal makes it permanent.

## Personalization Tiers

Match research effort to account value. The mistake is uniform effort: too much on small accounts, too little on big ones.

| Tier | Who | Method | Effort per email | Expected reply rate |
|---|---|---|---|---|
| 1 — Manual | Top 5-10% of accounts (highest ACV, named targets) | Fully hand-written; reference something specific you found about them this week | 10-20 min | 10-20% |
| 2 — Variable | Mid-value accounts with researchable attributes | Template with 2-3 real variables (tech stack, recent hire, funding, public metric) | 1-3 min | 5-10% |
| 3 — Segment | Long tail, clearly defined segment | One sharp template per narrow segment; the segmentation is the personalization | seconds | 1-5% |

Baseline for calibration: typical cold reply rates are 1-5%; a good campaign hits 8-15%. If tier 3 is below 1%, the problem is list quality or the offer, not the template. A "variable" that could be mail-merged from a directory (first name, company name) is not personalization — it must be something a human would have to notice.

## Sequence Design

3-5 touches. More than 5 raises complaint risk faster than it raises replies — most incremental replies come from touches 2-3.

| Touch | Timing | Job | Notes |
|---|---|---|---|
| 1 | Day 0 | The pitch: relevance line, one problem, one proof point, soft CTA | 50-125 words; one link at most, ideally zero |
| 2 | Day 3-4 | Reply in-thread, add a new angle or asset | "Bumping this" adds nothing; add a case study, number, or reframe |
| 3 | Day 8-10 | Different angle entirely (different pain or persona-level consequence) | New thread is acceptable here |
| 4 (optional) | Day 15-18 | Short, useful, no ask — a relevant resource or observation | Builds goodwill; skip for tier 3 |
| 5 | Day 21-25 | Breakup: close the loop, make it easy to say no | Often the highest reply-rate email in the sequence |

The breakup email works because it removes pressure: "Seems like this isn't a priority — I'll stop here. If timing changes, the door's open." Keep it two sentences. No guilt, no fake deadlines.

Every touch carries a functional opt-out (an unsubscribe link or a plain "reply 'no' and I won't follow up") and stops the sequence on any reply or opt-out — this is both law (CAN-SPAM) and self-interest (unwanted touch 4 is where complaints happen).

## Subject Lines and First Lines

Subject rules:
- 2-5 words, lowercase or sentence case — reads like a colleague, not a campaign ("quick question re: onboarding", "acme x {{company}}")
- No spam-trigger patterns: ALL CAPS words, "free", "guaranteed", multiple punctuation marks, emoji
- Internal-forward test: would this subject look normal if forwarded within their company? If not, rewrite
- Never fake familiarity ("re:" on a thread that doesn't exist, "following up" on nothing) — it wins the open and loses the reply

First-line rules:
- The first line is the preview text; it decides the open as much as the subject does
- Never open with "My name is..." or "I hope this finds you well" — the preview pane shows you have nothing to say
- Lead with the reason this specific person is getting this specific email: the trigger, the observation, the shared context
- One test: could this first line be sent to anyone else on the list? If yes for tier 1-2, rewrite it

Body rules that follow from the first line:
- 50-125 words total for touch 1; a prospect decides in the preview pane and the first scroll
- One idea per email — one problem, one proof point, one CTA; a second CTA halves response to both
- Proof beats claims: "cut Acme's onboarding time 40%" outperforms "we help companies onboard faster"
- Plain text, no images, no more than one link — HTML-heavy mail from a young domain pattern-matches to marketing blast

### Worked Examples

Tier 2 touch 1 (variables marked; ~75 words):

```
subject: {{competitor_or_peer}} onboarding numbers

Hi {{first_name}} — saw {{company}} is hiring {{role_being_hired}}, which
usually means {{pain_that_hiring_signals}}.

{{customer_name}} had the same setup and cut {{metric}} by {{number}}%
in {{timeframe}} using {{product_category}} — without adding headcount.

Worth a look at how they did it? Happy to send the two-paragraph version.

{{sender_name}}
{{company}} · {{physical_address}}
Reply "no" and I won't follow up.
```

Breakup email (touch 5; two sentences plus opt-out):

```
subject: (same thread)

Seems like this isn't a priority right now, {{first_name}} — I'll stop
here. If {{pain}} moves up the list, the door's open.
```

Do not reuse these verbatim across users — regenerate the angle from their actual product and proof points. The structure (trigger, proof, soft ask, opt-out) is the template; the words are not.

## Diagnosing Spam Placement

When "my emails go to spam," work down this table in order — the top rows account for most cases.

| Symptom | Likely cause | Check | Fix |
|---|---|---|---|
| Everything junked, all providers | Auth failure or blocklisted domain/IP | `scripts/deliverability-check.sh`; blocklist lookup (Spamhaus, etc.) | Fix DNS records; if blocklisted, request delisting and pause sending |
| Gmail junks, Outlook fine (or vice versa) | Provider-specific reputation | Google Postmaster Tools domain reputation | Cut volume to that provider 50%, raise warmup share, rebuild for 2-3 weeks |
| Spam started after volume increase | Ramp too fast | Compare send volume week-over-week | Return to last clean volume, hold one week, ramp 25-50% weekly |
| Spam started after new template | Content trigger | Diff old vs new: links, images, spam-pattern words | Revert; reintroduce changes one at a time |
| High bounces preceded it | Stale or scraped list | Bounce log; verification coverage | Verify entire remaining list; suppress catch-alls |
| Only replies land, first-touch junked | Thin domain history | Domain age, prior send history | Extend warmup; more reply-generating traffic before cold volume |

## Reply Handling

The sequence's job is to start conversations; the reply handling determines whether they become meetings. Prepare responses before launch so replies get answered within a few hours — reply-to-meeting conversion drops sharply after 24 hours.

| Reply type | Response |
|---|---|
| Interested | Propose 2 concrete times, not "what works for you?"; include a one-line agenda |
| Question or objection | Answer directly in one short paragraph, then re-offer the call; never send a brochure |
| "Not now" | Ask permission to check back at a named time ("worth revisiting in Q1?"), tag for follow-up, stop the sequence |
| Referral ("talk to X") | Thank them, email X referencing the referral by name — warm intros convert several times better than cold |
| Unsubscribe or annoyed | Confirm removal in one sentence, suppress the whole account, no pitch |

Every non-positive reply still stops the automated sequence. A human replied; automation from that point forward reads as a bot and gets reported.

## Testing

Cold email volumes are small, so most "A/B tests" are noise. Rules for tests that mean something:

- Test one variable at a time: subject, first line, CTA, or offer — never two at once
- 200-300 sends per variant minimum before comparing; below that, a 2-point reply gap is chance
- Judge on reply rate, not open rate — open tracking over-counts (Apple MPP auto-opens) and the pixel itself hurts deliverability slightly
- Test the offer before the copy: a weak offer with perfect copy loses to a strong offer with average copy every time
- Keep a control: when a variant wins, it becomes the new control and the loser is retired, not tweaked

## Workflow

1. Read `.agents/product-marketing.md` if it exists; ask the Before Starting questions for anything missing.
2. Run `scripts/deliverability-check.sh <sending-domain>`. Fix every failure before proceeding — give the user the exact DNS records to add.
3. Confirm infrastructure math: prospects per month ÷ (30-50/day × working days) = inboxes needed. Flag if the domain is new and prescribe the 2-4 week warmup ramp starting at 10-20/day.
4. Segment the list into tiers 1/2/3 by account value. Define what real personalization means for tiers 1 and 2 (the specific researchable variables).
5. Design the sequence: touches, spacing, and the job of each email per the sequence table. Write tier 2 templates with variables marked; write 1-2 tier 1 examples in full as a model.
6. Apply subject and first-line rules; run the internal-forward test on every subject.
7. Verify compliance: real sender name and physical address, working opt-out on every email, sequence-stop on reply/opt-out, lawful-basis note for any EU recipients.
8. Set the monitoring plan: watch bounce rate (<2%), spam complaints (<0.1%), and reply rate weekly; pause and diagnose if bounces spike or replies fall below the tier's floor.

## Common Mistakes

1. **Sending from the main domain.** One bad campaign flags the domain that carries billing and support email. Fix: buy a variant domain, warm it, and keep the main domain clean.
2. **Skipping warmup because "we need pipeline now".** Full volume from a cold domain gets junked within days, and recovery takes longer than warmup would have. Fix: 2-4 weeks ramping from 10-20/day; buy the domains a month before you need them.
3. **Fake personalization.** "I saw you're the VP of Sales at Acme" is a database lookup, and recipients know it. Fix: tier the list; use variables a human had to notice, or drop to an honest tier 3 segment template.
4. **Optimizing opens instead of replies.** Clickbait subjects inflate opens and crater replies, and open tracking is unreliable post-Apple MPP anyway. Fix: judge subjects by reply rate; use the internal-forward test.
5. **Asking for 30 minutes in touch 1.** A meeting is a big ask from a stranger. Fix: soft CTA first — "worth a look?", "open to seeing how X did this?" — and earn the calendar ask in later touches.
6. **"Just bumping this" follow-ups.** Repetition without new information reads as pestering and drives complaints. Fix: every touch adds an angle, asset, or proof point.
7. **No opt-out because "it's just a few emails".** It violates CAN-SPAM and converts annoyed recipients into spam complaints, which cost far more than an unsubscribe. Fix: opt-out on every send, honored immediately, sequence stopped.
8. **Scaling volume before scaling results.** 10x-ing a 0.5% reply-rate campaign produces 10x the domain damage. Fix: hit at least 3-5% replies on 200-300 sends before adding inboxes.

## Output Format

Deliver a single outreach plan document with these sections:

1. **Deliverability status** — checker output per domain (SPF/DKIM/DMARC pass/fail), fixes with exact DNS records, warmup schedule if needed.
2. **Infrastructure plan** — domains, inboxes, daily volume per inbox, ramp dates.
3. **List and tiers** — segment definitions, tier assignment rules, verification step, expected reply-rate range per tier.
4. **Sequence** — every touch written out (tier 2 with variables marked `{{like_this}}`, tier 1 as fully written examples), with day offsets and CTA per touch.
5. **Compliance checklist** — sender identity, physical address, opt-out mechanism, GDPR lawful-basis note.
6. **Metrics to watch** — reply rate target by tier, bounce <2%, complaints <0.1%, and the pause condition for each.

Keep templates in copy-paste-ready blocks. State expected reply ranges next to each tier so results can be judged against a baseline, not a hope.
