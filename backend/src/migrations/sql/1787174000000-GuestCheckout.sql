-- GuestCheckout — let people fill a cart and order without an account.
--
-- Companion SQL for 1787174000000-GuestCheckout.ts.
--
-- A cart row belongs to exactly one owner: a signed-in user OR an anonymous
-- browser identified by the `stiff_cart` cookie. The CHECK constraint makes
-- "exactly one" a database rule rather than a convention, and the two partial
-- unique indexes keep the old "one row per product+size per owner" guarantee
-- for both kinds of owner.

-- --------------------------------------------------------------- cart ------
ALTER TABLE "cart_items" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "cart_items"
  ADD COLUMN IF NOT EXISTS "guestId" character varying(64);

-- The old constraint spans a now-nullable column, so it can no longer do the
-- job on its own: Postgres treats NULLs as distinct in a UNIQUE constraint.
ALTER TABLE "cart_items"
  DROP CONSTRAINT IF EXISTS "UQ_678f7fdd2b61c01a1316eacabf7";

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cart_items_user_product_size"
  ON "cart_items" ("userId", "productId", "size")
  WHERE "userId" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cart_items_guest_product_size"
  ON "cart_items" ("guestId", "productId", "size")
  WHERE "guestId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "IDX_cart_items_guestId"
  ON "cart_items" ("guestId")
  WHERE "guestId" IS NOT NULL;

ALTER TABLE "cart_items"
  DROP CONSTRAINT IF EXISTS "CHK_cart_items_one_owner";
ALTER TABLE "cart_items"
  ADD CONSTRAINT "CHK_cart_items_one_owner"
  CHECK (("userId" IS NOT NULL) <> ("guestId" IS NOT NULL));

-- -------------------------------------------------------------- orders -----
-- A guest order has no user to notify, so the address it was placed against
-- carries the email instead.
ALTER TABLE "orders"
  ADD COLUMN IF NOT EXISTS "guestEmail" character varying(180);

ALTER TABLE "orders"
  DROP CONSTRAINT IF EXISTS "CHK_orders_reachable";
ALTER TABLE "orders"
  ADD CONSTRAINT "CHK_orders_reachable"
  CHECK ("userId" IS NOT NULL OR "guestEmail" IS NOT NULL);

-- Guests find an order by its id alone, so that lookup must be indexed and
-- must not be guessable in bulk — the id is a v4 uuid, which is neither
-- sequential nor enumerable.
CREATE INDEX IF NOT EXISTS "IDX_orders_guestEmail"
  ON "orders" ("guestEmail")
  WHERE "guestEmail" IS NOT NULL;
