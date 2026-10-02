import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The coin shop, and the watchers' vote.
 *
 * Additive throughout — two shop tables, a votes table, and defaulted
 * columns — so every branch keeps working against the shared database.
 *
 * **Shop.** `game_shop_items` is what an admin lists for coins;
 * `game_purchases` is who bought what at what price. A purchase's ledger
 * row points at it.
 *
 * **Votes.** A confirmed hand-in opens a window (`votingEndsAt`, three
 * hours) in which watchers say done or not — one vote each,
 * `UQ_game_attempt_votes_attempt_enrolment`. The resolver's conclusion is
 * kept on the attempt (`voting`), and `lastVoteWinAt` on the enrolment is
 * the five-hour cooldown between paid votes.
 *
 * The ledger's reason CHECK is widened for `vote_reward` and `purchase`.
 */
export class GameShopAndVoting1787320000000 implements MigrationInterface {
  name = 'GameShopAndVoting1787320000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "game_coin_ledger" DROP CONSTRAINT IF EXISTS "CHK_game_coin_ledger_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_coin_ledger" ADD CONSTRAINT "CHK_game_coin_ledger_reason"
         CHECK ("reason" IN ('task_reward', 'task_penalty', 'vote_reward', 'purchase', 'cheating', 'reinstated', 'admin'))`,
    );

    await queryRunner.query(
      `ALTER TABLE "game_enrolments" ADD COLUMN IF NOT EXISTS "lastVoteWinAt" TIMESTAMP WITH TIME ZONE`,
    );

    await queryRunner.query(
      `ALTER TABLE "game_attempts"
         ADD COLUMN IF NOT EXISTS "votingStatus" character varying(12) NOT NULL DEFAULT 'none',
         ADD COLUMN IF NOT EXISTS "votingEndsAt" TIMESTAMP WITH TIME ZONE,
         ADD COLUMN IF NOT EXISTS "voting" jsonb`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_attempts" DROP CONSTRAINT IF EXISTS "CHK_game_attempts_voting_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_attempts" ADD CONSTRAINT "CHK_game_attempts_voting_status"
         CHECK ("votingStatus" IN ('none', 'open', 'resolving', 'deferred', 'resolved'))`,
    );
    // The resolver asks "open and past its end" every few minutes.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_attempts_voting" ON "game_attempts" ("votingStatus", "votingEndsAt")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_attempt_votes" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "attemptId"   uuid NOT NULL,
        "enrolmentId" uuid NOT NULL,
        "userId"      uuid NOT NULL,
        "vote"        character varying(4) NOT NULL,
        "paidCoins"   integer NOT NULL DEFAULT 0,
        "createdAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_game_attempt_votes_attempt_enrolment" UNIQUE ("attemptId", "enrolmentId"),
        CONSTRAINT "CHK_game_attempt_votes_vote" CHECK ("vote" IN ('yes', 'no')),
        CONSTRAINT "FK_game_attempt_votes_attempt"
          FOREIGN KEY ("attemptId") REFERENCES "game_attempts"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_attempt_votes_enrolment"
          FOREIGN KEY ("enrolmentId") REFERENCES "game_enrolments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_attempt_votes_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_attempt_votes_attempt_vote" ON "game_attempt_votes" ("attemptId", "vote")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_attempt_votes_enrolment" ON "game_attempt_votes" ("enrolmentId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_shop_items" (
        "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "name"           character varying(80) NOT NULL,
        "description"    text,
        "imageUrl"       character varying(600),
        "priceCoins"     integer NOT NULL,
        "stock"          integer,
        "perPersonLimit" integer,
        "status"         character varying(12) NOT NULL DEFAULT 'draft',
        "sortOrder"      integer NOT NULL DEFAULT 0,
        "createdBy"      uuid,
        "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_shop_items_status" CHECK ("status" IN ('draft', 'live', 'archived')),
        CONSTRAINT "CHK_game_shop_items_price" CHECK ("priceCoins" >= 0),
        CONSTRAINT "CHK_game_shop_items_stock" CHECK ("stock" IS NULL OR "stock" >= 0),
        CONSTRAINT "CHK_game_shop_items_limit" CHECK ("perPersonLimit" IS NULL OR "perPersonLimit" >= 1)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_shop_items_status_sort" ON "game_shop_items" ("status", "sortOrder")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_purchases" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "itemId"      uuid NOT NULL,
        "enrolmentId" uuid NOT NULL,
        "userId"      uuid NOT NULL,
        "itemName"    character varying(80) NOT NULL,
        "priceCoins"  integer NOT NULL,
        "status"      character varying(12) NOT NULL DEFAULT 'paid',
        "note"        character varying(500),
        "createdAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_purchases_status" CHECK ("status" IN ('paid', 'fulfilled', 'cancelled')),
        CONSTRAINT "FK_game_purchases_item"
          FOREIGN KEY ("itemId") REFERENCES "game_shop_items"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_game_purchases_enrolment"
          FOREIGN KEY ("enrolmentId") REFERENCES "game_enrolments"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_purchases_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_purchases_enrolment_created" ON "game_purchases" ("enrolmentId", "createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_purchases_item_enrolment" ON "game_purchases" ("itemId", "enrolmentId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_purchases_item" ON "game_purchases" ("itemId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_game_purchases_user" ON "game_purchases" ("userId")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "game_purchases"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_shop_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_attempt_votes"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_game_attempts_voting"`);
    await queryRunner.query(
      `ALTER TABLE "game_attempts" DROP CONSTRAINT IF EXISTS "CHK_game_attempts_voting_status"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_attempts"
         DROP COLUMN IF EXISTS "voting",
         DROP COLUMN IF EXISTS "votingEndsAt",
         DROP COLUMN IF EXISTS "votingStatus"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_enrolments" DROP COLUMN IF EXISTS "lastVoteWinAt"`,
    );
    // Fails if any vote_reward or purchase row exists. Correct: the history
    // is real and a migration should not rewrite it.
    await queryRunner.query(
      `ALTER TABLE "game_coin_ledger" DROP CONSTRAINT IF EXISTS "CHK_game_coin_ledger_reason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "game_coin_ledger" ADD CONSTRAINT "CHK_game_coin_ledger_reason"
         CHECK ("reason" IN ('task_reward', 'task_penalty', 'cheating', 'reinstated', 'admin'))`,
    );
  }
}
