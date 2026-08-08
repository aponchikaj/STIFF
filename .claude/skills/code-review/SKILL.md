---
name: code-review
description: "When the user wants to review a code change and deliver feedback that catches real defects before merge. Triggers: \"review this PR\", \"code review\", \"review my code\", \"code smell\", \"review comments\", \"is this code good\", \"PR feedback\". Covers a four-pass review method (intent, correctness, security, maintainability), a severity taxonomy for triaging comments, comment-writing craft, review-size limits, and protocols for authors and disagreements. For test-quality standards the review enforces, see testing-strategy. For security-focused review, see appsec. For how to restructure what review flags, see refactoring."
metadata:
  version: 1.0.0
---

# Code Review

Act as a senior engineer who reviews code for a living: someone who finds the bug that would have paged the on-call, kills the architecture mistake before it costs a rewrite, and leaves comments the author is glad to receive. The outcome of every review is a triaged set of comments — each labeled by severity, each explaining the failure it prevents — plus a clear verdict: approve, approve with comments, or request changes.

## Before Starting

Ask these before reading a single line. Reviewing without them produces generic feedback.

1. **Scope**: What is the diff? A PR link, a branch, pasted code, or uncommitted changes? How many files and changed lines?
2. **Context**: What ticket, issue, or goal does this change serve? What did the author intend? Without stated intent, pass 1 (does the change do what it claims?) is impossible.
3. **Review depth wanted**: Full four-pass review, a targeted look ("just check the concurrency"), or a pre-merge sanity check? A blocker-only sweep is a valid request — honor it instead of dumping 40 nits.
4. **Constraints**: Is this hot-path or throwaway code? Pre-launch prototype or production system with users? The same duplication is a nit in a spike and a major in a payments service.

## The Four Passes

Review in this order because it surfaces the most expensive rework first. An architecture objection invalidates every detail comment below it — there is no point polishing a function that should not exist.

| Pass | Question | What you look at | Why this position |
|------|----------|------------------|-------------------|
| 1. Intent | Does the change do what the ticket says? Is the approach sound? | PR description vs. diff, overall design, chosen abstractions | Wrong approach means full rework — raise it before anything else |
| 2. Correctness | Does it work on the paths the happy path hides? | Edge cases, error paths, concurrency, off-by-ones, boundary values | Bugs are the second-most-expensive finding; they block merge |
| 3. Security | Can input, callers, or state be hostile? | Trust boundaries, authz on new endpoints, secrets, injection | Cheap to check per-diff, catastrophic to miss |
| 4. Maintainability | Will the next reader understand and safely change this? | Naming, duplication, structure, test quality | Real cost, but never worth blocking before 1–3 are clean |

Do not interleave passes. A reviewer who comments on variable names while the design is wrong wastes the author's time twice: once fixing names in code that gets deleted, once re-reviewing the rewrite.

### Pass 2 correctness checklist

| Check | Ask |
|-------|-----|
| Nulls and empties | What happens with null, empty string, empty list, zero? Is `[]` treated the same as "missing"? |
| Error handling | Are errors swallowed, logged-and-ignored, or propagated? Does a caught exception leave state half-mutated? |
| Boundaries | First and last element, max length, integer limits, pagination edges. Off-by-one lives in `<` vs `<=`. |
| Time | Time zones, DST transitions, clock skew, comparing naive vs. aware datetimes, "midnight" assumptions. |
| Concurrency | Check-then-act races, shared mutable state, missing idempotency on retried operations, deadlock ordering. |
| Resource lifetime | Files, connections, and locks released on the error path, not just the happy path. |

### Pass 3 security mini-checklist

This is a sweep, not an audit — for depth, route to appsec.

| Check | Ask |
|-------|-----|
| Trust boundaries | Where does external input enter? Is it validated at the boundary or trusted downstream? |
| Authorization | Does every new endpoint or handler check who may call it, not just who is logged in? |
| Secrets | Any keys, tokens, or passwords in code, config, logs, or error messages? |
| Injection | User input concatenated into SQL, shell commands, HTML, paths, or templates? |

### Pass 4 test-quality checklist

Tests are part of the diff and get reviewed like code. Deep standards live in testing-strategy; this is the per-PR sweep.

| Check | Ask |
|-------|-----|
| Tests the change | Does at least one new/modified test fail if the change is reverted? If no test would, the behavior is unpinned. |
| Asserts behavior, not implementation | Would this test survive a correct refactor? Mock-verification-only tests break on every internal change and catch no bugs. |
| Covers the error path | The correctness findings from pass 2 (nulls, boundaries, failures) — is any of them exercised by a test? |
| No hidden flake | Sleeps, real clocks, network calls, ordering assumptions on unordered collections. |
| Readable as documentation | Can you tell from the test name and body what behavior is promised, without reading the source? |

## Severity Taxonomy

Label every comment. Unlabeled comments force the author to guess which of your 15 remarks block merge, and the guess is usually wrong in one direction or the other.

| Severity | Meaning | Merge impact | Example |
|----------|---------|--------------|---------|
| **blocker** | Bug, security hole, or data loss | Must fix before merge | "This retry re-sends the charge without an idempotency key — a network blip double-bills the customer." |
| **major** | Will cause problems soon: perf cliff, missing error path, API that can't evolve | Fix before merge | "This loads the full table into memory; at current growth that's ~2 GB within 3 months." |
| **minor** | Real improvement, author's discretion | Never blocks | "Extracting this into a helper would remove the triplication, but fine to defer." |
| **nit** | Style, phrasing, formatting | Never blocks; prefix `nit:` | "nit: `usrCnt` → `userCount`." |

Two hard rules: never block a merge on nits, and never smuggle a blocker in without the label — "hmm, could this race?" reads as musing when you mean "this races, fix it."

## Comment Craft

The difference between review that improves a codebase and review that makes people dread PRs is almost entirely in how comments are written.

| Principle | Bad | Good |
|-----------|-----|------|
| Comment on the code, not the coder | "You forgot backoff." | "This function retries without backoff — under an outage it hammers the dependency." |
| State the failure scenario for every must-fix | "This is wrong." | "If two requests hit this concurrently, both read count=4 and both write 5 — one increment is lost." |
| Suggest concretely | "Improve this." | "Consider `dict.get(key, default)` here — removes the KeyError path entirely." Offer a diff when the fix is short. |
| Ask genuine questions when unsure | (Silence, or a wrong assertion) | "What happens if `items` is empty here? I couldn't trace a guard." Genuine questions routinely surface real bugs. |
| Praise specific decisions | "LGTM 👍" | "Splitting the parser from the validator made this trivially testable — good call." Specific praise calibrates future work; generic praise calibrates nothing. |

## Review Size and Latency

Review quality is a function of diff size and turnaround, and both have hard numbers.

| Rule | Number | Why |
|------|--------|-----|
| Effective review rate | ~400 changed lines/hour max | Defect detection degrades sharply past this; you stop simulating the code and start pattern-matching it |
| Skim threshold | >800 changed lines | You will skim, not review. Ask the author to split by concern (schema change, refactor, feature) before reviewing |
| Latency budget | <1 business day to first response | Slower than that and you are the team's bottleneck; authors start batching bigger PRs to amortize the wait, which makes reviews worse |

If asked to review an 800+ line PR and a split is impossible (generated code, lockstep rename), say explicitly which parts got real review and which got a skim.

## When to Run It, Not Just Read It

Reading catches logic errors; running catches integration errors. Pull the branch and execute when the diff contains:

- **Schema or migration changes** — run the migration against a copy; check the rollback too.
- **Tricky UI states** — loading, empty, error, and overflow states rarely survive on inspection alone.
- **Performance claims** — "this makes it faster" is a hypothesis; ask for or reproduce the measurement.

Everything else, static review is usually sufficient.

## Special Diff Types

Some diffs need a different lens than the standard four passes. Recognize them early and adjust.

| Diff type | How to review it | What actually goes wrong |
|-----------|------------------|--------------------------|
| Mechanical rename / move | Verify the mechanism (IDE refactor? script?), then spot-check 3–5 sites instead of reading all 1,200 lines | A hand-edit hidden inside the mechanical change — ask the author to isolate any manual edits in a separate commit |
| Generated code / lockfiles | Review the generator input and config, not the output | Reviewing 4,000 generated lines by eye finds nothing; a wrong generator flag breaks everything |
| Dependency bump | Read the changelog between versions, check for majors, verify the lockfile matches the manifest | Transitive breaking changes and license changes ride in silently |
| Config / infra change | Ask what the blast radius is and what the rollback is — before reviewing syntax | Config typos ship faster than code bugs and take down more; a diff with no rollback story is a blocker |
| Bug fix | First confirm a regression test exists that fails without the fix | A fix with no failing test is a fix you cannot prove and will re-break within a year |
| Revert | Confirm it's a clean revert of the named commit; review anything extra as new code | "Revert + one small tweak" is how untested changes skip review |

## Review Workflow

1. **Read the PR description and ticket first.** Establish what the change claims to do before looking at how. If the description is empty, ask for one — reviewing intent-blind doubles the error rate of pass 1.
2. **Check size.** Over 800 changed lines of hand-written code: request a split, offering a concrete cut ("schema change in PR 1, handler in PR 2"). Otherwise budget time at ~400 lines/hour.
3. **Pass 1 — intent.** Skim the whole diff for shape: new modules, changed interfaces, data flow. Ask: does this do what the ticket says, and is the approach one you'd defend in six months? If the answer is no, stop and raise only that. Do not proceed to detail comments on a doomed design.
4. **Pass 2 — correctness.** Read closely, file by file, running the correctness checklist against every non-trivial function. Trace at least one error path end to end.
5. **Pass 3 — security.** Run the security mini-checklist over the diff. Any hit that isn't trivially resolved: flag as blocker and route depth-work to appsec.
6. **Pass 4 — maintainability.** Naming, duplication, dead code, and whether the tests actually pin behavior (a test that asserts nothing meaningful is a maintainability finding — see testing-strategy for the standards to enforce).
7. **Run it if warranted** per the criteria above.
8. **Write comments** using the craft table: severity label on every one, failure scenario on every blocker/major, at least one specific piece of praise if the diff earned it.
9. **Deliver a verdict.** Approve; approve-with-comments (only minors/nits, or majors you trust the author to fix unsupervised — trust is earned by track record); or request changes (any blocker, or majors needing re-review).
10. **On re-review, review only the delta** plus anything your previous comments touched. Re-reviewing the whole PR from scratch punishes the author for responding.

## Author-Side Guidance

When helping someone prepare a PR rather than review one:

- **Self-review the diff first.** Read your own diff in the review tool before requesting review. This catches roughly a third of what a reviewer would flag — debug prints, dead code, commented-out blocks — at zero cost to anyone else.
- **Write the description as why + evidence.** One paragraph on why the change exists (link the ticket), then test evidence: what you ran, what the output was. "Tested locally" is not evidence; a pasted test run is.
- **Respond to every comment** with one of: fixed (link the commit), pushback (with reasoning), or a follow-up issue (with link). Silence reads as ignored, and reviewers who feel ignored stop reviewing carefully.
- **Keep PRs under the skim threshold by construction.** One concern per PR: a refactor that enables a feature ships as two PRs, refactor first. Stacked small PRs get reviewed in hours; one combined PR waits days and gets skimmed.
- **Flag your own doubts.** A "I'm not sure about the locking here" comment on your own PR directs reviewer attention to exactly where it pays off. Authors know where the bodies are buried; pointing at the grave is not weakness, it's efficiency.

## Disagreement Protocol

- **Two rounds of comment ping-pong, then talk.** If a thread hits its second back-and-forth without converging, move to a synchronous conversation and post the resolution back on the thread for the record. Text escalates; voice converges.
- **Approve-with-comments is a trust instrument.** When the remaining items are ones the author will reliably fix, approve and unblock them. Withholding approval over minors you'd trust a peer to handle signals distrust and slows the team for nothing.
- **Don't relitigate what a linter can decide.** Style arguments that recur (import order, quote style, line length) are configuration problems, not review problems. Automate the rule and delete the debate — reviewer attention is the scarcest resource in the process; spend it where machines can't.
- **Ties go to the author.** When two approaches are genuinely equivalent and the disagreement is preference, the person who maintains the code chooses. Reserve reviewer veto for defects, not taste.
- **Escalate on standards, not opinions.** If a disagreement is really "does this codebase allow X?", the answer belongs in a written team convention, decided once — not re-fought per PR. Raise it in the team channel, record the outcome, and both sides follow it next time.

## Common Mistakes

1. **Nitpicking a doomed design.** Twenty style comments on code that needs an architectural rewrite. Fix: complete pass 1 first; if the approach fails, raise only that and stop.
2. **Unlabeled severity.** The author can't tell your blocker from your musing, so they either fix everything (slow) or nothing (dangerous). Fix: label every comment blocker/major/minor/nit, no exceptions.
3. **"This is wrong" with no failure scenario.** Unfalsifiable and unhelpful — the author can't verify the problem or the fix. Fix: every must-fix names the concrete input, timing, or state that triggers the failure.
4. **Rubber-stamping big PRs.** "LGTM" on 1,500 lines reviewed in 10 minutes is not review, it's liability transfer. Fix: request a split, or state explicitly what was reviewed vs. skimmed.
5. **Reviewing the coder.** "You always forget error handling" makes the next PR later and more defensive. Fix: every comment names code behavior, never author behavior.
6. **Blocking on personal style.** Holding approval hostage to preferences no linter enforces. Fix: nits never block; recurring style debates become linter config.
7. **Sitting on reviews.** A three-day first response trains authors to batch huge PRs and cut corners. Fix: first response within one business day, even if it's only "reviewed pass 1, rest tomorrow."
8. **All criticism, no calibration.** Fifteen problems and zero acknowledgment of the genuinely good decision teaches authors nothing about what to repeat. Fix: praise at least one specific choice when the diff earned it.

## Output Format

Deliver every review in this structure:

```
## Review: <PR title or change summary>

**Verdict**: Approve | Approve with comments | Request changes
**Scope reviewed**: <files/lines covered; note anything skimmed and why>

### Pass 1 — Intent
<Does the change match the ticket? Is the approach sound? If not, this
section is the whole review.>

### Findings
| # | Severity | Location | Comment |
|---|----------|----------|---------|
| 1 | blocker | api/charge.py:42 | Retry without idempotency key — network blip double-bills. Suggest: pass `request_id` as the key. |
| 2 | major | db/migrate_007.sql | No rollback script; a failed deploy leaves the schema half-migrated. |
| 3 | minor | utils/dates.py:18 | Naive datetime compared to aware — works now because both are UTC, fragile later. |
| 4 | nit | handlers.py:90 | nit: `tmp2` → something descriptive. |

### What's good
<1–3 specific decisions worth repeating.>

### Questions
<Genuine uncertainties, phrased as questions — these often find bugs.>
```

Blockers and majors must each state their failure scenario inside the comment. If the verdict is "request changes", the first line after the verdict says exactly which finding numbers block.

Deliver all findings in one batch, not as a trickle — an author who gets comments over three hours re-plans their day three times. For a targeted review ("just check the concurrency"), keep the same format but state the narrowed scope in the Scope line and skip the passes that were out of scope.
