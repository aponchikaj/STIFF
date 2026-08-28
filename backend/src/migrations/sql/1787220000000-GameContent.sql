-- What the rhythm game plays: songs, their charts, and the cast and scenery
-- around them.
--
-- Mirrored by `1787220000000-GameContent.ts`. This file is the reviewable
-- record of what actually touches the database.
--
-- Every table is new and prefixed `game_`. The prefix is not decoration: this
-- database is shared with the shop, and `songs`, `levels`, `characters` and
-- `items` are all names the shop could plausibly want later. Nothing existing
-- is altered or dropped, so branches deployed without this code are
-- unaffected.
--
-- Statuses are `character varying` with a CHECK rather than a Postgres enum,
-- matching the rest of this schema. Adding a value is then an ALTER of one
-- constraint instead of a type migration that every branch has to agree on.

BEGIN;

-- ---------------------------------------------------------------------------
-- Songs
-- ---------------------------------------------------------------------------
-- `licenseNote` is NOT NULL with no default on purpose. The one thing that
-- must never be guessable after the fact is where a piece of music came from
-- and what we are allowed to do with it, so the schema refuses a song without
-- an answer rather than letting an empty string through later.
--
-- Instrumental and vocals are separate objects because they are separate
-- `AudioBufferSourceNode`s at play time — ducking the player's vocal on a miss
-- is impossible from a pre-mixed file. `audioOpponentKey` is optional: songs
-- with one shared vocal stem leave it null.
CREATE TABLE IF NOT EXISTS "game_songs" (
  "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable identity for URLs (/play/<slug>) and for idempotent seeding.
  "slug"             character varying(64) NOT NULL,
  "title"            character varying(200) NOT NULL,
  "artist"           character varying(200) NOT NULL,
  "credit"           text,
  "licenseNote"      text NOT NULL,
  "sourceType"       character varying(16) NOT NULL DEFAULT 'upload',
  "sourceUrl"        text,
  "durationMs"       integer NOT NULL,
  "bpm"              double precision NOT NULL,
  -- Set when a human overrode the detected tempo, so re-running analysis
  -- never silently discards that correction.
  "bpmIsManual"      boolean NOT NULL DEFAULT false,
  "audioInstKey"     character varying(512),
  "audioVoicesKey"   character varying(512),
  "audioOpponentKey" character varying(512),
  "previewStartMs"   integer NOT NULL DEFAULT 0,
  "status"           character varying(16) NOT NULL DEFAULT 'draft',
  -- The Stage A DSP result: beat grid, onsets, sections. Reusable across all
  -- four difficulties, which is why it is stored on the song and not the chart.
  "analysis"         jsonb,
  "createdBy"        uuid,
  "createdAt"        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt"        TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_game_songs_sourceType"
    CHECK ("sourceType" IN ('upload','url')),
  CONSTRAINT "CHK_game_songs_status"
    CHECK ("status" IN ('draft','analyzing','ready','published','archived')),
  CONSTRAINT "CHK_game_songs_durationMs" CHECK ("durationMs" > 0),
  CONSTRAINT "CHK_game_songs_bpm" CHECK ("bpm" > 0),
  CONSTRAINT "CHK_game_songs_previewStartMs" CHECK ("previewStartMs" >= 0),
  CONSTRAINT "FK_game_songs_createdBy"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "UQ_game_songs_slug" UNIQUE ("slug")
);

CREATE INDEX IF NOT EXISTS "IDX_game_songs_status"
  ON "game_songs" ("status", "createdAt" DESC);

-- ---------------------------------------------------------------------------
-- Charts
-- ---------------------------------------------------------------------------
-- A chart row is immutable once approved. Editing an approved chart creates a
-- new row at `version + 1` and archives the old one, rather than mutating in
-- place — because a run stores the exact `chartId` it was played against, and
-- rewriting notes underneath it would silently change what every historical
-- score meant.
--
-- `chartHash` is the hash of the *playable* content only (see
-- `canonicalizeChart` in packages/game-core). It is indexed because replay
-- validation looks a chart up by it on every single run submission.
CREATE TABLE IF NOT EXISTS "game_charts" (
  "id"                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "songId"                 uuid NOT NULL,
  "difficulty"             character varying(16) NOT NULL,
  "version"                integer NOT NULL DEFAULT 1,
  "notes"                  jsonb NOT NULL DEFAULT '[]'::jsonb,
  "events"                 jsonb NOT NULL DEFAULT '[]'::jsonb,
  "bpmChanges"             jsonb NOT NULL DEFAULT '[]'::jsonb,
  "scrollSpeed"            double precision NOT NULL DEFAULT 2.4,
  "chartHash"              character varying(64) NOT NULL,
  "status"                 character varying(16) NOT NULL DEFAULT 'draft',
  "generatedBy"            character varying(16) NOT NULL DEFAULT 'manual',
  -- Provenance for AI-generated charts, so a bad batch can be traced back to
  -- the model and prompt that produced it instead of being re-derived.
  "generatorModel"         character varying(128),
  "generatorPromptVersion" character varying(32),
  "npsPeak"                double precision NOT NULL DEFAULT 0,
  "npsAvg"                 double precision NOT NULL DEFAULT 0,
  "approvedBy"             uuid,
  "approvedAt"             TIMESTAMP WITH TIME ZONE,
  "createdAt"              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt"              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "CHK_game_charts_difficulty"
    CHECK ("difficulty" IN ('easy','normal','hard','extreme')),
  CONSTRAINT "CHK_game_charts_status"
    CHECK ("status" IN ('draft','approved','archived')),
  CONSTRAINT "CHK_game_charts_generatedBy"
    CHECK ("generatedBy" IN ('ai','manual','imported')),
  CONSTRAINT "CHK_game_charts_version" CHECK ("version" >= 1),
  CONSTRAINT "CHK_game_charts_scrollSpeed" CHECK ("scrollSpeed" > 0),
  -- Approved means a human signed off, so it cannot be true without a name
  -- and a time against it.
  CONSTRAINT "CHK_game_charts_approval"
    CHECK (
      "status" <> 'approved'
      OR ("approvedBy" IS NOT NULL AND "approvedAt" IS NOT NULL)
    ),
  CONSTRAINT "FK_game_charts_song"
    FOREIGN KEY ("songId") REFERENCES "game_songs"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_game_charts_approvedBy"
    FOREIGN KEY ("approvedBy") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "UQ_game_charts_version"
    UNIQUE ("songId", "difficulty", "version")
);

-- Exactly one approved chart per song and difficulty — that is the one the
-- game serves. Drafts and archived versions sit alongside it unconstrained.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_game_charts_playable"
  ON "game_charts" ("songId", "difficulty")
  WHERE "status" = 'approved';

CREATE INDEX IF NOT EXISTS "IDX_game_charts_chartHash"
  ON "game_charts" ("chartHash");

-- ---------------------------------------------------------------------------
-- Characters
-- ---------------------------------------------------------------------------
-- `animations` maps an animation name (`idle`, `singLeft`, `missUp`, `win`,
-- `lose`) to its frames *and its own x/y offset*. The offsets live inside each
-- entry rather than in a sibling column because they are per-animation, not
-- per-character: exported sprite frames are not consistently anchored, so
-- `singUp` routinely needs a different nudge than `idle` on the same sheet.
CREATE TABLE IF NOT EXISTS "game_characters" (
  "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"          character varying(120) NOT NULL,
  "slug"          character varying(64) NOT NULL,
  "atlasKey"      character varying(512),
  "atlasJsonKey"  character varying(512),
  "animations"    jsonb NOT NULL DEFAULT '{}'::jsonb,
  "healthIconKey" character varying(512),
  "isPlayable"    boolean NOT NULL DEFAULT false,
  "isOpponent"    boolean NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_game_characters_slug" UNIQUE ("slug")
);

-- ---------------------------------------------------------------------------
-- Stages
-- ---------------------------------------------------------------------------
-- `layers` is an ordered array of `{ assetKey, parallaxX, parallaxY, beatScale }`.
-- Ordered rather than keyed because draw order is the whole point of a stage.
CREATE TABLE IF NOT EXISTS "game_stages" (
  "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"      character varying(120) NOT NULL,
  "slug"      character varying(64) NOT NULL,
  "layers"    jsonb NOT NULL DEFAULT '[]'::jsonb,
  "baseZoom"  double precision NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_game_stages_slug" UNIQUE ("slug"),
  CONSTRAINT "CHK_game_stages_baseZoom" CHECK ("baseZoom" > 0)
);

-- ---------------------------------------------------------------------------
-- Levels — ordered groupings of songs, the "weeks" of the story mode
-- ---------------------------------------------------------------------------
-- Characters and the stage are RESTRICT, not SET NULL: a level with no
-- opponent is not a degraded level, it is an unplayable one, and failing the
-- delete is how the admin panel finds out the character is still in use.
CREATE TABLE IF NOT EXISTS "game_levels" (
  "id"                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "name"                character varying(120) NOT NULL,
  "slug"                character varying(64) NOT NULL,
  "position"            integer NOT NULL DEFAULT 0,
  "unlockRule"          jsonb,
  "opponentCharacterId" uuid,
  "playerCharacterId"   uuid,
  "stageId"             uuid,
  "isPublished"         boolean NOT NULL DEFAULT false,
  "createdAt"           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  "updatedAt"           TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "UQ_game_levels_slug" UNIQUE ("slug"),
  CONSTRAINT "FK_game_levels_opponent"
    FOREIGN KEY ("opponentCharacterId") REFERENCES "game_characters"("id")
    ON DELETE RESTRICT,
  CONSTRAINT "FK_game_levels_player"
    FOREIGN KEY ("playerCharacterId") REFERENCES "game_characters"("id")
    ON DELETE RESTRICT,
  CONSTRAINT "FK_game_levels_stage"
    FOREIGN KEY ("stageId") REFERENCES "game_stages"("id") ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS "IDX_game_levels_position"
  ON "game_levels" ("position");

CREATE TABLE IF NOT EXISTS "game_level_songs" (
  "id"       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "levelId"  uuid NOT NULL,
  "songId"   uuid NOT NULL,
  "position" integer NOT NULL DEFAULT 0,
  CONSTRAINT "FK_game_level_songs_level"
    FOREIGN KEY ("levelId") REFERENCES "game_levels"("id") ON DELETE CASCADE,
  CONSTRAINT "FK_game_level_songs_song"
    FOREIGN KEY ("songId") REFERENCES "game_songs"("id") ON DELETE RESTRICT,
  CONSTRAINT "UQ_game_level_songs_song" UNIQUE ("levelId", "songId"),
  CONSTRAINT "UQ_game_level_songs_position" UNIQUE ("levelId", "position")
);

COMMIT;
