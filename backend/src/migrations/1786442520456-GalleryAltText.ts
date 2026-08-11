import { MigrationInterface, QueryRunner } from 'typeorm';

export class GalleryAltText1786442520456 implements MigrationInterface {
  name = 'GalleryAltText1786442520456';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gallery_items" ADD "altText" character varying(300)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gallery_items" DROP COLUMN "altText"`,
    );
  }
}
