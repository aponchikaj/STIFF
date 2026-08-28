import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Coins, the things they buy, and the tunables that decide how many of them
 * exist.
 *
 * Generated from `sql/1787240000000-GameEconomy.sql`. Edit the SQL, not this file — it is the
 * reviewable record of what actually touches the database.
 *
 * All new tables, all prefixed `game_`. Nothing existing is altered.
 *
 * The one rule this schema exists to enforce: **there is no balance column.**
 * A wallet is `SUM(delta)` over `game_coin_ledger`, and every credit and debit
 * is an immutable row with an idempotency key. A mutable balance is the shape
 * that loses money to a retried request, and no amount of care at the call
 * site fixes it.
 */
export class GameEconomy1787240000000 implements MigrationInterface {
  name = 'GameEconomy1787240000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_coin_ledger" (
        "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"         uuid NOT NULL,
        "delta"          integer NOT NULL,
        "reason"         character varying(32) NOT NULL,
        "refId"          uuid,
        "idempotencyKey" character varying(160) NOT NULL,
        "note"           text,
        "actorId"        uuid,
        "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_coin_ledger_reason"
          CHECK ("reason" IN (
            'run_reward',
            'purchase',
            'refund',
            'admin_adjustment',
            'coin_pack',
            'seed_grant'
          )),
        CONSTRAINT "CHK_game_coin_ledger_delta" CHECK ("delta" <> 0),
        CONSTRAINT "CHK_game_coin_ledger_adjustment"
          CHECK (
            "reason" <> 'admin_adjustment'
            OR ("actorId" IS NOT NULL AND "note" IS NOT NULL)
          ),
        CONSTRAINT "FK_game_coin_ledger_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_coin_ledger_actor"
          FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_game_coin_ledger_idempotency" UNIQUE ("idempotencyKey")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_game_coin_ledger_user"
        ON "game_coin_ledger" ("userId", "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_game_coin_ledger_rewards"
        ON "game_coin_ledger" ("userId", "refId")
        WHERE "reason" = 'run_reward'
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_items" (
        "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "slug"            character varying(64) NOT NULL,
        "name"            character varying(120) NOT NULL,
        "description"     text,
        "type"            character varying(32) NOT NULL,
        "rarity"          character varying(16) NOT NULL DEFAULT 'common',
        "priceCoins"      integer NOT NULL DEFAULT 0,
        "unlockCondition" jsonb,
        "assetRefs"       jsonb NOT NULL DEFAULT '{}'::jsonb,
        "characterId"     uuid,
        "availableFrom"   TIMESTAMP WITH TIME ZONE,
        "availableUntil"  TIMESTAMP WITH TIME ZONE,
        "isActive"        boolean NOT NULL DEFAULT true,
        "createdAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        "updatedAt"       TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_items_type"
          CHECK ("type" IN ('skin','noteSkin','uiTheme','namePlate','hypeChar','trail')),
        CONSTRAINT "CHK_game_items_rarity"
          CHECK ("rarity" IN ('common','rare','epic','legendary')),
        CONSTRAINT "CHK_game_items_priceCoins" CHECK ("priceCoins" >= 0),
        CONSTRAINT "CHK_game_items_window"
          CHECK (
            "availableFrom" IS NULL
            OR "availableUntil" IS NULL
            OR "availableFrom" < "availableUntil"
          ),
        CONSTRAINT "FK_game_items_character"
          FOREIGN KEY ("characterId") REFERENCES "game_characters"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "UQ_game_items_slug" UNIQUE ("slug")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_game_items_shop"
        ON "game_items" ("type", "priceCoins")
        WHERE "isActive"
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_inventories" (
        "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"     uuid NOT NULL,
        "itemId"     uuid NOT NULL,
        "source"     character varying(16) NOT NULL DEFAULT 'purchase',
        "acquiredAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_inventories_source"
          CHECK ("source" IN ('purchase','grant','unlock','seed')),
        CONSTRAINT "FK_game_inventories_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_inventories_item"
          FOREIGN KEY ("itemId") REFERENCES "game_items"("id") ON DELETE RESTRICT,
        CONSTRAINT "UQ_game_inventories_user_item" UNIQUE ("userId", "itemId")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_loadouts" (
        "id"        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"    uuid NOT NULL,
        "slot"      character varying(32) NOT NULL,
        "itemId"    uuid NOT NULL,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_loadouts_slot"
          CHECK ("slot" IN ('skin','noteSkin','uiTheme','namePlate','hypeChar','trail')),
        CONSTRAINT "FK_game_loadouts_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_loadouts_item"
          FOREIGN KEY ("itemId") REFERENCES "game_items"("id") ON DELETE RESTRICT,
        CONSTRAINT "UQ_game_loadouts_user_slot" UNIQUE ("userId", "slot")
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_purchases" (
        "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "userId"         uuid NOT NULL,
        "itemId"         uuid,
        "kind"           character varying(16) NOT NULL DEFAULT 'item',
        "priceCoins"     integer NOT NULL DEFAULT 0,
        "ledgerEntryId"  uuid NOT NULL,
        "orderId"        uuid,
        "idempotencyKey" character varying(160) NOT NULL,
        "createdAt"      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_purchases_kind"
          CHECK ("kind" IN ('item','coin_pack')),
        CONSTRAINT "CHK_game_purchases_item"
          CHECK (
            ("kind" = 'item' AND "itemId" IS NOT NULL)
            OR ("kind" = 'coin_pack' AND "itemId" IS NULL)
          ),
        CONSTRAINT "FK_game_purchases_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_game_purchases_item"
          FOREIGN KEY ("itemId") REFERENCES "game_items"("id") ON DELETE RESTRICT,
        CONSTRAINT "FK_game_purchases_ledger"
          FOREIGN KEY ("ledgerEntryId") REFERENCES "game_coin_ledger"("id")
          ON DELETE RESTRICT,
        CONSTRAINT "UQ_game_purchases_idempotency" UNIQUE ("idempotencyKey")
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_game_purchases_user"
        ON "game_purchases" ("userId", "createdAt" DESC)
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_economy_config" (
        "key"       character varying(64) PRIMARY KEY,
        "value"     jsonb NOT NULL,
        "updatedBy" uuid,
        "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_game_economy_config_updatedBy"
          FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "game_feature_flags" (
        "id"          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "key"         character varying(64) NOT NULL,
        "environment" character varying(16) NOT NULL DEFAULT 'production',
        "enabled"     boolean NOT NULL DEFAULT false,
        "description" text,
        "updatedBy"   uuid,
        "updatedAt"   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_game_feature_flags_environment"
          CHECK ("environment" IN ('development','stage','pre-prod','production')),
        CONSTRAINT "FK_game_feature_flags_updatedBy"
          FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_game_feature_flags_key_env" UNIQUE ("key", "environment")
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Reverse dependency order: children before the tables they reference.
    await queryRunner.query(`DROP TABLE IF EXISTS "game_feature_flags"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_economy_config"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_purchases"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_loadouts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_inventories"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_items"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "game_coin_ledger"`);
  }
}
