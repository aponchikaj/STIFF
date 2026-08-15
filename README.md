# STIFF

Monorepo for the STIFF brand site: Next.js frontend and NestJS API.

## Structure

- `frontend/` — Next.js (App Router, `src/`) + TypeScript + Tailwind CSS v4
- `backend/` — NestJS 11 + TypeORM + PostgreSQL

There is no Docker. Postgres is a hosted Supabase instance shared by local
development and production — treat every schema change as a production change.

## Getting started

### 1. Environment

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env.local
```

Fill `backend/.env` with the Supabase connection, JWT secrets, Cloudinary, and
the seed admin. The frontend defaults to `http://localhost:4000/api`.

### 2. Start the API (port 4000)

```bash
cd backend
npm install
npm run start:dev
```

Pending migrations run on boot unless `DB_MIGRATIONS_RUN=false`. Schema changes
go through `npm run migration:generate` / `migration:run` — TypeORM
`synchronize` is off everywhere.

API prefix: http://localhost:4000/api  
Health: http://localhost:4000/api/health

### 3. Start the site (port 3000)

```bash
cd frontend
npm install
npm run dev
```

http://localhost:3000

## Deploy

- **Frontend** — Vercel. Production should track `main` with
  `NEXT_PUBLIC_API_URL=/api`, `BACKEND_URL` pointing at the Render API, and
  `NEXT_PUBLIC_SITE_URL=https://stiff.ge` (anything else stays out of search
  indexes).
- **Backend** — Render (`render.yaml`). `NODE_ENV=production`,
  `FRONTEND_URL=https://stiff.ge`, plus the same database and secrets as local.
- Branches `stage`, `pre-prod`, and `main` are independent deploys, not a
  required promotion pipeline.
