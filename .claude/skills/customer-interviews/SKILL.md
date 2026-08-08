---
name: customer-interviews
description: "When the user wants to plan, script, run, or synthesize customer research — discovery interviews, churn interviews, JTBD switch interviews, or surveys. Triggers: \"user interviews\", \"customer interviews\", \"JTBD\", \"discovery calls\", \"churn interview\", \"survey design\", \"talk to users\", \"what should I ask\". Covers Mom Test question craft, non-leading scripts, recruiting and logistics, switch-interview timeline reconstruction, and coding transcripts into evidence-ranked findings. For deciding what the interview evidence means for the idea, see idea-validation. For turning findings into positioning, see product-marketing."
metadata:
  version: 1.0.0
---

# Customer Interviews

Act as a customer research lead who has run hundreds of discovery, churn, and JTBD interviews and knows the core failure mode: people will lie to be nice, and founders will hear what they want to hear. The outcome of this skill is an interview program that produces evidence — specific past behavior, money and time already spent, reconstructed switching timelines — instead of polite opinions, and a synthesis that ranks problems by evidence rather than vibes.

## Before Starting

Ask these before writing a single question. Group them; don't interrogate one at a time.

1. **Decision:** What decision will this research feed — build/kill an idea, fix churn, set pricing, choose a segment? The decision determines the interview type and how much evidence is enough.
2. **Segment and access:** Who exactly are you interviewing, and how will you reach them? Existing users, a list, communities, intercepts? B2B or B2C changes recruiting and incentives.
3. **Prior evidence and timeline:** What do you already believe, what evidence supports it, and when is the decision due? Interviews take 2–3 weeks per round; if the decision is tomorrow, scope down.

## Choosing the Interview Type

| Decision to make | Interview type | Who to recruit | Length |
|---|---|---|---|
| Is this problem real / worth building for? | Discovery | People living the problem, including non-buyers | 30 min |
| Why do people actually buy (or not)? | JTBD switch | Switchers within the last 90 days | 45–60 min |
| Why are people leaving? | Churn | Cancellations within the last 2 weeks | 30 min |
| What is the value model / price range? | Pricing | Current payers and recent evaluators | 30–45 min |

Surveys are none of these — they quantify options interviews have already discovered (see below).

## Core Framework: The Mom Test

Even your mom will tell you the truth if you talk about her life instead of your idea. Three rules:

| Rule | Why | In practice |
|---|---|---|
| Talk about their life, not your idea | The moment you pitch, every answer becomes a favor | Never describe your product in a discovery interview; if asked, defer to the end |
| Ask about past behavior, not future hypotheticals | People are terrible predictors of their own behavior | "When did you last X?" beats "Would you use X?" every time |
| Specifics over generalities | "I usually…" is a self-image statement, not data | Get the story of the last time: what happened, who was involved, what it cost |

**Compliments are deflection data.** When someone says "cool idea" or "I'd definitely use that," you've pitched instead of asked. Don't write it down as validation — back up and return to their life: "Forget the idea for a second — walk me through the last time you dealt with this."

## Question Craft

Three moves cover most of a discovery interview:

1. **Open the wound:** "Walk me through the last time you [did the task / hit the problem]." A concrete story, not an opinion. Follow with "who else was involved?", "how long did that take?", "what happened next?"
2. **Follow the pain:** "What did you do about it?" If they did nothing — no workaround, no search, no complaint — the pain is fake, however loudly they describe it. Real problems leave a trail of attempted fixes.
3. **Dig for spend:** Time, money, and workarounds already invested are the strongest demand signal that exists. "What are you paying for today to handle this?" "How many hours a week does the duct-tape version cost you?" A spreadsheet they maintain by hand at 11pm is worth more than fifty "I'd definitely pay for that."

### Leading → Non-Leading Rewrites

| Leading (delete) | Non-leading (use) | What changed |
|---|---|---|
| "Would you use a tool that did X?" | "When did you last need to do X? Walk me through it." | Hypothetical → past behavior |
| "Don't you hate how slow Y is?" | "How do you feel about how long Y takes?" | Planted opinion → open question |
| "Would you pay $30/month for this?" | "What are you paying today to solve this? What have you tried?" | Fantasy pricing → existing spend |
| "Is onboarding your biggest problem?" | "What's the hardest part of getting a new hire productive?" | Suggested answer → their ranking |
| "Do you think this is a good idea?" | "Why haven't you solved this already? What's stopped you?" | Compliment bait → obstacle discovery |
| "You'd want integrations with Slack, right?" | "Where does the output need to end up? Show me your current flow." | Feature confirmation → workflow observation |
| "How often do you struggle with reporting?" | "When was the last time you built a report? What did that involve?" | Assumed struggle → neutral recall |
| "Would this save you time?" | "What did that cost you last time — hours, money, favors?" | Benefit pitch → measured cost |

The full bank, grouped by interview type, is in `references/question-bank.md` — pull the section matching the interview you're scripting.

### In-Interview Recovery Moves

Interviews go sideways in predictable ways. Recover with these:

| Moment | What it means | Recovery |
|---|---|---|
| "That's a cool idea!" | You pitched; they're being polite | "Forget the idea — walk me through the last time you dealt with this." |
| "I usually / I always / I would…" | Self-image, not behavior | "When was the most recent time? Tell me that specific story." |
| "Everyone has this problem." | Generality hiding zero personal stake | "Who specifically? When did it last cost *you* something?" |
| Long silence after your question | They're retrieving a real memory | Say nothing; count to three before rescuing them |
| They ask "so what does your product do?" | Interview about to invert into a pitch | "Happy to show you at the end — first, how do you handle it today?" |

### Evidence Hierarchy

Not all answers are equal. Rank what you hear on this ladder; only the top three rungs should drive decisions.

| Strength | Signal | Example |
|---|---|---|
| Strongest | Money already spent | Pays $400/mo for a partial solution plus a contractor to patch the gaps |
| Strong | Time/workarounds already invested | Maintains a hand-built spreadsheet, wrote a script, hired an intern for it |
| Strong | Concrete commitment made to you | Intro to a colleague, calendar time for a pilot, prepayment |
| Weak | Specific past story with real cost | Detailed account of the last failure, but no attempted fix |
| Weakest | Opinions, compliments, hypothetical enthusiasm | "Cool idea", "I'd definitely use that", "everyone needs this" |

## JTBD Switch Interviews

To learn why people buy, interview **recent switchers** — people who adopted or dropped a product in the last 90 days — and reconstruct the timeline of the switch.

**Timeline reconstruction technique:** walk backwards from the purchase, anchored to concrete dates and events, never summaries.

- Start at the transaction: "You signed up on the 12th. What happened that morning? What happened the week before?"
- Map three moments as you go back: **first thought** ("when did it first cross your mind that you needed something different?"), **passive looking** (noticing options without acting on them), and the **triggering event** that flipped them into active looking.
- When they summarize ("we just needed something better"), pull them back to a scene: "Where were you when you decided? Who did you talk to that day?"

The triggering event is your marketing message and your onboarding hook. Four forces act on every switch:

| Force | Direction | Question that surfaces it |
|---|---|---|
| Push of the current situation | Toward switching | "What was going on that made the old way stop being tolerable?" |
| Pull of the new solution | Toward switching | "What did you imagine life would look like after switching?" |
| Anxiety about the new | Against switching | "What almost stopped you? What were you worried would go wrong?" |
| Habit of the present | Against switching | "What did you like about the old way? What did you have to give up?" |

A switch happens when push + pull outweigh anxiety + habit. Most "lost deals" lose to anxiety and habit, not to a competitor — which is why interviewing people who evaluated you and did *not* switch is as valuable as interviewing buyers.

## Churn Interviews

- Interview **within 2 weeks of cancellation** — after that, memory rewrites itself into a tidy story.
- Ask **"what changed?"**, not "what was missing?" Churn is usually an event (new boss, budget cut, champion left, workflow moved) rather than a feature gap. Feature-gap answers are the polite exit.
- **The real reason is usually the second or third answer.** After each answer, ask "what else was going on around then?" The first answer is the socially acceptable one; keep gently pulling.
- End with the reverse: "What would have had to be true for you to stay?" — but treat the answer as a hypothesis, not a roadmap.

## Surveys Are a Different Tool

Surveys quantify known options; interviews discover unknown ones. Sequence interviews first — a survey built before interviews measures your assumptions, not their reality. Question hygiene when you do survey:

| Rule | Bad | Fixed |
|---|---|---|
| One concept per question | "Was the product easy to use and good value?" | Two questions: ease, then value |
| No double-barrels | "How satisfied are you with speed and support?" | Split into speed and support |
| No leading framings | "How much did our award-winning onboarding help?" | "How did onboarding go for you?" |
| Randomize option order | Fixed list (first options get picked more) | Shuffle per respondent |
| Consistent scales | Mixing 5- and 7-point in one instrument | 5-point throughout |

**Never ask "would you pay $X?"** Stated willingness-to-pay inflates roughly 2–3× over real behavior. If you need a price signal, use Van Westendorp's four questions via the pricing skill — it triangulates acceptable ranges instead of asking for a promise.

## Workflow

1. **Define the decision and the riskiest assumption.** Write one sentence: "This research decides ___. We currently believe ___, based on ___." Then pick the interview type from the selection table above. If nothing would change your plans regardless of what you hear, you're seeking reassurance, not research — stop and redefine.
2. **Recruit 5–8 people per segment per round.** Themes saturate around 10–15 interviews total; if interview 12 is producing nothing new, stop — more interviews past saturation buy confidence theater, not information.
   - **B2C:** $50–100 gift cards; recruit through user lists, targeted communities, or panel services.
   - **B2B:** cash incentives mostly fail — a $75 gift card insults a VP's calendar. Use your network, niche communities (Slack groups, subreddits, trade forums), conference intercepts, or trade a summary of the findings. Senior people respond to peer intros and genuine curiosity about their world.
   - Include people who chose a competitor and people who chose nothing; "chose nothing" is its own segment.
3. **Script the interview.** 30 minutes for discovery and churn, 45–60 for JTBD — timeline reconstruction needs room to breathe. Draw questions from `references/question-bank.md`, cut to 6–8 core questions, and leave half the time for follow-ups. The script is a spine, not a cage: when they open a door, walk through it and come back.
4. **Run it.**
   - Record with explicit consent, stated at the top and confirmed on tape.
   - Separate roles when possible: one person interviews, another takes notes. An interviewer who is typing misses the hesitation before "…yeah, it's fine," and that hesitation is data.
   - Shut up after asking. Count three seconds before rescuing them; silence does the digging for you.
   - When you catch yourself pitching, say "ignore that" out loud and return to their last story.
5. **Code within 24 hours.** Same-day, tag each transcript: problems mentioned, verbatim quotes, segment, frequency (how many interviewees hit this theme), intensity (did they spend time or money on it, or just mention it?). A theme raised by 7 of 8 people who all built workarounds outranks one raised by 8 of 8 who shrugged.
6. **Hunt contradictions.** Where interviewees disagree with each other — or where someone's stated priority contradicts their own behavior ("integration is critical" but they never tried the three that exist) — you've found either a segment boundary or a fake requirement. Investigate before averaging; averaging across a hidden segment split produces a persona nobody matches.
7. **Synthesize into ranked evidence.** Output the top problems ranked by frequency × intensity, each backed by verbatim quotes and observed spend — not a vibe summary. Route the "so what": idea-validation for build/kill, pricing for monetization, product-marketing for messaging.

## Common Mistakes

1. **Pitching in a discovery interview.** Once you've described the product, every subsequent answer is contaminated politeness. Fix: keep the idea in your pocket; if they ask, say "I'll show you at the end — first I want to understand how you handle this today."
2. **Counting compliments as validation.** "That's really cool" predicts nothing. Fix: log compliments as deflections and back up to past behavior; only specifics, spend, and commitments (intro to a colleague, prepay, pilot time) count as evidence.
3. **Asking hypotheticals.** "Would you…" invites fiction. Fix: convert every hypothetical to "when did you last…" before the interview; the rewrite table above is the pattern.
4. **Interviewing only fans or only one segment.** Eight enthusiastic friends produce false saturation. Fix: recruit across segments, include people who chose competitors or chose nothing, and treat "chose nothing" as its own segment.
5. **Accepting the first churn answer.** "Too expensive" is the exit line, not the reason. Fix: ask "what else was going on?" at least twice; the second or third answer is where the champion-left or workflow-changed story lives.
6. **Surveying before interviewing.** You'll quantify the wrong options with impressive-looking precision. Fix: interviews first to discover the option space, survey second to size it.
7. **Synthesizing from memory a week later.** Recall flattens eight distinct people into one imaginary average user. Fix: code transcripts within 24 hours while tone and hesitations are still recoverable.
8. **Treating one loud quote as a finding.** Intensity without frequency is an anecdote. Fix: every reported theme carries a count (n of total), at least two verbatims, and an intensity marker (spend, workaround, or nothing).

## Output Format

Deliver research plans and syntheses in this shape:

**Interview plan:**
- Decision the research feeds (one sentence) and riskiest assumption
- Interview type, segment(s), recruit target (5–8 per segment), incentive, channel
- Script: 6–8 core questions with planned follow-ups, timeboxed (30 or 45–60 min)
- Consent + recording plan, interviewer/notetaker roles

**Synthesis (after interviews):**
- Evidence table: theme | frequency (n/total) | intensity (spend / workaround / mention) | segments | 2–3 verbatim quotes. Example row:

| Theme | Freq | Intensity | Segments | Verbatim |
|---|---|---|---|---|
| Monthly reporting takes 2 days of manual export | 6/8 | Workaround: 4 built spreadsheets; 1 pays a VA $300/mo | Agency ops leads | "I block the last Friday of every month for it. My whole Friday." |

- Top 3 problems ranked by frequency × intensity, each with its strongest quote
- Contradictions found and what they imply (segment split vs fake requirement)
- Compliment/deflection log — what to explicitly *not* count as validation
- Next step routing: idea-validation (build/kill), pricing (Van Westendorp), or product-marketing (messaging)
