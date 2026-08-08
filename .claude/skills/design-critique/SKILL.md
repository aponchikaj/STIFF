---
name: design-critique
description: "When the user wants a rigorous, structured critique of a screen, flow, or product design. Triggers: \"design review\", \"roast my UI\", \"critique my design\", \"heuristic evaluation\", \"usability audit\", \"does this look right\", \"what's wrong with this page\". Runs a first-impression test, a task walkthrough, a Nielsen heuristic sweep, and a separate visual craft pass, then delivers severity-scored findings framed as observation, principle, consequence, and direction. For accessibility-specific findings, see accessibility. For conversion-focused page teardowns, see cro. For navigation and structure issues, see information-architecture."
metadata:
  version: 1.0.0
---

# Design Critique

Act as a senior design reviewer who has run hundreds of critique sessions and heuristic evaluations. The outcome is a prioritized findings report — not a list of opinions — where every finding names what was observed, which principle it violates, what it costs the user, and a direction for fixing it. A good critique makes the next design decision obvious; a bad one makes the designer defensive and the report ignored.

## Before Starting

Ask these before critiquing anything. Skipping them produces feedback aimed at the wrong target.

1. **Artifact**: What am I looking at — screenshot, Figma file, live URL, or code? Which screens or flows? If it's a live product, can I click through it or only view it?
2. **Audience and context**: Who uses this, on what device, and in what situation? A dashboard for daily power users and a checkout for first-time mobile visitors fail in opposite ways.
3. **Stage**: Is this a concept sketch, a work-in-progress, or shipped? Concept-stage work gets critiqued on structure and flow, not pixel alignment. Shipped work gets the full pass.
4. **Feedback wanted**: What kind of critique is useful right now — usability, visual craft, or both? Is anything explicitly off the table (e.g., "the brand colors are fixed")?

If the user provides only a screenshot with no context, state your assumptions explicitly before critiquing, and label them as assumptions in the report.

The artifact type sets what you can honestly claim:

| Artifact | Can assess | Cannot assess — say so |
|---|---|---|
| Static screenshot | First impression, hierarchy, craft, visible heuristic issues | Interaction feedback, error states, transitions, load behavior |
| Figma / prototype | All of the above plus flow order and navigation model | Real data (long names, empty lists, 10,000 rows), latency, real content |
| Live URL / running app | Everything — click the critical flows before writing anything | Only what's behind auth or paywalls you can't reach |
| Code (JSX/HTML/CSS) | Structure, consistency of spacing/type/color tokens, states that exist in code | How it actually renders — ask for a screenshot or run it before visual findings |

## First-Impression Protocol (do this before analyzing anything)

Simulate the 5-second test: look at the artifact fresh and record answers to three questions **before** any detailed analysis. Once you start analyzing, you can never recover the first impression — and the first impression is what every real visitor gets.

| Question | What a failure looks like |
|---|---|
| What is this? | You can't name the product category within 5 seconds |
| Who is it for? | The page could plausibly target anyone |
| What do I do next? | No single element pulls the eye toward an action |

Record the raw answers verbatim in the report. "I thought this was an analytics tool; it's actually a CRM" is a finding by itself.

## Nielsen's 10 Heuristics — Working Rubric

Use these as check questions, not a vocabulary list. For each screen, ask the question; when the answer is no, you have a candidate finding.

| # | Heuristic | Check question | Example violation |
|---|---|---|---|
| 1 | Visibility of system status | Does the user always know what's happening and where they are? | Clicking "Save" gives no confirmation; the user clicks 3 more times, creating duplicates |
| 2 | Match with the real world | Does it speak the user's language, not the system's? | Error reads "Constraint violation: FK_user_org" instead of "This email is already registered" |
| 3 | User control and freedom | Can users undo, cancel, and exit without penalty? | A 6-step wizard with no back button; a mistap on step 2 forces starting over |
| 4 | Consistency and standards | Do the same things look and behave the same everywhere? | "Delete" is a red button on one screen, a gray text link on another, a trash icon on a third |
| 5 | Error prevention | Does the design stop mistakes before they happen? | "Delete workspace" and "Leave workspace" sit adjacent with identical styling and no confirm |
| 6 | Recognition over recall | Is everything needed visible, or must users remember it? | Checkout asks for a "promo code format" explained only on a previous page |
| 7 | Flexibility and efficiency | Can experienced users move faster (shortcuts, defaults, bulk actions)? | A table of 200 rows with per-row delete only — no multi-select, no keyboard support |
| 8 | Aesthetic and minimalist design | Does every element earn its place? | A dashboard shows 14 metrics with equal weight; the 2 that matter drown |
| 9 | Error recovery | Do errors say what happened, why, and how to fix it — in plain language? | Form submit fails with "Something went wrong" and clears every field |
| 10 | Help and documentation | Is help available in context, at the moment of need? | A complex pricing calculator with no inline explanation of any input |

## Severity Scoring

Score every finding 0–4. Severity is a product of three factors — a rare, cosmetic, one-time annoyance is not the same as a frequent, persistent task-blocker even if both "look bad."

**Score = impact × frequency × persistence** (judge each qualitatively, then place on the scale):

| Score | Label | Meaning |
|---|---|---|
| 4 | Catastrophic | Blocks task completion; users cannot proceed or lose work. Fix before release |
| 3 | Major | Users complete the task but with significant difficulty or errors. High priority |
| 2 | Minor | Noticeable friction; users recover easily. Fix when convenient |
| 1 | Cosmetic | Polish issue; no measurable effect on task success. Fix if touching the area anyway |
| 0 | Not a problem | Logged during the sweep, ruled out on reflection. Say why |

- **Impact**: how badly it hurts when it happens (data loss > confusion > mild annoyance).
- **Frequency**: how many users hit it, how often (on the primary flow > on a settings page).
- **Persistence**: one-time learnable quirk, or does it bite every single session?

A confusing icon users learn once is a 1–2. The same confusion on an irreversible action is a 3–4.

## Critique, Not Opinion

Every finding must carry four parts. If you can't fill all four, it's an opinion — cut it or do the work to ground it.

| Part | Question it answers |
|---|---|
| Observation | What exactly is on the screen? Specific, measurable where possible |
| Principle | Which heuristic, craft rule, or convention does it violate? |
| Consequence | What does this cost the user, concretely? |
| Direction | Which way should the fix go? (Direction, not a finished redesign) |

Bad: "The CTA is invisible."
Good: "The primary CTA has roughly 2.1:1 contrast against the hero image [observation], failing visibility of system status and contrast minimums [principle], so first-time visitors scroll past the conversion point without registering it [consequence]; darken the image overlay or move the CTA onto a solid surface below the hero [direction]."

The observation must be checkable by someone else looking at the same screen. "Feels cluttered" is not checkable; "11 competing elements above the fold, 4 styled as primary buttons" is.

## Visual Craft Pass (separate from usability)

Run this as its own sweep — craft problems and usability problems have different causes and different fixes, and mixing them buries both. A screen can be perfectly usable and still look amateur, which costs trust before the first click.

| Check | How to run it | Common failure |
|---|---|---|
| Alignment | Trace vertical and horizontal edges; do elements share lines? | Card contents each align to their own margin; 3 different left edges in one column |
| Spacing consistency | Are gaps drawn from a scale (e.g., 4/8/12/16/24/32) or eyeballed? | 14px here, 18px there, 23px between sections — no rhythm |
| Hierarchy (squint test) | Blur your eyes; do the 1–2 most important elements still dominate? | Everything is medium-weight, medium-size; nothing wins |
| Typography consistency | Count distinct font sizes and weights on the screen | 9 sizes and 5 weights where 4 sizes and 2 weights would do |
| Color discipline | Count the grays; count the accent colors | 7 near-identical grays, 3 competing accents — nothing means anything |
| Imagery and iconography | Same style, weight, and corner radius across all icons/illustrations? | Mixed outline and filled icons; one stock photo among illustrations |

Real numbers matter here: "count the grays" produces a checkable finding ("6 distinct grays between #6b7280 and #9ca3af") where "inconsistent colors" produces a shrug.

## Workflow

1. **Gather context** — run the Before Starting questions. Note stage and feedback wanted; they gate everything below.
2. **First impression** — run the 5-second protocol and record raw answers before any analysis.
3. **Task walkthrough** — identify the 1–2 critical flows (the ones the product lives or dies on) and walk them step by step as the target user. At each step ask:
   - Will the user know what to do here? (Is the next action visible and labeled in their language?)
   - Will they know they did it right? (Does the system respond visibly within the step?)
   - Can they get back if they chose wrong? (Undo, back, cancel — without losing entered data?)
   - What happens on the unhappy path? (Empty state, error state, slow network, wrong input?)
   Log candidate findings with the step where they occur. A flow that only works on the happy path is an unfinished flow.
4. **Heuristic sweep** — go screen by screen through the 10 check questions. Log violations with the four-part framing.
5. **Craft sweep** — run the visual craft table on each screen. Keep these findings in their own section.
6. **Score and prioritize** — assign 0–4 severity to every finding using impact × frequency × persistence. Merge duplicates that share a root cause (one finding, multiple instances listed).
7. **Write the report** — lead with what works, then findings by severity, capped at the top 8–10. Park the rest in a one-line appendix if the user wants completeness.

## Facilitating Critique Sessions

When the user is running a live critique (not just receiving one), coach both sides:

- **Presenting**: open with three sentences — the goal of the design, its stage, and the feedback wanted ("This is a mid-fi checkout flow; I want reactions to the step order, not the visuals"). This scopes the room and prevents wasted feedback on things already decided.
- **Receiving**: do not defend or explain intent when a finding lands — if the reviewer misread the design, real users will too, and that misreading is data. Ask clarifying questions only ("Where did you expect that button to be?"), take notes, decide later.
- **Reviewing**: critique the work against its stated goals, not against the design you would have made.

## Common Mistakes

1. **Opinion dressed as critique** — "I don't like the blue." Fix: force the four-part frame; if no principle and consequence can be named, drop it.
2. **Skipping the first impression** — diving into details means you never experience the screen the way a new user does. Fix: record the 5-second answers first, every time, even when the product seems obvious.
3. **Everything is severity 3** — an unranked wall of findings gives the team no starting point. Fix: score with impact × frequency × persistence; be willing to mark things 0 and 1.
4. **The 40-item report** — beyond 8–10 findings, readers stop acting and start skimming; the catastrophic finding gets equal shelf space with a padding nitpick. Fix: cap at the top 8–10, merge by root cause, one-line appendix for the rest.
5. **Mixing craft and usability** — "misaligned cards" next to "no undo on delete" makes the report read as nitpicking and the severe finding lose urgency. Fix: separate sweeps, separate report sections.
6. **Redesigning instead of critiquing** — prescribing a full alternative layout hijacks the designer's job and usually overfits to one reviewer's taste. Fix: give direction ("consolidate the 3 CTAs into 1 primary + 1 text link"), not deliverables.
7. **Skipping what works** — praise is information, not politeness: it tells the team what to preserve through the redesign. Without it, fixes routinely break the good parts. Fix: open with 2–3 strengths and *why* they work, grounded in the same principles as the findings.
8. **Critiquing concept work for polish** — flagging spacing on a whiteboard sketch wastes everyone's time and erodes trust in the review. Fix: match the pass to the stage declared in Before Starting.

## Output Format

Deliver the critique as:

1. **Context line** — artifact, audience, stage, feedback requested (and any assumptions made).
2. **First impression** — verbatim answers to what is this / who's it for / what do I do next, and whether they match the product's intent.
3. **What works** — 2–3 strengths with the principle behind each, so they survive the fixes.
4. **Findings** — top 8–10 maximum, ordered by severity (4 → 1). Each finding:
   - `[Severity N] Short title`
   - Observation → Principle → Consequence → Direction (one to two sentences each)
   - Screen/step where it occurs
   Usability findings first, then a separate **Craft** subsection with the same format.
5. **Ruled out** — anything examined and scored 0, with one line on why (prevents re-litigating).
6. **Next step** — the single highest-leverage fix and what to re-test after making it.

Sample finding, rendered:

> **[Severity 3] Destructive action has no confirmation or undo**
> Observation: "Delete project" in the card overflow menu executes immediately; the card animates out with no confirm dialog, toast, or undo affordance.
> Principle: Error prevention (#5) and user control and freedom (#3).
> Consequence: One mistap in a menu of 5 adjacent items permanently destroys user work — high impact, and persistence is total because the loss is irreversible.
> Direction: Add an undo toast (preferred — keeps the flow fast) or a confirm dialog that names the project being deleted.
> Where: Projects list → card overflow menu.

Calibrate depth to the request. A quick "does this look right?" on one screen gets the first impression, the top 3–4 findings, and the next step — not the full six-section report. A formal usability audit of a multi-screen flow gets everything. When the artifact is a static screenshot, mark walkthrough findings as inferred ("cannot verify the error state from a screenshot") rather than asserting behavior you cannot see.

Keep the full report under roughly 1,000 words. If the user asked for a "roast," keep the same rigor and structure — sharpen the tone, never the substance.
