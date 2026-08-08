---
name: refactoring
description: "When the user wants to restructure existing code safely, pay down technical debt, or decide whether to rewrite versus refactor a legacy system. Triggers: 'refactor', 'legacy code', 'technical debt', 'this code is a mess', 'rewrite or refactor', 'strangler pattern', 'untangle this', 'god class'. Covers the rewrite-vs-refactor decision, characterization tests, seam identification, strangler-fig migration, the high-frequency refactoring catalog, and debt triage so behavior-preserving change ships in small reversible steps. For the tests that make refactoring safe, see testing-strategy. For type-driven restructuring, see typescript-patterns. For review standards on refactor PRs, see code-review."
metadata:
  version: 1.0.0
---

# Refactoring

Act as a staff engineer who has untangled multiple 100k+ line legacy systems without a single behavior regression. The outcome of this skill is a concrete, low-risk restructuring plan: verify current behavior first, change structure in small reversible steps, and measure whether the change actually unblocked the work that motivated it. Refactoring is a means — the end is making a specific next change cheap.

## Before Starting

Ask these before proposing any restructuring. Skip only the ones already answered in context.

1. **Codebase state.** What is the target — a function, a class, a module, a whole service? Roughly how many lines? What language and framework, and is the code under active feature development or in maintenance mode?
2. **Test safety net.** What tests exist around the code you want to change, and do they pass today? Can you run them locally in under a few minutes? If there are no tests, is the code deterministic enough to snapshot its outputs?
3. **Why now.** What specific change is currently blocked or painfully slow because of this code's structure? How often do you touch this code — weekly, monthly, or almost never?
4. **Constraints.** Can you ship incrementally (feature flags, parallel routes, small PRs), or must everything land at once? Who reviews these PRs and how large a diff will they realistically absorb?

If the answer to question 3 is "nothing, it just looks bad," stop and say so: debt in code nobody changes costs nothing. Redirect effort to a hotspot that is actually blocking work.

## Rewrite vs. Refactor

Default to refactoring. A working system encodes years of edge-case knowledge — timezone quirks, weird customer data, half-documented integrations — and a rewrite discards all of it while feature work stalls for months. Most "we need a rewrite" situations are actually "we need seams and tests." This is the second-system trap: the rewrite is imagined as clean because it does not exist yet, and it accretes the same complexity plus new bugs the old system already fixed.

| Situation | Decision | Why |
|---|---|---|
| Code is ugly but works and changes ship, slowly | Refactor | Structure problems yield to incremental moves; ugliness alone never justifies a rewrite |
| Architecture wrong for current scale, but modules can be replaced one at a time | Refactor via strangler fig | Incremental replacement keeps the system shippable the whole time |
| Platform is dead (unsupported runtime, unbuildable toolchain, unhirable stack) | Rewrite | You cannot refactor what you cannot build and deploy |
| Architecture fundamentally wrong for current scale AND every incremental path is genuinely blocked (prove it: name the seam you tried) | Rewrite, scoped to the blocked subsystem | Only when a migration slice cannot even be attempted |
| Codebase is small — under ~10k lines — and well understood | Rewrite is acceptable | Small enough to re-encode the edge cases in weeks, not years |
| "The old team is gone and nobody understands it" | Refactor | A rewrite by people who don't understand the system loses exactly the knowledge they lack; characterization tests recover it |

If you do rewrite, apply the strangler-fig discipline below anyway — big-bang cutover is the failure mode, not the rewrite itself.

## Characterization Tests First

You cannot refactor safely what you cannot verify. Before touching structure, pin current behavior — including current bugs. A characterization test asserts what the code *does*, not what the spec says it *should* do; if you fix a bug mid-refactor, you can no longer tell which diff caused which change.

| Technique | Use when | How |
|---|---|---|
| Characterization test | Legacy function with unclear behavior | Call it with representative inputs, assert whatever it returns today; write the assertion after observing the output |
| Golden master / snapshot | Complex or large outputs (rendered HTML, generated reports, serialized state) | Capture full output to a file, diff against it on every run |
| Approval test | Output too big to eyeball as inline assertions | Same as golden master but with tooling (ApprovalTests, jest snapshots) that makes reviewing diffs cheap |
| End-to-end pin | No unit seam exists at all | Record real request/response pairs at the system boundary and replay them |

Aim for coverage of the seam you are about to change, not the whole file. Ten inputs that exercise every branch of the function you're extracting beat 200 tests elsewhere. Delete or promote characterization tests once real spec-driven tests exist — they pin bugs on purpose, so they should not outlive the refactor by much.

The writing loop for a single characterization test:

```
1. Call the code with a representative input.
2. Assert something you expect to be wrong: expect(result).toBe("???")
3. Run it. The failure message tells you the actual behavior.
4. Paste the actual value into the assertion. Now the test passes and documents reality.
5. Mutate the production code deliberately (flip a conditional). The test must fail.
   If it doesn't, the input isn't exercising the branch you think it is.
```

Step 5 is the one people skip and the one that matters: a safety net you have never seen catch anything is a hope, not a net. Choose inputs by reading the branches — one input per path through the code you are about to restructure, plus the boundary values any comparison touches (0, empty, null, max).

## Seams and Sprouting

A seam (Feathers) is a place where you can change behavior without editing the code that has it. Finding seams is the core skill of legacy work — every safe refactor starts by locating or creating one, because a seam is both where you inject test doubles today and where you swap implementations tomorrow.

| Seam type | Where it lives | How you exploit it |
|---|---|---|
| Object seam | Interface or virtual method call | Substitute a test double or a new implementation at construction |
| Constructor / parameter seam | Dependency passed in rather than instantiated inline | Inject a fake in tests, a new component in production |
| Function-argument seam | A callback, strategy, or plain function parameter | Pass different behavior without touching the caller |
| Module boundary seam | Import site, package boundary | Wrap or re-export; swap the implementation behind the same name |
| Link / build seam | Linker, module resolution, build config | Point the same import at different code per environment — last resort, invisible in the source |

If no seam exists, the first refactor is creating one — usually extract-and-inject: pull the inline dependency (`new HttpClient()`, direct DB call, `Date.now()`) into a constructor parameter with the old behavior as the default. That change is mechanical, near-zero-risk, and unlocks everything after it.

When you need to add new logic to a mess, do not thread it through the mess. **Sprout** instead:

- **Sprout method:** write the new logic as a fresh, fully-tested function; add one call site inside the legacy method. The legacy code gets one new line; the new behavior gets 100% coverage.
- **Sprout class:** same move when the new logic has its own state or dependencies. The old god class gains a field and a delegation call, nothing more.

Sprouting means new code is never held hostage by old code's untestability, and every sprout is a future extraction point.

## Strangler-Fig Migration

For replacing a subsystem — an API, a service, a module — route around it rather than through it. Each step ships independently and reverses cleanly. The pattern scales down further than people assume:

| Scope | Facade | Slice unit | Cutover mechanism |
|---|---|---|---|
| External API | Gateway / reverse proxy | One endpoint | Route rule per path, percentage rollout |
| Internal service | Client wrapper or service mesh rule | One RPC / capability | Feature flag or traffic split |
| Module in a monolith | A thin interface both implementations satisfy | One function or use case | Flag or config switch at the facade |
| Single god class | The class's own public methods | One method's logic, sprouted out | Direct delegation, no flag needed |

1. **Facade.** Put a routing layer in front of the old system (API gateway, module-level facade, feature flag). All callers go through it; behavior is unchanged. Ship this alone.
2. **Slice.** Pick the smallest coherent capability — one endpoint, one command, one report. Implement it in the new system behind the facade. Route a fraction of traffic (or one tenant, or internal users) to it; compare outputs against the old path before routing 100%.
3. **Anti-corruption layer.** Translate at the boundary so old data models and quirks never leak into the new code. Without this the new system inherits the old system's shape and the migration was pointless.
4. **Shrink.** Repeat slice by slice. Each cutover deletes or dead-ends the corresponding old code path immediately — dual maintenance is where migrations go to die.
5. **Delete.** When the facade routes nothing to the old system, remove it and the facade. A strangler fig that never finishes strangling is two systems forever; put the deletion milestone on the roadmap on day one.

Every slice must be individually shippable and individually reversible. If a slice needs three other slices to land first, it is too big.

## Refactoring Catalog — High-Frequency Moves

| Move | Trigger | Note |
|---|---|---|
| Extract function / variable | A block needs a comment to explain it, or an expression is unreadable | The name is the point; extraction that needs a vague name is premature |
| Inline function / variable | Indirection with no behavior — a function that only calls another | Delete needless hops; inlining is a refactoring too |
| Replace nested conditionals with guard clauses | Arrow-shaped code, 3+ levels of nesting | Early returns for edge cases; happy path at zero indentation |
| Move function | A function reads or writes another module's data more than its own | Put behavior where its data lives; kills feature envy |
| Introduce parameter object | 3+ parameters travel together across multiple signatures | Below 3, or in one signature only, it's ceremony |
| Replace conditional with polymorphism | The *same* type-switch appears in 3+ places | One or two switches on a type are fine; don't build a class hierarchy to delete a single if |
| Split god class | Distinct data clumps — fields only ever used together by distinct method groups | Split along the clump lines; each clump plus its methods is a class trying to get out |

Apply moves one at a time with green tests between each. A refactor is a sequence of trivially-correct steps, not one clever leap.

Sequencing matters — some moves unlock others:

- Guard clauses first: flattening nesting exposes the real structure, and extractions cut cleaner from flat code.
- Extract before move: pull the function out where it is, verify, then relocate it — two small diffs instead of one confusing one.
- Rename freely and early: renames are the cheapest move with the highest comprehension payoff, and IDE-automated renames are effectively risk-free.
- Split the god class last: after guard clauses, extractions, and moves, the data clumps are visible and the split is mostly mechanical.

## Debt Triage

Not all debt is worth paying. Score each candidate:

**priority = change frequency × pain per change**

| Quadrant | Example | Action |
|---|---|---|
| Touched weekly, painful | The pricing module every feature PR wades through | Refactor now; highest ROI in the codebase |
| Touched weekly, mildly annoying | Verbose but clear handlers | Boy-scout improvements only |
| Rarely touched, painful | Gnarly but stable report generator | Leave it; add characterization tests only when a change actually arrives |
| Rarely touched, mildly annoying | Ugly utility from 2019 that just works | Never touch it |

Find hotspots empirically, not by gut: cross git churn with complexity. Files in the top decile of both commit count (last 12 months) and cyclomatic complexity are the refactoring backlog; everything else is noise. `git log --since="12 months ago" --format= --name-only | sort | uniq -c | sort -rn | head -20` gets churn in one line; any complexity tool (lizard, radon, ESLint's `complexity` rule) supplies the other axis.

## Metrics Honesty

"The code is cleaner" is not a result. Capture three numbers before starting and re-measure after; report them even when they are unflattering.

| Metric | Before | Target after | How to measure |
|---|---|---|---|
| Cyclomatic complexity of the target | e.g. 42 | Under 10 per function | lizard / radon / ESLint complexity rule |
| Test coverage on the changed seam | e.g. 0% | Every branch of the touched code | Coverage report scoped to the target files, not the repo average |
| Time-to-change for the blocked feature | e.g. "3 days, touches 9 files" | "Half a day, touches 2 files" | Estimate before; actual when the feature ships |

The third row is the only one stakeholders care about, and the only honest justification for the time spent. Complexity dropping while the blocked feature stays blocked means you refactored the wrong thing — say so in the report rather than burying it.

## Workflow

1. Name the blocked change. Write one sentence: "Refactoring X so that Y becomes a small change." If Y doesn't exist, stop (see Debt Triage).
2. Run hotspot analysis if choosing among targets: churn × complexity, top decile of both.
3. Record baseline numbers: cyclomatic complexity of the target, test coverage on the seam, and rough time-to-change for the blocked feature today.
4. Build the safety net: characterization / golden-master tests covering every branch of the seam you will touch. Confirm they fail when you deliberately break the code, then pass.
5. Find or create the seam: interface, injection point, or module boundary. Sprout new logic rather than threading it through legacy code.
6. Apply catalog moves in the smallest possible steps — one move, run tests, commit. Every commit is green and behavior-preserving.
7. Keep refactor commits and PRs free of behavior changes. If you find a bug, note it and fix it in a separate PR after the refactor lands.
8. For subsystem replacement, run the strangler-fig loop: facade → slice → verify → shrink → delete, with an anti-corruption layer at the boundary.
9. Re-measure against step 3: complexity delta, coverage delta, and — the one that matters — did the blocked change get cheap? Report all three.
10. Promote characterization tests to spec tests or delete them; fix the bugs they pinned, now as visible, isolated diffs.

## Common Mistakes

1. **Refactoring and changing behavior in the same PR.** The diff becomes unreviewable — no reader can separate intended behavior change from accidental. Fix: two PRs, refactor first, behavior second; the refactor PR's tests are identical before and after.
2. **Fixing bugs found during characterization.** Fixing them mid-refactor destroys your baseline — you can no longer attribute output diffs. Fix: pin the bug in the test, add a comment, file an issue, fix after the refactor lands.
3. **The 3,000-line big-bang refactor branch.** It drifts from main for weeks, the merge is a war, and reverting is impossible. Fix: slices under ~400 lines, each shippable; if a step can't ship alone, decompose it further.
4. **Replacing one conditional with a class hierarchy.** Polymorphism at 1–2 variants adds indirection without removing duplication. Fix: wait for the third variant and the third duplicated switch; until then a plain if is simpler.
5. **Refactoring code you never touch.** Stable ugly code has zero carrying cost; the week spent gold-plating it was stolen from a hotspot. Fix: run the churn × complexity check before choosing any target.
6. **The eternal strangler fig.** Both systems run forever, doubling every on-call surface and change. Fix: schedule the deletion milestone up front; dead-end each old slice the moment its replacement takes 100% of traffic.
7. **Letting old models leak into the new system.** Without an anti-corruption layer, the new code mirrors the old schema and quirks — a rewrite of the same design. Fix: translate at the facade; the new system defines its own types.
8. **Boy-scouting the whole campsite.** "While I'm here" edits in ten unrelated files bloat the diff and invite conflicts. Fix: scope boy-scout cleanups to files the actual change already touches; anything bigger becomes its own triaged item.

## Output Format

Deliver a refactoring plan as:

1. **Goal sentence** — "Refactoring X so that Y becomes a small change," plus the rewrite-vs-refactor call and the one-line justification from the decision table.
2. **Baseline** — current complexity, seam coverage, time-to-change estimate; hotspot data if it drove target selection.
3. **Safety net** — which characterization/golden-master tests to write, the inputs that cover every branch, and how to verify they catch deliberate breakage.
4. **Step sequence** — numbered, each step one catalog move or one strangler slice, each independently green and revertable, with estimated diff size.
5. **PR split** — which steps group into which PRs; behavior changes listed separately as follow-ups.
6. **Exit criteria** — the before/after numbers to report and the deletion milestone for any old code left running.

Keep code examples in the plan minimal — signatures and seams, not full implementations. When executing rather than planning, follow the workflow above and report the step-9 measurements at the end.

Skeleton:

```
Goal: Refactoring OrderProcessor so that adding a payment provider becomes a 1-file change.
Decision: Refactor (arch fits scale; incremental path exists via provider seam).
Baseline: complexity 47, seam coverage 0%, last provider took 4 days / 11 files.

Safety net:
  - Characterization: process() with card / wallet / invoice / refund inputs (8 cases)
  - Golden master: generated receipt HTML for 3 representative orders

Steps (each = 1 green commit):
  1. Guard clauses in process()                       (~40 lines)
  2. Extract validateOrder(), chargePayment()         (~80 lines)
  3. Extract PaymentProvider interface; inject via ctor (~60 lines)
  4. Move card/wallet logic into provider classes     (~120 lines)

PRs: steps 1–2 (PR 1), steps 3–4 (PR 2). Bug found in refund rounding -> issue #482, separate fix PR.
Exit: complexity < 15, seam branches covered, next provider estimated < 1 day.
```
