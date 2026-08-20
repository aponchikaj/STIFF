-- Gallery archive: shoots, credits, tags, hotspots, placeholders.
--
-- Every statement here is additive and every new column is nullable or
-- defaulted, because this database is shared with branches that do not have
-- the code yet. A deploy running the old gallery code never selects these
-- columns and is unaffected.

-- ---------------------------------------------------------------- shoots ----
-- A shoot is the unit the archive is actually made in: a day, a place, a set
-- of people. Shots have carried none of that, so a session that took a week to
-- organise arrives as fifteen unrelated catalogue numbers.
CREATE TABLE IF NOT EXISTS "gallery_shoots" (
  "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
  "slug"        character varying(120) NOT NULL,
  "title"       character varying(160) NOT NULL,
  "description" text,
  "location"    character varying(160),
  -- A date, not a timestamp: a shoot happened on a day, and the time of day
  -- is neither known nor interesting.
  "shotOn"      date,
  "coverItemId" uuid,
  "sortOrder"   integer NOT NULL DEFAULT 0,
  "isPublished" boolean NOT NULL DEFAULT true,
  "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_gallery_shoots" PRIMARY KEY ("id"),
  CONSTRAINT "FK_gallery_shoots_cover"
    FOREIGN KEY ("coverItemId") REFERENCES "gallery_items"("id") ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_gallery_shoots_slug"
  ON "gallery_shoots" ("slug");

-- Nullable on purpose. The existing 56 shots predate shoots and belong to
-- none; forcing them into a synthetic "Uncategorised" shoot would invent a
-- fact about the archive that isn't true.
ALTER TABLE "gallery_items" ADD COLUMN IF NOT EXISTS "shootId" uuid;

DO $$ BEGIN
  ALTER TABLE "gallery_items" ADD CONSTRAINT "FK_gallery_items_shoot"
    FOREIGN KEY ("shootId") REFERENCES "gallery_shoots"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "IDX_gallery_items_shoot"
  ON "gallery_items" ("shootId");

-- --------------------------------------------------------------- credits ----
-- One table for both levels. A credit hangs off exactly one owner: the shoot
-- (the usual case — one photographer for the day) or a single shot (the model
-- who appears in only one frame). The CHECK is the same one-owner pattern
-- `cart_items` uses, and it is what stops a row claiming to be both.
CREATE TABLE IF NOT EXISTS "gallery_credits" (
  "id"            uuid NOT NULL DEFAULT uuid_generate_v4(),
  "shootId"       uuid,
  "galleryItemId" uuid,
  "role"          character varying(40) NOT NULL,
  "name"          character varying(120) NOT NULL,
  -- Stored without the @, so the display and the URL are both derived rather
  -- than one of them being re-parsed out of the other.
  "instagram"     character varying(60),
  "url"           character varying(300),
  "sortOrder"     integer NOT NULL DEFAULT 0,
  "createdAt"     TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_gallery_credits" PRIMARY KEY ("id"),
  CONSTRAINT "CHK_gallery_credits_one_owner"
    CHECK (("shootId" IS NULL) <> ("galleryItemId" IS NULL)),
  CONSTRAINT "FK_gallery_credits_shoot"
    FOREIGN KEY ("shootId") REFERENCES "gallery_shoots"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_gallery_credits_item"
    FOREIGN KEY ("galleryItemId") REFERENCES "gallery_items"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "IDX_gallery_credits_shoot"
  ON "gallery_credits" ("shootId");
CREATE INDEX IF NOT EXISTS "IDX_gallery_credits_item"
  ON "gallery_credits" ("galleryItemId");

-- ------------------------------------------------------------------ tags ----
-- `kind` groups the filter bar. Season and location are the two axes the
-- archive is actually browsed along; everything else is a free theme.
CREATE TABLE IF NOT EXISTS "gallery_tags" (
  "id"        uuid NOT NULL DEFAULT uuid_generate_v4(),
  "slug"      character varying(80) NOT NULL,
  "label"     character varying(80) NOT NULL,
  "kind"      character varying(20) NOT NULL DEFAULT 'theme',
  "sortOrder" integer NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_gallery_tags" PRIMARY KEY ("id"),
  CONSTRAINT "CHK_gallery_tags_kind"
    CHECK ("kind" IN ('season', 'location', 'theme'))
);

CREATE UNIQUE INDEX IF NOT EXISTS "UQ_gallery_tags_slug"
  ON "gallery_tags" ("slug");

CREATE TABLE IF NOT EXISTS "gallery_item_tags" (
  "galleryItemId" uuid NOT NULL,
  "tagId"         uuid NOT NULL,
  CONSTRAINT "PK_gallery_item_tags" PRIMARY KEY ("galleryItemId", "tagId"),
  CONSTRAINT "FK_gallery_item_tags_item"
    FOREIGN KEY ("galleryItemId") REFERENCES "gallery_items"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_gallery_item_tags_tag"
    FOREIGN KEY ("tagId") REFERENCES "gallery_tags"("id") ON DELETE CASCADE
);

-- The composite PK covers "tags of this shot"; this covers "shots with this
-- tag", which is the direction the filter reads.
CREATE INDEX IF NOT EXISTS "IDX_gallery_item_tags_tag"
  ON "gallery_item_tags" ("tagId");

-- -------------------------------------------------------------- hotspots ----
-- Percentages of the *displayed* frame, after `rotation` is applied — the
-- coordinate space the admin clicked in and the visitor sees. Storing pixels
-- of the source would need re-deriving on every render and would silently
-- move every pin the day a shot is rotated.
--
-- Nullable: a product can be tagged to a shot without anyone having placed a
-- pin, and that still drives "Seen in the archive" and "Worn here".
ALTER TABLE "gallery_item_products" ADD COLUMN IF NOT EXISTS "hotspotX" real;
ALTER TABLE "gallery_item_products" ADD COLUMN IF NOT EXISTS "hotspotY" real;

DO $$ BEGIN
  ALTER TABLE "gallery_item_products" ADD CONSTRAINT "CHK_gallery_item_products_hotspot"
    CHECK (
      ("hotspotX" IS NULL) = ("hotspotY" IS NULL)
      AND ("hotspotX" IS NULL OR ("hotspotX" BETWEEN 0 AND 100 AND "hotspotY" BETWEEN 0 AND 100))
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------------------------------------------------- placeholders ----
-- A ~500-byte base64 JPEG shown while the real photograph decodes. Inline
-- rather than a URL on purpose: a grid of twenty-four placeholder *requests*
-- competes with the photographs it is standing in for, which is exactly the
-- problem it exists to solve.
ALTER TABLE "gallery_items" ADD COLUMN IF NOT EXISTS "blurDataUrl" text;
