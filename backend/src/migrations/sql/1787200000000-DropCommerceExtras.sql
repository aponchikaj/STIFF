-- Retires the commerce extras: promotions, returns, pre-orders, fit ratings,
-- stock alerts.
--
-- Forwards rather than a revert of the migrations that built these, which are
-- already recorded as run on every environment sharing this database.
--
-- Only safe because the code reading these is removed on every branch in the
-- same change. Dropping something a deployed branch still selects from is the
-- one thing this shared database cannot survive.

-- Child tables first — the foreign keys go with them.
DROP TABLE IF EXISTS "return_request_items";
DROP TABLE IF EXISTS "return_requests";
DROP TABLE IF EXISTS "discount_redemptions";
DROP TABLE IF EXISTS "gift_card_ledger";
DROP TABLE IF EXISTS "discount_codes";
DROP TABLE IF EXISTS "gift_cards";
DROP TABLE IF EXISTS "product_fit_ratings";
DROP TABLE IF EXISTS "stock_alerts";

ALTER TABLE "orders"
  DROP COLUMN IF EXISTS "discountCode",
  DROP COLUMN IF EXISTS "discountCents",
  DROP COLUMN IF EXISTS "giftCardCode",
  DROP COLUMN IF EXISTS "giftCardCents";

ALTER TABLE "order_items" DROP COLUMN IF EXISTS "isPreorder";

ALTER TABLE "products"
  DROP COLUMN IF EXISTS "preorderEnabled",
  DROP COLUMN IF EXISTS "preorderShipsAt",
  DROP COLUMN IF EXISTS "preorderLimit",
  DROP COLUMN IF EXISTS "fitSmallCount",
  DROP COLUMN IF EXISTS "fitTrueCount",
  DROP COLUMN IF EXISTS "fitLargeCount";

ALTER TABLE "product_variants" DROP COLUMN IF EXISTS "preorderedCount";
