import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * STIFF × KEBURIA drop: one-scan QR codes, bound viewing sessions, and a
 * private film that never lives on a public URL.
 */
export class CollabKeburia1786636800123 implements MigrationInterface {
  name = 'CollabKeburia1786636800123';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "collab_campaigns" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "slug" character varying(40) NOT NULL, "title" character varying(120) NOT NULL, "maxCodes" integer NOT NULL DEFAULT '300', "videoProvider" character varying(20), "videoPublicId" character varying(200), "videoDeliveryType" character varying(20), "videoMime" character varying(80), "videoUploadedAt" TIMESTAMP WITH TIME ZONE, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_collab_campaigns_slug" UNIQUE ("slug"), CONSTRAINT "PK_collab_campaigns" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE TABLE "collab_codes" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "campaignId" uuid NOT NULL, "serial" integer NOT NULL, "tokenHash" character varying(64) NOT NULL, "tokenEnc" text NOT NULL, "status" character varying(16) NOT NULL DEFAULT 'unused', "claimedAt" TIMESTAMP WITH TIME ZONE, "claimIpHash" character varying(64), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_collab_codes_tokenHash" UNIQUE ("tokenHash"), CONSTRAINT "UQ_collab_codes_campaign_serial" UNIQUE ("campaignId", "serial"), CONSTRAINT "PK_collab_codes" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_collab_codes_campaign_status" ON "collab_codes" ("campaignId", "status")`,
    );
    await queryRunner.query(
      `CREATE TABLE "collab_sessions" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "codeId" uuid NOT NULL, "campaignId" uuid NOT NULL, "sessionHash" character varying(64) NOT NULL, "expiresAt" TIMESTAMP WITH TIME ZONE NOT NULL, "lastSeenAt" TIMESTAMP WITH TIME ZONE NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_collab_sessions_codeId" UNIQUE ("codeId"), CONSTRAINT "UQ_collab_sessions_sessionHash" UNIQUE ("sessionHash"), CONSTRAINT "PK_collab_sessions" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `ALTER TABLE "collab_codes" ADD CONSTRAINT "FK_collab_codes_campaign" FOREIGN KEY ("campaignId") REFERENCES "collab_campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collab_sessions" ADD CONSTRAINT "FK_collab_sessions_code" FOREIGN KEY ("codeId") REFERENCES "collab_codes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "collab_sessions" ADD CONSTRAINT "FK_collab_sessions_campaign" FOREIGN KEY ("campaignId") REFERENCES "collab_campaigns"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `INSERT INTO "collab_campaigns" ("slug", "title", "maxCodes") VALUES ('keburia', 'STIFF × KEBURIA', 300)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collab_sessions" DROP CONSTRAINT "FK_collab_sessions_campaign"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collab_sessions" DROP CONSTRAINT "FK_collab_sessions_code"`,
    );
    await queryRunner.query(
      `ALTER TABLE "collab_codes" DROP CONSTRAINT "FK_collab_codes_campaign"`,
    );
    await queryRunner.query(`DROP TABLE "collab_sessions"`);
    await queryRunner.query(`DROP INDEX "IDX_collab_codes_campaign_status"`);
    await queryRunner.query(`DROP TABLE "collab_codes"`);
    await queryRunner.query(`DROP TABLE "collab_campaigns"`);
  }
}
