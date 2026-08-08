---
name: forms-ux
description: "When the user wants to design or fix a form so more people complete it — validation timing, error messages, field layout, multi-step flows, input masking, and checkout. Triggers: \"form design\", \"form validation\", \"error messages\", \"multi-step form\", \"checkout\", \"input masking\", \"users abandon the form\", \"form UX\". Covers the field-level mechanics of forms: when to validate, how to word and place errors, field and label layout, mobile keyboard pairing, field-count reduction, step chunking, masking, and checkout-specific patterns. For the signup flow strategy around the form, see signup. For interaction feedback timing, see micro-interactions. For WCAG-level form accessibility, see accessibility."
metadata:
  version: 1.0.0
---

# Forms UX

Act as a forms specialist who has watched hundreds of session recordings of people abandoning checkouts and signups over fixable field-level mistakes. The outcome of this skill is a concrete form spec — validation timing, error copy, field order, keyboard pairings, and step structure — that measurably reduces abandonment, not a vague list of "best practices."

## Before Starting

Ask these before touching the form. Skip any the user has already answered.

1. **Purpose and stakes** — What does this form do (signup, checkout, lead capture, settings)? What happens on success, and what does one completed form earn the business?
2. **Field inventory** — List every field as it exists today, in order, with required/optional status. Which fields feed a real downstream process, and which exist because "marketing wanted it"?
3. **Abandonment data** — Do you have completion rate, per-field drop-off, or error-rate analytics? If yes, which field or step loses the most people? If no, plan instrumentation as part of the fix.
4. **Context of use** — Mobile share of traffic? Are users typing on a phone keyboard, and are they logged in (so you can prefill)?

## Validation Timing

Timing is the single most common validation mistake. The rule set:

| Event | Validate? | What to check | Why |
|---|---|---|---|
| First keystroke | Never | Nothing | Flagging "invalid email" while someone has typed `jo` punishes users mid-typing; they haven't finished, so the input can't be wrong yet |
| On blur (leaving field) | Yes | Format errors: email shape, card length, required-but-empty | The user has signaled "I'm done with this field," so feedback is timely, not premature |
| Per keystroke, after a field has errored | Yes | Re-check the same rule that failed | Reward-early/punish-late: once a field is in an error state, clear the error the instant the fix lands — making the red vanish as they type is the reward |
| On submit | Yes | Cross-field rules: passwords match, end date after start date, card + billing consistency | Cross-field rules need both fields final; checking earlier fires false alarms |

The reward-early/punish-late pattern in one sentence: fields start in a lenient mode (validate on blur only), and switch to per-keystroke validation only after they have errored — so mistakes are pointed out late and fixes are confirmed instantly.

**Validate permissively.** Most self-inflicted validation errors come from rejecting valid input, not accepting invalid input:

| Field | Do check | Do not reject |
|---|---|---|
| Email | Presence of `@` and a domain dot | `+` aliases (`sam+shop@`), long TLDs (`.museum`), subdomains |
| Name | Non-empty | Unicode (José, 李), apostrophes (O'Brien), hyphens, single-word names, "too short" names |
| Phone | Digit count after normalizing | Spaces, dashes, parentheses, leading `+` — strip, then count |
| Card number | Luhn checksum + length by card type | Spaces or dashes in pasted input — strip first |
| ZIP/postal | Country-appropriate pattern | Letters, when the country field says UK/Canada/NL |
| Free text | Length limits with a visible counter | Emoji, newlines, "suspicious" characters (unless a real injection risk, which is the backend's job anyway) |

Always trim leading/trailing whitespace before validating — a trailing space from mobile autocorrect should never fail an email field.

## Error Messages

1. **Say what's wrong and how to fix it.** "Password needs 8+ characters" — not "Invalid password." An error the user can't act on is just an insult.
2. **Place the message adjacent to the field** (directly below it), not in a banner at the top of the page where it loses its referent.
3. **Icon + color + text, never color alone.** Roughly 8% of men have red-green color deficiency; a red border with no icon or message is invisible to them.
4. **Keep the user's input.** Never wipe the form or the field on error — retyping a 16-digit card number because of a typo in the expiry field is a rage-quit moment.
5. **On submit-fail:** scroll to and focus the first errored field, and show a summary ("3 fields need attention") so users on long forms know the total scope of the fix.
6. **Keep the submit button enabled.** A disabled submit hides *why* the form won't go through; an enabled one that triggers validation shows every error at once, with the focus-first behavior above.

Rewrite generic error copy using the wrong/fix rule:

| Generic (verdict only) | Actionable (wrong + fix) |
|---|---|
| Invalid password | Password needs 8+ characters |
| Invalid email | Email is missing an @ — check for typos |
| Invalid date | End date must be after start date (Mar 3) |
| Invalid card | Card number should be 16 digits — this one has 15 |
| Field required | Enter your shipping ZIP so we can calculate delivery |
| Username taken | "sam" is taken — try sam-chen or sam2026 |

The pattern: name the specific rule that failed, then hand the user the shortest path to satisfying it. Suggest values when the system can compute them (usernames, dates).

## Field Design

| Decision | Choose | Reason |
|---|---|---|
| Column layout | Single column | Eye-tracking shows multi-column forms cause z-pattern scanning errors — users skip fields or fill them out of order |
| Label position | Above the field | Placeholder-as-label vanishes on focus; users mid-form can't recall what a filled field was asking |
| Required markers | Mark **optional** fields when most are required | Marking every required field with an asterisk is noise; the exceptions are the useful signal |
| Field width | Match expected content | A 2-digit CVC in a full-width input gives no affordance about expected length |

**Mobile keyboard pairing** — every field should summon the right keyboard:

| Field | `type` | `inputmode` |
|---|---|---|
| Email | `email` | (implied) |
| Phone | `tel` | (implied) |
| Card number, OTP, ZIP (US) | `text` | `numeric` |
| Price, quantity with decimals | `text` | `decimal` |
| URL | `url` | (implied) |

Use `type="text"` + `inputmode="numeric"` for card numbers rather than `type="number"`, which strips leading zeros and adds spinner arrows.

**Choosing the right control** — the deciding variables are option count and whether options need comparing:

| Options | Control | Why |
|---|---|---|
| 2, mutually exclusive, instant effect | Toggle/switch | Reads as a state, applies immediately (settings) |
| 2–5, need comparison before choosing | Radio buttons or segmented control | All options visible at once; no hidden choices behind a click |
| 6–15 | Select dropdown | Radios at this count dominate the page |
| 15+, user knows the answer | Autocomplete/combobox | Typing "Uni" beats scrolling to "United States" — but note browsers autofill country from `autocomplete="country-name"` anyway |
| Multiple selections | Checkboxes | Never a multi-select listbox; ctrl-click is undiscoverable |
| Date the user knows (birthday) | Separate text/numeric fields | A calendar picker forces ~12 taps to reach 1987; typing takes 8 keystrokes |
| Date the user is choosing (booking) | Calendar picker | The calendar context (weekends, availability) informs the choice |

**Mobile specifics** — small screens amplify every field-level mistake:

- Set input font-size to 16px or larger; below that, iOS Safari auto-zooms on focus and users lose their place in the form.
- Touch targets (inputs, radios, checkboxes plus their labels) need ~44px height; make the whole label row tappable, not just the 16px control.
- Use `enterkeyhint` (`next` on mid-form fields, `done`/`send` on the last) so the keyboard's action key advances the form instead of dismissing itself.
- Keep the focused field visible above the keyboard — scroll it into view on focus; a field hidden behind the keyboard reads as a frozen form.

## Length and Friction

Every field costs completion — each one is a small tax the user pays before your product delivers anything. For every field in the inventory, ask: what breaks if we delete it, defer it to later, or infer it?

- **Delete:** fields nobody downstream reads ("How did you hear about us?" on checkout).
- **Defer:** profile enrichment can wait until after the first success moment.
- **Infer:** country from IP, city/state from postal code, card type from the card number's first digits.
- **Smart defaults:** preselect the most common option (country, shipping method) so most users confirm rather than choose.
- **Autofill:** correct `autocomplete` attributes let the browser fill identity, address, and payment fields in one tap. Challenge every field against the pairings in `references/autocomplete-attributes.md` — a form that autofills in 2 seconds cannot be abandoned over length.

## Multi-Step Forms

Above roughly 8–10 fields, a chunked multi-step form beats one long page: each step feels finishable, and progress already made creates commitment. Rules:

1. **Chunk by topic, 3–7 fields per step** — "Shipping", "Payment", "Review", never an arbitrary split mid-topic.
2. **Show a progress indicator** with labeled steps, so users can price the remaining effort before investing.
3. **Back must preserve data.** Losing entered data on back-navigation is the fastest way to lose the user with it.
4. **Order steps easy-to-hard.** Start with low-friction fields (name, email); ask for payment last, after sunk effort is on your side.
5. **End with a review step** before final submit — it catches errors that per-field validation can't (wrong shipping address chosen, wrong quantity) and builds confidence before an irreversible action. Every review item links back to its step for editing, and editing returns the user to review, not to step 1.
6. **Validate per step, not at the end.** Each "Continue" runs that step's blur and cross-field rules; discovering a step-1 error at step 4 forces backtracking through preserved-but-annoying navigation.
7. **Save partial progress for long forms** (insurance, applications). An emailed resume link or session persistence converts "I'll finish later" from a euphemism for abandonment into an actual return visit.

## Input Masking

- **Format as they type** for phone numbers and card numbers (`4242 4242 4242 4242` reads; `4242424242424242` doesn't). Caveat: naive masking breaks caret position when users edit mid-string — use a library that handles caret restoration, or format on blur instead.
- **Accept paste in any format and normalize.** Users paste `+1 (555) 123-4567` or card numbers with dashes from a password manager. Strip spaces, dashes, and parentheses before validating — rejecting valid data over cosmetic formatting is a self-inflicted error rate.
- **Never mask dates ambiguously.** `01/02/2026` means different things in different locales; use separate fields or an explicit `MM/DD/YYYY` hint.

## Checkout Specifics

1. **Guest checkout first.** Forced account creation is one of the top documented abandonment causes — roughly 25% of abandoning users cite it. Offer account creation *after* the order confirms, when the data is already entered.
2. **Express-pay buttons at the top** (Apple Pay, Google Pay, PayPal, Shop Pay) — they skip the entire form for a large share of mobile users. Fall through to the card form below.
3. **Card fields with `autocomplete="cc-number"`, `cc-exp`, `cc-csc`** (full list in `references/autocomplete-attributes.md`) so saved cards fill in one tap.
4. **Address autocomplete** (Google Places or equivalent): one field replaces five, and typo-driven delivery failures drop with it.
5. **Trust signals adjacent to the pay button** — lock icon, "Secured by Stripe", return policy link. Anxiety peaks at the moment of payment; reassurance belongs at that exact spot, not in the footer.

## Inline Help

- **Helper text under the label** for rules the user needs *before* typing: password requirements, username constraints, "We'll only call about your order." Showing the rule upfront prevents the error instead of explaining it afterward.
- **Tooltip (icon-triggered) only for edge cases** most users don't need: "What's a CVC?", tax-ID formats. Hiding must-know rules behind a tooltip guarantees errors; surfacing edge-case text inline guarantees clutter.
- **Explain why you're asking** whenever a field feels intrusive. "Phone number" alone triggers "so sales can call me?" suspicion; "Phone number — for delivery updates only" defuses it. Unexplained sensitive fields (phone, birthday, gender) are quiet abandonment drivers.
- **Password fields get a show-password toggle** and live requirement checkmarks (8+ characters ✓, one number ✗) that update as the user types — requirements are the one place where per-keystroke feedback helps before any error, because it's progress feedback, not judgment.

## Workflow

1. **Inventory** every field (from Before Starting): order, required status, downstream consumer, current validation behavior.
2. **Cut and defer** using the delete/defer/infer test. Target the smallest field set that completes the transaction.
3. **Structure:** single page if the surviving set is under ~8 fields; otherwise chunk into topic steps of 3–7 with progress, preserved back-navigation, and a review step.
4. **Spec each field:** label text (above field), `type` + `inputmode`, `autocomplete` value from the reference, width, helper text if the rule is must-know, mask behavior including paste normalization.
5. **Spec validation:** blur-triggered format rules per field, submit-triggered cross-field rules, reward-early/punish-late switching, and error copy that states the fix.
6. **Spec failure handling:** adjacent error placement with icon + color + text, input preservation, submit-fail focus-first-error plus count summary.
7. **For checkout:** add guest path, express-pay placement, cc-* autofill, address autocomplete, trust signals at the pay button.
8. **Instrument:** per-field drop-off and error-rate events, so the next iteration argues from data instead of taste.

## Common Mistakes

1. **Validating on first keystroke.** The form yells "invalid email" at `jo`. Fix: validate on blur; go per-keystroke only after the field has errored, so fixes clear instantly.
2. **Placeholder as label.** The label disappears the moment the user focuses the field, and filled forms become unreviewable. Fix: persistent label above the field; use placeholder only for format examples.
3. **"Invalid input" error copy.** States a verdict, not a fix. Fix: name the rule that failed and the action that satisfies it — "Password needs 8+ characters."
4. **Wiping input on error or on back-navigation.** Users forced to retype abandon instead. Fix: preserve all entered data through every error, refresh-safe where feasible, and across step navigation.
5. **Rejecting pasted data over formatting.** A card number with spaces from a password manager fails validation. Fix: normalize (strip spaces/dashes) before validating.
6. **Marking required fields when nearly all are required.** Asterisk noise everywhere. Fix: flip it — mark the optional fields "(optional)".
7. **Forcing account creation before checkout.** ~25% of abandoners cite it. Fix: guest checkout first, account offer after order confirmation.
8. **Missing `autocomplete`/`inputmode` attributes.** Mobile users hand-type an email on a full QWERTY keyboard and re-enter an address the browser already knows. Fix: pair every field per `references/autocomplete-attributes.md`.

## Output Format

Deliver the form spec as:

1. **Field table** — one row per field: label, `type`, `inputmode`, `autocomplete`, required/optional, helper text, mask/normalization rule.
2. **Validation table** — one row per rule: trigger (blur / post-error keystroke / submit), condition, exact error copy.
3. **Structure note** — single-page or step map (step name, fields, 3–7 per step), progress indicator, review-step contents.
4. **Cut list** — every field removed, deferred, or inferred, with the one-line justification for each.
5. **Instrumentation list** — the drop-off and error-rate events to add.

Keep error copy verbatim in the spec — it is implementation-ready text, not a description of text.

Example field-table rows, to set the expected level of detail:

| Label | type | inputmode | autocomplete | Req | Helper text | Mask/normalize |
|---|---|---|---|---|---|---|
| Email | email | — | email | Yes | — | Trim whitespace |
| Card number | text | numeric | cc-number | Yes | — | Group as 4-4-4-4 while typing; strip spaces/dashes on paste |
| Apartment, suite | text | — | address-line2 | (optional) | — | — |

Example validation-table rows:

| Trigger | Condition | Error copy (verbatim) |
|---|---|---|
| Blur | Email lacks `@` or domain | Email is missing an @ — check for typos |
| Post-error keystroke | Same rule, re-checked | (clear error the moment it passes) |
| Submit | Passwords do not match | These passwords don't match — re-enter the second one |
