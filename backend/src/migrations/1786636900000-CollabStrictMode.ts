import { MigrationInterface, QueryRunner } from 'typeorm';

export class CollabStrictMode1786636900000 implements MigrationInterface {
  name = 'CollabStrictMode1786636900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collab_campaigns" ADD "strictMode" boolean NOT NULL DEFAULT true`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collab_campaigns" DROP COLUMN "strictMode"`,
    );
  }
}
