import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Seasons, enrolments, handed-in proof, and the feed people scroll.
 *
 * Purely additive — five new tables, nothing altered or dropped — so every
 * branch that does not carry `src/game/` yet keeps working against the same
 * database. That matters here more than usual: one hosted Postgres serves the
 * shop, staff, admin and game, and a migration merged anywhere is live
 * everywhere.
 *
 * **On the timestamp.** The removed rhythm game owned `1787220000000` through
 * `1787240000000` and its files were deleted without a drop migration, so those
 * rows may still sit in the `migrations` table. This starts above all three so
 * ordering cannot depend on whether they were ever cleaned up. None of its
 * sixteen table names collide with the five here, but every `CREATE` is
 * `IF NOT EXISTS` regardless — the live schema has not been read back, and a
 * migration that assumes what it will find is how a shared database breaks.
 *
 * There is no live streaming in this schema and that is deliberate, not
 * unfinished. An attempt is a recording: `kind` is a photo or a clip,
 * `durationSeconds` is checked into 5–120 by `CHK_game_attempts_duration`, and
 * a still is required to leave it null. The check lives in the database as well
 * as in `media-rules.ts` because the rule is the product, and a second writer
 * — a fixture, a console, a future admin tool — must not be able to slip a
 * ten-second-under clip past it.
 *
 * `objectKey` is minted by the server and the bytes never pass through the API;
 * the row exists before the file does. See `docs/game/hosting.md`.
 */
export class GameSeasonsAndFeed1787250000000 implements MigrationInterface {
  name = 'GameSeasonsAndFeed1787250000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_seasons" (
        "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug"           character varying(60) NOT NULL,
        "title"          character varying(120) NOT NULL,
        "status"         character varying(16) NOT NULL DEFAULT 'draft',
        "startsAt"       TIMESTAMP WITH TIME ZONE,
        "endsAt"         TIMESTAMP WITH TIME ZONE,
        "startingHearts" integer NOT NULL DEFAULT 3,
        "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_game_seasons_slug" UNIQUE ("slug"),
        CONSTRAINT "CHK_game_seasons_status"
          CHECK ("status" IN ('draft', 'open', 'running', 'closed'))
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_seasons_status" ON "game_seasons" ("status")`,
    );

    // Role is per season and cannot be both — the unique constraint is what
    // makes that a fact rather than a rule the service remembers to apply.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_enrolments" (
        "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "seasonId"        uuid NOT NULL,
        "userId"          uuid NOT NULL,
        "role"            character varying(16) NOT NULL,
        "handle"          character varying(24) NOT NULL,
        "heartsRemaining" integer NOT NULL DEFAULT 3,
        "heartsTotal"     integer NOT NULL DEFAULT 3,
        "nerve"           integer NOT NULL DEFAULT 0,
        "lastScoredAt"    TIMESTAMP WITH TIME ZONE,
        "createdAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_game_enrolments_season_user" UNIQUE ("seasonId", "userId"),
        CONSTRAINT "CHK_game_enrolments_role" CHECK ("role" IN ('player', 'watcher')),
        CONSTRAINT "CHK_game_enrolments_hearts" CHECK ("heartsRemaining" >= 0),
        CONSTRAINT "FK_game_enrolments_season"
          FOREIGN KEY ("seasonId") REFERENCES "game_seasons"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_enrolments_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_enrolments_season_role" ON "game_enrolments" ("seasonId", "role")`,
    );
    // The board reads players ordered by score; this is the index behind it.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_enrolments_board" ON "game_enrolments" ("seasonId", "role", "nerve" DESC)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_attempts" (
        "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "seasonId"        uuid NOT NULL,
        "enrolmentId"     uuid NOT NULL,
        "day"             smallint NOT NULL,
        "kind"            character varying(8) NOT NULL,
        "status"          character varying(20) NOT NULL DEFAULT 'awaiting_upload',
        "objectKey"       character varying(400) NOT NULL,
        "mediaUrl"        character varying(600),
        "mimeType"        character varying(60) NOT NULL,
        "byteSize"        bigint NOT NULL DEFAULT 0,
        "durationSeconds" integer,
        "width"           integer,
        "height"          integer,
        "caption"         character varying(280),
        "likeCount"       integer NOT NULL DEFAULT 0,
        "commentCount"    integer NOT NULL DEFAULT 0,
        "shareCount"      integer NOT NULL DEFAULT 0,
        "publishedAt"     TIMESTAMP WITH TIME ZONE,
        "createdAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_game_attempts_enrolment_day" UNIQUE ("enrolmentId", "day"),
        CONSTRAINT "CHK_game_attempts_day" CHECK ("day" BETWEEN 1 AND 3),
        CONSTRAINT "CHK_game_attempts_kind" CHECK ("kind" IN ('photo', 'video')),
        CONSTRAINT "CHK_game_attempts_status"
          CHECK ("status" IN ('awaiting_upload', 'submitted', 'published', 'rejected')),
        -- A clip is 5 to 120 seconds; a still has no duration at all. Held
        -- here as well as in media-rules.ts so no other writer can bypass it.
        CONSTRAINT "CHK_game_attempts_duration" CHECK (
          ("kind" = 'photo' AND "durationSeconds" IS NULL)
          OR ("kind" = 'video' AND "durationSeconds" BETWEEN 5 AND 120)
        ),
        CONSTRAINT "FK_game_attempts_season"
          FOREIGN KEY ("seasonId") REFERENCES "game_seasons"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_attempts_enrolment"
          FOREIGN KEY ("enrolmentId") REFERENCES "game_enrolments"("id") ON DELETE CASCADE
      )
    `);
    // The feed is "this season, published, newest first" and is paged by a
    // (publishedAt, id) cursor — this is the index that serves it.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_attempts_feed" ON "game_attempts" ("seasonId", "status", "publishedAt" DESC, "id" DESC)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_attempts_enrolment" ON "game_attempts" ("enrolmentId")`,
    );

    // One like per person per item. There is no dislike column, and its
    // absence is the design: a public downvote on a clip someone filmed of
    // themselves is a different product.
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_attempt_reactions" (
        "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "attemptId" uuid NOT NULL,
        "userId"    uuid NOT NULL,
        "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_game_attempt_reactions_attempt_user" UNIQUE ("attemptId", "userId"),
        CONSTRAINT "FK_game_attempt_reactions_attempt"
          FOREIGN KEY ("attemptId") REFERENCES "game_attempts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_attempt_reactions_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_attempt_reactions_attempt" ON "game_attempt_reactions" ("attemptId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_attempt_reactions_user" ON "game_attempt_reactions" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_attempt_comments" (
        "id"           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "attemptId"    uuid NOT NULL,
        "userId"       uuid NOT NULL,
        "authorHandle" character varying(24) NOT NULL,
        "body"         character varying(500) NOT NULL,
        "createdAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_game_attempt_comments_attempt"
          FOREIGN KEY ("attemptId") REFERENCES "game_attempts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_attempt_comments_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_attempt_comments_thread" ON "game_attempt_comments" ("attemptId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_attempt_comments_user" ON "game_attempt_comments" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse creation order; the foreign keys cascade, but being explicit
    // keeps the revert readable and lets it run against a partial apply.
    await queryRunner.query(`DROP TABLE IF EXISTS "game_attempt_comments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_attempt_reactions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_attempts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_enrolments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_seasons"`);
  }
}
