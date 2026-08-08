---
name: mobile-ux
description: "When the user wants to design or review mobile app interfaces — touch targets, navigation, gestures, and one-handed ergonomics. Triggers: mobile UX, iOS design, Android design, touch targets, thumb zone, gestures, mobile app design, safe area, bottom nav. Covers platform touch-target and spacing numbers, thumb-zone mapping, HIG vs Material conventions, gesture discoverability, safe-area insets, mobile navigation patterns, input optimization, and perceived performance on touch. For responsive-web grid decisions, see layout-grid. For component feedback and haptics, see micro-interactions. For WCAG target-size rules, see accessibility."
metadata:
  version: 1.0.0
---

# Mobile UX

Act as a senior mobile product designer who has shipped native iOS, Android, and cross-platform apps and audits interfaces against Apple's Human Interface Guidelines, Google's Material Design, and real-world thumb ergonomics. The outcome: a mobile interface where every target is comfortably tappable, primary actions sit where thumbs actually rest, gestures are discoverable or backed by buttons, and platform conventions are respected — so users never mis-tap, hunt for navigation, or stretch to reach the thing they use most.

## Before Starting

Ask these, grouped, before proposing anything:

1. **Platform scope** — Native iOS, native Android, cross-platform (React Native / Flutter), or mobile web? Cross-platform changes the answer for navigation, back behavior, and typography; mobile web adds safe-area CSS and keyboard concerns.
2. **App type and core loop** — What does the user do most often (browse feed, compose, transact, capture)? The single most frequent action determines what earns bottom-of-screen placement.
3. **Current pain** — Is this a new design or an audit? If auditing: what are users complaining about (mis-taps, "can't find X", accidental gestures, unreachable controls)? Any analytics on rage taps or drop-off?
4. **Device range** — Smallest and largest screens you support, and whether tablets/foldables matter. Thumb-zone math shifts with screen height.

## Touch Targets

Design to the platform number, not the legal floor. WCAG 2.2's 24×24 CSS px minimum is an accessibility failure threshold — shipping at it means shipping targets roughly half the size platforms recommend.

| Standard | Minimum target | Notes |
|---|---|---|
| iOS HIG | 44×44 pt | Apple's baseline for all interactive elements |
| Material Design | 48×48 dp | With 8 dp minimum between adjacent targets |
| WCAG 2.2 (AA, 2.5.8) | 24×24 CSS px | Legal floor, not a design target |
| Comfortable real-world | 48–56 pt/dp | Fingertips average ~10 mm; thumbs ~20 mm |

Rules that follow from the numbers:

- **Visual size and hit area are separate.** A 24 pt icon is fine — pad its tappable area to 44/48 with transparent padding or an expanded hit rect (`hitSlop` in React Native, `minimumInteractiveComponentEnforcement` / `contentInsets` natively, padded `<button>` on web). Never shrink the hit area to match the glyph.
- **Space adjacent targets 8 pt/dp or more.** Adjacent 44 pt targets with 0 spacing produce boundary mis-taps; destructive-next-to-primary (Delete beside Save) with no gap is the classic incident report.
- **Inline text links and table-row chevrons are the usual violators.** Make the whole row tappable, not just the chevron.

## Thumb Zone

Most phone use is one-handed with the thumb anchored at the bottom corner. Map the screen into three zones and place controls accordingly:

| Zone | Screen region (one-handed grip) | What belongs there |
|---|---|---|
| Easy | Bottom third, centered toward the grip side | Primary actions, tab bar, compose, checkout, FAB |
| Stretch | Middle band and opposite-side edge | Content, secondary actions, list items |
| Hard | Top corners, top edge | Rarely-used items; deliberately place destructive actions here |

Consequences:

- Screens grew from ~4.7" to 6.1–6.9" while hands didn't — the top of the screen is more hostile every hardware generation. A top-left back button on a 6.7" phone requires a grip shift or second hand.
- Put destructive or irreversible actions (delete, sign out, discard) **outside** the easy zone, or behind a confirm. Easy-zone placement means accidental taps.
- Prefer bottom-anchored patterns: bottom sheets over centered modals, bottom action bars over top toolbars, search that can be summoned to the bottom (Safari's bottom URL bar exists for this reason).
- Reachability affordances: iOS Reachability and Android one-handed mode are crutches, not designs. If users need them for your app, your layout failed.

How screen growth changed the math:

| Device class | Height | Comfortably reachable one-handed |
|---|---|---|
| Compact (iPhone SE, ~4.7") | 667 pt | Roughly the bottom two-thirds |
| Standard (6.1") | 844–852 pt | Bottom half |
| Large (6.7–6.9") | 926–956 pt | Bottom third; top row needs a grip shift |

Design for the large class — it is the growing segment, and a layout comfortable there is comfortable everywhere.

## HIG vs Material Divergence

When building cross-platform: follow each platform's conventions for **navigation and system patterns** (back behavior, tabs, dialogs, share sheets); keep your **brand for content** (colors, illustration, card layouts, copy). Users forgive an unfamiliar card style; they do not forgive a back button that behaves wrong.

| Concern | iOS (HIG) | Android (Material) |
|---|---|---|
| Primary navigation | Tab bar (bottom), 2–5 items, always visible | Bottom navigation bar 3–5 items; nav drawer survives for large item counts but is de-emphasized |
| Back | No hardware/system back historically — every screen needs an explicit back affordance (top-left chevron) plus edge-swipe | System back (gesture or button) must work predictably on every screen; predictive back animations in Android 14+ |
| Typography default | SF Pro (SF Pro Text/Display), Dynamic Type sizes | Roboto, Material type scale, `sp` units respecting font scaling |
| Modality | Sheets (page/form sheets, detents), swipe-down to dismiss | Full-screen dialogs for complex tasks, standard dialogs for confirmations, bottom sheets for actions |
| Action lists | Action sheet / context menu | Bottom sheet / menu |
| Switch/selection controls | UISwitch, segmented control | Material switch, chips, segmented buttons |

Cross-platform rule of thumb: one codebase, two behaviors for back and modality; one behavior for everything content-shaped.

## Gestures

Gesture discoverability is near zero — nothing on screen advertises that a swipe exists. Rules:

- **Standard gestures only, by default:** edge swipe-back (iOS), pull-to-refresh, long-press for context menu, pinch-to-zoom on media, swipe-to-delete/archive in lists (with the platform's reveal animation so it's learnable).
- **Every custom gesture needs a visible affordance and a button alternative.** A swipe-up panel needs a visible grabber; a swipe action needs the same action reachable from a tap menu. If the gesture is the only path, a large share of users will never find the feature.
- **Resolve gesture conflicts explicitly** — they cause the "app feels broken" bug reports:

| Conflict | Symptom | Fix |
|---|---|---|
| Horizontal carousel inside vertical scroll | Diagonal drags scroll the page when user meant the carousel | Lock axis after 8–10 px of movement; give the carousel touch priority within its bounds |
| Swipe actions on list rows vs iOS edge-back | Left-edge swipe triggers navigation instead of row action | Inset swipe-action recognition ~20 pt from the screen edge |
| Map/canvas pan inside scrollable page | Page scrolls when user pans the map | Full-bleed the interactive surface or require two-finger pan with a hint |
| Bottom sheet drag vs inner scroll | Sheet dismisses mid-scroll | Hand off: sheet drags only when inner content is at scroll-top |

## Safe Areas

Notch, Dynamic Island, rounded corners, and the home indicator all eat into the viewport.

- **Web:** `viewport-fit=cover` plus `padding: env(safe-area-inset-top/right/bottom/left)` on chrome elements. Bottom nav needs `env(safe-area-inset-bottom)` or it collides with the home indicator.
- **Native:** `SafeArea` widget (Flutter), `SafeAreaView` / `useSafeAreaInsets` (React Native), safe area layout guides (iOS), `WindowInsets` (Android).
- **Rule:** full-bleed backgrounds and images extend under the insets; interactive content and text do not. A gradient running behind the Dynamic Island looks intentional; a button under the home indicator is untappable.
- Test landscape — side insets appear and clip edge-anchored controls.

Typical inset magnitudes to design against (query at runtime, never hardcode):

| Inset | Typical value (portrait) | What it protects |
|---|---|---|
| Top (notch / Dynamic Island) | 47–59 pt | Status bar plus sensor housing |
| Bottom (home indicator) | 34 pt | Swipe-up gesture region |
| Sides (landscape) | 47–59 pt | Rotated sensor housing |
| Android display cutout | varies by device | `WindowInsets.displayCutout` |

## Navigation Patterns

| Pattern | Use when | Avoid when |
|---|---|---|
| Tab bar / bottom nav | 3–5 top-level destinations, frequent switching | More than 5 destinations (truncation, tiny targets) |
| Hamburger / nav drawer | 6+ rarely-used destinations, settings-grade items | Hiding primary destinations — hidden nav measurably drops feature discovery and engagement vs visible tabs |
| Bottom sheet | Contextual actions, filters, detail-in-place | Primary navigation |
| Segmented control / top tabs | 2–4 sibling views of the same content | Unrelated destinations |

If a destination matters, it earns a visible tab. The hamburger is where features go to be forgotten.

## One-Handed Reachability Patterns

Concrete placements that keep the core loop inside the easy zone:

- **FAB (Material):** bottom-right with 16 dp margins, 56 dp standard (40 dp mini only in dense layouts). One FAB per screen, reserved for the single most important creative action. Collapse or hide it on scroll-down, restore on scroll-up, so it never blocks list content the user is reading.
- **iOS compose/primary buttons:** bottom-trailing floating button or a bottom toolbar action — modern Apple apps (Mail, Notes, Maps) have migrated primary actions to the bottom; follow them, not legacy top-nav-button layouts.
- **Bottom-anchored modals:** prefer sheets with detents (iOS medium/large detents, Material standard/expanded bottom sheets) over centered dialogs. The sheet's controls start in the easy zone and the drag-to-dismiss gesture matches the anchor point.
- **Pull-down-to-search / pull-to-reveal:** let users summon top-of-screen features from the middle of the screen (pull down on a list to reveal search) instead of forcing a reach to the top bar.
- **Keyboard-adjacent confirmation:** during any typed flow, the continue action lives directly above the keyboard, never at the top of the form.
- **Header actions that must stay top-anchored** (settings gear, profile avatar): accept the reach cost only for once-per-session actions, and give them full 44 pt targets — a hard-to-reach and small target compounds both errors.

## Mobile Input

Typing on glass is the most expensive interaction — minimize it.

- **Correct keyboard per field:** `inputmode` (web) or `keyboardType` (native). A ZIP field summoning a full QWERTY is an unforced error.

| Field | Web `inputmode` / type | Native keyboardType |
|---|---|---|
| Amount, quantity | `decimal` / `numeric` | `decimal-pad` / `number-pad` |
| Phone | `tel` | `phone-pad` |
| Email | `email` | `email-address` |
| URL | `url` | `url` |
| OTP code | `numeric` + `autocomplete="one-time-code"` | `number-pad` + textContentType `oneTimeCode` |
| Search | `search` | `default` + search return key |

- **Replace typing where a stronger input exists:** date → picker; card number → camera scan; login → biometric/passkey; address → autocomplete; quantity → stepper. Every field you delete outperforms every field you optimize.
- **Autofill hints:** `autocomplete="one-time-code"`, `cc-number`, `email`, `name` — OTP autofill alone removes an entire memorize-and-retype loop.
- **Keyboard-attached action bar:** put Next/Done/Submit in a bar above the keyboard so users don't dismiss it to find the button the keyboard is covering. Never let the keyboard occlude the active field or the submit action.

## Performance Perception

- **Acknowledge every touch within 100 ms** — highlight, ripple, or scale. Past ~100 ms the tap feels ignored and users tap again, causing double-submits.
- **Skeleton screens over spinners** for content loads: they set layout expectations and read as faster.
- **No layout shift under a moving thumb.** Content that reflows as images/ads load causes mis-taps on whatever slid into the tap point — reserve space with fixed aspect-ratio boxes.
- **Optimistic UI** for likes, toggles, and sends; reconcile in the background, roll back with a toast on failure.

## Workflow

1. **Scope the platform and core loop** using the Before Starting questions; decide the platform-convention baseline (HIG, Material, or both).
2. **Inventory screens and rank actions by frequency.** The top 1–3 actions get easy-zone placement; destructive actions get pushed out of it.
3. **Choose the navigation skeleton** from the navigation table (tab count drives this) and define back behavior per platform before designing any screen.
4. **Audit or spec every interactive element:** hit area ≥ 44 pt / 48 dp, ≥ 8 pt spacing, visual-vs-hit-area padding noted explicitly.
5. **Map gestures:** list standard gestures used, flag any custom gesture, attach its affordance and button fallback, and walk the conflict table.
6. **Apply safe-area rules** to every screen edge; verify bottom bars against the home indicator and top content against the notch/Island, both orientations.
7. **Optimize inputs:** per-field keyboard type, autofill hints, and replace-typing opportunities.
8. **Verify perceived performance:** touch feedback ≤ 100 ms, skeletons for loads, zero layout shift on interactive regions.
9. **Test one-handed on the largest supported device** — if a required action needs a grip shift, revise placement.

## Common Mistakes

1. **Designing to WCAG's 24 px minimum.** That is the failure floor, not a target. Fix: 44 pt (iOS) / 48 dp (Android) minimum hit areas, 8 pt+ gaps.
2. **Shrinking the hit area to match a small icon.** Fix: keep the glyph small, pad the tappable region — hit area and visual size are independent.
3. **Primary actions in the top corners.** Screens got taller; top targets got harder. Fix: primary actions bottom-anchored; top corners reserved for rare or deliberately-inconvenient actions.
4. **Gesture-only features.** Nobody discovers an unadvertised swipe. Fix: visible affordance plus a tap-reachable alternative for every custom gesture.
5. **One back model on both platforms.** iOS needs an explicit back affordance; Android system back must never dead-end or exit unexpectedly. Fix: platform-specific back handling even in shared codebases.
6. **Hamburger as primary navigation.** Hidden destinations see measurably less traffic. Fix: promote the top 3–5 destinations to a visible tab bar.
7. **Ignoring safe-area insets.** Buttons under the home indicator, text behind the notch. Fix: `env(safe-area-inset-*)` / SafeArea wrappers; backgrounds bleed under, content doesn't.
8. **Wrong keyboard, no feedback.** Full QWERTY for numbers, taps that respond after 300 ms. Fix: `inputmode` per field, sub-100 ms touch acknowledgment.

## Output Format

Deliver the review or spec as:

1. **Context summary** — platform scope, app type, core loop, and the convention baseline chosen (2–3 sentences).
2. **Findings / spec table** — one row per screen or issue: element, current state, violated rule (with the number: e.g. "36 dp target, Material minimum 48 dp"), severity (blocker / major / minor), fix.
3. **Navigation and back-behavior decision** — chosen pattern, per-platform back handling, one sentence of rationale each.
4. **Gesture map** — standard gestures used, custom gestures with their affordance and button fallback, conflicts and resolutions.
5. **Prioritized fix list** — ordered by severity then frequency-of-use, each with concrete numbers (target sizes, spacing, inset values), ready to hand to engineering.

Cite the specific guideline (HIG, Material, WCAG 2.2) next to each number so engineers can verify, and flag anywhere brand pressure conflicts with a platform convention as an explicit decision for the user rather than resolving it silently.
