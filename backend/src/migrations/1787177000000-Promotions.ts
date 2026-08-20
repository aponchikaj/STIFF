import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Discount codes, gift cards, and what an order paid with them.
 *
 * Mirrored in `sql/1787177000000-Promotions.sql`, which is the reviewable
 * record of what touches the database.
 *
 * Two things that look similar and must not share a table: a discount code is
 * a rule many people can use, a gift card is a balance one holder spends down.
 * "How much is left" only means something for one of them.
 */
export class Promotions1787177000000 implements MigrationInterface {
  name = 'Promotions1787177000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "discount_codes" (
        "id"               uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code"             character varying(40) NOT NULL,
        "kind"             character varying(16) NOT NULL,
        "value"            integer NOT NULL DEFAULT 0,
        "minSubtotalCents" integer NOT NULL DEFAULT 0,
        "usageLimit"       integer,
        "perUserLimit"     integer,
        "usedCount"        integer NOT NULL DEFAULT 0,
        "startsAt"         TIMESTAMP WITH TIME ZONE,
        "expiresAt"        TIMESTAMP WITH TIME ZONE,
        "isActive"         boolean NOT NULL DEFAULT true,
        "note"             character varying(200) NOT NULL DEFAULT '',
        "createdAt"        TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"        TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_discount_codes" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_discount_codes_kind"
          CHECK ("kind" IN ('percent','fixed','free_shipping')),
        CONSTRAINT "CHK_discount_codes_value"
          CHECK (
            ("kind" = 'percent' AND "value" BETWEEN 1 AND 100)
            OR ("kind" = 'fixed' AND "value" > 0)
            OR ("kind" = 'free_shipping')
          ),
        CONSTRAINT "CHK_discount_codes_limits"
          CHECK (
            ("usageLimit" IS NULL OR "usageLimit" > 0)
            AND ("perUserLimit" IS NULL OR "perUserLimit" > 0)
          )
      )
    `);
    // Case-insensitive uniqueness: STIFF10 and stiff10 are one code.
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_discount_codes_code" ON "discount_codes" (upper("code"))`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "discount_redemptions" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "codeId"      uuid NOT NULL,
        "orderId"     uuid NOT NULL,
        "userId"      uuid,
        "guestEmail"  character varying(180),
        "amountCents" integer NOT NULL DEFAULT 0,
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_discount_redemptions" PRIMARY KEY ("id"),
        CONSTRAINT "FK_discount_redemptions_code"
          FOREIGN KEY ("codeId") REFERENCES "discount_codes"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_discount_redemptions_order"
          FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_discount_redemptions_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL,
        CONSTRAINT "UQ_discount_redemptions_order" UNIQUE ("orderId")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_discount_redemptions_code_user" ON "discount_redemptions" ("codeId", "userId")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_discount_redemptions_code_email" ON "discount_redemptions" ("codeId", "guestEmail")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gift_cards" (
        "id"             uuid NOT NULL DEFAULT uuid_generate_v4(),
        "code"           character varying(40) NOT NULL,
        "initialCents"   integer NOT NULL,
        "remainingCents" integer NOT NULL,
        "isActive"       boolean NOT NULL DEFAULT true,
        "expiresAt"      TIMESTAMP WITH TIME ZONE,
        "note"           character varying(200) NOT NULL DEFAULT '',
        "createdAt"      TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gift_cards" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_gift_cards_initial" CHECK ("initialCents" > 0),
        CONSTRAINT "CHK_gift_cards_remaining"
          CHECK ("remainingCents" >= 0 AND "remainingCents" <= "initialCents")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "UQ_gift_cards_code" ON "gift_cards" (upper("code"))`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "gift_card_ledger" (
        "id"          uuid NOT NULL DEFAULT uuid_generate_v4(),
        "giftCardId"  uuid NOT NULL,
        "orderId"     uuid,
        "amountCents" integer NOT NULL,
        "reason"      character varying(40) NOT NULL DEFAULT 'spend',
        "createdAt"   TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_gift_card_ledger" PRIMARY KEY ("id"),
        CONSTRAINT "FK_gift_card_ledger_card"
          FOREIGN KEY ("giftCardId") REFERENCES "gift_cards"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_gift_card_ledger_order"
          FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_gift_card_ledger_card" ON "gift_card_ledger" ("giftCardId", "createdAt" DESC)`,
    );

    for (const [column, type] of [
      ['subtotalCents', 'integer NOT NULL DEFAULT 0'],
      ['discountCode', 'character varying(40)'],
      ['discountCents', 'integer NOT NULL DEFAULT 0'],
      ['giftCardCode', 'character varying(40)'],
      ['giftCardCents', 'integer NOT NULL DEFAULT 0'],
    ]) {
      await queryRunner.query(
        `ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "${column}" ${type}`,
      );
    }

    // Orders that predate discounts: their subtotal is total minus shipping,
    // which is exactly what it always was.
    await queryRunner.query(`
      UPDATE "orders"
      SET "subtotalCents" = GREATEST("totalCents" - COALESCE("shippingCents", 0), 0)
      WHERE "subtotalCents" = 0
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    for (const column of [
      'giftCardCents',
      'giftCardCode',
      'discountCents',
      'discountCode',
      'subtotalCents',
    ]) {
      await queryRunner.query(
        `ALTER TABLE "orders" DROP COLUMN IF EXISTS "${column}"`,
      );
    }
    await queryRunner.query(`DROP TABLE IF EXISTS "gift_card_ledger"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "gift_cards"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "discount_redemptions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "discount_codes"`);
  }
}
