import { MigrationInterface, QueryRunner } from 'typeorm';

const ALL_PERMS = JSON.stringify([
  'people.view',
  'people.create',
  'people.create_owner',
  'people.assign_role',
  'people.block',
  'roles.manage',
  'tasks.view_others',
  'tasks.assign',
  'tasks.edit_others',
  'tasks.delete_others',
]);

const ADMIN_PERMS = JSON.stringify([
  'people.view',
  'people.create',
  'people.block',
  'tasks.view_others',
  'tasks.assign',
  'tasks.edit_others',
  'tasks.delete_others',
]);

export class StaffCustomRoles1786743000000 implements MigrationInterface {
  name = 'StaffCustomRoles1786743000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "staff_roles" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "name" character varying NOT NULL, "slug" character varying NOT NULL, "isOwner" boolean NOT NULL DEFAULT false, "isSystem" boolean NOT NULL DEFAULT false, "permissions" jsonb NOT NULL DEFAULT '[]', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "UQ_staff_roles_name" UNIQUE ("name"), CONSTRAINT "UQ_staff_roles_slug" UNIQUE ("slug"), CONSTRAINT "PK_staff_roles" PRIMARY KEY ("id"))`,
    );
    await queryRunner.query(
      `INSERT INTO "staff_roles" ("name", "slug", "isOwner", "isSystem", "permissions") VALUES ('Owner', 'owner', true, true, '${ALL_PERMS}'::jsonb), ('Admin', 'admin', false, false, '${ADMIN_PERMS}'::jsonb), ('Member', 'member', false, false, '[]'::jsonb)`,
    );
    await queryRunner.query(`ALTER TABLE "staff_users" ADD "roleId" uuid`);
    await queryRunner.query(
      `UPDATE "staff_users" u SET "roleId" = r.id FROM "staff_roles" r WHERE r.slug = u.role::text`,
    );
    await queryRunner.query(
      `UPDATE "staff_users" u SET "roleId" = r.id FROM "staff_roles" r WHERE u."roleId" IS NULL AND r.slug = 'member'`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_users" ALTER COLUMN "roleId" SET NOT NULL`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_users" ADD CONSTRAINT "FK_staff_users_role" FOREIGN KEY ("roleId") REFERENCES "staff_roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
    );
    await queryRunner.query(`ALTER TABLE "staff_users" DROP COLUMN "role"`);
    await queryRunner.query(`DROP TYPE "staff_users_role_enum"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "staff_users_role_enum" AS ENUM('owner', 'admin', 'member')`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_users" ADD "role" "staff_users_role_enum" NOT NULL DEFAULT 'member'`,
    );
    await queryRunner.query(
      `UPDATE "staff_users" u SET "role" = CASE WHEN r."isOwner" THEN 'owner'::staff_users_role_enum WHEN r.slug = 'admin' THEN 'admin'::staff_users_role_enum ELSE 'member'::staff_users_role_enum END FROM "staff_roles" r WHERE r.id = u."roleId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "staff_users" DROP CONSTRAINT "FK_staff_users_role"`,
    );
    await queryRunner.query(`ALTER TABLE "staff_users" DROP COLUMN "roleId"`);
    await queryRunner.query(`DROP TABLE "staff_roles"`);
  }
}
