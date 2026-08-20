-- Archive links, fit ratings, and the counters behind them.
--
-- Mirrored by `1787181000000-ProductSocialProof.ts`. This file is the
-- reviewable record of what actually touches the database.

BEGIN;

-- ------------------------------------------------- gallery <-> products --

-- Many-to-many on purpose: one archive shot can feature several pieces, and
-- one piece appears in several shots. A column on either side would force a
-- lie in one direction.
CREATE TABLE IF NOT EXISTS "gallery_item_products" (
  "galleryItemId" uuid NOT NULL,
  "productId"     uuid NOT NULL,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_gallery_item_products"
    PRIMARY KEY ("galleryItemId", "productId"),
  CONSTRAINT "FK_gallery_item_products_item"
    FOREIGN KEY ("galleryItemId") REFERENCES "gallery_items"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_gallery_item_products_product"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
);

-- The product page reads "which shots feature this piece", so it needs the
-- index the primary key does not give it.
CREATE INDEX IF NOT EXISTS "IDX_gallery_item_products_product"
  ON "gallery_item_products" ("productId");

-- --------------------------------------------------------- fit ratings --

-- -1 runs small, 0 true to size, 1 runs large. Three buckets rather than five
-- stars: "how does it fit" is the question a shopper actually has, and a mean
-- of 4.2 stars answers none of it.
CREATE TABLE IF NOT EXISTS "product_fit_ratings" (
  "id"        uuid NOT NULL DEFAULT uuid_generate_v4(),
  "productId" uuid NOT NULL,
  "userId"    uuid NOT NULL,
  -- The size they actually wore, snapshotted, so the reading survives the
  -- variant being retired.
  "size"      character varying(20) NOT NULL DEFAULT '',
  "value"     smallint NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_product_fit_ratings" PRIMARY KEY ("id"),
  CONSTRAINT "FK_product_fit_ratings_product"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_product_fit_ratings_user"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "CHK_product_fit_ratings_value" CHECK ("value" IN (-1, 0, 1))
);

-- One reading per person per piece. Rating again edits the first.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_product_fit_ratings_product_user"
  ON "product_fit_ratings" ("productId", "userId");

-- Denormalised the same way likeCount is, and for the same reason: the
-- product grid would otherwise need a grouped subquery per row.
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "fitSmallCount" integer NOT NULL DEFAULT 0;
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "fitTrueCount" integer NOT NULL DEFAULT 0;
ALTER TABLE "products"
  ADD COLUMN IF NOT EXISTS "fitLargeCount" integer NOT NULL DEFAULT 0;

COMMIT;
