-- Preorders — scheduled drops, and taking orders against stock not yet made.
--
-- Companion SQL for 1787179000000-Preorders.ts.
--
-- Two related things a drop brand needs and the shop could not do: publish a
-- product at a set moment without someone staying up for it, and accept orders
-- for a piece that has not been made yet.

-- When the product should go live. Null means it is governed by isActive alone.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP WITH TIME ZONE;

ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "preorderEnabled" boolean NOT NULL DEFAULT false;
-- What the customer is promised, shown on the product and the order.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "preorderShipsAt" date;
-- How many may be sold beyond real stock. 0 with preorder on means unlimited
-- would be a way to oversell by accident, so it means none.
ALTER TABLE "products" ADD COLUMN IF NOT EXISTS "preorderLimit" integer NOT NULL DEFAULT 0;

ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "CHK_products_preorder_limit";
ALTER TABLE "products"
  ADD CONSTRAINT "CHK_products_preorder_limit" CHECK ("preorderLimit" >= 0);

-- Counted against preorderLimit, and shown to the admin as what is owed.
ALTER TABLE "product_variants" ADD COLUMN IF NOT EXISTS "preorderedCount" integer NOT NULL DEFAULT 0;

ALTER TABLE "product_variants" DROP CONSTRAINT IF EXISTS "CHK_product_variants_preordered";
ALTER TABLE "product_variants"
  ADD CONSTRAINT "CHK_product_variants_preordered" CHECK ("preorderedCount" >= 0);

-- An order line that was a pre-order at the time, so the admin can see what is
-- owed even after the product stops taking them.
ALTER TABLE "order_items" ADD COLUMN IF NOT EXISTS "isPreorder" boolean NOT NULL DEFAULT false;

-- The publish sweep looks for products whose moment has come.
CREATE INDEX IF NOT EXISTS "IDX_products_publishAt"
  ON "products" ("publishAt") WHERE "publishAt" IS NOT NULL AND NOT "isActive";
