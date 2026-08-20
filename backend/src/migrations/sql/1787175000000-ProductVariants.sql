-- ProductVariants — one row per buyable size.
--
-- Companion SQL for 1787175000000-ProductVariants.ts.
--
-- Replaces `products.stockBySize`, a jsonb map that could hold a quantity and
-- nothing else. A real row per size can carry a SKU and a price delta, and —
-- the reason this blocks so much else — other tables can finally foreign-key
-- to a specific size. Back-in-stock alerts and per-size cart lines both need
-- that.
--
-- A product with no sizes still gets exactly one variant, with size = ''. That
-- keeps every read path on a single shape instead of branching on "does this
-- product have sizes".

CREATE TABLE IF NOT EXISTS "product_variants" (
  "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
  "productId"        uuid NOT NULL,
  "size"             character varying(20) NOT NULL DEFAULT '',
  "sku"              character varying(64),
  "stock"            integer NOT NULL DEFAULT 0,
  "priceDeltaCents"  integer NOT NULL DEFAULT 0,
  "position"         double precision NOT NULL DEFAULT 0,
  "isActive"         boolean NOT NULL DEFAULT true,
  "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_product_variants" PRIMARY KEY ("id"),
  CONSTRAINT "FK_product_variants_product"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE,
  -- Stock is guarded here as well as in the decrement query: a negative row
  -- means overselling already happened, and it should fail loudly.
  CONSTRAINT "CHK_product_variants_stock" CHECK ("stock" >= 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_variants_product_size"
  ON "product_variants" ("productId", "size");

-- Nullable, so only products that actually have SKUs are constrained.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_variants_sku"
  ON "product_variants" ("sku") WHERE "sku" IS NOT NULL;

-- ---------------------------------------------------------------- backfill --
-- Sized products: one row per entry in the sizes array, keeping the admin's
-- chosen order as `position`. Quantity comes from stockBySize, defaulting to 0
-- for a size that was listed but never stocked.
INSERT INTO "product_variants" ("productId", "size", "stock", "position")
SELECT p."id",
       s."size",
       GREATEST(COALESCE((p."stockBySize" ->> s."size")::int, 0), 0),
       s."ord"
FROM "products" p
CROSS JOIN LATERAL unnest(p."sizes") WITH ORDINALITY AS s("size", "ord")
WHERE COALESCE(array_length(p."sizes", 1), 0) > 0
ON CONFLICT DO NOTHING;

-- One-size products: a single '' variant carrying the flat total.
INSERT INTO "product_variants" ("productId", "size", "stock", "position")
SELECT p."id", '', GREATEST(p."stock", 0), 0
FROM "products" p
WHERE COALESCE(array_length(p."sizes", 1), 0) = 0
ON CONFLICT DO NOTHING;

-- ------------------------------------------------------- cart and orders ---
ALTER TABLE "cart_items"
  ADD COLUMN IF NOT EXISTS "variantId" uuid;
ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "variantId" uuid;

UPDATE "cart_items" c
SET "variantId" = v."id"
FROM "product_variants" v
WHERE v."productId" = c."productId" AND v."size" = c."size"
  AND c."variantId" IS NULL;

UPDATE "order_items" o
SET "variantId" = v."id"
FROM "product_variants" v
WHERE v."productId" = o."productId" AND v."size" = o."size"
  AND o."variantId" IS NULL;

-- A cart line for a variant that no longer exists is meaningless, so it goes.
ALTER TABLE "cart_items"
  DROP CONSTRAINT IF EXISTS "FK_cart_items_variant";
ALTER TABLE "cart_items"
  ADD CONSTRAINT "FK_cart_items_variant"
  FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE CASCADE;

-- Order history must survive a variant being deleted, so the link is severed
-- rather than the row — `order_items.size` is already a snapshot for this
-- reason, exactly like `productName`.
ALTER TABLE "order_items"
  DROP CONSTRAINT IF EXISTS "FK_order_items_variant";
ALTER TABLE "order_items"
  ADD CONSTRAINT "FK_order_items_variant"
  FOREIGN KEY ("variantId") REFERENCES "product_variants"("id") ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS "IDX_cart_items_variantId"
  ON "cart_items" ("variantId") WHERE "variantId" IS NOT NULL;

-- Variants are the only stock of record from here on. `products.stock` stays
-- as a maintained total, because browsing sorts and filters on it.
ALTER TABLE "products" DROP COLUMN IF EXISTS "stockBySize";
