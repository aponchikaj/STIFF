-- CustomerConveniences — saved addresses and back-in-stock alerts.
--
-- Companion SQL for 1787178000000-CustomerConveniences.ts.
--
-- Addresses get their own table rather than a corner of users.settings: they
-- are queried, defaulted and listed, and `settings` is for preferences the app
-- reads once. A jsonb blob cannot have "exactly one default" as a rule.

CREATE TABLE IF NOT EXISTS "user_addresses" (
  "id"         uuid NOT NULL DEFAULT uuid_generate_v4(),
  "userId"     uuid NOT NULL,
  "label"      character varying(40) NOT NULL DEFAULT '',
  "firstName"  character varying(60) NOT NULL,
  "lastName"   character varying(60) NOT NULL,
  "line1"      character varying(200) NOT NULL DEFAULT '',
  "line2"      character varying(200),
  "city"       character varying(80) NOT NULL DEFAULT '',
  "region"     character varying(80),
  "postalCode" character varying(20),
  "country"    character varying(80) NOT NULL DEFAULT 'Georgia',
  "phone"      character varying(30) NOT NULL,
  "isDefault"  boolean NOT NULL DEFAULT false,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"  TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_user_addresses" PRIMARY KEY ("id"),
  CONSTRAINT "FK_user_addresses_user"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_user_addresses_userId"
  ON "user_addresses" ("userId");

-- Exactly one default per person, enforced rather than hoped for — two
-- defaults means checkout has to pick arbitrarily.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_user_addresses_one_default"
  ON "user_addresses" ("userId") WHERE "isDefault";

-- ---------------------------------------------------------- stock alerts --
CREATE TABLE IF NOT EXISTS "stock_alerts" (
  "id"         uuid NOT NULL DEFAULT uuid_generate_v4(),
  "variantId"  uuid NOT NULL,
  "userId"     uuid,
  "email"      character varying(180),
  "notifiedAt" TIMESTAMP WITH TIME ZONE,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_stock_alerts" PRIMARY KEY ("id"),
  CONSTRAINT "FK_stock_alerts_variant"
    FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_stock_alerts_user"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  -- Same one-owner rule as cart_items: an alert belongs to an account or to an
  -- email address, never both and never neither.
  CONSTRAINT "CHK_stock_alerts_one_owner"
    CHECK (("userId" IS NOT NULL) <> ("email" IS NOT NULL))
);

-- One live subscription per person per size. Partial, so someone can
-- subscribe again after being notified.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stock_alerts_user_variant"
  ON "stock_alerts" ("variantId", "userId")
  WHERE "userId" IS NOT NULL AND "notifiedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_stock_alerts_email_variant"
  ON "stock_alerts" ("variantId", lower("email"))
  WHERE "email" IS NOT NULL AND "notifiedAt" IS NULL;

-- The restock sweep looks for unnotified alerts on variants back in stock.
CREATE INDEX IF NOT EXISTS "IDX_stock_alerts_pending"
  ON "stock_alerts" ("variantId") WHERE "notifiedAt" IS NULL;
