-- A private list of pieces someone means to come back for.
--
-- Mirrored by `1787182000000-Wishlist.ts`. This file is the reviewable record
-- of what actually touches the database.
--
-- Deliberately not the same thing as a like. A like is a public signal that
-- drives the "popular" sort and shows a count to everyone; a wishlist is
-- private intent. Conflating them loses both: people withhold likes on things
-- they want kept quiet, and the popularity sort fills up with bookmarks.

BEGIN;

CREATE TABLE IF NOT EXISTS "wishlist_items" (
  "id"        uuid NOT NULL DEFAULT uuid_generate_v4(),
  "userId"    uuid NOT NULL,
  "productId" uuid NOT NULL,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_wishlist_items" PRIMARY KEY ("id"),
  CONSTRAINT "FK_wishlist_items_user"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_wishlist_items_product"
    FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE
);

-- Saving twice is saving once.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_wishlist_items_user_product"
  ON "wishlist_items" ("userId", "productId");

-- "How many people saved this" for the admin, without a full scan.
CREATE INDEX IF NOT EXISTS "IDX_wishlist_items_product"
  ON "wishlist_items" ("productId");

COMMIT;
