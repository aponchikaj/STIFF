# STIFF

Monorepo for the STIFF brand project.

## Structure

- `frontend/` — Next.js 15 (App Router) + TypeScript + Tailwind CSS
- `backend/` — NestJS + TypeORM + PostgreSQL (local install, no Docker)

## Getting started

### 1. Start PostgreSQL (Homebrew)

```bash
brew services start postgresql@17
```

The backend expects a `stiff` database owned by the `stiff` role
(password `stiff`) — see `backend/.env`.

### 2. Start the backend (port 4000)

```bash
cd backend
npm run start:dev
```

API is served under the `/api` prefix: http://localhost:4000/api

### 3. Start the frontend (port 3000)

```bash
cd frontend
npm run dev
```

App runs at http://localhost:3000 and reads the API base URL from
`NEXT_PUBLIC_API_URL` in `frontend/.env.local`.

## Environment

- `backend/.env` — server port, CORS origin, database credentials (copy from `.env.example`)
- `frontend/.env.local` — `NEXT_PUBLIC_API_URL`

TypeORM `synchronize` is enabled outside production, so entities auto-create
their tables during development.
