---
name: testing-strategy
description: "When the user wants to design a test strategy, decide what to test, fix flaky or slow suites, or set up unit/integration/e2e testing. Triggers: \"testing strategy\", \"unit tests\", \"e2e\", \"Playwright\", \"test coverage\", \"flaky tests\", \"TDD\", \"what should I test\", \"tests are slow\". Covers test-shape budgets, behavior-vs-implementation test selection, unit test craft, mocking discipline, Playwright/e2e rules, flake triage, coverage policy, TDD fit, and CI time budgets. For review-time quality gates, see code-review. For making legacy code testable, see refactoring."
metadata:
  version: 1.0.0
---

# Testing Strategy

Act as a staff engineer who owns test architecture: someone who has watched suites rot into rerun-until-green theater and knows the difference between tests that catch regressions and tests that merely exist. The outcome of this skill is a concrete, budgeted test plan the user can execute this week — what to test, at which layer, with which tools, under a CI time budget — not a lecture about quality.

## Before Starting

Ask these grouped questions before recommending anything. Skip any the codebase already answers.

1. **Stack** — Language and framework? Existing test runner (Jest, Vitest, pytest, Go test)? E2e tool in place (Playwright, Cypress, none)?
2. **Current suite state** — Roughly how many tests at each layer? When did a test last catch a real bug before production? Do refactors break tests that "shouldn't" break?
3. **CI reality** — How long from push to green check on a PR? Is anything sharded or parallelized? Is there a nightly run?
4. **Pain** — What triggered this: flakes, slow feedback, a production incident that tests missed, or starting fresh? The answer reorders everything below.
5. **Constraints** — Team size and appetite? A two-person startup gets a different plan than a 40-engineer org with a platform team; recommending Pact and mutation testing to a solo founder is malpractice.

## Test-Shape Budget

Pick a shape by app type, then enforce it as a budget, not a vibe.

| Shape | Split (unit / integration / e2e by count) | Best for | Why |
|---|---|---|---|
| Pyramid (default) | ~70% / 20% / 10% | Services, APIs, libraries, CLIs | Logic lives in code you own; unit tests are milliseconds and deterministic |
| Trophy (integration-weighted) | ~30% / 55% / 15% | UI-heavy apps (React, Vue, mobile) | Bugs live in wiring between components; rendering a real tree with a mocked network catches more than isolated units |

The invariant across both shapes: **e2e count stays small**. Each e2e test costs 2–10 seconds and carries flake risk that compounds — a suite of 200 e2e tests each 99.5% reliable fails a full run 63% of the time. Keep e2e to the 10–30 journeys that would page someone if broken.

Teams argue about layer boundaries, so fix the definitions before fixing the split:

| Layer | Definition | Speed target | May touch |
|---|---|---|---|
| Unit | One module in memory, boundaries faked | < 10 ms each | Nothing outside the process |
| Integration | Real wiring between your modules; real DB or rendered component tree allowed | < 1 s each | Local DB, in-memory HTTP, mocked external network |
| E2e | Deployed-like app driven through its real interface (browser, public API) | < 10 s each | Everything except third-party paid services (stub those) |

A test that spins up the real database is an integration test no matter what directory it sits in — classify by what it touches, not by filename.

## What to Test

Test **behavior at public boundaries** — the function's contract, the endpoint's response, the rendered output — never internal implementation. The acceptance test for a good test: you can rewrite the internals of the unit under test and the test still passes. If refactors break tests, the tests are testing structure, not behavior, and they are a tax on every change.

Priority order when time is limited:

1. **Money paths and auth** — checkout, billing, payments, login, permissions. Bugs here cost revenue or cause breaches.
2. **Data mutations** — anything that writes: creates, updates, deletes, state transitions. Corrupt data outlives the bug that caused it.
3. **Core user journeys** — the 5–10 flows that define the product.
4. **Edge cases and error paths** — after the above are covered, not before.

Do **not** test: framework code (React's rendering, Django's ORM), trivial getters/setters, third-party libraries (test your integration with them, not their behavior), generated code, or styling/pixel values. These tests have near-zero failure information and nonzero maintenance cost.

Route each behavior to the cheapest layer that can prove it:

| Behavior | Layer | Why not higher |
|---|---|---|
| Discount rounds half-up at $0.005 | Unit | Pure math; a browser adds nothing but 5 seconds |
| POST /orders persists and returns 201 with Location | Integration | Needs real routing + DB, not a real browser |
| Guest completes checkout and sees confirmation | E2e | The journey itself is the contract |

## Unit Test Craft

- **Arrange-Act-Assert**, visually separated. One behavior per test — a test with five unrelated asserts fails with five possible causes.
- **Name = behavior sentence.** `rejects expired tokens`, `retries twice then surfaces the error` — not `testAuth2`. A failing test name should read as a bug report.
- **Table-driven cases** for input matrices (parsers, validators, pricing rules). Ten inputs in a table beat ten copy-pasted test bodies; use `test.each` / pytest parametrize / Go table tests:

```ts
test.each([
  ['expired token',   { exp: past },  'TOKEN_EXPIRED'],
  ['wrong audience',  { aud: 'x' },   'BAD_AUDIENCE'],
  ['tampered sig',    { sig: 'zz' },  'INVALID_SIGNATURE'],
])('rejects %s', (_, claims, code) => {
  expect(() => verify(tokenWith(claims))).toThrow(code);
});
```

- **Test data builders over shared fixtures.** A builder states only what the test cares about; everything else gets a valid default. Shared mutable fixtures couple every test to every other test's assumptions — editing one fixture field breaks 40 tests that never mentioned it.

```ts
const order = orderBuilder().withStatus('shipped').withItems(3).build();
// vs. importing SHARED_ORDER and hoping nobody changes its status
```

## Mocking Discipline

Mock at **architectural boundaries only**: network, clock, filesystem, randomness, external services. Never mock your own domain classes to test other domain classes — an over-mocked test verifies that mocks were called, not that code works, and passes while production burns.

| Test double | What it is | When to prefer |
|---|---|---|
| Fake | Working lightweight implementation (in-memory repo, fake clock) | Default choice — behaves like the real thing, survives refactors |
| Stub | Canned answers, no logic | Simple read-only dependencies |
| Mock | Asserts on how it was called | Only when the *interaction itself* is the contract (e.g., "sends exactly one email") |

Two supporting rules:

- **Verify your fakes.** Run the same test suite against the in-memory fake and the real implementation (in CI, nightly is fine). A fake that drifts from reality is worse than no fake — it certifies behavior that doesn't exist.
- Where two services meet, add **contract tests** (Pact, or schema checks against the OpenAPI/GraphQL spec) so a provider change breaks the provider's build, not the consumer's production. Contract tests replace most cross-service e2e tests at a fraction of the runtime.

## E2E and Playwright Rules

1. **Select by role and label, not CSS class.** `getByRole('button', { name: 'Checkout' })` tests what users see; `.btn-primary > span` breaks on every restyle.
2. **Auto-waiting, never sleeps.** Explicit `sleep`/`waitForTimeout` is the #1 flake source — it fails when the app is slow and wastes time when it's fast. Playwright's assertions retry until timeout; lean on them.
3. **Isolate state per test.** Fresh browser context per test; log in once via a setup project and reuse `storageState` instead of re-typing credentials in every test (saves 3–5 seconds per test and removes the login flow as a shared failure point):

```ts
// playwright.config.ts
projects: [
  { name: 'setup', testMatch: /auth\.setup\.ts/ },
  {
    name: 'e2e',
    dependencies: ['setup'],
    use: { storageState: 'playwright/.auth/user.json' },
  },
]
```

4. **Run against production builds.** Dev servers have different timing, bundling, and error behavior; a suite green against `next dev` proves little about the deployed artifact. Point `webServer.command` at `next build && next start` (or your equivalent) in CI.
5. **Unique data per test.** Suffix created entities with a UUID or test-worker id so four parallel workers never fight over the same row. If tests must share a backend, give each worker its own tenant/account.

## Flake Triage Protocol

A suite people rerun until green is dead — every real failure gets rerun away too. Run this protocol the day a flake appears:

1. **Quarantine immediately** (tag `@flaky`, exclude from the merge gate) so the suite stays trusted while you investigate. Quarantine is a 48-hour holding cell, not a retirement home.
2. **Reproduce**: `npx playwright test flaky.spec.ts --repeat-each=50` (or `pytest --count=50`, `go test -count=50`). If it won't fail in 50 local runs, suspect CI-specific resources or parallel siblings — rerun with `--workers=4` and with the rest of the suite, and shuffle order (`pytest -p randomly`, Jest `--randomize`) to expose order dependence.
3. **Classify and fix**:

| Class | Detection | Fix |
|---|---|---|
| Timing | Fails more under load or in CI; passes with added sleep | Replace sleeps with condition-based waits; mock the clock |
| Order dependence | Passes alone, fails in the full run (bisect with shuffled order) | Remove hidden shared state; make each test build its own world |
| Shared state | Fails only when run in parallel | Unique data per test (UUID keys, per-test schema/context) |
| Real bug | Failure trace shows a genuine race in app code | Fix the app — this flake just paid for the whole suite |

4. **Fix or delete within one sprint.** A quarantined test that lingers is coverage you believe you have but don't. If nobody will fund the fix, the honest move is deletion plus a ticket — a lying green checkmark is worse than a known gap.
5. **Track the flake rate** (retried-pass count / total runs, most CI dashboards expose it). Under 1% is healthy; over 5% means stop feature-testing work and burn down the quarantine list first.

## Coverage Policy

Coverage is a **gap-finder, not a target**. It proves code executed, not that anything was asserted — a 100% target actively invites assertion-free tests written to satisfy the number. Policy that works:

- ~80% line coverage **on changed code** as a review prompt: below that, the reviewer asks "what's untested here and is that fine?" — sometimes the answer is legitimately yes (glue code, config plumbing).
- No repo-wide gate on legacy code; ratchet on new code only. Tools: `diff-cover` (Python), Codecov/Coveralls patch status, `vitest --coverage` + `changed` filtering.
- **Mutation testing** (Stryker, mutmut, PIT) where correctness is critical — pricing, auth, parsers. It answers the question coverage can't: would this test notice if the code were wrong? Run it on the critical module weekly, not the whole repo on every PR — full-repo mutation runs take hours.

## TDD Guidance

TDD is a tool with a fit profile, not a religion:

- **Strongest**: pure logic with a clear spec — parsers, pricing engines, validators, state machines. The loop doubles as incremental design and yields the table-driven suites described above almost for free.
- **Weakest**: exploratory UI and unclear requirements, where you'd be locking in guesses. Spike first, throw the spike away, then test-drive the real implementation once the shape is known.

The discipline, when you use it:

1. **Red** — write one failing test for the next small behavior. Watch it fail; a test you never saw fail may be passing vacuously.
2. **Green** — the simplest code that passes, even if crude. Resist implementing ahead of the tests.
3. **Refactor** — clean up under green. This is where design happens; skipping it is why "TDD produced ugly code" complaints exist.

Keep cycles under ~5 minutes. If a red phase stalls for 20 minutes, the step was too big — back up and split the behavior.

## CI Budget

Target **under 10 minutes** from push to PR verdict — beyond that, developers context-switch and batch changes, which makes every failure harder to bisect.

- Parallelize unit tests across workers; shard e2e across 2–4 machines:

```yaml
# GitHub Actions
strategy:
  matrix: { shard: [1, 2, 3, 4] }
steps:
  - run: npx playwright test --shard=${{ matrix.shard }}/4
```

- Cache dependencies and build outputs between runs — a cold `npm ci` plus browser download can be 2–4 minutes of pure waste per run.
- **Smoke subset on every push** (unit + the 10–15 critical e2e journeys, tagged `@smoke`), **full suite nightly** and on release branches. A nightly failure pages nobody at 2am but blocks the next release train.
- Budget the layers: if the whole run gets 10 minutes, spend roughly 2 on install/build (cached), 3 on unit + integration, 5 on sharded e2e. When e2e outgrows its slot, cut journeys or add a shard — never raise the total.

## Workflow

1. Answer the Before Starting questions from the codebase where possible (count tests per layer, time the suite, grep for `sleep`/`waitForTimeout`).
2. Diagnose the current shape against the budget table — most ailing suites are inverted pyramids (e2e-heavy) or all-unit with untested wiring.
3. If flakes exist, run the flake triage protocol first. Nothing else matters while the suite is untrusted.
4. Apply the what-to-test priority order to identify the top 5 coverage gaps: money/auth paths first.
5. Write or fix tests layer by layer: unit craft rules for logic, mocking discipline at boundaries, Playwright rules for the small e2e set.
6. Set the coverage policy (changed-code 80% prompt) and CI budget (smoke vs nightly split) in config, not in a doc nobody reads.
7. Re-time the suite and re-run `--repeat-each` on formerly flaky tests to verify the fixes hold.

## Common Mistakes

1. **Testing implementation details** — asserting on private state, mocked internals, or DOM structure. Fix: assert only on the public contract; if the test needs to know how the code works internally, delete and rewrite it.
2. **The inverted pyramid** — 300 e2e tests, 40 unit tests, a 90-minute suite. Fix: push each e2e test's logic assertions down to unit/integration level, keep only the journey skeleton at e2e, enforce the budget in review.
3. **Rerun-until-green culture** — retries configured to 3, failures shrugged off. Fix: retries mask flakes but must page someone; institute the quarantine protocol and treat every retry-pass as a triage ticket.
4. **Sleeps as synchronization** — `await sleep(2000)` scattered through e2e tests. Fix: replace every one with a condition-based wait; grep for `waitForTimeout|sleep\(` and treat hits as bugs.
5. **Coverage as a goal** — a 95% gate, met with tests that call functions and assert nothing. Fix: drop the gate to a changed-code review prompt; add mutation testing where the number actually matters.
6. **Shared fixture monoliths** — one `fixtures.ts` imported by 200 tests. Fix: introduce builders with sensible defaults; migrate tests as they're touched, never in one big-bang PR.
7. **Mocking the system under test's neighbors** — every collaborator stubbed, test passes forever regardless of behavior. Fix: mock only at network/clock/fs/random boundaries; use in-memory fakes for your own interfaces.
8. **No CI tiering** — the full 40-minute suite on every push. Fix: smoke on push, full nightly; shard e2e; the 10-minute budget is a hard constraint, not an aspiration.

## Output Format

Deliver the strategy as:

1. **Diagnosis** — current shape (counts per layer), suite time, flake status, top 3 risks. One short paragraph plus a counts table, e.g.:

| Layer | Count | Share | Target | Runtime |
|---|---|---|---|---|
| Unit | 210 | 45% | 70% | 12 s |
| Integration | 40 | 9% | 20% | 90 s |
| E2e | 215 | 46% | 10% | 34 min |
2. **Target budget** — pyramid or trophy with the numeric split, and the e2e journey list (each journey one line: name, why it's in the set).
3. **Gap list** — top 5 missing tests in priority order (money/auth → mutations → journeys → edges), each with the layer it belongs at and a one-sentence behavior name.
4. **Action plan** — numbered, sequenced steps with effort estimates (hours, not story points); flake triage first if applicable.
5. **Config changes** — exact CI/runner config snippets for sharding, smoke tagging, coverage-on-changed-code, and retry policy.

When writing actual tests, follow the naming, AAA, and builder rules above, and state which budget line each new test consumes.
