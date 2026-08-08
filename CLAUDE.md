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

## Branch workflow

Promotion pipeline: **local → `stage` → `pre-prod` → `main`**. Never skip a stage,
and never push work directly to `main`.

1. **Local** — build and test features locally (working branch or directly, per task).
2. **`stage`** — first remote destination for all new work. Push here and run
   functional testing (does it work at all).
3. **`pre-prod`** — promote from `stage` once stage testing passes. This is the
   human-testing gate: real staff members test the build here before anything
   goes further. Nothing reaches `main` without passing staff testing on `pre-prod`.
4. **`main`** — production. Only receives code promoted from `pre-prod` after
   staff sign-off. A push to `main` means "this is live."

Promotions are merges in one direction (stage → pre-prod → main); don't merge
backwards from main into stage except to sync after a release. Hotfixes still
flow through the same pipeline, just faster.

## Conventions

- **No Docker.** PostgreSQL runs as a local install on the machine
  (EDB installer, `/Library/PostgreSQL/`). Never add Docker files or suggest
  Docker-based workflows.
- All backend routes are prefixed with `/api` (set via `setGlobalPrefix`).
- Backend reads config from `backend/.env` via `@nestjs/config` (global).
  Database connection settings are `DB_HOST`, `DB_PORT`, `DB_USERNAME`,
  `DB_PASSWORD`, `DB_NAME`.
- TypeORM uses `autoLoadEntities` and `synchronize: true` outside production —
  register entities via `TypeOrmModule.forFeature` in feature modules; no
  migrations during early development.
- Global `ValidationPipe` with `whitelist` and `transform` is enabled —
  use `class-validator` decorators on DTOs.
- Frontend calls the API via `NEXT_PUBLIC_API_URL` from `frontend/.env.local`
  (default `http://localhost:4000/api`). Don't hardcode backend URLs.
- CORS on the backend allows only `FRONTEND_URL` (default `http://localhost:3000`).
