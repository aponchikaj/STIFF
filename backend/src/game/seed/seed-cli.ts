import { AppDataSource } from '../../data-source';
import { seedGame } from './game-seed';

/**
 * `npm run seed:game` — writes the game's seed content.
 *
 * Guarded, because there is only one database and it is the one the shop runs
 * on. The seed is idempotent and additive, but "idempotent" is not "harmless
 * to run by reflex on production", so it refuses without an explicit opt-in.
 *
 *   SEED_GAME=yes npm run seed:game
 */
async function main(): Promise<void> {
  if (process.env.SEED_GAME !== 'yes') {
    console.error(
      'Refusing to seed. This writes to the shared database that also serves\n' +
        'the shop. Re-run with SEED_GAME=yes if that is what you meant:\n\n' +
        '  SEED_GAME=yes npm run seed:game\n',
    );
    process.exitCode = 1;
    return;
  }

  await AppDataSource.initialize();
  try {
    // One transaction: a half-seeded database is worse than an unseeded one.
    const report = await AppDataSource.transaction((manager) =>
      seedGame(manager),
    );
    console.log('Seeded:');
    for (const [what, count] of Object.entries(report)) {
      console.log(`  ${what.padEnd(12)} ${count}`);
    }
  } finally {
    await AppDataSource.destroy();
  }
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
