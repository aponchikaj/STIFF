---
name: presentation-design
description: "When the user wants to create, structure, or fix a presentation or slide deck. Triggers: 'pitch deck', 'slides', 'investor deck', 'demo day', 'presentation', 'keynote', 'my deck is too wordy'. Covers narrative arc selection, slide titles that carry the argument, word-count and font-size budgets, layout and data-slide craft, and adapting a deck to how it will be delivered. For charts inside slides, see data-visualization. For the narrative's underlying positioning, see product-marketing. For visual identity on slides, see brand-identity."
metadata:
  version: 1.0.0
---

# Presentation Design

Act as a presentation designer who has built decks that closed funding rounds and survived hostile boardrooms. The outcome: a deck where the slide titles alone tell the whole story, every slide makes exactly one point, and the density matches how the deck will actually be consumed — projected behind a speaker or read alone in an inbox.

## Before Starting

If `.agents/product-marketing.md` exists, read it first — it holds positioning, ICP, and the core value story. Never re-ask what it already answers. Then ask only what remains, grouped so the user answers once:

1. **Occasion** — What is this deck for: fundraise, sales meeting, demo day, internal strategy review, conference talk?
2. **Audience** — Who is in the room and what do they already believe? A partner meeting and a demo-day crowd need opposite levels of context.
3. **Time limit** — How many minutes on stage? Time budget drives slide count: roughly 1–1.5 minutes per slide when presenting.
4. **Delivery mode** — Presented live, sent ahead to be read, or both? This one answer changes every density decision (see Density Budgets). If "both," push back: build the presented version and a separate appendix or memo — a hybrid fails both jobs.

## Narrative Arc Selection

Pick the arc before writing a single slide. The wrong arc with great slides still loses the room.

| Deck type | Arc | Slide count | Why this order |
|---|---|---|---|
| Investor deck | Problem → why now → solution → traction → market → team → ask | 10–15 slides for a 20-min pitch | Investors buy the problem and the timing before they care about your product. Traction before market size, because proof beats projection. |
| Sales deck | Their problem first → cost of inaction → the shift in the world → new way → proof → product last | 8–12 | Prospects tune out product tours. Lead with their pain in their words; the product appears only once they want a solution. |
| Demo day | Hook → problem → solution → traction → ask | 3-min version, 5–7 slides, one idea per slide | The traction slide is the star — investors in the audience remember one number, so give them one big one. Hook in the first 15 seconds or lose the room. |
| Internal strategy | Situation → complication → resolution (SCQA) | 6–12 | Executives already know the situation — compress it to one slide. Spend the deck on the complication (what changed, what breaks if we do nothing) and the resolution. |

Write the "ask" explicitly on its own slide in investor and demo-day decks: amount, use of funds, milestone it buys. Decks that end on "thank you" instead of an ask waste their strongest moment.

### Investor deck, slide by slide

A 20-minute partner meeting at 1–1.5 minutes per slide budgets 12–14 slides plus appendix. Each slide has one job:

| # | Slide | Its one job |
|---|---|---|
| 1 | Title + one-line hook | Name the company and the change it makes in one sentence |
| 2 | Problem | Make the pain concrete and expensive — one customer story or one big number |
| 3 | Why now | The shift (tech, regulation, behavior) that makes this possible today and not five years ago |
| 4 | Solution | What you built, in the customer's language — one screenshot beats an architecture diagram |
| 5 | How it works | The mechanism, only deep enough to be credible |
| 6 | Traction | The chart that goes up and to the right; the single strongest proof you have |
| 7 | Business model | Who pays, how much, and the unit economics in three numbers |
| 8 | Market | Bottom-up sizing: customers × price, not a Gartner TAM circle |
| 9 | Competition | Why incumbents structurally can't follow, not a feature checkbox grid |
| 10 | Go-to-market | The repeatable channel that already works, not a list of every channel |
| 11 | Team | Why these people win this market — relevant scars, not job titles |
| 12 | Ask | Amount, runway it buys, milestone it reaches |

Anything an investor might challenge — cohort tables, pipeline detail, full financial model — goes in the appendix, ready but unpresented.

### Demo day, minute by minute

Three minutes is roughly 400 spoken words. Script it:

| Time | Beat | What happens |
|---|---|---|
| 0:00–0:15 | Hook | One startling number or one vivid sentence of the absurd status quo — the room decides here whether to look up |
| 0:15–0:45 | Problem | Who suffers, how much it costs them, why current options fail |
| 0:45–1:30 | Solution | What you built and the moment it clicks for a user — show, don't architecture |
| 1:30–2:15 | Traction | The star slide: your single biggest number, huge, alone on the slide |
| 2:15–2:45 | Market + team | One line each — big enough to matter, right people to win |
| 2:45–3:00 | Ask | What you're raising and how to reach you — name and contact stay on screen |

## The One-Idea-Per-Slide Rule

Each slide makes exactly one point, and the slide title IS that point — a full takeaway sentence, not a category label.

| Label title (wrong) | Takeaway title (right) |
|---|---|
| Financials | Revenue tripled in 2025 |
| Market | 40M freelancers file taxes with no software built for them |
| Team | The founding team shipped payments infra at Stripe and Adyen |
| Competition | Incumbents can't match our pricing without cannibalizing their core product |

**The title test**: read only the titles, top to bottom. If the titles alone carry the full argument, the deck works — because that is genuinely all a skimming partner or a distracted executive will read. If any title could sit atop three different slides, it is a label, not a takeaway. Rewrite it.

When one slide contains two ideas, split it. Two slides at 30 seconds each beat one slide the speaker fumbles through for a minute.

Takeaway titles are also self-correcting: writing "Revenue tripled in 2025" forces you to check whether the slide actually proves it. A label like "Financials" lets a weak slide hide.

## Density Budgets

Decide which deck you are making before designing anything. The presented deck and the reading deck are different documents with different physics.

| Property | Presented deck | Send-ahead / reading deck |
|---|---|---|
| Words per slide | ≤20 | 50–100 is fine; full sentences expected |
| Minimum font size | 30pt — if it doesn't fit at 30pt, you have too many words | 14pt body works; it's read at arm's length, not from row 20 |
| Slide's job | Backdrop for a talking human; the speaker carries the detail | Standalone argument; must survive with no speaker attached |
| Speaker notes | Carry everything the slide doesn't say | Fold into the slide body — nobody reads notes in an emailed PDF |

The hybrid deck — dense slides read aloud by a presenter — fails both jobs: the audience reads ahead of the speaker, stops listening, and the deck is still too thin to stand alone later. When the user needs both, produce the 20-word presented deck plus a written memo or appendix.

## Slide Layout Craft

- **One focal point per slide.** The eye should know where to land within one second. If a slide has three competing elements, it has zero.
- **Tolerate 60%+ whitespace.** Empty space is not wasted space — it is what makes the one idea legible from the back row. Resist the urge to fill it.
- **One consistent grid across all slides.** Same title position, same margins, same alignment on every slide. When titles jump around, the audience spends attention re-orienting instead of listening.
- **Full-bleed image + short overlay text beats a clipart collage.** One strong photograph edge-to-edge with a 10-word overlay is memorable; four small stock images arranged around bullets reads as filler.
- **Build-up sparingly.** Reveal bullets progressively only when the sequence itself is the point; otherwise animation is friction.

## Data Slides

- **One chart per slide.** Two charts split attention and usually smuggle in two ideas — which violates the one-idea rule anyway.
- **The headline states the insight the chart proves.** "Churn halved after the onboarding redesign," not "Monthly churn, 2024–2025." The chart is evidence; the title is the verdict.
- **Delete axis clutter.** Gridlines, decimal places, legends for single-series charts, and axis titles the headline already explains — remove them all. Label the two or three data points that matter directly on the chart.
- **Highlight the one number.** If the slide exists because revenue hit $2M ARR, make that number the largest element on the slide, not a cell in a table.

## Storytelling Beats

- **Open with stakes or tension, never an agenda.** "Every year, $400B in invoices are paid late" earns attention; "Today I'll cover five topics" spends it. Agenda slides belong only in long internal reviews, and even then after the hook.
- **Demo-day formula: hook in the first 15 seconds.** One startling number, one vivid customer moment, or one sentence of the absurd status quo. The audience decides in 15 seconds whether to look up from their laptops.
- **Escalate, then resolve.** Problem slides should make the room slightly uncomfortable before the solution slide releases the tension. A solution presented before the problem lands feels like an answer to a question nobody asked.
- **End on the ask or the takeaway, not "Questions?"** The last slide stays on screen through the entire Q&A — make it the one thing you want remembered.

## Delivery-Mode Adaptations

| Mode | Adaptation |
|---|---|
| On stage, 20 min | 10–15 slides, ≤20 words each, 30pt+ fonts, speaker notes carry detail |
| Demo day, 3 min | 5–7 slides, one number per slide, traction slide is the star, rehearse to the second |
| Sent ahead (memo-style) | Full-sentence slides, standalone logic, no speaker notes, denser is fine |
| Zoom / screen-share | Faces shrink slides — bump fonts up a step, avoid fine detail in corners, more slides with less each |
| Boardroom handout | Print-safe contrast, page numbers, appendix for every number someone might challenge |
| Conference keynote, 30–45 min | Fewer words still — many slides are a single image or phrase; the talk is the content, slides are punctuation |

For Zoom decks, also assume the recording outlives the meeting: someone will watch at 1.5x with the deck at thumbnail size, so the title must carry each slide even more than usual.

## Workflow

1. **Read context.** Load `.agents/product-marketing.md` if present; ask the Before Starting questions for anything it doesn't cover.
2. **Pick the arc** from the Narrative Arc Selection table based on occasion and audience.
3. **Write all slide titles first, as an outline — before designing anything.** One takeaway sentence per slide, in arc order. This is the cheapest point to fix the story.
4. **Run the title test.** Read the titles top to bottom as a story. Reorder, merge, and cut until the titles alone persuade. Three checks:
   - Does each title state a claim, not a category?
   - Does each title follow from the one before it — would a stranger see why slide 6 comes after slide 5?
   - Is there exactly one title the audience must remember? If two compete, one of them moves to the appendix.

   Show this outline to the user and get agreement before touching layout — reordering titles costs seconds; reordering designed slides costs hours.
5. **Set the density budget** from the delivery mode: presented (≤20 words, 30pt) or reading deck (denser, standalone).
6. **Draft slide bodies.** For each title, add only the evidence that proves it — one chart, one image, or one short list. Cut anything the title doesn't need.
7. **Design pass.** Apply the grid, enforce one focal point per slide, strip axis clutter from data slides, check whitespace.
8. **Rehearsal pass (presented decks).** Time it at 1–1.5 minutes per slide against the time limit; cut slides, not font size, when over.

### Revising an existing deck

When the user brings a deck that already exists ("my deck is too wordy"), work in this order — story before slides, slides before styling:

1. Extract every slide title into a flat list and run the title test on it. Most "wordy deck" problems are actually story problems: the titles don't argue, so the bodies compensate with text.
2. Rewrite label titles as takeaways. Often half the body text becomes redundant the moment the title states the point.
3. Apply the density budget: for a presented deck, cut each slide to ≤20 words, moving the overflow into speaker notes — never delete the speaker's material, relocate it.
4. Merge slides that share an idea; split slides that hold two.
5. Only then touch layout, fonts, and charts.

## Common Mistakes

| Mistake | Fix |
|---|---|
| Label titles ("Team", "Market", "Financials") | Rewrite every title as the takeaway sentence: "Revenue tripled in 2025." Run the title test after. |
| Hybrid deck — dense slides read aloud | Decide presented vs send-ahead first. Build the 20-word deck plus a separate memo if both are needed. |
| Opening with an agenda slide | Open with stakes: a number, a tension, a customer moment. Agenda (if kept at all) comes after the hook. |
| Product-first sales deck | Reorder: their problem, cost of inaction, the shift — product appears in the back third. |
| Two ideas (or two charts) on one slide | Split into two slides. Slide count is cheap; audience attention is not. |
| Shrinking fonts to make content fit | If it doesn't fit at 30pt in a presented deck, cut words — the overflow belongs in speaker notes or appendix. |
| Chart titles that describe instead of conclude | Headline the insight the chart proves; delete gridlines, legends, and decimals that don't serve it. |
| Ending on "Thank you / Questions?" | End on the ask or the single takeaway — that slide stays up through all of Q&A. |

## Output Format

Deliver in two stages:

1. **Title outline first** — the arc name, then every slide title in order as a numbered list, with a one-line note on what evidence each slide will carry. Wait for the user to approve the story before drafting slides.
2. **Full slide-by-slide spec** — for each slide: title (the takeaway sentence), body content within the density budget, visual direction (layout, focal point, chart type if any), and speaker notes for presented decks.

State the chosen delivery mode and its density budget at the top of the spec, so every later edit is checked against it.

For generating actual .pptx files, Claude's built-in pptx skill handles file output — this skill owns narrative and design decisions.
