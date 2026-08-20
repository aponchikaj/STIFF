-- Promotions — discount codes, gift cards, and what an order paid with them.
--
-- Companion SQL for 1787177000000-Promotions.ts.
--
-- Two different things that look similar and must not be conflated:
--   a discount code is a rule (10% off, min 100 GEL, 200 uses) that many people
--   can use; a gift card is a balance that belongs to whoever holds it and is
--   spent down. Sharing one table would make "how much is left" meaningless for
--   one of them.

-- --------------------------------------------------------- discount codes --
CREATE TABLE IF NOT EXISTS "discount_codes" (
  "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
  "code"             character varying(40) NOT NULL,
  "kind"             character varying(16) NOT NULL,
  -- percent: 1-100. fixed: minor units off. free_shipping: ignored.
  "value"            integer NOT NULL DEFAULT 0,
  "minSubtotalCents" integer NOT NULL DEFAULT 0,
  -- Null means unlimited.
  "usageLimit"       integer,
  "perUserLimit"     integer,
  "usedCount"        integer NOT NULL DEFAULT 0,
  "startsAt"         TIMESTAMP WITH TIME ZONE,
  "expiresAt"        TIMESTAMP WITH TIME ZONE,
  "isActive"         boolean NOT NULL DEFAULT true,
  "note"             character varying(200) NOT NULL DEFAULT '',
  "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_discount_codes" PRIMARY KEY ("id"),
  CONSTRAINT "CHK_discount_codes_kind"
    CHECK ("kind" IN ('percent','fixed','free_shipping')),
  -- A percent code outside 1-100 is a typo that would either do nothing or
  -- give the shop away.
  CONSTRAINT "CHK_discount_codes_value"
    CHECK (
      ("kind" = 'percent' AND "value" BETWEEN 1 AND 100)
      OR ("kind" = 'fixed' AND "value" > 0)
      OR ("kind" = 'free_shipping')
    ),
  CONSTRAINT "CHK_discount_codes_limits"
    CHECK (
      ("usageLimit" IS NULL OR "usageLimit" > 0)
      AND ("perUserLimit" IS NULL OR "perUserLimit" > 0)
    )
);

-- Codes are matched case-insensitively; storing upper and indexing unique on
-- it is what stops STIFF10 and stiff10 becoming two different codes.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_discount_codes_code"
  ON "discount_codes" (upper("code"));

CREATE TABLE IF NOT EXISTS "discount_redemptions" (
  "id"         uuid NOT NULL DEFAULT uuid_generate_v4(),
  "codeId"     uuid NOT NULL,
  "orderId"    uuid NOT NULL,
  "userId"     uuid,
  "guestEmail" character varying(180),
  "amountCents" integer NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_discount_redemptions" PRIMARY KEY ("id"),
  CONSTRAINT "FK_discount_redemptions_code"
    FOREIGN KEY ("codeId") REFERENCES "discount_codes"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_discount_redemptions_order"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_discount_redemptions_user"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL,
  -- One redemption per order: applying two codes to one order is a policy
  -- decision, and the answer here is no.
  CONSTRAINT "UQ_discount_redemptions_order" UNIQUE ("orderId")
);

CREATE INDEX IF NOT EXISTS "IDX_discount_redemptions_code_user"
  ON "discount_redemptions" ("codeId", "userId");
CREATE INDEX IF NOT EXISTS "IDX_discount_redemptions_code_email"
  ON "discount_redemptions" ("codeId", "guestEmail");

-- ------------------------------------------------------------- gift cards --
CREATE TABLE IF NOT EXISTS "gift_cards" (
  "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
  "code"           character varying(40) NOT NULL,
  "initialCents"   integer NOT NULL,
  "remainingCents" integer NOT NULL,
  "isActive"       boolean NOT NULL DEFAULT true,
  "expiresAt"      TIMESTAMP WITH TIME ZONE,
  "note"           character varying(200) NOT NULL DEFAULT '',
  "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_gift_cards" PRIMARY KEY ("id"),
  CONSTRAINT "CHK_gift_cards_initial" CHECK ("initialCents" > 0),
  -- The balance can reach zero but never go under, and never exceed what was
  -- issued. This is money; the database enforces it, not the service.
  CONSTRAINT "CHK_gift_cards_remaining"
    CHECK ("remainingCents" >= 0 AND "remainingCents" <= "initialCents")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_gift_cards_code"
  ON "gift_cards" (upper("code"));

-- Every movement, so a partly-spent card can be reconstructed and disputed.
CREATE TABLE IF NOT EXISTS "gift_card_ledger" (
  "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
  "giftCardId"  uuid NOT NULL,
  "orderId"     uuid,
  "amountCents" integer NOT NULL,
  "reason"      character varying(40) NOT NULL DEFAULT 'spend',
  "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_gift_card_ledger" PRIMARY KEY ("id"),
  CONSTRAINT "FK_gift_card_ledger_card"
    FOREIGN KEY ("giftCardId") REFERENCES "gift_cards"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_gift_card_ledger_order"
    FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS "IDX_gift_card_ledger_card"
  ON "gift_card_ledger" ("giftCardId", "createdAt" DESC);

-- ---------------------------------------------------------------- orders ---
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "subtotalCents"  integer NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discountCode"   character varying(40);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "discountCents"  integer NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "giftCardCode"   character varying(40);
ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "giftCardCents"  integer NOT NULL DEFAULT 0;

-- Existing orders predate discounts, so their subtotal is the total minus
-- shipping — which is exactly what it was.
UPDATE "orders"
SET "subtotalCents" = GREATEST("totalCents" - COALESCE("shippingCents", 0), 0)
WHERE "subtotalCents" = 0;
