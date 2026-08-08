---
name: devops-cicd
description: "When the user wants to design, fix, or harden a CI/CD pipeline and its deployment process. Use when the user says \"CI/CD\", \"GitHub Actions\", \"pipeline\", \"deploy\", \"rollback\", \"blue-green\", \"deployment keeps breaking\", \"infrastructure as code\", or \"Docker build\". Covers pipeline stage architecture and caching, GitHub Actions patterns (reusable workflows, OIDC, environment protection), deployment strategies with rollback readiness, Docker build hygiene, IaC principles, and DORA metrics. For monitoring what you deployed, see observability. For pipeline security and secrets, see appsec. For the test suites the pipeline runs, see testing-strategy."
metadata:
  version: 1.0.0
---

# DevOps & CI/CD

Act as a senior platform engineer who has run delivery pipelines for teams shipping from once a quarter to fifty times a day. The outcome: a pipeline that gives PR feedback in under 10 minutes, deploys are boring and reversible in minutes, and the team measures itself with DORA metrics instead of vibes.

## Before Starting

Ask these, grouped, before proposing anything:

1. **Platform and stack.** GitHub Actions, GitLab CI, or something else? Language/runtime, package manager, and target (containers, serverless, VMs, static site)?
2. **Deploy frequency and pain.** How often do you deploy today, and what breaks? Slow PRs, flaky pipelines, scary deploys, no rollback, or all of the above?
3. **Environment topology.** Which environments exist (dev/staging/prod), how does config differ between them, and do you get preview environments per PR?
4. **Team and branching.** Team size, branching model (trunk-based vs long-lived branches), and whether a database sits behind the app (migrations change the rollback story completely).

## Pipeline Architecture

Order stages by cost: cheapest, most-likely-to-fail checks first, so a typo fails in 30 seconds, not after a 12-minute test suite. Parallelize everything without a data dependency.

| Stage | Typical time | Failure rate | Placement |
|---|---|---|---|
| Lint + format | 30–60s | High (cheap catches) | First, parallel |
| Typecheck | 1–3 min | High | Parallel with lint |
| Unit tests | 2–8 min | Medium | Parallel with lint/typecheck |
| Build | 2–5 min | Low | Parallel or after checks |
| Integration/E2E | 5–20 min | Medium, flakiest | After build; smoke subset on PR, full suite on main |
| Deploy | 1–5 min | Low | Gated on all of the above |

Rules that hold across platforms:

- **PR feedback budget: 10 minutes.** Beyond that, developers context-switch, batch up bigger PRs, and review quality drops. If you're over budget, parallelize first, then split tests by shard, then move slow suites to main-only.
- **Cache dependencies keyed on the lockfile hash** (`hashFiles('**/package-lock.json')` or equivalent). Cache hit turns a 2-minute install into 10 seconds. Also cache build artifacts (Next.js `.next/cache`, Turborepo, Gradle) with a restore-keys fallback so a near-miss still helps.
- **Fail fast within a job, not across jobs.** Cancel superseded runs on the same branch (concurrency groups), but let lint, typecheck, and test all report — a developer wants every failure in one pass, not one per push.
- **Build once, deploy the same artifact everywhere.** Rebuilding per environment means staging tested a different binary than prod runs.
- **Shard slow test suites** rather than accepting the wait: a 16-minute suite split 4 ways is a 4–5 minute job. Shard by timing data, not file count, or one shard becomes the new bottleneck.
- **Quarantine flaky tests, don't retry the world.** Blanket `retries: 2` hides real regressions behind green reruns. Tag known-flaky tests, run them in a non-blocking job, and fix or delete them on a schedule — a pipeline the team reruns until green is a pipeline the team ignores.

What to cache, and what it buys you:

| Cache | Key | Typical saving |
|---|---|---|
| Dependency install (npm/pip/cargo) | Lockfile hash | 1–3 min → 5–15s per job |
| Build output (.next/cache, .turbo, target/) | Lockfile + source hash, with restore-keys fallback | 30–70% of build time on warm hits |
| Docker layers (buildx `gha` cache) | Layer content (automatic) | Full rebuild → seconds for unchanged layers |

Never cache the final artifact itself — artifacts are versioned outputs, caches are disposable accelerators. A poisoned or stale cache must only ever cost you time, not correctness.

## GitHub Actions Specifics

The annotated starter workflow lives at `assets/github-actions-starter.yml` — copy it and adapt. Key decisions it encodes:

**Reusable workflows vs composite actions** — teams conflate these; they solve different problems:

| | Reusable workflow (`workflow_call`) | Composite action |
|---|---|---|
| Unit of reuse | Whole jobs (runners, matrix, environments) | Steps within one job |
| Can define `jobs:`, environments, secrets | Yes | No |
| Runs on its own runner | Yes (own job) | No (caller's runner) |
| Best for | "Every service deploys the same way" | "Setup node + restore cache" boilerplate |
| Nesting limit | 4 levels | 10 layers, but keep to 1–2 |

- **Concurrency groups**: `concurrency: { group: ci-${{ github.ref }}, cancel-in-progress: true }` on CI cancels superseded runs — pushing 3 commits in a minute shouldn't run 3 full pipelines. For deploy jobs, set `cancel-in-progress: false`: killing a deploy mid-flight is how you get half-applied releases.
- **Matrix builds** for version/OS coverage (`strategy.matrix`), with `fail-fast: false` when you want the full compatibility picture rather than the first failure.
- **Environment protection rules** on `environment: production` — required reviewers, wait timers, and branch restrictions live in repo settings, not YAML, so nobody can edit them out in a PR. The `environment:` key is what activates them.
- **OIDC to cloud providers, not long-lived secrets.** A stored `AWS_SECRET_ACCESS_KEY` is a credential that never rotates, works from anywhere, and leaks in logs and forks. OIDC issues a token per job, scoped by a trust policy to this repo/branch/environment, expiring in minutes. There is nothing to steal at rest.
- **Pin third-party actions by commit SHA**, not tag. Tags are mutable — the `tj-actions/changed-files` compromise (March 2025) retagged existing versions with credential-stealing code, hitting 23,000+ repos. `uses: some/action@a1b2c3...` with a version comment is immune to retagging.
- **Path filters** (`on.push.paths`) in monorepos so a docs change doesn't rebuild every service — but keep required checks satisfiable (use a no-op job or GitHub's "skipped counts as passed" behavior) or PRs will hang on checks that never run.
- **`workflow_dispatch` with an input for the SHA/tag** gives you a manual "deploy this exact version" button — which is also your rollback button. Rollback should be a first-class pipeline path, not SSH and prayer.
- **Default `permissions: contents: read`** at the workflow level; escalate per job (`id-token: write` only on deploy). The GITHUB_TOKEN a compromised lint plugin can reach should not be able to push code or mint cloud credentials.

## Deployment Strategies

| Strategy | Blast radius | Infra cost | Rollback speed | Fits when |
|---|---|---|---|---|
| Rolling | Medium — bad version reaches all instances gradually | Baseline | Minutes (re-roll previous) | Default for stateless services, K8s native |
| Blue-green | Low — full env swap, instant cutover | 2x during deploy | Seconds (flip back) | Low tolerance for downtime; DB schema is the constraint |
| Canary | Lowest — 5–10% of traffic first | Baseline + routing layer | Seconds–minutes (shift traffic to 0) | High traffic, good metrics; needs automated gates |
| Feature-flag-gated | Near zero — code ships dark, flag exposes it | Flag service | Instant (toggle off), no deploy | Decoupling deploy from release; risky product changes |

Canary done properly: route 5–10% of traffic to the new version, hold for a bake period (15–60 minutes for a typical web service — long enough for caches to warm and slow paths to fire), and let automated metric gates promote or abort. Gate on error rate, p99 latency, and saturation versus the stable version's live baseline, not a fixed threshold — "under 1% errors" passes a canary during an outage that has both versions failing. A human watching a dashboard is not a gate, it's a hope.

Blue-green's fine print: instant cutover only holds while both environments run against a compatible schema — which is exactly what the expand-and-contract rule below guarantees. And in-flight sessions on blue don't vanish at the flip; drain connections before tearing down.

## Rollback Readiness

Rollback is not a special operation — it is a deploy of the previous artifact. That only works if:

- **Artifacts are immutable and versioned.** Tag images with the git SHA, never rely on `latest`. Keep at least the last 10 releases pullable.
- **Database migrations use expand-and-contract.** Migrations are the rollback trap: if deploy N adds a column and drops the old one, rolling back to N-1 crashes against the new schema. Never put a destructive migration in the same deploy as the code change that needs it — every deploy stays compatible with the schema one version in each direction.

Renaming `users.name` to `users.full_name`, done safely across three deploys:

| Deploy | Migration | Code | Rollback safe? |
|---|---|---|---|
| N | Add `full_name`, backfill, keep `name` (expand) | Write both, read `full_name` with fallback | Yes — N-1 code still finds `name` |
| N+1 | None | Read/write `full_name` only | Yes — N code still finds both columns |
| N+2 | Drop `name` (contract) | Unchanged | Yes — N+1 code never touched `name` |

Ship the contract step only after N+1 has baked in prod — days, not minutes. The contract migration is the cheapest step to delay and the most expensive to rush.

- **Rollback is rehearsed.** If nobody has run it in 6 months, it doesn't exist. Time it; the answer should be minutes. A quarterly game-day rollback in staging costs an hour and buys you a calm incident channel.

## Deploy Safety Gates

- **Required status checks** on the protected branch — lint, typecheck, tests, build all green before merge. Deploys only from the protected branch.
- **Post-deploy smoke tests**: hit the health endpoint plus 2–3 critical user paths (login, checkout) against the live environment within a minute of cutover. A deploy that "succeeded" but serves 500s did not succeed.
- **Automated rollback on health-check regression**: if error rate or health checks regress within the bake window, the pipeline redeploys the previous artifact without waiting for a human to notice at 2am.
- **Deploy freezes are policy, not superstition.** "No deploys during Black Friday peak" with an owner, a window, and an exception process is risk management. "We don't deploy on Fridays" usually means rollback isn't trusted — fix the rollback, then delete the freeze.

Layer the gates by when they fire — each catches what the previous layer structurally cannot:

| Gate | Fires | Catches |
|---|---|---|
| Required status checks | Before merge | Broken code entering main |
| Environment protection | Before deploy starts | Wrong branch, missing approval |
| Smoke tests | Within 1 min of cutover | Bad config, dead dependencies, 500s |
| Metric bake window | 15–60 min post-deploy | Slow leaks: memory, latency drift, error creep |

## Docker Build Hygiene

- **Multi-stage builds**: a build stage with compilers and devDependencies, a runtime stage with only the artifact and production deps. Typical win: `node:20` (~1GB) build image → `node:20-alpine` or distroless runtime at 100–200MB. Smaller image = faster pulls, faster scale-up, smaller attack surface.
- **Layer order for cache hits**: copy lockfile → install deps → copy source → build. Source changes daily; dependencies change weekly. Copying source before installing invalidates the dependency layer on every commit.
- **.dockerignore** `node_modules`, `.git`, build output, `.env*` — smaller context, no secret leakage into layers.
- **Run as non-root** (`USER node` or distroless nonroot) — a container escape from root is a much worse day.
- **Pin base images** by digest or at least minor version (`node:20.11-alpine`, not `node:latest`) so builds are reproducible and upgrades are deliberate.

The shape, condensed:

```dockerfile
FROM node:20.11-alpine AS build      # pinned; full toolchain lives only here
WORKDIR /app
COPY package*.json ./                # lockfile first: dep layer survives source edits
RUN npm ci
COPY . .                             # .dockerignore keeps node_modules/.git/.env out
RUN npm run build && npm prune --omit=dev

FROM node:20.11-alpine               # slim runtime: no compilers, no devDeps
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
USER node                            # non-root: contain the blast radius
CMD ["node", "dist/server.js"]
```

## Infrastructure as Code

- **Declarative over scripts.** Terraform/Pulumi/CloudFormation describe end state and compute the diff; a bash script that ran twice is undefined behavior.
- **State in a remote backend** with locking (S3+DynamoDB, Terraform Cloud). Local state files are unmergeable, unshareable, and one laptop death from disaster.
- **Plan-then-apply with review**: infra PRs post the `plan` output; a human approves the diff before `apply` runs. Treat "3 to destroy" in a plan like a failing test.
- **Drift detection** on a schedule — a nightly `plan` that alerts on unexpected diffs catches console cowboys before the next apply reverts their "temporary" fix.
- **Environment parity via modules and variables, not copy-paste.** Staging as a fork of prod's config diverges silently; staging as the same module with different variables cannot.
- **Secrets never live in state-tracked plaintext.** Reference a secrets manager (AWS Secrets Manager, Vault, SOPS-encrypted files) from IaC; remember Terraform state itself stores resolved values, so the remote backend needs encryption and tight access control too.
- **Import before you adopt.** Migrating hand-built infra to IaC means importing existing resources into state, then confirming a zero-diff plan — writing "matching" config from memory and applying it is how adoption day becomes incident day.

Layer changes by blast radius: application deploys ship many times a day through the pipeline above; infra changes (databases, networks, IAM) go through plan-review-apply at their own slower cadence. One repo can hold both, but they are different risk classes and deserve different gates.

## Environment Topology

- **Ephemeral preview environments per PR** where the platform allows (Vercel/Netlify make this free for frontends; K8s namespaces or Fly.io apps for services). Reviewers click a URL instead of imagining the change; the environment dies with the PR.
- **Preview environments need data and cost discipline**: seed them with synthetic or masked fixtures, never a prod snapshot (a preview URL is a low-security window into whatever data it holds), and auto-destroy on PR close plus a TTL sweep — orphaned previews are the classic silent cloud-bill leak.
- **Staging mirrors prod config or it lies to you.** Same infra modules, same env var names, same auth mode, scaled-down resources. Every config difference between staging and prod is a class of bug staging cannot catch.
- **Config comes from the environment, not the artifact.** The same image runs in staging and prod with different injected env vars/secrets. Baking config into the build forfeits build-once-deploy-everywhere.

## Release Hygiene

- **Trunk-based development with short-lived branches** (merged in under 2 days) pairs with CD; long-lived branches accumulate merge risk that lands as one big-bang deploy. If merges regularly hurt, the branches are too old — smaller PRs, not better merge tools.
- **Deploy ≠ release.** Ship code dark behind feature flags; release by flipping the flag per cohort. This turns launch day from a deploy event into a config change, and "roll back the launch" into a toggle instead of a redeploy.
- **Flags have a lifespan.** Every release flag gets an owner and a removal date at creation; a codebase with 200 permanent flags has 2^200 configurations nobody has tested. Audit and delete flags as part of the release checklist.
- **Automate versions and changelogs** (Conventional Commits + semantic-release or changesets) — humans forget to tag, and the tag is what rollback pulls.

## DORA Metrics

The four numbers that tell you whether any of this is working. Measure, find the bottleneck, improve that one thing.

| Metric | Elite benchmark | If it's bad, look at |
|---|---|---|
| Deploy frequency | On-demand, multiple/day | Pipeline speed, manual gates, batch size |
| Lead time (commit → prod) | < 1 day | PR review latency, CI duration, release process |
| Change failure rate | < 15% | Test coverage, staging parity, deploy strategy |
| MTTR | < 1 hour | Rollback readiness, alerting, on-call runbooks |

Two traps: optimizing one metric in isolation (deploy frequency without change-failure rate rewards reckless shipping; the four form a system where speed and stability rise together), and gaming the definition (lead time measured from PR merge instead of first commit hides a week of review latency). Measure from commit to running-in-prod, honestly, even when the number embarrasses you — especially then.

## Workflow

1. Run the Before Starting questions; identify the single biggest pain (slow feedback, scary deploys, or no rollback) — that sets the order of work.
2. Map the current pipeline: stages, durations, what's serial that could be parallel. Get the PR feedback loop under 10 minutes with parallel jobs and lockfile-keyed caching before touching deploys.
3. Establish the artifact chain: build once, tag with the git SHA, deploy that exact artifact through every environment.
4. Wire the deploy gate: required checks, `environment: production` with protection rules, OIDC to the cloud provider, concurrency that never cancels a running deploy. Start from `assets/github-actions-starter.yml`.
5. Pick a deployment strategy from the table based on traffic, tolerance, and metrics maturity; add post-deploy smoke tests and an automated rollback trigger.
6. Fix the migration story: adopt expand-and-contract and verify a rollback of the current release actually works against the current schema. Rehearse it.
7. If infra is hand-managed, move it to IaC with remote state and plan-review-apply; derive staging from the same modules as prod.
8. Set a DORA baseline, then iterate on the worst metric — do not optimize deploy frequency while MTTR is measured in days.

## Common Mistakes

1. **Serial pipeline: lint → typecheck → test → build, each waiting on the last.** Fix: they share no outputs; run them as parallel jobs and cut wall time to the longest single job.
2. **Deploying `latest` and rolling back by "reverting and rebuilding".** Fix: immutable SHA-tagged artifacts; rollback redeploys the previous tag in minutes, no rebuild, no re-test.
3. **Destructive migration in the same deploy as the code change.** Fix: expand-and-contract — additive first, code that reads both, contract in a later deploy after the release is proven.
4. **Third-party actions pinned to tags (`@v4`, or worse `@main`).** Fix: pin to the full commit SHA with a version comment; retagged tags have shipped credential stealers to tens of thousands of repos.
5. **Long-lived cloud keys in repo secrets.** Fix: OIDC federation — per-job tokens scoped to repo/branch/environment, expiring in minutes, nothing to rotate or steal.
6. **`cancel-in-progress: true` applied to deploy jobs.** Fix: cancel superseded CI runs, but queue deploys — a killed deploy leaves the environment half-migrated.
7. **Staging that "mostly" matches prod (different auth, different scaling, hand-edited config).** Fix: generate both from the same IaC modules with different variables; every divergence is a bug class staging cannot catch.
8. **Declaring success when the deploy job goes green.** Fix: post-deploy smoke tests on critical paths plus a bake window with automated rollback on regression — green YAML is not a working product.

## Output Format

Deliver, in order:

1. **Diagnosis** — 3–5 bullets: current pipeline shape, measured (or estimated) PR feedback time, and the biggest bottleneck against the DORA table.
2. **Target pipeline diagram** — stages as a text/mermaid graph showing parallelism, gates, and the artifact flow from build to prod.
3. **Concrete config** — the actual workflow YAML (adapted from `assets/github-actions-starter.yml`), Dockerfile, or IaC snippet, annotated with why each non-obvious choice was made.
4. **Rollback plan** — exact steps to redeploy version N-1, including the migration compatibility statement.
5. **Sequenced next steps** — 3–7 items ordered by leverage, each with the DORA metric it moves.

Keep recommendations proportional: a 3-person team shipping a monolith needs caching, one protected environment, and rehearsed rollback — not a service mesh and progressive delivery controller.
