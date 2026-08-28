import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * What the rhythm game plays: songs, their charts, and the cast and scenery
 * around them.
 *
 * Generated from `sql/1787220000000-GameContent.sql`. Edit the SQL, not this file — it is the
 * reviewable record of what actually touches the database.
 *
 * Every table is new and prefixed `game_`. The prefix is not decoration: this
 * database is shared with the shop, and `songs`, `levels`, `characters` and
 * `items` are all names the shop could plausibly want later. Nothing existing
 * is altered or dropped, so branches deployed without this code are
 * unaffected.
 *
 * Statuses are `character varying` with a CHECK rather than a Postgres enum,
 * matching the rest of this schema. Adding a value is then an ALTER of one
 * constraint instead of a type migration that every branch has to agree on.
 */
export class GameContent1787220000000 implements MigrationInterface {
  name = 'GameContent1787220000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_songs" (
        "id"               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug"             character varying(64) NOT NULL,
        "title"            character varying(200) NOT NULL,
        "artist"           character varying(200) NOT NULL,
        "credit"           text,
        "licenseNote"      text NOT NULL,
        "sourceType"       character varying(16) NOT NULL DEFAULT 'upload',
        "sourceUrl"        text,
        "durationMs"       integer NOT NULL,
        "bpm"              double precision NOT NULL,
        "bpmIsManual"      boolean NOT NULL DEFAULT false,
        "audioInstKey"     character varying(512),
        "audioVoicesKey"   character varying(512),
        "audioOpponentKey" character varying(512),
        "previewStartMs"   integer NOT NULL DEFAULT 0,
        "status"           character varying(16) NOT NULL DEFAULT 'draft',
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
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_game_songs_status"
        ON "game_songs" ("status", "createdAt" DESC)
    `);
    await queryRunner.query(`
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
      )
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_game_charts_playable"
        ON "game_charts" ("songId", "difficulty")
        WHERE "status" = 'approved'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_game_charts_chartHash"
        ON "game_charts" ("chartHash")
    `);
    await queryRunner.query(`
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
      )
    `);
    await queryRunner.query(`
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
      )
    `);
    await queryRunner.query(`
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
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_game_levels_position"
        ON "game_levels" ("position")
    `);
    await queryRunner.query(`
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
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse dependency order: children before the tables they reference.
    await queryRunner.query(`DROP TABLE IF EXISTS "game_level_songs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_levels"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_stages"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_characters"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_charts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_songs"`);
  }
}
