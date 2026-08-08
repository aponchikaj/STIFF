---
name: accessibility
description: "When the user wants to audit, remediate, or build web interfaces that meet WCAG 2.2 AA. Triggers: accessibility, a11y, WCAG, screen reader, ARIA, keyboard navigation, focus trap, is my site accessible, contrast. Covers a POUR-organized WCAG 2.2 AA checklist with the five highest-frequency failures flagged, semantic-HTML-first guidance, ARIA anti-patterns, keyboard and screen-reader testing patterns, WCAG 2.2 additions, a manual-first audit workflow with a bundled static scanner, and severity triage. For accessible form patterns specifically, see forms-ux. For color-token contrast engineering, see color-systems. For overall UX evaluation, see design-critique."
metadata:
  version: 1.0.0
---

# Accessibility (WCAG 2.2 AA)

Act as a senior accessibility engineer who has run conformance audits and remediation programs for production web apps. The outcome: a prioritized, WCAG-2.2-AA-mapped set of findings and fixes that removes real barriers for keyboard, screen-reader, low-vision, and motor-impaired users — not a green badge from an automated scanner. Automated tools catch only ~30–40% of WCAG failures, so this skill drives manual passes first and uses tooling last.

## Before Starting

Ask these before auditing or building. Skip any the user already answered.

1. **Compliance target and driver.** WCAG 2.2 AA (default), 2.1 AA, or Section 508? Is there a legal driver — ADA demand letter, European Accessibility Act (enforced since June 2025), public-sector procurement — and a deadline?
2. **Stack.** Framework (React/Vue/plain HTML), component library or design system, SSR or SPA? SPAs need route-change announcements and focus management that static sites get free.
3. **Known issues and critical flows.** Prior audit findings? User complaints? Which 2–3 flows matter most (checkout, signup, search)? Audit those first — severity is impact × traffic.
4. **Testing capacity.** Does the team have access to a Mac (VoiceOver) or Windows (NVDA)? Any real assistive-technology users available for validation?

## The Five Failures That Dominate Real Sites

WebAIM Million-style scans of the top 1,000,000 home pages find the same handful of failures on 80%+ of pages, year after year. Fix these five first — they are roughly 80% of real-world barriers.

| # | Failure | WCAG SC | Requirement | 10-second test |
|---|---------|---------|-------------|----------------|
| 1 | Low contrast text | 1.4.3, 1.4.11 | 4.5:1 body text; 3:1 for large text (≥24px or ≥18.7px bold) and UI components/graphics | DevTools color picker shows the ratio |
| 2 | Missing alt text | 1.1.1 | Every `<img>` has `alt`; decorative images get `alt=""` | `document.querySelectorAll('img:not([alt])')` |
| 3 | Unlabeled inputs | 1.3.1, 4.1.2 | Every input has a `<label for>`, wrapping label, or `aria-label` | Click the label text — does the input focus? |
| 4 | Keyboard-unreachable controls | 2.1.1 | Every action doable with Tab/Enter/Space/arrows | Unplug the mouse, try the core flow |
| 5 | Invisible focus | 2.4.7 | Focused element has a visible indicator at ≥3:1 contrast | Tab through — can you always see where you are? |

## WCAG 2.2 AA Checklist by POUR

★ marks the high-frequency failures above. Use this as the audit backbone; cite SC numbers in findings.

### Perceivable

| SC | Requirement | Notes |
|----|-------------|-------|
| 1.1.1 ★ | Non-text content has text alternatives | `alt` describes function, not appearance; decorative → `alt=""` |
| 1.2.2 / 1.2.5 | Captions and audio description for video | Auto-captions need human correction |
| 1.3.1 ★ | Info and relationships are programmatic | Headings, lists, tables, labels in markup — not just visual styling |
| 1.3.4 | No orientation lock | Works portrait and landscape |
| 1.3.5 | Input purpose identified | `autocomplete` on name/email/address fields |
| 1.4.3 ★ | Text contrast 4.5:1 (3:1 large) | Placeholder text counts; disabled controls exempt |
| 1.4.4 | Text resizes to 200% without loss | Use rem/em; test browser zoom |
| 1.4.10 | Reflow at 320px width | No two-dimensional scrolling at 400% zoom |
| 1.4.11 ★ | Non-text contrast 3:1 | Input borders, focus rings, icons, chart marks |
| 1.4.12 | Text spacing overridable | Layout survives user line-height/letter-spacing overrides |
| 1.4.13 | Hover/focus content dismissible, hoverable, persistent | Tooltips must not vanish when pointer moves onto them |

### Operable

| SC | Requirement | Notes |
|----|-------------|-------|
| 2.1.1 ★ | Full keyboard operability | Includes custom widgets, date pickers, drag handles |
| 2.1.2 | No keyboard trap | Except intentional modal traps with Escape |
| 2.1.4 | Single-key shortcuts remappable/disableable | Or active only on focus |
| 2.2.1 / 2.2.2 | Timeouts adjustable; moving content pausable | Carousels need pause controls |
| 2.3.1 | No content flashing >3 times/second | Seizure risk |
| 2.4.1 | Skip link / bypass blocks | First focusable element |
| 2.4.2 / 2.4.6 | Page titles and headings descriptive | Unique `<title>` per route in SPAs |
| 2.4.3 | Focus order preserves meaning | Tab order follows DOM order — fix the DOM, not `tabindex` |
| 2.4.4 | Link purpose clear from text | No bare "click here" / "read more" |
| 2.4.7 ★ | Focus visible | ≥3:1 indicator; never `outline: none` without a replacement |
| 2.4.11 | Focus not obscured (new in 2.2) | Sticky headers/footers must not cover the focused element |
| 2.5.1 / 2.5.7 | Pointer-gesture and dragging alternatives (2.5.7 new in 2.2) | Every drag has a click/tap alternative |
| 2.5.3 | Accessible name contains visible label | Voice-control users say what they see |
| 2.5.8 | Target size ≥24×24 CSS px (new in 2.2) | Or sufficient spacing; inline links exempt |

### Understandable

| SC | Requirement | Notes |
|----|-------------|-------|
| 3.1.1 / 3.1.2 | Page `lang` set; language changes marked | `<html lang="en">` — screen readers pick pronunciation from it |
| 3.2.1 / 3.2.2 | No context change on focus or input | Don't submit on select-change |
| 3.2.3 / 3.2.4 | Consistent navigation and identification | Same nav order, same icon meanings across pages |
| 3.2.6 | Consistent help (new in 2.2) | Help mechanism in the same place on every page |
| 3.3.1 / 3.3.3 | Errors identified in text with suggestions | Color alone is not an error indicator |
| 3.3.2 ★ | Labels/instructions for inputs | Placeholder is not a label — it vanishes on input |
| 3.3.7 | Redundant entry avoided (new in 2.2) | Don't ask for the same info twice in one flow |
| 3.3.8 | Accessible authentication (new in 2.2) | No cognitive-test-only auth: allow paste, password managers, no transcription puzzles |

### Robust

| SC | Requirement | Notes |
|----|-------------|-------|
| 4.1.2 ★ | Name, role, value for all UI components | Custom widgets need correct roles, states, accessible names |
| 4.1.3 | Status messages announced | `aria-live` / `role="status"` for async updates |

## Semantic HTML First

The first rule of ARIA: don't use ARIA when a native element does the job. A native `<button>` gives you keyboard activation (Enter and Space), focusability, the button role, focus styling hooks, and form semantics — free, tested in every browser and screen reader. A `div` with `onClick` gives you none of that; recreating it needs `role="button"`, `tabindex="0"`, a keydown handler for both Enter and Space, and focus styles. Four things to get wrong instead of zero.

| Instead of | Use | You get free |
|------------|-----|--------------|
| `<div onClick>` | `<button>` | Keyboard activation, focus, role, AT announcement |
| `<div class="link">` | `<a href>` | Open-in-new-tab, context menu, visited state, role |
| `<div class="heading">` | `<h1>`–`<h6>` | Document outline, screen-reader heading navigation |
| `<div class="list">` | `<ul>/<ol>` | "List, 5 items" announcement, list navigation |
| `role="checkbox"` + JS | `<input type="checkbox">` | State, keyboard, label association, form submission |
| `role="navigation"` div | `<nav>` | Landmark navigation for screen-reader users |

Reach for ARIA only for patterns HTML lacks: tabs, comboboxes, live regions, tree views — and then follow the ARIA Authoring Practices patterns exactly, including their keyboard contracts.

## ARIA Anti-Patterns

Pages with ARIA average more detectable errors than pages without it. These are the recurring offenders.

| Anti-pattern | Why it breaks | Fix |
|--------------|---------------|-----|
| `aria-label` on non-interactive elements (`div`, `span`, `p`) | Ignored or inconsistently read — accessible names apply to interactive/landmark roles | Use visible text, or `aria-labelledby` on a proper role |
| `role="button"` without keydown handlers | Announced as a button but Enter/Space do nothing — a lie to the user | Use `<button>`; if impossible, add `tabindex="0"` + Enter/Space handlers |
| `aria-hidden="true"` on focusable content | Keyboard users tab into elements that don't exist for the screen reader — focus lands on silence | Add `inert`, remove from tab order, or unhide |
| Redundant roles (`<button role="button">`, `<nav role="navigation">`) | Noise; risks contradicting native semantics as specs evolve | Delete the role — the element already has it |
| `role="menu"`/`menuitem` for site navigation | Menu means application menu (arrow-key navigation, single tab stop); nav links break under those expectations | `<nav>` with a plain list of links |
| `aria-label` overriding visible text with different words | Voice-control users say the visible label and nothing activates (fails 2.5.3) | Accessible name must contain the visible label |

## Keyboard Patterns

- **Tab order follows DOM order.** Never fix visual/tab order mismatches with positive `tabindex` — reorder the DOM. Positive `tabindex` creates an unmaintainable parallel ordering.
- **Focus ring:** ≥3:1 contrast against adjacent colors, ≥2px visible area. `outline: none` is acceptable only with an equally visible replacement (`:focus-visible` box-shadow or outline). Removing it with no replacement fails 2.4.7 and strands sighted keyboard users.
- **Modal focus trap:** on open, move focus to the dialog (or its first focusable element); Tab cycles inside; Escape closes; on close, return focus to the element that opened it. Use `<dialog>` + `showModal()` to get most of this natively, or `inert` on the background.
- **Skip link:** first focusable element, visually hidden until focused, jumps to `<main>`. Keyboard users otherwise tab through the entire header on every page.
- **Roving tabindex for composite widgets** (tabs, toolbars, radio groups, grids): one tab stop for the whole widget (`tabindex="0"` on the active item, `-1` on the rest), arrow keys move within. Otherwise a 30-item toolbar costs 30 Tab presses to cross.

### SPA route changes

Client-side routing defeats the browser behaviors screen-reader users rely on: no page-load announcement, focus stays wherever it was. On every route change: update `document.title`, move focus to the new view's `<h1>` (give it `tabindex="-1"`) or a route-announcer live region, and scroll to top. Router libraries do none of this by default.

## Screen-Reader Realities

| Priority | Screen reader + browser | Why |
|----------|------------------------|-----|
| 1 | VoiceOver + Safari (macOS) | Free on every Mac; Cmd+F5. Test the pairing, not VoiceOver+Chrome |
| 2 | NVDA + Chrome (Windows) | Free; largest real-user share combined with JAWS-similar behavior |
| 3 | VoiceOver (iOS Safari) | Mobile web traffic; touch exploration differs from desktop |

Dynamic changes are invisible to screen-reader users unless announced. Use `aria-live="polite"` (or `role="status"`) for async results, saves, and loading completion — it waits for the user to pause. Reserve `aria-live="assertive"` (or `role="alert"`) for errors and genuinely urgent interruptions; assertive cuts off whatever the user was reading, so overuse trains users to distrust the page. Live regions must exist in the DOM before content changes inside them — injecting a pre-populated live region often announces nothing.

## WCAG 2.2 Additions (quick reference)

| SC | Rule | Practical implication |
|----|------|----------------------|
| 2.5.8 Target Size | Targets ≥24×24 CSS px or spaced equivalently | Audit icon buttons, table row actions, mobile toolbars |
| 2.4.11 Focus Not Obscured | Focused element not fully hidden by sticky UI | Add `scroll-padding-top` matching sticky header height |
| 2.5.7 Dragging Movements | Drag has a single-pointer alternative | Sortable lists need move up/down buttons; sliders need direct input |
| 3.2.6 Consistent Help | Help in the same relative place on every page | Pin the help/chat/contact link location |
| 3.3.8 Accessible Authentication | No cognitive-test-only login | Allow paste and password managers; offer email link or OAuth over transcription CAPTCHAs |

## Audit Workflow

Manual passes first; automated scan last — tools catch only ~30–40% of issues, and running them first anchors the audit on the trivial subset.

1. **Scope.** Pick the 3–5 highest-traffic/critical templates (home, primary flow, forms, search results). Record browser/AT matrix.
2. **Keyboard-only pass.** Mouse away. Tab through each page: every control reachable and operable, visible focus at every stop, logical order, skip link works, no traps, modals trap-and-return correctly. This single pass surfaces failures #4 and #5.
3. **Screen-reader pass.** VoiceOver+Safari or NVDA+Chrome. Navigate by headings and landmarks; verify images, control names/roles/states, form labels and error announcements, dynamic-update announcements.
4. **200% zoom pass.** Browser zoom to 200% (and reflow check at 320px-equivalent width): no clipped or overlapping content, no horizontal scroll, nothing keyboard-unreachable.
5. **Reduced-motion pass.** Enable `prefers-reduced-motion`; verify animations/parallax/auto-play respect it and nothing conveys information through motion alone.
6. **Automated scan.** Run the bundled static scanner for the mechanical checks (missing alt, unlabeled inputs, missing `lang`, empty buttons/links, heading skips, missing landmarks):
   ```
   node scripts/a11y-audit.js https://example.com
   node scripts/a11y-audit.js path/to/page.html
   ```
   Supplement with browser-based tools (axe, Lighthouse) if available. Treat clean automated output as "no news", never as "accessible".
7. **Triage and report** using the severity model and Output Format below.

## Severity Triage

| Severity | Definition | Example | Fix window |
|----------|------------|---------|-----------|
| Blocker | Task impossible for an AT user | Unlabeled checkout button; keyboard trap in payment form | Now — hotfix |
| Serious | Major barrier; painful workaround exists | Missing form error announcements; invisible focus site-wide | This sprint |
| Moderate | Friction, task still completable | Heading-level skips; redundant link text | Next 1–2 sprints |
| Minor | Polish | Slightly verbose alt text; decorative icon exposed | Backlog |

Order fixes by user impact × page traffic: a serious issue on the login page beats a blocker on a page with 12 visits a month. Legal context in one line: ADA (US, thousands of web lawsuits/year), the European Accessibility Act (enforced since June 2025, applies to most consumer-facing digital products sold in the EU), and Section 508 (US government procurement) all create real exposure — but fix by user impact and the legal risk follows.

## Common Mistakes

1. **Shipping the automated scanner's green check as "accessible".** Tools see ~30–40% of issues and cannot judge alt-text quality, focus order sense, or announcement usefulness. Fix: keyboard and screen-reader passes are the audit; the scanner is the appendix.
2. **`outline: none` in the CSS reset with no replacement.** Strands every sighted keyboard user. Fix: style `:focus-visible` with a ≥3:1, ≥2px indicator instead of deleting the outline.
3. **Placeholder text as the only label.** Disappears on input, low contrast, not reliably announced. Fix: visible `<label for>`; use placeholder only for format hints.
4. **Sprinkling ARIA to fix semantics problems.** `role="button"` on divs, `aria-label` on spans, menus for navs — each adds a promise the code doesn't keep. Fix: swap to the native element first; ARIA only for patterns HTML lacks, implemented per the APG keyboard contract.
5. **`alt` text that describes pixels, not purpose.** `alt="logo.png"` or `alt="image of arrow"`. Fix: describe function ("Acme home", "Next page"); decorative images get `alt=""` so ATs skip them.
6. **Modals without focus management.** Focus stays behind the overlay; Escape does nothing; close dumps focus at `<body>`. Fix: native `<dialog>.showModal()` or trap + Escape + return-focus, and `inert` the background.
7. **Announcing everything assertively.** Every toast interrupts mid-sentence; users tune out real errors. Fix: `polite` by default, `assertive` only for errors requiring immediate action.
8. **Color as the only signal.** Red border for errors, green dot for status. Fails both 1.4.1 and the 8% of men with color-vision deficiency. Fix: pair color with text or an icon.

## Output Format

Deliver audits in this structure:

```
# Accessibility Audit — <site/flow> — <date>
Target: WCAG 2.2 AA | Pages tested: <list> | Matrix: <browser + AT pairs>

## Summary
<2–3 sentences: overall state, count by severity, top 3 themes>
Blockers: N | Serious: N | Moderate: N | Minor: N

## Findings (ordered by severity, then traffic)
### [BLOCKER] <short title>
- WCAG: <SC number + name>
- Where: <page / component / selector>
- Barrier: <who is blocked and how — one sentence in user terms>
- Repro: <steps, including AT/keyboard steps>
- Fix: <specific code-level remediation>
- Effort: S / M / L

## Fix Plan
1. <Blockers on high-traffic flows first — impact × traffic order>
...

## Retest Checklist
<the manual passes to repeat after fixes land>
```

For build/review (non-audit) requests: apply the checklist inline, cite SC numbers in code-review comments, and always state which of the five dominant failures the change touches.
