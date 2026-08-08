---
name: typescript-patterns
description: "When the user wants to model domain types correctly, fix type errors, tighten a loose codebase, or use TypeScript's type system beyond annotations. Triggers: \"TypeScript\", \"type error\", \"generics\", \"discriminated union\", \"any\", \"strict mode\", \"type this properly\", \"as any everywhere\", \"infer\". Covers type modeling (discriminated unions, branded types, template literals), narrowing and type guards, the any-to-unknown escape-hatch ladder, generics discipline, satisfies vs as, utility types, and staged strict-mode migration. For React-specific typing, see react-patterns. For migrating legacy code safely, see refactoring."
metadata:
  version: 1.0.0
---

# TypeScript Patterns

Act as a senior TypeScript engineer who treats the type system as a design tool, not a linter to appease. The outcome: types that make illegal states unrepresentable, so entire bug classes fail at compile time instead of in production — and code that a teammate can read without hovering every identifier.

## Before Starting

Ask these, grouped, before writing types. Skip any the codebase already answers.

1. **Environment**: Which TypeScript version (`npx tsc --version`)? Version gates features — `satisfies` needs 4.9+, `const` type params need 5.0+, `using` needs 5.2+.
2. **Strictness**: What does `tsconfig.json` say — is `strict` on? If not, which flags are (`noImplicitAny`, `strictNullChecks`)? Advice differs sharply between a strict codebase and one where `null` checks don't exist.
3. **Pain area**: Is the problem modeling (types don't match the domain), errors (compiler complaints you don't understand), or hygiene (`any` and `as` everywhere)? Each gets a different workflow below.
4. **Boundaries**: Where does untyped data enter — API responses, JSON files, env vars, form input? Is a schema validator (zod, valibot) already installed?

## Core Framework 1: Make Illegal States Unrepresentable

The highest-leverage TypeScript skill. If a combination of fields is invalid, design the type so that combination cannot be constructed.

**Anti-pattern — boolean flags with implicit invariants:**

```ts
interface RequestState {
  isLoading: boolean;
  data?: User[];
  error?: Error;
}
// 8 combinations representable, only 4 valid.
// Nothing stops { isLoading: true, error: someError }.
```

**Pattern — discriminated union, payload attached to the right variant:**

```ts
type RequestState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; data: User[] }
  | { status: "error"; error: Error };
// data exists only when status === "success". The invalid
// states are not "checked" — they are unwritable.
```

Narrow with a `switch` on the discriminant, and make it exhaustive so adding a variant breaks every non-updated switch at compile time:

```ts
function assertNever(x: never): never {
  throw new Error(`Unhandled variant: ${JSON.stringify(x)}`);
}

function render(state: RequestState): string {
  switch (state.status) {
    case "idle":    return "Ready";
    case "loading": return "Spinner";
    case "success": return `${state.data.length} users`; // data narrowed in
    case "error":   return state.error.message;
    default:        return assertNever(state); // add "cancelled" later → compile error here
  }
}
```

Mechanics: the discriminant must be a *literal* type (`"success"`, not `string`) shared across all variants. TS narrows the whole object from a check on that one property.

Two more modeling recipes:

**Branded types** — stop passing a `UserId` where an `OrderId` belongs. Both are `string` at runtime; the brand exists only at compile time and costs nothing:

```ts
type UserId = string & { readonly __brand: "UserId" };
type OrderId = string & { readonly __brand: "OrderId" };
const asUserId = (s: string): UserId => s as UserId; // one blessed constructor

function getOrder(id: OrderId) { /* ... */ }
getOrder(asUserId("u_123")); // compile error — the bug this exists to catch
```

**Template literal types** — encode string shapes instead of accepting any `string`:

```ts
type Route = `/${string}`;
type EventName = `on${Capitalize<"click" | "focus">}`; // "onClick" | "onFocus"
type CssVar = `--${string}`;
```

## Core Framework 2: The Escape-Hatch Ladder

`any` is not "no type" — it silently infects everything it touches. `const x: any = f(); const y = x.foo.bar` typechecks, and `y` is `any` too, spreading downstream. `unknown` is the honest version: you can hold it, but you must narrow before use.

When the compiler blocks you, descend this ladder and stop at the first rung that works:

| Rung | Technique | Use when | Cost |
|---|---|---|---|
| 1 | Model the real type | Almost always possible | Effort now, safety forever |
| 2 | Generic with constraint | Type varies per call site | Slight complexity |
| 3 | `unknown` + type guard | Data truly unknowable at compile time (IO) | Runtime check |
| 4 | Targeted `as T` assertion | You know something TS can't prove; narrowest possible scope | Trust, no verify |
| 5 | `any` + `// why` comment | Third-party types are broken; nothing else works | Viral unsafety — quarantine it |

Rung 4 discipline: assert the smallest expression, never a whole object graph, and prefer `satisfies` (validates without widening) when what you actually want is "check this literal against a type."

## Core Framework 3: Trust Boundaries and Type Guards

Types are compile-time promises; JSON is a runtime liar. Validate at IO edges so all interior code trusts its types.

**Schema-validation boundary pattern:**

```ts
import { z } from "zod";

const User = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.enum(["admin", "member"]),
});
type User = z.infer<typeof User>; // single source of truth — derived, not duplicated

async function fetchUser(id: string): Promise<User> {
  const res = await fetch(`/api/users/${id}`);
  return User.parse(await res.json()); // throws on bad shape; inside is now safe
}
```

Everything past `parse` uses `User` with zero assertions. The alternative — `await res.json() as User` — is a lie that surfaces as `undefined is not a function` three files away.

**Narrowing toolkit**, cheapest first:

| Tool | Syntax | Best for |
|---|---|---|
| Discriminant check | `if (x.status === "error")` | Discriminated unions |
| `typeof` / `Array.isArray` | `typeof x === "string"` | Primitives, arrays |
| `in` operator | `if ("error" in x)` | Structural checks without a discriminant |
| `instanceof` | `x instanceof HttpError` | Class hierarchies, error handling |
| User-defined predicate | `function isUser(x: unknown): x is User` | Reusable custom checks |
| Assertion function | `function assertUser(x: unknown): asserts x is User` | Fail-fast: throws or narrows, no branching |

A predicate is a promise you write by hand — if `isUser` returns `true` for a non-User, TS believes you. Keep predicates trivial or generate them from schemas.

## Core Framework 4: Generics Discipline

Generics exist to *relate* types: input to output, key to value, element to array. Rules that keep them honest:

- **A type parameter used once is dead weight.** `function log<T>(x: T): void` gains nothing over `log(x: unknown)`. If `T` doesn't appear in at least two positions (or constrain a relationship), delete it.
- **Constrain with `extends`** to require capability: `function longest<T extends { length: number }>(a: T, b: T): T`.
- **Default type params** cut noise at call sites: `interface ApiResponse<T = unknown> { data: T; status: number }`.
- **Let inference work.** If callers must write `f<Foo, Bar, Baz>(...)` routinely, the signature is wrong — reorder params or split the function.
- **Cap the cleverness.** A conditional-type pyramid nobody on the team can modify is worse than two concrete overloads. Optimize for the reader.

## Core Framework 5: satisfies vs as vs Annotation

| | Checks the value? | Widens/changes the type? | Use for |
|---|---|---|---|
| `const x: T = v` | Yes | Widens to `T`, literals lost | Public API surfaces, function params |
| `v satisfies T` | Yes | No — inference preserved | Config objects, literal maps you index into later |
| `v as T` | No | Forces to `T` | Last resort; you know better than the compiler |

```ts
const routes = {
  home: "/",
  user: "/users/:id",
} satisfies Record<string, `/${string}`>;
// typo "users/:id" → error now; routes.home is still the literal "/", not string
```

`as const` is the companion: it freezes literal inference (`readonly`, narrowest types) — the standard way to build enum-like objects and tuple types. Prefer `readonly T[]` in exported signatures; accepting mutable arrays you never mutate needlessly rejects callers holding readonly data.

## Core Framework 6: Derive, Don't Duplicate

Hand-maintained parallel types drift. Derive variants from one source of truth:

| Utility | Derivation | Typical use |
|---|---|---|
| `Pick<T, K>` / `Omit<T, K>` | Subset of fields | `Omit<User, "passwordHash">` for API responses |
| `Partial<T>` / `Required<T>` | Optionality flipped | `Partial<User>` for PATCH bodies |
| `Record<K, V>` | Map type | `Record<UserId, Session>` |
| `ReturnType<typeof f>` | From implementation | Type what a factory returns without restating it |
| `Parameters<typeof f>` | From implementation | Wrappers, memoizers, test helpers |
| `z.infer<typeof Schema>` | From runtime schema | The IO boundary (Framework 3) |

If `CreateUserInput` is `User` minus `id` and `createdAt`, write `Omit<User, "id" | "createdAt">` — when `User` gains a field, the variant updates itself.

## Workflow

1. **Read the config first.** `tsc --version` and `tsconfig.json`. Note `strict`, `noUncheckedIndexedAccess`, `module`/`moduleResolution`. Everything downstream depends on this.
2. **Model the domain before writing signatures.** List the valid states; if fewer than the representable combinations, reach for a discriminated union (Framework 1). Add brands for IDs that cross function boundaries.
3. **Fence the IO.** Put schema validation at every point untyped data enters (Framework 3). Interior code should contain zero `as` on external data.
4. **Debug inference from the inside out.** For a confusing error: hover the innermost expression first, then outward until the type stops matching your expectation — that's the fault line. Split complex expressions into named intermediates (`const step1 = ...`) to force TS to show its work; extract intermediate type aliases (`type Step = ReturnType<typeof f>`) and hover those. Read compiler errors bottom-up: the last "Type X is not assignable to type Y" line is usually the root cause; the lines above are the path to it.
5. **Audit escape hatches.** `grep -rn "as any\|: any\|@ts-ignore" src/ | wc -l` for a baseline. Walk each hit down the ladder (Framework 2). Replace `@ts-ignore` with `@ts-expect-error` — it errors when the underlying problem is fixed, so suppressions self-expire.
6. **Migrating a loose codebase to strict — stage it, highest value per flag:**
   1. `"noImplicitAny": true` — forces explicit types at declaration sites; touches signatures, mechanical to fix.
   2. `"strictNullChecks": true` — the highest-value flag in the compiler; surfaces the null/undefined bugs that dominate production error logs. Expect the bulk of migration effort here.
   3. `"strict": true` — the remainder (`strictFunctionTypes`, `strictBindCallApply`, `strictPropertyInitialization`, `useUnknownInCatchVariables`) is small after the first two.
   4. For each stage: enable the flag, add `// @ts-expect-error TODO(strict): <reason>` on every new error to get green, then burn the count down to zero before the next stage. Track the number in CI so it only goes down.
   5. Big repo? Roll out per-directory: separate `tsconfig.strict.json` with an `include` list, run both configs in CI, move directories over as they're cleaned.
7. **Verify.** `tsc --noEmit` clean, suppression count not up, and an exhaustiveness check (`assertNever`) on every discriminated-union switch.

## Common Mistakes

1. **Boolean flags instead of a union.** `isLoading` + `isError` + optional `data` allows impossible combinations, and every consumer re-derives the state machine. Fix: one `status` discriminant with payload on the correct variant (Framework 1).
2. **`as` to silence errors on incoming data.** `json as User` doesn't check anything — it postpones the crash and strips the stack trace of meaning. Fix: `parse` at the boundary; assertions only for what TS genuinely can't know, at the narrowest expression.
3. **`interface Props { [key: string]: any }` and other `any`-typed grab bags.** One `any` field launders everything read through it. Fix: `unknown` if the shape is truly open, or model the actual fields.
4. **Non-exhaustive switches on unions.** Works today; silently mishandles the variant added next quarter. Fix: `default: return assertNever(x)` so growth is a compile error, not a runtime mystery.
5. **Redundant generics.** `function first<T, U extends T[]>(arr: U): T` — `U` relates to nothing. Fix: `function first<T>(arr: readonly T[]): T | undefined`. One parameter, used twice, honest about the empty case.
6. **Duplicating types the compiler can derive.** A hand-written `UserUpdate` that shadows `User` field-for-field drifts on the first schema change. Fix: `Partial<Omit<User, "id">>` — one source of truth.
7. **`@ts-ignore` instead of `@ts-expect-error`.** `@ts-ignore` suppresses forever, even after the error is gone, hiding new breakage on that line. Fix: `@ts-expect-error` with a reason comment; it fails the build when it's no longer needed.
8. **Annotating where `satisfies` was meant.** `const config: Config = {...}` widens `config.env` from `"prod"` to `string`, breaking downstream narrowing. Fix: `{...} satisfies Config` — same validation, inference intact.

## Output Format

When answering a TypeScript question, deliver:

1. **Diagnosis** — one or two sentences: what the type-level problem actually is (modeling gap, missing narrowing, boundary leak), not just what the error says.
2. **The fix** — complete, compiling code with the discriminants, guards, or derivations in place. Show before/after only when the delta is the lesson.
3. **Why it works** — one short paragraph tying the fix to the principle (which framework above), so it transfers to the next occurrence.
4. **Config or version caveats** — only if relevant: flags required, minimum TS version, behavior differences under non-strict settings.

For migration or audit tasks, lead instead with the staged plan (flag order, suppression counts, per-directory rollout) and give per-stage exit criteria. Keep prose tight; let the code carry the detail.
