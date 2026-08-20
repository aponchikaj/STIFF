# STIFF

Monorepo for the STIFF brand project. Two independent apps, each with its own
`package.json` — always `cd` into the right one before running npm commands.

## Structure

- `frontend/` — Next.js 15 (App Router, `src/` dir, `@/*` alias) + TypeScript + Tailwind CSS v4
- `backend/` — NestJS 11 + TypeORM + PostgreSQL

## Commands

### Frontend (`frontend/`)

- `npm run dev` — dev server on http://localhost:3000 (Turbopack)
- `npm run build` — production build
- `npm run lint` — ESLint

### Backend (`backend/`)

- `npm run start:dev` — watch-mode dev server on http://localhost:4000
- `npm run build` — compile to `dist/`
- `npm run test` — Jest unit tests
- `npm run test:e2e` — e2e tests
- `npm run lint` — ESLint (flat config)

## Branches

Branches `stage`, `pre-prod`, and `main` exist, but there is no mandatory
promotion pipeline. Push to whichever branch the user names — "push to main"
means push directly to `main`, no intermediate steps required.

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
- CORS on the backend allows only `FRONTEND_URL` (default `http://localhost:3000`).

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
