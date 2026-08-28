# ops

## CI lives at `.github/workflows/ci.yml`

This note records why the pipeline spent a while parked in `ops/` instead.

Pushing anything under `.github/workflows/` requires a token carrying the
**`workflow`** scope. Without it the push fails with:

```
refusing to allow a Personal Access Token to create or update workflow
`.github/workflows/ci.yml` without `workflow` scope
```

That rejects the **entire push**, including every unrelated commit — which is
why the file lives here instead of blocking the branch.

### What it runs

| Job | On |
|---|---|
| Backend — lint, typecheck, unit tests | every branch |
| Migrations — apply, revert, re-apply against a throwaway Postgres | every branch |
| Frontend — lint, typecheck, build | every branch |
| Staff — lint, typecheck, build | only branches that carry `staff/` |

The migrations job is the important one: it proves a migration applies to an
empty schema and rolls back cleanly *before* it can reach the shared Supabase
database that also serves production.

### If a push is ever rejected for this again

The stored credential lost the scope, or is a different token than you think.
Note that creating a new token on GitHub does **not** change what git uses —
the old one stays in the macOS keychain until you clear it:

```bash
printf "protocol=https\nhost=github.com\n\n" | git credential-osxkeychain erase
```

The next push then prompts for username and token. Give it one with
**`workflow`** ticked (classic) or **Workflows: Read and write** (fine-grained).

## Which Vercel project serves which host

Four hosts, four separate Vercel projects, one repo. What decides which app a
host serves is the project's **Root Directory** and **Production Branch** —
both dashboard settings. Neither can be set from a file in the repo:
`vercel.json` is read *inside* the root directory, so it cannot be the thing
that chooses one.

| Host | Root Directory | Production Branch | Serves |
|---|---|---|---|
| `www.stiff.ge` (`stiff.ge` 308s to it) | `frontend` | `coming-soon` | the holding page |
| `staff.stiff.ge` | `staff` | `staff` | the staff workspace |
| `admin.stiff.ge` | `admin` | `admin` | the admin panel |
| — (API, not Vercel) | `backend` on Render | — | see `render.yaml` |

`admin/vercel.json` pins the panel to its own branch with an `ignoreCommand`,
so a push to `main` or `staff` does not redeploy it. That only takes effect
once Root Directory is `admin`.

### Symptom: a subdomain serves the shop instead of its own app

As of 2026-08-28 `admin.stiff.ge` returned the storefront — `/clothing` and
`/gallery` answered 200, `/audit` and `/products` 404'd, and `/sitemap.xml`
named a `stiff-*.vercel.app` deployment. All of that says the host was attached
to the **shop** project, whose Root Directory is `frontend`, rather than to a
project rooted at `admin`.

The branch was not the problem: `admin` is a superset of `main`, so a project
rooted at `frontend` builds a perfectly good storefront from it. That is why
the failure looks like "the site works, but it is the wrong site".

To fix, in the Vercel dashboard:

1. Open the project that owns the `admin.stiff.ge` domain
   (Settings → Domains shows which one).
2. If it is the shop project, remove the domain there — a domain lives on one
   project at a time.
3. On the project rooted at `admin` (create it from this repo if it does not
   exist: Root Directory `admin`, Production Branch `admin`), add
   `admin.stiff.ge` under Settings → Domains.
4. Set its env vars the panel expects — `BACKEND_URL` and
   `NEXT_PUBLIC_API_URL=/api`, so the session cookie stays first-party.
5. Redeploy. `/audit` answering 200 is the check that it took; `/clothing`
   should now 404.

Verify any of these hosts from the outside rather than by eye — the title alone
distinguishes them:

```bash
for h in www admin staff; do curl -sS -m 20 "https://$h.stiff.ge" | sed -n 's/.*<title>\(.*\)<\/title>.*/'"$h"': \1/p'; done
```
