-- SearchIndexes — ranked full-text search with typo tolerance.
--
-- Companion SQL for 1787173000000-SearchIndexes.ts. This file is the reviewable
-- record of exactly what runs against the database; the .ts wrapper executes the
-- same statements through TypeORM so the migrations table stays authoritative.
--
-- Replaces three unindexed `ILIKE '%term%'` scans with a weighted tsvector
-- expression index (name/title outrank body copy) plus pg_trgm indexes so a
-- misspelt query still matches.
--
-- These are EXPRESSION indexes rather than generated columns: no new column
-- means the entities are untouched, and `search.sql.ts` holds the one copy of
-- each expression so the query provably matches the index.

-- Supabase keeps extensions out of `public`; the app's search_path includes it.
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ---------------------------------------------------------------- products --
CREATE INDEX IF NOT EXISTS "IDX_products_search_fts"
  ON "products" USING GIN ((
    setweight(to_tsvector('english', coalesce("name", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("category", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'C')
  ));

CREATE INDEX IF NOT EXISTS "IDX_products_name_trgm"
  ON "products" USING GIN ("name" extensions.gin_trgm_ops);

-- ---------------------------------------------------------------- gallery ---
CREATE INDEX IF NOT EXISTS "IDX_gallery_search_fts"
  ON "gallery_items" USING GIN ((
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("altText", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("description", '')), 'C')
  ));

CREATE INDEX IF NOT EXISTS "IDX_gallery_title_trgm"
  ON "gallery_items" USING GIN ("title" extensions.gin_trgm_ops);
