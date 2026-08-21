-- Named moments on a page, next to `page_views`, which only records arrivals.
--
-- The home page has seven acts and no evidence which ones anybody reaches. A
-- view tells you somebody arrived; it cannot tell you they left during the
-- hero. One row per named moment per visit answers that, and answers the same
-- question for anything else worth measuring later.

CREATE TABLE IF NOT EXISTS "page_events" (
  "id"        uuid NOT NULL DEFAULT uuid_generate_v4(),
  "path"      character varying(200) NOT NULL,
  -- What happened: "section_view", "intro_shown", "intro_skipped".
  "name"      character varying(40) NOT NULL,
  -- Which one it happened to: the section's key, and null when there isn't one.
  "label"     character varying(60),
  -- The same anonymous client-generated uuid `page_views` uses, so the two
  -- tables join on a visit without either of them holding anything personal.
  "visitorId" uuid NOT NULL,
  "userId"    uuid,
  "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
  CONSTRAINT "PK_page_events" PRIMARY KEY ("id")
);

-- Every report is "this event, on this path, over this window".
CREATE INDEX IF NOT EXISTS "IDX_page_events_lookup"
  ON "page_events" ("name", "path", "createdAt");

-- Reach is counted in distinct visitors, not rows.
CREATE INDEX IF NOT EXISTS "IDX_page_events_visitor"
  ON "page_events" ("visitorId");
