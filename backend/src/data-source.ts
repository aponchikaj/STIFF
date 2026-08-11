import { config as loadEnv } from 'dotenv';
import { DataSource } from 'typeorm';

loadEnv();

const DB_SCHEMA = process.env.DB_SCHEMA ?? 'public';
const SEARCH_PATH = [
  ...new Set([DB_SCHEMA, 'public', 'extensions']),
].join(',');

/**
 * Standalone DataSource for the TypeORM CLI (migration:generate / run / revert).
 *
 * Nest builds its own connection from `ConfigService` in `AppModule`; this file
 * exists only so the CLI can reach the same database outside the Nest context.
 * Keep the two in sync — connection settings here must match `app.module.ts`.
 *
 * `DB_SCHEMA` is provided so a baseline migration can be generated against an
 * empty schema without touching `public`.
 */
export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'stiff',
  password: process.env.DB_PASSWORD ?? 'stiff',
  database: process.env.DB_NAME ?? 'stiff',
  schema: DB_SCHEMA,
  // Migration SQL is deliberately unqualified so it targets whatever schema the
  // connection points at. Postgres resolves unqualified DDL through search_path,
  // which TypeORM does not set from `schema` alone — so set it explicitly. New
  // objects land in the first entry; the trailing entries only exist so that
  // extension functions (uuid_generate_v4) resolve — Supabase installs those
  // outside public.
  extra: { options: `-c search_path=${SEARCH_PATH}` },
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  synchronize: false,
});
