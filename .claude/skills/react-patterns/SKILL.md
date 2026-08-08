---
name: react-patterns
description: "When the user wants to structure React components, place state correctly, tame re-renders, fix effect misuse, or choose a state-management approach. Use when the user says 'React', 'hooks', 're-render', 'useEffect', 'context', 'server components', 'state management', 'component keeps re-rendering', or 'prop drilling'. Covers composition patterns, state placement and derived-state rules, the re-render model, memoization discipline, effect hygiene, server/client component boundaries, and library selection. For type-level patterns, see typescript-patterns. For render-performance budgets, see frontend-performance. For animation in React, see framer-motion."
metadata:
  version: 1.0.0
---

# React Patterns

Act as a senior React engineer who has maintained large component trees through the hooks migration, the concurrent-rendering era, and the server-components split. The outcome: components composed instead of configured, state living at the lowest correct level, effects reserved for external systems, and re-render behavior the developer can predict before opening the profiler — code that stays cheap to change as the app grows.

## Before Starting

Ask these before recommending patterns — the right answer changes with each:

1. **React version and framework.** React 18 or 19? Next.js (App Router or Pages), Remix/React Router, Vite SPA, or React Native? Is the React Compiler enabled? Server components and the compiler each invalidate common advice.
2. **State landscape.** What already manages state — plain useState, Context, Redux, Zustand, Jotai, React Query/SWR? How much of the "state" is actually server data being cached on the client?
3. **The pain point.** Slow interactions, unpredictable re-renders, prop drilling, effect spaghetti, or a component that has grown past ~300 lines? Fix the named problem first; don't refactor everything.
4. **Scale and team.** Roughly how many routes/components, and how many people touch this code? A 5-component tool and a 500-component product warrant different ceremony.

## Composition Patterns

Prefer composition over configuration. A component with 12 boolean/slot props is a component that should have been children.

| Pattern | Use when | Avoid when |
|---|---|---|
| `children` / slot props | Layout shells, cards, modals — parent doesn't care what's inside | Slots must coordinate shared state |
| Compound components (Context) | Related parts share implicit state: `<Tabs><Tabs.List/><Tabs.Panel/></Tabs>` | A single flat component is still readable |
| Custom hook extraction | Logic reuse or testability; UI stays with the caller | You're extracting one `useState` with no logic |
| Render props | Caller needs per-item/per-frame render control (virtualized lists) | A hook can return the data instead — hooks replaced most render props |

Rules:
- **Kill prop explosions with slots.** `<Card title icon action footer …/>` becomes `<Card><CardHeader/><CardBody/></Card>`. New layouts then need no new props.
- **Compound components**: parent owns state, publishes it via a private context; sub-components consume it. Export the parts as properties (`Tabs.List`) or named exports.

```tsx
const TabsCtx = createContext<{active: string; select: (id: string) => void} | null>(null);

function Tabs({ defaultTab, children }: {defaultTab: string; children: ReactNode}) {
  const [active, select] = useState(defaultTab);
  const value = useMemo(() => ({ active, select }), [active]);
  return <TabsCtx.Provider value={value}>{children}</TabsCtx.Provider>;
}
Tabs.Tab = function Tab({ id, children }: {id: string; children: ReactNode}) {
  const ctx = useContext(TabsCtx);
  if (!ctx) throw new Error('Tabs.Tab must be used inside <Tabs>');
  return <button aria-selected={ctx.active === id} onClick={() => ctx.select(id)}>{children}</button>;
};
```

The throw-on-missing-context guard turns a silent misuse into an immediate, named error — keep it in every compound component.
- **Hook vs render prop**: extract a hook when the consumer renders the UI; keep a render prop only when the component owns the render loop (virtualization, canvas overlays).
- **Name hooks after the domain, not the mechanism**: `useCheckoutTotals`, not `useMemoizedReducerState`. If you can't name the domain, the extraction is premature.

## State Placement

| Rule | Why |
|---|---|
| State lives in the component that uses it | Lower state = smaller re-render blast radius |
| Lift only when two components actually share it | Preemptive lifting creates god-components |
| Derived state is computed in render, never stored | Stored copies drift; computed values can't |
| `useReducer` when one event updates 3+ fields | Transitions become explicit and testable |
| URL is state too | Filters, tabs, pagination belong in searchParams — shareable, back-button-safe |

**The "is this derivable?" test kills most useState bugs.** Before adding state, ask: can this be computed from existing state or props? `fullName` from first+last, `filteredItems` from items+query, `isValid` from field values — all computed in render, not stored. Storing them adds a sync obligation you will eventually miss (usually via an effect, compounding the bug). Only store what cannot be derived: user input, server responses, time.

```tsx
// Before: stored copy + sync effect — two sources of truth
const [items, setItems] = useState<Item[]>([]);
const [visible, setVisible] = useState<Item[]>([]);
useEffect(() => { setVisible(items.filter(i => i.active)); }, [items]);

// After: one source of truth, nothing to sync
const [items, setItems] = useState<Item[]>([]);
const visible = items.filter(i => i.active); // useMemo only if profiling says so
```

**useReducer signal:** three `setX` calls in one handler, or a submit that touches `status` + `error` + `data`, means the fields form one state machine. Model it as `dispatch({ type: 'submitted' })` and impossible states (loading with stale error) become unrepresentable:

```tsx
type State =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'error'; message: string }
  | { status: 'success'; data: Order };
// The union makes "submitting with a stale error" a type error, not a runtime surprise.
```

## The Re-render Model

Internalize this model; it predicts nearly every performance question:

1. **Render ≠ DOM update.** A render is a function call producing a description; React diffs and touches only changed DOM. Renders are cheap until proven otherwise — the goal is predictability, not zero renders.
2. **A parent render re-renders every child** — regardless of whether the child's props changed — unless the child is memoized or was passed in as `children`/props from higher up.
3. **Context change re-renders every consumer.** No prop-diffing escape hatch. So split contexts by change frequency: `ThemeContext` (changes twice a day) must not share a provider value with `CursorPositionContext` (changes 60×/s). Also split state from dispatch — `dispatch` is stable, so consumers that only dispatch never re-render.
4. **Composition avoids re-renders for free.** If a stateful wrapper receives `children` as a prop, those children were created by *its parent* — the wrapper re-rendering does not re-render them. Moving state down or passing content through as `children` fixes most "everything re-renders when I type" bugs with zero memoization.

```tsx
// Before: typing re-renders <ExpensiveTree/> on every keystroke
function Page() {
  const [query, setQuery] = useState('');
  return <><input value={query} onChange={e => setQuery(e.target.value)} /><ExpensiveTree /></>;
}

// After: state moved into a wrapper that takes children — ExpensiveTree's element
// is created by Page, which didn't re-render, so React reuses it untouched.
function SearchBar({ children }: {children: ReactNode}) {
  const [query, setQuery] = useState('');
  return <><input value={query} onChange={e => setQuery(e.target.value)} />{children}</>;
}
function Page() {
  return <SearchBar><ExpensiveTree /></SearchBar>;
}
```

Debug order for "component keeps re-rendering": React DevTools Profiler with "record why each component rendered" → identify the state owner → move state down or restructure with children → only then memoize.

## Memoization Discipline

- **Measure first.** Open React DevTools Profiler, record the slow interaction, read actual ms. Memoizing a 0.3 ms component adds comparison cost and code noise for nothing. A worthwhile target is typically ≥10 ms of wasted render in a hot path (typing, dragging, scrolling).
- Apply as a set at the proven hot spot: `memo` on the expensive child, plus `useMemo`/`useCallback` on the object/function props flowing into it — one unstable prop defeats `memo` entirely.
- `useMemo` independently earns its keep for genuinely expensive computation (sorting/filtering thousands of rows) even without a memoized child.
- **React Compiler changes this calculus.** With the compiler enabled (React 19 era), it auto-memoizes components and values — stop hand-writing `useMemo`/`useCallback` for re-render control and delete them as you touch files. Structural fixes (state placement, context splitting, children pass-through) remain valuable regardless: the compiler cannot move your state for you.

## useEffect Discipline

Effects exist to synchronize React with **external systems**: subscriptions, browser APIs, non-React widgets, analytics. Anything else has a better home.

| If the effect… | Do instead |
|---|---|
| Computes state from other state/props | Compute in render (`useMemo` if expensive) |
| Responds to a user action | Put the logic in the event handler |
| Fetches data | Framework loader (Next.js RSC, Remix) or React Query/SWR — they handle races, caching, dedupe |
| Resets state when a prop changes | `key={prop}` on the component to remount |
| Chains state updates (effect sets state, triggers next effect) | One reducer transition or one handler |
| Notifies the parent of a state change | Call the callback in the same handler that set the state |
| Subscribes to an external store | `useSyncExternalStore` |

Dependency honesty: never suppress `exhaustive-deps` — the lint error is telling you the effect's design is wrong. Fix by moving logic to handlers, using functional updates (`setCount(c => c + 1)`), or extracting non-reactive reads. Every effect that sets up must return cleanup; if you can't say which external system an effect synchronizes with, delete the effect.

When a raw fetch effect is genuinely unavoidable, guard against races:

```tsx
useEffect(() => {
  let ignore = false;
  fetchUser(id).then(user => { if (!ignore) setUser(user); });
  return () => { ignore = true; };
}, [id]);
```

Without the flag, a slow response for the previous `id` can land after the current one and overwrite it — the bug appears only under real-world latency, never in local dev.

## Server Components (RSC)

For Next.js App Router and similar frameworks:

| Concern | Server component | Client component |
|---|---|---|
| Data fetching | `async` component, `await` directly | React Query / passed props |
| Bundle cost | Zero JS shipped | Full component + deps shipped |
| Can use | fs, DB, secrets | useState, useEffect, event handlers, browser APIs |
| Default | Yes — everything is server until marked | Only under a `'use client'` boundary |

- **Push `'use client'` leaf-ward.** Marking a page-level component client-side drags the whole subtree into the bundle. Extract the interactive island (the button, the search box) into its own client file; keep the page server-rendered.

```tsx
// page.tsx — server component: fetches directly, ships no JS for this code
export default async function ProductPage({ params }: {params: {id: string}}) {
  const product = await db.products.find(params.id);
  return (
    <article>
      <h1>{product.name}</h1>
      <AddToCartButton productId={product.id} /> {/* the only client island */}
    </article>
  );
}

// add-to-cart-button.tsx
'use client';
export function AddToCartButton({ productId }: {productId: string}) {
  const [pending, setPending] = useState(false);
  /* onClick, optimistic state … */
}
```
- **Server components can nest inside client components via `children`** — a client `<Sidebar>` can receive server-rendered content it never bundles. Use this to keep boundaries small.
- **Serialization boundary:** props crossing server→client must be serializable — no functions, class instances, or Dates-as-Dates (they arrive as strings unless the framework handles it). Pass IDs and plain data; reconstruct rich objects client-side, or use Server Actions for the reverse direction.
- **Async + Suspense = streaming.** Wrap slow `async` components in `<Suspense fallback>` so the shell renders immediately and slow data streams in; place boundaries around independent regions, not the whole page.

## Choosing State Management

Server cache is not client state — misclassifying it is the most common architecture error. Use this table top-down; stop at the first row that fits:

| State type | Tool | Example |
|---|---|---|
| Used by one component | `useState` / `useReducer` | Input value, open/closed |
| Shared by siblings | Lift to common parent | Selected row + detail pane |
| Global, low-frequency | Context | Theme, locale, auth session |
| Global, high-frequency, many writers | Zustand / Jotai | Multi-panel editor, canvas, live cursors |
| Mirrors the server | React Query / SWR (or RSC + Server Actions) | Lists, profiles, anything fetched |
| Shareable view config | URL searchParams | Filters, tabs, pagination |

Context is a dependency-injection tool, not a state manager — fine for values that change a few times per session, wrong for anything updated per-keystroke (every consumer re-renders). External stores (Zustand/Jotai) let components subscribe to slices, so only readers of the changed slice re-render. React Query owns retries, deduplication, staleness, and invalidation; the moment you write `useEffect` + `fetch` + three status flags, you are rebuilding it badly.

## Key Discipline

- Keys are identity, not decoration. Use a stable domain ID (`item.id`), never `Math.random()` (remounts every render, wiping state) and never array index for lists that reorder, filter, insert, or delete — React will reuse component state across the wrong items (the classic "input text jumps to another row" bug).
- Index keys are acceptable only for static, never-reordered, never-filtered lists.
- Exploit keys deliberately: changing `key` remounts a component — the correct way to reset a form when the edited entity changes (`<Form key={userId}/>`).

## Workflow

1. **Diagnose before prescribing.** Get answers to Before Starting. For perf complaints, get a Profiler recording (or instruct how: Profiler tab → record → interact → read "why did this render").
2. **Classify every piece of state**: derivable (delete it, compute in render), server cache (move to React Query/RSC), URL-worthy (searchParams), or genuine client state (place per the table).
3. **Fix structure before adding tools**: move state down, pass `children` through stateful wrappers, split contexts by change frequency, extract compound components from prop explosions.
4. **Audit effects** against the table above; expect to delete 30–60% in a typical legacy component. Re-enable and satisfy `exhaustive-deps` honestly.
5. **Set the RSC boundary** (if applicable): default server, extract minimal client islands, verify nothing non-serializable crosses.
6. **Memoize last, with evidence**: only at hot spots the profiler proved, as a complete memo + stable-props set. Skip if the React Compiler is on.
7. **Verify**: re-profile the same interaction; confirm the render count and ms dropped. State the before/after numbers.

## Common Mistakes

1. **Storing derived state.** `const [filtered, setFiltered] = useState([])` + an effect syncing it from `items`. Fix: `const filtered = useMemo(() => items.filter(f), [items, f])` — one source of truth, no sync bug, no extra render.
2. **Effect-driven data fetching without cleanup.** `useEffect(() => { fetch(url).then(setData) }, [url])` races: fast-then-slow responses arrive out of order and the stale one wins. Fix: React Query/SWR or a framework loader; if a raw effect is unavoidable, use an `ignore` flag in cleanup.
3. **One mega-context.** Auth + theme + notifications + cart in one provider: any cart update re-renders every theme consumer. Fix: one context per change-frequency class; split state and dispatch contexts.
4. **`useCallback`/`useMemo` everywhere "for performance."** Unmeasured memoization adds dependency-array bugs and reading cost while the actual hot spot (an unmemoized child or an unstable context value) stays slow. Fix: profile, memoize the proven path only, or enable the React Compiler.
5. **Marking whole pages `'use client'`** because one button needs `onClick`. The entire subtree ships to the bundle and loses server data access. Fix: extract the button into a 10-line client component; keep the page server-side.
6. **Index keys on dynamic lists.** Delete row 2 and row 3's input state appears in row 2. Fix: key by domain ID; reserve index keys for static lists.
7. **Prop drilling "fixed" with global state.** Passing props 2–3 levels is fine and explicit. Fix drilling that actually hurts with component composition first (pass the composed child down, not its data), Context only for genuinely global low-frequency values.
8. **Suppressing `exhaustive-deps`.** The disabled lint hides a stale closure that surfaces as "works, then randomly uses old data." Fix: restructure per the effect table — the lint rule is a design signal, not an obstacle.

## Output Format

Deliver recommendations as:

1. **Diagnosis** — the specific problem in one or two sentences, tied to the model above (e.g., "context value recreated per render re-renders all 40 consumers on every keystroke").
2. **Recommended pattern** — which pattern and why it fits this case; name the rejected alternative and the reason in one line.
3. **Code** — a minimal before/after diff for the user's actual components, not a generic demo. Keep it runnable; note React-version or framework assumptions inline.
4. **Verification** — how to confirm the fix: what the Profiler should show, expected render counts, or which lint rules now pass.
5. **Follow-ups** — at most three, ranked by impact; omit the section if there are none worth doing.
