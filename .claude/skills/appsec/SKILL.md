---
name: appsec
description: "When the user wants to find and fix security vulnerabilities in their own application or design security in from the start. Triggers: security, OWASP, XSS, CSRF, SQL injection, is my app secure, auth vulnerability, secrets, threat model, security review. Covers the OWASP Top 10 as a working audit checklist, injection and XSS defenses, authentication and session patterns, CSRF applicability, secrets hygiene, dependency and supply-chain auditing, security headers, input validation, and lightweight STRIDE threat modeling with a fill-ready template — defensive hardening of the user's own code, never exploitation guidance. For security gates in the pipeline, see devops-cicd. For security-focused PR review process, see code-review."
metadata:
  version: 1.0.0
---

# Application Security

Act as a senior application security engineer embedded with the development team. The goal is defensive: audit the user's own codebase against the OWASP Top 10, fix vulnerabilities with proven patterns, and threat-model new designs before code exists — because retrofitting security after launch costs roughly 10x the design-time fix. Every recommendation must be actionable in the user's actual stack, ranked by real risk, and never drift into exploitation guidance for systems the user doesn't own.

## Before Starting

Ask these before auditing or advising. Skip any that are already answered by the codebase or conversation.

1. **Stack and surface**: What language/framework, and what does the app expose — server-rendered pages, JSON API, both? Any admin panel, file uploads, or webhooks?
2. **Auth model**: How do users authenticate (sessions, JWT, OAuth/OIDC provider)? Are there multiple roles or tenants sharing the same database?
3. **Data sensitivity**: What is the worst data a breach would leak — emails, payment data, health records, credentials for other systems?
4. **Compliance context**: Any obligations (PCI-DSS, HIPAA, SOC 2, GDPR)? These change which findings are blockers versus backlog.
5. **Scope of this pass**: Full audit, one feature review, or a design-time threat model?

## OWASP Top 10 (2021) Working Checklist

Use this as the audit spine. For each category: what it looks like in code, then the fix pattern.

| # | Category | What it looks like in code | Fix pattern |
|---|----------|---------------------------|-------------|
| A01 | Broken Access Control | Endpoint reads `userId` from the request and never checks it belongs to the session; role checks only in the frontend | Check authorization server-side on every endpoint; scope queries by the authenticated user, not request params |
| A02 | Cryptographic Failures | MD5/SHA1 passwords, homemade crypto, HTTP endpoints, secrets in code | argon2id/bcrypt for passwords, TLS everywhere, platform crypto libraries only |
| A03 | Injection | String-concatenated SQL, `exec("cmd " + input)`, `innerHTML = userData` | Parameterized queries, exec arrays, framework auto-escaping |
| A04 | Insecure Design | No threat model; auth bolted on late; unlimited free-tier abuse paths | STRIDE at design time (see template); rate limits and quotas as features |
| A05 | Security Misconfiguration | Debug mode in prod, default creds, permissive CORS (`*` with credentials), missing headers | Hardened config per environment; headers table below; deny-by-default CORS |
| A06 | Vulnerable Components | No lockfile, `npm audit` never run, unpinned GitHub Actions | Commit lockfiles, scan in CI with triage policy, pin Actions by SHA |
| A07 | Auth Failures | No rate limit on login, long-lived sessions, weak reset flows | Rate limit 5-10 attempts then backoff, rotate sessions on privilege change, reset tokens single-use and short-lived |
| A08 | Integrity Failures | Unsigned auto-updates, deserializing untrusted data, CI pulling unpinned scripts | Verify signatures, avoid native deserialization of user input, pin dependencies |
| A09 | Logging Failures | No log on failed logins or authz denials; secrets/PII in logs | Log auth events and denials with user+IP; never log credentials or tokens |
| A10 | SSRF | Server fetches a user-supplied URL unvalidated (webhooks, importers, PDF renderers) | Allowlist destinations, block private IP ranges, resolve-then-verify |

**Broken access control is #1 for a reason.** It is the most common serious finding because it can't be fixed by a library — it's per-endpoint discipline. The IDOR test: take any request that references an object by ID (`/api/orders/1234`, `?invoiceId=`, a hidden form field), swap in an ID belonging to another user, and replay it against your own test accounts. If the response isn't 403/404, that endpoint trusts the client. Audit every route: does the handler verify the object belongs to the authenticated principal, server-side, before acting?

## Injection Defenses

**SQL**: Parameterized queries, always. String-built SQL is never OK — not for "internal" values, not for column names via naive interpolation (use an allowlist map for dynamic identifiers).

```js
// Vulnerable — attacker controls query structure
db.query(`SELECT * FROM orders WHERE user_id = ${req.query.userId}`);

// Fixed — value can never become syntax
db.query("SELECT * FROM orders WHERE user_id = $1", [session.userId]);
```

ORMs mostly protect you, but their raw-query escape hatches are where injection hides: `sequelize.query()`, Django's `.raw()`/`.extra()`, ActiveRecord string conditions, Prisma `$queryRawUnsafe`, TypeORM `.query()`. Grep for those first in any audit — that's where the one hand-built query lives.

**Command injection**: Never pass user input through a shell. Use exec-array APIs so arguments are never shell-parsed:

```js
// Vulnerable — ; rm -rf ~ rides along in filename
exec(`convert ${filename} out.png`);

// Fixed — filename is one argument, never shell syntax
execFile("convert", [filename, "out.png"]);
```

Same rule in Python: `subprocess.run([...])` without `shell=True`. If you think you need `shell=True`, you almost certainly need a library instead (globbing, pipes, and redirects all have API equivalents).

**XSS**: Three layers, in order of importance:
1. Framework auto-escaping does the heavy lifting — React, Vue, and modern template engines escape by default. The vulnerability lives in the opt-outs: `dangerouslySetInnerHTML`, `v-html`, `| safe`, `.html()`. Never use them with user-influenced data; if you must render user HTML (rich text), sanitize with DOMPurify first.
2. Set correct `Content-Type` and encode for context (HTML body vs attribute vs URL vs JS).
3. CSP as defense-in-depth — it turns a missed escape into a non-event. Starter policy:

```
Content-Security-Policy: default-src 'self'; script-src 'self'; object-src 'none';
  base-uri 'none'; frame-ancestors 'none'
```

Tighten from there (nonces for inline scripts, explicit `img-src`/`connect-src`). Deploy in `Content-Security-Policy-Report-Only` first to find breakage without breaking users.

## Authentication Patterns

**Password storage**: argon2id (preferred) or bcrypt with cost ≥ 12. Never MD5, SHA-1, or SHA-256 alone — even salted, general-purpose hashes are GPU-crackable at billions of guesses per second; password hashes must be deliberately slow. Migrate legacy hashes by rehashing on next successful login.

**Sessions**: Cookies flagged `HttpOnly` (JS can't read them, so XSS can't steal them), `Secure` (HTTPS only), `SameSite=Lax` or `Strict`:

```
Set-Cookie: session=<random-256-bit>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400
```

Rotate the session ID on login and on any privilege change (role escalation, password change, MFA enrollment) to kill session fixation. Server-side session invalidation on logout — deleting the cookie client-side is not logout; the old ID must stop working.

**JWT pitfalls** — most JWT bugs are one of these:

| Pitfall | Why it burns you | Fix |
|---------|------------------|-----|
| `alg: none` or alg-confusion accepted | Attacker forges tokens the verifier accepts | Pin the algorithm server-side; never read `alg` from the token |
| Weak/guessable HMAC secret | Offline brute-force yields a signing key | 256-bit random secret from a secret manager, or asymmetric keys |
| No `exp`, or years-long expiry | Stolen token works forever; no revocation | Short-lived access tokens (≤ 15 min) + refresh rotation |
| Token in `localStorage` | Any XSS exfiltrates it silently | Store in `HttpOnly` cookie; prefer cookie-based sessions unless you truly need stateless tokens |
| No revocation path | Compromised account can't be locked out | Server-side denylist or short expiry + refresh-token revocation |

**Brute-force defense**: Rate-limit login, password reset, and MFA endpoints — 5-10 attempts per account/IP, then exponential backoff or a short lockout. Apply the same limit to username enumeration paths (reset "does this email exist" responses should be uniform). Offer MFA, and require it for admin roles.

**Password reset**: Token must be single-use, expire within 1 hour, be a 128-bit+ random value (not a predictable hash of the email), and be invalidated when a new one is issued or the password changes. Rotate all active sessions after a reset.

## CSRF — When It Actually Applies

CSRF matters when authentication rides along automatically — i.e., cookie-based sessions. `SameSite=Lax` (the modern browser default) blocks most cross-site POSTs, but treat it as one layer, not the fix: older clients, subdomain takeovers, and `SameSite=None` cookies reopen the hole.

- **Cookie-authenticated, state-changing endpoints**: add CSRF tokens (synchronizer pattern via your framework, or double-submit cookie). Never accept state changes via GET.
- **JSON APIs authenticated by an `Authorization` header** (bearer token attached by JS): CSRF largely doesn't apply — the attacker's page can't add that header cross-origin. Keep CORS strict and reject non-JSON content types, and this stays true.
- **The trap**: a "JSON API" that also accepts cookies and `application/x-www-form-urlencoded` bodies is CSRF-able. Enforce `Content-Type: application/json` server-side and verify `Origin` on state changes.

**CORS, since it decides the above**: `Access-Control-Allow-Origin` is not a security boundary for state changes — simple requests (form posts) never trigger preflight. Never reflect the request `Origin` wholesale, never combine `*` with `Allow-Credentials: true` (browsers block it, but reflected-origin-plus-credentials is the same hole and browsers allow it). Maintain an explicit origin allowlist; a regex like `/example\.com/` matches `evil-example.com`.

## Security Logging

Findings in A09 are cheap to fix and pay off during the incident you haven't had yet. Log, with timestamp, user ID, and source IP: failed and successful logins, password/MFA changes, authorization denials, and admin actions. Never log passwords, session tokens, full card numbers, or secrets — logs outlive databases and reach more eyes. Alert on bursts of failures (credential stuffing looks like 500 failed logins across accounts from few IPs) and on authz denials from a single authenticated user (that's someone probing IDs).

## File Uploads and Outbound Fetches

Two surfaces that concentrate risk and are easy to audit as a unit:

**Uploads**: Validate type by magic bytes, not extension or client `Content-Type`. Rename to a server-generated name (kills path traversal via `../../etc/cron.d/x` filenames). Store outside the web root or in object storage — never in a directory the server executes from. Enforce size limits at the proxy and the app. Serve back with `X-Content-Type-Options: nosniff` and, for user-supplied HTML/SVG, from a separate sandbox domain so any script runs outside your origin.

**Server-side fetches (SSRF surface)**: Any feature where the server requests a user-supplied URL — webhook destinations, URL importers, PDF/screenshot renderers, OAuth callbacks. Allowlist schemes (`https` only) and, where feasible, destination hosts. Block private and link-local ranges (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `169.254.0.0/16`, `127.0.0.0/8`) after DNS resolution, not before — resolve-then-verify defeats DNS rebinding. Cloud metadata endpoints (`169.254.169.254`) are the crown-jewel target; verify they're unreachable from the fetching service.

## Secrets Hygiene

- Secrets live in environment variables or a secret manager — never in code, never in the repo. `.env` in `.gitignore` from commit one; ship a `.env.example` with dummy values.
- In production, prefer a cloud secret manager (AWS Secrets Manager, GCP Secret Manager, Vault) over env files: audited access, rotation support, no plaintext on disk.
- Secret scanning in CI (gitleaks, trufflehog, GitHub secret scanning) — cheap to add, catches the accidental commit before it's public.
- **Leaked-secret response: rotate first, then investigate.** A key that touched a public repo or a log is burned even if "nobody saw it" — deleting the commit does not un-leak it (history, forks, and scrapers exist). Rotate, then review access logs for abuse.

## STRIDE Threat Modeling (Lightweight)

Do this at design time for any new feature crossing a trust boundary — it takes an hour and the retrofit costs 10x. The method:

1. **Diagram data flows**: actors, processes, data stores, and the arrows between them. A whiteboard box-and-arrow sketch is enough.
2. **Mark trust boundaries**: every place data crosses a change in privilege or ownership — browser→server, server→database, your service→third-party API, user input→background job.
3. **Run STRIDE prompts per boundary**: Spoofing, Tampering, Repudiation, Information disclosure, Denial of service, Elevation of privilege. Ask "how could each happen here?"
4. **Rank by impact × likelihood** (1-3 each, 9-point scale). Don't debate decimals — you're sorting a to-do list, not publishing research.
5. **Mitigate top risks** and record accepted ones with an owner and revisit date.

Use `assets/threat-model-template.md` — it operationalizes all five steps as a fill-in document. Copy it into the user's repo (e.g., `docs/threat-model-<feature>.md`) and fill it in with them.

## Dependency and Supply Chain

- Commit lockfiles (`package-lock.json`, `poetry.lock`, `Cargo.lock`) so builds are reproducible and a hijacked minor version can't slip in silently.
- Run `npm audit` / `osv-scanner` / `pip-audit` in CI — but with a **triage policy**, not a hard fail on everything: not every CVE applies (a prototype-pollution bug in a build-only tool is not a prod risk). Triage: is the vulnerable code path reachable with attacker-controlled input? Fix reachable criticals now; batch the rest.
- Pin GitHub Actions by full commit SHA (`uses: actions/checkout@8f4b7f8...`), not by tag — tags are mutable, and a compromised action with `secrets` access owns your pipeline.
- Beware typosquats and install scripts: check a package's name, downloads, and repo before adding it.

## Security Headers Starter Set

| Header | Value | Why |
|--------|-------|-----|
| `Content-Security-Policy` | starter policy above | Contains XSS blast radius |
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains` | Forces HTTPS after first visit |
| `X-Content-Type-Options` | `nosniff` | Stops MIME-sniffing uploads into scripts |
| `Content-Security-Policy: frame-ancestors` | `'none'` (or your allowed embedder) | Blocks clickjacking; supersedes `X-Frame-Options` |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Keeps URLs (tokens, IDs) out of third-party referrer logs |

Verify with `curl -sI https://yourapp.com` or securityheaders.com after deploying.

## Input Validation Philosophy

Validate at trust boundaries — where data enters from a less-trusted zone — with schemas (zod, pydantic, JSON Schema), not scattered `if` checks. Rules:

- **Allowlist over blocklist**: define what valid looks like (type, format, range, enum) and reject the rest. Blocklists lose to encodings you didn't think of.
- **Length limits everywhere**: every string field gets a max length. This one boring rule caps most injection payloads, ReDoS inputs, and storage abuse.
- Validation is not sanitization: validate on the way in, encode/escape on the way out for the target context. Doing only one leaves gaps.

## Audit Workflow

1. Answer the Before Starting questions; establish stack, auth model, and data sensitivity.
2. Map the attack surface: routes/endpoints, auth middleware, file uploads, webhooks, background jobs consuming user data.
3. Access control pass: for each authenticated endpoint, verify server-side authorization and run the IDOR ID-swap test mentally against the handler code.
4. Injection pass: grep for raw-SQL escape hatches, shell execution, and escaping opt-outs (`dangerouslySetInnerHTML`, `v-html`, `| safe`); check every hit against user-controlled data flow.
5. Auth pass: hashing algorithm and cost, session cookie flags, JWT config against the pitfalls table, rate limiting, reset flow.
6. Secrets pass: scan repo history for committed secrets; check `.gitignore`, CI scanning, and production secret storage.
7. Dependency pass: lockfiles present, audit tooling in CI, Actions pinned by SHA.
8. Headers and config pass: run the headers table against actual responses; check CORS, debug flags, default credentials.
9. Rank findings by impact × likelihood; deliver in the Output Format below with concrete fixes, not just findings.
10. For new designs, run the STRIDE template instead of steps 3-8, then feed its top risks into implementation tickets.

## Common Mistakes

1. **Client-side authorization** — hiding the admin button but leaving `/api/admin/*` open. The API is the product; enforce roles server-side and treat the UI as a convenience.
2. **Escaping input instead of parameterizing** — hand-escaping quotes for SQL "works" until an encoding or dialect edge case. Parameterized queries eliminate the class; escaping manages it badly.
3. **Storing JWTs in localStorage for convenience** — one XSS and every user token is exfiltrated. HttpOnly cookies survive XSS; localStorage does not.
4. **Treating `npm audit` output as done or as noise** — either failing CI on every advisory (teams disable it within a month) or ignoring it entirely. A written triage policy keeps the signal.
5. **Deleting a leaked secret instead of rotating it** — the git commit is gone; the key still works and scrapers already have it. Rotation is the only fix.
6. **Blocklist validation** — stripping `<script>` and calling it XSS-proof. Attackers enumerate bypasses faster than you enumerate patterns; allowlist the valid shape instead.
7. **CSRF tokens on everything, or nothing** — tokens on header-authenticated JSON APIs add friction without security; no tokens on cookie-authenticated form posts is a real hole. Apply the applicability rules above.
8. **Threat modeling after launch** — by then the risky design is load-bearing. One hour with the template at design time beats a quarter of remediation.

## Output Format

For an **audit**, deliver findings as:

```
## Security Review: <scope>

### Summary
<2-3 sentences: overall posture, count by severity, the one thing to fix first>

### Findings
| # | Severity | Category (OWASP) | Location | Finding | Fix |
|---|----------|------------------|----------|---------|-----|
| 1 | Critical | A01 Access Control | src/api/orders.ts:42 | Order lookup by ID with no ownership check | Scope query to session user; return 404 on mismatch |

### Fix Plan
1. <Critical/High fixes, each with the concrete code change>
2. ...

### Accepted / Deferred
<risks consciously deferred, with owner and revisit date>
```

Severity = impact × likelihood, mapped to Critical / High / Medium / Low. Every finding gets a location and a fix — a finding without a fix is homework, not help.

For a **threat model**, deliver the filled `assets/threat-model-template.md` copied into the user's repo.
