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
