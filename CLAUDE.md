# STIFF

Monorepo for the STIFF brand project. Independent apps, each with its own
`package.json` — always `cd` into the right one before running npm commands.

## Structure

- `frontend/` — Next.js 15 (App Router, `src/` dir, `@/*` alias) + TypeScript + Tailwind CSS v4
- `staff/` — Next.js staff workspace for staff.stiff.ge (invite-only, separate people)
- `backend/` — NestJS 11 + TypeORM + PostgreSQL

## Commands

### Frontend (`frontend/`)

- `npm run dev` — dev server on http://localhost:3000 (Turbopack)
- `npm run build` — production build
- `npm run lint` — ESLint

### Staff (`staff/`)

- `npm run dev` — staff UI on http://localhost:3001
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
