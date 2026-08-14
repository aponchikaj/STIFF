import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Phone uploads that landed on their side — a standing person reads
 * left-to-right until Cloudinary `a_*` turns them upright. The stored file
 * stays untouched; `rotation` is clockwise degrees applied at delivery.
 *
 * 270 = 90° counter-clockwise (head was on the right). Inspected against the
 * live archive, not EXIF — these shots already had orientation metadata
 * applied on upload. Shots that are meant to be landscape (lookbook, banners)
 * are left at 0.
 */
const CCW = ['0001', '0009', '0010', '0011', '0012', '0013', '0014', '0021'];

export class GalleryImageRotation1786737600000 implements MigrationInterface {
  name = 'GalleryImageRotation1786737600000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gallery_items" ADD "rotation" integer NOT NULL DEFAULT 0`,
    );
    await queryRunner.query(
      `UPDATE "gallery_items" SET "rotation" = 270 WHERE "slug" IN (${CCW.map((s) => `'${s}'`).join(', ')})`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "gallery_items" DROP COLUMN "rotation"`,
    );
  }
}
