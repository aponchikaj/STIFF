import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The two tables admin.stiff.ge needs: its own refresh-token family and the
 * audit trail.
 *
 * Mirrored in `sql/1787210000000-AdminWorkspace.sql`, which is the reviewable
 * record of what touches the database.
 *
 * Purely additive — two new tables, nothing altered or dropped — so branches
 * that do not have this code yet keep working against the same database.
 *
 * The refresh tokens are a separate table from `refresh_tokens` rather than a
 * flag on it: revoking every admin session must not sign the same person out
 * of the shop. The audit trail keeps the actor's email and username as
 * snapshots and nulls `actorId` on delete, so deleting an account cannot
 * quietly erase what it did.
 */
export class AdminWorkspace1787210000000 implements MigrationInterface {
  name = 'AdminWorkspace1787210000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_refresh_tokens" (
        "id"           uuid PRIMARY KEY,
        "userId"       uuid NOT NULL,
        "tokenHash"    character varying NOT NULL,
        "expiresAt"    TIMESTAMP WITH TIME ZONE NOT NULL,
        "revokedAt"    TIMESTAMP WITH TIME ZONE,
        "replacedById" uuid,
        "createdAt"    TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_admin_refresh_tokens_user"
          FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_refresh_tokens_userId" ON "admin_refresh_tokens" ("userId")`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "admin_audit_logs" (
        "id"            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        "actorId"       uuid,
        "actorEmail"    character varying(320) NOT NULL,
        "actorUsername" character varying(120) NOT NULL,
        "origin"        character varying(16) NOT NULL,
        "method"        character varying(10) NOT NULL,
        "path"          character varying(512) NOT NULL,
        "statusCode"    integer NOT NULL,
        "ip"            character varying(64),
        "userAgent"     character varying(512),
        "changes"       jsonb,
        "createdAt"     TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "FK_admin_audit_logs_actor"
          FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL
      )
    `);
    // The trail is read newest-first, either whole or filtered to one person.
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_audit_logs_createdAt" ON "admin_audit_logs" ("createdAt")`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS "IDX_admin_audit_logs_actor_createdAt" ON "admin_audit_logs" ("actorId", "createdAt")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_audit_logs"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "admin_refresh_tokens"`);
  }
}
