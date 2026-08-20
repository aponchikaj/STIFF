# ops

## `github-ci.yml` — the CI pipeline, not yet active

This is a complete GitHub Actions workflow. It is parked here rather than at
`.github/workflows/ci.yml` because pushing anything under `.github/workflows/`
requires a token carrying the **`workflow`** scope, and pushing it without one
fails with:

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

### Turning it on

Give the token the scope, then move the file:

1. GitHub → Settings → Developer settings → Personal access tokens
2. Classic → tick **`workflow`**. Fine-grained → *Repository permissions* →
   **Workflows: Read and write** (you also need **Contents: Read and write**)
3. Then:

```bash
mkdir -p .github/workflows
git mv ops/github-ci.yml .github/workflows/ci.yml
git commit -m "Activate CI"
git push
```

Nothing else needs to change — the file is ready as written.
