# STIFF

Monorepo for the STIFF brand project. Each app has its own `package.json` —
always `cd` into the right one before running npm commands.

## Structure

- `frontend/` — Next.js 16 (App Router, `src/` dir, `@/*` alias) + TypeScript + Tailwind CSS v4
- `backend/` — NestJS 11 + TypeORM + PostgreSQL
- `admin/` — the admin panel, same stack as `frontend/` (`admin` branch only)
- `staff/` — the staff workspace, same stack (`staff` branch only)

## Commands

### Frontend (`frontend/`)

- `npm run dev` — dev server on http://localhost:3000 (Turbopack)
- `npm run build` — production build
- `npm run lint` — ESLint

### Admin panel (`admin/`, on the `admin` branch)

- `npm run dev` — dev server on http://localhost:3002
- `npm run build` / `npm run lint` / `npm run typecheck`

Signs in at `/login` against `/api/admin/auth/login` — its own session, not the
shop's. Admins are ordinary shop users with `role=admin`; nobody registers
here.

### Backend (`backend/`)

- `npm run start:dev` — watch-mode dev server on http://localhost:4000
- `npm run build` — compile to `dist/`
- `npm run test` — Jest unit tests
- `npm run test:e2e` — e2e tests
- `npm run lint` — ESLint (flat config)

## Branches — three products, one repo

There are three deployed sites and one shared NestJS backend, and the branches
exist to keep them apart. **Which branch a change belongs on is decided by
which site it is for, not by how big it is.**

| Branch | Carries | Deploys to |
|---|---|---|
| `main` | `frontend/` + `backend/` | stiff.ge (production shop) |
| `stage`, `pre-prod` | same as `main` | stage.stiff.ge, pre-prod.stiff.ge (behind the Basic-auth gate) |
| `staff` | everything in `main` **plus** `staff/` | staff.stiff.ge |
| `admin` | everything in `main` **plus** `admin/` | admin.stiff.ge |
| `coming-soon` | the original holding page | historical — do not build on it |

`staff` and `admin` are **supersets** of `main`, not siblings of it. Both need
the same backend the shop does, because one Nest app serves them all: `/api/*`
is the shop, `/api/staff/*` is the workspace, `/api/admin/*` is the panel's
session and audit trail. That is why `backend/src/staff/` and
`backend/src/admin/` live on every branch while `staff/` and `admin/` — the two
extra Next.js apps — live only on their own.

The admin panel is the odd one: its *work* is not in `backend/src/admin/`. The
panel edits products, orders and gallery through the shop's own controllers
under `@Roles('admin')`, so there is one implementation of "update an order"
rather than two that drift. `backend/src/admin/` holds only what the separate
origin needs — sign-in, the IP allowlist, the audit trail.

### Where to put a change

- **Shop work** — anything in `frontend/`, or in `backend/` outside
  `src/staff/`: products, cart, orders, promotions, returns, gallery, collab.
  → commit on **`main`** (or `stage` / `pre-prod` when the user names those).
- **Staff workspace work** — anything in `staff/`, or in `backend/src/staff/`:
  chat, tasks, notes, people, roles.
  → commit on **`staff`**.
- **Admin panel work** — anything in `admin/`: the tabs, the panel's chrome,
  its sign-in screen.
  → commit on **`admin`**.
  But a change to what a tab *does* to a product or an order is shop work in
  `backend/`, and belongs on **`main`**.
Never author shop work on `staff` or `admin`. It will reach that subdomain and
never reach stiff.ge, and moving it later means rewriting history.

### Keeping `staff` and `admin` current

They take shop work by merging, never by having it authored there:

```bash
git checkout staff && git merge main
git checkout admin && git merge main
```

Do this whenever `main` moves, so no subdomain is running a months-old
backend. The reverse direction never happens — neither is merged into
`main`, or the staff or admin app would land on stiff.ge.

### Promotion

There is no mandatory pipeline. `stage` and `pre-prod` are independent deploys
for testing, not gates. Push to whichever branch the user names — "push to
main" means push directly to `main`.

To move the shop forward everywhere:

```bash
git checkout main && git push origin main
git checkout stage    && git merge main && git push origin stage
git checkout pre-prod && git merge main && git push origin pre-prod
git checkout staff    && git merge main && git push origin staff
git checkout admin    && git merge main && git push origin admin
```

### Migrations are shared

Every branch runs against the **same** hosted Supabase database, so a migration
merged anywhere is live everywhere. Two consequences:

- A migration must be safe for a branch that does not have the code for it yet.
  Add columns with defaults; do not drop something a deployed branch still
  reads.
- Migration timestamps must keep increasing across branches. Check
  `backend/src/migrations/` on `main` before choosing one, not just the branch
  you are on.

### Pushing workflows

`.github/workflows/` needs a token with the `workflow` scope. Without it the
push is rejected with *"refusing to allow a Personal Access Token to create or
update workflow"* — the fix is on the token, not the branch.

## Conventions

- **No Docker.** PostgreSQL runs as a local install on the machine
  (EDB installer, `/Library/PostgreSQL/`). Never add Docker files or suggest
  Docker-based workflows.
- All backend routes are prefixed with `/api` (set via `setGlobalPrefix`).
- Backend reads config from `backend/.env` via `@nestjs/config` (global).
  Database connection settings are `DB_HOST`, `DB_PORT`, `DB_USERNAME`,
  `DB_PASSWORD`, `DB_NAME`.
- TypeORM uses `autoLoadEntities` — register entities via
 `TypeOrmModule.forFeature` in feature modules.
- **`synchronize` is off everywhere.** Schema changes go through migrations in
 `backend/src/migrations/`, reviewed as code like any other change. After
 editing an entity, run `npm run migration:generate -- src/migrations/SomeName`,
 read the generated SQL, then `npm run migration:run`. Pending migrations also
 run automatically on boot unless `DB_MIGRATIONS_RUN=false`.
- The database is a **hosted Supabase Postgres**, shared by local development
 and the deployed site — there is real content in it (the gallery archive).
 Treat every schema change as a production change, and back up with
 `pg_dump --schema=public` (use `/Library/PostgreSQL/17/bin/pg_dump`; the
 Homebrew one is v14 and refuses the v17 server) before structural work.
- Global `ValidationPipe` with `whitelist` and `transform` is enabled —
  use `class-validator` decorators on DTOs.
- Frontend calls the API via `NEXT_PUBLIC_API_URL` from `frontend/.env.local`
  (default `http://localhost:4000/api`). Don't hardcode backend URLs.
- CORS on the backend allows only the known origins — `FRONTEND_URL`,
  `STAFF_FRONTEND_URL`, `ADMIN_FRONTEND_URL` and the stiff.ge subdomains
  (`corsOrigins()` in `backend/src/configure-app.ts`).
- **Three sessions, one backend, and they are not interchangeable.** Shop
  tokens carry no audience; staff tokens carry `stiff-staff`; admin tokens
  carry `stiff-admin`. `JwtAuthGuard` rejects a staff or admin token presented
  as a shop session even when the signing secret is shared.
  An admin-audience token reaches a route only if it is `@Roles('admin')`, is
  marked `@AdminAllowed()`, or is a `@Public()` **read**. That last restriction
  is not cosmetic: `@Public()` here means "personalises when a user is present",
  and `CartController` carries it at the class level, so allowing writes let an
  admin session empty its owner's cart. Adding `@AdminAllowed()` to a route
  widens what a stolen admin token can do — the rules are pinned by
  `backend/src/common/guards/jwt-auth.guard.spec.ts`, so start there.
- Every state-changing request by an admin is written to `admin_audit_logs`
  with credential-shaped keys stripped. There is no endpoint that edits or
  deletes an entry, and there should not be.

## Skills

`.claude/skills/` holds **420 skills**, curated for this repo. Sources: the
original 50, [alirezarezvani/claude-skills](https://github.com/alirezarezvani/claude-skills),
plus stack-specific skills from Anthropic, Vercel, Supabase, obra/superpowers,
mattpocock, AccessLint and others. Skills for stacks we do not use have been
removed — see "Deliberately absent" below.

### Check the skills before you plan — every session, every non-trivial prompt

**Before writing a plan or touching code, run this. It is the roster (~1.6k
tokens) and it is cheap:**

```bash
ls .claude/skills | grep -vE '\.md$' | tr '\n' ' ' | fold -s -w 100
```

Then pull what the task needs into the session:

1. **Scan** the names against the task at hand.
2. **Confirm the fit.** `.claude/skills/INDEX.md` has one line per skill,
   grouped into 12 buckets (stack, testing, security, SEO, marketing, media,
   product, business, meta). Search it rather than reading it whole:
   ```bash
   grep -i "<keyword>" .claude/skills/INDEX.md
   ```
3. **Load it.** `Skill: <name>` runs the full workflow; reading
   `.claude/skills/<name>/SKILL.md` directly is enough when you only want its
   guidance. Load several when several apply — they compose.
4. **Say which skills you loaded and why** before starting the work.

Rules of thumb: prefer a skill over improvising when one covers the task; when
several overlap, load the most specific; stack-specific beats generic
(`nestjs-best-practices` over `senior-backend` for NestJS work). If nothing
fits, proceed normally — do not force one.

Skills ship their own `scripts/` and `references/`; run a skill's scripts from
that skill's own directory so relative paths resolve. The Python tools are
stdlib-only.

### Start here, by task

- **Backend (NestJS 11 / TypeORM / Postgres)** — `nestjs-best-practices`,
  `supabase`, `api-design-principles`, `api-design-reviewer`,
  `database-schema-designer`, `migration-architect`, `sql-database-assistant`
- **Frontend (Next 16 App Router / React 19 / Tailwind v4)** —
  `nextjs-app-router-patterns`, `react-best-practices`, `react-state-management`,
  `composition-patterns`, `tailwind-css-patterns`, `react-view-transitions`,
  `frontend-design`, `ui-ux-pro-max`
- **TypeScript** — `typescript-advanced-types`, `typescript-patterns`
- **Testing / debugging** — `test-driven-development`, `tdd-guide`,
  `webapp-testing`, `browser-qa`, `systematic-debugging`, `diagnosing-bugs`,
  `senior-qa`, `coverage`
- **Security** (we take payments and hold customer data) —
  `security-review-sentry`, `security-and-hardening`, `appsec`,
  `auth-implementation-patterns`, `js-security-audit`, `secrets-management`
- **Accessibility** — `accessibility-scan`, `accessibility-audit`,
  `accessibility-fix`, `a11y-audit`
- **Git / CI / review** — `ci-cd-patterns`, `devops-cicd`, `pr-review-expert`,
  `requesting-code-review`, `receiving-code-review`, `resolving-merge-conflicts`,
  `verification-before-completion`, `using-git-worktrees`
- **Planning** — `brainstorming`, `writing-plans`, `executing-plans`,
  `domain-modeling`, `to-spec`, `to-tickets`
- **Storefront growth / SEO** — `seo-audit`, `seo-technical`, `seo-content`,
  `schema-markup`, `site-architecture`, `page-cro`, `aeo`
- **Marketing / content** — `marketing-skills`, `content-engine`,
  `article-writing`, `copywriting`, `social-content`, `email-sequence`
- **Image / video / visual** — `canvas-design`, `algorithmic-art`,
  `banner-design`, `theme-factory`, `slack-gif-creator`, `demo-video`,
  `video-content-strategist`, `youtube-full`, `data-visualization`
- **Claude Code itself** — `claude-md-improver`, `skill-development`,
  `hook-development`, `claude-automation-recommender`, `write-a-skill`

### Deliberately absent

Do not re-add these; they were removed as irrelevant to this stack. If a task
seems to need one, the premise is probably wrong.

C#/.NET, Java/Kotlin, Go, Rust · Docker, Kubernetes, Helm, Terraform ·
AWS/Azure/GCP/Snowflake architecture · Stripe/PayPal (we use our own
bank-transfer, card and COD providers) · Jira/Confluence/Atlassian ·
Firebase/Convex/Clerk/Shopify/PlanetScale · mobile/native apps (App Store,
Apple HIG) · ML/CV/data-engineering · medical-device and clinical regulatory
(FDA, ISO 13485, MDR 745) · SOC 2 / ISO 27001 / ISO 42001 / EU AI Act.

### Renamed on install

Clashed with a built-in, an existing skill, or each other; frontmatter updated
to match the directory.

| Installed as | Was | Source |
|---|---|---|
| `hub-init`, `hub-run`, `hub-status` | `init`, `run`, `status` | agenthub |
| `ar-run`, `ar-status` | `run`, `status` | autoresearch-agent |
| `playwright-init` | `init` | playwright-pro |
| `handoff-engineering` | `handoff` | engineering (productivity's kept `handoff`) |
| `cold-email-cs`, `copywriting-cs`, `programmatic-seo-cs` | same names | clashed with skills already here, which were kept |
| `security-review-sentry` | `security-review` | getsentry/skills (clashed with a built-in) |
| `design-system-uiux` | `design-system` | ui-ux-pro-max |
