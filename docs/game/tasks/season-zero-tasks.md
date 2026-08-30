# Season Zero — Twenty-Two Tasks

**Level 0 deliverable.** Twenty-two real dares, not templates. Each carries its tier,
its clock, the brief a player actually reads, and machine-readable criteria.

**Status: unvalidated.** These have been written and run against the exclusion
list (§11 part II). They have *not* been shown to anyone. The Level 0 gate is
twelve of twenty-two getting a majority "yes, I'd do that" from ten people in the
target audience. Do that before Level 1 starts.

## The space these have to live in

The exclusion list removes almost everything Nerve did: no trespass, traffic,
heights, water, fire, substances, confrontation, nudity, touching, minors,
deception, disruption, animals, stunts, spending. What is left is narrower than
it first looks, and better:

**Craft · observation · social nerve · performance · style · persuasion.**

Every task below is one of those six, set in Tbilisi and in the clothes. The
brand voice applies to the briefs — concise, declarative, no exclamation marks.

## Criteria schema

Each task's `criteria` is the array Level 7's verifier consumes. Worked example:

```json
{
  "id": "t09-borrowed",
  "tier": 2,
  "clock_minutes": 20,
  "criteria": [
    { "id": "c1", "modality": "interaction", "required": true,
      "assert": "A second adult person verbally agrees to wear the player's jacket." },
    { "id": "c2", "modality": "temporal", "required": true,
      "assert": "That person wears the jacket continuously for at least 30 seconds." },
    { "id": "c3", "modality": "liveness", "required": true,
      "assert": "The server's challenge word appears at its timestamp." }
  ],
  "guards": ["adults_only", "no_contact", "outerwear_only"]
}
```

`guards` are enforced in the brief's wording *and* checked by the safety
classifier. They are the difference between a task that reads fine and a task
that is fine.

---

# Tier 1 — Qualifier

**Day 1 · 5,000 players · 15 minutes · photo or ≤60s clip · not live**

Provable from stills. Anyone can attempt one. The prize is the cut, not the
coins.

### 01 · Heavy
> Wear every black item you own. All of it, at once. One photo, standing, head
> to feet.

- `visual` — one person wearing an unusually large number of layers
- `visual` — the clothing is predominantly black
- `visual` — full body in frame

*Craft. Indoors, no risk, and it photographs like an editorial. The right first
task in the whole game: funny, harmless, and it makes people look at what they
own.*

### 02 · The Asterisk
> Find an asterisk in the wild. Not on a screen. Not on paper you brought.
> Somewhere it already was.

- `visual` — a six-armed radial form present in the environment
- `scene` — a public place, not a device display

*Observation. Ties the brand mark to the city and teaches people to look up.*

### 03 · Nine
> Nine things in one room that are exactly the same colour. Arrange them. Shoot
> from above.

- `visual` — at least nine distinct objects
- `visual` — consistent hue across all of them
- `visual` — overhead framing

*Observation and composition. Entirely indoors, which matters — a qualifier
5,000 people attempt should not require anyone to go anywhere.*

### 04 · Straight Face
> Stand still in a busy public place for sixty seconds. Camera on you. Do not
> smile. Do not explain yourself to anyone who asks.

- `temporal` — stationary and framed for 60 continuous seconds
- `scene` — other people visible in frame
- `liveness` — challenge word appears

**Guards:** `no_obstruction` — the brief says *stand out of the way, not in a
doorway, not inside a shop*. `no_disruption`.

*Social nerve with zero interaction. The purest test of whether someone can
tolerate being looked at, which is the actual skill the rest of the game needs.*

### 05 · Inside Out
> One item, worn inside out, in public, for the whole clock. Prove it at the
> start and prove it at the end.

- `visual` — a garment worn inverted with seams or labels showing, at t=0
- `visual` — the same garment still inverted at t=end
- `scene` — public

*Mild, sustained embarrassment. Deliberately requires no purchase — an earlier
draft asked for a receipt and hit the no-spending exclusion.*

### 06 · Texture
> Five textures, five photos, within a hundred metres of where you are standing.
> No faces. No text.

- `visual` — five distinct surface textures
- `visual` — no legible text or identifiable faces

*Observation. Trains framing, produces genuinely usable brand imagery, and the
no-faces rule doubles as bystander protection.*

### 07 · The Fit
> Build a complete outfit from things that are not clothes. Fifteen minutes.
> Wear it.

- `visual` — the player wearing constructed non-garment items
- `visual` — coverage reading as a full outfit

**Guards:** `no_hazard` — nothing sharp, hot, or heavy.

*Craft, and the funniest task in tier 1. Indoors, resourceful, extremely
shareable.*

### 08 · Same Frame
> Get a stranger into a photo with you. They have to say yes. If they say no,
> ask someone else.

- `interaction` — a second adult person is asked and audibly agrees
- `visual` — two people in frame

**Guards:** `adults_only`, `no_contact`, `consent_on_record`.

*The bridge into tier 2. Consent is not a footnote here — it is the criterion,
and a refusal that leads to asking someone else is a pass, not a failure.*

---

# Tier 2 — Nerve

**Day 2 · 1,000 players · 20 minutes · live · four waves**

Requires a stranger, a place, or being visibly seen. This is the real filter.

### 09 · Borrowed
> Convince a stranger to wear your jacket for thirty seconds. They have to want
> to. Hand it over — do not put it on them.

- `interaction` — a second adult agrees on camera
- `temporal` — worn by them for 30 continuous seconds
- `liveness`

**Guards:** `adults_only`, `no_contact`, `outerwear_only`.

*Warm, funny, and the product is literally the subject. The best sponsored-task
shape in the set.*

### 10 · The Interview
> One question, three strangers: what is the heaviest thing you own? Three
> answers, on camera.

- `interaction` — three distinct adults respond
- `audio` — the question is audible each time
- `audio` — three distinct answers

**Guards:** `adults_only`, `consent_on_record`.

*The answers will be better than anything you could script. This is a content
factory disguised as a dare.*

### 11 · Colour
> The server picks a colour. Photograph five strangers wearing it. Each one says
> yes first.

- `visual` — five people, each wearing the assigned hue
- `interaction` — five separate consents on record
- `liveness` — the colour is issued by the server mid-attempt

**Guards:** `adults_only`, `no_contact`.

*The server-issued colour is doubling as the liveness challenge — the anti-cheat
and the task are the same mechanism.*

### 12 · Duet
> Eight seconds of any song, with a stranger. Their choice of song.

- `interaction` — a second adult agrees and participates
- `audio` — two voices for at least 8 continuous seconds

**Guards:** `adults_only`, `no_contact`.

*High nerve, entirely warm, and nobody who completes it will stop talking about
it.*

### 13 · Mirror
> Find a reflective surface in public. Photograph yourself in it with no camera
> visible in the shot.

- `visual` — the player's reflection
- `visual` — no camera or phone visible in frame
- `scene` — public

*A genuine technical puzzle and the only tier-2 task needing no stranger — which
matters, because one route through the day should not require social nerve.*

### 14 · Twenty Doors
> Twenty different doors in twenty minutes. All on foot, all within walking
> distance, no repeats.

- `visual` — twenty distinct doorways across the attempt
- `temporal` — one continuous attempt, no gap in the proof track
- `scene` — street level, publicly accessible

**Guards:** `no_traffic`, `public_access_only` — the brief says *doors you can
stand in front of from the pavement. Do not go in.*

*Solo. Physically demanding without being risky, and the finished set of twenty
frames is a genuinely good grid. A second route through day two for players who
will not approach a stranger.*

### 15 · The Long Shadow
> Your own shadow, cast on five different surfaces. Wall, pavement, glass,
> fabric, and something growing.

- `visual` — the player's shadow identifiable in five frames
- `visual` — five materially different surface types
- `liveness` — challenge word appears

*Solo, and harder than it sounds — you have to read the light. Craft rather than
nerve, and it needs nothing but a sunny afternoon and patience.*

### 16 · The Swap
> Trade something you are wearing for something a stranger is wearing. Both of
> you have to be happy about it. Wear theirs for the rest of the clock.

- `interaction` — mutual consent on record
- `visual` — the player wearing a different item at t=end than t=0
- `temporal` — worn for the remainder

**Guards:** `adults_only`, `no_contact`, `outerwear_only` — hats, jackets,
scarves. The brief names them explicitly.

*The strongest task in the set. High nerve, entirely consensual, produces a
story and a photograph. Note the guard doing real work: without
`outerwear_only` this task is a problem.*

### 17 · Landmark
> [SLOT: named public place]. Get there. One clean frame of [SLOT: specific
> detail]. The clock does not care about traffic — neither should you.

- `scene` — location matches the assignment
- `visual` — the named detail present and legible

**Guards:** `no_traffic` — the brief says it in the player's own words, which is
the point. `public_access_only`.

*The template that scales: two slots, one approved shape, thousands of unique
instances. The traffic line is not decoration — it is the exclusion list written
where the player will actually read it.*

### 18 · Read It Back
> Find public text — a sign, a plaque, something painted on a wall. Get a
> stranger to read it aloud.

- `visual` — public text legible in frame
- `interaction` — a second adult reads it
- `audio` — spoken words match the visible text

**Guards:** `adults_only`, `consent_on_record`.

*Cross-modal by design — the visual and audio criteria have to agree with each
other, which makes it near-impossible to fake and a good early test of the
verifier.*

---

# Tier 3 — Final

**Day 3 · top 100 · 25 minutes · live · one wave**

Hard, specific, and shot to be shared. These are the ones that get filmed.

### 19 · The Line
> Ten strangers. The same three words. [SLOT: the season's phrase]. One after
> another, on camera.

- `interaction` — ten distinct adults, each consenting
- `audio` — the phrase matched ten times
- `liveness`

**Guards:** `adults_only`, `no_contact`, `consent_on_record`.

*The finale. Brutally hard, entirely safe, and the finished clip is the single
best piece of marketing the season will produce. If you only keep one task from
this document, keep this one.*

### 20 · Dressed By Strangers
> Everything you are wearing at the end was chosen by someone else. Ask people
> what to put on. Twenty-five minutes.

- `interaction` — multiple adults give direction on record
- `visual` — the outfit at t=end differs substantially from t=0

**Guards:** `adults_only`, `no_contact`, `outerwear_only`, `own_wardrobe` — the
player carries the options; strangers choose between them.

*Ambitious and funny. The `own_wardrobe` guard is what keeps it from becoming a
begging task.*

### 21 · The Chain
> Get someone to introduce you to someone they know. Then get that person to do
> it again. Three links, on camera.

- `interaction` — three sequential introductions, each consenting
- `audio` — each handoff audible

**Guards:** `adults_only`, `consent_on_record`.

*The hardest social task here and the most interesting to watch. Success is
genuinely uncertain, which is exactly what a final needs.*

### 22 · One Take
> Twenty-five minutes. One continuous shot. No cuts. Tell the story of one
> street.

- `temporal` — no scene discontinuity across the full clock
- `visual` — a single identifiable street throughout

*Craft rather than nerve, and the only task judged partly on whether it is any
good. Every final should not be the same kind of hard.*

---

# Exclusion-list pass

Running §11 part II over all twenty-two caught four real problems. Recording them
because the same mistakes will recur in generated tasks, and these are the
first entries in the adversarial corpus:

| Task | Caught | Fix |
|---|---|---|
| 05 · Inside Out | Original required buying something → **no spending** | Rewrote to a sustained-wear task with no purchase |
| 09 · Borrowed, 16 · The Swap | Handing over a garment implied **contact with a stranger** | `no_contact` guard, and the brief says "hand it over — do not put it on them" |
| 16 · Swap, 20 · Dressed By Strangers | Unbounded clothing exchange could reach **nudity** | `outerwear_only`, with the permitted items named in the brief |
| 04 · Straight Face | Standing in a busy place could **disrupt a business or a doorway** | `no_obstruction`, stated in the player's own instructions |

Every stranger-facing task carries `adults_only` — **no filming identifiable
minors** is the guard most likely to be violated accidentally, and it is the one
the safety classifier should weight hardest.

# What this set is missing

Honest gaps, for the next pass:

- **Three tier-2 tasks now need no stranger** — 13, 14 and 15, added after this
  gaps pass. Day two no longer forces every player through social nerve, which
  was the single largest dropout risk in the set.
- **STIFF-garment variants now exist** for 01, 05, 09 and 16 — see below. This
  is the strongest link between the game and revenue (§18) and it was missing
  from the first draft.
- **Georgian-language audio is untested.** Tasks 10, 12, 18, 19 and 21 all
  depend on transcription. If Georgian ASR is weak, five of twenty-two tasks break
  — test this before Level 7, not during it.
- **No sponsored shapes yet.** 09, 11 and 17 are the natural carriers.

# STIFF-garment variants

The link between the game and the shop (§18) is a task you cannot complete
without owning a piece. Four of the tasks above take a `[SLOT: garment]` variant
at no design cost. Staff choose per round whether to publish the open or the
garment form — the garment form is also what a sponsored task looks like.

| Base | Variant brief | Added criterion |
|---|---|---|
| 01 · Heavy | "Wear every black item you own, with your [SLOT: garment] on the outside." | `visual` — the named piece is the outermost layer |
| 05 · Inside Out | "Your [SLOT: garment], inside out, in public, for the whole clock." | `visual` — the named piece, inverted, label visible |
| 09 · Borrowed | "Convince a stranger to wear your [SLOT: garment] for thirty seconds." | `visual` — the named piece worn by the second person |
| 16 · The Swap | "Trade your [SLOT: garment] for something a stranger is wearing." | `visual` — the named piece leaves the player, theirs arrives |

**Do not make every task a garment task.** A qualifier that 5,000 people attempt
must be completable by someone who has never bought anything — that is the free
path §06 depends on, and it is also how the game acquires customers rather than
only rewarding the ones it already has. One garment task per round is the right ratio.

# Next

1. Show all twenty-two to ten people. One question: *would you actually do this?*
2. Score them. **Gate: twelve or more get a majority yes.**
3. Rewrite or cut whatever fails, then start Level 1.
