-- Colourways, per-colour imagery, and alt text for product photos.
--
-- Mirrored by `1787180000000-ProductColourways.ts`. This file is the
-- reviewable record of what actually touches the database.
--
-- A colourway is a dimension of the variant, not a separate product. Selling
-- "Black" and "Bone" as two products splits the reactions, the comments and
-- the archive links three ways for one garment, which is exactly what this
-- avoids.

BEGIN;

-- ---------------------------------------------------------------- variants --

ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "color" character varying(40) NOT NULL DEFAULT '';

-- Swatch fill. Null means "no swatch" and the picker falls back to the label.
ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "colorHex" character varying(7);

-- Photos of this colourway. Empty falls back to the product's own images, so a
-- single-colour product needs nothing here.
ALTER TABLE "product_variants"
  ADD COLUMN IF NOT EXISTS "images" text[] NOT NULL DEFAULT '{}';

ALTER TABLE "product_variants"
  DROP CONSTRAINT IF EXISTS "CHK_product_variants_color_hex";
ALTER TABLE "product_variants"
  ADD CONSTRAINT "CHK_product_variants_color_hex"
  CHECK ("colorHex" IS NULL OR "colorHex" ~ '^#[0-9A-Fa-f]{6}$');

-- The buyable unit is now (product, colour, size), not (product, size).
DROP INDEX IF EXISTS "UQ_product_variants_product_size";
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_variants_product_colour_size"
  ON "product_variants" ("productId", "color", "size");

-- ---------------------------------------------------------------- products --

-- Index-aligned with `images`. A shorter array simply means the trailing
-- photos have no description yet, which is why this is not a jsonb rewrite of
-- `images` — that would break every branch still reading text[].
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "imageAlts" text[] NOT NULL DEFAULT '{}';

-- ------------------------------------------------------------ order_items --

-- Snapshot, for the same reason `size` and `productName` are snapshots: the
-- line has to stay readable after the variant is gone.
ALTER TABLE "order_items"
  ADD COLUMN IF NOT EXISTS "color" character varying(40) NOT NULL DEFAULT '';

UPDATE "order_items" o
SET "color" = v."color"
FROM "product_variants" v
WHERE v."id" = o."variantId" AND o."color" = '';

-- ------------------------------------------------------------- cart_items --

-- Two colourways of the same size are two different lines, so the cart can no
-- longer be unique on (owner, product, size). Backfill first: a row written
-- before variants existed has no variantId and would fall outside the new
-- index entirely.
UPDATE "cart_items" c
SET "variantId" = v."id"
FROM "product_variants" v
WHERE v."productId" = c."productId"
  AND v."size" = c."size"
  AND v."color" = ''
  AND c."variantId" IS NULL;

DROP INDEX IF EXISTS "UQ_cart_items_user_product_size";
DROP INDEX IF EXISTS "UQ_cart_items_guest_product_size";

-- `variantId IS NOT NULL` rather than a NOT NULL column: a row the backfill
-- above could not resolve is abandoned, not worth deleting someone's cart
-- over, and it fails its own stock check at checkout regardless.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cart_items_user_variant"
  ON "cart_items" ("userId", "variantId")
  WHERE "userId" IS NOT NULL AND "variantId" IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_cart_items_guest_variant"
  ON "cart_items" ("guestId", "variantId")
  WHERE "guestId" IS NOT NULL AND "variantId" IS NOT NULL;

COMMIT;
