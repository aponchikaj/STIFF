import { MigrationInterface, QueryRunner } from 'typeorm';

/** 0011 is the same sofa shoot as 0009–0013 and was left at 0 in the first pass. */
export class GalleryRotate00111786739000000 implements MigrationInterface {
  name = 'GalleryRotate00111786739000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "gallery_items" SET "rotation" = 270 WHERE "slug" = '0011'`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `UPDATE "gallery_items" SET "rotation" = 0 WHERE "slug" = '0011'`,
    );
  }
}
