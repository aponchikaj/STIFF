import { MigrationInterface, QueryRunner } from 'typeorm';

export class CollabCodeLabel1786637000000 implements MigrationInterface {
  name = 'CollabCodeLabel1786637000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "collab_codes" ADD "label" character varying(80)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "collab_codes" DROP COLUMN "label"`);
  }
}
