-- The two tables admin.stiff.ge needs.
--
-- Mirrored by `1787210000000-AdminWorkspace.ts`. This file is the reviewable
-- record of what actually touches the database.
--
-- Both are new tables. Nothing existing is altered or dropped, so a branch
-- deployed without the code for them is unaffected — which matters because
-- every branch runs against this same database.
--
-- `admin_refresh_tokens` is separate from `refresh_tokens` on purpose: ending
-- every admin session must not sign the same person out of the shop, and a
-- compromised shop token family must not reach admin.stiff.ge.
--
-- `admin_audit_logs` keeps the actor's email and username as snapshots and
-- sets `actorId` to NULL when the account goes. A trail that disappears along
-- with its subject is the one you needed.

BEGIN;

CREATE TABLE IF NOT EXISTS "admin_refresh_tokens" (
  "id"           uuid PRIMARY KEY,
  "userId"       uuid NOT NULL,
  "tokenHash"    character varying NOT NULL,
  "expiresAt"    TIMESTAMP WITH TIME ZONE NOT NULL,
  "revokedAt"    TIMESTAMP WITH TIME ZONE,
  "replacedById" uuid,
  "createdAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "FK_admin_refresh_tokens_user"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_admin_refresh_tokens_userId"
  ON "admin_refresh_tokens" ("userId");

CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "actorId"       uuid,
  "actorEmail"    character varying(320) NOT NULL,
  "actorUsername" character varying(120) NOT NULL,
  "origin"        character varying(16) NOT NULL,
  "method"        character varying(10) NOT NULL,
  "path"          character varying(512) NOT NULL,
  "statusCode"    integer NOT NULL,
  "ip"            character varying(64),
  "userAgent"     character varying(512),
  "changes"       jsonb,
  "createdAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "FK_admin_audit_logs_actor"
    FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL
);

-- The trail is read newest-first, either whole or filtered to one person.
CREATE INDEX IF NOT EXISTS "IDX_admin_audit_logs_createdAt"
  ON "admin_audit_logs" ("createdAt");
CREATE INDEX IF NOT EXISTS "IDX_admin_audit_logs_actor_createdAt"
  ON "admin_audit_logs" ("actorId", "createdAt");

COMMIT;
