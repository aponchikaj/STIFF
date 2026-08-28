-- Coins, the things they buy, and the tunables that decide how many of them
-- exist.
--
-- Mirrored by `1787240000000-GameEconomy.ts`. This file is the reviewable
-- record of what actually touches the database.
--
-- All new tables, all prefixed `game_`. Nothing existing is altered.
--
-- The one rule this schema exists to enforce: **there is no balance column.**
-- A wallet is `SUM(delta)` over `game_coin_ledger`, and every credit and debit
-- is an immutable row with an idempotency key. A mutable balance is the shape
-- that loses money to a retried request, and no amount of care at the call
-- site fixes it.

BEGIN;

-- ---------------------------------------------------------------------------
-- Ledger
-- ---------------------------------------------------------------------------
-- Append-only by convention and by design: no `updatedAt`, and nothing in the
-- application updates or deletes a row. A correction is a compensating entry,
-- which is also what leaves the mistake visible.
--
-- `idempotencyKey` is the safety net. Minting from a run uses the run id, so a
-- double-submitted run credits once; a purchase uses a client-supplied key, so
-- a retried checkout debits once.
CREATE TABLE IF NOT EXISTS "game_coin_ledger" (
  "id"             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "userId"         uuid NOT NULL,
  -- Signed. Positive mints, negative spends.
  "delta"          integer NOT NULL,
  "reason"         character varying(32) NOT NULL,
  -- The run, purchase or admin action this entry accounts for.
  "refId"          uuid,
  "idempotencyKey" character varying(160) NOT NULL,
  -- Required on an admin adjustment: money appearing by hand needs a why.
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
  -- An adjustment by a human must say who and why; a machine-minted entry
  -- must not pretend to have an author.
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
);

-- The balance query: every entry for one player.
CREATE INDEX IF NOT EXISTS "IDX_game_coin_ledger_user"
  ON "game_coin_ledger" ("userId", "createdAt" DESC);
-- Diminishing returns needs "how much has this player already earned from
-- this chart today", which is a scan of one reason over one day.
CREATE INDEX IF NOT EXISTS "IDX_game_coin_ledger_rewards"
  ON "game_coin_ledger" ("userId", "refId")
  WHERE "reason" = 'run_reward';

-- ---------------------------------------------------------------------------
-- Items
-- ---------------------------------------------------------------------------
-- `type` is a varchar, not an enum, because the shop's slots are expected to
-- grow. v1 ships whole-skin swaps and non-anchored cosmetics; per-part
-- customisation (a hat that follows the head) needs skeletal rigs and would
-- add slots like `hat` and `accessory`. Adding one then is an ALTER of this
-- CHECK plus new rows — no change to inventories anyone already owns.
CREATE TABLE IF NOT EXISTS "game_items" (
  "id"              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "slug"            character varying(64) NOT NULL,
  "name"            character varying(120) NOT NULL,
  "description"     text,
  "type"            character varying(32) NOT NULL,
  "rarity"          character varying(16) NOT NULL DEFAULT 'common',
  "priceCoins"      integer NOT NULL DEFAULT 0,
  -- Null means "buyable". Non-null means it must be earned, e.g.
  -- `{"rank":"S","chartId":"..."}`, and price is then irrelevant.
  "unlockCondition" jsonb,
  "assetRefs"       jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- Set for a `skin`: which character this re-skins. Null for everything else.
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
);

CREATE INDEX IF NOT EXISTS "IDX_game_items_shop"
  ON "game_items" ("type", "priceCoins")
  WHERE "isActive";

-- ---------------------------------------------------------------------------
-- Inventories
-- ---------------------------------------------------------------------------
-- Owning something is a fact, not a quantity: the unique constraint means a
-- double-granted item is a no-op rather than a duplicate to reconcile.
--
-- Items are RESTRICT. Deleting an item somebody paid for would erase the thing
-- their coins bought; retiring it is `isActive = false`.
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
);

-- ---------------------------------------------------------------------------
-- Loadouts
-- ---------------------------------------------------------------------------
-- One row per equipped slot rather than a wide table with a column per slot.
-- This is the forward-compatibility the brief asks for: when skeletal rigging
-- makes `hat` and `accessory` real slots, they are new rows and a widened
-- CHECK, not a migration that rewrites everyone's loadout.
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
);

-- ---------------------------------------------------------------------------
-- Purchases
-- ---------------------------------------------------------------------------
-- The receipt. Written in the same transaction as its ledger debit and its
-- inventory row, so the three either all exist or none do.
--
-- `orderId` is the bridge to the shop when coins were bought with money: the
-- existing TBC/BOG card providers take the payment, an order records it, and
-- a `coin_pack` ledger credit follows. That is why this table can describe a
-- purchase with no `itemId`.
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
  -- An item purchase has an item; a coin pack does not.
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
);

CREATE INDEX IF NOT EXISTS "IDX_game_purchases_user"
  ON "game_purchases" ("userId", "createdAt" DESC);

-- ---------------------------------------------------------------------------
-- Tunables
-- ---------------------------------------------------------------------------
-- Payout curves, daily caps and diminishing-returns settings live here rather
-- than in code, so retuning the economy is an admin action with an audit trail
-- instead of a deploy.
CREATE TABLE IF NOT EXISTS "game_economy_config" (
  "key"       character varying(64) PRIMARY KEY,
  "value"     jsonb NOT NULL,
  "updatedBy" uuid,
  "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT "FK_game_economy_config_updatedBy"
    FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON DELETE SET NULL
);

-- Per-environment so a flag can be on in staging and off in production
-- without two rows fighting over one key.
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
);

COMMIT;
