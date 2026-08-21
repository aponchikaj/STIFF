-- The drop list.
--
-- Separate from `users` on purpose. Someone who wants to hear about a drop has
-- not agreed to have an account, and making them register to get an email is
-- how a list stays small. This table is the asset; an account is a different
-- relationship that happens to share an address.

CREATE TABLE IF NOT EXISTS "subscribers" (
  "id"                uuid NOT NULL DEFAULT uuid_generate_v4(),
  "email"             character varying(180) NOT NULL,
  -- pending until the link in the email is clicked. Nothing is ever sent to a
  -- pending address except the one confirmation, which is the whole point of
  -- double opt-in: a typo'd or malicious signup cannot turn into a mailing.
  "status"            character varying(20) NOT NULL DEFAULT 'pending',
  -- Cleared the moment it is used, so a forwarded confirmation link is inert.
  "confirmToken"      character varying(64),
  "confirmSentAt"     TIMESTAMP,
  -- Permanent, and in the footer of every send. One click, no login: an
  -- unsubscribe behind a password is not an unsubscribe.
  "unsubscribeToken"  character varying(64) NOT NULL,
  "source"            character varying(40) NOT NULL DEFAULT 'home',
  "confirmedAt"       TIMESTAMP,
  "unsubscribedAt"    TIMESTAMP,
  "createdAt"         TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"         TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_subscribers" PRIMARY KEY ("id"),
  CONSTRAINT "CHK_subscribers_status"
    CHECK ("status" IN ('pending', 'confirmed', 'unsubscribed'))
);

-- One row per address, case-insensitively: Sam@X.com and sam@x.com are one
-- inbox, and two rows would mean two emails and two unsubscribe links.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subscribers_email"
  ON "subscribers" (lower("email"));

-- Both tokens are looked up by value, from a link, before anything else is
-- known about the request.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subscribers_confirm_token"
  ON "subscribers" ("confirmToken") WHERE "confirmToken" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_subscribers_unsubscribe_token"
  ON "subscribers" ("unsubscribeToken");

-- "Who do we actually send to" — the only query that runs at send time.
CREATE INDEX IF NOT EXISTS "IDX_subscribers_status"
  ON "subscribers" ("status");
